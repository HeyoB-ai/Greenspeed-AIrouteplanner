import React, { useState } from 'react';
import {
  Package, Scan, MapPin, ArrowRight, CheckCircle2, ListChecks, Map,
  Loader2, RefreshCw, Building2, MousePointerClick, Truck, ShieldCheck, Clock
} from 'lucide-react';
import { Package as PackageType, PackageStatus } from '../types';
import ChatBot from './ChatBot';

interface Props {
  packages: PackageType[];
  onScanStart: () => void;
  onManualAdd?: () => void;
  onOptimize?: (selectedIds: string[]) => void;
  isOptimizing?: boolean;
  pharmacyName: string;
}

const STATUS_STYLE: Record<string, string> = {
  [PackageStatus.SCANNING]:  'bg-blue-50 text-blue-600',
  [PackageStatus.PENDING]:   'bg-amber-100 text-amber-700',
  [PackageStatus.ASSIGNED]:  'bg-indigo-100 text-indigo-700',
  [PackageStatus.PICKED_UP]: 'bg-indigo-100 text-indigo-700',
  [PackageStatus.DELIVERED]: 'bg-emerald-100 text-emerald-700',
  [PackageStatus.MAILBOX]:   'bg-emerald-100 text-emerald-700',
  [PackageStatus.NEIGHBOUR]: 'bg-blue-100 text-blue-700',
  [PackageStatus.RETURN]:    'bg-amber-100 text-amber-700',
  [PackageStatus.FAILED]:    'bg-red-100 text-red-600',
  [PackageStatus.BILLED]:    'bg-purple-100 text-purple-700',
};

