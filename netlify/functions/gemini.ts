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

  try {
    const body = JSON.parse(event.body || '{}');

    // Model uit de body halen; rest doorgeven aan Google
    const { model = 'gemini-2.5-flash', ...requestBody } = body;
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[gemini] Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Function error', detail: String(err) }),
    };
  }
};
