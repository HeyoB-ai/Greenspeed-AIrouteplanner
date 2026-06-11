import { Address, ChatMessage } from "../types";
import { getAuthHeaders } from "./supabaseService";

export interface ScanResult {
  address: Address;
  pharmacyName?: string; // naam van de apotheek zoals op het label staat
}

const MODEL = 'gemini-2.5-flash';

/**
 * Stuurt een verzoek naar de Netlify proxy-functie die de Gemini API aanroept.
 * De API key blijft op de server — nooit zichtbaar in de browser.
 */
const MAX_RETRIES = 3;
// 429 niet meer retrybaar — de proxy doet een eigen rate limit, dus retryen
// is zinloos én vermenigvuldigt het probleem. 503 is wel een tijdelijke
// upstream-glitch die een retry rechtvaardigt.
const RETRYABLE_STATUSES = new Set([503]);

async function callGemini(requestBody: object): Promise<string | null> {
  const body = JSON.stringify({ model: MODEL, ...requestBody });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache',
          ...(await getAuthHeaders()),
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Rate-limit of overload → exponential backoff en opnieuw proberen
    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES - 1) {
      const waitMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`[Gemini] ${response.status} ontvangen — wacht ${waitMs}ms vóór retry (poging ${attempt + 2}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) {
      let errMsg = `Gemini proxy error ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData?.error?.message || errData?.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }

  throw new Error('Gemini rate limit bereikt na meerdere pogingen');
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
              text: 'Dit is een foto van één bezorgadres op een apotheeklabel of adressenlijst. Er is precies één adres zichtbaar in beeld (het adres in het midden van de foto). Het zijn gedrukte Nederlandse adressen in Latijnse tekens. Lees exact wat er staat — verzin niets en gebruik uitsluitend Latijnse letters (a-z), nooit niet-Latijnse tekens. Geef:\n- straatnaam (street)\n- huisnummer (houseNumber)\n- postcode (postalCode, formaat: 1234 AB)\n- stad (city)\n- apotheeknaam (pharmacyName) als zichtbaar, anders leeg\n\nGeen patiëntnamen, geen medicatienamen. Antwoord in JSON.',
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
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

// ── Route-optimalisatie via Google Maps Routes API ───────────────────

export interface LatLng { lat: number; lng: number; }

export interface RouteGeometry {
  orderedIds:     string[];
  coords:         LatLng[];
  totalDistanceM: number;
  totalDurationS: number;
}

interface BatchResult {
  ids:       string[];
  coords:    LatLng[];
  distanceM: number;
  durationS: number;
}

export async function optimizeRouteDetailed(
  addresses: (Address & { id: string })[],
  startAddress?: string | null,
  endAddress?: string | null
): Promise<RouteGeometry> {
  if (addresses.length === 0) {
    return { orderedIds: [], coords: [], totalDistanceM: 0, totalDurationS: 0 };
  }
  if (addresses.length === 1) {
    const a = addresses[0];
    const coords = a.lat != null && a.lng != null ? [{ lat: a.lat, lng: a.lng }] : [];
    return { orderedIds: [a.id], coords, totalDistanceM: 0, totalDurationS: 0 };
  }
  try {
    const result = await optimizeBatch(addresses, startAddress, endAddress);
    console.log('[Route] Geoptimaliseerde volgorde (fiets):');
    result.ids.forEach((id, i) => {
      const addr = addresses.find(a => a.id === id);
      console.log(`  Stop ${i + 1}: ${addr?.street} ${addr?.houseNumber}, ${addr?.postalCode}`);
    });
    console.log(`[Route] Totaal: ${(result.distanceM / 1000).toFixed(1)} km · ${Math.round(result.durationS / 60)} min`);
    return { orderedIds: result.ids, coords: result.coords, totalDistanceM: result.distanceM, totalDurationS: result.durationS };
  } catch (err) {
    console.error('[Route] Routes API mislukt, fallback op originele volgorde:', err);
    const coords = addresses.filter(a => a.lat != null && a.lng != null).map(a => ({ lat: a.lat!, lng: a.lng! }));
    return { orderedIds: addresses.map(a => a.id), coords, totalDistanceM: 0, totalDurationS: 0 };
  }
}

