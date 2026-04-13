import { AuthUser, AuthSession, UserRole } from '../types';
import { supabase } from './supabaseService';

// ── Rol-mapping: database (lowercase) ↔ TypeScript enum ──────────────
const DB_ROLE_MAP: Record<string, UserRole> = {
  superuser:  UserRole.SUPERUSER,
  supervisor: UserRole.SUPERVISOR,
  admin:      UserRole.ADMIN,
  pharmacy:   UserRole.PHARMACY,
  courier:    UserRole.COURIER,
};

const ROLE_TO_DB: Record<UserRole, string> = {
  [UserRole.SUPERUSER]:  'superuser',
  [UserRole.SUPERVISOR]: 'supervisor',
  [UserRole.ADMIN]:      'admin',
  [UserRole.PHARMACY]:   'pharmacy',
  [UserRole.COURIER]:    'courier',
  [UserRole.PATIENT]:    'pharmacy', // niet gebruikt voor auth
};

// ── Demo-accounts (actief als Supabase niet geconfigureerd is) ────────
const SESSION_KEY = 'greenspeed_session';

export const DEMO_USERS: (AuthUser & { email: string; passwordHash: string })[] = [
  {
    id: 'u1', name: 'Greenspeed HQ', role: UserRole.SUPERUSER,
    email: 'superuser@demo.greenspeed.nl', passwordHash: 'superuser123',
  },
  {
    id: 'u2', name: 'Beheerder Apotheek de Kroon', role: UserRole.ADMIN,
    pharmacyId: 'ph-1', pharmacyIds: ['ph-1'],
    email: 'admin@demo.greenspeed.nl', passwordHash: 'admin123',
  },
  {
    id: 'u6', name: 'Regio Beheerder', role: UserRole.ADMIN,
    pharmacyIds: ['ph-1', 'ph-2'],
    email: 'regio@demo.greenspeed.nl', passwordHash: 'regio123',
  },
  {
    id: 'u3', name: 'Assistente Apotheek de Kroon', role: UserRole.PHARMACY,
    pharmacyId: 'ph-1',
    email: 'apotheek@demo.greenspeed.nl', passwordHash: 'apotheek123',
  },
  {
    id: 'u4', name: 'Marco Koerier', role: UserRole.COURIER,
    pharmacyId: 'ph-1', courierId: 'k1',
    email: 'marco@demo.greenspeed.nl', passwordHash: 'koerier123',
  },
  {
    id: 'u5', name: 'Sanne Bezorgd', role: UserRole.COURIER,
    pharmacyId: 'ph-1', courierId: 'k2',
    email: 'sanne@demo.greenspeed.nl', passwordHash: 'koerier456',
  },
  {
    id: 'u7', name: 'Lisa Supervisor', role: UserRole.SUPERVISOR,
    email: 'supervisor@demo.greenspeed.nl', passwordHash: 'supervisor123',
  },
];

// ── Hulpfuncties ──────────────────────────────────────────────────────

function profileToAuthUser(userId: string, profile: Record<string, any>): AuthUser {
  const pharmacyIds: string[] = profile.pharmacy_ids ?? [];
  return {
    id:          userId,
    name:        profile.name,
    role:        DB_ROLE_MAP[profile.role] ?? UserRole.PHARMACY,
    pharmacyIds: pharmacyIds.length > 0 ? pharmacyIds : undefined,
    pharmacyId:  pharmacyIds[0],
    courierId:   profile.role === 'courier' ? userId : undefined,
  };
}

function saveLocalSession(user: AuthUser): void {
  const session: AuthSession = { user, loggedInAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ── Login ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser | null> {
  // Supabase Auth (als geconfigureerd)
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (!profileError && profile) {
        const user = profileToAuthUser(data.user.id, profile);
        saveLocalSession(user);
        return user;
      }
    }
    // Supabase is geconfigureerd maar login mislukt — nooit terugvallen op demo
    return null;
  }

  // Demo-fallback: alleen als Supabase NIET geconfigureerd is
  const demo = DEMO_USERS.find(u =>
    (u.email === email.toLowerCase() || u.name.toLowerCase() === email.toLowerCase()) &&
    u.passwordHash === password
  );
  if (demo) {
    const { passwordHash: _, email: __, ...user } = demo;
    saveLocalSession(user);
    return user;
  }

  return null;
}

// ── Uitloggen ─────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
  localStorage.removeItem(SESSION_KEY);
}

// ── Sessie ophalen ────────────────────────────────────────────────────

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

// ── Koerier registreren ───────────────────────────────────────────────

