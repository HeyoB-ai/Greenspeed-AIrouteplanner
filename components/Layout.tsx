import React from 'react';
import {
  LogOut, Shield, Package, Truck, LayoutDashboard, Search
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  onLogout: () => void;
  hideMobileNav?: boolean;
  extraHeaderContent?: React.ReactNode;
}

const NAV_ITEMS: Record<string, { icon: React.ElementType; label: string }[]> = {
  SUPERUSER:  [{ icon: LayoutDashboard, label: 'Dashboard' }],
  ADMIN:      [{ icon: Package,         label: 'Pakketten' }],
  APOTHEEK:   [{ icon: Package,         label: 'Pakketten' }],
  KOERIER:    [{ icon: Truck,           label: 'Mijn Rit'  }],
  SUPERVISOR: [{ icon: LayoutDashboard, label: 'Logboek'   }],
  PATIENT:    [{ icon: Search,          label: 'Traceren'  }],
};

const ROLE_LABELS: Record<string, string> = {
  SUPERUSER:  'Superuser',
  ADMIN:      'Admin',
  APOTHEEK:   'Apotheek',
  KOERIER:    'Koerier',
  SUPERVISOR: 'Supervisor',
  PATIENT:    'Patiënt',
};

const Layout: React.FC<LayoutProps> = ({
  children,
  userName,
  userRole,
  onLogout,
  hideMobileNav = false,
  extraHeaderContent,
}) => {
  const navItems = NAV_ITEMS[userRole] ?? [];
  const roleLabel = ROLE_LABELS[userRole] ?? userRole;

  if (hideMobileNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh bg-[#f7f9fb]">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen bg-white overflow-y-auto z-30"
        style={{ boxShadow: '4px 0 24px rgba(25,28,30,0.04)' }}>

        {/* Branding */}
        <div className="px-6 py-6">
          <img src="/greenspeed-logo.svg" alt="Greenspeed" className="h-10 w-auto" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors ${
                i === 0 ? 'text-[#006b5a]' : 'text-[#3d4945]'
              }`}
              style={i === 0 ? { background: 'linear-gradient(135deg, rgba(0,107,90,0.08), rgba(72,194,169,0.08))' } : {}}
            >
              <item.icon size={18} className="shrink-0" />
              <span className={`text-sm ${i === 0 ? 'font-display font-bold' : 'font-body'}`}>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-5 space-y-3">
          <div className="px-2">
            <p className="text-sm font-display font-black text-[#191c1e] truncate">{userName}</p>
            <p className="text-[10px] font-body text-[#3d4945] uppercase tracking-widest mt-0.5">{roleLabel}</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-xl text-sm font-body text-[#3d4945] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={16} />
            <span>Uitloggen</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="sticky top-0 z-40 h-14 flex items-center px-4 lg:px-6 gap-3"
          style={{ background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>

          {/* Logo: mobile only */}
          <div className="flex items-center lg:hidden shrink-0">
            <img src="/greenspeed-logo.svg" alt="Greenspeed" className="h-8 w-auto" />
          </div>

          {/* Extra content */}
          <div className="flex-1 flex items-center justify-end lg:justify-start gap-2 min-w-0">
            {extraHeaderContent}
          </div>

          {/* User + logout: mobile only */}
          <div className="flex items-center gap-2 lg:hidden shrink-0">
            <div className="text-right hidden xs:block">
              <p className="text-[11px] font-display font-black text-[#191c1e] leading-none truncate max-w-[96px]">{userName}</p>
              <p className="text-[9px] font-body text-[#3d4945] uppercase tracking-tighter">{roleLabel}</p>
            </div>
            <button
              onClick={onLogout}
              aria-label="Uitloggen"
              className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-8 max-w-6xl mx-auto w-full touch-pan-y">
          {children}
        </main>

        {/* Footer: desktop only */}
        <footer className="hidden lg:block py-8 text-center text-[#3d4945]/60 text-xs">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Shield size={13} className="text-[#006b5a]" />
            <span>AVG-Compliant &amp; Real-time Cloud Persistence</span>
          </div>
          <p>© 2025 Greenspeed. Alle data is E2E geëncrypteerd.</p>
        </footer>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe flex items-stretch"
        style={{ background: 'rgba(247,249,251,0.80)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 -4px 24px rgba(25,28,30,0.04)' }}>
        {navItems.slice(0, 3).map((item, i) => (
          <div
            key={item.label}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 ${
              i === 0 ? 'text-[#006b5a]' : 'text-[#3d4945]/60'
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-display font-bold leading-none">{item.label}</span>
          </div>
        ))}
        <button
          onClick={onLogout}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-[#3d4945]/60 hover:text-red-500 active:text-red-600 transition-colors"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-display font-bold leading-none">Uitloggen</span>
        </button>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="lg:hidden h-16 pb-safe" aria-hidden />
    </div>
  );
};

export default Layout;