export async function optimizeRoute(
  addresses: (Address & { id: string })[],
  startAddress?: string | null,
  endAddress?: string | null
): Promise<string[]> {
  const { orderedIds } = await optimizeRouteDetailed(addresses, startAddress, endAddress);
  return orderedIds;
}

type GeoStop = Address & { id: string; lat: number; lng: number };

function clusterByGeography(stops: GeoStop[], maxClusterSize = 23): GeoStop[][] {
  const k = Math.ceil(stops.length / maxClusterSize);
  if (k === 1) return [stops];

  const centroids = stops
    .filter((_, i) => i % Math.floor(stops.length / k) === 0)
    .slice(0, k)
    .map(s => ({ lat: s.lat, lng: s.lng }));

  let assignments = new Array(stops.length).fill(0);
  for (let iter = 0; iter < 5; iter++) {
    assignments = stops.map(stop => {
      let minDist = Infinity, nearest = 0;
      centroids.forEach((c, ci) => {
        const d = (stop.lat - c.lat) ** 2 + (stop.lng - c.lng) ** 2;
        if (d < minDist) { minDist = d; nearest = ci; }
      });
      return nearest;
    });
    centroids.forEach((_, ci) => {
      const members = stops.filter((_, i) => assignments[i] === ci);
      if (!members.length) return;
      centroids[ci] = {
        lat: members.reduce((s, m) => s + m.lat, 0) / members.length,
        lng: members.reduce((s, m) => s + m.lng, 0) / members.length,
      };
    });
  }

  const clusters: GeoStop[][] = Array.from({ length: k }, () => []);
  stops.forEach((stop, i) => clusters[assignments[i]].push(stop));

  const result: GeoStop[][] = [];
  clusters.forEach(cluster => {
    if (cluster.length <= maxClusterSize) {
      result.push(cluster);
    } else {
      result.push(...clusterByGeography(cluster, maxClusterSize));
    }
  });

  return result.filter(c => c.length > 0);
}

function orderClusters(clusters: GeoStop[][], startCoord?: { lat: number; lng: number }): GeoStop[][] {
  if (clusters.length <= 1) return clusters;

  const centroids = clusters.map(c => ({
    lat: c.reduce((s, p) => s + p.lat, 0) / c.length,
    lng: c.reduce((s, p) => s + p.lng, 0) / c.length,
  }));

  const visited = new Set<number>();
  const ordered: number[] = [];
  let current = 0;

  if (startCoord) {
    let minDist = Infinity;
    centroids.forEach((c, i) => {
      const d = (c.lat - startCoord.lat) ** 2 + (c.lng - startCoord.lng) ** 2;
      if (d < minDist) { minDist = d; current = i; }
    });
  }

  visited.add(current);
  ordered.push(current);

  while (visited.size < clusters.length) {
    let nearest = -1, minDist = Infinity;
    centroids.forEach((c, i) => {
      if (visited.has(i)) return;
      const d = (c.lat - centroids[current].lat) ** 2 + (c.lng - centroids[current].lng) ** 2;
      if (d < minDist) { minDist = d; nearest = i; }
    });
    if (nearest === -1) break;
    visited.add(nearest);
    ordered.push(nearest);
    current = nearest;
  }

  return ordered.map(i => clusters[i]);
}

