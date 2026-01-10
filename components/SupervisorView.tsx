import React from 'react';
import { Package as PackageType, User } from '../types';
import { Users, Map, ShieldCheck, Activity, TrendingUp, MoreHorizontal, ChevronRight } from 'lucide-react';

interface Props {
  packages: PackageType[];
  couriers: User[];
}

const SupervisorView: React.FC<Props> = ({ packages, couriers }) => {
  const stats = [
    { label: 'Actieve Koeriers', value: couriers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', change: '+2' },
    { label: 'Open Pakketten', value: packages.length, icon: Map, color: 'text-indigo-600', bg: 'bg-indigo-50', change: '-4' },
    { label: 'Privacy Integriteit', value: '100%', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', change: 'MAX' },
    { label: 'Systeem Load', value: '12ms', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', change: 'LOW' }
  ];

  const data = [30, 45, 25, 60, 40, 85, 65, 90, 70, 80];
  const max = Math.max(...data);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-7 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className={`w-12 h-12 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center shadow-inner`}><s.icon size={24} strokeWidth={2.5} /></div>
              <span className="text-[10px] font-black px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg tracking-widest">{s.change}</span>
            </div>
            <p className="text-3xl font-black text-slate-900 mb-1">{s.value}</p>
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-black text-2xl text-slate-900 tracking-tight">Bezorgvolume & Performance</h3>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mt-1">Data: Laatste 24 uur • Real-time</p>
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><MoreHorizontal className="text-slate-400" /></button>
          </div>
          
          <div className="h-72 w-full flex items-end justify-between space-x-3 px-2">
            {data.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer">
                <div 
                  className="w-full bg-slate-100/70 rounded-2xl transition-all duration-500 group-hover:bg-blue-600 group-hover:shadow-2xl group-hover:shadow-blue-200 relative overflow-hidden"
                  style={{ height: `${(v / max) * 100}%` }}
                >
                   <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
                </div>
                <span className="text-[9px] font-black text-slate-400 mt-5 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">{8 + i}:00</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-2xl text-slate-900 tracking-tight">Koerier Fleet</h3>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">Live</span>
          </div>
          <div className="space-y-4">
            {couriers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-blue-100 hover:bg-blue-50/30 transition-all cursor-pointer group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-200 group-hover:text-blue-600 group-hover:border-blue-200 group-hover:shadow-sm transition-all relative">
                    {c.name[0]}
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-4 border-white ${c.status === 'BESCHIKBAAR' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  </div>
                  <div>
                    <p className="font-black text-md leading-none text-slate-900 group-hover:text-blue-700 transition-colors">{c.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{c.status}</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-400 transition-colors" size={18} />
              </div>
            ))}
          </div>
          <button className="w-full mt-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-extrabold text-sm hover:bg-slate-800 hover:shadow-xl transition-all active:scale-[0.98]">
            Beheer Alle Koeriers
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;