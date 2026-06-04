import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL       = process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PRIVILEGED_ROLES   = ['superuser', 'supervisor', 'admin'];

type AdminClient = ReturnType<typeof createClient>;

export interface PrivilegedResult {
  ok: boolean;
  statusCode?: number;
  body?: string;
  admin?: AdminClient;
  userId?: string;
}

const fail = (statusCode: number, error: string): PrivilegedResult => ({
  ok: false, statusCode, body: JSON.stringify({ error }),
});

/**
 * Valideert het Bearer-token van de aanroeper met de service-role client en
 * controleert dat de gebruiker een privileged rol heeft. Bij succes geeft het
 * de admin-client terug (omzeilt RLS) zodat de function de data kan lezen/schrijven.
 *
 * LET OP: dit vereist een ECHTE Supabase-sessie. Een demo-account (localStorage,
 * geen JWT) heeft geen token en krijgt 401.
 */
export async function verifyPrivileged(
  headers: Record<string, string | undefined>,
): Promise<PrivilegedResult> {
  const raw = headers.authorization ?? headers.Authorization;
  const token = raw?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return fail(401, 'Niet ingelogd');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return fail(500, 'Service-role niet geconfigureerd op server');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return fail(401, 'Ongeldige sessie');

  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!PRIVILEGED_ROLES.includes((profile?.role as string) ?? '')) {
    return fail(403, 'Geen toegang');
  }

  return { ok: true, admin, userId: user.id };
}
