import React, { useState } from 'react';
import { Package, Scan, Plus, MapPin, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Package as PackageType, Address, PackageStatus } from '../types';
import Scanner from './Scanner';

interface Props {
  packages: PackageType[];
  onAdd: (address: Address) => void;
}

const PharmacyView: React.FC<Props> = ({ packages, onAdd }) => {
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Action Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-blue-600 rounded-4xl p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                <Scan size={24} />
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-2">Nieuwe Zending</h2>
              <p className="text-blue-100 text-sm font-medium mb-8 leading-relaxed">
                Scan een patiëntlabel. Onze AI verwijdert automatisch gevoelige data en extraheert alleen het adres.
              </p>
              <button 
                onClick={() => setShowScanner(true)}
                className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
              >
                <span>Nu Scannen</span>
                <ArrowRight size={20} />
              </button>
            </div>
            <Package className="absolute -bottom-10 -right-10 w-48 h-48 text-white/10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
          </div>

          <div className="bg-white border border-slate-200 rounded-4xl p-8 shadow-sm">
            <h3 className="text-slate-900 font-extrabold text-lg mb-4 flex items-center space-x-2">
              <ShieldCheck className="text-green-500" size={20} />
              <span>Privacy Status</span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-sm text-slate-500 font-bold">
                <CheckCircle2 size={16} className="text-blue-500" />
                <span>AI OCR Filter Actief</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-slate-500 font-bold">
                <CheckCircle2 size={16} className="text-blue-500" />
                <span>Geen Patiëntdata Opslag</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-slate-500 font-bold">
                <CheckCircle2 size={16} className="text-blue-500" />
                <span>Lokaal Geëncrypteerd</span>
              </div>
            </div>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">Actieve Zendingen</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Totaal: {packages.length} in verwerking
                </p>
              </div>
              <div className="flex -space-x-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 ring-2 ring-slate-100"></div>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {packages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Package className="text-slate-300" size={32} />
                  </div>
                  <p className="text-slate-900 font-black text-lg">Geen actieve ritten</p>
                  <p className="text-slate-400 text-sm max-w-[200px] mt-2">Begin met het scannen van een medisch etiket.</p>
                </div>
              ) : (
                packages.map(p => (
                  <div key={p.id} className="group bg-white border border-slate-100 rounded-3xl p-6 flex items-center justify-between hover:border-blue-200 hover:shadow-md transition-all cursor-default">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-lg tracking-tight">{p.address.street} {p.address.houseNumber}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{p.address.postalCode} {p.address.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        p.status === PackageStatus.PENDING ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {p.status}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-blue-600 transition-colors">
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showScanner && (
        <Scanner 
          onScanComplete={(addr) => { onAdd(addr); setShowScanner(false); }} 
          onCancel={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
};

export default PharmacyView;