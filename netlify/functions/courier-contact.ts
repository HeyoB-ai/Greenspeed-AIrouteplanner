import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../lib/verifyAuth';
import { toE164 } from '../lib/phone';

const SUPABASE_URL     = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/**
 * Leest (GET) en schrijft (POST) het telefoonnummer van de INGELOGDE koerier in
 * courier_contacts. De planner stuurt op die tabel zijn dienst- en
 * declaratie-SMS'en; zonder rij valt een koerier daar zonder logregel uit.
 *
 * De courier_id komt uitsluitend uit het geverifieerde token. Stond hij in de
 * body, dan kon elke ingelogde koerier het nummer van een collega overschrijven
 * en diens SMS'en naar zijn eigen toestel omleiden.
 *
 * De schrijfactie loopt via de service-role: courier_contacts heeft bewust geen
 * RLS-schrijfpad voor gewone gebruikers.
 *
 * Bewust niet via raw_user_meta_data en handle_new_user(): die trigger woont in
 * de planner-repo en wordt daar smal gehouden. Twee repo's die aan één trigger
 * trekken is hoe je hem sloopt.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = await verifyAuth(event.headers as Record<string, string | undefined>);
  if (!auth.ok || !auth.userId) {
    return { statusCode: auth.statusCode ?? 401, headers: { 'Content-Type': 'application/json' }, body: auth.body ?? JSON.stringify({ error: 'Niet ingelogd' }) };
  }
  const courierId = auth.userId;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[courier-contact] service-role niet geconfigureerd op server');
    return json(500, { error: 'Server niet geconfigureerd' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // courier_contacts is per definitie een koerierstabel; andere rollen erin
  // laten lopen vervuilt de telling waarop de planner zijn signalering baseert.
  // LOWER() omdat er nog profielen met een hoofdletterrol bestaan.
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', courierId)
    .maybeSingle();

  if (((profile?.role as string) ?? '').toLowerCase() !== 'courier') {
    return json(403, { error: 'Alleen koeriers hebben een contactnummer in deze tabel' });
  }

  if (event.httpMethod === 'GET') {
    const { data, error } = await admin
      .from('courier_contacts')
      .select('phone_e164')
      .eq('courier_id', courierId)
      .maybeSingle();

    if (error) {
      console.error('[courier-contact] lezen mislukt:', error.message);
      return json(500, { error: 'Kon het telefoonnummer niet ophalen' });
    }
    const phone = (data?.phone_e164 as string | undefined) ?? null;
    return json(200, { hasPhone: !!phone, phone });
  }

  let rawPhone: string;
  let note: string | undefined;
  try {
    const parsed = JSON.parse(event.body || '{}');
    rawPhone = (parsed.phone ?? '').toString();
    note     = typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : undefined;
  } catch {
    return json(400, { error: 'Ongeldige body' });
  }

  // Ook al liet het scherm de genormaliseerde vorm al zien: de server normaliseert
  // opnieuw. Wat de client meestuurt is invoer, geen waarheid.
  const normalized = toE164(rawPhone);
  if (!normalized.ok) {
    return json(400, { error: normalized.reason });
  }

  // Eén rij per koerier, dus upsert op de primary key. updated_at expliciet: de
  // kolomdefault vuurt alleen bij de INSERT-helft en zou bij een wijziging de
  // oude datum laten staan.
  const { error } = await admin
    .from('courier_contacts')
    .upsert({
      courier_id: courierId,
      phone_e164: normalized.e164,
      updated_at: new Date().toISOString(),
      updated_by: courierId,
      ...(note !== undefined ? { note } : {}),
    }, { onConflict: 'courier_id' });

  if (error) {
    console.error('[courier-contact] opslaan mislukt:', error.message);
    return json(500, { error: 'Kon het telefoonnummer niet opslaan' });
  }

  console.log('[courier-contact] nummer vastgelegd', { courierId });
  return json(200, { success: true, phone: normalized.e164 });
};
