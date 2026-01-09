
import React, { useState } from 'react';
import { Package, Plus, MapPin, Scan, History, ArrowRight } from 'lucide-react';
import { Package as PackageType, PackageStatus, Address } from '../types';
import Scanner from './Scanner';

interface PharmacyViewProps {
  packages: PackageType[];
  onAddPackage: (address: Address) => void;
}

const PharmacyView: React.FC<PharmacyViewProps> = ({ packages, onAddPackage }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState<Address>({
    street: '', houseNumber: '', postalCode: '', city: ''
  });

  const pharmacyPackages = packages.filter(p => p.status !== PackageStatus.DELIVERED);
  const completedToday = packages.filter(p => p.status === PackageStatus.DELIVERED).length;

  const handleScanComplete = (address: Address) => {
    onAddPackage(address);
    setShowScanner(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddPackage(manualAddress);
    setManualAddress({ street: '', houseNumber: '', postalCode: '', city: '' });
    setManualMode(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">In afwachting</p>
          <p className="text-3xl font-bold dark:text-white mt-1">{pharmacyPackages.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Vandaag bezorgd</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{completedToday}</p>
        </div>
      </div>

      <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2">Nieuwe Zending</h2>
          <p className="text-blue-100 max-w-sm mb-6">Scan een label om direct een zending aan te maken. Onze AI verwijdert automatisch alle gevoelige patiëntgegevens.</p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setShowScanner(true)}
              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold flex items-center space-x-2 hover:bg-blue-50 transition-all active:scale-95 shadow-lg"
            >
              <Scan size={20} />
              <span>Label Scannen</span>
            </button>
            <button 
              onClick={() => setManualMode(!manualMode)}
              className="bg-blue-700/50 text-white px-6 py-3 rounded-xl font-bold border border-white/20 hover:bg-blue-700 transition-all active:scale-95"
            >
              {manualMode ? 'Annuleren' : 'Handmatig invoeren'}
            </button>
          </div>
        </div>
        <div className="hidden lg:block absolute -right-12 -bottom-12 opacity-20 transform rotate-12">
          <Package size={240} strokeWidth={1} />
        </div>
      </div>

      {manualMode && (
        <form onSubmit={handleManualSubmit} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Straatnaam</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white"
                value={manualAddress.street}
                onChange={e => setManualAddress({...manualAddress, street: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Huisnummer</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white"
                value={manualAddress.houseNumber}
                onChange={e => setManualAddress({...manualAddress, houseNumber: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Postcode</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white"
                value={manualAddress.postalCode}
                onChange={e => setManualAddress({...manualAddress, postalCode: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Plaats</label>
              <input 
                required
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white"
                value={manualAddress.city}
                onChange={e => setManualAddress({...manualAddress, city: e.target.value})}
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-all">
            Zending Bevestigen
          </button>
        </form>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-bold dark:text-white flex items-center space-x-2">
            <History size={18} className="text-slate-400" />
            <span>Recente Zendingen</span>
          </h3>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actief</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {pharmacyPackages.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p>Geen actieve zendingen gevonden.</p>
            </div>
          ) : (
            pharmacyPackages.map(p => (
              <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${
                    p.status === PackageStatus.PENDING ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="font-semibold dark:text-white text-sm">
                      {p.address.street} {p.address.houseNumber}
                    </p>
                    <p className="text-xs text-slate-500">{p.address.postalCode} {p.address.city}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${
                    p.status === PackageStatus.PENDING ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {p.status}
                  </span>
                  <button className="text-slate-400 hover:text-blue-600 p-2">
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showScanner && (
        <Scanner onScanComplete={handleScanComplete} onCancel={() => setShowScanner(false)} />
      )}
    </div>
  );
};

export default PharmacyView;
