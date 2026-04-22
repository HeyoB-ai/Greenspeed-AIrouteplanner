import type { Handler } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Method not allowed' }) };
  }

  let nummer: string;

  try {
    const body = JSON.parse(event.body ?? '{}');
    const vapiArgs = body?.message?.toolCalls?.[0]?.function?.arguments
                  ?? body?.message?.toolCallList?.[0]?.function?.arguments;
    const args = vapiArgs ?? body;
    nummer = (args.nummer ?? '').toString();
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Ongeldige invoer' }) };
  }

  const normalized = nummer.replace(/[\s\-().+]/g, '');
  console.log('[normalize-phonenumber]', { input: nummer, output: normalized });

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ result: normalized }),
  };
};
