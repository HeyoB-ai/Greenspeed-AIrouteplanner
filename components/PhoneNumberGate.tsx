import React, { useState } from 'react';
import { MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import PhoneNumberField, { usePhoneField } from './PhoneNumberField';
import { saveMyPhone, readPendingPhone, clearPendingPhone } from '../services/courierContactService';

interface Props {
  courierName?: string;
  onSaved:      () => void;
}

/**
 * Blokkeert de app voor een koerier die nog geen nummer in courier_contacts heeft.
 *
 * Dit is het enige onderdeel dat ook de bestáánde koeriers bereikt: het formulier
 * bij registratie vult alleen wie er nieuw bij komt, dus zonder dit slot zou de
 * achterstand nooit leeglopen. Er is bewust geen "later"-knop — een koerier die
 * overslaat blijft onvindbaar voor de SMS-ketens van de planner, en juist dat
 * stille wegvallen is wat we wilden verhelpen.
 */
const PhoneNumberGate: React.FC<Props> = ({ courierName, onSaved }) => {
  // Wie zich net registreerde en zijn account moest bevestigen, had toen nog geen
  // sessie om het nummer mee op te slaan. Dat nummer staat hier alvast ingevuld.
  const field = usePhoneField(readPendingPhone());
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const opslaan = async () => {
    setError('');

    // Nog niet bevestigd? Dan eerst controleren en het resultaat laten zien; de
    // koerier gaat pas verder als hij het genormaliseerde nummer heeft gezien.
    if (!field.e164) {
      await field.check();
      return;
    }

    setSaving(true);
    try {
      const result = await saveMyPhone(field.e164);
      if (!result.ok) { setError(result.reason); return; }
      clearPendingPhone();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-5 lg:p-8"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #006b5a 50%, #0a1628 100%)' }}>
      <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="text-center mb-6">
          <img src="/gobob-logo-stacked-white.png" alt="GoBob" className="h-20 w-auto mx-auto" />
        </div>

        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.30)' }}>
          <div className="p-7 space-y-5">
            <div className="w-12 h-12 bg-[#48c2a9]/15 rounded-2xl flex items-center justify-center">
              <MessageSquare className="text-[#006b5a] w-6 h-6" />
            </div>

            <div>
              <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#006b5a] mb-1">
                {courierName ? `Hoi ${courierName.split(' ')[0]}` : 'Koerier'}
              </p>
              <h2 className="text-xl font-display font-black text-[#191c1e]">
                Nog één ding: je telefoonnummer
              </h2>
              <p className="text-sm font-body text-[#3d4945]/60 leading-relaxed mt-2">
                Op dit nummer krijg je een sms als je bent ingepland en als je je
                declaratie nog moet insturen. Zonder nummer mis je die berichten.
              </p>
            </div>

            <PhoneNumberField field={field} autoFocus />

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-xs font-body font-bold text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={opslaan}
              disabled={saving || field.checking}
              className="w-full text-white h-12 rounded-full font-display font-bold text-sm active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {saving
                ? <><Loader2 size={18} className="animate-spin" /><span>Opslaan…</span></>
                : field.e164
                  ? <><span>Opslaan en aan de slag</span><ArrowRight size={18} /></>
                  : <span>Nummer controleren</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneNumberGate;
