import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, Package, PackageStatus, Address, CourierStatus, DeliveryEvidence, Pharmacy, AuthSession, AuthUser } from './types';
import Layout from './components/Layout';
import LoginScreen from './components/LoginScreen';
import PharmacyView from './components/PharmacyView';
import AdminView from './components/AdminView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import PatientView from './components/PatientView';
import Scanner from './Scanner';
import ChatBot from './components/ChatBot';
import { optimizeRoute } from './services/geminiService';
import { getSession, logout } from './services/authService';
import { db, supabase } from './services/supabaseService';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showPatientView, setShowPatientView] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  // Superuser-specific: can pick which pharmacy to act as
  const [superuserPharmacyId, setSuperuserPharmacyId] = useState<string>('');

  const hasCloudConfig = !!supabase;
  const role = session?.user.role ?? null;

  // Restore session on mount
  useEffect(() => {
    const existing = getSession();
    if (existing) setSession(existing);
  }, []);

  // Load data once session exists (or for patient view)
  useEffect(() => {
    if (!session && !showPatientView) return;
    const loadData = async () => {
      setIsSyncing(true);
      const [pkgs, pharms] = await Promise.all([db.fetchPackages(), db.fetchPharmacies()]);
      setPackages(pkgs);
      setPharmacies(pharms);
      if (pharms.length > 0 && !superuserPharmacyId) {
        setSuperuserPharmacyId(pharms[0].id);
      }
      setIsSyncing(false);
    };
    loadData();
  }, [session, showPatientView]);

  // Derive the "current pharmacy" based on role
  const currentPharmacy: Pharmacy = useMemo(() => {
    if (!session) return { id: 'ph-1', name: 'Apotheek de Kroon' };
    if (role === UserRole.SUPERUSER) {
      return pharmacies.find(p => p.id === superuserPharmacyId) || pharmacies[0] || { id: 'ph-1', name: 'Apotheek de Kroon' };
    }
    if (session.user.pharmacyId) {
      return pharmacies.find(p => p.id === session.user.pharmacyId) || { id: session.user.pharmacyId, name: 'Mijn Apotheek' };
    }
    return pharmacies[0] || { id: 'ph-1', name: 'Apotheek de Kroon' };
  }, [session, role, pharmacies, superuserPharmacyId]);

  // Package filter per role
  const visiblePackages = useMemo(() => {
    if (!session) return packages;
    switch (role) {
      case UserRole.SUPERUSER:
      case UserRole.SUPERVISOR:
        return packages;
      case UserRole.ADMIN:
      case UserRole.PHARMACY:
        return session.user.pharmacyId
          ? packages.filter(p => p.pharmacyId === session.user.pharmacyId)
          : packages;
      case UserRole.COURIER:
        return session.user.courierId
          ? packages.filter(p => p.courierId === session.user.courierId)
          : packages;
      default:
        return packages;
    }
  }, [packages, session, role]);

  const handleLogin = (user: AuthUser) => {
    setSession({ user, loggedInAt: new Date().toISOString() });
  };

  const handleLogout = async () => {
    if (confirm('Uitloggen?')) {
      logout();
      setSession(null);
      setPackages([]);
    }
  };

  const handleNewScan = useCallback(async (address: Address) => {
    const pkg: Package = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pharmacyId: currentPharmacy.id,
      pharmacyName: currentPharmacy.name,
      address,
      status: PackageStatus.PENDING,
      createdAt: new Date().toISOString(),
      priority: 3,
    };
    setPackages(prev => [pkg, ...prev]);
    await db.syncPackage(pkg);
  }, [currentPharmacy]);

  const handleOptimizeRoute = async (selectedIds: string[]) => {
    setIsOptimizing(true);
    const selectedPackages = packages.filter(p => selectedIds.includes(p.id));

    const stopsMap = new Map<string, string[]>();
    selectedPackages.forEach(p => {
      const key = `${p.address.street} ${p.address.houseNumber} ${p.address.postalCode}`.toLowerCase().trim();
      stopsMap.set(key, [...(stopsMap.get(key) || []), p.id]);
    });

    const uniqueStops = Array.from(stopsMap.entries()).map(([, ids]) => {
      const firstPkg = selectedPackages.find(p => p.id === ids[0])!;
      return { id: ids[0], ...firstPkg.address, packageCount: ids.length };
    });

    try {
      const optimizedReferenceIds = await optimizeRoute(uniqueStops);
      const updatedPackages = [...packages];
      const pkgsToSync: Package[] = [];

      selectedIds.forEach(id => {
        const idx = updatedPackages.findIndex(p => p.id === id);
        if (idx !== -1) updatedPackages[idx] = { ...updatedPackages[idx], orderIndex: undefined, displayIndex: undefined };
      });

      optimizedReferenceIds.forEach((refId, index) => {
        const key = Array.from(stopsMap.entries()).find(([, ids]) => ids.includes(refId))?.[0];
        if (key) {
          (stopsMap.get(key) || []).forEach(id => {
            const pkgIndex = updatedPackages.findIndex(p => p.id === id);
            if (pkgIndex !== -1) {
              const updatedPkg = { ...updatedPackages[pkgIndex], status: PackageStatus.ASSIGNED, orderIndex: index, displayIndex: index + 1 };
              updatedPackages[pkgIndex] = updatedPkg;
              pkgsToSync.push(updatedPkg);
            }
          });
        }
      });

      setPackages(updatedPackages);
      await db.syncMultiplePackages(pkgsToSync);
    } catch (err) {
      console.error('Route optimalisatie mislukt:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const updateMultipleStatus = async (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => {
    const pkgsToSync: Package[] = [];
    const newPackages = packages.map(p => {
      if (ids.includes(p.id)) {
        const updated = { ...p, status, deliveryEvidence: evidence, deliveredAt: evidence?.timestamp || p.deliveredAt };
        pkgsToSync.push(updated);
        return updated;
      }
      return p;
    });
    setPackages(newPackages);
    await db.syncMultiplePackages(pkgsToSync);
  };

  const handleAddPharmacy = async () => {
    const name = prompt('Naam van de nieuwe apotheek:');
    if (name) {
      const newPharm: Pharmacy = { id: `ph-${Date.now()}`, name };
      setPharmacies(prev => [...prev, newPharm]);
      setSuperuserPharmacyId(newPharm.id);
      await db.savePharmacy(newPharm);
    }
  };

  const copySQL = () => {
    const sql = `CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  "pharmacyId" TEXT,
  "pharmacyName" TEXT,
  address JSONB,
  status TEXT,
  "courierId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "deliveredAt" TIMESTAMPTZ,
  "deliveryEvidence" JSONB,
  priority INTEGER,
  "orderIndex" INTEGER,
  "displayIndex" INTEGER
);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON packages;
CREATE POLICY "Allow public access" ON packages FOR ALL USING (true);`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render: not logged in ────────────────────────────────────────
  if (!session && !showPatientView) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onGuestAccess={() => setShowPatientView(true)}
      />
    );
  }

  // ── Render: patient (no login) ───────────────────────────────────
  if (showPatientView) {
    return (
      <PatientView
        packages={packages}
        onBack={() => setShowPatientView(false)}
      />
    );
  }

  // ── Helpers for authenticated views ─────────────────────────────
  const syncIndicator = (
    <div className={`flex items-center space-x-2 px-3 py-1 border rounded-full transition-colors ${hasCloudConfig ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}>
      {isSyncing ? (
        <RefreshCw size={14} className="text-blue-500 animate-spin" />
      ) : hasCloudConfig ? (
        <Cloud size={14} className="text-emerald-500" />
      ) : (
        <CloudOff size={14} className="text-amber-500" />
      )}
      <span className={`text-[10px] font-black uppercase tracking-tighter ${hasCloudConfig ? 'text-slate-500' : 'text-amber-600'}`}>
        {isSyncing ? 'Synchroniseren...' : hasCloudConfig ? 'Cloud Actief' : 'Lokaal'}
      </span>
    </div>
  );

  // Superuser pharmacy picker (shown in header)
  const superuserPharmacyPicker = role === UserRole.SUPERUSER ? (
    <div className="flex items-center space-x-2">
      <select
        value={superuserPharmacyId}
        onChange={e => setSuperuserPharmacyId(e.target.value)}
        className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
      >
        {pharmacies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button
        onClick={handleAddPharmacy}
        className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-all"
      >
        + Nieuw
      </button>
    </div>
  ) : null;

  const extraHeader = (
    <div className="flex items-center space-x-3">
      {superuserPharmacyPicker}
      {syncIndicator}
    </div>
  );

  const couriers = [
    { id: 'k1', name: 'Marco Koerier', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
    { id: 'k2', name: 'Sanne Bezorgd', role: UserRole.COURIER, status: CourierStatus.ON_ROUTE },
  ];

  const setupBanner = !hasCloudConfig && (role === UserRole.SUPERUSER || role === UserRole.ADMIN) && (
    <div className="mb-6 bg-amber-50 border border-amber-200 p-6 rounded-4xl shadow-sm">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div className="flex-1">
          <p className="text-lg font-black text-amber-900">Database niet geconfigureerd</p>
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-1 opacity-80">
            Data wordt uitsluitend op dit apparaat bewaard.
          </p>
          <button
            onClick={() => setShowSetupHelp(!showSetupHelp)}
            className="mt-4 flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-white bg-amber-600 px-4 py-2 rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-200"
          >
            <span>{showSetupHelp ? 'Verberg' : 'Nu configureren'}</span>
            {showSetupHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showSetupHelp && (
            <div className="mt-6 p-5 bg-white border border-amber-200 rounded-3xl animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-amber-900/5">
              <div className="flex items-center space-x-2 mb-4 text-blue-600">
                <Info size={16} />
                <p className="text-xs font-black uppercase tracking-tighter">Stap-voor-stap Setup</p>
              </div>
              <p className="text-xs font-black text-slate-800 mb-3">1. Voer dit uit in Supabase SQL Editor:</p>
              <div className="relative group">
                <pre className="text-[10px] font-mono bg-slate-900 text-slate-300 p-4 rounded-2xl overflow-x-auto leading-relaxed border border-slate-800">
                  {`CREATE TABLE packages (...); -- Klik copy voor SQL`}
                </pre>
                <button
                  onClick={copySQL}
                  className="absolute top-2 right-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white transition-all flex items-center space-x-2 shadow-lg"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span className="text-[8px] font-black uppercase">{copied ? 'Gekopieerd' : 'Copy SQL'}</span>
                </button>
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-xs font-black text-slate-800">2. Voeg toe in Netlify → Environment Variables:</p>
                {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'GEMINI_API_KEY'].map(k => (
                  <div key={k} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <code className="text-[10px] font-black text-blue-600">{k}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Render: authenticated views ──────────────────────────────────
  return (
    <Layout
      userName={session!.user.name}
      userRole={role || ''}
      onLogout={handleLogout}
      hideMobileNav={showScanner}
      extraHeaderContent={extraHeader}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {setupBanner}

        {/* SUPERUSER — systeem-breed overzicht */}
        {role === UserRole.SUPERUSER && (
          <>
            <SupervisorView
              packages={packages}
              couriers={couriers}
              onUpdateStatus={updateMultipleStatus}
            />
            <ChatBot packages={packages} pharmacyName="Greenspeed HQ" />
          </>
        )}

        {/* ADMIN — één apotheek beheren */}
        {role === UserRole.ADMIN && (
          <AdminView
            packages={visiblePackages}
            pharmacyName={currentPharmacy.name}
            onScanStart={() => setShowScanner(true)}
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
          />
        )}

        {/* PHARMACY — scannen + chatbot, geen route-optimalisatie */}
        {role === UserRole.PHARMACY && (
          <PharmacyView
            packages={visiblePackages}
            onScanStart={() => setShowScanner(true)}
            pharmacyName={currentPharmacy.name}
          />
        )}

        {/* COURIER — eigen rit */}
        {role === UserRole.COURIER && (
          <CourierView
            packages={visiblePackages}
            onUpdate={() => {}}
            onUpdateMany={updateMultipleStatus}
            pharmacyName={currentPharmacy.name}
            pharmacyAddress={currentPharmacy.address}
          />
        )}

        {/* SUPERVISOR — legacy rol */}
        {role === UserRole.SUPERVISOR && (
          <>
            <SupervisorView
              packages={packages}
              couriers={couriers}
              onUpdateStatus={updateMultipleStatus}
            />
            <ChatBot packages={packages} pharmacyName={currentPharmacy.name} />
          </>
        )}

        {/* PATIENT — zou normaal niet hier komen (gaat via guest) */}
        {role === UserRole.PATIENT && (
          <PatientView packages={packages} />
        )}
      </div>

      {showScanner && (
        <Scanner
          onScanComplete={handleNewScan}
          onCancel={() => setShowScanner(false)}
        />
      )}
    </Layout>
  );
};

export default App;
