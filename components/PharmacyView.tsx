
import React, { useState } from 'react';
import { Package, Scan, MapPin, ArrowRight, CheckCircle2, ListChecks, Map, Loader2, RefreshCw, Building2, MousePointerClick } from 'lucide-react';
import { Package as PackageType, PackageStatus } from '../types';

interface Props {
  packages: PackageType[];
  onScanStart: () => void;
  onOptimize: (selectedIds: string[]) => void;
  isOptimizing: boolean;
}

const PharmacyView: React.FC<Props> = ({ packages, onScanStart, onOptimize, isOptimizing }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingPackages = packages.filter(p => p.status === PackageStatus.PENDING);
  const activeScansCount = packages.filter(p => p.status === PackageStatus.SCANNING).length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === pendingPackages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingPackages.map(p => p.id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Action Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-blue-600 rounded-4xl p-8 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="relative z-10">
              <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                <Scan size={24} />
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-2 text-white">Scannen</h2>
              <p className="text-blue-100 text-sm font-medium mb-8 leading-relaxed">
                Scan labels snel achter elkaar. De AI haalt adressen er automatisch uit.
              </p>
              <button 
                onClick={onScanStart}
                className="w-full bg-white text-blue-600 py-4 rounded-2xl font-black text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center space-x-3"
              >
                <span>Start Scanner</span>
                <ArrowRight size={20} />
              </button>
            </div>
            <Package className="absolute -bottom-10 -right-10 w-48 h-48 text-white/10 rotate-12 group-hover:rotate-45 transition-transform duration-1000" />
          </div>

          {activeScansCount > 0 && (
            <div className="bg-slate-900 rounded-4xl p-6 text-white animate-pulse border border-blue-500/30">
              <div className="flex items-center space-x-4">
                <RefreshCw className="animate-spin text-blue-400" size={24} />
                <div>
                  <p className="text-sm font-black tracking-tight">{activeScansCount} scans in verwerking...</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">AI Analyseert op de achtergrond</p>
                </div>
              </div>
            </div>
          )}

          {pendingPackages.length > 0 && (
            <div className="bg-indigo-900 rounded-4xl p-8 text-white shadow-xl animate-in slide-in-from-left duration-500">
              <div className="flex items-center justify-between mb-6">
                <ListChecks size={28} />
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">{selectedIds.length} geselecteerd</span>
              </div>
              <h3 className="text-xl font-black mb-2">Route Plannen</h3>
              <p className="text-indigo-200 text-xs mb-6 font-medium">Selecteer adressen om de route te berekenen.</p>
              
              <div className="space-y-3">
                <button 
                  onClick={selectAll}
                  className="w-full bg-indigo-800/50 text-indigo-100 py-3 rounded-xl font-bold text-xs hover:bg-indigo-800 transition-all flex items-center justify-center space-x-2 border border-indigo-700"
                >
                  <MousePointerClick size={14} />
                  <span>{selectedIds.length === pendingPackages.length ? 'Selectie Wissen' : 'Selecteer Alles'}</span>
                </button>
                
                <button 
                  onClick={() => onOptimize(selectedIds)}
                  disabled={isOptimizing || selectedIds.length === 0}
                  className="w-full bg-indigo-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all"
                >
                  {isOptimizing ? <Loader2 className="animate-spin" size={20} /> : <Map size={20} />}
                  <span>{isOptimizing ? 'Berekenen...' : 'Start Route Planning'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List Column */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-end">
              <div>
                <h3 className="text-xl font-black text-slate-900">Zendingen</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {pendingPackages.length} WACHTEN OP PLANNING
                </p>
              </div>
              {pendingPackages.length > 0 && (
                <button onClick={selectAll} className="text-[10px] font-black text-blue-600 uppercase tracking-tighter hover:underline">
                  {selectedIds.length === pendingPackages.length ? 'Deselecteer alles' : 'Alles selecteren'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[500px]">
              {packages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Package className="text-slate-200" size={40} />
                  </div>
                  <p className="text-slate-900 font-black text-lg">Geen pakketten</p>
                  <p className="text-slate-400 text-sm font-medium mt-1">Gebruik de scanner om zendingen toe te voegen.</p>
                </div>
              ) : (
                [...packages]
                  .sort((a, b) => {
                    if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
                    if (a.orderIndex !== undefined) return -1;
                    if (b.orderIndex !== undefined) return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => p.status === PackageStatus.PENDING && toggleSelect(p.id)}
                    className={`group bg-white border rounded-3xl p-6 flex items-center justify-between transition-all cursor-pointer ${
                      selectedIds.includes(p.id) ? 'border-blue-500 bg-blue-50/30 shadow-md ring-1 ring-blue-500/20' : 'border-slate-100 hover:border-slate-300'
                    } ${p.status === PackageStatus.SCANNING ? 'animate-pulse bg-slate-50 border-blue-200' : ''}`}
                  >
                    <div className="flex items-center space-x-5">
                      {p.displayIndex ? (
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-base shadow-lg animate-in zoom-in duration-500">
                          {p.displayIndex}
                        </div>
                      ) : p.status === PackageStatus.PENDING ? (
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedIds.includes(p.id) && <CheckCircle2 size={14} />}
                        </div>
                      ) : p.status === PackageStatus.SCANNING ? (
                        <RefreshCw className="animate-spin text-blue-400" size={24} />
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center">
                          <MapPin size={20} />
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className={`font-extrabold text-base tracking-tight ${p.status === PackageStatus.SCANNING ? 'text-blue-400 italic' : 'text-slate-900'}`}>
                            {p.address.street} {p.address.houseNumber}
                          </h4>
                          {p.trackingCode && (
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">
                              Code: {p.trackingCode}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.address.postalCode} {p.address.city}</p>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center space-x-1 text-[9px] font-black text-blue-500 uppercase">
                            <Building2 size={10} />
                            <span>{p.pharmacyName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      p.status === PackageStatus.SCANNING ? 'bg-blue-50 text-blue-600' :
                      p.status === PackageStatus.PENDING ? 'bg-amber-100 text-amber-700' : 
                      p.status === PackageStatus.ASSIGNED ? 'bg-indigo-100 text-indigo-700' :
                      p.status === PackageStatus.DELIVERED ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
  );
};

export default PharmacyView;
