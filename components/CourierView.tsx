import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import {
  Navigation, CheckCircle, X, Clock, Check, List,
  Truck, ScanLine, PenLine, ArrowRight, Loader2,
  MousePointerClick, CheckCircle2, MapPin, DoorClosed,
  Map as MapIcon, RefreshCw, Building2
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
  const [showOverview, setShowOverview]             = useState(false);
  const [isCapturingGPS, setIsCapturingGPS]         = useState<string | null>(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [notHomePkg, setNotHomePkg]                 = useState<PackageType | null>(null);

  // PENDING pakketten — voor route-optimalisatie
  const pendingPackages = useMemo(
    () => packages.filter(p => p.status === PackageStatus.PENDING),
    [packages]
  );

  // Kaartjes: actieve + afgeronde pakketten; afgerond naar beneden
  const sortedPackages = useMemo(() => {
    const visible = packages.filter(
      p => p.status !== PackageStatus.PENDING && p.status !== PackageStatus.SCANNING
    );
    const actionable = visible.filter(p => isActionable(p));
    const done       = visible.filter(p => !isActionable(p));

    // Na optimalisatie: routeIndex; vóór optimalisatie: scanNumber
    const sortedActionable = [...actionable].sort((a, b) => {
      if (a.routeIndex && b.routeIndex) return a.routeIndex - b.routeIndex;
      return (a.scanNumber ?? 999) - (b.scanNumber ?? 999);
    });

    // Afgerond: nieuwste bezorging eerst
    const sortedDone = [...done].sort((a, b) =>
      new Date(b.deliveredAt ?? b.createdAt).getTime() -
      new Date(a.deliveredAt ?? a.createdAt).getTime()
    );

    return [...sortedActionable, ...sortedDone];
  }, [packages]);

  // Stops — voor Google Maps URL opbouw
  const stops: Stop[] = useMemo(() => {
    const active = sortedPackages.filter(isActionable);
    const stopsMap = new Map() as Map<string, Stop>;
    active.forEach(p => {
      const key = `${p.address.street} ${p.address.houseNumber} ${p.address.postalCode}`.toLowerCase().trim();
      const existing = stopsMap.get(key);
      if (existing) {
        existing.packages.push(p);
      } else {
        stopsMap.set(key, { addressKey: key, address: p.address, packages: [p], orderIndex: p.orderIndex ?? p.routeIndex ?? 999 });
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
    const { street, houseNumber, postalCode, city } = pkg.address;
    const destination = encodeURIComponent(
      `${street} ${houseNumber}, ${postalCode} ${city}, Netherlands`
    );
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${destination}` +
      `&travelmode=bicycling`;
    window.open(url, '_blank');
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
              {actionableCount} pakket{actionableCount !== 1 ? 'jes' : 'je'} te bezorgen
            </p>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {pharmacyName && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full w-fit mb-1">
              <Building2 size={12} />
              {pharmacyName}
            </div>
          )}
          <h1 className="text-xl font-black text-slate-900">Jouw Rit</h1>
          <p className="text-xs text-slate-400 font-bold mt-0.5">
            {actionableCount} te bezorgen · {doneCount} klaar
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
          {onOptimize && (
            <button
              onClick={() => {
                const ids = sortedPackages
                  .filter(p => isActionable(p))
                  .map(p => p.id);
                onOptimize(ids);
              }}
              disabled={isOptimizing || sortedPackages.filter(p => isActionable(p)).length === 0}
              className="flex items-center gap-1.5 px-3 h-10 bg-blue-700 text-white rounded-xl font-black text-xs disabled:opacity-40 hover:bg-blue-800 transition-all active:scale-95"
            >
              {isOptimizing
                ? <RefreshCw size={14} className="animate-spin" />
                : <MapIcon size={14} />}
              {isOptimizing ? 'Bezig...' : 'Route'}
            </button>
          )}
          {onManualAdd && (
            <button
              onClick={onManualAdd}
              className="flex items-center gap-1.5 px-3 h-10 bg-blue-700 text-white rounded-xl font-black text-xs hover:bg-blue-800 transition-all active:scale-95"
            >
              <PenLine size={14} />
              Invoeren
            </button>
          )}
        </div>
      </div>

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

                {/* Pakjenummer badge — altijd het scannummer */}
                <div className="bg-indigo-900 text-white rounded-xl w-11 h-11 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[8px] font-black text-indigo-300 uppercase leading-none">#</span>
                  <span className="text-lg font-black leading-none">
                    {pkg.scanNumber ?? '?'}
                  </span>
                </div>

                {/* Adres */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-base leading-tight truncate">
                    {pkg.address.street} {pkg.address.houseNumber}
                  </p>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    {pkg.address.postalCode} · {pkg.address.city}
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

      {/* ── Overzicht modal — stop-voor-stop met Navigeer per stop ── */}
      {showOverview && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4 text-white">
            <div>
              <h3 className="text-lg font-black">Overzicht</h3>
              <p className="text-xs text-white/50 font-bold mt-0.5">
                {stops.length} pakket{stops.length !== 1 ? 'jes' : 'je'} te bezorgen
              </p>
            </div>
            <button
              onClick={() => setShowOverview(false)}
              className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-safe pb-8 space-y-2">
            {stops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <CheckCircle size={40} className="mb-3" />
                <p className="font-black text-sm">Alle stops afgerond</p>
              </div>
            ) : (
              stops.map(stop => (
                <div key={stop.addressKey} className="bg-white rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Pakjenummer(s) */}
                    <div className="flex flex-col gap-1 shrink-0">
                      {stop.packages.map(p => (
                        <div key={p.id} className="bg-indigo-900 text-white rounded-xl w-10 h-8 flex items-center justify-center">
                          <span className="text-sm font-black leading-none">#{p.scanNumber ?? '?'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Adres */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-sm leading-tight truncate">
                        {stop.address.street} {stop.address.houseNumber}
                      </p>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        {stop.address.postalCode} · {stop.address.city}
                      </p>
                    </div>

                    {/* Navigeer knop */}
                    <button
                      onClick={() => {
                        handleNavigate(stop.packages[0]);
                        setShowOverview(false);
                      }}
                      className="flex flex-col items-center justify-center bg-blue-600 active:bg-blue-500 active:scale-95 rounded-2xl w-14 h-14 shrink-0 transition-all"
                    >
                      <Navigation size={20} className="text-white mb-0.5" />
                      <span className="text-[8px] font-black text-blue-100 uppercase tracking-wide">
                        Navigeer
                      </span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourierView;
