import { supabase, getAuthHeaders } from './supabaseService';

// ══════════════════════════════════════════════════════════════════════════
// PLANNER-ROL: deze service is alleen voor de hoofdapp. De planner-rol krijgt
// zijn eigen service in de greenspeedplanner-repo.
// ══════════════════════════════════════════════════════════════════════════

// ── Regiomanagers en hun apotheken ────────────────────────────────────────
// Twee bronnen, en dat is geen toeval:
//
//   * user_pharmacy_access en user_profiles gaan rechtstreeks via Supabase. De
//     RLS uit migratie 014 bepaalt wie mag koppelen, dus de regels staan in de
//     database en niet in deze module.
//   * E-mailadressen komen uit /.netlify/functions/users-lookup. Ze staan in
//     auth.users en dat is client-side niet leesbaar; user_profiles heeft geen
//     e-mailkolom.
//
// Alles hier vereist een ECHTE Supabase-sessie. Een demo-account (localStorage,
// geen JWT) krijgt 401 van de function en leest niets uit de tabellen.

export interface ProfileWithEmail {
  id: string;
  name: string | null;
  role: string | null;
  email: string | null;
  /** Toegang tot de planner-app, los van de rol (migratie 016). */
  isPlanner: boolean;
}

// De function levert de database-schrijfwijze; hier één keer omzetten in plaats
// van in elke component.
function toProfile(r: any): ProfileWithEmail {
  return {
    id:        r.id,
    name:      r.name ?? null,
    role:      r.role ?? null,
    email:     r.email ?? null,
    isPlanner: r.is_planner === true,
  };
}

export interface MyPharmacy {
  id: string;
  name: string;
  /** Samengesteld weergave-adres; null als er niets is ingevuld. */
  address: string | null;
}

/**
 * Losse velden naar één regel. De oudere apotheken hebben alleen `address`
 * gevuld (alles in één regel), de nieuwere de losse velden — dus beide vormen
 * moeten eruit komen, met de losse velden als voorkeur want die zijn recenter.
 */
function formatAddress(p: {
  address?: string | null; street?: string | null; houseNumber?: string | null;
  postalCode?: string | null; city?: string | null;
}): string | null {
  const straat = [p.street, p.houseNumber].filter(Boolean).join(' ').trim();
  const plaats = [p.postalCode, p.city].filter(Boolean).join(' ').trim();
  const samen = [straat, plaats].filter(Boolean).join(', ');
  if (samen) return samen;
  return p.address?.trim() || null;
}

export interface PharmacyAccessRow {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  createdAt: string | null;
}

/** Alle rollen die in user_profiles.role mogen staan (migratie 014 en 015). */
export const DB_ROLES = [
  'superuser',
  'supervisor',
  'admin',
  'pharmacy',
  'courier',
  'region_manager',
  'planner',
] as const;

export const ROLE_LABELS: Record<string, string> = {
  superuser:      'Superuser',
  supervisor:     'Supervisor',
  admin:          'Admin',
  pharmacy:       'Apotheek',
  courier:        'Koerier',
  region_manager: 'Regiomanager',
  planner:        'Planner (planner.go-bob.nl)',
};

/**
 * Profielen met een bepaalde rol, inclusief e-mailadres.
 * `role` is de database-schrijfwijze: 'region_manager', niet 'REGIOMANAGER'.
 */
