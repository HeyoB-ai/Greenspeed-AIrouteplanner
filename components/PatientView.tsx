import React, { useState, useEffect } from 'react';
import { Package as PackageType, PackageStatus } from '../types';
import { Search, Package, Truck, CheckCircle2, MapPin, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import PatientChatbot from './PatientChatbot';

interface Props {
  packages: PackageType[];
  onBack?: () => void;
}

const PatientView: React.FC<Props> = ({ packages, onBack }) => {
  const [postalCode, setPostalCode]     = useState('');
  const [houseNumber, setHouseNumber]   = useState('');
  const [foundPackage, setFoundPackage] = useState<PackageType | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [showChat, setShowChat]         = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pc = params.get('pc');
    const hn = params.get('hn');
    if (pc && hn) {
      setPostalCode(pc);
      setHouseNumber(hn);
      if (packages.length > 0) {
        const pkg = packages.find(p =>
          p.address.postalCode.replace(/\s/g, '').toLowerCase() === pc.replace(/\s/g, '').toLowerCase() &&
          p.address.houseNumber.toLowerCase() === hn.toLowerCase()
        );
        if (pkg) setFoundPackage(pkg);
      }
    }
  }, [packages]);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFoundPackage(null);
    const pkg = packages.find(p =>
      p.address.postalCode.replace(/\s/g, '').toLowerCase() === postalCode.replace(/\s/g, '').toLowerCase() &&
      p.address.houseNumber.toLowerCase() === houseNumber.toLowerCase()
    );
    if (pkg) {
      setFoundPackage(pkg);
    } else {
      setError('Geen zending gevonden. Controleer de postcode en het huisnummer.');
    }
  };

  const patientStatusText: Partial<Record<PackageStatus, string>> = {
    [PackageStatus.SCANNING]:        'Bij de apotheek',
    [PackageStatus.PENDING]:         'Bij de apotheek',
    [PackageStatus.ASSIGNED]:        'In bezorging',
    [PackageStatus.PICKED_UP]:       'In bezorging',
    [PackageStatus.DELIVERED]:       'Afgeleverd',
    [PackageStatus.MAILBOX]:         'Afgeleverd in uw brievenbus',
    [PackageStatus.NEIGHBOUR]:       'Afgeleverd bij de buren',
    [PackageStatus.RETURN]:          'Retour bij apotheek — neem contact op',
    [PackageStatus.FAILED]:          'Bezorging mislukt — neem contact op',
    [PackageStatus.MOVED]:           'Bezorging niet gelukt — neem contact op met uw apotheek',
    [PackageStatus.OTHER_LOCATION]:  'Bezorging niet gelukt — neem contact op met uw apotheek',
  };

  const getStatusStep = (status: PackageStatus) => {
    switch (status) {
      case PackageStatus.SCANNING:
      case PackageStatus.PENDING:   return 1;
      case PackageStatus.ASSIGNED:
      case PackageStatus.PICKED_UP: return 2;
      case PackageStatus.DELIVERED:
      case PackageStatus.MAILBOX:
      case PackageStatus.NEIGHBOUR:
      case PackageStatus.RETURN:    return 3;
      default:                      return 1;
    }
  };

  const currentStep = foundPackage ? getStatusStep(foundPackage.status) : 0;

  const chatPharmacyId   = foundPackage?.pharmacyId   ?? packages[0]?.pharmacyId   ?? 'ph-1';
  const chatPharmacyName = foundPackage?.pharmacyName ?? packages[0]?.pharmacyName ?? 'Uw Apotheek';

  const inputCls = 'w-full bg-[#f7f9fb] rounded-2xl px-4 h-12 font-body font-bold text-[#191c1e] text-sm focus:outline-none transition-all';
  const inputStyle = { boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' };
  const inputFocusStyle = { boxShadow: '0 0 0 2px #006b5a40' };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-[#f7f9fb]">
      <div className="w-full max-w-sm space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Terug-knop */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-[10px] font-display font-black uppercase tracking-widest text-[#006b5a] bg-[#48c2a9]/10 px-4 py-2 rounded-full border border-[#48c2a9]/20 hover:bg-[#48c2a9]/15 transition-all"
          >
            ← Terug naar inloggen
          </button>
        )}

        {/* Kop */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 text-white rounded-2xl shadow-xl mb-4"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
            <Search size={28} />
          </div>
          <h1 className="text-2xl font-display font-black text-[#191c1e] tracking-tight">Track &amp; Trace</h1>
          <p className="text-[#3d4945]/60 font-body text-sm font-medium mt-1">Volg de status van uw medicijnen</p>
        </div>

        {!foundPackage ? (
          <form onSubmit={handleTrack} className="bg-white rounded-4xl p-6 space-y-4"
            style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.06)' }}>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/50 ml-1">Postcode</label>
                <input
                  type="text"
                  placeholder="1234 AB"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                  required
                  className={inputCls}
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.boxShadow = inputFocusStyle.boxShadow}
                  onBlur={e => e.currentTarget.style.boxShadow = inputStyle.boxShadow}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/50 ml-1">Nr.</label>
                <input
                  type="text"
                  placeholder="12"
                  value={houseNumber}
                  onChange={e => setHouseNumber(e.target.value)}
                  required
                  className={inputCls}
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.boxShadow = inputFocusStyle.boxShadow}
                  onBlur={e => e.currentTarget.style.boxShadow = inputStyle.boxShadow}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-body font-bold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full text-white h-13 py-3 rounded-full font-display font-black text-base active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)', boxShadow: '0 8px 24px rgba(0,107,90,0.25)' }}
            >
              Zoek Pakket
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-4xl p-6" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.06)' }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/50">Status</p>
                  <h2 className="text-xl font-display font-black text-[#191c1e] mt-0.5 leading-tight">
                    {patientStatusText[foundPackage.status] ?? foundPackage.status}
                  </h2>
                </div>
                <button
                  onClick={() => setFoundPackage(null)}
                  className="text-[10px] font-display font-black uppercase tracking-widest text-[#006b5a] bg-[#48c2a9]/10 px-3 py-2 rounded-full border border-[#48c2a9]/20 hover:bg-[#48c2a9]/15 transition-all"
                >
                  Nieuwe zoekopdracht
                </button>
              </div>

              {/* Status tijdlijn */}
              <div className="relative py-6">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-[#f2f4f6] -translate-y-1/2 rounded-full" />
                <div
                  className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-all duration-1000"
                  style={{ width: `${((currentStep - 1) / 2) * 100}%`, background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                />
                <div className="relative flex justify-between">
                  {[
                    { icon: Package,      label: 'Gescand',  step: 1 },
                    { icon: Truck,        label: 'Onderweg', step: 2 },
                    { icon: CheckCircle2, label: 'Bezorgd',  step: 3 },
                  ].map(({ icon: Icon, label, step }) => (
                    <div key={label} className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 ${
                          currentStep >= step
                            ? step === 3 ? 'bg-emerald-500 text-white shadow-lg' : 'text-white shadow-lg'
                            : 'bg-white text-[#bccac4]'
                        }`}
                        style={currentStep >= step && step !== 3
                          ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }
                          : currentStep < step
                          ? { boxShadow: '0 0 0 2px rgba(188,202,196,0.4)' }
                          : {}}
                      >
                        <Icon size={20} />
                      </div>
                      <p className={`text-[10px] font-display font-black uppercase tracking-widest mt-2 ${
                        currentStep >= step
                          ? step === 3 ? 'text-emerald-500' : 'text-[#006b5a]'
                          : 'text-[#3d4945]/40'
                      }`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#bccac4]/20 pt-5">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#f7f9fb] rounded-lg flex items-center justify-center text-[#3d4945]/50 shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-display font-black uppercase tracking-widest text-[#3d4945]/50">Afleveradres</p>
                    <p className="text-sm font-display font-black text-[#191c1e]">
                      {foundPackage.address.street} {foundPackage.address.houseNumber}
                    </p>
                    <p className="text-sm font-display font-black text-[#191c1e]">
                      {foundPackage.address.postalCode} {foundPackage.address.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[#f7f9fb] rounded-lg flex items-center justify-center text-[#3d4945]/50 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-display font-black uppercase tracking-widest text-[#3d4945]/50">Tijdstip</p>
                    <p className="text-sm font-display font-black text-[#191c1e]">
                      {foundPackage.deliveredAt
                        ? `${new Date(foundPackage.deliveredAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} om ${new Date(foundPackage.deliveredAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Verwachte bezorging vandaag'}
                    </p>
                    {foundPackage.deliveryEvidence?.deliveryNote && (
                      <p className="text-xs font-body text-[#3d4945]/50 mt-0.5">
                        {foundPackage.deliveryEvidence.deliveryNote}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#48c2a9]/10 border border-[#48c2a9]/20 rounded-3xl p-5 flex items-center space-x-3">
              <div className="w-9 h-9 bg-[#48c2a9]/15 rounded-xl flex items-center justify-center text-[#006b5a] shrink-0">
                <AlertCircle size={18} />
              </div>
              <p className="text-xs font-body font-bold text-[#006b5a] leading-relaxed">
                Vragen? Neem contact op met{' '}
                <span className="font-display font-black underline">{foundPackage.pharmacyName}</span>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating chat button */}
      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 text-white px-5 h-14 rounded-full font-display font-black text-sm active:scale-95 transition-all"
        style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)', boxShadow: '0 8px 32px rgba(0,107,90,0.35)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
      >
        <MessageCircle size={20} />
        <span>Stel een vraag</span>
      </button>

      {showChat && (
        <PatientChatbot
          pharmacyId={chatPharmacyId}
          pharmacyName={chatPharmacyName}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

export default PatientView;