const PharmacyView: React.FC<Props> = ({
  packages,
  onScanStart,
  onManualAdd,
  onOptimize,
  isOptimizing,
  pharmacyName,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingPackages = packages.filter(p => p.status === PackageStatus.PENDING);
  const activeScansCount = packages.filter(p => p.status === PackageStatus.SCANNING).length;

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const selectAll = () =>
    setSelectedIds(selectedIds.length === pendingPackages.length ? [] : pendingPackages.map(p => p.id));

  const sorted = [...packages].sort((a, b) => {
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
    if (a.orderIndex !== undefined) return -1;
    if (b.orderIndex !== undefined) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // ── Stats ────────────────────────────────────────────────────────
  const stats = [
    { label: 'Totaal',      val: packages.length,                                                          icon: Package,     color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'In transit',  val: packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP).length, icon: Truck,       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: 'Bezorgd',     val: packages.filter(p => p.status === PackageStatus.DELIVERED).length,        icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Wachten',     val: pendingPackages.length,                                                   icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50' },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

      {/* ── Stats rij ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-black text-slate-900 leading-none">{s.val}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Scan actief indicator ── */}
      {activeScansCount > 0 && (
        <div className="bg-slate-900 rounded-3xl p-5 text-white border border-blue-500/30 flex items-center space-x-4">
          <RefreshCw className="animate-spin text-blue-400 shrink-0" size={22} />
          <div>
            <p className="text-sm font-black">{activeScansCount} scans in verwerking…</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">AI analyseert op de achtergrond</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Acties kolom ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Scan knop */}
          <div className="bg-blue-600 rounded-4xl p-7 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="bg-white/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-5">
                <Scan size={22} />
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-1 text-white">Scannen</h2>
              <p className="text-blue-100 text-sm font-medium mb-6 leading-relaxed">
                Scan labels snel achter elkaar.
              </p>
              <button
                onClick={onScanStart}
                className="w-full bg-white text-blue-600 h-12 rounded-2xl font-black text-base shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <span>Start Scanner</span>
                <ArrowRight size={18} />
              </button>
              {onManualAdd && (
                <button
                  onClick={onManualAdd}
                  className="w-full mt-3 text-blue-200 hover:text-white text-xs font-bold transition-colors text-center py-1"
                >
                  ✏ Handmatig adres invoeren
                </button>
              )}
            </div>
            <Package className="absolute -bottom-10 -right-10 w-40 h-40 text-white/10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
          </div>

          {/* Route plannen */}
          {onOptimize && pendingPackages.length > 0 && (
            <div className="bg-indigo-900 rounded-4xl p-7 text-white shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <ListChecks size={24} />
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">
                  {selectedIds.length} geselecteerd
                </span>
              </div>
              <h3 className="text-lg font-black mb-1">Route Plannen</h3>
              <p className="text-indigo-200 text-xs mb-5 font-medium">
                Selecteer adressen voor routeoptimalisatie.
              </p>
              <div className="space-y-2">
                <button
                  onClick={selectAll}
                  className="w-full bg-indigo-800/50 text-indigo-100 h-11 rounded-xl font-bold text-xs hover:bg-indigo-800 border border-indigo-700 flex items-center justify-center space-x-2 transition-all"
                >
                  <MousePointerClick size={14} />
                  <span>{selectedIds.length === pendingPackages.length ? 'Selectie Wissen' : 'Selecteer Alles'}</span>
                </button>
                <button
                  onClick={() => onOptimize?.(selectedIds)}
                  disabled={isOptimizing || selectedIds.length === 0}
                  className="w-full bg-indigo-500 text-white h-12 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-400 transition-all"
                >
                  {isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Map size={18} />}
                  <span>{isOptimizing ? 'Berekenen…' : 'Start Route Planning'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Pakkettenlijst ── */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-900 lg:text-xl">Zendingen</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {pendingPackages.length} WACHTEN OP PLANNING
                </p>
              </div>
              {pendingPackages.length > 0 && (
                <button
                  onClick={selectAll}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-tighter hover:underline"
                >
                  {selectedIds.length === pendingPackages.length ? 'Deselecteer alles' : 'Alles selecteren'}
                </button>
              )}
            </div>

            {packages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Package className="text-slate-200" size={32} />
                </div>
                <p className="text-slate-900 font-black">Geen pakketten</p>
                <p className="text-slate-400 text-sm font-medium mt-1">Gebruik de scanner om zendingen toe te voegen.</p>
              </div>
            ) : (
              <>
                {/* Desktop: tabel */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-8"></th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Adres</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Apotheek</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sorted.map(p => (
                        <tr
                          key={p.id}
                          onClick={() => p.status === PackageStatus.PENDING && toggleSelect(p.id)}
                          className={`transition-colors cursor-pointer hover:bg-slate-50 ${
                            selectedIds.includes(p.id) ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            {p.displayIndex ? (
                              <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs">
                                {p.displayIndex}
                              </div>
                            ) : p.status === PackageStatus.SCANNING ? (
                              <RefreshCw className="animate-spin text-blue-400" size={16} />
                            ) : p.status === PackageStatus.PENDING ? (
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                              }`}>
                                {selectedIds.includes(p.id) && <CheckCircle2 size={12} className="text-white" />}
                              </div>
                            ) : (
                              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                                <MapPin size={14} className="text-slate-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-extrabold text-sm text-slate-900">
                              {p.address.street} {p.address.houseNumber}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                              {p.address.postalCode} {p.address.city}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-1 text-[10px] font-black text-blue-500 uppercase">
                              <Building2 size={10} />
                              <span>{p.pharmacyName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              STATUS_STYLE[p.status] || 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobiel: kaarten */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {sorted.map(p => (
                    <div
                      key={p.id}
                      onClick={() => p.status === PackageStatus.PENDING && toggleSelect(p.id)}
                      className={`px-4 py-4 flex items-center justify-between transition-colors cursor-pointer ${
                        selectedIds.includes(p.id) ? 'bg-blue-50/50' : ''
                      } ${p.status === PackageStatus.SCANNING ? 'animate-pulse bg-slate-50' : ''}`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {p.displayIndex ? (
                          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                            {p.displayIndex}
                          </div>
                        ) : p.status === PackageStatus.SCANNING ? (
                          <RefreshCw className="animate-spin text-blue-400 shrink-0" size={22} />
                        ) : p.status === PackageStatus.PENDING ? (
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                            selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {selectedIds.includes(p.id) && <CheckCircle2 size={13} />}
                          </div>
                        ) : (
                          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                            <MapPin size={18} className="text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`font-extrabold text-sm truncate ${
                            p.status === PackageStatus.SCANNING ? 'text-blue-400 italic' : 'text-slate-900'
                          }`}>
                            {p.address.street} {p.address.houseNumber}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                            {p.address.postalCode} {p.address.city}
                          </p>
                        </div>
                      </div>
                      <span className={`ml-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${
                        STATUS_STYLE[p.status] || 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ChatBot */}
      <ChatBot
        packages={packages.filter(p => p.pharmacyName === pharmacyName)}
        pharmacyName={pharmacyName}
      />
    </div>
  );
};

export default PharmacyView;
