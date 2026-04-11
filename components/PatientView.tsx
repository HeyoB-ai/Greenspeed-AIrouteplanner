import React, { useState, useEffect } from 'react';
import { Package as PackageType, PackageStatus } from '../types';
import { Search, Package, Truck, CheckCircle2, MapPin, Clock, AlertCircle, MessageCircle } from 'lucide-react';
import PatientChatbot from './PatientChatbot';

interface Props {
  packages: PackageType[];
  onBack?: () => void;
}

const PatientView: React.FC<Props> = ({ packages, onBack }) => {
  const [postalCode, setPostalCode]         = useState('');
  const [houseNumber, setHouseNumber]       = useState('');
  const [foundPackage, setFoundPackage]     = useState<PackageType | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [showChat, setShowChat]             = useState(false);

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
    [PackageStatus.SCANNING]:  'Bij de apotheek',
    [PackageStatus.PENDING]:   'Bij de apotheek',
    [PackageStatus.ASSIGNED]:  'In bezorging',
    [PackageStatus.PICKED_UP]: 'In bezorging',
    [PackageStatus.DELIVERED]: 'Afgeleverd',
    [PackageStatus.MAILBOX]:   'Afgeleverd in uw brievenbus',
    [PackageStatus.NEIGHBOUR]: 'Afgeleverd bij de buren',
    [PackageStatus.RETURN]:    'Retour bij apotheek — neem contact op',
    [PackageStatus.FAILED]:    'Bezorging mislukt — neem contact op',
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

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-slate-50">
      <div className="w-full max-w-sm space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Terug-knop */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-all"
          >
            ← Terug naar inloggen
          </button>
        )}

        {/* Kop */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-xl mb-4">
            <Search size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Track &amp; Trace</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Volg de status van uw medicijnen</p>
        </div>

        {!foundPackage ? (
          <form onSubmit={handleTrack} className="bg-white border border-slate-200 rounded-4xl p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Postcode</label>
                <input
                  type="text"
                  placeholder="1234 AB"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nr.</label>
                <input
                  type="text"
                  placeholder="12"
                  value={houseNumber}
                  onChange={e => setHouseNumber(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white h-13 py-3 rounded-3xl font-black text-base shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
            >
              Zoek Pakket
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-4xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                  <h2 className="text-xl font-black text-slate-900 mt-0.5 leading-tight">
                    {patientStatusText[foundPackage.status] ?? foundPackage.status}
                  </h2>
                </div>
                <button
                  onClick={() => setFoundPackage(null)}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-all"
                >
                  Nieuwe zoekopdracht
                </button>
              </div>

              {/* Status tijdlijn */}
              <div className="relative py-6">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full" />
                <div
                  className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 rounded-full transition-all duration-1000"
                  style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                />
                <div className="relative flex justify-between">
                  {[
                    { icon: Package,      label: 'Gescand',  step: 1 },
                    { icon: Truck,        label: 'Onderweg', step: 2 },
                    { icon: CheckCircle2, label: 'Bezorgd',  step: 3 },
                  ].map(({ icon: Icon, label, step }) => (
                    <div key={label} className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 ${
                        currentStep >= step
                          ? step === 3 ? 'bg-emerald-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
                          : 'bg-white border-2 border-slate-200 text-slate-300'
                      }`}>
                        <Icon size={20} />
                      </div>
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${
                        currentStep >= step
                          ? step === 3 ? 'text-emerald-500' : 'text-blue-600'
                          : 'text-slate-400'
                      }`}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Afleveradres</p>
                    <p className="text-sm font-bold text-slate-900">
                      {foundPackage.address.street} {foundPackage.address.houseNumber}
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      {foundPackage.address.postalCode} {foundPackage.address.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tijdstip</p>
                    <p className="text-sm font-bold text-slate-900">
                      {foundPackage.deliveredAt
                        ? `${new Date(foundPackage.deliveredAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} om ${new Date(foundPackage.deliveredAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                        : 'Verwachte bezorging vandaag'}
                    </p>
                    {foundPackage.deliveryEvidence?.deliveryNote && (
                      <p className="text-xs font-bold text-slate-400 mt-0.5">
                        {foundPackage.deliveryEvidence.deliveryNote}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                <AlertCircle size={18} />
              </div>
              <p className="text-xs font-bold text-blue-800 leading-relaxed">
                Vragen? Neem contact op met{' '}
                <span className="font-black underline">{foundPackage.pharmacyName}</span>.
              </p>
            </div>

            <button
              onClick={() => setShowChat(true)}
              className="w-full flex items-center justify-center space-x-2 h-12 bg-blue-600 text-white rounded-3xl font-black text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
            >
              <MessageCircle size={18} />
              <span>Vraag onze assistent</span>
            </button>
          </div>
        )}
      </div>

      {showChat && foundPackage && (
        <PatientChatbot
          pharmacyId={foundPackage.pharmacyId}
          pharmacyName={foundPackage.pharmacyName}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};

export default PatientView;
