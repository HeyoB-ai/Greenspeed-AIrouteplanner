// E-mailadressen per gebruiker, uit auth.users.
//
// Eén plek, omdat twee functions het nodig hebben (users-lookup en
// users-overview) en omdat dit de enige code in dit project is die auth.users
// leest. Wijzigt Supabase dat schema, dan is er één bestand om aan te passen.
//
// Alleen bruikbaar met een service-role client: auth.admin is niet beschikbaar
// voor anon of authenticated.

const PAGE_SIZE = 1000;

/**
 * Map van user-id naar e-mailadres.
 *
 * listUsers is gepagineerd. Eén pagina van 1000 dekt deze organisatie ruim,
 * maar doorlopen is drie regels en voorkomt dat gebruiker 1001 stil wegvalt.
 */
export async function emailById(admin: any): Promise<Map<string, string>> {
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
