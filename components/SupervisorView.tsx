import React from 'react';
import { Package as PackageType, User } from '../types';
import { Users, Map, ShieldCheck, Activity, TrendingUp } from 'lucide-react';

interface Props {
  packages: PackageType[];
  couriers: User[];
}

const SupervisorView: React.FC<Props> = ({ packages, couriers }) => {
  const stats = [
    { label: 'Koeriers', value: couriers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pakketten', value: packages.length, icon: Map, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Privacy Score', value: '100%', icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Efficiency', value: '94%', icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' }
  ];

  // Dummy data voor de custom chart
  const data = [30, 45, 25, 60, 40, 85, 65];
  const max = Math.max(...data);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icon size={20} /></div>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-black text-xl">Bezorgvolume</h3>
              <p className="text-sm text-slate-400 font-medium">Real-time activiteit van de afgelopen 7 uur</p>
            </div>
            <div className="flex items-center space-x-1 text-green-500 bg-green-50 px-3 py-1 rounded-full">
              <TrendingUp size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">+12%</span>
            </div>
          </div>
          
          <div className="h-64 w-full flex items-end justify-between space-x-2 px-2">
            {data.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group">
                <div 
                  className="w-full bg-slate-100 rounded-t-xl transition-all duration-500 group-hover:bg-blue-600 group-hover:shadow-lg group-hover:shadow-blue-200 relative"
                  style={{ height: `${(v / max) * 100}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                    {v}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-tighter">{10 + i}:00</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-xl mb-6">Status Koeriers</h3>
          <div className="space-y-4">
            {couriers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 transition-all cursor-default group">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-slate-400 border border-slate-200 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight">{c.name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{c.status}</p>
                  </div>
                </div>
                <div className={`w-2.5 h-2.5 rounded-full ring-4 ring-white ${c.status === 'BESCHIKBAAR' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-blue-500'}`} />
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors active:scale-95">
            Beheer Alle Koeriers
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;