import type { Handler } from '@netlify/functions';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
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
    const { origin, destination, waypoints } = JSON.parse(event.body || '{}');
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
