import React from 'react';
import { Package as PackageType, User } from '../types';
import { Users, Package, Shield, Activity, ChevronRight, TrendingUp } from 'lucide-react';

interface Props {
  packages: PackageType[];
  couriers: User[];
}

const SupervisorView: React.FC<Props> = ({ packages, couriers }) => {
  const stats = [
    { label: 'Pakketten', val: packages.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Koeriers', val: couriers.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Privacy Score', val: '100%', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Performance', val: 'Optimal', icon: Activity, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const volumeData = [40, 65, 30, 85, 45, 90, 60, 75, 50, 80];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-1000">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-6 rounded-4xl border border-slate-200 shadow-sm">
            <div className={`w-12 h-12 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center mb-4`}>
              <s.icon size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none">{s.val}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-4xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900">Bezorgvolume</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live overzicht per uur</p>
            </div>
            <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase">
              <TrendingUp size={14} />
              <span>+12% vs Gisteren</span>
            </div>
          </div>
          
          <div className="h-64 flex items-end justify-between space-x-2 px-2">
            {volumeData.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <div 
                  className="w-full bg-slate-100 rounded-xl group-hover:bg-blue-600 transition-all duration-500 relative overflow-hidden" 
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent"></div>
                </div>
                <span className="text-[9px] font-bold text-slate-400 mt-4">{8 + i}:00</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-4xl border border-slate-200 shadow-sm p-8">
          <h3 className="text-xl font-black text-slate-900 mb-6">Actieve Koeriers</h3>
          <div className="space-y-4">
            {couriers.map(c => (
              <div key={c.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-transparent hover:border-blue-100 hover:bg-white transition-all cursor-pointer">
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
          <button className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200">
            Vloot Beheren
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;