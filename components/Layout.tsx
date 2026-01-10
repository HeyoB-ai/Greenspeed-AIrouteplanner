import React from 'react';
import { UserRole } from '../types';
import { ShieldCheck, LogOut, LayoutDashboard, Truck, Package, Shield, Bell } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeRole: UserRole;
  userName: string;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeRole, userName, onLogout, onSwitchRole }) => {
  const navItems = [
    { id: UserRole.PHARMACY, label: 'Apotheek', icon: Package },
    { id: UserRole.COURIER, label: 'Koerier', icon: Truck },
    { id: UserRole.SUPERVISOR, label: 'Beheer', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">MedRoute</h1>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Privacy Secured</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSwitchRole(item.id)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeRole === item.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
             <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors relative">
               <Bell size={20} />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
             <div className="h-8 w-px bg-slate-200"></div>
             <div className="flex items-center space-x-3">
               <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-slate-900 leading-none">{userName}</p>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{activeRole}</p>
               </div>
               <button 
                 onClick={onLogout}
                 className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
               >
                 <LogOut size={20} />
               </button>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] glass rounded-3xl p-2 flex justify-between items-center shadow-2xl z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSwitchRole(item.id)}
            className={`flex flex-col items-center flex-1 py-3 rounded-2xl transition-all ${
              activeRole === item.id ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-bold mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
      
      <footer className="py-12 text-center text-slate-400 text-xs font-medium">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Shield size={14} className="text-green-500" />
          <span>AVG-Compliant & E2E Encrypted</span>
        </div>
        <p>© 2024 MedRoute Protocol. Alle data is lokaal geëncrypteerd.</p>
      </footer>
      <div className="h-24 md:hidden" />
    </div>
  );
};

export default Layout;