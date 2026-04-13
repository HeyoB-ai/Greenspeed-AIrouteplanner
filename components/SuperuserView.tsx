import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, Pharmacy } from '../types';
import {
  Building2, Search, ChevronRight, ArrowLeft, Package,
  CheckCircle, CreditCard, X, Download, AlertCircle,
} from 'lucide-react';
import ArchiveView from './ArchiveView';

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

const STATUS_STYLE: Record<string, string> = {
  [PackageStatus.SCANNING]:       'bg-blue-50 text-blue-500',
  [PackageStatus.PENDING]:        'bg-slate-100 text-slate-500',
  [PackageStatus.ASSIGNED]:       'bg-indigo-100 text-indigo-600',
  [PackageStatus.PICKED_UP]:      'bg-indigo-100 text-indigo-600',
  [PackageStatus.DELIVERED]:      'bg-emerald-100 text-emerald-600',
  [PackageStatus.MAILBOX]:        'bg-emerald-100 text-emerald-600',
  [PackageStatus.NEIGHBOUR]:      'bg-blue-100 text-blue-700',
  [PackageStatus.RETURN]:         'bg-amber-100 text-amber-700',
  [PackageStatus.FAILED]:         'bg-red-100 text-red-600',
  [PackageStatus.BILLED]:         'bg-slate-100 text-slate-400',
  [PackageStatus.MOVED]:          'bg-purple-100 text-purple-700',
  [PackageStatus.OTHER_LOCATION]: 'bg-sky-100 text-sky-700',
};

interface PharmacyStat {
  id: string;
  name: string;
  total: number;
  delivered: number;
  pending: number;
  failed: number;
  deliveryRate: number; // 0–100
}

interface Props {
  packages: PackageType[];
  pharmacies: Pharmacy[];
  onUpdateStatus: (ids: string[], status: PackageStatus) => void;
}

const rateColor = (rate: number) =>
  rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-red-500';

const rateBg = (rate: number) =>
  rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-400' : 'bg-red-400';

