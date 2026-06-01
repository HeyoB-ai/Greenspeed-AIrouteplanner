import type { Handler } from '@netlify/functions';

interface ServiceResult {
  service: string;
  ok: boolean;
  code?: number | string;
  error?: string | null;
}

export const handler: Handler = async () => {
  const GEMINI_KEY   = process.env.GEMINI_API_KEY;
  const MAPS_KEY     = process.env.GOOGLE_MAPS_API_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  const checks = await Promise.allSettled([

    // Gemini — list-models endpoint kost geen tokens; pageSize=1 minimaliseert payload.
    // 200 = key werkt; 400/403/404 = key ongeldig of project disabled.
    (async (): Promise<ServiceResult> => {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}&pageSize=1`
      );
      return { service: 'gemini', ok: r.ok, code: r.status };
    })(),

    // Maps Geocoding — reverse geocode op statische coords met result_type=country.
    // Goedkoopste call van de Geocoding API (< €0.001 per request).
    // REQUEST_DENIED = key/project probleem; OK / ZERO_RESULTS = werkt.
    (async (): Promise<ServiceResult> => {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=52.37,4.89&result_type=country&key=${MAPS_KEY}`
      );
      const d: any = await r.json();
      return {
        service: 'maps_geocoding',
        ok: d.status !== 'REQUEST_DENIED' && d.status !== 'INVALID_REQUEST',
        code: d.status,
        error: d.error_message ?? null,
      };
    })(),

    // Supabase REST — gratis quota.
    (async (): Promise<ServiceResult> => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pharmacies?limit=1`, {
        headers: {
          apikey: SUPABASE_KEY!,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      });
      return { service: 'supabase', ok: r.ok, code: r.status };
    })(),

  ]);

  const names = ['gemini', 'maps_geocoding', 'supabase'];
  const [geminiRes, mapsGeocodingRes, supabaseRes] = checks.map((c, i): ServiceResult =>
    c.status === 'fulfilled'
      ? c.value
      : { service: names[i], ok: false, error: String(c.reason) }
  );

  // Directions wordt niet apart gepingd — als Geocoding werkt is hetzelfde
  // Google Cloud project ook voor Directions geldig. Spaart één paid call.
  const mapsDirectionsRes: ServiceResult = {
    service: 'maps_directions',
    ok: mapsGeocodingRes.ok,
    code: mapsGeocodingRes.code,
    error: mapsGeocodingRes.error,
  };

  const services = [geminiRes, mapsGeocodingRes, mapsDirectionsRes, supabaseRes];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      overall: services.every(s => s.ok) ? 'healthy' : 'degraded',
      services,
    }),
  };
};
