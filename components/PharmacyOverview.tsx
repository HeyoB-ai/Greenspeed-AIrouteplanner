import React, { useState, useMemo, useEffect } from 'react';
import { Package as PackageType, PackageStatus, Pharmacy, UserRole } from '../types';
import {
  Building2, Search, ChevronRight, Package,
  CheckCircle, CreditCard, X, Download, AlertCircle, Plus, Loader2, Pencil, Link,
} from 'lucide-react';
import { getSession } from '../services/authService';
import { db } from '../services/supabaseService';

const PAGE_SIZE = 20;

const DELIVERED_STATUSES = new Set([
  PackageStatus.DELIVERED,
  PackageStatus.MAILBOX,
  PackageStatus.NEIGHBOUR,
  PackageStatus.BILLED,
]);

const PENDING_STATUSES = new Set([
  PackageStatus.PENDING,
  PackageStatus.ASSIGNED,
  PackageStatus.PICKED_UP,
]);

// Retour apotheek (niet thuis e.d.) — een nette uitkomst, GEEN mislukking.
const RETURNED_STATUSES = new Set([
  PackageStatus.RETURN,
]);

interface PharmacyStat {
  id:           string;
  name:         string;
  total:        number;
  delivered:    number;
  pending:      number;
  returned:     number;
  failed:       number;
  deliveryRate: number; // 0–100
}

export interface PharmacyOverviewProps {
  packages:         PackageType[];
  pharmacies:       Pharmacy[];
  onSelectPharmacy: (pharmacyId: string) => void;
  onExport?:        () => void;           // optioneel — toon Export-knop als aanwezig
  canAddPharmacy?:  boolean;              // toon "+ Nieuwe apotheek" knop
  onAddPharmacy?:   (pharmacy: Pharmacy) => Promise<void>;
  onEditPharmacy?:  (pharmacy: Pharmacy) => void;
}

const rateColor = (rate: number) =>
  rate >= 80 ? 'text-[#006b5a]' : rate >= 60 ? 'text-amber-600' : 'text-red-500';

// Normaliseer apotheeknaam voor duplicaat-detectie: kleine letters, spaties samengevoegd, punten/komma's weg
const normalizeName = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,]/g, '');

