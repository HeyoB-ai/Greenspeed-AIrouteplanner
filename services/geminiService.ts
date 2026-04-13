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
      headers: { 'Content-Type': 'application/json' },
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
              text: 'Zoek het afleveradres en de apotheeknaam op dit Nederlandse apotheek-etiket. Geef: straatnaam (street), huisnummer (houseNumber), postcode (postalCode), stad (city). Geef ook de naam van de apotheek (pharmacyName) als die zichtbaar is op het etiket — anders laat je pharmacyName leeg. Geen patiëntnamen, geen medicatie. Antwoord in JSON.',
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
//
// REGEL 1: Alle adressen in dezelfde straat worden ALTIJD aaneengesloten
//          geplaatst. Straatnaam-matching is hoofdlettergevoelig.
//          Binnen een straat: oplopend huisnummer.
// REGEL 2: Gemini optimaliseert daarna alleen de volgorde van straatgroepen.

const parseHouseNumber = (hn: string): number => parseInt(hn, 10) || 0;

export async function optimizeRoute(
  addresses: (Address & { id: string })[]
): Promise<string[]> {
  if (addresses.length === 0) return [];

  // ── Stap 1: Groepeer per straatnaam (hoofdlettergevoelig) ──────────
  const streetGroups = new Map<string, (Address & { id: string })[]>();
  for (const addr of addresses) {
    if (!streetGroups.has(addr.street)) streetGroups.set(addr.street, []);
    streetGroups.get(addr.street)!.push(addr);
  }

  // ── Stap 2: Sorteer binnen elke straat op oplopend huisnummer ──────
  for (const group of streetGroups.values()) {
    group.sort((a, b) => parseHouseNumber(a.houseNumber) - parseHouseNumber(b.houseNumber));
  }

  // ── Stap 3: Bouw vertegenwoordigers — één per straat voor Gemini ───
  const streets = Array.from(streetGroups.keys());

  if (streets.length === 1) {
    // Maar één straat — geen globale optimalisatie nodig
    return streetGroups.get(streets[0])!.map(a => a.id);
  }

  const representatives = streets.map(street => {
    const first = streetGroups.get(street)![0];
    return { street, postalCode: first.postalCode, city: first.city };
  });

  try {
    const text = await callGemini({
      contents: [{
        parts: [{
          text: `Optimaliseer de meest logische fietsroute langs deze straatgroepen voor een fietskoerier, beginnend in het centrum van de stad. Geef ALLE straatnamen terug in de optimale volgorde — geen toevoegingen, exact zoals aangeleverd. INPUT: ${JSON.stringify(representatives)}`,
        }],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
    });

    const orderedStreets: string[] = text ? JSON.parse(text) : streets;

    // ── Stap 4: Bouw definitieve ID-volgorde op ──────────────────────
    const remaining = new Map(streetGroups);
    const result: string[] = [];

    for (const street of orderedStreets) {
      const group = remaining.get(street);
      if (group) {
        result.push(...group.map(a => a.id));
        remaining.delete(street);
      }
    }
    // Voeg straten toe die Gemini eventueel oversloeg
    for (const group of remaining.values()) {
      result.push(...group.map(a => a.id));
    }

    return result;

  } catch (error: any) {
    console.error('AI Route Error:', error);
    // Fallback: straten in oorspronkelijke invoervolgorde, huisnummers gesorteerd
    const result: string[] = [];
    for (const group of streetGroups.values()) {
      result.push(...group.map(a => a.id));
    }
    return result;
  }
}
