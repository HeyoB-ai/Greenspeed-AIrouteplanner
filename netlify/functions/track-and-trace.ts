import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

const DELIVERED_STATUSES = ['BEZORGD', 'BRIEVENBUS', 'BIJ BUREN', 'ANDERE LOCATIE'];
const DELAYED_STATUSES   = ['RETOUR APOTHEEK', 'MISLUKT', 'VERHUISD', 'FAILED', 'RETURN'];

function toResultString(status: string, verwachte_leverdatum: string | null): string {
  const s = (status ?? '').toUpperCase();
  if (DELIVERED_STATUSES.some(d => s.includes(d))) return 'De zending is bezorgd.';
  if (DELAYED_STATUSES.some(d => s.includes(d)))   return 'De zending heeft helaas vertraging.';
  const datum = verwachte_leverdatum ?? 'onbekende datum';
  return `De zending is onderweg en wordt verwacht op ${datum}.`;
}

function vapiResponse(toolCallId: string | null, result: string) {
  // Vapi server-tool webhook verwacht results array met toolCallId
  if (toolCallId) {
    return JSON.stringify({ results: [{ toolCallId, result }] });
  }
  // Fallback voor directe test-calls zonder Vapi wrapper
  return JSON.stringify({ result });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Postcode normalisaties: "3513GX" → ["3513GX", "3513 GX"]
function postcodeVariants(raw: string): string[] {
  const clean = raw.replace(/\s/g, '').toUpperCase();
  const withSpace = clean.length === 6 ? `${clean.slice(0, 4)} ${clean.slice(4)}` : clean;
  return Array.from(new Set([clean, withSpace]));
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'Method not allowed' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[track-and-trace] Supabase niet geconfigureerd');
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Er is een technische fout opgetreden.' }) };
  }

  let postcode: string;
  let huisnummer: string;
  let toolCallId: string | null = null;

  try {
    const body = JSON.parse(event.body ?? '{}');

    // Vapi stuurt parameters genest in message.toolCalls[0]
    const toolCall = body?.message?.toolCalls?.[0]
                  ?? body?.message?.toolCallList?.[0];
    toolCallId = toolCall?.id ?? null;

    const vapiArgs = toolCall?.function?.arguments;
    const args = vapiArgs ?? body;

    postcode   = (args.postcode   ?? '').trim();
    huisnummer = (args.huisnummer ?? '').trim();
    console.log('[track-and-trace] INPUT:', { postcode, huisnummer, toolCallId });
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Er is een technische fout opgetreden.' }) };
  }

  if (!postcode || !huisnummer) {
    return { statusCode: 400, headers: CORS_HEADERS, body: vapiResponse(toolCallId, 'Er is een technische fout opgetreden.') };
  }

  const variants = postcodeVariants(postcode);
  console.log('[track-and-trace] Zoeken op:', { variants, huisnummer });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let data: any = null;
    let queryError: any = null;

    for (const variant of variants) {
      const { data: row, error } = await supabase
        .from('packages')
        .select('id, status, createdAt, deliveredAt')
        .filter('address->>postalCode', 'ilike', variant)
        .filter('address->>houseNumber', 'ilike', huisnummer)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log(`[track-and-trace] Query variant "${variant}":`, { row, error });

      if (error) { queryError = error; break; }
      if (row)   { data = row; break; }
    }

    if (queryError) {
      console.error('[track-and-trace] Supabase fout:', queryError.message);
      const body = vapiResponse(toolCallId, 'Er is een technische fout opgetreden.');
      console.log('[track-and-trace] RESPONSE NAAR VAPI:', body);
      return { statusCode: 500, headers: CORS_HEADERS, body };
    }

    if (!data) {
      const body = vapiResponse(toolCallId, 'Geen zending gevonden op dit adres.');
      console.log('[track-and-trace] RESPONSE NAAR VAPI:', body);
      return { statusCode: 200, headers: CORS_HEADERS, body };
    }

    const verwachte_leverdatum = data.deliveredAt
      ? data.deliveredAt.split('T')[0]
      : data.createdAt
        ? data.createdAt.split('T')[0]
        : null;

    const result = toResultString(data.status, verwachte_leverdatum);
    const body = vapiResponse(toolCallId, result);
    console.log('[track-and-trace] RESPONSE NAAR VAPI:', body);

    return { statusCode: 200, headers: CORS_HEADERS, body };

  } catch (err) {
    console.error('[track-and-trace] Onverwachte fout:', err);
    const body = vapiResponse(toolCallId, 'Er is een technische fout opgetreden.');
    return { statusCode: 500, headers: CORS_HEADERS, body };
  }
};
