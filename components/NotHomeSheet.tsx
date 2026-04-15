import React, { useState, useEffect, useRef } from 'react';
import { Check, Mailbox, Users, Undo2, X, MoveRight, MapPin, PenLine } from 'lucide-react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';

interface NotHomeSheetProps {
  pkg: PackageType;
  onComplete: (status: PackageStatus, evidence: DeliveryEvidence) => void;
  onCancel: () => void;
}

type OptionKey = 'mailbox' | 'neighbour' | 'return' | 'moved' | 'other_location' | 'custom';

interface Option {
  key:        OptionKey;
  label:      string;
  sub:        string;
  icon:       React.ElementType;
  iconBg:     string;
  iconColor:  string;
  status:     PackageStatus;
  doneLabel:  string;
}

const OPTIONS: Option[] = [
  {
    key: 'mailbox',
    label: 'Brievenbus',
    sub: 'Pakket past in de brievenbus',
    icon: Mailbox,
    iconBg: 'bg-[#48c2a9]/15', iconColor: 'text-[#006b5a]',
    status: PackageStatus.MAILBOX,
    doneLabel: 'Brievenbus',
  },
  {
    key: 'neighbour',
    label: 'Bij buren',
    sub: 'Afgeven bij buren',
    icon: Users,
    iconBg: 'bg-[#d7e2fe]', iconColor: 'text-[#101c30]',
    status: PackageStatus.NEIGHBOUR,
    doneLabel: 'Bij buren',
  },
  {
    key: 'return',
    label: 'Terug naar apotheek',
    sub: 'Pakket niet kwijt kunnen',
    icon: Undo2,
    iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
    status: PackageStatus.RETURN,
    doneLabel: 'Retour apotheek',
  },
  {
    key: 'moved',
    label: 'Verhuisd',
    sub: 'Patiënt woont niet meer op dit adres',
    icon: MoveRight,
    iconBg: 'bg-[#f2f4f6]', iconColor: 'text-[#3d4945]',
    status: PackageStatus.MOVED,
    doneLabel: 'Verhuisd',
  },
  {
    key: 'other_location',
    label: 'Andere locatie',
    sub: 'Patiënt verblijft tijdelijk elders',
    icon: MapPin,
    iconBg: 'bg-[#f2f4f6]', iconColor: 'text-[#3d4945]',
    status: PackageStatus.OTHER_LOCATION,
    doneLabel: 'Andere locatie',
  },
  {
    key: 'custom',
    label: 'Andere reden',
    sub: 'Typ een toelichting',
    icon: PenLine,
    iconBg: 'bg-[#f2f4f6]', iconColor: 'text-[#3d4945]',
    status: PackageStatus.RETURN,
    doneLabel: 'Andere reden',
  },
];

const getNoteForOption = (option: OptionKey, extra?: string): string => {
  switch (option) {
    case 'mailbox':        return 'Achtergelaten in brievenbus';
    case 'neighbour':      return `Afgegeven bij buren${extra ? ` nr. ${extra}` : ''}`;
    case 'return':         return 'Retour naar apotheek';
    case 'moved':          return 'Patiënt verhuisd — retour apotheek';
    case 'other_location': return 'Patiënt verblijft op andere locatie — retour apotheek';
    case 'custom':         return extra?.trim() || 'Andere reden';
    default:               return '';
  }
};

