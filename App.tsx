import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserRole, Package, PackageStatus, CourierStatus, DeliveryEvidence, Pharmacy, AuthSession, AuthUser, ChatConversation, Address, StatusEvent, Institution } from './types';
import Layout from './components/Layout';
import LoginScreen from './components/LoginScreen';
import PharmacyView from './components/PharmacyView';
import AdminView from './components/AdminView';
import CourierView from './components/CourierView';
import DienstCheck from './components/DienstCheck';
import SupervisorView from './components/SupervisorView';
import SuperuserView from './components/SuperuserView';
import PatientView from './components/PatientView';
import InstitutionSelector from './components/InstitutionSelector';
import Scanner from './Scanner';
import ManualAddressForm from './components/ManualAddressForm';
import ChatBot from './components/ChatBot';
import { optimizeRoute, optimizeRouteDetailed, type RouteGeometry } from './services/geminiService';
import RouteMapModal from './components/RouteMapModal';
import { getSession, logout, saveSession, getCourierPharmacies } from './services/authService';
import { db, supabase, getAuthHeaders } from './services/supabaseService';
import { filterPharmacies, filterPackagesByAccess } from './utils/pharmacyAccess';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Info, X, Building2, Trash2 } from 'lucide-react';

const COURIER_NAMES: Record<string, string> = {
  'k1': 'Marco Koerier',
  'k2': 'Sanne Bezorgd',
};

