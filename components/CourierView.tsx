import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import {
  Navigation, CheckCircle, Map as MapIcon, X, Clock, Check,
  RotateCcw, Pencil, Truck, ScanLine, PenLine, ArrowRight, Loader2,
  MousePointerClick, CheckCircle2, MapPin, DoorClosed, ChevronDown
} from 'lucide-react';
import NotHomeSheet from './NotHomeSheet';

interface Props {
  packages: PackageType[];
  onUpdate: (id: string, status: PackageStatus, evidence?: DeliveryEvidence) => void;
  onUpdateMany: (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => void;
  pharmacyName?: string;
  pharmacyAddress?: string;
  onScanStart?: () => void;
  onManualAdd?: () => void;
  onOptimize?: (selectedIds: string[]) => void;
  isOptimizing?: boolean;
}

// Stop interface — alleen gebruikt voor route-modal URL opbouw
interface Stop {
  addressKey: string;
  address: PackageType['address'];
  packages: PackageType[];
  orderIndex: number;
  displayIndex: number;
}

const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  [PackageStatus.SCANNING]:        { className: 'bg-blue-50 text-blue-600',        label: 'Analyseren'     },
  [PackageStatus.PENDING]:         { className: 'bg-amber-100 text-amber-700',     label: 'Wachten'        },
  [PackageStatus.ASSIGNED]:        { className: 'bg-indigo-100 text-indigo-700',   label: 'Toegewezen'     },
  [PackageStatus.PICKED_UP]:       { className: 'bg-indigo-100 text-indigo-700',   label: 'Opgehaald'      },
  [PackageStatus.DELIVERED]:       { className: 'bg-emerald-100 text-emerald-700', label: 'Bezorgd'        },
  [PackageStatus.MAILBOX]:         { className: 'bg-emerald-100 text-emerald-700', label: 'Brievenbus'     },
  [PackageStatus.NEIGHBOUR]:       { className: 'bg-blue-100 text-blue-700',       label: 'Bij buren'      },
  [PackageStatus.RETURN]:          { className: 'bg-amber-100 text-amber-700',     label: 'Retour'         },
  [PackageStatus.FAILED]:          { className: 'bg-red-100 text-red-600',         label: 'Mislukt'        },
  [PackageStatus.BILLED]:          { className: 'bg-purple-100 text-purple-700',   label: 'Gefactureerd'   },
  [PackageStatus.MOVED]:           { className: 'bg-purple-100 text-purple-700',   label: 'Verhuisd'       },
  [PackageStatus.OTHER_LOCATION]:  { className: 'bg-sky-100 text-sky-700',         label: 'Andere locatie' },
};

