import React from 'react';
import { Package as PackageType, User, PackageStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Map, ShieldCheck, Activity } from 'lucide-react';

interface Props {
  packages: PackageType[];
  couriers: User[];
}

const SupervisorView: React.FC<Props> = ({ packages, couriers }) => {
  const stats = [
    { label: 'Koeriers', value: couriers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pakketten', value: packages.length, icon: Map, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Privacy Score', value: '100%', icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Efficiency', value: '92%', icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' }
  ];

  const chartData = [
    { name: '10:00', v: 4 },
    { name: '11:00', v: 12 },
    { name: '12:00', v: 25 },
    { name: '13:00', v: 18 },
    { name: '14:00', v: 32 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icon size={20} /></div>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-xl mb-6">Bezorgvolume (Real-time)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#cbd5e1'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="v" radius={[8, 8, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={i === 4 ? '#2563eb' : '#e2e8f0'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-black text-xl mb-6">Koeriers</h3>
          <div className="space-y-4">
            {couriers.map(c => (
              <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-slate-400 border border-slate-200">{c.name[0]}</div>
                  <div>
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{c.status}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${c.status === 'BESCHIKBAAR' ? 'bg-green-500' : 'bg-blue-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;