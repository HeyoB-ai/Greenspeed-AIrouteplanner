import React from 'react';
import {
  ShieldCheck, LogOut, Shield, Package, Truck, LayoutDashboard,
  Search, Scan, Map, Building2, Users, CreditCard, Download
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  onLogout: () => void;
  hideMobileNav?: boolean;
  extraHeaderContent?: React.ReactNode;
}

// Rol-specifieke nav-items (visuele context, geen sub-routing)
const NAV_ITEMS: Record<string, { icon: React.ElementType; label: string }[]> = {
  SUPERUSER:  [{ icon: LayoutDashboard, label: 'Dashboard'   }, { icon: Building2, label: 'Apotheken' }, { icon: Users,         label: 'Gebruikers' }],
  ADMIN:      [{ icon: Package,         label: 'Pakketten'   }, { icon: Map,        label: 'Route'     }, { icon: Download,      label: 'Rapporten'  }],
  APOTHEEK:   [{ icon: Package,         label: 'Pakketten'   }, { icon: Scan,       label: 'Scanner'   }],
  KOERIER:    [{ icon: Truck,           label: 'Mijn Rit'    }, { icon: Map,        label: 'Navigatie' }],
  SUPERVISOR: [{ icon: LayoutDashboard, label: 'Logboek'     }, { icon: CreditCard, label: 'Facturatie'}],
  PATIENT:    [{ icon: Search,          label: 'Traceren'    }],
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

  // Scanner is fullscreen — geen layout chrome nodig
  if (hideMobileNav) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh bg-slate-50">

      {/* ── Sidebar (alleen desktop) ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen bg-white border-r border-slate-100 overflow-y-auto z-30">

        {/* Branding */}
        <div className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-none">Greenspeed</p>
              <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">AI Route Planner</p>
            </div>
          </div>
        </div>

        {/* Nav-items (visuele rolcontext) */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors ${
                i === 0
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-400'
              }`}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="text-sm font-bold">{item.label}</span>
            </div>
          ))}
        </nav>

        {/* Gebruiker + uitloggen (onderaan) */}
        <div className="px-4 py-5 border-t border-slate-100 space-y-3">
          <div className="px-2">
            <p className="text-sm font-black text-slate-900 truncate">{userName}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{roleLabel}</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={16} />
            <span>Uitloggen</span>
          </button>
        </div>
      </aside>

      {/* ── Hoofd-content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header (sticky) */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 h-14 flex items-center px-4 lg:px-6 gap-3">

          {/* Logo: alleen mobiel zichtbaar */}
          <div className="flex items-center space-x-2 lg:hidden shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className="text-sm font-black text-slate-900">Greenspeed</span>
          </div>

          {/* Extra content (cloud-status, apotheek-picker) */}
          <div className="flex-1 flex items-center justify-end lg:justify-start gap-2 min-w-0">
            {extraHeaderContent}
          </div>

          {/* Gebruiker + logout: alleen mobiel (desktop via sidebar) */}
          <div className="flex items-center gap-2 lg:hidden shrink-0">
            <div className="text-right hidden xs:block">
              <p className="text-[11px] font-black text-slate-900 leading-none truncate max-w-[96px]">{userName}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{roleLabel}</p>
            </div>
            <button
              onClick={onLogout}
              aria-label="Uitloggen"
              className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Pagina-inhoud */}
        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-8 max-w-6xl mx-auto w-full">
          {children}
        </main>

        {/* Footer: alleen desktop */}
        <footer className="hidden lg:block py-8 text-center text-slate-400 text-xs border-t border-slate-100">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <Shield size={13} className="text-green-500" />
            <span>AVG-Compliant &amp; Real-time Cloud Persistence</span>
          </div>
          <p>© 2025 Greenspeed. Alle data is E2E geëncrypteerd.</p>
        </footer>
      </div>

      {/* ── Bottom navigation (alleen mobiel) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-100 pb-safe flex items-stretch">
        {navItems.slice(0, 3).map((item, i) => (
          <div
            key={item.label}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 ${
              i === 0 ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-bold leading-none">{item.label}</span>
          </div>
        ))}
        <button
          onClick={onLogout}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-slate-400 hover:text-red-500 active:text-red-600 transition-colors"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-bold leading-none">Uitloggen</span>
        </button>
      </nav>

      {/* Ruimte voor mobile bottom nav */}
      <div className="lg:hidden h-16 pb-safe" aria-hidden />
    </div>
  );
};

export default Layout;
