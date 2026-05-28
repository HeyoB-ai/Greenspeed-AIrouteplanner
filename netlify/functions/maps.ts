import type { Handler } from '@netlify/functions';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  console.log('[Maps] Key beschikbaar:', !!GOOGLE_MAPS_API_KEY, 'Lengte:', GOOGLE_MAPS_API_KEY?.length ?? 0);
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('[Maps] GOOGLE_MAPS_API_KEY niet geconfigureerd');
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'ERROR',
        error_message: 'GOOGLE_MAPS_API_KEY niet geconfigureerd op server',
      }),
    };
  }
  try {
    const body = JSON.parse(event.body || '{}');

    // Geocode actie: converteer adressen naar lat/lng
    if (body.action === 'geocode') {
      const { addresses } = body as { addresses: string[] };
      console.log('[Maps] Geocoderen van', addresses.length, 'adressen');
      const results = await Promise.all(
        addresses.map(async (addr: string) => {
          const url = `https://maps.googleapis.com/maps/api/geocode/json` +
            `?address=${encodeURIComponent(addr)}&key=${GOOGLE_MAPS_API_KEY}`;
          console.log('[Maps/Geocode] Adres:', addr);
          console.log('[Maps/Geocode] URL (key redacted):', url.replace(GOOGLE_MAPS_API_KEY ?? '', 'REDACTED'));
          const r = await fetch(url);
          const d = await r.json();
          console.log('[Maps/Geocode] Google response status:', d.status);
          console.log('[Maps/Geocode] Google response (200 chars):', JSON.stringify(d).substring(0, 200));
          if (d.error_message) {
            console.error('[Maps/Geocode] Google error_message:', d.error_message);
          }
          if (d.status === 'OK') return d.results[0].geometry.location as { lat: number; lng: number };
          console.warn('[Maps/Geocode] Geocode mislukt voor:', addr, d.status);
          return null;
        })
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      };
    }

    // Directions actie: route optimalisatie
    const { origin, destination, waypoints } = body;
    const params = new URLSearchParams({
      origin,
      destination,
      mode: 'bicycling',
      key: GOOGLE_MAPS_API_KEY,
    });
    if (waypoints) {
      params.set('waypoints', `optimize:true|${waypoints}`);
    }
    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    console.log('[Maps] Aanroep voor route optimalisatie (fiets)');
    const response = await fetch(url);
    const data = await response.json();
    console.log('[Maps] Status:', data.status);
    if (data.status !== 'OK') {
      console.error('[Maps] Google fout:', data.error_message);
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[Maps] Functie fout:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'ERROR',
        error_message: String(err),
      }),
    };
  }
};
