import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus } from '../types';
import {
  Package, Truck, CheckCircle2, AlertTriangle, Download, Scan,
  ArrowRight, Map, Loader2, ListChecks, MousePointerClick, UserPlus,
  MapPin, Building2, RefreshCw
} from 'lucide-react';
import ChatBot from './ChatBot';

interface Props {
  packages: PackageType[];
  pharmacyName: string;
  onScanStart: () => void;
  onOptimize: (selectedIds: string[]) => void;
  isOptimizing: boolean;
}

const AdminView: React.FC<Props> = ({ packages, pharmacyName, onScanStart, onOptimize, isOptimizing }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const today = new Date().toDateString();

  const todayPackages   = packages.filter(p => new Date(p.createdAt).toDateString() === today);
  const inTransit       = packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP);
  const delivered       = packages.filter(p => p.status === PackageStatus.DELIVERED);
  const failed          = packages.filter(p => p.status === PackageStatus.FAILED);
  const pending         = packages.filter(p => p.status === PackageStatus.PENDING);

  const stats = [
    { label: 'Vandaag ingevoerd', val: todayPackages.length,  icon: Package,       color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'In transit',        val: inTransit.length,      icon: Truck,         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: 'Afgeleverd',        val: delivered.length,      icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Mislukt',           val: failed.length,         icon: AlertTriangle, color: 'text-red-500',     bg: 'bg-red-50' },
  ];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === pending.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pending.map(p => p.id));
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Adres', 'Huisnummer', 'Postcode', 'Stad', 'Status', 'Aangemaakt', 'Bezorgd'];
    const rows = packages.map(p => [
      p.id,
      p.address.street,
      p.address.houseNumber,
      p.address.postalCode,
      p.address.city,
      p.status,
      p.createdAt,
      p.deliveredAt || '',
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `${pharmacyName}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCourier = () => {
    const name = prompt('Naam van de nieuwe koerier:');
    if (name) {
      alert(`Koerier "${name}" aangemaakt (demo — opgeslagen als hardcoded user in authService).`);
    }
  };

  const sorted = useMemo(() =>
    [...packages].sort((a, b) => {
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
      if (a.orderIndex !== undefined) return -1;
      if (b.orderIndex !== undefined) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [packages]
  );

  return (
    <>
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-4xl p-6 shadow-sm">
            <div className={`w-12 h-12 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center mb-4`}>
              <s.icon size={24} />
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none">{s.val}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Actions column */}
        <div className="lg:col-span-1 space-y-4">

          {/* Scan */}
          <div className="bg-blue-600 rounded-4xl p-7 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                <Scan size={20} />
              </div>
              <h3 className="text-xl font-black mb-1">Nieuw pakket</h3>
              <p className="text-blue-100 text-xs mb-5 font-medium">Scan een label om een pakket toe te voegen.</p>
              <button
                onClick={onScanStart}
                className="w-full bg-white text-blue-600 py-3 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>Start Scanner</span>
                <ArrowRight size={16} />
              </button>
            </div>
            <Package className="absolute -bottom-8 -right-8 w-36 h-36 text-white/10 rotate-12" />
          </div>

          {/* Route plannen */}
          {pending.length > 0 && (
            <div className="bg-indigo-900 rounded-4xl p-7 text-white shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <ListChecks size={24} />
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">{selectedIds.length} geselecteerd</span>
              </div>
              <h3 className="text-lg font-black mb-1">Route plannen</h3>
              <p className="text-indigo-200 text-xs mb-5 font-medium">Selecteer adressen voor routeoptimalisatie.</p>
              <div className="space-y-2">
                <button
                  onClick={selectAll}
                  className="w-full bg-indigo-800/50 text-indigo-100 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-800 border border-indigo-700 flex items-center justify-center space-x-2 transition-all"
                >
                  <MousePointerClick size={14} />
                  <span>{selectedIds.length === pending.length ? 'Selectie wissen' : 'Selecteer alles'}</span>
                </button>
                <button
                  onClick={() => onOptimize(selectedIds)}
                  disabled={isOptimizing || selectedIds.length === 0}
                  className="w-full bg-indigo-500 text-white py-3 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-400 transition-all"
                >
                  {isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Map size={18} />}
                  <span>{isOptimizing ? 'Berekenen...' : 'Optimaliseer Route'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Beheer */}
          <div className="bg-white border border-slate-200 rounded-4xl p-6 space-y-3 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Beheer</h3>
            <button
              onClick={handleAddCourier}
              className="w-full flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm text-slate-700 transition-all active:scale-95"
            >
              <UserPlus size={18} className="text-indigo-500" />
              <span>Koerier toevoegen</span>
            </button>
            <button
              onClick={exportCSV}
              className="w-full flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-sm text-slate-700 transition-all active:scale-95"
            >
              <Download size={18} className="text-emerald-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Package list */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-7 border-b border-slate-100 bg-slate-50/50 flex justify-between items-end">
              <div>
                <h3 className="text-lg font-black text-slate-900">Zendingen</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {packages.length} totaal • {pending.length} wachten
                </p>
              </div>
              {pending.length > 0 && (
                <button onClick={selectAll} className="text-[10px] font-black text-blue-600 uppercase tracking-tighter hover:underline">
                  {selectedIds.length === pending.length ? 'Deselecteer alles' : 'Alles selecteren'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[400px]">
              {packages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Package className="text-slate-200" size={32} />
                  </div>
                  <p className="text-slate-900 font-black">Geen pakketten</p>
                  <p className="text-slate-400 text-sm font-medium mt-1">Scan een label om te beginnen.</p>
                </div>
              ) : (
                sorted.map(p => (
                  <div
                    key={p.id}
                    onClick={() => p.status === PackageStatus.PENDING && toggleSelect(p.id)}
                    className={`group bg-white border rounded-2xl p-5 flex items-center justify-between transition-all cursor-pointer ${
                      selectedIds.includes(p.id)
                        ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-500/20'
                        : 'border-slate-100 hover:border-slate-300'
                    } ${p.status === PackageStatus.SCANNING ? 'animate-pulse bg-slate-50 border-blue-200' : ''}`}
                  >
                    <div className="flex items-center space-x-4">
                      {p.displayIndex ? (
                        <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm shadow">
                          {p.displayIndex}
                        </div>
                      ) : p.status === PackageStatus.SCANNING ? (
                        <RefreshCw className="animate-spin text-blue-400" size={20} />
                      ) : (
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedIds.includes(p.id) && <CheckCircle2 size={12} />}
                        </div>
                      )}
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 tracking-tight">
                          {p.address.street} {p.address.houseNumber}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {p.address.postalCode} {p.address.city}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      p.status === PackageStatus.SCANNING  ? 'bg-blue-50 text-blue-600' :
                      p.status === PackageStatus.PENDING   ? 'bg-amber-100 text-amber-700' :
                      p.status === PackageStatus.ASSIGNED  ? 'bg-indigo-100 text-indigo-700' :
                      p.status === PackageStatus.DELIVERED ? 'bg-emerald-100 text-emerald-700' :
                      p.status === PackageStatus.FAILED    ? 'bg-red-100 text-red-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <ChatBot packages={packages} pharmacyName={pharmacyName} />
    </>
  );
};

export default AdminView;
