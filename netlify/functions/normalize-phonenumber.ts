import type { Handler } from '@netlify/functions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function vapiResponse(toolCallId: string | null, result: string) {
  if (toolCallId) {
    return JSON.stringify({ results: [{ toolCallId, result }] });
  }
  return JSON.stringify({ result });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Method not allowed' }) };
  }

  let nummer: string;
  let toolCallId: string | null = null;

  try {
    const body = JSON.parse(event.body ?? '{}');
    const toolCall = body?.message?.toolCalls?.[0]
                  ?? body?.message?.toolCallList?.[0];
    toolCallId = toolCall?.id ?? null;

    const vapiArgs = toolCall?.function?.arguments;
    const args = vapiArgs ?? body;
    nummer = (args.nummer ?? '').toString();
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Ongeldige invoer' }) };
  }

  const normalized = nummer.replace(/[\s\-().+]/g, '');
  console.log('[normalize-phonenumber]', { input: nummer, output: normalized, toolCallId });

  const body = vapiResponse(toolCallId, normalized);
  return { statusCode: 200, headers: CORS_HEADERS, body };
};
