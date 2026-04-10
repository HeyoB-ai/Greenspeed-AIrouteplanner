import React from 'react';
import { ShieldCheck, LogOut, Shield } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  onLogout: () => void;
  hideMobileNav?: boolean;
  extraHeaderContent?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  userName,
  userRole,
  onLogout,
  hideMobileNav = false,
  extraHeaderContent,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!hideMobileNav && (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <ShieldCheck className="text-white w-6 h-6" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">Greenspeed</h1>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">AI Route Planner</p>
              </div>
            </div>

            {/* Right side: extra content + user + logout */}
            <div className="flex items-center space-x-4">
              {extraHeaderContent}
              <div className="h-8 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900 leading-none">{userName}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{userRole}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
                  aria-label="Uitloggen"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 max-w-7xl mx-auto w-full ${hideMobileNav ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}`}>
        {children}
      </main>

      {!hideMobileNav && (
        <footer className="py-12 text-center text-slate-400 text-xs font-medium">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Shield size={14} className="text-green-500" />
            <span>AVG-Compliant &amp; Real-time Cloud Persistence</span>
          </div>
          <p>© 2025 Greenspeed. Alle data is E2E geëncrypteerd.</p>
        </footer>
      )}
    </div>
  );
};

export default Layout;