export async function registerCourier(
  name: string,
  email: string,
  password: string
): Promise<AuthUser | null> {
  if (!supabase) return null;

  // Geef naam en rol mee als metadata — trigger in de DB maakt user_profiles record aan
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role: 'courier' } },
  });
  if (error || !data.user) return null;

  const user: AuthUser = {
    id:        data.user.id,
    name,
    role:      UserRole.COURIER,
    courierId: data.user.id,
  };
  saveLocalSession(user);
  return user;
}

// ── Uitnodiging accepteren ────────────────────────────────────────────

export async function acceptInvitation(
  token: string,
  name: string,
  password: string
): Promise<AuthUser | null> {
  if (!supabase) return null;

  // Haal uitnodiging op
  const { data: invite, error: inviteError } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (inviteError || !invite) return null;

  const pharmacyIds = invite.pharmacy_id ? [invite.pharmacy_id] : [];

  // Geef naam, rol en apotheken mee als metadata — trigger maakt user_profiles aan
  const { data, error } = await supabase.auth.signUp({
    email:    invite.email,
    password,
    options:  { data: { name, role: invite.role, pharmacy_ids: pharmacyIds } },
  });
  if (error || !data.user) return null;

  // Markeer uitnodiging als geaccepteerd
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token);

  const user: AuthUser = {
    id:          data.user.id,
    name,
    role:        DB_ROLE_MAP[invite.role] ?? UserRole.PHARMACY,
    pharmacyIds: pharmacyIds.length > 0 ? pharmacyIds : undefined,
    pharmacyId:  pharmacyIds[0],
  };
  saveLocalSession(user);
  return user;
}

// ── Apotheekcode koppelen (koerier) ───────────────────────────────────

export async function linkPharmacyCode(code: string): Promise<{ pharmacyId: string } | null> {
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const normalized = code.trim().toUpperCase();

  // Zoek geldige code
  const { data: codeRow, error } = await supabase
    .from('pharmacy_codes')
    .select('*')
    .eq('code', normalized)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !codeRow) return null;

  const pharmacyId: string = codeRow.pharmacy_id;

  // Voeg koppeling toe
  await supabase.from('courier_pharmacy_access').upsert({
    courier_id:  session.user.id,
    pharmacy_id: pharmacyId,
  });

  // Update profiel pharmacy_ids
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('pharmacy_ids')
    .eq('id', session.user.id)
    .single();

  const existing: string[] = profile?.pharmacy_ids ?? [];
  if (!existing.includes(pharmacyId)) {
    await supabase
      .from('user_profiles')
      .update({ pharmacy_ids: [...existing, pharmacyId] })
      .eq('id', session.user.id);

    // Update lokale sessie
    const localSession = getSession();
    if (localSession) {
      const updatedPharmacyIds = [...(localSession.user.pharmacyIds ?? []), pharmacyId];
      const updatedUser: AuthUser = {
        ...localSession.user,
        pharmacyIds: updatedPharmacyIds,
        pharmacyId:  updatedPharmacyIds[0],
      };
      saveLocalSession(updatedUser);
    }
  }

  return { pharmacyId };
}

// ── Apotheekcode genereren (apotheker/supervisor) ─────────────────────

export async function generatePharmacyCode(pharmacyId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Genereer code: 2 letters + koppelteken + 4 cijfers, bijv. "KR-4821"
  const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                  String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digits  = String(Math.floor(1000 + Math.random() * 9000));
  const code    = `${letters}-${digits}`;

  const { error } = await supabase.from('pharmacy_codes').insert({
    pharmacy_id: pharmacyId,
    code,
    created_by:  session.user.id,
  });

  return error ? null : code;
}

// ── Gebruiker uitnodigen (apotheker/supervisor) ───────────────────────

export async function inviteUser(
  email: string,
  role: string,
  pharmacyId: string
): Promise<void> {
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // Sla uitnodiging op in database
  const { data: invite } = await supabase
    .from('invitations')
    .insert({
      email,
      role,
      pharmacy_id: pharmacyId,
      invited_by:  session.user.id,
    })
    .select('token')
    .single();

  if (!invite) return;

  // Stuur uitnodigingsmail via Netlify function
  await fetch('/.netlify/functions/send-invitation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      role,
      pharmacyId,
      token: invite.token,
    }),
  }).catch(() => {}); // fout in mail-verzending blokkeert niet
}

// ── Apotheken van ingelogde koerier ophalen ───────────────────────────

export async function getCourierPharmacies(): Promise<string[]> {
  if (!supabase) return [];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data } = await supabase
    .from('courier_pharmacy_access')
    .select('pharmacy_id')
    .eq('courier_id', session.user.id);

  return data?.map((r: any) => r.pharmacy_id) ?? [];
}

// ── Legacy: saveSession (backwards compat voor App.tsx) ───────────────
export { saveLocalSession as saveSession };
