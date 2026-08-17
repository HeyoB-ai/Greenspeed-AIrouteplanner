import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';

/** `reason` is bedoeld voor de serverlog, niet voor de client. */
export interface AuthResult { ok: boolean; statusCode?: number; body?: string; reason?: string; }

export async function verifyAuth(
  headers: Record<string, string | undefined>
): Promise<AuthResult> {
  const raw = headers.authorization ?? headers.Authorization;
  const token = raw?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { ok: false, statusCode: 401, reason: 'geen Authorization-header meegestuurd', body: JSON.stringify({
      error: { message: 'Niet geautoriseerd: login vereist', code: 'UNAUTHENTICATED' } }) };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, statusCode: 500, reason: 'VITE_SUPABASE_URL of VITE_SUPABASE_ANON_KEY ontbreekt op de server', body: JSON.stringify({
      error: { message: 'Auth niet geconfigureerd op server', code: 'AUTH_MISCONFIGURED' } }) };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, statusCode: 401, reason: `token afgewezen door Supabase: ${error?.message ?? 'geen user in respons'}`, body: JSON.stringify({
      error: { message: 'Ongeldige of verlopen sessie', code: 'UNAUTHENTICATED' } }) };
  }
  return { ok: true };
}
