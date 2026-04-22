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

  try {
    const body = JSON.parse(event.body ?? '{}');

    // Vapi stuurt parameters genest in message.toolCalls[0].function.arguments
    const vapiArgs = body?.message?.toolCalls?.[0]?.function?.arguments
                  ?? body?.message?.toolCallList?.[0]?.function?.arguments;
    const args = vapiArgs ?? body;

    postcode   = (args.postcode   ?? '').trim();
    huisnummer = (args.huisnummer ?? '').trim();
    console.log('[track-and-trace] INPUT:', { postcode, huisnummer });
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Er is een technische fout opgetreden.' }) };
  }

  if (!postcode || !huisnummer) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Er is een technische fout opgetreden.' }) };
  }

  const variants = postcodeVariants(postcode);
  console.log('[track-and-trace] Zoeken op:', { postcode, huisnummer, variants });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('INPUT postcode:', postcode);
    console.log('INPUT huisnummer:', huisnummer);

    // Haal eerste 5 rijen op om structuur te zien
    const { data: sample, error: sampleError } = await supabase
      .from('packages')
      .select('*')
      .limit(5);
    console.log('TABEL STRUCTUUR:', JSON.stringify(sample, null, 2));
    console.log('SAMPLE ERROR:', sampleError);

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
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Er is een technische fout opgetreden.' }) };
    }

    if (!data) {
      console.log('[track-and-trace] Geen resultaat gevonden voor alle varianten');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ result: 'Geen zending gevonden op dit adres.' }),
      };
    }

    const verwachte_leverdatum = data.deliveredAt
      ? data.deliveredAt.split('T')[0]
      : data.createdAt
        ? data.createdAt.split('T')[0]
        : null;

    const result = toResultString(data.status, verwachte_leverdatum);
    console.log('[track-and-trace] Resultaat:', { status: data.status, verwachte_leverdatum, result });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ result }),
    };

  } catch (err) {
    console.error('[track-and-trace] Onverwachte fout:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ result: 'Er is een technische fout opgetreden.' }) };
  }
};
