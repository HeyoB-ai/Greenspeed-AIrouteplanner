import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, Package, PackageStatus, CourierStatus, DeliveryEvidence, Pharmacy, AuthSession, AuthUser, ChatConversation, Address, StatusEvent } from './types';
import Layout from './components/Layout';
import LoginScreen from './components/LoginScreen';
import PharmacyView from './components/PharmacyView';
import AdminView from './components/AdminView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import SuperuserView from './components/SuperuserView';
import PatientView from './components/PatientView';
import Scanner from './Scanner';
import ManualAddressForm from './components/ManualAddressForm';
import ChatBot from './components/ChatBot';
import { optimizeRoute, ScanResult } from './services/geminiService';
import { getSession, logout } from './services/authService';
import { db, supabase } from './services/supabaseService';
import { filterPharmacies, filterPackagesByAccess } from './utils/pharmacyAccess';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Info, X } from 'lucide-react';

const COURIER_NAMES: Record<string, string> = {
  'k1': 'Marco Koerier',
  'k2': 'Sanne Bezorgd',
};

const enrichWithHistory = (pkg: Package): Package => {
  if (pkg.statusHistory && pkg.statusHistory.length > 0) return pkg;
  const history: StatusEvent[] = [{ status: PackageStatus.PENDING, timestamp: pkg.createdAt }];
  if (pkg.deliveredAt && pkg.status !== PackageStatus.PENDING) {
    history.push({
      status:    pkg.status,
      timestamp: pkg.deliveredAt,
      note:      pkg.deliveryEvidence?.deliveryNote,
    });
  }
  return { ...pkg, statusHistory: history };
};

