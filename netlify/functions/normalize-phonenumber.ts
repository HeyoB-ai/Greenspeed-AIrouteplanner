import type { Handler } from '@netlify/functions';
import { toE164 } from '../lib/phone';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function vapiResponse(toolCallId: string | null, result: string) {
  if (toolCallId) {
    return { results: [{ toolCallId, result }] };
  }
  return { result };
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

  // `result` blijft letterlijk wat het was: de kale cijfers. De Vapi-assistent
  // die dit leest is buiten deze repo geconfigureerd, dus wat er ná het antwoord
  // met die string gebeurt is hiervandaan niet te overzien — dan maar niets
  // veranderen aan wat hij krijgt.
  const kaal = nummer.replace(/[\s\-().+]/g, '');

  // De velden ernaast zijn voor de app: die heeft E.164 nodig (de CHECK op
  // courier_contacts) en moet "klaar" van "afgekeurd" kunnen onderscheiden
  // zonder de tekst te hoeven interpreteren.
  const normalized = toE164(nummer);
  console.log('[normalize-phonenumber]', {
    input: nummer, result: kaal, toolCallId,
    ...(normalized.ok ? { e164: normalized.e164 } : { afgekeurd: normalized.reason }),
  });

  const payload = {
    ...vapiResponse(toolCallId, kaal),
    ...(normalized.ok ? { ok: true, e164: normalized.e164 } : { ok: false, reason: normalized.reason }),
  };

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(payload) };
};