const StatusBadge: React.FC<{ status: PackageStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

const CourierView: React.FC<Props> = ({
  packages,
  onUpdateMany,
  pharmacyName = 'Apotheek',
  pharmacyAddress,
  onScanStart,
  onManualAdd,
  onOptimize,
  isOptimizing = false,
}) => {
  const [showMapModal, setShowMapModal]         = useState(false);
  const [isCapturingGPS, setIsCapturingGPS]     = useState<string | null>(null);
  const [returnToPharmacy, setReturnToPharmacy] = useState(false);
  const [editingReturn, setEditingReturn]       = useState(false);
  const [returnAddr, setReturnAddr]             = useState(pharmacyAddress || pharmacyName);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [notHomePkg, setNotHomePkg]             = useState<PackageType | null>(null);
  const [expandedId, setExpandedId]             = useState<string | null>(null);

  const delivered = packages.filter(p => p.status === PackageStatus.DELIVERED).length;

  // Actieve pakketten als platte lijst — gesorteerd op routeIndex → displayIndex → scanNumber
  const sortedPackages = useMemo(() => {
    const active = packages.filter(
      p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP
    );
    return [...active].sort((a, b) => {
      const aIdx = a.routeIndex ?? a.displayIndex ?? a.scanNumber ?? 999;
      const bIdx = b.routeIndex ?? b.displayIndex ?? b.scanNumber ?? 999;
      return aIdx - bIdx;
    });
  }, [packages]);

  // Stops — alleen voor Google Maps URL opbouw in de route-modal
  const stops: Stop[] = useMemo(() => {
    const stopsMap = new Map<string, Stop>();
    sortedPackages.forEach(p => {
      const key = `${p.address.street} ${p.address.houseNumber} ${p.address.postalCode}`.toLowerCase().trim();
      const existing = stopsMap.get(key);
      if (existing) {
        existing.packages.push(p);
      } else {
        stopsMap.set(key, {
          addressKey: key,
          address: p.address,
          packages: [p],
          orderIndex: p.orderIndex ?? 999,
          displayIndex: p.displayIndex ?? 0,
        });
      }
    });
    return Array.from(stopsMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [sortedPackages]);

  const handleDeliverPkg = (pkg: PackageType) => {
    setIsCapturingGPS(pkg.id);
    if (!navigator.geolocation) {
      alert('GPS niet beschikbaar.');
      setIsCapturingGPS(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const evidence: DeliveryEvidence = {
          latitude:  position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        };
        onUpdateMany([pkg.id], PackageStatus.DELIVERED, evidence);
        setIsCapturingGPS(null);
        setExpandedId(null);
      },
      () => {
        alert('Locatie vastleggen mislukt.');
        setIsCapturingGPS(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleNavigate = (pkg: PackageType) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${pkg.address.street} ${pkg.address.houseNumber} ${pkg.address.city}`
      )}&travelmode=bicycling`
    );
  };

  const getFullRouteUrl = () => {
    if (stops.length === 0) return '';
    const stopStrs = stops.map(s =>
      encodeURIComponent(`${s.address.street} ${s.address.houseNumber} ${s.address.city}`)
    );
    if (returnToPharmacy) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(returnAddr)}&waypoints=${stopStrs.join('|')}&travelmode=bicycling`;
    }
    const waypoints = stopStrs.slice(0, -1).join('|');
    const dest = stopStrs[stopStrs.length - 1];
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${waypoints}&travelmode=bicycling`;
  };

  const pendingPackages = useMemo(
    () => packages.filter(p => p.status === PackageStatus.PENDING),
    [packages]
  );

  const toggleSelect = (id: string) => {
    setSelectedPendingIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedPendingIds(prev =>
      prev.length === pendingPackages.length ? [] : pendingPackages.map(p => p.id)
    );
  };

  const totalStops = stops.length + delivered;
  const progressPct = totalStops > 0 ? Math.round((delivered / totalStops) * 100) : 0;

  return (
    <div className="pb-24 lg:pb-8">

      {/* ── Progressiebalk ── */}
      {totalStops > 0 && (
        <div className="mb-6 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Truck size={18} className="text-blue-600" />
              <span className="text-sm font-black text-slate-900">
                {delivered} van {totalStops} afgeleverd
              </span>
            </div>
            <span className="text-sm font-black text-blue-600">{progressPct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {stops.length > 0 && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
              {stops.length} stop{stops.length !== 1 ? 's' : ''} te gaan
            </p>
          )}
        </div>
      )}

      {/* ── Header: titel + actieknoppen ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Jouw Rit</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {sortedPackages.length} pakketten · {stops.length} stops
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            {onScanStart && (
              <button
                onClick={onScanStart}
                className="flex items-center gap-2 px-4 h-11 bg-indigo-900 text-white rounded-2xl font-black text-sm"
              >
                <ScanLine size={16} />
                Scan
              </button>
            )}
            <button
              onClick={() => setShowMapModal(true)}
              className="flex items-center gap-2 px-4 h-11 bg-blue-600 text-white rounded-2xl font-black text-sm"
            >
              <MapIcon size={16} />
              Route
            </button>
          </div>
          {onManualAdd && (
            <button
              onClick={onManualAdd}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <PenLine size={11} />
              Handmatig
            </button>
          )}
        </div>
      </div>

      {/* ── Wachtende pakketten: selecteren + route plannen ── */}
      {pendingPackages.length > 0 && (
        <div className="mb-6 bg-white border-2 border-amber-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <MapPin size={18} className="text-amber-500" />
              <span className="text-sm font-black text-slate-900">
                {pendingPackages.length} pakket{pendingPackages.length !== 1 ? 'ten' : ''} wachten op route
              </span>
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-xs font-black text-blue-600 active:opacity-70"
            >
              {selectedPendingIds.length === pendingPackages.length ? 'Deselecteer alle' : 'Selecteer alle'}
            </button>
          </div>

          <div className="space-y-2 mb-4">
            {pendingPackages.map(p => (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  selectedPendingIds.includes(p.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedPendingIds.includes(p.id)
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 bg-white'
                }`}>
                  {selectedPendingIds.includes(p.id) && <CheckCircle2 size={11} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-black text-slate-900 truncate">
                    {p.address.street} {p.address.houseNumber}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {p.address.postalCode} {p.address.city}
                  </p>
                </div>
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>

          {onOptimize && (
            <button
              onClick={() => selectedPendingIds.length > 0 && onOptimize(selectedPendingIds)}
              disabled={isOptimizing || selectedPendingIds.length === 0}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white h-14 rounded-2xl font-black text-sm shadow-lg active:scale-95 disabled:opacity-40 transition-all"
            >
              {isOptimizing
                ? <Loader2 size={18} className="animate-spin" />
                : <MousePointerClick size={18} />}
              <span>
                {isOptimizing
                  ? 'Optimaliseren…'
                  : selectedPendingIds.length === 0
                    ? 'Selecteer pakketten'
                    : `Optimaliseer ${selectedPendingIds.length} stop${selectedPendingIds.length !== 1 ? 's' : ''}`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Pakketkaartjes ── */}
      {sortedPackages.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-slate-200 text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={40} />
          <p className="text-slate-900 font-black text-xl">Lekker bezig!</p>
          <p className="text-slate-400 text-sm mt-1">Geen openstaande bezorgingen.</p>
        </div>
      ) : (
        <>
          {/* Legenda hint */}
          <div className="flex items-center gap-2 mb-4 text-xs text-slate-400">
            <span className="bg-indigo-900 text-white px-2 py-0.5 rounded-lg font-black text-[10px]">Pakje #</span>
            <span>= op het pakje</span>
            <span className="mx-1">·</span>
            <span className="bg-blue-600 text-white px-2 py-0.5 rounded-lg font-black text-[10px]">Stop #</span>
            <span>= rijvolgorde</span>
          </div>

          <div className="space-y-3">
            {sortedPackages.map(pkg => (
              <div
                key={pkg.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Klikbaar basiskaartje */}
                <div
                  onClick={() => setExpandedId(expandedId === pkg.id ? null : pkg.id)}
                  className="flex items-center gap-3 p-4 cursor-pointer active:scale-[0.99] transition-transform select-none"
                >
                  {/* Pakje # badge */}
                  <div className="flex flex-col items-center bg-indigo-900 text-white rounded-2xl w-14 h-14 justify-center shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 leading-none">Pakje</span>
                    <span className="text-2xl font-black leading-tight">
                      {pkg.scanNumber ?? '—'}
                    </span>
                  </div>

                  {/* Adres */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-base leading-tight truncate">
                      {pkg.address.street} {pkg.address.houseNumber}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {pkg.address.postalCode} {pkg.address.city}
                    </p>
                  </div>

                  {/* Stop # badge + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center bg-blue-600 text-white rounded-2xl w-12 h-12 justify-center">
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-200 leading-none">Stop</span>
                      <span className="text-xl font-black leading-tight">
                        {pkg.routeIndex ?? pkg.displayIndex ?? '—'}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-300 transition-transform duration-200 ${
                        expandedId === pkg.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Status badge onder het adres */}
                <div className="px-4 pb-3 flex items-center gap-2">
                  <StatusBadge status={pkg.status} />
                  {pkg.deliveryEvidence?.timestamp && (
                    <span className="text-xs text-slate-400 font-bold">
                      {new Date(pkg.deliveryEvidence.timestamp).toLocaleTimeString('nl-NL', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                {/* Uitklapbaar detail met actieknoppen */}
                {expandedId === pkg.id && (
                  <div className="border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2 p-4">
                      <button
                        onClick={e => { e.stopPropagation(); handleNavigate(pkg); }}
                        className="flex-1 h-12 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-200 active:scale-95 transition-all"
                      >
                        <Navigation size={16} />
                        Navigeer
                      </button>

                      <button
                        onClick={e => { e.stopPropagation(); handleDeliverPkg(pkg); }}
                        disabled={!!isCapturingGPS}
                        className="flex-1 h-12 bg-emerald-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                      >
                        {isCapturingGPS === pkg.id
                          ? <Clock className="animate-spin" size={16} />
                          : <Check size={16} />}
                        Afgeleverd
                      </button>

                      <button
                        onClick={e => { e.stopPropagation(); setNotHomePkg(pkg); }}
                        disabled={!!isCapturingGPS}
                        aria-label="Niet thuis"
                        title="Niet thuis"
                        className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center border border-amber-200 active:scale-95 disabled:opacity-50 transition-all shrink-0"
                      >
                        <DoorClosed size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Niet-thuis sheet ── */}
      {notHomePkg && (
        <NotHomeSheet
          pkg={notHomePkg}
          onComplete={(status, evidence) => {
            onUpdateMany([notHomePkg.id], status, evidence);
            setNotHomePkg(null);
            setExpandedId(null);
          }}
          onCancel={() => setNotHomePkg(null)}
        />
      )}

      {/* ── Route-modal ── */}
      {showMapModal && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex flex-col p-6">
          <div className="flex items-center justify-between text-white mb-6">
            <h3 className="text-xl font-black">Route Overzicht</h3>
            <button
              onClick={() => setShowMapModal(false)}
              className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl">

              <div className="px-8 pt-8 pb-4">
                <MapIcon size={36} className="text-blue-600 mb-4" />
                <p className="text-slate-900 font-black text-xl mb-1">Google Maps</p>
                <p className="text-slate-400 text-sm font-medium">
                  {stops.length} stops in geoptimaliseerde volgorde
                </p>
              </div>

              {/* Terug-naar-apotheek toggle */}
              <div className="mx-6 mb-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setReturnToPharmacy(p => !p)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      returnToPharmacy ? 'bg-blue-600' : 'bg-slate-200'
                    }`}>
                      <RotateCcw size={18} className={returnToPharmacy ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900 leading-none">Terug naar apotheek</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {returnToPharmacy ? 'Aan' : 'Uit'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    returnToPharmacy ? 'bg-blue-600' : 'bg-slate-300'
                  }`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      returnToPharmacy ? 'left-7' : 'left-1'
                    }`} />
                  </div>
                </button>

                {returnToPharmacy && (
                  <div className="px-5 pb-4 border-t border-slate-200 pt-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Terugkeeradres
                    </p>
                    {editingReturn ? (
                      <input
                        type="text"
                        value={returnAddr}
                        onChange={e => setReturnAddr(e.target.value)}
                        onBlur={() => setEditingReturn(false)}
                        autoFocus
                        className="w-full bg-white border border-blue-400 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingReturn(true)}
                        className="flex items-center space-x-2 text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors w-full"
                      >
                        <span className="flex-1 text-left truncate">{returnAddr}</span>
                        <Pencil size={14} className="text-slate-400 shrink-0" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 pb-8">
                <button
                  onClick={() => { window.open(getFullRouteUrl()); setShowMapModal(false); }}
                  className="w-full bg-blue-600 text-white h-14 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
                >
                  Start Navigatie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourierView;
