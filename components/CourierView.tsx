
import React, { useState } from 'react';
import { Truck, MapPin, Navigation, CheckCircle, Package, Power, Pause, Play, ChevronRight, CornerDownRight } from 'lucide-react';
import { Package as PackageType, PackageStatus, CourierStatus, User } from '../types';

interface CourierViewProps {
  user: User;
  packages: PackageType[];
  onStatusChange: (status: CourierStatus) => void;
  onUpdatePackage: (id: string, status: PackageStatus) => void;
}

const CourierView: React.FC<CourierViewProps> = ({ user, packages, onStatusChange, onUpdatePackage }) => {
  const [activeTab, setActiveTab] = useState<'route' | 'history'>('route');
  
  const assignedPackages = packages.filter(p => p.courierId === user.id && p.status !== PackageStatus.DELIVERED);
  const completedToday = packages.filter(p => p.courierId === user.id && p.status === PackageStatus.DELIVERED);

  const toggleStatus = () => {
    if (user.status === CourierStatus.AVAILABLE || user.status === CourierStatus.ON_ROUTE) {
      onStatusChange(CourierStatus.OFFLINE);
    } else {
      onStatusChange(CourierStatus.AVAILABLE);
    }
  };

  const getStatusColor = () => {
    switch(user.status) {
      case CourierStatus.AVAILABLE: return 'bg-green-500';
      case CourierStatus.ON_ROUTE: return 'bg-blue-500';
      case CourierStatus.BREAK: return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-20">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold dark:text-white">{user.name}</p>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
              <span className="text-xs text-slate-500 uppercase font-bold tracking-tight">{user.status}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={toggleStatus}
          className={`p-3 rounded-xl transition-all ${
            user.status !== CourierStatus.OFFLINE 
              ? 'bg-red-50 text-red-600 hover:bg-red-100' 
              : 'bg-green-50 text-green-600 hover:bg-green-100'
          }`}
        >
          <Power size={20} />
        </button>
      </div>

      {/* Control Strip */}
      {user.status !== CourierStatus.OFFLINE && (
        <div className="flex space-x-2">
          <button 
            onClick={() => onStatusChange(user.status === CourierStatus.ON_ROUTE ? CourierStatus.AVAILABLE : CourierStatus.ON_ROUTE)}
            className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center space-x-2 font-bold transition-all ${
              user.status === CourierStatus.ON_ROUTE 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 dark:shadow-none' 
                : 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none'
            }`}
          >
            {user.status === CourierStatus.ON_ROUTE ? <Pause size={18} /> : <Play size={18} />}
            <span>{user.status === CourierStatus.ON_ROUTE ? 'Pauzeren' : 'Start Route'}</span>
          </button>
        </div>
      )}

      {/* Statistics Bar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 font-bold uppercase">To do</p>
          <p className="text-2xl font-bold dark:text-white">{assignedPackages.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 font-bold uppercase">Gereed</p>
          <p className="text-2xl font-bold dark:text-white">{completedToday.length}</p>
        </div>
      </div>

      {/* Main Area Tabs */}
      <div className="flex p-1 bg-slate-200 dark:bg-slate-700 rounded-xl">
        <button 
          onClick={() => setActiveTab('route')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'route' ? 'bg-white dark:bg-slate-800 shadow-sm dark:text-white' : 'text-slate-500'}`}
        >
          Actieve Route
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 shadow-sm dark:text-white' : 'text-slate-500'}`}
        >
          Geschiedenis
        </button>
      </div>

      {/* Route List */}
      <div className="space-y-3">
        {activeTab === 'route' ? (
          assignedPackages.length > 0 ? (
            assignedPackages.map((p, idx) => (
              <div 
                key={p.id} 
                className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border ${
                  idx === 0 ? 'border-blue-500 border-2' : 'border-slate-200 dark:border-slate-700'
                } shadow-sm relative overflow-hidden`}
              >
                {idx === 0 && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-tighter">
                    Volgende Stop
                  </div>
                )}
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-full mt-1 ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                    <MapPin size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg dark:text-white leading-tight">
                      {p.address.street} {p.address.houseNumber}
                    </h3>
                    <p className="text-slate-500 text-sm mb-4">{p.address.postalCode} {p.address.city}</p>
                    
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          const query = encodeURIComponent(`${p.address.street} ${p.address.houseNumber}, ${p.address.city}`);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                        }}
                        className="flex-1 bg-slate-100 dark:bg-slate-700 dark:text-white py-3 rounded-xl flex items-center justify-center space-x-2 font-bold hover:bg-slate-200 transition-colors"
                      >
                        <Navigation size={18} />
                        <span>Navigeren</span>
                      </button>
                      <button 
                        onClick={() => onUpdatePackage(p.id, PackageStatus.DELIVERED)}
                        className="flex-1 bg-green-600 text-white py-3 rounded-xl flex items-center justify-center space-x-2 font-bold hover:bg-green-500 transition-colors shadow-lg shadow-green-100 dark:shadow-none"
                      >
                        <CheckCircle size={18} />
                        <span>Afgerond</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
              <Truck size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">Geen zendingen toegewezen.</p>
              <p className="text-xs">Wacht op planning of scan pakketten bij de apotheek.</p>
            </div>
          )
        ) : (
          completedToday.map(p => (
            <div key={p.id} className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl flex items-center justify-between opacity-80">
              <div className="flex items-center space-x-3">
                <CheckCircle size={20} className="text-green-500" />
                <div>
                  <p className="text-sm font-bold dark:text-white">{p.address.street} {p.address.houseNumber}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{p.address.postalCode}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400">14:45</span>
            </div>
          ))
        )}
      </div>

      {/* Floating Action for Hand-over (Privacy by Design example) */}
      {assignedPackages.length > 0 && (
        <button className="fixed bottom-24 right-4 bg-slate-800 text-white p-4 rounded-2xl shadow-2xl flex items-center space-x-2 animate-bounce hover:animate-none transition-all active:scale-95 border border-white/20">
          <CornerDownRight size={20} />
          <span className="text-sm font-bold">Pakket Overdragen</span>
        </button>
      )}
    </div>
  );
};

export default CourierView;