const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [showPatientView, setShowPatientView] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [toast, setToast]                 = useState<string | null>(null);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pharmacyMismatch, setPharmacyMismatch] = useState<string | null>(null);

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

      // Wijs scanNumber retroactief toe op basis van aanmaakdatum (per apotheek)
      const enriched = pkgs
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((pkg, index) => enrichWithHistory({
          ...pkg,
          scanNumber: pkg.scanNumber ?? index + 1,
        }));
      setPackages(enriched);
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

  // Load conversations + realtime subscription voor pharmacy staff
  useEffect(() => {
    if (!session) return;
    const r = session.user.role;
    if (r !== UserRole.PHARMACY && r !== UserRole.ADMIN && r !== UserRole.SUPERUSER) return;

    // Eerste load (localStorage + Supabase)
    db.fetchConversations(currentPharmacy.id).then(setConversations).catch(() => {});

    // Realtime subscription (alleen als Supabase beschikbaar is)
    if (!supabase) return;
    const channel = supabase
      .channel('chat_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `pharmacyId=eq.${currentPharmacy.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConversations(prev => [payload.new as ChatConversation, ...prev]);
            setToast('Nieuw patiëntgesprek ontvangen');
            setTimeout(() => setToast(null), 4000);
          }
          if (payload.eventType === 'UPDATE') {
            setConversations(prev =>
              prev.map(c =>
                c.id === (payload.new as ChatConversation).id
                  ? (payload.new as ChatConversation)
                  : c
              )
            );
          }
          if (payload.eventType === 'DELETE') {
            setConversations(prev =>
              prev.filter(c => c.id !== (payload.old as { id: string }).id)
            );
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, currentPharmacy.id]);

  const handleMarkConversationRead = (id: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, isRead: true } : c));
    db.markConversationRead(id).catch(() => {});
  };

  const handleMarkCallbackHandled = (id: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== id || !c.callbackRequest) return c;
      const updated = { ...c, callbackRequest: { ...c.callbackRequest, isHandled: true } };
      db.saveConversation(updated).catch(() => {});
      return updated;
    }));
  };

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

  // Apotheken en pakketten gefilterd op wat de ingelogde gebruiker mag zien
  const accessiblePharmacies = useMemo(
    () => (session ? filterPharmacies(session.user, pharmacies) : []),
    [session, pharmacies],
  );

  const accessiblePackages = useMemo(
    () => (session ? filterPackagesByAccess(session.user, packages) : []),
    [session, packages],
  );

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
    const currentSession = getSession();
    const isKoerier = currentSession?.user?.role === UserRole.COURIER;
    const courierId  = isKoerier ? currentSession?.user?.courierId : undefined;
    const pharmacyId = currentSession?.user?.pharmacyId ?? currentPharmacy.id;

    // Scannummer = hoeveel pakketjes al gescand vandaag voor deze apotheek + 1
    const today = new Date().toDateString();
    const todayCount = packages.filter(p =>
      new Date(p.createdAt).toDateString() === today &&
      p.pharmacyId === pharmacyId
    ).length;
    const scanNumber = todayCount + 1;

    // Als er al een geoptimaliseerde route is → voeg toe als extra stop
    const hasRoute = packages.some(p => p.routeIndex !== undefined);
    const routeIndex = hasRoute
      ? Math.max(0, ...packages.filter(p => p.routeIndex !== undefined).map(p => p.routeIndex!)) + 1
      : undefined;

    const pkg: Package = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pharmacyId,
      pharmacyName: currentPharmacy.name,
      address,
      status: isKoerier ? PackageStatus.PICKED_UP : PackageStatus.PENDING,
      courierId,
      courierName: courierId ? (COURIER_NAMES[courierId] ?? currentSession?.user?.name ?? courierId) : undefined,
      createdAt: new Date().toISOString(),
      priority: 3,
      scanNumber,
      routeIndex,
      statusHistory: [{
        status:    isKoerier ? PackageStatus.PICKED_UP : PackageStatus.PENDING,
        timestamp: new Date().toISOString(),
      }],
    };

    setPackages(prev => [pkg, ...prev]);
    setShowScanner(false);

    if (hasRoute && routeIndex !== undefined) {
      setToast(`Pakket #${scanNumber} toegevoegd als stop ${routeIndex} in de bestaande route.`);
      setTimeout(() => setToast(null), 4000);
    }

    await db.syncPackage(pkg);
  }, [currentPharmacy, packages]);

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
              const updatedPkg = { ...updatedPackages[pkgIndex], status: PackageStatus.ASSIGNED, orderIndex: index, displayIndex: index + 1, routeIndex: index + 1 };
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
        const newEvent: StatusEvent = {
          status,
          timestamp: evidence?.timestamp ?? new Date().toISOString(),
          note:      evidence?.deliveryNote,
        };
        const updated: Package = {
          ...p,
          status,
          deliveryEvidence: evidence,
          deliveredAt: evidence?.timestamp ?? p.deliveredAt,
          statusHistory: [...(p.statusHistory ?? [{ status: p.status, timestamp: p.createdAt }]), newEvent],
        };
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
  "courierName" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "deliveredAt" TIMESTAMPTZ,
  "deliveryEvidence" JSONB,
  priority INTEGER,
  "orderIndex" INTEGER,
  "displayIndex" INTEGER,
  "scanNumber" INTEGER,
  "routeIndex" INTEGER
);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS "scanNumber" INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS "routeIndex" INTEGER;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON packages;
CREATE POLICY "Allow public access" ON packages FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  "pharmacyId" TEXT,
  messages JSONB DEFAULT '[]',
  "hasRiskSignal" BOOLEAN DEFAULT false,
  "callbackRequest" JSONB,
  "isRead" BOOLEAN DEFAULT false
);
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON chat_conversations;
CREATE POLICY "Allow public access" ON chat_conversations FOR ALL USING (true);
ALTER publication supabase_realtime ADD TABLE chat_conversations;`;
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

  const extraHeader = (
    <div className="flex items-center space-x-3">
      {syncIndicator}
    </div>
  );

  const couriers = [
    { id: 'k1', name: 'Marco Koerier', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
    { id: 'k2', name: 'Sanne Koerier', role: UserRole.COURIER, status: CourierStatus.ON_ROUTE },
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
      {/* Toast notificatie */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-black animate-in slide-in-from-top duration-300 whitespace-nowrap">
          💬 {toast}
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {setupBanner}

        {/* Apotheek-mismatch waarschuwing */}
        {pharmacyMismatch && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start space-x-3 animate-in slide-in-from-top-2 duration-300">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-black text-amber-900">Label van een andere apotheek</p>
              <p className="text-xs font-bold text-amber-700 mt-1 leading-relaxed">
                Op het label staat: <span className="font-black">{pharmacyMismatch}</span>.
                Actieve apotheek: <span className="font-black">{currentPharmacy.name}</span>.
                Controleer of dit pakket bij de juiste apotheek hoort.
              </p>
            </div>
            <button
              onClick={() => setPharmacyMismatch(null)}
              className="text-amber-400 hover:text-amber-700 transition-colors shrink-0"
              aria-label="Sluit melding"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* SUPERUSER — systeem-breed overzicht */}
        {role === UserRole.SUPERUSER && (
          <SuperuserView
            packages={accessiblePackages}
            pharmacies={accessiblePharmacies}
            onUpdateStatus={updateMultipleStatus}
          />
        )}

        {/* ADMIN — één of meerdere apotheken beheren */}
        {role === UserRole.ADMIN && (
          <AdminView
            packages={accessiblePackages}
            pharmacies={accessiblePharmacies}
            conversations={conversations}
            onMarkConversationRead={handleMarkConversationRead}
            onMarkCallbackHandled={handleMarkCallbackHandled}
          />
        )}

        {/* PHARMACY — overzicht + chats */}
        {role === UserRole.PHARMACY && (
          <PharmacyView
            packages={visiblePackages}
            pharmacyName={currentPharmacy.name}
            conversations={conversations}
            onMarkConversationRead={handleMarkConversationRead}
            onMarkCallbackHandled={handleMarkCallbackHandled}
          />
        )}

        {/* COURIER — eigen rit, scannen en route plannen */}
        {role === UserRole.COURIER && (
          <CourierView
            packages={visiblePackages}
            onUpdate={() => {}}
            onUpdateMany={updateMultipleStatus}
            pharmacyName={currentPharmacy.name}
            pharmacyAddress={currentPharmacy.address}
            onScanStart={() => setShowScanner(true)}
            onManualAdd={() => setShowManualForm(true)}
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
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
          onScanComplete={result => handleNewScan(result.address)}
          onCancel={() => setShowScanner(false)}
          nextScanNumber={
            packages.filter(p =>
              new Date(p.createdAt).toDateString() === new Date().toDateString() &&
              p.pharmacyId === (session?.user?.pharmacyId ?? currentPharmacy.id)
            ).length + 1
          }
        />
      )}

      {showManualForm && (
        <ManualAddressForm
          onComplete={result => { handleNewScan(result.address); setShowManualForm(false); }}
          onCancel={() => setShowManualForm(false)}
        />
      )}
    </Layout>
  );
};

export default App;
