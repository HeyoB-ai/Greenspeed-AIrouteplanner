import React, { useState } from 'react';
import { Package, Scan, Plus, MapPin, Clock } from 'lucide-react';
import { Package as PackageType, Address, PackageStatus } from '../types';
import Scanner from './Scanner';

interface Props {
  packages: PackageType[];
  onAdd: (address: Address) => void;
}

const PharmacyView: React.FC<Props> = ({ packages, onAdd }) => {
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-200 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">Nieuwe Zending</h2>
          <p className="text-blue-100 max-w-sm mb-8 opacity-90">Gebruik AI-scannen om labels privacy-veilig te verwerken. Geen patiëntdata wordt opgeslagen.</p>
          <button 
            onClick={() => setShowScanner(true)}
            className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold flex items-center space-x-3 shadow-lg active:scale-95 transition-all"
          >
            <Scan /><span>Scan Verzendetiket</span>
          </button>
        </div>
        <Package className="absolute -right-12 -bottom-12 text-white/10 w-64 h-64 rotate-12" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-lg">Actieve Zendingen ({packages.length})</h3>
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Clock size={14} /><span>Real-time</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {packages.length === 0 ? (
            <div className="p-12 text-center text-slate-400">Geen actieve zendingen.</div>
          ) : (
            packages.map(p => (
              <div key={p.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400"><MapPin /></div>
                  <div>
                    <p className="font-bold">{p.address.street} {p.address.houseNumber}</p>
                    <p className="text-xs text-slate-500 font-medium">{p.address.postalCode} {p.address.city}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${p.status === PackageStatus.PENDING ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      {showScanner && <Scanner onScanComplete={(addr) => { onAdd(addr); setShowScanner(false); }} onCancel={() => setShowScanner(false)} />}
    </div>
  );
};

export default PharmacyView;