import type { Handler } from '@netlify/functions';
import { verifyPrivileged } from '../lib/verifyPrivileged';

// Gebruikers opzoeken mét e-mailadres, via de service-role client.
//
// Waarom een function en niet rechtstreeks uit de browser: e-mailadressen staan
// in auth.users en dat schema is client-side niet leesbaar — user_profiles heeft
// geen e-mailkolom. Voor het regiobeheer is het adres juist de aanknoping (je
// zoekt een collega op zijn mailadres, niet op zijn profiel-id).
//
//   GET ?role=region_manager   → alle profielen met die rol, met e-mail
//   GET ?email=<adres>         → één gebruiker (exacte match, case-insensitive)
//
// Alleen toegankelijk voor superuser/supervisor/admin met een echte sessie.

const PAGE_SIZE = 1000;

// auth.admin.listUsers is gepagineerd. Eén pagina van 1000 dekt deze organisatie
// ruim, maar doorlopen is drie regels en voorkomt dat gebruiker 1001 stil
// wegvalt uit het overzicht.
async function emailById(admin: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) if (u.id && u.email) map.set(u.id, u.email);
    if (users.length < PAGE_SIZE) break;
  }
  return map;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const auth = await verifyPrivileged(event.headers as Record<string, string | undefined>);
  if (!auth.ok) {
    return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
  }
  const admin = auth.admin!;

  const qp = event.queryStringParameters ?? {};
  const role = (qp.role ?? '').trim();
  const email = (qp.email ?? '').trim().toLowerCase();

  if (!role && !email) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Geef role of email mee.' }),
    };
  }

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

  // ── Zoeken op e-mailadres ───────────────────────────────────────────────
  if (email) {
    const hit = [...emails.entries()].find(([, addr]) => addr.toLowerCase() === email);
    if (!hit) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: null }) };
    }
    const [userId, addr] = hit;

    // Een account zonder profielrij bestaat: dan is er nog geen rol gezet.
    // De admin-client is niet getypeerd op ons schema, dus de rij komt als
    // `never` terug; vandaar de cast.
    const { data: profileRow } = await admin
      .from('user_profiles')
      .select('id, name, role')
      .eq('id', userId)
      .maybeSingle();
    const profile = (profileRow ?? null) as { name?: string | null; role?: string | null } | null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          id: userId,
          email: addr,
          name: (profile?.name as string) ?? null,
          role: (profile?.role as string) ?? null,
        },
      }),
    };
  }

  // ── Alle gebruikers met één rol ─────────────────────────────────────────
  const { data: profiles, error } = await admin
    .from('user_profiles')
    .select('id, name, role')
    .eq('role', role)
    .order('name');

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
