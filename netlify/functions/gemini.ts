import type { Handler } from '@netlify/functions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// In-memory circuit breaker: cap per warme container per uur.
// NB: Netlify spawned mogelijk meerdere containers parallel; dit is een zachte
// (per-instance) limiet, niet een harde globale limiet. Houdt 1 runaway-loop in toom.
const MAX_CALLS_PER_HOUR = 500;
let callsThisHour = 0;
let hourStart = Date.now();

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!GEMINI_API_KEY) {
    console.error('[gemini] GEMINI_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured on server' }) };
  }

  // Reset teller bij begin van nieuw uur
  if (Date.now() - hourStart > 3_600_000) {
    callsThisHour = 0;
    hourStart = Date.now();
  }
  callsThisHour++;

  if (callsThisHour > MAX_CALLS_PER_HOUR) {
    console.warn(`[gemini] Circuit breaker open: ${callsThisHour} calls in dit uur (limiet ${MAX_CALLS_PER_HOUR})`);
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          message: `Rate limit bereikt: ${MAX_CALLS_PER_HOUR} requests/uur. Probeer over een uur opnieuw.`,
          code: 'RATE_LIMIT_EXCEEDED',
        },
      }),
    };
  }

  console.log('[gemini] API key present:', !!GEMINI_API_KEY, '— calls dit uur:', callsThisHour);

  try {
    const body = JSON.parse(event.body || '{}');

    // Model uit de body halen; rest doorgeven aan Google
    const { model = 'gemini-2.5-flash', ...requestBody } = body;
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;

    console.log('[gemini] Calling Google model:', model);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log('[gemini] Google response status:', response.status);
    const responseText = await response.text();
    console.log('[gemini] Google response preview:', responseText.substring(0, 200));

    // Geef rate-limit en quota-fouten transparant door zodat de client kan retryen
    if (response.status === 429 || response.status === 503) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: responseText,
      };
    }

    if (!response.ok) {
      throw new Error(`Google API error ${response.status}: ${responseText.substring(0, 500)}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: responseText,
    };
  } catch (err) {
    console.error('[gemini] Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: String(err) } }),
    };
  }
};