const PharmacyOverview: React.FC<PharmacyOverviewProps> = ({
  packages, pharmacies, onSelectPharmacy, onExport, canAddPharmacy, onAddPharmacy, onEditPharmacy,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(0);

  // ── Nieuwe apotheek modal ──────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName]           = useState('');
  const [newStreet, setNewStreet]             = useState('');
  const [newHouseNumber, setNewHouseNumber]   = useState('');
  const [newPostalCode, setNewPostalCode]     = useState('');
  const [newCity, setNewCity]                 = useState('');
  const [adding, setAdding]             = useState(false);

  // Groep: superuser kiest uit de lijst, supervisor zit vast op de eigen groep
  const sess = getSession();
  const myRole = sess?.user.role;
  const myGroupId = sess?.user.groupId;
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [newGroupId, setNewGroupId] = useState('');
  useEffect(() => { db.fetchGroups().then(setGroups).catch(() => {}); }, []);
  useEffect(() => {
    if (myRole === UserRole.SUPERVISOR && myGroupId) setNewGroupId(myGroupId);
  }, [myRole, myGroupId]);

  // Live duplicaat-detectie op genormaliseerde naam
  const duplicateMatches = useMemo(() => {
    const n = normalizeName(newName);
    if (!n) return [];
    return pharmacies.filter(p => normalizeName(p.name) === n);
  }, [newName, pharmacies]);

  const resetAddForm = () => {
    setNewName('');
    setNewStreet('');
    setNewHouseNumber('');
    setNewPostalCode('');
    setNewCity('');
    setNewGroupId(myRole === UserRole.SUPERVISOR && myGroupId ? myGroupId : '');
  };

  const doAdd = async () => {
    if (!newName.trim() || !onAddPharmacy) return;
    const newPharmacy: Pharmacy = {
      id:          `ph-${Date.now()}`,
      name:        newName.trim(),
      street:      newStreet.trim() || undefined,
      houseNumber: newHouseNumber.trim() || undefined,
      postalCode:  newPostalCode.trim() || undefined,
      city:        newCity.trim() || undefined,
      groupId:     (myRole === UserRole.SUPERVISOR ? (myGroupId ?? '') : newGroupId) || undefined,
    };
    setAdding(true);
    try {
      await onAddPharmacy(newPharmacy);
      setShowAddModal(false);
      resetAddForm();
    } finally {
      setAdding(false);
    }
  };

  const openExisting = (p: Pharmacy) => {
    setShowAddModal(false);
    resetAddForm();
    onEditPharmacy?.(p);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bij een duplicaat is de knop al veranderd in "Toch toevoegen" (bewuste keuze);
    // doAdd handelt beide gevallen af.
    await doAdd();
  };

  // ── Global stats ──────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const activePkgs = packages.filter(p => p.status !== PackageStatus.SCANNING && p.status !== PackageStatus.REMOVED);
    const delivered  = packages.filter(p => DELIVERED_STATUSES.has(p.status)).length;
    return {
      total:    activePkgs.length,
      delivered,
    };
  }, [packages]);

  // ── Per-pharmacy stats (worst delivery rate first) ─────────────
  const pharmacyStats = useMemo((): PharmacyStat[] => {
    const map = new Map() as Map<string, PharmacyStat>;

    pharmacies.forEach(ph =>
      map.set(ph.id, { id: ph.id, name: ph.name, total: 0, delivered: 0, pending: 0, returned: 0, failed: 0, deliveryRate: 0 })
    );

    packages.forEach(p => {
      if (p.status === PackageStatus.SCANNING || p.status === PackageStatus.REMOVED) return;
      const s = map.get(p.pharmacyId);
      // Pakket met een apotheek-id dat bij geen echte apotheek hoort (spook) tonen we
      // niet meer als losse kaart; die pakketten horen in het toewijs-paneel thuis.
      if (!s) return;
      s.total++;
      if (DELIVERED_STATUSES.has(p.status)) s.delivered++;
      else if (PENDING_STATUSES.has(p.status)) s.pending++;
      else if (RETURNED_STATUSES.has(p.status)) s.returned++;
      else s.failed++;
    });

    return [...map.values()]
      .map(s => ({ ...s, deliveryRate: s.total > 0 ? (s.delivered / s.total) * 100 : 0 }))
      .sort((a, b) => a.deliveryRate - b.deliveryRate);
  }, [packages, pharmacies]);

  // ── Search + pagination ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pharmacyStats.filter(s => s.name.toLowerCase().includes(q)) : pharmacyStats;
  }, [pharmacyStats, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const paginationButtons = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const btns: (number | '...')[] = [0];
    if (page > 2) btns.push('...');
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) btns.push(i);
    if (page < totalPages - 3) btns.push('...');
    btns.push(totalPages - 1);
    return btns;
  };

  return (
    <div className="space-y-8">
      {/* Global stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Apotheken', val: pharmacyStats.length,   icon: Building2,   },
          { label: 'Pakketten', val: globalStats.total,       icon: Package,     },
          { label: 'Bezorgd',   val: globalStats.delivered,   icon: CheckCircle, },
          { label: 'Omzet',     val: '—',                     icon: CreditCard,  },
        ].map(s => (
          <div key={s.label} className="bg-white p-5 lg:p-6 rounded-4xl" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
            <div className="w-10 h-10 bg-[#5dc0a7]/15 rounded-full flex items-center justify-center mb-4">
              <s.icon size={20} className="text-[#006b5a]" />
            </div>
            <p className="text-2xl font-display font-black text-[#191c1e] leading-none">{s.val}</p>
            <p className="text-[9px] font-display font-black text-[#3d4945]/60 uppercase tracking-[0.2em] mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Zoek apotheek..."
          className="w-full bg-white rounded-2xl pl-10 pr-10 py-3 text-sm font-body font-bold text-[#191c1e] placeholder:text-[#3d4945]/40 outline-none transition-all"
          style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.2)' }}
          onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
          onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.2)'}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); setPage(0); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-display font-black text-[#3d4945]/60 uppercase tracking-widest">
            {filtered.length} apothe{filtered.length === 1 ? 'ek' : 'ken'} — slechtste bezorgpercentage eerst
          </p>
          <div className="flex items-center gap-3">
            {totalPages > 1 && (
              <p className="text-[10px] font-display font-black text-[#3d4945]/60 uppercase tracking-widest">
                Pagina {page + 1} / {totalPages}
              </p>
            )}
            {canAddPharmacy && onAddPharmacy && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 h-9 text-white rounded-full font-display font-bold text-xs transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
              >
                <Plus size={13} />
                Nieuwe apotheek
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 h-9 bg-[#d7e2fe] text-[#101c30] rounded-full font-display font-semibold text-xs transition-all active:scale-95"
              >
                <Download size={13} />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="bg-white rounded-4xl p-16 text-center" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
            <AlertCircle size={32} className="mx-auto mb-3 text-[#3d4945]/30" />
            <p className="text-[#3d4945]/60 font-body font-bold text-sm">
              {pharmacies.length === 0 ? 'Geen apotheken beschikbaar' : 'Geen apotheken gevonden'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pageItems.map(s => {
              const courierCode = pharmacies.find(p => p.id === s.id)?.courierCode;
              return (
              <div
                key={s.id}
                className="bg-white rounded-4xl p-6 transition-all"
                style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <button
                    onClick={() => onSelectPharmacy(s.id)}
                    className="flex items-center space-x-3 text-left group flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 bg-[#5dc0a7]/15 rounded-full flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-[#006b5a]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-black text-[#191c1e] text-base leading-tight truncate">{s.name}</h3>
                      <p className="text-[9px] font-display font-black text-[#3d4945]/60 uppercase tracking-widest mt-0.5">
                        {s.total} pakket{s.total !== 1 ? 'ten' : ''}
                      </p>
                      {courierCode && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-[#3d4945] bg-[#f2f4f6] px-2 py-0.5 rounded-full font-mono tracking-wider">
                          <Link size={9} className="text-[#006b5a]" />
                          {courierCode}
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {onEditPharmacy && (
                      <button
                        onClick={() => {
                          const ph = pharmacies.find(p => p.id === s.id);
                          // Echte apotheek → bewerk die. Spookkaart uit een scan (geen echte rij,
                          // maar wel een eigen id) → open de modal met de kaartgegevens; opslaan maakt
                          // er een echte apotheek van en de bijbehorende pakketten koppelen automatisch.
                          if (ph) onEditPharmacy(ph);
                          else if (s.id) onEditPharmacy({ id: s.id, name: s.name });
                        }}
                        title="Apotheek bewerken"
                        className="w-8 h-8 rounded-xl bg-[#f2f4f6] flex items-center justify-center text-[#3d4945] hover:bg-[#5dc0a7]/20 hover:text-[#006b5a] transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => onSelectPharmacy(s.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-[#bccac4] hover:text-[#006b5a] transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-display font-black text-[#3d4945]/60 uppercase tracking-widest">Bezorgpercentage</span>
                    <span className={`text-xs font-display font-black ${rateColor(s.deliveryRate)}`}>{Math.round(s.deliveryRate)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#f2f4f6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.deliveryRate}%`, background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-[9px] font-display font-black uppercase tracking-widest">
                  <span className="text-[#006b5a]">{s.delivered} bezorgd</span>
                  <span className="text-[#bccac4]">|</span>
                  <span className="text-[#3d4945]/60">{s.pending} open</span>
                  {s.returned > 0 && (
                    <>
                      <span className="text-[#bccac4]">|</span>
                      <span className="text-amber-600">{s.returned} retour</span>
                    </>
                  )}
                  {s.failed > 0 && (
                    <>
                      <span className="text-[#bccac4]">|</span>
                      <span className="text-red-500">{s.failed} mislukt</span>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 pt-4 flex-wrap gap-y-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-xs font-display font-black uppercase tracking-widest bg-white rounded-full text-[#3d4945] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
            >
              Vorige
            </button>
            {paginationButtons().map((b, i) =>
              b === '...' ? (
                <span key={`e${i}`} className="text-[#3d4945]/40 text-xs font-display font-black px-1">…</span>
              ) : (
                <button
                  key={b}
                  onClick={() => setPage(b as number)}
                  className={`w-9 h-9 text-xs font-display font-black rounded-full transition-all ${b === page ? 'text-white' : 'bg-white text-[#3d4945]'}`}
                  style={b === page ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : { boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
                >
                  {(b as number) + 1}
                </button>
              )
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-4 py-2 text-xs font-display font-black uppercase tracking-widest bg-white rounded-full text-[#3d4945] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
            >
              Volgende
            </button>
          </div>
        )}
      </div>

    {/* ── Nieuwe apotheek modal ───────────────────────────────── */}
    {showAddModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="bg-white rounded-4xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300"
          style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.20)' }}>
          <div className="flex items-center justify-between px-7 pt-7 pb-5">
            <div>
              <h2 className="text-xl font-display font-black text-[#191c1e]">Nieuwe apotheek</h2>
              <p className="text-[10px] font-display font-black text-[#3d4945]/60 uppercase tracking-widest mt-0.5">Toevoegen aan het netwerk</p>
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center text-[#3d4945] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="px-7 py-6 space-y-4">
            {[
              { label: 'Naam apotheek', placeholder: 'bijv. Apotheek de Kroon', val: newName,        set: setNewName,        required: true },
              { label: 'Straat',        placeholder: 'bijv. Hoofdstraat',       val: newStreet,      set: setNewStreet,      required: false },
              { label: 'Huisnummer',    placeholder: 'bijv. 12A',               val: newHouseNumber, set: setNewHouseNumber, required: false },
              { label: 'Postcode',      placeholder: 'bijv. 1234 AB',           val: newPostalCode,  set: setNewPostalCode,  required: false },
              { label: 'Plaats',        placeholder: 'bijv. Hilversum',         val: newCity,        set: setNewCity,        required: false },
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
                  autoFocus={f.required}
                  className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                  style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.2)' }}
                  onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                  onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.2)'}
                />
              </div>
            ))}

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
                  value={newGroupId}
                  onChange={e => setNewGroupId(e.target.value)}
                  className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none"
                  style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.2)' }}
                >
                  <option value="">— Geen groep —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
            </div>

            {duplicateMatches.length > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs font-bold text-amber-800">
                    Er bestaat al {duplicateMatches.length === 1 ? 'een apotheek' : `${duplicateMatches.length} apotheken`} met deze naam. Controleer of dit een duplicaat is.
                  </p>
                </div>
                <div className="space-y-2">
                  {duplicateMatches.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#191c1e] truncate">{p.name}</div>
                        <div className="text-[11px] text-[#3d4945]/70 truncate">{p.address || 'geen adres'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openExisting(p)}
                        className="shrink-0 px-3 h-9 rounded-full bg-[#006b5a] text-white text-xs font-bold active:scale-95 transition-all"
                      >
                        Openen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-12 rounded-full font-display font-semibold text-sm text-[#101c30] bg-[#d7e2fe] transition-all active:scale-95"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="flex-1 h-12 rounded-full text-white font-display font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
                style={{ background: duplicateMatches.length > 0 ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
              >
                {adding ? <Loader2 size={16} className="animate-spin" /> : (duplicateMatches.length > 0 ? <AlertCircle size={16} /> : <Plus size={16} />)}
                {adding ? 'Opslaan...' : (duplicateMatches.length > 0 ? 'Toch toevoegen' : 'Toevoegen')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
  );
};

export default PharmacyOverview;