export async function getUsersWithRole(role: string): Promise<ProfileWithEmail[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/.netlify/functions/users-lookup?role=${encodeURIComponent(role)}`, { headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? 'Gebruikers ophalen mislukt.');
  return ((body?.users ?? []) as any[]).map(toProfile);
}

/**
 * Alle profielen, met e-mailadres, op naam gesorteerd door de server.
 *
 * Dit vervangt het zoeken op e-mailadres: een beheerder kent het adres van een
 * collega meestal niet, en een lijst van deze omvang is zo overzichtelijk dat
 * zoeken niets toevoegde.
 */
export async function getAllUsers(): Promise<ProfileWithEmail[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/.netlify/functions/users-lookup', { headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? 'Gebruikers ophalen mislukt.');
  return ((body?.users ?? []) as any[]).map(toProfile);
}

/**
 * De apotheken die aan deze gebruiker gekoppeld zijn, met naam.
 * De naam komt uit de join op pharmacies; is een apotheek intussen onleesbaar
 * of verwijderd, dan valt de weergave terug op het id.
 */
export async function getPharmacyAccessForUser(userId: string): Promise<PharmacyAccessRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('user_pharmacy_access')
    .select('id, pharmacy_id, created_at, pharmacies(name)')
    .eq('user_id', userId);

  if (error) throw error;

  return (data ?? [])
    .map((r: any): PharmacyAccessRow => ({
      id: r.id,
      pharmacyId: r.pharmacy_id,
      pharmacyName: r.pharmacies?.name ?? r.pharmacy_id,
      createdAt: r.created_at ?? null,
    }))
    .sort((a, b) => a.pharmacyName.localeCompare(b.pharmacyName, 'nl'));
}

/**
 * De apotheken van de ingelogde gebruiker zelf, voor het regiomanager-overzicht.
 *
 * Geen user_id-filter nodig: de RLS uit migratie 014 laat een niet-privileged
 * gebruiker alleen zijn eigen rijen zien. Voor een superuser zou deze query
 * daarentegen álles teruggeven, dus hij is bedoeld voor de regiomanager-view en
 * niet als algemene "wat mag ik zien"-vraag.
 */
export async function getMyPharmacies(): Promise<MyPharmacy[]> {
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_pharmacy_access')
    .select('pharmacy_id, pharmacies(name, address, street, houseNumber, postalCode, city)')
    .eq('user_id', user.id);

  if (error) throw error;

  return (data ?? [])
    .map((r: any): MyPharmacy => {
      const p = r.pharmacies ?? {};
      return {
        id:      r.pharmacy_id,
        name:    p.name ?? r.pharmacy_id,
        address: formatAddress(p),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
}

/** Koppelt een apotheek aan een gebruiker. Bestaat de koppeling al, dan is dit een no-op. */
export async function grantPharmacyAccess(userId: string, pharmacyId: string): Promise<void> {
  if (!supabase) throw new Error('Geen verbinding met de database.');

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('user_pharmacy_access')
    .insert({ user_id: userId, pharmacy_id: pharmacyId, created_by: user?.id ?? null });

  // 23505 = unique violation: de koppeling stond er al. Dat is geen fout voor de
  // beheerder — de gewenste eindtoestand is bereikt.
  if (error && (error as any).code !== '23505') throw error;
}

/** Verbreekt de koppeling. Bestond hij niet, dan verwijdert dit niets en is dat goed. */
export async function revokePharmacyAccess(userId: string, pharmacyId: string): Promise<void> {
  if (!supabase) throw new Error('Geen verbinding met de database.');

  const { error } = await supabase
    .from('user_pharmacy_access')
    .delete()
    .eq('user_id', userId)
    .eq('pharmacy_id', pharmacyId);

  if (error) throw error;
}

/**
 * Eén schrijfweg voor rol en planner-vlag: de Netlify-function
 * admin-update-user, die met de service-role key werkt.
 *
 * Waarom niet rechtstreeks vanuit de browser: een UPDATE op user_profiles die
 * door RLS wordt weggefilterd raakt nul rijen en geeft GEEN error terug — de
 * schrijfactie leek dan te slagen terwijl er niets gebeurde. De function
 * controleert zelf of de aanroeper privileged is en schrijft daarna buiten RLS
 * om, zodat een mislukking altijd een status en een melding oplevert.
 */
async function adminUpdateUser(
  payload: { userId: string; role?: string; isPlanner?: boolean },
): Promise<void> {
  if (!supabase) throw new Error('Geen verbinding met de database.');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  console.log('[admin-update-user] sessie:', token ? 'aanwezig' : 'ontbreekt', payload);

  if (!token) {
    throw new Error(
      'Je bent niet met een Supabase-account ingelogd, dus deze wijziging kan niet worden '
      + 'opgeslagen. Log opnieuw in met je e-mailadres en wachtwoord.',
    );
  }

  const res = await fetch('/.netlify/functions/admin-update-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);
  console.log('[admin-update-user] respons:', res.status, body);

  if (res.status !== 200) {
    throw new Error(body?.error ?? `Opslaan mislukt (status ${res.status}).`);
  }
}

/**
 * Zet de rol van een gebruiker. `role` is de database-schrijfwijze; een waarde
 * buiten DB_ROLES wordt door de CHECK-constraint geweigerd, dus we vangen hem
 * hier al af met een leesbare melding.
 */
export async function setUserRole(userId: string, role: string): Promise<void> {
  if (!(DB_ROLES as readonly string[]).includes(role)) {
    throw new Error(`Onbekende rol: ${role}`);
  }
  await adminUpdateUser({ userId, role });
}

/**
 * Zet de planner-toegang los van de rol (migratie 016).
 *
 * Let op de trigger uit die migratie: wordt de rol in dezelfde handeling naar
 * of van 'planner' gezet, dan schrijft die trigger is_planner ook. Zet daarom
 * eerst de rol en dan deze vlag, zodat de expliciete keuze het laatste woord
 * heeft.
 */
export async function setIsPlanner(userId: string, value: boolean): Promise<void> {
  await adminUpdateUser({ userId, isPlanner: value });
}