// Normaliseer NL-postcode: "1217nl" / "1217 nl" / "1217NL" → "1217 NL".
// Geeft de invoer ongewijzigd terug als hij niet matcht (bv. buitenlands of incompleet).
const normalizePostcode = (pc: string): string =>
  pc.replace(/^(\d{4})\s*([A-Z]{2})$/i, '$1 $2').toUpperCase();

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
  pharmacy:  Pharmacy;
  onSave:    (updated: Pharmacy) => Promise<void>;
  onClose:   () => void;
  onDelete?: (pharmacy: Pharmacy) => Promise<void>;
}> = ({ pharmacy, onSave, onClose, onDelete }) => {
  const [name,    setName]    = useState(pharmacy.name);
  const [street,      setStreet]      = useState(pharmacy.street ?? '');
  const [houseNumber, setHouseNumber] = useState(pharmacy.houseNumber ?? '');
  const [postalCode,  setPostalCode]  = useState(pharmacy.postalCode ?? '');
  const [city,        setCity]        = useState(pharmacy.city ?? '');
  const [code,    setCode]    = useState(pharmacy.code ?? '');
  const [hourlyRate, setHourlyRate] = useState(pharmacy.hourlyRate?.toString() ?? '');
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Groep: superuser kiest uit de lijst, supervisor zit vast op de eigen groep
  const sess = getSession();
  const myRole = sess?.user.role;
  const myGroupId = sess?.user.groupId;
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [groupId, setGroupId] = useState(pharmacy.groupId ?? '');
  useEffect(() => { db.fetchGroups().then(setGroups).catch(() => {}); }, []);
  useEffect(() => {
    if (myRole === UserRole.SUPERVISOR && myGroupId) setGroupId(myGroupId);
  }, [myRole, myGroupId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...pharmacy,
        name:        name.trim(),
        street:      street.trim() || undefined,
        houseNumber: houseNumber.trim() || undefined,
        postalCode:  postalCode.trim() || undefined,
        city:        city.trim() || undefined,
        groupId:     (myRole === UserRole.SUPERVISOR ? (myGroupId ?? '') : groupId) || undefined,
        code:        code.trim() || undefined,
        hourlyRate:  hourlyRate.trim() ? parseFloat(hourlyRate) : 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(pharmacy);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div
        className="bg-white rounded-4xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300"
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
            { label: 'Naam apotheek', placeholder: 'bijv. Apotheek de Kroon', val: name,        set: setName,        required: true  },
            { label: 'Straat',        placeholder: 'bijv. Hoofdstraat',       val: street,      set: setStreet,      required: false },
            { label: 'Huisnummer',    placeholder: 'bijv. 12A',               val: houseNumber, set: setHouseNumber, required: false },
            { label: 'Postcode',      placeholder: 'bijv. 1234 AB',           val: postalCode,  set: setPostalCode,  required: false },
            { label: 'Plaats',        placeholder: 'bijv. Hilversum',         val: city,        set: setCity,        required: false },
            { label: 'Interne code',  placeholder: 'bijv. KRO',               val: code,        set: setCode,        required: false },
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

          {pharmacy.address && !pharmacy.street && (
            <p className="text-[11px] text-[#3d4945]/60 -mt-2 ml-1">Oud adres: {pharmacy.address}</p>
          )}

          {/* Groep / regio */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
              Groep / regio
            </label>
            {myRole === UserRole.SUPERVISOR ? (
              <div className="w-full bg-[#f2f4f6] rounded-xl px-5 h-12 flex items-center font-body font-bold text-[#191c1e] text-sm">
                {groups.find(g => g.id === myGroupId)?.name ?? myGroupId ?? 'Geen groep toegewezen'}
              </div>
            ) : (
              <select
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none"
                style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.2)' }}
              >
                <option value="">— Geen groep —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>

          {/* Uurtarief — wat Greenspeed deze apotheek factureert */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
              Uurtarief (€/uur)
            </label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              placeholder="45.00"
              className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.2)' }}
              onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
              onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.2)'}
            />
          </div>

          <div className="flex gap-3 pt-2 items-center">
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex items-center gap-2 px-4 h-12 rounded-full text-red-500 bg-red-50 border border-red-100 font-display font-bold text-sm hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Apotheek verwijderen"
              >
                <Trash2 size={16} />
                {deleting ? 'Bezig…' : 'Verwijderen'}
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-5 rounded-full font-display font-semibold text-sm text-[#101c30] bg-[#d7e2fe] transition-all active:scale-95"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving || deleting || !name.trim()}
              className="h-12 px-5 rounded-full text-white font-display font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {saving ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /> : null}
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
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [toast, setToast]                 = useState<string | null>(null);
  const [cloudStale, setCloudStale]       = useState(false);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pharmacyMismatch, setPharmacyMismatch] = useState<string | null>(null);
  const [unknownPharmacy, setUnknownPharmacy] = useState<string | null>(null);
  // Superuser-specific: can pick which pharmacy to act as
  const [superuserPharmacyId, setSuperuserPharmacyId] = useState<string>('');

  // Courier: welke apotheken zitten in de huidige rit
  const [courierPharmacyIds, setCourierPharmacyIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('courierPharmacyIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (courierPharmacyIds.length > 0) {
      localStorage.setItem('courierPharmacyIds', JSON.stringify(courierPharmacyIds));
    } else {
      localStorage.removeItem('courierPharmacyIds');
    }
  }, [courierPharmacyIds]);



  // Vaste instellingen
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [showInstitutionSelector, setShowInstitutionSelector] = useState(false);
  const [activeInstitutionRoute, setActiveInstitutionRoute] = useState<Institution[]>([]);

  const hasCloudConfig = !!supabase;
  const role = session?.user.role ?? null;
  const [dienstCheckOk, setDienstCheckOk] = useState(() => {
    try { return sessionStorage.getItem('gs_dienstcheck_ok') === '1'; } catch { return false; }
  });

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
      setCloudStale(db.cloudReadFailed());
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

  // Laad vaste instellingen — koerier ziet alle instellingen, andere rollen gefilterd op apotheek
  useEffect(() => {
    if (!session) return;
    if (role === UserRole.COURIER) {
      db.fetchInstitutions()
        .then(setInstitutions)
        .catch(() => setInstitutions([]));
      return;
    }
    const pid = currentPharmacy.id;
    if (!pid) { setInstitutions([]); return; }
    db.fetchInstitutions(pid)
      .then(setInstitutions)
      .catch(() => setInstitutions([]));
  }, [session, role, currentPharmacy.id]);

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
              new Date(p.createdAt).toDateString() === today
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
    () => (session ? filterPackagesByAccess(session.user, packages, pharmacies) : []),
    [session, packages, pharmacies],
  );

  const handleLogin = (user: AuthUser, _activePharmacyId?: string) => {
    const sess = { user, loggedInAt: new Date().toISOString() };
    setSession(sess);
    // Apotheek-keuze gebeurt niet meer bij login; de useEffect hieronder
    // laadt automatisch alle gekoppelde apotheken voor een courier.
  };

  // Bij iedere COURIER-login: vraag Supabase wat de gekoppelde apotheken
  // van deze koerier zijn en overschrijf localStorage/state daarmee. Voorkomt
  // dat een stale cache (oude apotheken van eerdere ritten) blijft hangen.
  // Bij lege Supabase-respons valt de bestaande localStorage-waarde terug.
  useEffect(() => {
    if (!session || session.user.role !== UserRole.COURIER) return;
    let cancelled = false;
    (async () => {
      const ids = await getCourierPharmacies().catch(() => [] as string[]);
      const allIds = Array.from(new Set([
        ...ids,
        ...(session.user.pharmacyIds ?? []),
        ...(session.user.pharmacyId ? [session.user.pharmacyId] : []),
      ]));
      if (cancelled) return;
      if (allIds.length > 0) {
        // Supabase heeft data → altijd overschrijven (negeer cache)
        setCourierPharmacyIds(allIds);
        localStorage.setItem('courierPharmacyIds', JSON.stringify(allIds));
      }
      // Geen data uit Supabase → laat bestaande localStorage-state intact
    })();
    return () => { cancelled = true; };
  }, [session]);

  const handleLogout = async () => {
    if (confirm('Uitloggen?')) {
      await logout();
      setSession(null);
      setPackages([]);
      setCourierPharmacyIds([]);
      localStorage.removeItem('courierPharmacyIds');
    }
  };

  const nextScanNumberRef  = useRef<number>(1);
  async function geocodeAddress(address: Address): Promise<{ lat: number; lng: number } | null> {
    console.log('[Geocode] Aanroep gestart voor:', address.street, address.houseNumber);
    const normalizedAddress: Address = {
      ...address,
      postalCode: normalizePostcode(address.postalCode ?? ''),
    };
    try {
      const response = await fetch('/.netlify/functions/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          action: 'geocode',
          addresses: [
            `${normalizedAddress.street} ${normalizedAddress.houseNumber}, ` +
            `${normalizedAddress.postalCode} ${normalizedAddress.city}, Netherlands`,
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Geocode] Server fout:', response.status, errText);
        return null;
      }

      const data = await response.json();

      if (!data.results) {
        console.error('[Geocode] Geen results in response:', data);
        return null;
      }

      let coords = data.results[0] ?? null;

      if (!coords) {
        // Fallback: probeer geocoding op enkel postcode + huisnummer (zonder straat/stad).
        // Lost adressen op waar de straatnaam van het label net iets afwijkt van Google.
        console.warn('[Geocode] Geen coords voor volledig adres, probeer postcode-fallback:', address.street, address.houseNumber);
        try {
          const fallbackResponse = await fetch('/.netlify/functions/maps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
              action: 'geocode',
              addresses: [
                `${normalizedAddress.postalCode} ${address.houseNumber}, Netherlands`,
              ],
            }),
          });
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            coords = fallbackData.results?.[0] ?? null;
            if (coords) {
              console.log('[Geocode] Fallback postcode werkte voor:', address.postalCode, address.houseNumber);
            }
          }
        } catch (fbErr) {
          console.error('[Geocode] Fallback netwerk fout:', fbErr);
        }
      }

      if (!coords) {
        console.warn('[Geocode] Geen coords (ook niet via fallback) voor:', address.street, address.houseNumber);
        return null;
      }

      console.log('[Geocode] ✓', address.street, address.houseNumber, '→', coords.lat, coords.lng);
      return coords;
    } catch (err) {
      console.error('[Geocode] Netwerk fout:', err);
      return null;
    }
  }

  // Ref zodat handleNewScan altijd de actuele packages ziet zonder afhankelijk te zijn
  // van de packages-state in de closure (voorkomt stale-closure race condition bij burst scans)
  const packagesRef      = useRef<Package[]>(packages);
  useEffect(() => { packagesRef.current = packages; }, [packages]);

  const pharmaciesRef    = useRef<Pharmacy[]>(pharmacies);
  useEffect(() => { pharmaciesRef.current = pharmacies; }, [pharmacies]);

  const handleNewScan = useCallback(async (address: Address, scannedPharmacyName?: string) => {
    const currentSession = getSession();
    const isKoerier  = currentSession?.user?.role === UserRole.COURIER;
    const courierId  = isKoerier ? currentSession?.user?.courierId : undefined;

    // Standaard fallback: session-pharmacy of currentPharmacy
    let pharmacyId: string =
      currentSession?.user?.pharmacyId ?? currentPharmacy.id;
    let pharmacyName: string =
      pharmaciesRef.current.find(p => p.id === pharmacyId)?.name ?? currentPharmacy.name;

    // Automatische apotheek-herkenning op basis van labelnaam — zoek in ALLE pharmacies
    if (scannedPharmacyName) {
      const normalize = (s: string) =>
        s.toLowerCase().replace(/apotheek|pharmacy/gi, '').trim();
      const normalizedLabel = normalize(scannedPharmacyName);

      const match = normalizedLabel.length > 0
        ? pharmaciesRef.current.find(p => {
            const normalizedPharmacy = normalize(p.name);
            return normalizedPharmacy.length > 0 && (
              normalizedPharmacy.includes(normalizedLabel) ||
              normalizedLabel.includes(normalizedPharmacy)
            );
          })
        : undefined;

      if (match) {
        pharmacyId = match.id;
        pharmacyName = match.name;
        console.log('[Scan] Apotheek automatisch herkend:', match.name);
        // Voeg toe aan de rit-apotheken — vult de pills bovenaan en de route-modal.
        setCourierPharmacyIds(prev => {
          if (prev.includes(match.id)) return prev;
          console.log('[Scan] Apotheek toegevoegd aan rit:', match.name);
          return [...prev, match.id];
        });
      } else {
        // Onbekende apotheek — sla pakket op met label-naam maar zonder pharmacyId koppeling
        console.warn('[Scan] Apotheek niet herkend:', scannedPharmacyName, '— pakket krijgt label-naam, geen ID');
        pharmacyId = '';
        pharmacyName = scannedPharmacyName;
        setUnknownPharmacy(scannedPharmacyName);
      }
    }

    // Atomisch scanNumber — ref verhoogt direct zodat parallelle aanroepen altijd unieke nummers krijgen
    const scanNumber = nextScanNumberRef.current++;

    // Lees actuele packages via ref — niet via stale closure
    const currentPackages = packagesRef.current;
    const hasRoute = currentPackages.some(p => p.routeIndex !== undefined);
    const routeIndex = hasRoute
      ? Math.max(0, ...currentPackages.filter(p => p.routeIndex !== undefined).map(p => p.routeIndex!)) + 1
      : undefined;

    const normalizedAddress: Address = {
      ...address,
      postalCode: normalizePostcode(address.postalCode ?? ''),
    };

    const pkg: Package = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pharmacyId,
      pharmacyName,
      address: normalizedAddress,
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

    const syncResult = await db.syncPackage(pkg);
    if (syncResult && !syncResult.synced) {
      setToast(`Let op: pakket #${scanNumber} staat lokaal maar is NIET op de server opgeslagen. Controleer je verbinding en login, en scan zo nodig opnieuw.`);
      setTimeout(() => setToast(null), 8000);
    }

    // Geocodeer op de achtergrond — blokkeert de UI niet
    geocodeAddress(address).then(coords => {
      if (!coords) return;
      const updatedPkg = { ...pkg, address: { ...pkg.address, lat: coords.lat, lng: coords.lng } };
      setPackages(prev => prev.map(p => p.id === pkg.id ? updatedPkg : p));
      db.syncPackage(updatedPkg).catch(err => console.error('[Geocode] Sync naar DB mislukt:', err));
    }).catch(err => console.error('[Geocode] Onverwachte fout:', err));
  }, [currentPharmacy]); // packages + pharmacies via refs; courierPharmacyIds niet meer gebruikt in scan

  const handleOptimizeRoute = useCallback(async (
    selectedIds: string[],
    startFrom: string = 'pharmacy',
    returnTo: string = 'pharmacy'
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

      // Bepaal startadres: 'current' = GPS, 'pharmacy' = legacy currentPharmacy,
      // elke andere string wordt als pharmacyId behandeld.
      let startAddress: string | null = null;
      if (startFrom === 'current') {
        startAddress = await new Promise<string | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            ()  => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      } else {
        const startPharmacy = startFrom === 'pharmacy'
          ? currentPharmacy
          : (pharmacies.find(p => p.id === startFrom) ?? currentPharmacy);
        if (startPharmacy?.address) {
          startAddress = `${startPharmacy.address}, Netherlands`;
        }
      }

      // Bepaal eindadres: 'none' = geen terugreis, 'pharmacy' = legacy currentPharmacy,
      // elke andere string wordt als pharmacyId behandeld.
      let endAddress: string | null = null;
      if (returnTo !== 'none') {
        const endPharmacy = returnTo === 'pharmacy'
          ? currentPharmacy
          : (pharmacies.find(p => p.id === returnTo) ?? currentPharmacy);
        if (endPharmacy?.address) {
          endAddress = `${endPharmacy.address}, Netherlands`;
        }
      }

      const { orderedIds, coords, totalDistanceM, totalDurationS } =
        await optimizeRouteDetailed(stops, startAddress, endAddress);
      setRouteGeometry({ orderedIds, coords, totalDistanceM, totalDurationS });

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
      const routeSync = await db.syncMultiplePackages(toSync);
      if (routeSync && !routeSync.synced) {
        setToast('Let op: de route is lokaal bijgewerkt maar NIET op de server opgeslagen. Controleer je verbinding en login.');
        setTimeout(() => setToast(null), 8000);
      }

    } catch (err) {
      console.error('Route optimalisatie mislukt:', err);
      alert('Routeoptimalisatie mislukt. Probeer opnieuw.');
    } finally {
      setIsOptimizing(false);
    }
  }, [packages, pharmacies, currentPharmacy]);

  const handleInstitutionRoute = useCallback(async (
    selected: Institution[],
    startFrom: string = 'pharmacy',
    returnTo: string = 'pharmacy'
  ) => {
    if (selected.length === 0) return;
    setIsOptimizing(true);
    setShowInstitutionSelector(false);

    try {
      // Converteer instellingen met een bruikbaar adres naar het optimizeRoute-formaat
      const addresses = selected
        .filter(i => i.street && i.postalCode)
        .map(i => ({
          id:          i.id,
          street:      i.street!,
          houseNumber: i.houseNumber ?? '',
          postalCode:  i.postalCode!,
          city:        i.city ?? '',
          lat:         i.addressLat,
          lng:         i.addressLng,
        }));

      // Adres van de actieve apotheek (koerier: actieve rit-apotheek)
      const activePharmacy = pharmacies.find(p => p.id === courierPharmacyIds[0]) ?? currentPharmacy;

      // Bepaal startadres — 'current' = GPS, 'pharmacy' = legacy fallback,
      // andere string = pharmacyId
      let startAddress: string | null = null;
      if (startFrom === 'current') {
        startAddress = await new Promise<string | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
            ()  => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
          );
        });
      } else {
        const startPharmacy = startFrom === 'pharmacy'
          ? activePharmacy
          : (pharmacies.find(p => p.id === startFrom) ?? activePharmacy);
        if (startPharmacy?.address) {
          startAddress = `${startPharmacy.address}, Netherlands`;
        }
      }

      // Bepaal eindadres — 'none' = geen terugreis, 'pharmacy' = legacy fallback,
      // andere string = pharmacyId
      let endAddress: string | null = null;
      if (returnTo !== 'none') {
        const endPharmacy = returnTo === 'pharmacy'
          ? activePharmacy
          : (pharmacies.find(p => p.id === returnTo) ?? activePharmacy);
        if (endPharmacy?.address) {
          endAddress = `${endPharmacy.address}, Netherlands`;
        }
      }

      let orderedInstitutions: Institution[] = selected;
      if (addresses.length > 1) {
        const orderedIds = await optimizeRoute(addresses, startAddress, endAddress);
        const ordered = orderedIds
          .map(id => selected.find(i => i.id === id))
          .filter(Boolean) as Institution[];
        // instellingen zonder adres (niet geoptimaliseerd) achteraan toevoegen
        const rest = selected.filter(i => !ordered.some(o => o.id === i.id));
        orderedInstitutions = [...ordered, ...rest];
      }

      setActiveInstitutionRoute(orderedInstitutions);
    } catch (err) {
      console.error('Instelling route mislukt:', err);
      alert('Routeplanning mislukt. Probeer opnieuw.');
    } finally {
      setIsOptimizing(false);
    }
  }, [pharmacies, courierPharmacyIds, currentPharmacy]);

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
    const statusSync = await db.syncMultiplePackages(pkgsToSync);
    if (statusSync && !statusSync.synced) {
      setToast('Let op: statuswijziging staat lokaal maar is NIET op de server opgeslagen. Controleer je verbinding en login.');
      setTimeout(() => setToast(null), 8000);
    }
  };

  const isActionable = (pkg: Package): boolean =>
    [PackageStatus.ASSIGNED, PackageStatus.PICKED_UP].includes(pkg.status);

  const handleNewRit = useCallback(() => {
    if (!confirm('Nieuwe rit starten? De huidige rit wordt gearchiveerd.')) return;
    // Verwijder alle pakketten van deze koerier uit lokale state
    setPackages(prev => prev.filter(p => p.courierId !== session?.user.courierId));
    // Reset apotheek-lijst — wordt automatisch opnieuw gevuld zodra de koerier scant
    setCourierPharmacyIds([]);
    localStorage.removeItem('courierPharmacyIds');
    setActiveInstitutionRoute([]);
  }, [session]);

  const handleAddPharmacy = async (newPharmacy: Pharmacy) => {
    // 1. Direct toevoegen aan lokale state (optimistic)
    setPharmacies(prev => [...prev, newPharmacy]);

    // 2. Opslaan via db (localStorage + Supabase)
    try {
      await db.savePharmacy(newPharmacy);
    } catch (err: any) {
      console.error('Opslaan apotheek mislukt:', err);
      alert('Apotheek opslaan in de cloud mislukt:\n\n' + (err?.message || err) + '\n\nDe apotheek is NIET opgeslagen.');
    }

    // 3. Herlaad vanuit Supabase zodat de lijst altijd de server-state weerspiegelt
    if (supabase) {
      const { data } = await supabase.from('pharmacies').select('*').order('name');
      if (data && data.length > 0) setPharmacies(data);
    }
  };

  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);

  const handleUpdatePharmacy = async (updated: Pharmacy) => {
    // Normaliseer code ↔ courierCode (UI gebruikt 'code', DB-kolom is 'courierCode')
    const normalized: Pharmacy = {
      ...updated,
      code:        updated.code ?? updated.courierCode,
      courierCode: updated.courierCode ?? updated.code,
    };
    setPharmacies(prev => prev.map(p => p.id === normalized.id ? normalized : p));
    try {
      await db.savePharmacy(normalized);
    } catch (err) {
      console.error('Opslaan apotheek mislukt:', err);
      alert('Opslaan mislukt. Probeer opnieuw.');
      return;
    }
    if (supabase) {
      const { data } = await supabase.from('pharmacies').select('*').order('name');
      if (data && data.length > 0) setPharmacies(data);
    }
  };

  const handleDeletePharmacy = async (pharmacy: Pharmacy) => {
    const packageCount = packages.filter(p => p.pharmacyId === pharmacy.id).length;

    if (packageCount > 0) {
      alert(
        `"${pharmacy.name}" kan niet verwijderd worden: er ${packageCount === 1 ? 'hangt nog 1 pakket' : `hangen nog ${packageCount} pakketten`} aan deze apotheek.\n\nVerplaats die eerst naar een andere apotheek (via "Niet-toegewezen pakketten" of door ze te herkoppelen). Daarna kun je de apotheek verwijderen.`
      );
      return;
    }

    if (!confirm(`Weet je zeker dat je "${pharmacy.name}" wilt verwijderen?`)) return;

    try {
      await db.deletePharmacy(pharmacy.id);
      setPharmacies(prev => prev.filter(p => p.id !== pharmacy.id));
      setEditingPharmacy(null);
    } catch (err) {
      console.error('Verwijderen mislukt:', err);
      alert('Verwijderen mislukt. Probeer opnieuw.');
    }
  };

  const handlePharmacyCodeChange = useCallback((pharmacyId: string, code: string) => {
    setPharmacies(prev => prev.map(p => p.id === pharmacyId ? { ...p, courierCode: code } : p));
  }, []);

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
  "groupId" TEXT,
  "courierCode" TEXT
);
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS "courierCode" TEXT;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON pharmacies;
CREATE POLICY "Allow public access" ON pharmacies FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  "pharmacyId" TEXT NOT NULL REFERENCES pharmacies(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  street TEXT,
  "houseNumber" TEXT,
  "postalCode" TEXT,
  city TEXT,
  "addressLat" DOUBLE PRECISION,
  "addressLng" DOUBLE PRECISION,
  frequency TEXT DEFAULT 'weekly',
  "deliveryDays" TEXT[] DEFAULT '{}',
  instructions TEXT,
  "contactPerson" TEXT,
  "contactPhone" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access" ON institutions;
CREATE POLICY "Allow public access" ON institutions FOR ALL USING (true);`;
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

      {/* Golf 2b: melding bij mislukte cloud-lees (mogelijk verouderde data) */}
      {cloudStale && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-bold animate-in slide-in-from-top duration-300 flex items-center gap-3">
          <span>Verbinding met de server mislukt — je ziet mogelijk verouderde gegevens.</span>
          <button onClick={() => location.reload()} className="underline font-black whitespace-nowrap">Opnieuw proberen</button>
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

        {/* Onbekende apotheek — label hoort bij geen bekende apotheek */}
        {unknownPharmacy && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start space-x-3 animate-in slide-in-from-top-2 duration-300">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-black text-amber-900">Onbekende apotheek</p>
              <p className="text-xs font-bold text-amber-700 mt-1 leading-relaxed">
                Het label <span className="font-black">{unknownPharmacy}</span> hoort bij geen bekende apotheek.
                Het pakket is wél vastgelegd en gemarkeerd, zodat een beheerder het later aan de juiste apotheek kan koppelen.
              </p>
            </div>
            <button
              onClick={() => setUnknownPharmacy(null)}
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
            onPharmacyCodeChange={handlePharmacyCodeChange}
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
            onPharmacyCodeChange={handlePharmacyCodeChange}
          />
        )}

        {/* PHARMACY — overzicht + chats */}
        {role === UserRole.PHARMACY && (
          <PharmacyView
            packages={visiblePackages}
            pharmacyName={currentPharmacy.name}
            pharmacyId={currentPharmacy.id}
            pharmacyCourierCode={currentPharmacy.courierCode}
            conversations={conversations}
            onMarkConversationRead={handleMarkConversationRead}
            onMarkCallbackHandled={handleMarkCallbackHandled}
          />
        )}

        {/* COURIER — eerst de dienst-check (locatie/camera), dan de rit */}
        {role === UserRole.COURIER && !dienstCheckOk && (
          <DienstCheck
            courierName={session?.user.name}
            onReady={() => {
              try { sessionStorage.setItem('gs_dienstcheck_ok', '1'); } catch {}
              setDienstCheckOk(true);
            }}
          />
        )}

        {/* COURIER — eigen rit, scannen en route plannen */}
        {role === UserRole.COURIER && dienstCheckOk && (
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
            activePharmacies={courierPharmacyIds
              .map(id => pharmacies.find(p => p.id === id))
              .filter(Boolean) as Pharmacy[]}
            onScanStart={() => setShowScanner(true)}
            onManualAdd={() => setShowManualForm(true)}
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
            onNewRit={handleNewRit}
            onInstitutionRoute={() => setShowInstitutionSelector(true)}
            activeInstitutionRoute={activeInstitutionRoute}
            onOptimizeInstitutions={handleInstitutionRoute}
            routeGeometry={routeGeometry}
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
            onPharmacyCodeChange={handlePharmacyCodeChange}
          />
        )}

        {/* PATIENT — zou normaal niet hier komen (gaat via guest) */}
        {role === UserRole.PATIENT && (
          <PatientView packages={packages} />
        )}
      </div>

      {showScanner && (
        <Scanner
          onScanComplete={({ address, pharmacyName }) => handleNewScan(address, pharmacyName)}
          onCancel={() => setShowScanner(false)}
        />
      )}

      {/* Vaste instellingen selecteren (koerier) */}
      {showInstitutionSelector && role === UserRole.COURIER && (
        <InstitutionSelector
          institutions={institutions}
          onStartRoute={handleInstitutionRoute}
          isOptimizing={isOptimizing}
          onClose={() => setShowInstitutionSelector(false)}
        />
      )}

      {showManualForm && (
        <ManualAddressForm
          onComplete={result => { handleNewScan(result.address, result.pharmacyName); setShowManualForm(false); }}
          onCancel={() => setShowManualForm(false)}
        />
      )}

      {/* Apotheek bewerken modal */}
      {editingPharmacy && (
        <EditPharmacyModal
          pharmacy={editingPharmacy}
          onSave={async (updated) => { await handleUpdatePharmacy(updated); setEditingPharmacy(null); }}
          onClose={() => setEditingPharmacy(null)}
          onDelete={role === UserRole.SUPERUSER ? handleDeletePharmacy : undefined}
        />
      )}

    </Layout>
  );
};

export default App;
