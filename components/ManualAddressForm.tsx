import React, { useState, useRef } from 'react';
import { X, PenLine, ArrowRight } from 'lucide-react';
import { ScanResult } from '../services/geminiService';

interface ManualAddressFormProps {
  onComplete: (result: ScanResult) => void;
  onCancel: () => void;
}

const formatPostalCode = (raw: string): string => {
  // Houd alleen cijfers en letters, max 6 tekens
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  // Voeg spatie in na de 4 cijfers
  return clean.length > 4 ? `${clean.slice(0, 4)} ${clean.slice(4)}` : clean;
};

const ManualAddressForm: React.FC<ManualAddressFormProps> = ({ onComplete, onCancel }) => {
  const [street, setStreet]           = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode]   = useState('');
  const [city, setCity]               = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [errors, setErrors]           = useState<Record<string, string>>({});
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

  const inputBase = 'w-full bg-slate-50 border rounded-2xl px-4 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';
  const inputOk   = `${inputBase} border-slate-200`;
  const inputErr  = `${inputBase} border-red-300 bg-red-50`;

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col justify-end"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Sheet */}
      <div
        ref={formRef}
        className="relative bg-white rounded-t-3xl shadow-2xl z-10 animate-in slide-in-from-bottom duration-300 max-h-[92dvh] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center">
              <PenLine size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-none">Handmatig invoeren</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Nieuw pakket</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 active:scale-90 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form — scrollbaar als scherm te klein */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 space-y-3 flex-1">

          {/* Straat + Huisnummer naast elkaar */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Straat</label>
              <input
                type="text"
                value={street}
                onChange={e => { setStreet(e.target.value); setErrors(p => ({ ...p, street: '' })); }}
                placeholder="Hoofdstraat"
                required
                autoComplete="street-address"
                className={errors.street ? inputErr : inputOk}
              />
              {errors.street && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.street}</p>}
            </div>
            <div className="w-28 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nr.</label>
              <input
                type="text"
                value={houseNumber}
                onChange={e => { setHouseNumber(e.target.value); setErrors(p => ({ ...p, houseNumber: '' })); }}
                placeholder="12a"
                required
                className={errors.houseNumber ? inputErr : inputOk}
              />
              {errors.houseNumber && <p className="text-[10px] font-bold text-red-500 ml-1">Verplicht</p>}
            </div>
          </div>

          {/* Postcode + Stad naast elkaar */}
          <div className="flex gap-3">
            <div className="w-36 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Postcode</label>
              <input
                type="text"
                inputMode="text"
                value={postalCode}
                onChange={e => { setPostalCode(formatPostalCode(e.target.value)); setErrors(p => ({ ...p, postalCode: '' })); }}
                placeholder="1234 AB"
                required
                className={errors.postalCode ? inputErr : inputOk}
              />
              {errors.postalCode && <p className="text-[10px] font-bold text-red-500 ml-1">Ongeldig</p>}
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stad</label>
              <input
                type="text"
                value={city}
                onChange={e => { setCity(e.target.value); setErrors(p => ({ ...p, city: '' })); }}
                placeholder="Amsterdam"
                required
                className={errors.city ? inputErr : inputOk}
              />
              {errors.city && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.city}</p>}
            </div>
          </div>

          {/* Apotheeknaam (optioneel) */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Apotheeknaam <span className="normal-case font-bold text-slate-300">(optioneel)</span>
            </label>
            <input
              type="text"
              value={pharmacyName}
              onChange={e => setPharmacyName(e.target.value)}
              placeholder="Apotheek de Kroon"
              className={inputOk}
            />
          </div>

          {/* Submit */}
          <div className="pt-2 pb-1">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white h-14 rounded-2xl font-black text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2 hover:bg-blue-700"
            >
              <span>Pakket Toevoegen</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Annuleer */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Annuleer
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualAddressForm;
