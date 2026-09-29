import { supabase, getAuthHeaders } from './supabaseService';

const CONTACT_ENDPOINT   = '/.netlify/functions/courier-contact';
const NORMALIZE_ENDPOINT = '/.netlify/functions/normalize-phonenumber';

/** Nummer dat bij registratie is ingevuld maar nog niet weggeschreven kon worden. */
const PENDING_PHONE_KEY = 'gs_pending_phone';

export type NormalizeResult =
  | { ok: true;  e164: string }
  | { ok: false; reason: string };

/**
 * Laat de server het ingetypte nummer omzetten naar E.164. Bewust geen lokale
 * kopie van die regels: het scherm moet exact tonen wat de database straks
 * krijgt, anders is de bevestiging aan de koerier niets waard.
 */
export async function normalizePhone(input: string): Promise<NormalizeResult> {
  try {
    const res = await fetch(NORMALIZE_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nummer: input }),
    });
    const data = await res.json();
    if (data?.ok && typeof data.e164 === 'string') return { ok: true, e164: data.e164 };
    return { ok: false, reason: data?.reason ?? 'Dit nummer kon niet gecontroleerd worden.' };
  } catch (err) {
    console.error('[courierContact] controleren mislukt:', err);
    return { ok: false, reason: 'Controleren mislukt door een verbindingsfout. Probeer het opnieuw.' };
  }
}

export type PhoneStatus =
  | { known: true;  hasPhone: boolean; phone: string | null }
  | { known: false };

/**
 * Vraagt of de ingelogde koerier al een rij in courier_contacts heeft.
 *
 * `known: false` betekent "geen antwoord gekregen", niet "geen nummer" — zonder
 * echte Supabase-sessie (demo-account) of bij een netwerkfout. De aanroeper moet
 * dat verschil zien, want op deze uitkomst hangt of iemand de app in mag.
 */
export async function getMyPhoneStatus(): Promise<PhoneStatus> {
  if (!supabase) return { known: false };
  try {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return { known: false };

    const res = await fetch(CONTACT_ENDPOINT, { method: 'GET', headers });
    if (!res.ok) {
      console.warn('[courierContact] status opvragen gaf', res.status);
      return { known: false };
    }
    const data = await res.json();
    return { known: true, hasPhone: data?.hasPhone === true, phone: data?.phone ?? null };
  } catch (err) {
    console.error('[courierContact] status opvragen mislukt:', err);
    return { known: false };
  }
}

export type SavePhoneResult = { ok: true; phone: string } | { ok: false; reason: string };

/** Legt het nummer vast bij de ingelogde koerier. De server bepaalt om wie het gaat. */
export async function saveMyPhone(input: string): Promise<SavePhoneResult> {
  if (!supabase) return { ok: false, reason: 'Geen verbinding met de database.' };
  try {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      return { ok: false, reason: 'Je bent niet (meer) ingelogd. Log opnieuw in en probeer het nogmaals.' };
    }

    const res = await fetch(CONTACT_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body:    JSON.stringify({ phone: input }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data?.error ?? 'Opslaan mislukt. Probeer het opnieuw.' };
    return { ok: true, phone: data?.phone ?? input };
  } catch (err) {
    console.error('[courierContact] opslaan mislukt:', err);
    return { ok: false, reason: 'Opslaan mislukt door een verbindingsfout. Probeer het opnieuw.' };
  }
}

// ── Nummer dat bij registratie nog niet opgeslagen kon worden ──────────
//
// Wie zijn account moet bevestigen via e-mail heeft bij het registreren nog
// geen JWT, en zonder JWT kan de functie het nummer aan niemand hangen. Het
// wordt dan lokaal bewaard zodat het slot na de eerste login het veld alvast
// invult in plaats van het opnieuw te vragen.

export function stashPendingPhone(phone: string): void {
  try { localStorage.setItem(PENDING_PHONE_KEY, phone); } catch {}
}

export function readPendingPhone(): string {
  try { return localStorage.getItem(PENDING_PHONE_KEY) ?? ''; } catch { return ''; }
}

export function clearPendingPhone(): void {
  try { localStorage.removeItem(PENDING_PHONE_KEY); } catch {}
}
