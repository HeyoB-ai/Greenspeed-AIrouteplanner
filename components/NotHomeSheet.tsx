import React, { useState, useEffect, useRef } from 'react';
import { Check, Mailbox, Users, Undo2, X } from 'lucide-react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';

interface NotHomeSheetProps {
  pkg: PackageType;
  onComplete: (
    status: PackageStatus.MAILBOX | PackageStatus.NEIGHBOUR | PackageStatus.RETURN,
    evidence: DeliveryEvidence
  ) => void;
  onCancel: () => void;
}

type Option = 'mailbox' | 'neighbour' | 'return';

const OPTIONS: {
  key: Option;
  label: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  cardBorder: string;
  cardBg: string;
  status: PackageStatus.MAILBOX | PackageStatus.NEIGHBOUR | PackageStatus.RETURN;
  doneLabel: string;
}[] = [
  {
    key: 'mailbox',
    label: 'Brievenbus',
    sub: 'Pakket past in de brievenbus',
    icon: Mailbox,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    cardBorder: 'border-emerald-200',
    cardBg: 'bg-emerald-50',
    status: PackageStatus.MAILBOX,
    doneLabel: 'Brievenbus',
  },
  {
    key: 'neighbour',
    label: 'Bij buren',
    sub: 'Afgeven bij buren',
    icon: Users,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    cardBorder: 'border-blue-200',
    cardBg: 'bg-blue-50',
    status: PackageStatus.NEIGHBOUR,
    doneLabel: 'Bij buren',
  },
  {
    key: 'return',
    label: 'Terug naar apotheek',
    sub: 'Pakket niet kwijt kunnen',
    icon: Undo2,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    cardBorder: 'border-amber-200',
    cardBg: 'bg-amber-50',
    status: PackageStatus.RETURN,
    doneLabel: 'Retour apotheek',
  },
];

const NotHomeSheet: React.FC<NotHomeSheetProps> = ({ pkg, onComplete, onCancel }) => {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected] = useState<Option | null>(null);
  const [neighbourNr, setNeighbourNr] = useState('');
  const [phase, setPhase] = useState<'choose' | 'done'>('choose');
  const [doneLabel, setDoneLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // GPS ophalen zodra sheet opent — niet wachten op keuze
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocation(null),
      { timeout: 5000, maximumAge: 30000 }
    );
  }, []);

  // Focus het invulveld zodra "Buren" geselecteerd wordt
  useEffect(() => {
    if (selected === 'neighbour') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selected]);

  const commit = (option: typeof OPTIONS[number]) => {
    const gps = location ?? { latitude: 0, longitude: 0 };
    const noteBase = option.key === 'neighbour' && neighbourNr.trim()
      ? `Buren nr. ${neighbourNr.trim()}`
      : undefined;
    const note = !location
      ? [noteBase, '(GPS niet beschikbaar)'].filter(Boolean).join(' ')
      : noteBase;

    const evidence: DeliveryEvidence = {
      ...gps,
      timestamp: new Date().toISOString(),
      notHomeOption: option.key,
      ...(note ? { deliveryNote: note } : {}),
    };

    setDoneLabel(option.doneLabel);
    setPhase('done');

    setTimeout(() => {
      onComplete(option.status, evidence);
    }, 1500);
  };

  const handleSelect = (option: typeof OPTIONS[number]) => {
    if (option.key === 'neighbour') {
      setSelected('neighbour');
    } else {
      commit(option);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col justify-end"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-3xl shadow-2xl z-10 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {phase === 'choose' ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Niet thuis</p>
                <h2 className="text-xl font-black text-slate-900 leading-tight">
                  {pkg.address.street} {pkg.address.houseNumber}
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {pkg.address.postalCode} {pkg.address.city}
                </p>
              </div>
              <button
                onClick={onCancel}
                className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 active:scale-90 transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Opties */}
            <div className="px-4 space-y-2 pb-2">
              {OPTIONS.map(opt => (
                <div key={opt.key}>
                  <button
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center space-x-4 px-5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                      selected === opt.key
                        ? `${opt.cardBg} ${opt.cardBorder}`
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                    style={{ minHeight: 72 }}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${opt.iconBg}`}>
                      <opt.icon size={22} className={opt.iconColor} />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-slate-900 text-base leading-tight">{opt.label}</p>
                      <p className="text-xs font-bold text-slate-400 mt-0.5">{opt.sub}</p>
                    </div>
                  </button>

                  {/* Inline invoer bij "Buren" */}
                  {opt.key === 'neighbour' && selected === 'neighbour' && (
                    <div className="mt-2 px-1 animate-in slide-in-from-top-2 duration-200">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">
                        Bij welk huisnummer?
                      </p>
                      <div className="flex gap-2">
                        <input
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          placeholder="bijv. 14"
                          value={neighbourNr}
                          onChange={e => setNeighbourNr(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <button
                          onClick={() => commit(opt)}
                          className="px-5 h-12 bg-blue-600 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shrink-0"
                        >
                          Bevestig
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Annuleer */}
            <div className="px-4 pt-3">
              <button
                onClick={onCancel}
                className="w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Annuleer
              </button>
            </div>
          </>
        ) : (
          /* Fase 2 — bevestiging */
          <div className="flex flex-col items-center justify-center py-14 px-6">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 mb-6 animate-in zoom-in-50 duration-300">
              <Check size={40} className="text-white" strokeWidth={3} />
            </div>
            <p className="text-2xl font-black text-slate-900 text-center">Geregistreerd!</p>
            <p className="text-sm font-bold text-slate-400 mt-2 text-center">
              Geregistreerd als: <span className="text-slate-700">{doneLabel}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotHomeSheet;