async function optimizeBatch(
  addresses: (Address & { id: string })[],
  startAddress?: string | null,
  endAddress?: string | null
): Promise<BatchResult> {
  if (addresses.length <= 25) {
    return await optimizeSingleBatch(addresses, startAddress, endAddress);
  }

  // Splits in reeds geocodeerde en nog te geocoderen adressen
  const cached   = addresses.filter(a => a.lat != null && a.lng != null);
  const uncached = addresses.filter(a => a.lat == null || a.lng == null);

  console.log(`[Route] ${cached.length} adressen hebben GPS, ${uncached.length} nog te geocoderen`);

  const withCoords: GeoStop[] = cached.map(a => ({ ...a, lat: a.lat!, lng: a.lng! }));

  if (uncached.length > 0) {
    console.log('[Route] Geocoderen van', uncached.length, 'ontbrekende adressen...');
    const geocodeResponse = await fetch('/.netlify/functions/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        action: 'geocode',
        addresses: uncached.map(a =>
          `${a.street} ${a.houseNumber}, ${a.postalCode} ${a.city}, Netherlands`
        ),
      }),
    });
    const { results } = await geocodeResponse.json() as { results: ({ lat: number; lng: number } | null)[] };
    uncached.forEach((addr, i) => {
      if (results[i]) withCoords.push({ ...addr, lat: results[i]!.lat, lng: results[i]!.lng });
    });
  }

  // Herstel originele volgorde, houd adressen zonder coords apart als fallback
  const geoStops = addresses
    .map(a => withCoords.find(w => w.id === a.id))
    .filter((x): x is GeoStop => x !== null && x !== undefined);
  const missingIds = addresses.filter(a => !withCoords.find(w => w.id === a.id)).map(a => a.id);

  if (geoStops.length === 0) return { ids: addresses.map(a => a.id), coords: [], distanceM: 0, durationS: 0 };

  const startCoord      = geoStops[0];
  const rawClusters     = clusterByGeography(geoStops, 23);
  const orderedClusters = orderClusters(rawClusters, startCoord);

  console.log('[Route]', orderedClusters.length, 'geografische clusters:', orderedClusters.map(c => c.length).join(' / '), 'stops');

  const allIds: string[] = [];
  const allCoords: LatLng[] = [];
  let distanceM = 0;
  let durationS = 0;
  for (let i = 0; i < orderedClusters.length; i++) {
    const batch = await optimizeSingleBatch(
      orderedClusters[i],
      i === 0 ? startAddress : null,
      i === orderedClusters.length - 1 ? endAddress : null,
    );
    allIds.push(...batch.ids);
    allCoords.push(...batch.coords);
    distanceM += batch.distanceM;
    durationS += batch.durationS;
  }
  return { ids: [...new Set([...allIds, ...missingIds])], coords: allCoords, distanceM, durationS };
}

async function optimizeSingleBatch(
  addresses: (Address & { id: string })[],
  startAddress?: string | null,
  endAddress?: string | null
): Promise<BatchResult> {
  if (addresses.length <= 1) {
    const a = addresses[0];
    const coords = a?.lat != null && a?.lng != null ? [{ lat: a.lat, lng: a.lng }] : [];
    return { ids: addresses.map(x => x.id), coords, distanceM: 0, durationS: 0 };
  }

  const formatAddress = (a: Address) =>
    `${a.street} ${a.houseNumber}, ${a.postalCode} ${a.city}, Netherlands`;

  // Als eindadres opgegeven: alle stops zijn waypoints (origin en destination zijn extern).
  // Als alleen startadres: alles behalve het laatste adres is waypoint.
  // Anders: eerste en laatste zijn origin/destination, de rest zijn waypoints.
  const hasExternalStart = !!startAddress;
  const hasExternalEnd   = !!endAddress;

  const origin      = startAddress ?? formatAddress(addresses[0]);
  const destination = endAddress   ?? formatAddress(addresses[addresses.length - 1]);

  const waypointAddresses = hasExternalEnd
    ? addresses                    // alle stops zijn waypoints
    : hasExternalStart
      ? addresses.slice(0, -1)     // alles behalve het laatste
      : addresses.slice(1, -1);    // alles behalve eerste én laatste

  const intermediates = waypointAddresses.map(a => formatAddress(a));

  console.log('[Route] Routes API aanroep voor', addresses.length, 'stops (fiets)...');

  const response = await fetch('/.netlify/functions/maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ origin, destination, intermediates }),
  });

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Routes API fout: ${data.status} — ${data.error_message ?? ''}`);
  }

  const order: number[] = data.order ?? [];
  console.log('[Route] Geoptimaliseerde waypoint-volgorde:', order);

  const reordered = hasExternalEnd
    ? order.map((i: number) => waypointAddresses[i].id)
    : hasExternalStart
      ? [
          ...order.map((i: number) => waypointAddresses[i].id),
          addresses[addresses.length - 1].id,
        ]
      : [
          addresses[0].id,
          ...order.map((i: number) => addresses[i + 1].id),
          addresses[addresses.length - 1].id,
        ];

  const coords: LatLng[] = (data.coords ?? []).map((p: any) => ({ lat: p.lat, lng: p.lng }));

  return {
    ids:       [...new Set(reordered)],
    coords,
    distanceM: data.distanceMeters  ?? 0,
    durationS: data.durationSeconds ?? 0,
  };
}
