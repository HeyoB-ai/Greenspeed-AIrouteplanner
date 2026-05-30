import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const GEMINI_KEY   = process.env.GEMINI_API_KEY;
  const MAPS_KEY     = process.env.GOOGLE_MAPS_API_KEY;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  const checks = await Promise.allSettled([

    // Gemini — list models endpoint
    fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`)
      .then(r => ({ service: 'gemini', ok: r.ok, code: r.status })),

    // Google Maps Geocoding
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Amsterdam&key=${MAPS_KEY}`)
      .then(r => r.json())
      .then((d: any) => ({
        service: 'maps_geocoding',
        ok: d.status === 'OK' || d.status === 'ZERO_RESULTS',
        code: d.status,
        error: d.error_message ?? null,
      })),

    // Google Maps Directions
    fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=Amsterdam&destination=Utrecht&key=${MAPS_KEY}`)
      .then(r => r.json())
      .then((d: any) => ({
        service: 'maps_directions',
        ok: d.status === 'OK',
        code: d.status,
        error: d.error_message ?? null,
      })),

    // Supabase REST
    fetch(`${SUPABASE_URL}/rest/v1/pharmacies?limit=1`, {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }).then(r => ({ service: 'supabase', ok: r.ok, code: r.status })),

  ]);

  const names = ['gemini', 'maps_geocoding', 'maps_directions', 'supabase'];
  const services = checks.map((c, i) => {
    if (c.status === 'fulfilled') return c.value;
    return { service: names[i], ok: false, error: String(c.reason) };
  });

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
