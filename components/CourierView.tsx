import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import {
  Navigation, CheckCircle, Map as MapIcon, X, Clock, Check,
  RotateCcw, Pencil, Truck, ScanLine, PenLine, ArrowRight, Loader2,
  MousePointerClick, CheckCircle2, MapPin, DoorClosed
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

// Stop interface — alleen voor Google Maps URL opbouw
interface Stop {
  addressKey: string;
  address: PackageType['address'];
  packages: PackageType[];
  orderIndex: number;
}

// Pakket heeft een directe actie nodig (te bezorgen)
const isActionable = (pkg: PackageType): boolean =>
  [PackageStatus.ASSIGNED, PackageStatus.PICKED_UP].includes(pkg.status);

const getStatusLabel = (status: PackageStatus): string => {
  switch (status) {
    case PackageStatus.DELIVERED:      return '✓ Bezorgd';
    case PackageStatus.MAILBOX:        return '✓ Brievenbus';
    case PackageStatus.NEIGHBOUR:      return '✓ Buren';
    case PackageStatus.RETURN:         return '↩ Retour';
    case PackageStatus.MOVED:          return '↩ Verhuisd';
    case PackageStatus.OTHER_LOCATION: return '↩ Andere locatie';
    case PackageStatus.FAILED:         return '✕ Mislukt';
    case PackageStatus.ASSIGNED:       return 'Te bezorgen';
    case PackageStatus.PICKED_UP:      return 'Onderweg';
    default:                           return status;
  }
};

const getStatusStyle = (status: PackageStatus): string => {
  const done = [PackageStatus.DELIVERED, PackageStatus.MAILBOX, PackageStatus.NEIGHBOUR];
  const back = [PackageStatus.RETURN, PackageStatus.MOVED, PackageStatus.OTHER_LOCATION];
  if (done.includes(status)) return 'bg-emerald-100 text-emerald-700';
  if (back.includes(status)) return 'bg-amber-100 text-amber-700';
  if (status === PackageStatus.FAILED) return 'bg-red-100 text-red-600';
  return 'bg-slate-100 text-slate-500';
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

  // PENDING pakketten — voor route-optimalisatie
  const pendingPackages = useMemo(
    () => packages.filter(p => p.status === PackageStatus.PENDING),
    [packages]
  );

  // Kaartjes: actieve + afgeronde pakketten; afgerond naar beneden
  const sortedPackages = useMemo(() => {
    const visible = packages.filter(p => p.status !== PackageStatus.PENDING && p.status !== PackageStatus.SCANNING);
    return [...visible].sort((a, b) => {
      const aDone = !isActionable(a);
      const bDone = !isActionable(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      const aIdx = a.routeIndex ?? a.displayIndex ?? a.scanNumber ?? 999;
      const bIdx = b.routeIndex ?? b.displayIndex ?? b.scanNumber ?? 999;
      return aIdx - bIdx;
    });
  }, [packages]);

  // Stops — voor Google Maps URL opbouw
  const stops: Stop[] = useMemo(() => {
    const active = sortedPackages.filter(isActionable);
    const stopsMap = new Map<string, Stop>();
    active.forEach(p => {
      const key = `${p.address.street} ${p.address.houseNumber} ${p.address.postalCode}`.toLowerCase().trim();
      const existing = stopsMap.get(key);
      if (existing) {
        existing.packages.push(p);
      } else {
        stopsMap.set(key, { addressKey: key, address: p.address, packages: [p], orderIndex: p.orderIndex ?? 999 });
      }
    });
    return Array.from(stopsMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [sortedPackages]);

  const actionableCount = sortedPackages.filter(isActionable).length;
  const doneCount       = sortedPackages.filter(p => !isActionable(p)).length;
  const totalCount      = actionableCount + doneCount;
  const percentage      = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

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

  return (
    <div className="pb-24 lg:pb-8">

      {/* ── Voortgangsbalk ── */}
      {totalCount > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-blue-600" />
              <span className="font-black text-slate-900 text-sm">
                {doneCount} van {totalCount} bezorgd
              </span>
            </div>
            <span className="font-black text-blue-600 text-sm">{percentage}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          {actionableCount > 0 && (
            <p className="text-xs text-slate-400 font-bold mt-2">
              {actionableCount} stops te gaan
            </p>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Jouw Rit</h1>
          <p className="text-xs text-slate-400 font-bold mt-0.5">
            {actionableCount} te gaan · {doneCount} klaar
          </p>
        </div>
        <div className="flex gap-2">
          {onScanStart && (
            <button
              onClick={onScanStart}
              className="flex items-center gap-1.5 px-3 h-10 bg-indigo-900 text-white rounded-xl font-black text-xs"
            >
              <ScanLine size={14} />
              Scan
            </button>
          )}
          <button
            onClick={() => setShowMapModal(true)}
            className="flex items-center gap-1.5 px-3 h-10 bg-blue-600 text-white rounded-xl font-black text-xs"
          >
            <MapIcon size={14} />
            Route
          </button>
        </div>
      </div>

      {/* Handmatig — als kleine tekstlink onder de knoppen */}
      {onManualAdd && (
        <div className="flex justify-end mb-4 -mt-2">
          <button
            onClick={onManualAdd}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 transition-colors"
          >
            <PenLine size={10} />
            Handmatig invoeren
          </button>
        </div>
      )}

      {/* ── Wachtende pakketten: selecteren + route plannen ── */}
      {pendingPackages.length > 0 && (
        <div className="mb-4 bg-white border-2 border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-amber-500" />
              <span className="text-sm font-black text-slate-900">
                {pendingPackages.length} pakket{pendingPackages.length !== 1 ? 'ten' : ''} zonder route
              </span>
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-xs font-black text-blue-600 active:opacity-70"
            >
              {selectedPendingIds.length === pendingPackages.length ? 'Deselecteer' : 'Alles'}
            </button>
          </div>

          <div className="space-y-2 mb-3">
            {pendingPackages.map(p => (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all active:scale-[0.98] ${
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
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white h-12 rounded-xl font-black text-sm shadow-sm active:scale-95 disabled:opacity-40 transition-all"
            >
              {isOptimizing
                ? <Loader2 size={16} className="animate-spin" />
                : <MousePointerClick size={16} />}
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
        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
          <CheckCircle className="text-emerald-500 mx-auto mb-4" size={40} />
          <p className="text-slate-900 font-black text-xl">Lekker bezig!</p>
          <p className="text-slate-400 text-sm mt-1">Geen openstaande bezorgingen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPackages.map(pkg => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${
                !isActionable(pkg) ? 'opacity-60 border-slate-100' : 'border-slate-200'
              }`}
            >
              {/* Info sectie */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">

                {/* Stop nummer */}
                <div className="bg-blue-600 text-white rounded-xl w-11 h-11 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[8px] font-black text-blue-200 uppercase leading-none">Stop</span>
                  <span className="text-lg font-black leading-none">
                    {pkg.routeIndex ?? pkg.displayIndex ?? '?'}
                  </span>
                </div>

                {/* Adres */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-base leading-tight truncate">
                    {pkg.address.street} {pkg.address.houseNumber}
                  </p>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    {pkg.address.postalCode} · {pkg.address.city}
                    {pkg.scanNumber !== undefined && (
                      <span className="ml-2 text-slate-300">#{pkg.scanNumber}</span>
                    )}
                  </p>
                </div>

                {/* Navigeer knop */}
                <button
                  onClick={() => handleNavigate(pkg)}
                  className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-95 transition-all shrink-0"
                  title="Navigeer"
                >
                  <Navigation size={18} />
                </button>
              </div>

              {/* Actie sectie — alleen voor te-bezorgen pakketten */}
              {isActionable(pkg) && (
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    onClick={() => handleDeliverPkg(pkg)}
                    disabled={!!isCapturingGPS}
                    className="flex-1 h-11 bg-emerald-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200"
                  >
                    {isCapturingGPS === pkg.id
                      ? <Clock size={15} className="animate-spin" />
                      : <Check size={16} strokeWidth={3} />}
                    Afgeleverd
                  </button>
                  <button
                    onClick={() => setNotHomePkg(pkg)}
                    disabled={!!isCapturingGPS}
                    className="h-11 px-4 bg-amber-50 text-amber-700 rounded-xl font-black text-sm border border-amber-200 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    Niet thuis
                  </button>
                </div>
              )}

              {/* Status — voor afgeronde pakketten */}
              {!isActionable(pkg) && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${getStatusStyle(pkg.status)}`}>
                    {getStatusLabel(pkg.status)}
                  </span>
                  {pkg.deliveryEvidence?.timestamp && (
                    <span className="text-xs text-slate-400 font-bold">
                      {new Date(pkg.deliveryEvidence.timestamp).toLocaleTimeString('nl-NL', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Niet-thuis sheet ── */}
      {notHomePkg && (
        <NotHomeSheet
          pkg={notHomePkg}
          onComplete={(status, evidence) => {
            onUpdateMany([notHomePkg.id], status, evidence);
            setNotHomePkg(null);
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
