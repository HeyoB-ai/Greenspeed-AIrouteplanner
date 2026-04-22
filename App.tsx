import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { optimizeRoute } from './services/geminiService';
import { getSession, logout, saveSession } from './services/authService';
import { db, supabase } from './services/supabaseService';
import { filterPharmacies, filterPackagesByAccess } from './utils/pharmacyAccess';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Info, X, Building2 } from 'lucide-react';

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

// ── Apotheek bewerken modal ────────────────────────────────────────────
const EditPharmacyModal: React.FC<{
  pharmacy: Pharmacy;
  onSave:   (updated: Pharmacy) => Promise<void>;
  onClose:  () => void;
}> = ({ pharmacy, onSave, onClose }) => {
  const [name,    setName]    = useState(pharmacy.name);
  const [address, setAddress] = useState(pharmacy.address ?? '');
  const [groupId, setGroupId] = useState(pharmacy.groupId ?? '');
  const [code,    setCode]    = useState(pharmacy.code ?? '');
  const [saving,  setSaving]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...pharmacy,
        name:    name.trim(),
        address: address.trim() || undefined,
        groupId: groupId.trim() || undefined,
        code:    code.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div
        className="bg-white rounded-4xl w-full max-w-md animate-in slide-in-from-bottom-4 duration-300"
        style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.20)' }}
      >
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <div>
            <h2 className="text-xl font-display font-black text-[#191c1e]">Apotheek bewerken</h2>
            <p className="text-[10px] font-display font-black text-[#3d4945]/60 uppercase tracking-widest mt-0.5">{pharmacy.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center text-[#3d4945] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
          {[
            { label: 'Naam apotheek', placeholder: 'bijv. Apotheek de Kroon', val: name,    set: setName,    required: true  },
            { label: 'Adres',         placeholder: 'bijv. Hoofdstraat 1, …',   val: address, set: setAddress, required: false },
            { label: 'Groep / regio', placeholder: 'bijv. regio-noord',        val: groupId, set: setGroupId, required: false },
            { label: 'Interne code',  placeholder: 'bijv. KRO',                val: code,    set: setCode,    required: false },
          ].map(f => (
            <div key={f.label} className="space-y-1.5">
              <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={f.val}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.2)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.2)'}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-full font-display font-semibold text-sm text-[#101c30] bg-[#d7e2fe] transition-all active:scale-95"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 h-12 rounded-full text-white font-display font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {saving ? <>{/* Loader2 imported via lucide */}<span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /></> : null}
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

  // Courier: welke apotheken zitten in de huidige rit
  const [courierPharmacyIds, setCourierPharmacyIds] = useState<string[]>([]);
  const [scanPharmacyId, setScanPharmacyId] = useState<string | null>(null);
  const [showAddPharmacy, setShowAddPharmacy] = useState(false);
  const [showPharmacySwitcher, setShowPharmacySwitcher] = useState(false);

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

      // Initialiseer de atomische scanNumber teller op basis van vandaag
      const today = new Date().toDateString();
      const todayMax = enriched
        .filter(p => new Date(p.createdAt).toDateString() === today)
        .reduce((max, p) => Math.max(max, p.scanNumber ?? 0), 0);
      nextScanNumberRef.current = todayMax + 1;

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

  // Realtime subscription voor pharmacies (zichtbaar voor alle authenticated gebruikers)
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('pharmacies_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pharmacies' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPharmacies(prev =>
              prev.some(p => p.id === (payload.new as Pharmacy).id)
                ? prev
                : [...prev, payload.new as Pharmacy]
            );
          }
          if (payload.eventType === 'UPDATE') {
            setPharmacies(prev =>
              prev.map(p => p.id === (payload.new as Pharmacy).id ? payload.new as Pharmacy : p)
            );
          }
          if (payload.eventType === 'DELETE') {
            setPharmacies(prev =>
              prev.filter(p => p.id !== (payload.old as Pharmacy).id)
            );
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
      case UserRole.COURIER: {
        const today = new Date().toDateString();
        return session.user.courierId
          ? packages.filter(p =>
              p.courierId === session.user.courierId &&
              new Date(p.createdAt).toDateString() === today &&
              (courierPharmacyIds.length === 0 || courierPharmacyIds.includes(p.pharmacyId))
            )
          : packages.filter(p =>
              new Date(p.createdAt).toDateString() === today
            );
      }
      default:
        return packages;
    }
  }, [packages, session, role, courierPharmacyIds]);

  // Apotheken en pakketten gefilterd op wat de ingelogde gebruiker mag zien
  const accessiblePharmacies = useMemo(
    () => (session ? filterPharmacies(session.user, pharmacies) : []),
    [session, pharmacies],
  );

  const accessiblePackages = useMemo(
    () => (session ? filterPackagesByAccess(session.user, packages) : []),
    [session, packages],
  );

  const handleLogin = (user: AuthUser, activePharmacyId?: string) => {
    const sess = { user, loggedInAt: new Date().toISOString() };
    setSession(sess);
    if (activePharmacyId) {
      setCourierPharmacyIds([activePharmacyId]);
      setScanPharmacyId(activePharmacyId);
    }
  };

  const handleLogout = async () => {
    if (confirm('Uitloggen?')) {
      await logout();
      setSession(null);
      setPackages([]);
      setCourierPharmacyIds([]);
      setScanPharmacyId(null);
    }
  };

  const nextScanNumberRef  = useRef<number>(1);
  async function geocodeAddress(address: Address): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch('/.netlify/functions/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'geocode',
          addresses: [`${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city}, Netherlands`],
        }),
      });
      const { results } = await res.json();
      return results?.[0] ?? null;
    } catch {
      return null;
    }
  }

  // Ref zodat handleNewScan altijd de actuele packages ziet zonder afhankelijk te zijn
  // van de packages-state in de closure (voorkomt stale-closure race condition bij burst scans)
  const packagesRef      = useRef<Package[]>(packages);
  useEffect(() => { packagesRef.current = packages; }, [packages]);

  const pharmaciesRef    = useRef<Pharmacy[]>(pharmacies);
  useEffect(() => { pharmaciesRef.current = pharmacies; }, [pharmacies]);

  const scanPharmacyRef  = useRef<string | null>(null);
  useEffect(() => { scanPharmacyRef.current = scanPharmacyId ?? courierPharmacyIds[0] ?? null; }, [scanPharmacyId, courierPharmacyIds]);

  const handleNewScan = useCallback(async (address: Address) => {
    const currentSession = getSession();
    const isKoerier  = currentSession?.user?.role === UserRole.COURIER;
    const courierId  = isKoerier ? currentSession?.user?.courierId : undefined;
    const pharmacyId = isKoerier
      ? (scanPharmacyRef.current ?? currentSession?.user?.pharmacyId ?? currentPharmacy.id)
      : (currentSession?.user?.pharmacyId ?? currentPharmacy.id);
    const pharmacyName = isKoerier
      ? (pharmaciesRef.current.find(p => p.id === pharmacyId)?.name ?? currentPharmacy.name)
      : currentPharmacy.name;

    // Atomisch scanNumber — ref verhoogt direct zodat parallelle aanroepen altijd unieke nummers krijgen
    const scanNumber = nextScanNumberRef.current++;

    // Lees actuele packages via ref — niet via stale closure
    const currentPackages = packagesRef.current;
    const hasRoute = currentPackages.some(p => p.routeIndex !== undefined);
    const routeIndex = hasRoute
      ? Math.max(0, ...currentPackages.filter(p => p.routeIndex !== undefined).map(p => p.routeIndex!)) + 1
      : undefined;

    const pkg: Package = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pharmacyId,
      pharmacyName,
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

    if (hasRoute && routeIndex !== undefined) {
      setToast(`Pakket #${scanNumber} toegevoegd als stop ${routeIndex} in de bestaande route.`);
      setTimeout(() => setToast(null), 4000);
    }

    await db.syncPackage(pkg);

    // Geocodeer op de achtergrond — blokkeert de UI niet
    geocodeAddress(address).then(coords => {
      if (!coords) return;
      const updatedPkg = { ...pkg, address: { ...pkg.address, lat: coords.lat, lng: coords.lng } };
      setPackages(prev => prev.map(p => p.id === pkg.id ? updatedPkg : p));
      db.syncPackage(updatedPkg).catch(() => {});
    }).catch(() => {});
  }, [currentPharmacy]); // packages weggelaten — wordt gelezen via packagesRef

  const handleOptimizeRoute = useCallback(async (
    selectedIds: string[],
    startFrom: 'pharmacy' | 'current' = 'pharmacy',
    returnTo: 'pharmacy' | 'none' = 'pharmacy'
  ) => {
    if (selectedIds.length === 0) return;
    setIsOptimizing(true);

    try {
      const selectedPackages = packages.filter(p => selectedIds.includes(p.id));

      const stops = selectedPackages.map(p => ({
        id:          p.id,
        street:      p.address.street,
        houseNumber: p.address.houseNumber,
        postalCode:  p.address.postalCode,
        city:        p.address.city,
      }));

      let startAddress: string | null = null;
      if (startFrom === 'pharmacy' && currentPharmacy.address) {
        startAddress = `${currentPharmacy.address}, Netherlands`;
      } else if (startFrom === 'current') {
        startAddress = await new Promise<string | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            ()  => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      }

      let endAddress: string | null = null;
      if (returnTo === 'pharmacy' && currentPharmacy.address) {
        endAddress = `${currentPharmacy.address}, Netherlands`;
      }

      const orderedIds = await optimizeRoute(stops, startAddress, endAddress);

      console.log('=== ROUTE OPTIMALISATIE ===');
      console.log('Geselecteerde IDs:', selectedIds);
      console.log('Geoptimaliseerde volgorde:', orderedIds);
      orderedIds.forEach((id, i) => {
        const pkg = packages.find(p => p.id === id);
        if (pkg) console.log(`Stop ${i + 1}: ${pkg.address.street} ${pkg.address.houseNumber}`);
      });

      // indexMap: id → 1-gebaseerde positie
      const indexMap = new Map() as Map<string, number>;
      orderedIds.forEach((id, i) => indexMap.set(id, i + 1));

      const toSync: Package[] = [];
      const updatedPackages = packages.map(pkg => {
        if (!indexMap.has(pkg.id)) return pkg;
        const pos = indexMap.get(pkg.id)!;
        const updated = {
          ...pkg,
          status:       PackageStatus.ASSIGNED,
          routeIndex:   pos,
          displayIndex: pos,
          orderIndex:   pos - 1, // 0-gebaseerd voor overzicht-sort
        };
        toSync.push(updated);
        return updated;
      });

      console.log('Gesynchroniseerd:', toSync.map(p => `stop ${p.routeIndex}: ${p.address.street} ${p.address.houseNumber}`));

      setPackages(updatedPackages);
      await db.syncMultiplePackages(toSync);

    } catch (err) {
      console.error('Route optimalisatie mislukt:', err);
      alert('Routeoptimalisatie mislukt. Probeer opnieuw.');
    } finally {
      setIsOptimizing(false);
    }
  }, [packages]);

  const BESCHERMDE_STATUSSEN = [
    PackageStatus.DELIVERED,
    PackageStatus.MAILBOX,
    PackageStatus.NEIGHBOUR,
    PackageStatus.RETURN,
    PackageStatus.MOVED,
    PackageStatus.OTHER_LOCATION,
    PackageStatus.FAILED,
  ];

  const updateMultipleStatus = async (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => {
    // Beschermde statussen mogen nooit overschreven worden door REMOVED
    const safeIds = status === PackageStatus.REMOVED
      ? ids.filter(id => {
          const pkg = packages.find(p => p.id === id);
          return pkg && !BESCHERMDE_STATUSSEN.includes(pkg.status);
        })
      : ids;

    if (safeIds.length < ids.length) {
      console.warn(
        `[Status] ${ids.length - safeIds.length} pakket(jes) overgeslagen — beschermde status kan niet overschreven worden door REMOVED`
      );
    }
    if (safeIds.length === 0) return;

    const pkgsToSync: Package[] = [];
    const newPackages = packages.map(p => {
      if (safeIds.includes(p.id)) {
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

  const isActionable = (pkg: Package): boolean =>
    [PackageStatus.ASSIGNED, PackageStatus.PICKED_UP].includes(pkg.status);

  const handleNewRit = useCallback(() => {
    if (!confirm('Nieuwe rit starten? De huidige rit wordt gearchiveerd.')) return;
    const toArchive = packages.filter(p =>
      p.courierId === session?.user.courierId &&
      !isActionable(p) &&
      p.status !== PackageStatus.REMOVED &&
      !BESCHERMDE_STATUSSEN.includes(p.status)
    );
    if (toArchive.length > 0) {
      updateMultipleStatus(toArchive.map(p => p.id), PackageStatus.REMOVED);
    }
    setCourierPharmacyIds([]);
    setScanPharmacyId(null);
  }, [packages, session]);

  const handleAddPharmacy = async (newPharmacy: Pharmacy) => {
    // 1. Direct toevoegen aan lokale state (optimistic)
    setPharmacies(prev => [...prev, newPharmacy]);

    // 2. Opslaan via db (localStorage + Supabase)
    await db.savePharmacy(newPharmacy);

    // 3. Herlaad vanuit Supabase zodat de lijst altijd de server-state weerspiegelt
    if (supabase) {
      const { data } = await supabase.from('pharmacies').select('*').order('name');
      if (data && data.length > 0) setPharmacies(data);
    }
  };

  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);

  const handleUpdatePharmacy = async (updated: Pharmacy) => {
    setPharmacies(prev => prev.map(p => p.id === updated.id ? updated : p));
    await db.savePharmacy(updated);
    if (supabase) {
      const { data } = await supabase.from('pharmacies').select('*').order('name');
      if (data && data.length > 0) setPharmacies(data);
    }
  };

  const canAddPharmacy = role === UserRole.SUPERUSER || role === UserRole.SUPERVISOR;

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
ALTER publication supabase_realtime ADD TABLE chat_conversations;

CREATE TABLE IF NOT EXISTS pharmacies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  "groupId" TEXT
);
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON pharmacies;
CREATE POLICY "Allow public access" ON pharmacies FOR ALL USING (true);`;
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
        <RefreshCw size={14} className="text-[#006b5a] animate-spin" />
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
              <div className="flex items-center space-x-2 mb-4 text-[#006b5a]">
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
                  className="absolute top-2 right-2 p-2 text-white rounded-xl transition-all flex items-center space-x-2 shadow-lg active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span className="text-[8px] font-black uppercase">{copied ? 'Gekopieerd' : 'Copy SQL'}</span>
                </button>
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-xs font-black text-slate-800">2. Voeg toe in Netlify → Environment Variables:</p>
                {['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'GEMINI_API_KEY'].map(k => (
                  <div key={k} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <code className="text-[10px] font-black text-[#006b5a]">{k}</code>
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
            userRole={UserRole.SUPERUSER}
            onUpdateStatus={updateMultipleStatus}
            canAddPharmacy={canAddPharmacy}
            onAddPharmacy={handleAddPharmacy}
            onEditPharmacy={setEditingPharmacy}
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
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
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
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
            pharmacyName={courierPharmacyIds.length === 1
              ? (pharmacies.find(p => p.id === courierPharmacyIds[0])?.name ?? currentPharmacy.name)
              : courierPharmacyIds.length > 1
                ? `${courierPharmacyIds.length} apotheken`
                : currentPharmacy.name}
            pharmacyAddress={courierPharmacyIds.length === 1
              ? pharmacies.find(p => p.id === courierPharmacyIds[0])?.address
              : undefined}
            activePharmacyNames={courierPharmacyIds
              .map(id => pharmacies.find(p => p.id === id)?.name)
              .filter(Boolean) as string[]}
            onScanStart={() => setShowScanner(true)}
            onManualAdd={() => setShowManualForm(true)}
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
            onNewRit={handleNewRit}
            onAddPharmacy={() => setShowAddPharmacy(true)}
          />
        )}

        {/* SUPERVISOR — zelfde overzicht als superuser, gefilterd op eigen apotheken */}
        {role === UserRole.SUPERVISOR && (
          <SuperuserView
            packages={accessiblePackages}
            pharmacies={accessiblePharmacies}
            userRole={UserRole.SUPERVISOR}
            onUpdateStatus={updateMultipleStatus}
            canAddPharmacy={canAddPharmacy}
            onAddPharmacy={handleAddPharmacy}
            onEditPharmacy={setEditingPharmacy}
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
          />
        )}

        {/* PATIENT — zou normaal niet hier komen (gaat via guest) */}
        {role === UserRole.PATIENT && (
          <PatientView packages={packages} />
        )}
      </div>

      {showScanner && (
        <Scanner
          onScanComplete={({ address }) => handleNewScan(address)}
          onCancel={() => setShowScanner(false)}
        />
      )}

      {/* Apotheek-switcher tijdens scannen */}
      {showPharmacySwitcher && (
        <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-display font-black text-[#191c1e] mb-4">Voor welke apotheek scan je?</h3>
            {courierPharmacyIds.map(id => {
              const pharm = pharmacies.find(p => p.id === id);
              if (!pharm) return null;
              return (
                <button key={id} onClick={() => { setScanPharmacyId(id); setShowPharmacySwitcher(false); }}
                  className={`w-full p-4 rounded-2xl mb-3 text-left font-display font-bold text-sm transition-all active:scale-[0.98] ${scanPharmacyId === id ? 'bg-[#006b5a] text-white' : 'bg-[#f2f4f6] text-[#191c1e]'}`}>
                  {pharm.name}{scanPharmacyId === id ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Apotheek toevoegen aan rit */}
      {showAddPharmacy && role === UserRole.COURIER && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-10">
            <h3 className="font-display font-black text-[#191c1e] text-lg mb-1">Apotheek toevoegen aan rit</h3>
            <p className="text-sm text-[#3d4945] mb-6">Kies een apotheek waar je pakketten ophaalt</p>
            <div className="space-y-3 mb-6">
              {pharmacies.filter(p => !courierPharmacyIds.includes(p.id)).map(pharmacy => (
                <button key={pharmacy.id}
                  onClick={() => {
                    setCourierPharmacyIds(prev => {
                      const updated = [...prev, pharmacy.id];
                      if (prev.length === 0) setScanPharmacyId(pharmacy.id);
                      return updated;
                    });
                    setShowAddPharmacy(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-[#f2f4f6] rounded-2xl active:scale-[0.98] transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[#48c2a9]/20 flex items-center justify-center">
                    <Building2 size={20} className="text-[#006b5a]" />
                  </div>
                  <div className="text-left">
                    <p className="font-display font-black text-[#191c1e] text-sm">{pharmacy.name}</p>
                    {pharmacy.address && <p className="text-xs text-[#3d4945]">{pharmacy.address}</p>}
                  </div>
                </button>
              ))}
              {pharmacies.filter(p => !courierPharmacyIds.includes(p.id)).length === 0 && (
                <p className="text-sm text-[#3d4945] text-center py-4">Alle apotheken zijn al toegevoegd aan je rit</p>
              )}
            </div>
            <button onClick={() => setShowAddPharmacy(false)}
              className="w-full h-12 rounded-full border border-[#48c2a9]/30 text-[#3d4945] font-display font-bold text-sm">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {showManualForm && (
        <ManualAddressForm
          onComplete={result => { handleNewScan(result.address); setShowManualForm(false); }}
          onCancel={() => setShowManualForm(false)}
        />
      )}

      {/* Apotheek bewerken modal */}
      {editingPharmacy && (
        <EditPharmacyModal
          pharmacy={editingPharmacy}
          onSave={async (updated) => { await handleUpdatePharmacy(updated); setEditingPharmacy(null); }}
          onClose={() => setEditingPharmacy(null)}
        />
      )}
    </Layout>
  );
};

export default App;
