import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

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
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'Method not allowed' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[track-and-trace] Supabase niet geconfigureerd');
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'Technische fout' }) };
  }

  let postcode: string;
  let huisnummer: string;

  try {
    const body = JSON.parse(event.body ?? '{}');
    postcode   = (body.postcode   ?? '').replace(/\s/g, '').toUpperCase();
    huisnummer = (body.huisnummer ?? '').trim();
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'Ongeldige JSON body' }) };
  }

  if (!postcode || !huisnummer) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'postcode en huisnummer zijn verplicht' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from('packages')
      .select('id, status, createdAt, deliveredAt')
      .filter('address->>postalCode', 'eq', postcode)
      .filter('address->>houseNumber', 'eq', huisnummer)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[track-and-trace] Supabase fout:', error.message);
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'Technische fout' }) };
    }

    if (!data) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ found: false, message: 'Geen zending gevonden' }),
      };
    }

    const verwachte_leverdatum = data.deliveredAt
      ? data.deliveredAt.split('T')[0]
      : data.createdAt
        ? data.createdAt.split('T')[0]
        : null;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        found: true,
        status: data.status ?? 'onbekend',
        verwachte_leverdatum,
        tracking_code: data.id,
        laatst_bijgewerkt: data.deliveredAt ?? data.createdAt ?? null,
      }),
    };

  } catch (err) {
    console.error('[track-and-trace] Onverwachte fout:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: true, message: 'Technische fout' }) };
  }
};
