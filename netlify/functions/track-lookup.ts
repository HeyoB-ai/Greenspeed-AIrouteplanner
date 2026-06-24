import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!SUPABASE_URL || !SERVICE_ROLE) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server niet geconfigureerd' }) };

  let postcode = '', huisnummer = '';
  try {
    const b = JSON.parse(event.body ?? '{}');
    postcode   = String(b.postcode   ?? b.postalCode  ?? '').trim();
    huisnummer = String(b.huisnummer ?? b.houseNumber ?? '').trim();
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ongeldige body' }) };
  }
  if (!postcode || !huisnummer) return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };

  const digits = postcode.replace(/\D/g, '').slice(0, 4);          // '1222'
  const normPc = postcode.replace(/\s/g, '').toUpperCase();        // '1222GB'
  const hn     = huisnummer.replace(/\s/g, '').toLowerCase();      // '75'

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Match grof op de 4 cijfers in SQL, daarna exact genormaliseerd in code
    // (vangt spaties, hoofdletters en kleine verschillen in opslag).
    const { data: rows, error } = await supabase
      .from('packages')
      .select('status, createdAt, deliveredAt, address, deliveryEvidence, pharmacyId, pharmacyName')
      .filter('address->>postalCode', 'ilike', `${digits}%`)
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };

    const match = (rows ?? []).find((r: any) => {
      const a = r.address ?? {};
      const storedPc = String(a.postalCode  ?? '').replace(/\s/g, '').toUpperCase();
      const storedHn = String(a.houseNumber ?? '').replace(/\s/g, '').toLowerCase();
      return storedPc === normPc && storedHn === hn;
    }) as any;

    if (!match) return { statusCode: 200, headers: CORS, body: JSON.stringify({ found: false }) };

    const a  = match.address ?? {};
    const ev = match.deliveryEvidence ?? {};
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        found: true,
        pkg: {
          status:       match.status,
          createdAt:    match.createdAt,
          deliveredAt:  match.deliveredAt,
          pharmacyId:   match.pharmacyId,
          pharmacyName: match.pharmacyName,
          address: { street: a.street, houseNumber: a.houseNumber, postalCode: a.postalCode, city: a.city },
          deliveryEvidence: { deliveryNote: ev.deliveryNote ?? null },
        },
      }),
    };
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Onverwachte fout' }) };
  }
};
