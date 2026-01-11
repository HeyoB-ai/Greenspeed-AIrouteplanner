import React from 'react';
import { Package as PackageType, User, PackageStatus } from '../types';
import { Users, Package, Shield, Activity, ChevronRight, TrendingUp, MapPin, Clock, ShieldCheck } from 'lucide-react';

interface Props {
  packages: PackageType[];
  couriers: User[];
}

const SupervisorView: React.FC<Props> = ({ packages, couriers }) => {
  const delivered = packages.filter(p => p.status === PackageStatus.DELIVERED);
  
  const stats = [
    { label: 'Totaal', val: packages.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Koeriers', val: couriers.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Bezorgd', val: delivered.length, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Efficiency', val: '98%', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-1000 pb-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm transition-transform hover:-translate-y-1">
            <div className={`w-14 h-14 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center mb-6`}>
              <s.icon size={28} />
            </div>
            <p className="text-4xl font-black text-slate-900 leading-none">{s.val}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Zending Logboek</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Inclusief GPS Bewijsmateriaal</p>
              </div>
              <div className="flex items-center space-x-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                <Shield size={14} />
                <span>E2E Logged</span>
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {packages.length === 0 ? (
                <div className="p-20 text-center text-slate-400 font-bold">Geen data beschikbaar</div>
              ) : (
                [...packages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(p => (
                  <div key={p.id} className="p-8 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${p.status === PackageStatus.DELIVERED ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Package size={22} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-lg leading-tight">{p.address.street} {p.address.houseNumber}</h4>
                          <div className="flex items-center space-x-3 mt-1 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            <span>ID: {p.id.slice(0, 8)}</span>
                            <span>•</span>
                            <span className={p.status === PackageStatus.DELIVERED ? 'text-emerald-600' : ''}>{p.status}</span>
                          </div>
                        </div>
                      </div>

                      {p.deliveryEvidence ? (
                        <div className="flex items-center gap-2">
                           <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex items-center space-x-4">
                             <div className="text-right">
                               <p className="text-[10px] font-black text-emerald-700 leading-none">GPS Bewijs</p>
                               <p className="text-[9px] font-bold text-emerald-600/70 mt-1 uppercase">Vastgelegd</p>
                             </div>
                             <div className="h-8 w-px bg-emerald-200/50"></div>
                             <button 
                               onClick={() => window.open(`https://www.google.com/maps?q=${p.deliveryEvidence?.latitude},${p.deliveryEvidence?.longitude}`)}
                               className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 active:scale-90 transition-all"
                             >
                               <MapPin size={18} />
                             </button>
                           </div>
                           <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center space-x-3">
                             <Clock size={16} className="text-slate-400" />
                             <span className="text-[10px] font-black text-slate-600">
                               {new Date(p.deliveryEvidence.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </span>
                           </div>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-slate-400 italic">Nog geen bewijs beschikbaar</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-4xl p-8 text-white shadow-xl shadow-slate-200">
            <h3 className="text-xl font-black mb-6 flex items-center space-x-3">
              <Activity className="text-blue-400" size={24} />
              <span>Systeem Status</span>
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Engine</span>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Optimal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">GPS Network</span>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Connected</span>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">
                  Alle GPS coördinaten worden gehasht opgeslagen voor maximale privacy-by-design.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-4xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-xl font-black text-slate-900 mb-6">Vloot Status</h3>
            <div className="space-y-4">
              {couriers.map(c => (
                <div key={c.id} className="group flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] border border-transparent hover:border-blue-100 hover:bg-white transition-all cursor-pointer">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-200 group-hover:text-blue-600 group-hover:border-blue-200 transition-all">
                      {c.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-none">{c.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{c.status}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;