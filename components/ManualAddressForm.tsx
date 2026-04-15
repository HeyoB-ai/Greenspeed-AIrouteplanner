import React, { useState, useRef } from 'react';
import { X, PenLine, ArrowRight, Loader2 } from 'lucide-react';
import { ScanResult } from '../services/geminiService';
import { validateAddress } from '../services/addressValidation';

interface ManualAddressFormProps {
  onComplete: (result: ScanResult) => void;
  onCancel: () => void;
}

const formatPostalCode = (raw: string): string => {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  return clean.length > 4 ? `${clean.slice(0, 4)} ${clean.slice(4)}` : clean;
};

const inputStyle = {
  boxShadow: '0 0 0 1px rgba(188,202,196,0.2)',
};
const inputFocusStyle = {
  boxShadow: '0 0 0 2px #006b5a40',
};

const ManualAddressForm: React.FC<ManualAddressFormProps> = ({ onComplete, onCancel }) => {
  const [street, setStreet]           = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode]   = useState('');
  const [city, setCity]               = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [addressWarning, setAddressWarning] = useState<string | null>(null);
  const [isValidating, setIsValidating]     = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!street.trim())      e.street      = 'Straat is verplicht';
    if (!houseNumber.trim()) e.houseNumber = 'Huisnummer is verplicht';
    if (!postalCode.trim() || postalCode.replace(/\s/g, '').length < 6)
                             e.postalCode  = 'Vul een geldige postcode in (bijv. 1234 AB)';
    if (!city.trim())        e.city        = 'Stad is verplicht';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePostalCodeBlur = async () => {
    if (!postalCode || postalCode.replace(/\s/g, '').length < 6) return;
    setIsValidating(true);
    setAddressWarning(null);
    const result = await validateAddress(street, houseNumber, postalCode, city);
    setIsValidating(false);
    if (!result.valid) {
      setAddressWarning(
        result.suggestion
          ? `Adres niet gevonden. Bedoelt u: ${result.suggestion}?`
          : 'Adres niet gevonden in Nederland.'
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onComplete({
      address: {
        street:      street.trim(),
        houseNumber: houseNumber.trim(),
        postalCode:  postalCode.trim(),
        city:        city.trim(),
      },
      pharmacyName: pharmacyName.trim() || undefined,
    });
  };

  const inputCls = 'w-full bg-white rounded-xl px-4 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all';

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col justify-end"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        onClick={onCancel}
      />

      {/* Sheet */}
      <div
        ref={formRef}
        className="relative bg-white rounded-t-3xl z-10 animate-in slide-in-from-bottom duration-300 max-h-[92dvh] flex flex-col"
        style={{ boxShadow: '0 -8px 48px rgba(25,28,30,0.12)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#48c2a9]/15 rounded-2xl flex items-center justify-center">
              <PenLine size={18} className="text-[#006b5a]" />
            </div>
            <div>
              <h2 className="text-lg font-display font-black text-[#191c1e] leading-none">Handmatig invoeren</h2>
              <p className="text-[10px] font-body text-[#3d4945]/60 uppercase tracking-widest mt-0.5">Nieuw pakket</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 space-y-3 flex-1">

          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Straat</label>
              <input
                type="text"
                value={street}
                onChange={e => { setStreet(e.target.value); setErrors(p => ({ ...p, street: '' })); }}
                placeholder="Hoofdstraat"
                required
                autoComplete="street-address"
                className={inputCls}
                style={errors.street ? { boxShadow: '0 0 0 2px rgba(239,68,68,0.4)' } : inputStyle}
                onFocus={e => !errors.street && (e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40')}
                onBlur={e => e.currentTarget.style.boxShadow = errors.street ? '0 0 0 2px rgba(239,68,68,0.4)' : '0 0 0 1px rgba(188,202,196,0.2)'}
              />
              {errors.street && <p className="text-[10px] font-body font-bold text-red-500 ml-1">{errors.street}</p>}
            </div>
            <div className="w-28 space-y-1">
              <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Nr.</label>
              <input
                type="text"
                value={houseNumber}
                onChange={e => { setHouseNumber(e.target.value); setErrors(p => ({ ...p, houseNumber: '' })); }}
                placeholder="12a"
                required
                className={inputCls}
                style={errors.houseNumber ? { boxShadow: '0 0 0 2px rgba(239,68,68,0.4)' } : inputStyle}
                onFocus={e => !errors.houseNumber && (e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40')}
                onBlur={e => e.currentTarget.style.boxShadow = errors.houseNumber ? '0 0 0 2px rgba(239,68,68,0.4)' : '0 0 0 1px rgba(188,202,196,0.2)'}
              />
              {errors.houseNumber && <p className="text-[10px] font-body font-bold text-red-500 ml-1">Verplicht</p>}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-36 space-y-1">
              <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Postcode</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="text"
                  value={postalCode}
                  onChange={e => { setPostalCode(formatPostalCode(e.target.value)); setErrors(p => ({ ...p, postalCode: '' })); setAddressWarning(null); }}
                  onBlur={handlePostalCodeBlur}
                  placeholder="1234 AB"
                  required
                  className={inputCls}
                  style={errors.postalCode ? { boxShadow: '0 0 0 2px rgba(239,68,68,0.4)' } : inputStyle}
                  onFocus={e => !errors.postalCode && (e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40')}
                />
                {isValidating && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3d4945]/40 animate-spin pointer-events-none" />
                )}
              </div>
              {errors.postalCode && <p className="text-[10px] font-body font-bold text-red-500 ml-1">Ongeldig</p>}
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Stad</label>
              <input
                type="text"
                value={city}
                onChange={e => { setCity(e.target.value); setErrors(p => ({ ...p, city: '' })); }}
                placeholder="Amsterdam"
                required
                className={inputCls}
                style={errors.city ? { boxShadow: '0 0 0 2px rgba(239,68,68,0.4)' } : inputStyle}
                onFocus={e => !errors.city && (e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40')}
                onBlur={e => e.currentTarget.style.boxShadow = errors.city ? '0 0 0 2px rgba(239,68,68,0.4)' : '0 0 0 1px rgba(188,202,196,0.2)'}
              />
              {errors.city && <p className="text-[10px] font-body font-bold text-red-500 ml-1">{errors.city}</p>}
            </div>
          </div>

          {addressWarning && (
            <p className="text-[11px] font-body font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 leading-snug">
              ⚠️ {addressWarning}
            </p>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
              Apotheeknaam <span className="normal-case font-body font-bold text-[#3d4945]/40">(optioneel)</span>
            </label>
            <input
              type="text"
              value={pharmacyName}
              onChange={e => setPharmacyName(e.target.value)}
              placeholder="Apotheek de Kroon"
              className={inputCls}
              style={inputStyle}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
              onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.2)'}
            />
          </div>

          <div className="pt-2 pb-1">
            <button
              type="submit"
              className="w-full text-white h-14 rounded-full font-display font-bold text-sm active:scale-95 transition-all flex items-center justify-center space-x-2"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              <span>Pakket Toevoegen</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 text-sm font-body text-[#3d4945]/60 hover:text-[#3d4945] transition-colors"
          >
            Annuleer
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualAddressForm;
