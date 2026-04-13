import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, Pharmacy } from '../types';
import {
  Building2, Search, ChevronRight, Package,
  CheckCircle, CreditCard, X, Download, AlertCircle, Plus, Loader2,
} from 'lucide-react';

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

interface PharmacyStat {
  id:           string;
  name:         string;
  total:        number;
  delivered:    number;
  pending:      number;
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
}

const rateColor = (rate: number) =>
  rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-red-500';

const rateBg = (rate: number) =>
  rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-400';

const PharmacyOverview: React.FC<PharmacyOverviewProps> = ({
  packages, pharmacies, onSelectPharmacy, onExport, canAddPharmacy, onAddPharmacy,
}) => {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(0);

  // ── Nieuwe apotheek modal ──────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName]           = useState('');
  const [newAddress, setNewAddress]     = useState('');
  const [newGroupId, setNewGroupId]     = useState('');
  const [adding, setAdding]             = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !onAddPharmacy) return;
    const newPharmacy: Pharmacy = {
      id:      `ph-${Date.now()}`,
      name:    newName.trim(),
      address: newAddress.trim() || undefined,
      groupId: newGroupId.trim() || undefined,
    };
    setAdding(true);
    try {
      await onAddPharmacy(newPharmacy);
      setShowAddModal(false);
      setNewName('');
      setNewAddress('');
      setNewGroupId('');
    } finally {
      setAdding(false);
    }
  };

  // ── Global stats ──────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const activePkgs = packages.filter(p => p.status !== PackageStatus.SCANNING);
    const delivered  = packages.filter(p => DELIVERED_STATUSES.has(p.status)).length;
    return {
      pharmacyCount: pharmacies.length,
      total:    activePkgs.length,
      delivered,
    };
  }, [packages, pharmacies]);

  // ── Per-pharmacy stats (worst delivery rate first) ─────────────
  const pharmacyStats = useMemo((): PharmacyStat[] => {
    const map = new Map<string, PharmacyStat>();

    pharmacies.forEach(ph =>
      map.set(ph.id, { id: ph.id, name: ph.name, total: 0, delivered: 0, pending: 0, failed: 0, deliveryRate: 0 })
    );

    packages.forEach(p => {
      if (p.status === PackageStatus.SCANNING) return;
      if (!map.has(p.pharmacyId)) {
        map.set(p.pharmacyId, { id: p.pharmacyId, name: p.pharmacyName, total: 0, delivered: 0, pending: 0, failed: 0, deliveryRate: 0 });
      }
      const s = map.get(p.pharmacyId)!;
      s.total++;
      if (DELIVERED_STATUSES.has(p.status)) s.delivered++;
      else if (PENDING_STATUSES.has(p.status)) s.pending++;
      else s.failed++;
    });

    return [...map.values()]
      .filter(s => s.total > 0)
      .map(s => ({ ...s, deliveryRate: (s.delivered / s.total) * 100 }))
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
          { label: 'Apotheken', val: globalStats.pharmacyCount, icon: Building2,   color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Pakketten', val: globalStats.total,         icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Bezorgd',   val: globalStats.delivered,     icon: CheckCircle, color: 'text-emerald-600',bg: 'bg-emerald-50'},
          { label: 'Omzet', val: '—', icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white p-5 lg:p-6 rounded-4xl border border-slate-200 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-4`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-black text-slate-900 leading-none">{s.val}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Zoek apotheek..."
          className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-10 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 shadow-sm"
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
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filtered.length} apothe{filtered.length === 1 ? 'ek' : 'ken'} — slechtste bezorgpercentage eerst
          </p>
          <div className="flex items-center gap-3">
            {totalPages > 1 && (
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Pagina {page + 1} / {totalPages}
              </p>
            )}
            {canAddPharmacy && onAddPharmacy && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 h-9 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Plus size={13} />
                Nieuwe apotheek
              </button>
            )}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-4 h-9 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-xs hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
              >
                <Download size={13} />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="bg-white rounded-4xl border border-slate-200 p-16 text-center">
            <AlertCircle size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-bold text-sm">
              {pharmacies.length === 0 ? 'Geen apotheken beschikbaar' : 'Geen apotheken gevonden'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pageItems.map(s => (
              <button
                key={s.id}
                onClick={() => onSelectPharmacy(s.id)}
                className="bg-white border border-slate-200 rounded-4xl p-6 text-left hover:border-indigo-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base leading-tight">{s.name}</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                        {s.total} pakket{s.total !== 1 ? 'ten' : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors mt-1 shrink-0" />
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bezorgpercentage</span>
                    <span className={`text-xs font-black ${rateColor(s.deliveryRate)}`}>{Math.round(s.deliveryRate)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${rateBg(s.deliveryRate)}`}
                      style={{ width: `${s.deliveryRate}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-[9px] font-black uppercase tracking-widest">
                  <span className="text-emerald-600">{s.delivered} bezorgd</span>
                  <span className="text-slate-200">|</span>
                  <span className="text-indigo-600">{s.pending} open</span>
                  {s.failed > 0 && (
                    <>
                      <span className="text-slate-200">|</span>
                      <span className="text-red-500">{s.failed} mislukt</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 pt-4 flex-wrap gap-y-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Vorige
            </button>
            {paginationButtons().map((b, i) =>
              b === '...' ? (
                <span key={`e${i}`} className="text-slate-400 text-xs font-black px-1">…</span>
              ) : (
                <button
                  key={b}
                  onClick={() => setPage(b as number)}
                  className={`w-9 h-9 text-xs font-black rounded-xl transition-colors ${b === page ? 'bg-indigo-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {(b as number) + 1}
                </button>
              )
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Volgende
            </button>
          </div>
        )}
      </div>

    {/* ── Nieuwe apotheek modal ───────────────────────────────── */}
    {showAddModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-4xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-900">Nieuwe apotheek</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Toevoegen aan het netwerk</p>
            </div>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleAddSubmit} className="px-7 py-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Naam apotheek <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="bijv. Apotheek de Kroon"
                required
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Adres
              </label>
              <input
                type="text"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                placeholder="bijv. Hoofdstraat 1, 1234 AB Amsterdam"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Groep / regio
              </label>
              <input
                type="text"
                value={newGroupId}
                onChange={e => setNewGroupId(e.target.value)}
                placeholder="bijv. regio-noord"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-12 rounded-2xl border border-slate-200 font-black text-sm text-slate-600 hover:bg-slate-50 transition-all"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {adding ? 'Opslaan...' : 'Toevoegen'}
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
