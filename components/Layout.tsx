import React from 'react';
import { UserRole } from '../types';
import { ShieldCheck, LogOut, LayoutDashboard, Truck, Package, HardDrive, Bell } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeRole: UserRole;
  userName: string;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeRole, userName, onLogout, onSwitchRole }) => {
  const navigation = [
    { name: 'Apotheek', role: UserRole.PHARMACY, icon: Package },
    { name: 'Koerier', role: UserRole.COURIER, icon: Truck },
    { name: 'Supervisor', role: UserRole.SUPERVISOR, icon: LayoutDashboard },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FBFF]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4 no-select group cursor-pointer">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-xl shadow-blue-200 group-hover:scale-105 transition-transform">
              <ShieldCheck className="text-white h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight text-slate-900 leading-none">MedRoute</span>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Privacy Secured</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-1.5 bg-slate-100/80 p-1.5 rounded-2xl">
            {navigation.map((item) => (
              <button
                key={item.role}
                onClick={() => onSwitchRole(item.role)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeRole === item.role
                    ? 'bg-white text-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.08)] scale-100'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                }`}
              >
                <item.icon size={18} className={activeRole === item.role ? 'animate-pulse' : ''} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <button className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors relative">
               <Bell size={20} />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

            <div className="hidden sm:flex items-center space-x-3 pl-2">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900 leading-tight">{userName}</span>
                <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest">{activeRole}</span>
              </div>
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100">
                {userName[0]}
              </div>
            </div>

            <button 
              onClick={onLogout}
              className="ml-2 p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Uitloggen"
            >
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 md:p-10">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] bg-white/90 backdrop-blur-2xl border border-slate-200/50 px-8 py-4 flex justify-between items-center z-50 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
        {navigation.map((item) => (
          <button
            key={item.role}
            onClick={() => onSwitchRole(item.role)}
            className={`flex flex-col items-center space-y-1.5 transition-all ${
              activeRole === item.role ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <item.icon size={26} strokeWidth={activeRole === item.role ? 2.5 : 2} />
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.name}</span>
          </button>
        ))}
      </nav>

      <footer className="hidden md:block py-10 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <HardDrive size={14} className="text-green-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">E2E Geëncrypteerde Opslag</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-slate-400">© 2024 MedRoute Protocol • AVG/GDPR Compliant • Privacy by Design</p>
        </div>
      </footer>
      
      <div className="h-28 md:hidden" />
    </div>
  );
};

export default Layout;