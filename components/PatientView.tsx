
import React, { useState } from 'react';
import { Package as PackageType, PackageStatus } from '../types';
import { Search, Package, Truck, CheckCircle2, MapPin, Clock, AlertCircle } from 'lucide-react';

interface Props {
  packages: PackageType[];
}

const PatientView: React.FC<Props> = ({ packages }) => {
  const [postalCode, setPostalCode] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [foundPackage, setFoundPackage] = useState<PackageType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFoundPackage(null);

    const pkg = packages.find(p => 
      p.address.postalCode.replace(/\s/g, '').toLowerCase() === postalCode.replace(/\s/g, '').toLowerCase() &&
      p.address.houseNumber.toLowerCase() === houseNumber.toLowerCase() &&
      p.trackingCode?.toUpperCase() === trackingCode.toUpperCase()
    );

    if (pkg) {
      setFoundPackage(pkg);
    } else {
      setError('Geen zending gevonden met deze gegevens. Controleer de postcode, het huisnummer en de track-code.');
    }
  };

  const getStatusStep = (status: PackageStatus) => {
    switch (status) {
      case PackageStatus.SCANNING:
      case PackageStatus.PENDING:
        return 1;
      case PackageStatus.ASSIGNED:
      case PackageStatus.PICKED_UP:
        return 2;
      case PackageStatus.DELIVERED:
        return 3;
      default:
        return 1;
    }
  };

  const currentStep = foundPackage ? getStatusStep(foundPackage.status) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-2xl shadow-xl mb-6">
          <Search size={32} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Track & Trace</h1>
        <p className="text-slate-500 font-medium mt-2">Volg de status van uw medicijnen</p>
      </div>

      {!foundPackage ? (
        <form onSubmit={handleTrack} className="bg-white border border-slate-200 rounded-4xl p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Postcode</label>
              <input 
                type="text" 
                placeholder="1234 AB"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Huisnummer</label>
              <input 
                type="text" 
                placeholder="12"
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Track-Code</label>
            <input 
              type="text" 
              placeholder="AB-123"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center space-x-3 text-red-600">
              <AlertCircle size={20} />
              <p className="text-xs font-bold">{error}</p>
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all"
          >
            Zoek Pakket
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-4xl p-8 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status van uw zending</p>
                <h2 className="text-2xl font-black text-slate-900 mt-1">{foundPackage.status}</h2>
              </div>
              <button 
                onClick={() => setFoundPackage(null)}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-all"
              >
                Nieuwe Zoekopdracht
              </button>
            </div>

            {/* Status Timeline */}
            <div className="relative py-8">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full"></div>
              <div 
                className="absolute top-1/2 left-0 h-1 bg-blue-600 -translate-y-1/2 rounded-full transition-all duration-1000"
                style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
              ></div>

              <div className="relative flex justify-between">
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 ${currentStep >= 1 ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                    <Package size={20} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-3 ${currentStep >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>Gescand</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 ${currentStep >= 2 ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                    <Truck size={20} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-3 ${currentStep >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>Onderweg</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center z-10 transition-all duration-500 ${currentStep >= 3 ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                    <CheckCircle2 size={20} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mt-3 ${currentStep >= 3 ? 'text-emerald-500' : 'text-slate-400'}`}>Bezorgd</p>
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-6 border-t border-slate-100 pt-8">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Afleveradres</p>
                  <p className="text-xs font-bold text-slate-900">{foundPackage.address.street} {foundPackage.address.houseNumber}</p>
                  <p className="text-xs font-bold text-slate-900">{foundPackage.address.postalCode} {foundPackage.address.city}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tijdstip</p>
                  <p className="text-xs font-bold text-slate-900">
                    {foundPackage.deliveredAt 
                      ? `Bezorgd om ${new Date(foundPackage.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Verwachte bezorging vandaag'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <AlertCircle size={20} />
            </div>
            <p className="text-xs font-bold text-blue-800 leading-relaxed uppercase">
              Heeft u vragen over uw medicijnen? Neem dan direct contact op met <span className="font-black underline">{foundPackage.pharmacyName}</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientView;