const NotHomeSheet: React.FC<NotHomeSheetProps> = ({ pkg, onComplete, onCancel }) => {
  const [location, setLocation]       = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected]       = useState<OptionKey | null>(null);
  const [neighbourNr, setNeighbourNr] = useState('');
  const [customNote, setCustomNote]   = useState('');
  const [phase, setPhase]             = useState<'choose' | 'done'>('choose');
  const [doneLabel, setDoneLabel]     = useState('');
  const inputRef    = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocation(null),
      { timeout: 5000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (selected === 'neighbour') setTimeout(() => inputRef.current?.focus(), 50);
    if (selected === 'custom')    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [selected]);

  const commit = (option: Option, extraNote?: string) => {
    const gps = location ?? { latitude: 0, longitude: 0 };
    let note = getNoteForOption(option.key, extraNote);
    if (!location) note += ' (GPS niet beschikbaar)';
    const evidence: DeliveryEvidence = {
      ...gps,
      timestamp:     new Date().toISOString(),
      notHomeOption: option.key,
      deliveryNote:  note,
    };
    setDoneLabel(option.doneLabel);
    setPhase('done');
    setTimeout(() => onComplete(option.status, evidence), 1500);
  };

  const handleSelect = (option: Option) => {
    if (option.key === 'neighbour' || option.key === 'custom') {
      setSelected(option.key);
    } else {
      commit(option);
    }
  };

  const handleConfirmCustom = () => {
    const opt = OPTIONS.find(o => o.key === 'custom')!;
    commit(opt, customNote);
  };

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
        className="relative bg-white rounded-t-3xl z-10 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 -8px 48px rgba(25,28,30,0.12)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {phase === 'choose' ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4">
              <div>
                <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 mb-0.5">Niet thuis</p>
                <h2 className="text-xl font-display font-black text-[#191c1e] leading-tight">
                  {pkg.address.street} {pkg.address.houseNumber}
                </h2>
                <p className="text-xs font-body text-[#3d4945]/60 mt-0.5">
                  {pkg.address.postalCode} {pkg.address.city}
                </p>
              </div>
              <button
                onClick={onCancel}
                className="w-10 h-10 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all shrink-0"
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
                    className={`w-full flex items-center space-x-4 px-5 rounded-2xl transition-all active:scale-[0.98] ${
                      selected === opt.key ? 'bg-[#48c2a9]/10' : 'bg-[#f2f4f6] hover:bg-[#f2f4f6]/80'
                    }`}
                    style={{ minHeight: 72 }}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${opt.iconBg}`}>
                      <opt.icon size={22} className={opt.iconColor} />
                    </div>
                    <div className="text-left">
                      <p className="font-display font-black text-[#191c1e] text-base leading-tight">{opt.label}</p>
                      <p className="text-xs font-body text-[#3d4945]/60 mt-0.5">{opt.sub}</p>
                    </div>
                  </button>

                  {opt.key === 'neighbour' && selected === 'neighbour' && (
                    <div className="mt-2 px-1 animate-in slide-in-from-top-2 duration-200">
                      <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 mb-1.5 ml-1">
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
                          className="flex-1 bg-white rounded-xl px-4 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                          style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.4)' }}
                          onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                          onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.4)'}
                        />
                        <button
                          onClick={() => commit(opt, neighbourNr)}
                          className="px-5 h-12 text-white rounded-full font-display font-bold text-sm active:scale-95 transition-all shrink-0"
                          style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                        >
                          Bevestig
                        </button>
                      </div>
                    </div>
                  )}

                  {opt.key === 'custom' && selected === 'custom' && (
                    <div className="mt-2 px-1 animate-in slide-in-from-top-2 duration-200">
                      <textarea
                        ref={textareaRef}
                        value={customNote}
                        onChange={e => setCustomNote(e.target.value)}
                        placeholder="Beschrijf wat er aan de hand is..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl text-sm font-body text-[#191c1e] outline-none resize-none"
                        style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.4)' }}
                        onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                        onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.4)'}
                      />
                      <button
                        onClick={handleConfirmCustom}
                        disabled={!customNote.trim()}
                        className="w-full mt-2 h-12 text-white rounded-full font-display font-bold text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                      >
                        Bevestigen
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Annuleer */}
            <div className="px-4 pt-3">
              <button
                onClick={onCancel}
                className="w-full py-3 text-sm font-body text-[#3d4945]/60 hover:text-[#3d4945] transition-colors"
              >
                Annuleer
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 px-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)', boxShadow: '0 8px 32px rgba(0,107,90,0.25)' }}
            >
              <Check size={40} className="text-white" strokeWidth={3} />
            </div>
            <p className="text-2xl font-display font-black text-[#191c1e] text-center">Geregistreerd!</p>
            <p className="text-sm font-body text-[#3d4945]/60 mt-2 text-center">
              Geregistreerd als: <span className="text-[#191c1e] font-bold">{doneLabel}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotHomeSheet;
