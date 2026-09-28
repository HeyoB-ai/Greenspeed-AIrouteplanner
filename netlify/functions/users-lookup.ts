import type { Handler } from '@netlify/functions';
import { verifyPrivileged } from '../lib/verifyPrivileged';
import { emailById } from '../lib/emails';

// Gebruikers opzoeken mét e-mailadres, via de service-role client.
//
// Waarom een function en niet rechtstreeks uit de browser: e-mailadressen staan
// in auth.users en dat schema is client-side niet leesbaar — user_profiles heeft
// geen e-mailkolom.
//
//   GET                        → alle profielen, met e-mail
//   GET ?role=region_manager   → alleen die rol, met e-mail
//
// Alleen toegankelijk voor superuser/supervisor/admin met een echte sessie.
//
// Er zat eerder een ?email=-tak in om één gebruiker op adres te zoeken. Die is
// weg: een beheerder kent dat adres meestal niet, dus de lijst is het
// uitgangspunt geworden en zoeken op adres had geen aanroeper meer.

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const auth = await verifyPrivileged(event.headers as Record<string, string | undefined>);
  if (!auth.ok) {
    return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
  }
  const admin = auth.admin!;

  const role = (event.queryStringParameters?.role ?? '').trim();

  let emails: Map<string, string>;
  try {
    emails = await emailById(admin);
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e instanceof Error ? e.message : 'Adressen ophalen mislukt.' }),
    };
  }

  let query = admin.from('user_profiles').select('id, name, role').order('name');
  if (role) query = query.eq('role', role);

  const { data: profiles, error } = await query;
  if (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }

  const users = (profiles ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    email: emails.get(p.id) ?? null,
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users }),
  };
};
