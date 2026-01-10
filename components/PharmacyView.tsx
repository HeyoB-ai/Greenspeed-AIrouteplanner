import React, { useState } from 'react';
import { Package, Scan, Plus, MapPin, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Package as PackageType, Address, PackageStatus } from '../types';
import Scanner from './Scanner';

interface Props {
  packages: PackageType[];
  onAdd: (address: Address) => void;
}

const PharmacyView: React.FC<Props> = ({ packages, onAdd }) => {
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 sm:p-14 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full mb-6">
            <ShieldCheck size={14} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Privacy AI Engine Actief</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight leading-tight">Nieuwe Zending</h2>
          <p className="text-blue-50/80 text-lg max-w-lg mb-10 leading-relaxed font-medium">Scan een medisch etiket. Onze AI verwijdert automatisch patiëntnamen en BSN's voor een 100% anonieme route.</p>
          
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <button 
              onClick={() => setShowScanner(true)}
              className="bg-white text-blue-700 px-10 py-5 rounded-[1.5rem] font-extrabold flex items-center justify-center space-x-3 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all group"
            >
              <Scan className="group-hover:rotate-12 transition-transform" />
              <span>Label Scannen</span>
            </button>
            <button className="bg-blue-500/30 backdrop-blur-md text-white border border-white/20 px-10 py-5 rounded-[1.5rem] font-extrabold hover:bg-white/10 transition-all flex items-center justify-center space-x-2">
              <Plus size={20} />
              <span>Handmatig</span>
            </button>
          </div>
        </div>
        <Package className="absolute -right-16 -bottom-16 text-white/10 w-80 h-80 rotate-12" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.03)]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-black text-2xl text-slate-900">Zendingen in Wachtrij</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-1">Status: Live Updates</p>
          </div>
          <div className="flex -space-x-2 overflow-hidden">
             {[1,2,3].map(i => (
               <div key={i} className="inline-block h-8 w-8 rounded-full ring-4 ring-white bg-slate-200"></div>
             ))}
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {packages.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="text-slate-300" size={32} />
              </div>
              <p className="text-slate-400 font-bold text-lg">Geen actieve zendingen</p>
              <p className="text-slate-400 text-sm mt-1">Scan je eerste label om te beginnen.</p>
            </div>
          ) : (
            packages.map(p => (
              <div key={p.id} className="p-8 flex items-center justify-between hover:bg-blue-50/30 transition-all group">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-600 group-hover:shadow-md transition-all">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="font-black text-xl text-slate-900 tracking-tight">{p.address.street} {p.address.houseNumber}</p>
                    <div className="flex items-center space-x-2 text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                      <span>{p.address.postalCode} {p.address.city}</span>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span className="text-blue-500">ID: {p.id.split('-')[1]}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
                    p.status === PackageStatus.PENDING 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {p.status}
                  </span>
                  <ArrowRight className="text-slate-200 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={20} />
                </div>
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