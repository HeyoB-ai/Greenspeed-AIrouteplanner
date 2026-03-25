import type { Handler } from '@netlify/functions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!GEMINI_API_KEY) {
    console.error('[gemini] GEMINI_API_KEY is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured on server' }) };
  }

  console.log('[gemini] API key present:', !!GEMINI_API_KEY);

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
