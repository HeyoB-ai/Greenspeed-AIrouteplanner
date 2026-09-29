/**
 * De enige plek waar een ingetypt of ingesproken nummer E.164 wordt.
 *
 * De CHECK op courier_contacts.phone_e164 is onverbiddelijk, dus elke schrijver
 * moet exact dezelfde vorm produceren. Vandaar dat zowel de Vapi-tool als de
 * courier-contact-functie hier doorheen gaan: twee regexen die uit elkaar
 * groeien is hoe je een rij krijgt die de ene helft van de app wel en de
 * andere niet accepteert.
 */

/** Letterlijk dezelfde uitdrukking als de CHECK op courier_contacts.phone_e164. */
const E164 = /^\+[1-9][0-9]{7,14}$/;

export type PhoneResult =
  | { ok: true;  e164: string }
  | { ok: false; reason: string };

export function toE164(input: string): PhoneResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, reason: 'Vul je telefoonnummer in.' };

  // Spaties, streepjes, haakjes en punten zijn leesruis van de invoerder; de
  // plus blijft staan, want die draagt de landcode.
  const compact = raw.replace(/[\s\-().]/g, '');
  if (!/^\+?[0-9]+$/.test(compact)) {
    return { ok: false, reason: 'Een telefoonnummer bestaat alleen uit cijfers, eventueel met een +.' };
  }

  let e164: string;
  if      (compact.startsWith('+'))  e164 = compact;
  else if (compact.startsWith('00')) e164 = `+${compact.slice(2)}`;
  else if (compact.startsWith('0'))  e164 = `+31${compact.slice(1)}`;
  else if (compact.startsWith('31')) e164 = `+${compact}`;
  // Spraakherkenning levert regelmatig een 06-nummer zonder de nul op.
  else if (/^[1-9][0-9]{8}$/.test(compact)) e164 = `+31${compact}`;
  // Verder niet gokken: een nummer zonder landcode alsnog Nederlands noemen
  // levert een geldig ógend nummer op waar nooit een SMS aankomt.
  else return { ok: false, reason: 'Begin met 06…, 0031… of +31…' };

  if (!E164.test(e164)) {
    return { ok: false, reason: 'Dit nummer klopt niet — controleer het aantal cijfers.' };
  }
  return { ok: true, e164 };
}
