import { Address, ChatMessage } from "../types";

export interface ScanResult {
  address: Address;
  pharmacyName?: string; // naam van de apotheek zoals op het label staat
}

const MODEL = 'gemini-2.5-flash';

/**
 * Stuurt een verzoek naar de Netlify proxy-functie die de Gemini API aanroept.
 * De API key blijft op de server — nooit zichtbaar in de browser.
 */
async function callGemini(requestBody: object): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify({ model: MODEL, ...requestBody }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errMsg = `Gemini proxy error ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData?.error?.message || errData?.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    // Gemini REST-response: candidates[0].content.parts[0].text
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractAddressFromImage(
  base64Image: string
): Promise<ScanResult | null> {
  try {
    const text = await callGemini({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text: 'Dit is een foto van één bezorgadres op een apotheeklabel of adressenlijst. Er is precies één adres zichtbaar in beeld (het adres in het midden van de foto). Lees dat ene adres en geef:\n- straatnaam (street)\n- huisnummer (houseNumber)\n- postcode (postalCode, formaat: 1234 AB)\n- stad (city)\n- apotheeknaam (pharmacyName) als zichtbaar, anders leeg\n\nGeen patiëntnamen, geen medicatienamen. Antwoord in JSON.',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            street:       { type: 'STRING' },
            houseNumber:  { type: 'STRING' },
            postalCode:   { type: 'STRING' },
            city:         { type: 'STRING' },
            pharmacyName: { type: 'STRING' },
          },
          required: ['street', 'houseNumber', 'postalCode', 'city'],
        },
      },
    });

    console.log('Gemini raw response (OCR):', text);
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      address: {
        street:      parsed.street,
        houseNumber: parsed.houseNumber,
        postalCode:  parsed.postalCode,
        city:        parsed.city,
      },
      pharmacyName: parsed.pharmacyName || undefined,
    };
  } catch (err: any) {
    if (err?.message?.includes('API key not configured')) {
      alert('Configuratie fout: GEMINI_API_KEY ontbreekt op de server. Voeg hem toe via Netlify → Site settings → Environment variables.');
    }
    throw err; // let processQueue handle and display it
  }
}

// ── Patiënt-chatbot ─────────────────────────────────────────────────

const PATIENT_SYSTEM_PROMPT = `
Je bent een vriendelijke informatie-assistent van een apotheek.

WAT JE MAG DOEN:
- Algemene informatie geven over medicijnen (zoals in bijsluiters staat)
- Uitleggen wat een medicijn doet, voor welke klachten het gebruikt wordt
- Algemene bewaartips geven
- Uitleggen hoe een medicijn ingenomen wordt (algemeen, niet persoonlijk)
- Vragen beantwoorden over de bezorgstatus (zie hieronder hoe)
- Doorverwijzen naar de apotheker voor persoonlijke vragen
- Een terugbelverzoek aanbieden

BEZORGSTATUS — BELANGRIJK:
Er zijn geen ordernummers, trackingcodes of referentienummers in dit systeem.
Pakketstatus wordt uitsluitend opgezocht via postcode + huisnummer.
Als een patiënt vraagt naar hun bezorging, vraag dan nooit om een ordernummer of code.
Verwijs hen naar het Track & Trace-scherm bovenaan deze pagina en leg uit dat
ze daar hun postcode en huisnummer kunnen invoeren om de status te zien.

WAT JE NOOIT DOET — ABSOLUUT VERBODEN:
- Persoonlijk doseeradvies geven
- Medicijninteracties beoordelen voor een specifieke persoon
- Zeggen of iemand een medicijn wel of niet moet gebruiken
- Diagnoses stellen of bevestigen
- Oordelen over behandelingen van artsen
- Vragen om een ordernummer, trackingcode of referentienummer

BIJ PERSOONLIJK MEDISCH ADVIES:
Sluit je antwoord altijd af met:
"Voor persoonlijk advies kunt u het beste contact opnemen met uw apotheker of huisarts."

TOON:
Vriendelijk, rustig, beknopt. Geen medisch jargon tenzij de gebruiker dat zelf gebruikt. Altijd in het Nederlands.

Apotheek: [PHARMACY_INFO]
`.trim();

const RISK_KEYWORDS = [
  'overdosis', 'teveel ingenomen', 'zelfmoord', 'zelfdoding',
  'leven beëindigen', 'suïcide', 'pijnstillers allemaal',
  'niet meer willen leven', 'per ongeluk teveel',
];

export function detectRisk(text: string): boolean {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some(kw => lower.includes(kw));
}

const EMERGENCY_RESPONSE =
  'Dit klinkt als een noodgeval. Bel direct **112** of bel **113** voor de Zelfmoordpreventielijn (24/7 bereikbaar, ook via chat op 113.nl). Geef deze informatie ook door aan iemand in uw omgeving.';

export async function answerPatientQuestion(
  question: string,
  history: ChatMessage[],
  pharmacyName: string
): Promise<{ text: string; hasRisk: boolean }> {
  // Risicodetectie vóór elke Gemini-aanroep
  if (detectRisk(question)) {
    return { text: EMERGENCY_RESPONSE, hasRisk: true };
  }

  const systemPrompt = PATIENT_SYSTEM_PROMPT.replace('[PHARMACY_INFO]', pharmacyName);

  // Gemini vereist afwisselende user/model beurt — map assistant → model
  const contents = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  try {
    const text = await callGemini({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });
    return { text: text ?? 'Er is iets misgegaan. Probeer het opnieuw.', hasRisk: false };
  } catch {
    return { text: 'Er is een fout opgetreden. Probeer het later opnieuw.', hasRisk: false };
  }
}

// ── Route-optimalisatie ──────────────────────────────────────────────

export async function optimizeRoute(
  addresses: (Address & { id: string })[]
): Promise<string[]> {
  if (addresses.length === 0) return [];

  const addressList = addresses
    .map((addr, i) => `${i}: ${addr.street} ${addr.houseNumber}, ${addr.postalCode ?? ''} ${addr.city}`.trim())
    .join('\n');

  try {
    const text = await callGemini({
      contents: [{
        parts: [{
          text: `Je bent een routeplanner voor een Nederlandse fietskoerier.

Adressen met dezelfde postcode liggen in dezelfde buurt.
De eerste 4 cijfers van de postcode geven het gebied aan,
de letters geven de straat aan.

Hier zijn de bezorgadressen:
${addressList}

Optimaliseer op minimale fietsafstand. Regels:
- Groepeer adressen met dezelfde 4-cijferige postcodeprefix zoveel mogelijk bij elkaar
- Ga nooit ver weg om later terug te komen
- Binnen een postcodecluster: sorteer op huisnummer
- Tussen clusters: kies de geografisch logische volgorde

Geef ALLEEN de nummers terug, kommagescheiden. Geen uitleg.
Voorbeeld output: 3,0,5,2,1,4`,
        }],
      }],
      generationConfig: {
        responseMimeType: 'text/plain',
      },
    });

    if (!text) throw new Error('Geen response van Gemini');

    const orderedIndices = text
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0 && n < addresses.length);

    // Voeg eventueel door Gemini overgeslagen indices toe aan het einde
    const seen = new Set(orderedIndices);
    for (let i = 0; i < addresses.length; i++) {
      if (!seen.has(i)) orderedIndices.push(i);
    }

    return orderedIndices.map(i => addresses[i].id);

  } catch (error: any) {
    console.error('AI Route Error:', error);
    return addresses.map(a => a.id);
  }
}