const SuperuserView: React.FC<Props> = ({ packages, pharmacies, onUpdateStatus }) => {
  const [search, setSearch]                   = useState('');
  const [page, setPage]                       = useState(0);
  const [selectedPharmacyId, setSelected]     = useState<string | null>(null);
  const [detailTab, setDetailTab]             = useState<'packages' | 'archive'>('packages');
  const [courierFilter, setCourierFilter]     = useState<string | null>(null);

  // ── Global stats ───────────────────────────────────────────────
  const globalStats = useMemo(() => {
    const activePkgs = packages.filter(p => p.status !== PackageStatus.SCANNING);
    const delivered  = packages.filter(p => DELIVERED_STATUSES.has(p.status)).length;
    return {
      pharmacyCount: new Set(packages.map(p => p.pharmacyId)).size,
      total: activePkgs.length,
      delivered,
      revenue: delivered * 4.5,
    };
  }, [packages]);

  // ── Per-pharmacy stats (sorted: worst delivery rate first) ─────
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
      .sort((a, b) => a.deliveryRate - b.deliveryRate); // worst first
  }, [packages, pharmacies]);

  // ── Search + pagination ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pharmacyStats.filter(s => s.name.toLowerCase().includes(q)) : pharmacyStats;
  }, [pharmacyStats, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Detail view ────────────────────────────────────────────────
  const selectedPharmacy = selectedPharmacyId
    ? (pharmacies.find(p => p.id === selectedPharmacyId) ?? { id: selectedPharmacyId, name: 'Onbekend' })
    : null;

  const pharmacyPackages = useMemo(() => {
    if (!selectedPharmacyId) return [];
    return packages
      .filter(p => p.pharmacyId === selectedPharmacyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [packages, selectedPharmacyId]);

  const pharmCouriers = useMemo(() => {
    const seen = new Map<string, string>();
    pharmacyPackages.forEach(p => {
      if (p.courierId && !seen.has(p.courierId))
        seen.set(p.courierId, p.courierName ?? p.courierId);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [pharmacyPackages]);

  const filteredDetail = useMemo(() =>
    courierFilter ? pharmacyPackages.filter(p => p.courierId === courierFilter) : pharmacyPackages,
    [pharmacyPackages, courierFilter]
  );

  const detailStats = useMemo(() => {
    const total     = pharmacyPackages.filter(p => p.status !== PackageStatus.SCANNING).length;
    const delivered = pharmacyPackages.filter(p => DELIVERED_STATUSES.has(p.status)).length;
    const pending   = pharmacyPackages.filter(p => PENDING_STATUSES.has(p.status)).length;
    const failed    = total - delivered - pending;
    return { total, delivered, pending, failed: Math.max(0, failed), rate: total > 0 ? Math.round((delivered / total) * 100) : 0 };
  }, [pharmacyPackages]);

  const openPharmacy = (id: string) => {
    setSelected(id);
    setDetailTab('packages');
    setCourierFilter(null);
  };

  const closePharmacy = () => {
    setSelected(null);
    setCourierFilter(null);
  };

  const exportToCSV = () => {
    if (!selectedPharmacy) return;
    const headers = ['ID', 'Adres', 'Postcode', 'Stad', 'Status', 'Koerier', 'Aangemaakt', 'Bezorgd'];
    const rows = pharmacyPackages.map(p => [
      p.id,
      `${p.address.street} ${p.address.houseNumber}`,
      p.address.postalCode,
      p.address.city,
      p.status,
      p.courierName ?? '',
      p.createdAt,
      p.deliveredAt ?? '',
    ]);
    const csv  = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href     = encodeURI(csv);
    link.download = `${selectedPharmacy.name}_${new Date().toLocaleDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Pagination buttons with ellipsis ──────────────────────────
  const paginationButtons = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const btns: (number | '...')[] = [0];
    if (page > 2) btns.push('...');
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) btns.push(i);
    if (page < totalPages - 3) btns.push('...');
    btns.push(totalPages - 1);
    return btns;
  };

  // ── Layer 2: Pharmacy Detail ───────────────────────────────────
  if (selectedPharmacy) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={closePharmacy}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900">{selectedPharmacy.name}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apotheek detail</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Totaal',      val: detailStats.total,     color: 'text-slate-900',   bg: 'bg-slate-50'   },
            { label: 'Bezorgd',     val: detailStats.delivered, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Openstaand',  val: detailStats.pending,   color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
            {
              label: 'Geslaagd %',
              val: `${detailStats.rate}%`,
              color: rateColor(detailStats.rate),
              bg: 'bg-white',
            },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border border-slate-200 rounded-3xl p-5`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tab card */}
        <div className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-2 flex border-b border-slate-100 bg-slate-50/50">
            {(['packages', 'archive'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${detailTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab === 'packages' ? 'Pakketten' : 'Archief'}
              </button>
            ))}
          </div>

          {detailTab === 'archive' && (
            <div className="p-6">
              <ArchiveView packages={pharmacyPackages} pharmacyId={selectedPharmacyId ?? undefined} />
            </div>
          )}

          {detailTab === 'packages' && (
            <>
              {/* Courier filter + CSV export */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={() => setCourierFilter(null)}
                    className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${!courierFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    Alle
                  </button>
                  {pharmCouriers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCourierFilter(c.id === courierFilter ? null : c.id)}
                      className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${courierFilter === c.id ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={exportToCSV}
                  className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Download size={13} className="text-slate-500" />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">CSV</span>
                </button>
              </div>

              {/* Package list */}
              <div className="divide-y divide-slate-100">
                {filteredDetail.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold text-sm">Geen pakketten</div>
                ) : (
                  filteredDetail.map(p => (
                    <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center space-x-3 min-w-0">
                        {p.scanNumber && (
                          <span className="shrink-0 w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center text-[10px] font-black">
                            {p.scanNumber}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-sm truncate">
                            {p.address.street} {p.address.houseNumber}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {p.address.postalCode} {p.address.city}
                            {p.courierName && <> · {p.courierName}</>}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 ml-3 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${STATUS_STYLE[p.status] ?? 'bg-slate-100 text-slate-400'}`}>
                        {p.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Layer 1: Pharmacy Overview ─────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-24 lg:pb-8">
      {/* Global stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Apotheken', val: globalStats.pharmacyCount, icon: Building2,   color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Pakketten', val: globalStats.total,         icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Bezorgd',   val: globalStats.delivered,     icon: CheckCircle, color: 'text-emerald-600',bg: 'bg-emerald-50'},
          { label: 'Omzet',     val: `€${globalStats.revenue.toFixed(2)}`, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* List header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filtered.length} apothe{filtered.length === 1 ? 'ek' : 'ken'} — slechtste bezorgpercentage eerst
          </p>
          {totalPages > 1 && (
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Pagina {page + 1} / {totalPages}
            </p>
          )}
        </div>

        {/* Pharmacy cards */}
        {pageItems.length === 0 ? (
          <div className="bg-white rounded-4xl border border-slate-200 p-16 text-center">
            <AlertCircle size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-bold text-sm">Geen apotheken gevonden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pageItems.map(s => (
              <button
                key={s.id}
                onClick={() => openPharmacy(s.id)}
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

                {/* Delivery rate bar */}
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

                {/* Mini stats */}
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
    </div>
  );
};

export default SuperuserView;
