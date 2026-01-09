
import React from 'react';
import { Users, Truck, Package, TrendingUp, Map, AlertCircle, RefreshCcw } from 'lucide-react';
import { Package as PackageType, PackageStatus, CourierStatus, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SupervisorViewProps {
  packages: PackageType[];
  couriers: User[];
  onOptimizeRoutes: () => void;
}

const SupervisorView: React.FC<SupervisorViewProps> = ({ packages, couriers, onOptimizeRoutes }) => {
  const activeCouriers = couriers.filter(c => c.status !== CourierStatus.OFFLINE);
  const pendingPackages = packages.filter(p => p.status === PackageStatus.PENDING || p.status === PackageStatus.ASSIGNED);
  
  const chartData = [
    { name: 'Ma', deliveries: 45 },
    { name: 'Di', deliveries: 52 },
    { name: 'Wo', deliveries: 38 },
    { name: 'Do', deliveries: 65 },
    { name: 'Vr', deliveries: 48 },
    { name: 'Za', deliveries: 22 },
    { name: 'Zo', deliveries: 12 },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Actieve Koeriers', value: activeCouriers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Zendingen Vandaag', value: packages.length, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Bezorgd (Vandaag)', value: packages.filter(p => p.status === PackageStatus.DELIVERED).length, icon: Truck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Efficiëntie', value: '94%', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-bold dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Placeholder / Visualization */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg dark:text-white flex items-center space-x-2">
              <Map size={20} className="text-slate-400" />
              <span>Regio Overzicht - Amsterdam Oost</span>
            </h3>
            <button 
              onClick={onOptimizeRoutes}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 hover:bg-blue-500 transition-all active:scale-95"
            >
              <RefreshCcw size={16} />
              <span>AI Route Optimalisatie</span>
            </button>
          </div>
          
          <div className="flex-grow bg-slate-100 dark:bg-slate-900 rounded-xl relative overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
            {/* Visual simulation of routes */}
            <svg viewBox="0 0 100 100" className="w-full h-full opacity-40">
              <path d="M10,10 L30,40 L60,20 L80,70" stroke="blue" fill="transparent" strokeWidth="0.5" strokeDasharray="2,2" />
              <path d="M20,80 L50,60 L90,90" stroke="green" fill="transparent" strokeWidth="0.5" strokeDasharray="2,2" />
              <circle cx="10" cy="10" r="1" fill="blue" />
              <circle cx="30" cy="40" r="1" fill="blue" />
              <circle cx="80" cy="70" r="1" fill="blue" />
              <circle cx="20" cy="80" r="1" fill="green" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg text-center">
                <p className="font-bold dark:text-white mb-1">Dynamische Routekaart</p>
                <p className="text-xs text-slate-500">Toont live-posities van {activeCouriers.length} koeriers en clusters.</p>
              </div>
            </div>
            
            {/* Floating marker simulation */}
            <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse"></div>
            <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
          </div>
        </div>

        {/* Deliveries Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm h-full">
          <h3 className="font-bold text-lg dark:text-white mb-6">Volume per Dag</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="deliveries" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 3 ? '#2563eb' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Couriers List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-bold dark:text-white">Live Koerier Status</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {activeCouriers.map(c => {
              const assigned = packages.filter(p => p.courierId === c.id && p.status !== PackageStatus.DELIVERED).length;
              return (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold dark:text-white">{c.name}</p>
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${c.status === CourierStatus.ON_ROUTE ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                        <span className="text-[10px] uppercase font-bold text-slate-500">{c.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold dark:text-white">{assigned} stops</p>
                    <p className="text-xs text-slate-500">Route volgend: 12:45</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-bold dark:text-white">Systeem Meldingen</h3>
          </div>
          <div className="p-2 space-y-2">
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 flex items-start space-x-3">
              <AlertCircle className="text-orange-500 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-bold text-orange-900">Hoge druk in Postcodegebied 1011</p>
                <p className="text-xs text-orange-700">12 zendingen wachten op toewijzing. Advies: Extra koerier inzetten.</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start space-x-3">
              <RefreshCcw className="text-blue-500 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-bold text-blue-900">Route herberekening voltooid</p>
                <p className="text-xs text-blue-700">AI heeft 4 routes geoptimaliseerd voor betere reistijd (-12%).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;
