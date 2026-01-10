import React from 'react';
import { UserRole } from '../types';
import { ShieldCheck, LogOut, LayoutDashboard, Truck, Package, HardDrive } from 'lucide-react';

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
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 no-select">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
              <ShieldCheck className="text-white h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tighter leading-none">MedRoute</span>
              <div className="flex items-center space-x-1 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Privacy Secured</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            {navigation.map((item) => (
              <button
                key={item.role}
                onClick={() => onSwitchRole(item.role)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeRole === item.role
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <item.icon size={16} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full">
              <HardDrive size={12} className="text-green-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase">Lokale Kluis Actief</span>
            </div>
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs font-black text-slate-900 leading-none">{userName}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeRole}</span>
            </div>
            <button 
              onClick={onLogout}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navigation.map((item) => (
          <button
            key={item.role}
            onClick={() => onSwitchRole(item.role)}
            className={`flex flex-col items-center space-y-1 ${
              activeRole === item.role ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <item.icon size={24} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name}</span>
          </button>
        ))}
      </nav>

      <footer className="hidden md:block py-8 text-center text-slate-400">
        <p className="text-xs font-medium">© 2024 MedRoute Protocol. Alle data is lokaal geëncrypt en AVG-compliant.</p>
      </footer>
      
      <div className="h-20 md:hidden" />
    </div>
  );
};

export default Layout;