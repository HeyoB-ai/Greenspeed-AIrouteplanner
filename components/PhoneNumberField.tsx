import React, { useState } from 'react';
import { Phone, CheckCircle2, Loader2 } from 'lucide-react';
import { normalizePhone } from '../services/courierContactService';

export interface PhoneField {
  raw:      string;
  setRaw:   (v: string) => void;
  /** Gezet zodra de server het nummer heeft omgezet én de koerier het ziet staan. */
  e164:     string | null;
  checking: boolean;
  error:    string;
  /** Controleert het ingetypte nummer en geeft de E.164-vorm terug, of null. */
  check:    () => Promise<string | null>;
}

/**
 * Houdt de invoer en de bevestigde E.164-vorm bij elkaar. Het is een hook en niet
 * alleen een component, omdat het formulier eromheen moet kunnen weigeren te
 * verzenden zolang het nummer niet bevestigd is — die twee toestanden op twee
 * plekken bijhouden loopt onvermijdelijk uit de pas.
 */
export function usePhoneField(initial = ''): PhoneField {
  const [raw, setRawState] = useState(initial);
  const [e164, setE164]    = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError]  = useState('');

  const setRaw = (v: string) => {
    setRawState(v);
    // Elke aanpassing maakt de eerdere bevestiging ongeldig; anders slaat de
    // koerier het nummer op dat hij zág, niet het nummer dat er staat.
    setE164(null);
    setError('');
  };

  const check = async (): Promise<string | null> => {
    const input = raw.trim();
    if (!input) { setE164(null); setError('Vul je telefoonnummer in.'); return null; }
    setChecking(true);
    try {
      const result = await normalizePhone(input);
      if (result.ok) { setE164(result.e164); setError(''); return result.e164; }
      setE164(null); setError(result.reason); return null;
    } finally {
      setChecking(false);
    }
  };

  return { raw, setRaw, e164, checking, error, check };
}

/** +31612345678 → "+31 6 12345678"; leesbaarder om te controleren dan één blok cijfers. */
function leesbaar(e164: string): string {
  const m = /^\+31(6)(\d{8})$/.exec(e164);
  return m ? `+31 ${m[1]} ${m[2]}` : e164;
}

const inputCls    = 'w-full bg-white rounded-xl pl-10 pr-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all';
const inputShadow = { boxShadow: '0 0 0 1px rgba(188,202,196,0.25)' };

interface Props {
  field:      PhoneField;
  label?:     string;
  autoFocus?: boolean;
}

/**
 * Telefoonveld dat teruggeeft hoe het nummer wordt opgeslagen vóórdat de koerier
 * verder gaat. Een typefout valt zo hier op en niet pas weken later, als de SMS
 * over zijn dienst of declaratie niet aankomt en niemand weet waarom.
 *
 * Het omzetten gebeurt op de server, zodat wat hier op het scherm staat
 * gegarandeerd hetzelfde is als wat de database krijgt.
 */
const PhoneNumberField: React.FC<Props> = ({ field, label = 'Telefoonnummer', autoFocus }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
      {label} <span className="normal-case font-body font-bold text-[#3d4945]/40">(voor sms over je diensten)</span>
    </label>
    <div className="relative">
      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40 pointer-events-none" />
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus={autoFocus}
        value={field.raw}
        placeholder="06 12 34 56 78"
        required
        onChange={e => field.setRaw(e.target.value)}
        onBlur={() => { if (field.raw.trim() && !field.e164) void field.check(); }}
        className={inputCls}
        style={inputShadow}
        onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
      />
    </div>

    {field.checking && (
      <p className="flex items-center gap-1.5 text-xs font-body text-[#3d4945]/60 ml-1">
        <Loader2 size={13} className="animate-spin" />
        Nummer controleren…
      </p>
    )}
    {!field.checking && field.e164 && (
      <p className="flex items-center gap-1.5 text-xs font-body font-bold text-[#006b5a] ml-1">
        <CheckCircle2 size={13} />
        Wordt opgeslagen als {leesbaar(field.e164)}
      </p>
    )}
    {!field.checking && !field.e164 && field.error && (
      <p className="text-xs font-body font-bold text-red-500 ml-1">{field.error}</p>
    )}
  </div>
);

export default PhoneNumberField;
