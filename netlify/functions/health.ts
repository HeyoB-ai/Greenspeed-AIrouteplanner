import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const GEMINI_KEY   = process.env.GEMINI_API_KEY;
  const MAPS_KEY     = process.env.GOOGLE_MAPS_API_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  // Géén echte API-calls voor Gemini of Maps — elke health-check zou anders
  // quota verbruiken (dashboard polt elke 5 min). Voor beide controleren we
  // alleen of de key aanwezig is en plausibel lang (~39 chars).
  const geminiKeyOk = !!(GEMINI_KEY && GEMINI_KEY.length > 30);
  const mapsKeyOk   = !!(MAPS_KEY   && MAPS_KEY.length   > 30);
  const geminiCode  = geminiKeyOk ? 'KEY_OK' : 'NO_KEY';
  const mapsCode    = mapsKeyOk   ? 'KEY_OK' : 'NO_KEY';

  // Alleen Supabase blijft een echte network-check — gratis quota.
  let supabaseRes: { service: string; ok: boolean; code?: number | string; error?: string };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pharmacies?limit=1`, {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    supabaseRes = { service: 'supabase', ok: r.ok, code: r.status };
  } catch (err) {
    supabaseRes = { service: 'supabase', ok: false, error: String(err) };
  }

  const services = [
    { service: 'gemini',          ok: geminiKeyOk, code: geminiCode },
    { service: 'maps_geocoding',  ok: mapsKeyOk,   code: mapsCode   },
    { service: 'maps_directions', ok: mapsKeyOk,   code: mapsCode   },
    supabaseRes,
  ];

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
