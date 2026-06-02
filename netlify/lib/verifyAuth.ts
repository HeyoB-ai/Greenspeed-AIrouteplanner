import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

export interface AuthResult { ok: boolean; statusCode?: number; body?: string; }

export async function verifyAuth(
  headers: Record<string, string | undefined>
): Promise<AuthResult> {
  const raw = headers.authorization ?? headers.Authorization;
  const token = raw?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, statusCode: 401, body: JSON.stringify({
      error: { message: 'Niet geautoriseerd: login vereist', code: 'UNAUTHENTICATED' } }) };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, statusCode: 500, body: JSON.stringify({
      error: { message: 'Auth niet geconfigureerd op server', code: 'AUTH_MISCONFIGURED' } }) };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, statusCode: 401, body: JSON.stringify({
      error: { message: 'Ongeldige of verlopen sessie', code: 'UNAUTHENTICATED' } }) };
  }
  return { ok: true };
}
