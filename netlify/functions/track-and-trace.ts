import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

const DELIVERED_STATUSES = ['BEZORGD', 'BRIEVENBUS', 'BIJ BUREN', 'ANDERE LOCATIE'];
const DELAYED_STATUSES   = ['RETOUR APOTHEEK', 'MISLUKT', 'VERHUISD', 'FAILED', 'RETURN'];

const DAYS    = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const MONTHS  = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const NUMBERS = ['nul','één','twee','drie','vier','vijf','zes','zeven','acht','negen','tien',
                 'elf','twaalf','dertien','veertien','kwartier','zestien','zeventien','achttien','negentien','twintig',
                 'eenentwintig','tweeëntwintig','drieëntwintig','vierentwintig'];

function dutchDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function dutchTime(iso: string): string {
  const d   = new Date(iso);
  const h   = d.getHours();
  const min = d.getMinutes();

  let timeStr: string;
  if (min === 0) {
    timeStr = `${NUMBERS[h] ?? h} uur`;
  } else if (min === 30) {
    timeStr = `half ${NUMBERS[h + 1] ?? (h + 1)}`;
  } else if (min === 15) {
    timeStr = `kwart over ${NUMBERS[h] ?? h}`;
  } else if (min === 45) {
    timeStr = `kwart voor ${NUMBERS[h + 1] ?? (h + 1)}`;
  } else {
    timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  let suffix: string;
  if (h >= 6  && h < 12) suffix = "'s ochtends";
  else if (h >= 12 && h < 18) suffix = "'s middags";
  else if (h >= 18)            suffix = "'s avonds";
  else                         suffix = "'s nachts";

  return `${timeStr} ${suffix}`;
}

function buildResultString(data: any): string {
  const status = (data.status ?? '').toUpperCase();
  const evidence = data.deliveryEvidence ?? {};

  // Bepaal afleverlocatie uit deliveryEvidence
  let locatie = '';
  if (data.status === 'BRIEVENBUS') {
    locatie = ' in de brievenbus';
  } else if (data.status === 'BIJ BUREN') {
    locatie = evidence.deliveryNote ? ` bij de buren (${evidence.deliveryNote})` : ' bij de buren';
  } else if (data.status === 'ANDERE LOCATIE' && evidence.deliveryNote) {
    locatie = ` op een andere locatie: ${evidence.deliveryNote}`;
  } else if (evidence.notHomeOption) {
    locatie = `: ${evidence.notHomeOption}`;
  } else if (evidence.deliveryNote) {
    locatie = ` — opmerking: ${evidence.deliveryNote}`;
  }

  if (DELIVERED_STATUSES.some(d => status.includes(d))) {
    if (data.deliveredAt) {
      return `De zending is bezorgd op ${dutchDate(data.deliveredAt)} om ${dutchTime(data.deliveredAt)}${locatie}.`;
    }
    return `De zending is bezorgd${locatie}.`;
  }

  if (DELAYED_STATUSES.some(d => status.includes(d))) {
    return 'De zending heeft helaas vertraging opgelopen. Een collega neemt contact met u op.';
  }

  // Onderweg
  const datum = data.createdAt ? dutchDate(data.createdAt) : 'onbekende datum';
  return `De zending is onderweg en wordt verwacht op ${datum}.`;
}

function vapiResponse(toolCallId: string | null, result: string) {
  if (toolCallId) {
    return JSON.stringify({ results: [{ toolCallId, result }] });
  }
  return JSON.stringify({ result });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

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
        .select('id, status, createdAt, deliveredAt, deliveryEvidence')
        .filter('address->>postalCode', 'ilike', variant)
        .filter('address->>houseNumber', 'ilike', huisnummer)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row) console.log('VOLLEDIGE ROW:', JSON.stringify(row));
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

    const result = buildResultString(data);
    const body = vapiResponse(toolCallId, result);
    console.log('[track-and-trace] RESPONSE NAAR VAPI:', body);

    return { statusCode: 200, headers: CORS_HEADERS, body };

  } catch (err) {
    console.error('[track-and-trace] Onverwachte fout:', err);
    const body = vapiResponse(toolCallId, 'Er is een technische fout opgetreden.');
    return { statusCode: 500, headers: CORS_HEADERS, body };
  }
};
