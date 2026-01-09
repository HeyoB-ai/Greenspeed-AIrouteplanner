
import React from 'react';
import { UserRole } from '../types';
import { ShieldCheck, LogOut, LayoutDashboard, Truck, Package } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeRole: UserRole;
  userName: string;
  onLogout: () => void;
  onSwitchRole: (role: UserRole) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeRole, userName, onLogout, onSwitchRole }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ShieldCheck className="text-white h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight dark:text-white">MedRoute</span>
          </div>

          <nav className="hidden md:flex space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button 
              onClick={() => onSwitchRole(UserRole.PHARMACY)}
              className={`flex items-center space-x-1 ${activeRole === UserRole.PHARMACY ? 'text-blue-600 font-bold' : ''}`}
            >
              <Package size={18} />
              <span>Apotheek</span>
            </button>
            <button 
              onClick={() => onSwitchRole(UserRole.COURIER)}
              className={`flex items-center space-x-1 ${activeRole === UserRole.COURIER ? 'text-blue-600 font-bold' : ''}`}
            >
              <Truck size={18} />
              <span>Koerier</span>
            </button>
            <button 
              onClick={() => onSwitchRole(UserRole.SUPERVISOR)}
              className={`flex items-center space-x-1 ${activeRole === UserRole.SUPERVISOR ? 'text-blue-600 font-bold' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Supervisor</span>
            </button>
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold dark:text-white">{userName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{activeRole.toLowerCase()}</p>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <LogOut className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Mobile Role Switcher (for demo purpose) */}
      <footer className="md:hidden bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 fixed bottom-0 w-full z-40">
        <div className="grid grid-cols-3 h-16">
          <button 
            onClick={() => onSwitchRole(UserRole.PHARMACY)}
            className={`flex flex-col items-center justify-center space-y-1 ${activeRole === UserRole.PHARMACY ? 'text-blue-600' : 'text-slate-500'}`}
          >
            <Package size={20} />
            <span className="text-[10px] font-bold">Apotheek</span>
          </button>
          <button 
            onClick={() => onSwitchRole(UserRole.COURIER)}
            className={`flex flex-col items-center justify-center space-y-1 ${activeRole === UserRole.COURIER ? 'text-blue-600' : 'text-slate-500'}`}
          >
            <Truck size={20} />
            <span className="text-[10px] font-bold">Koerier</span>
          </button>
          <button 
            onClick={() => onSwitchRole(UserRole.SUPERVISOR)}
            className={`flex flex-col items-center justify-center space-y-1 ${activeRole === UserRole.SUPERVISOR ? 'text-blue-600' : 'text-slate-500'}`}
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold">Supervisor</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
