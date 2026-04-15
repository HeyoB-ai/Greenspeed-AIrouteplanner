import React, { useState } from 'react';
import { Link, ArrowRight, Check, Loader2 } from 'lucide-react';
import { linkPharmacyCode } from '../services/authService';
import { Pharmacy } from '../types';

interface Props {
  pharmacies:     Pharmacy[];   // alle bekende apotheken (voor naam-display)
  linkedIds:      string[];     // al gekoppelde apotheken van deze koerier
  onLinked:       (pharmacyId: string) => void;
  onChoose:       (pharmacyId: string) => void;
  onSkip?:        () => void;   // alleen tonen als er al ≥1 apotheek is
}

const CourierPharmacyLink: React.FC<Props> = ({
  pharmacies, linkedIds, onLinked, onChoose, onSkip,
}) => {
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [justLinked, setJustLinked] = useState('');

  const linkedPharmacies = pharmacies.filter(p => linkedIds.includes(p.id));

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLinking(true);
    try {
      const result = await linkPharmacyCode(code.trim().toUpperCase());
      if (result) {
        setJustLinked(result.pharmacyId);
        onLinked(result.pharmacyId);
        setCode('');
      } else {
        setError('Code ongeldig of verlopen. Vraag een nieuwe code bij de apotheek.');
      }
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-5"
      style={{ background: 'linear-gradient(135deg, #006b5a 0%, #191c1e 50%, #191c1e 100%)' }}>
      <div className="w-full max-w-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)', boxShadow: '0 8px 32px rgba(0,107,90,0.40)' }}>
            <Link size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">Apotheek koppelen</h1>
          <p className="text-[#48c2a9] text-sm mt-1 font-bold">
            Voer de code in die je van de apotheek hebt gekregen
          </p>
        </div>

        {/* Reeds gekoppelde apotheken */}
        {linkedPharmacies.length > 0 && (
          <div className="bg-white/10 rounded-3xl p-4 space-y-2">
            <p className="text-xs font-black text-[#48c2a9] uppercase tracking-widest mb-3">
              Gekoppelde apotheken
            </p>
            {linkedPharmacies.map(ph => (
              <button
                key={ph.id}
                onClick={() => onChoose(ph.id)}
                className={`w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-2xl px-4 py-3 transition-all text-left ${justLinked === ph.id ? 'ring-2 ring-emerald-400' : ''}`}
              >
                <div>
                  <p className="text-white font-black text-sm">{ph.name}</p>
                  {ph.address && <p className="text-white/50 text-xs mt-0.5">{ph.address}</p>}
                </div>
                {justLinked === ph.id
                  ? <Check size={18} className="text-emerald-400 shrink-0" />
                  : <ArrowRight size={18} className="text-white/40 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {/* Code invoer */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-black/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#3d4945]/50 mb-3">
            {linkedPharmacies.length > 0 ? 'Nieuwe apotheek koppelen' : 'Apotheekcode'}
          </p>
          <form onSubmit={handleLink} className="space-y-3">
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="bijv. KR-4821"
              maxLength={7}
              className="w-full bg-[#f7f9fb] rounded-2xl px-5 h-14 font-black text-[#191c1e] text-xl text-center tracking-widest focus:outline-none transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
              onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.3)'}
              autoCapitalize="characters"
              autoCorrect="off"
            />
            {error && (
              <p className="text-xs font-bold text-red-500 text-center">{error}</p>
            )}
            <button
              type="submit"
              disabled={isLinking || code.replace(/[^A-Z0-9]/g, '').length < 6}
              className="w-full text-white h-12 rounded-full font-black text-sm disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {isLinking ? <Loader2 size={18} className="animate-spin" /> : <Link size={18} />}
              {isLinking ? 'Koppelen...' : 'Koppelen'}
            </button>
          </form>
        </div>

        {onSkip && linkedPharmacies.length > 0 && (
          <button
            onClick={onSkip}
            className="w-full text-center text-[#48c2a9] hover:text-white text-sm font-bold py-2 transition-colors"
          >
            Overslaan
          </button>
        )}
      </div>
    </div>
  );
};

export default CourierPharmacyLink;
