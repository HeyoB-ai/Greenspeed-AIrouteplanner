import type { Handler } from '@netlify/functions';
import { verifyAuth } from '../lib/verifyAuth';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const auth = await verifyAuth(event.headers as Record<string, string | undefined>);
  if (!auth.ok) {
    return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
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

    // Route-optimalisatie via Routes API (computeRoutes), genormaliseerde respons.
    const { origin, destination, intermediates } = body as {
      origin: string;
      destination: string;
      intermediates?: string[];
    };

    const routesBody = {
      origin:        { address: origin },
      destination:   { address: destination },
      intermediates: (intermediates ?? []).map((a: string) => ({ address: a })),
      travelMode:            'BICYCLE',
      optimizeWaypointOrder: true,
    };

    console.log('[Maps] Routes API computeRoutes (fiets),', routesBody.intermediates.length, 'waypoints');

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Goog-Api-Key':  GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': [
          'routes.optimizedIntermediateWaypointIndex',
          'routes.distanceMeters',
          'routes.duration',
          'routes.legs.startLocation',
          'routes.legs.endLocation',
        ].join(','),
      },
      body: JSON.stringify(routesBody),
    });

    const data = await response.json();

    if (!response.ok || !data.routes?.length) {
      console.error('[Maps] Routes API fout:', response.status, JSON.stringify(data).substring(0, 300));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ERROR',
          error_message: data.error?.message ?? `Routes API status ${response.status}`,
        }),
      };
    }

    const route = data.routes[0];
    const legs: any[] = route.legs ?? [];
    const coords = legs.length
      ? [legs[0].startLocation?.latLng, ...legs.map((l: any) => l.endLocation?.latLng)]
          .filter(Boolean)
          .map((p: any) => ({ lat: p.latitude, lng: p.longitude }))
      : [];

    console.log('[Maps] Routes OK:', route.distanceMeters, 'm,', route.duration);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status:          'OK',
        order:           route.optimizedIntermediateWaypointIndex ?? [],
        distanceMeters:  route.distanceMeters ?? 0,
        durationSeconds: parseInt(String(route.duration ?? '0'), 10),
        coords,
      }),
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
