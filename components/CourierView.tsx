import React, { useState, useMemo, useEffect } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence, Institution, Pharmacy } from '../types';
import {
  Navigation, CheckCircle, X, Clock, Check, List,
  Truck, ScanLine, PenLine, ArrowRight, Loader2,
  MousePointerClick, CheckCircle2, MapPin, DoorClosed,
  Map as MapIcon, RefreshCw, Building2, Trash2, Plus, MoreHorizontal
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
  // startFrom/returnTo: 'current', 'none', of een pharmacyId string.
  // Voor backwards compat blijft 'pharmacy' werken als alias van currentPharmacy.
  onOptimize?: (selectedIds: string[], startFrom?: string, returnTo?: string) => void;
  isOptimizing?: boolean;
  onNewRit?: () => void;
  activePharmacyNames?: string[];
  activePharmacies?: Pharmacy[];
  onInstitutionRoute?: () => void;
  activeInstitutionRoute?: Institution[];
  onOptimizeInstitutions?: (
    institutions: Institution[],
    startFrom?: string,
    returnTo?: string
  ) => void;
  scanCooldown?: boolean;
}

interface Stop {
  addressKey: string;
  address: PackageType['address'];
  packages: PackageType[];
  orderIndex: number;
}

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
    case PackageStatus.REMOVED:        return 'Uit bezorging gehaald';
    default:                           return status;
  }
};

const getStatusStyle = (status: PackageStatus): string => {
  const done = [PackageStatus.DELIVERED, PackageStatus.MAILBOX, PackageStatus.NEIGHBOUR];
  const back = [PackageStatus.RETURN, PackageStatus.MOVED, PackageStatus.OTHER_LOCATION];
  if (done.includes(status)) return 'bg-[#48c2a9]/15 text-[#006b5a]';
  if (back.includes(status)) return 'bg-[#d7e2fe] text-[#101c30]';
  if (status === PackageStatus.FAILED)  return 'bg-red-50 text-red-600';
  if (status === PackageStatus.REMOVED) return 'bg-[#f2f4f6] text-[#3d4945]/60';
  return 'bg-[#f2f4f6] text-[#3d4945]';
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
  onNewRit,
  activePharmacyNames,
  activePharmacies,
  onInstitutionRoute,
  activeInstitutionRoute,
  onOptimizeInstitutions,
  scanCooldown,
}) => {
  const [showOverview, setShowOverview]             = useState(false);
  const [isCapturingGPS, setIsCapturingGPS]         = useState<string | null>(null);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [notHomePkg, setNotHomePkg]                 = useState<PackageType | null>(null);
  const [showRouteOptions, setShowRouteOptions]     = useState(false);
  const [pendingRouteIds, setPendingRouteIds]       = useState<string[]>([]);
  // returnTo: 'none' = geen terugreis, 'pharmacy' = legacy fallback,
  // andere string = pharmacyId.
  const [returnTo, setReturnTo]                     = useState<string>('pharmacy');
  // startFrom: 'current' = GPS, 'pharmacy' = legacy fallback, andere string = pharmacyId.
  const [startFrom, setStartFrom]                   = useState<string>('current');
  const [deliveredInstitutions, setDeliveredInstitutions] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu]             = useState(false);

  const linkedPharmacies = activePharmacies ?? [];

  // FAB cooldown: gespiegeld van parent + progressie voor de ring
  const cooldown = !!scanCooldown;
  const [cooldownProgress, setCooldownProgress] = useState(0);

  useEffect(() => {
    if (!cooldown) {
      setCooldownProgress(0);
      return;
    }
    const start = Date.now();
    const duration = 2000;
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      setCooldownProgress(Math.min(elapsed / duration, 1));
      if (elapsed >= duration) clearInterval(tick);
    }, 16);
    return () => clearInterval(tick);
  }, [cooldown]);

  const handleRouteClick = (ids: string[]) => {
    setPendingRouteIds(ids);
    // Default eindpunt: eerste gekoppelde apotheek, anders legacy 'pharmacy'
    setReturnTo(linkedPharmacies[0]?.id ?? 'pharmacy');
    // Default startpunt: eerste gekoppelde apotheek, anders 'current'
    setStartFrom(linkedPharmacies[0]?.id ?? 'current');
    setShowRouteOptions(true);
  };

  const handleConfirmRoute = () => {
    setShowRouteOptions(false);
    onOptimize?.(pendingRouteIds, startFrom, returnTo);
    if (activeInstitutionRoute && activeInstitutionRoute.length > 0 && onOptimizeInstitutions) {
      onOptimizeInstitutions(activeInstitutionRoute, startFrom, returnTo);
    }
  };

  const pendingPackages = useMemo(
    () => packages.filter(p => p.status === PackageStatus.PENDING),
    [packages]
  );

  const sortedPackages = useMemo(() => {
    const visible = packages.filter(
      p => p.status !== PackageStatus.PENDING && p.status !== PackageStatus.SCANNING
    );
    const actionable = visible.filter(p => isActionable(p));
    const done       = visible.filter(p => !isActionable(p) && p.status !== PackageStatus.REMOVED);
    const removed    = visible.filter(p => p.status === PackageStatus.REMOVED);

    const sortedActionable = [...actionable].sort((a, b) => {
      if (a.routeIndex && b.routeIndex) return a.routeIndex - b.routeIndex;
      return (a.scanNumber ?? 999) - (b.scanNumber ?? 999);
    });

    const sortedDone = [...done].sort((a, b) =>
      new Date(b.deliveredAt ?? b.createdAt).getTime() -
      new Date(a.deliveredAt ?? a.createdAt).getTime()
    );

    return [...sortedActionable, ...sortedDone, ...removed];
  }, [packages]);

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

  // Route knop is ook actief als er alleen een instellingen-route is (geen pakketten)
  const hasActiveInstitutions = !!(activeInstitutionRoute && activeInstitutionRoute.length > 0);
  const hasRoutableItems      = actionableCount > 0 || hasActiveInstitutions;

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

    // Vertrekpunt bepalen op basis van positie in de route
    const actionable = sortedPackages.filter(isActionable);
    const currentIndex = actionable.findIndex(p => p.id === pkg.id);

    let originParam = '';
    if (currentIndex === 0 && pharmacyAddress) {
      // Eerste stop → vertrek vanuit apotheek
      originParam = `&origin=${encodeURIComponent(pharmacyAddress + ', Netherlands')}`;
    } else if (currentIndex > 0) {
      // Volgende stops → vertrek vanuit vorige stop
      const prev = actionable[currentIndex - 1];
      originParam = `&origin=${encodeURIComponent(
        `${prev.address.street} ${prev.address.houseNumber}, ` +
        `${prev.address.postalCode} ${prev.address.city}, Netherlands`
      )}`;
    }
    // Geen origin → Google Maps valt terug op GPS

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      originParam +
      `&destination=${destination}` +
      `&travelmode=bicycling`;

    window.open(url, '_blank');
  };

  const handleNavigateToInstitution = (inst: Institution) => {
    const destination = encodeURIComponent(
      `${inst.street ?? ''} ${inst.houseNumber ?? ''}, ${inst.postalCode ?? ''} ${inst.city ?? ''}, Netherlands`
    );
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=bicycling`,
      '_blank'
    );
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
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-[#006b5a]" />
              <span className="font-display font-black text-[#191c1e] text-sm">
                {doneCount} van {totalCount} bezorgd
              </span>
            </div>
            <span className="font-display font-black text-[#006b5a] text-sm">{percentage}%</span>
          </div>
          <div className="h-2 bg-[#f2f4f6] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            />
          </div>
          {actionableCount > 0 && (
            <p className="text-xs text-[#3d4945]/60 font-body font-bold mt-2">
              {actionableCount} pakket{actionableCount !== 1 ? 'jes' : 'je'} te bezorgen
            </p>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="min-w-0 overflow-hidden flex-shrink">
          {pharmacyName && (
            <div className="flex items-center gap-1.5 text-xs font-display font-bold text-[#006b5a] bg-[#48c2a9]/15 px-2.5 py-1 rounded-full w-fit max-w-full mb-1">
              <Building2 size={12} className="shrink-0" />
              <span className="truncate max-w-[140px]">{pharmacyName}</span>
            </div>
          )}
          <h1 className="text-xl font-display font-black text-[#191c1e] truncate">Jouw Rit</h1>
          <p className="text-xs text-[#3d4945]/60 font-body font-bold mt-0.5">
            {actionableCount} te bezorgen · {doneCount} klaar
          </p>
        </div>
        <div className="flex gap-2 items-center shrink-0">

          {/* Primair — alleen op desktop; mobiel gebruikt de FAB onderaan */}
          {onScanStart && (
            <button
              onClick={onScanStart}
              className="hidden lg:flex items-center gap-1.5 px-3 h-10 text-white rounded-full font-display font-bold text-xs active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              <ScanLine size={14} />
              Scan
            </button>
          )}
          {onOptimize && (
            <button
              onClick={() => {
                // Lege array = geen pakketten, alleen de instellingen-route optimaliseren
                const ids = sortedPackages.filter(p => isActionable(p)).map(p => p.id);
                handleRouteClick(ids);
              }}
              disabled={isOptimizing || !hasRoutableItems}
              className="flex items-center gap-1.5 px-3 h-10 bg-[#253046] text-white rounded-full font-display font-bold text-xs disabled:opacity-40 active:scale-95 transition-all"
            >
              {isOptimizing ? <RefreshCw size={14} className="animate-spin" /> : <MapIcon size={14} />}
              {isOptimizing ? 'Bezig...' : 'Route'}
            </button>
          )}

          {/* Secundair — desktop: zichtbaar | mobiel: in "Meer" menu */}
          <div className="hidden md:flex gap-2">
            {onManualAdd && (
              <button
                onClick={onManualAdd}
                className="flex items-center gap-1.5 px-3 h-10 bg-[#f2f4f6] text-[#3d4945] rounded-full font-display font-bold text-xs active:scale-95 transition-all"
              >
                <PenLine size={14} />
                Invoeren
              </button>
            )}
            {onInstitutionRoute && (
              <button
                onClick={onInstitutionRoute}
                className="flex items-center gap-1.5 px-3 h-10 bg-[#f2f4f6] text-[#3d4945] rounded-full font-display font-bold text-xs active:scale-95 transition-all"
              >
                <Building2 size={14} />
                Instellingen
              </button>
            )}
          </div>

          {/* Mobiel — "Meer" menu met de secundaire acties */}
          {(onManualAdd || onInstitutionRoute || onNewRit) && (
            <div className="relative md:hidden">
              <button
                onClick={() => setShowMoreMenu(prev => !prev)}
                aria-label="Meer acties"
                className="flex items-center justify-center px-3 h-10 bg-[#f2f4f6] text-[#3d4945] rounded-full font-display font-bold text-xs active:scale-95 transition-all"
              >
                <MoreHorizontal size={16} />
              </button>

              {showMoreMenu && (
                <>
                  {/* Backdrop om het menu te sluiten */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />

                  {/* Dropdown */}
                  <div className="absolute right-0 top-12 z-50 bg-white rounded-2xl shadow-xl shadow-black/10 border border-[#f2f4f6] min-w-[180px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {onManualAdd && (
                      <button
                        onClick={() => { onManualAdd(); setShowMoreMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-[#191c1e] hover:bg-[#f2f4f6] transition-colors text-left"
                      >
                        <PenLine size={16} className="text-[#3d4945]" />
                        Invoeren
                      </button>
                    )}
                    {onInstitutionRoute && (
                      <button
                        onClick={() => { onInstitutionRoute(); setShowMoreMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-[#191c1e] hover:bg-[#f2f4f6] transition-colors text-left border-t border-[#f2f4f6]"
                      >
                        <Building2 size={16} className="text-[#3d4945]" />
                        Instellingen
                      </button>
                    )}
                    {onNewRit && (
                      <button
                        onClick={() => { onNewRit(); setShowMoreMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left border-t border-[#f2f4f6]"
                      >
                        <RefreshCw size={16} />
                        Nieuwe rit
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ── Instellingen route ── */}
      {activeInstitutionRoute && activeInstitutionRoute.length > 0 && (
        <div className="mb-4 bg-white rounded-2xl shadow-[0_4px_24px_rgba(25,28,30,0.04)] overflow-hidden">
          <div className="px-4 pt-4 pb-2 border-b border-[#f2f4f6]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display font-black text-[#191c1e] text-sm">
                  🏥 Instellingen route
                </p>
                <p className="text-xs text-[#3d4945] mt-0.5">
                  {deliveredInstitutions.size}/{activeInstitutionRoute.length} bezocht
                </p>
              </div>
              {activeInstitutionRoute.length > 1 && onOptimizeInstitutions && (
                <button
                  onClick={() => onOptimizeInstitutions(activeInstitutionRoute)}
                  disabled={isOptimizing}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-display font-bold text-white active:scale-95 transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                >
                  {isOptimizing ? <RefreshCw size={12} className="animate-spin" /> : <MapIcon size={12} />}
                  Optimaliseer
                </button>
              )}
            </div>
          </div>
          {activeInstitutionRoute.map((inst, i) => {
            const isDelivered = deliveredInstitutions.has(inst.id);
            return (
            <div key={inst.id} className={`px-4 py-3 border-b border-[#f2f4f6] last:border-0 transition-opacity ${isDelivered ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#48c2a9]/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-[#006b5a]">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#191c1e] text-sm truncate">{inst.name}</p>
                  <p className="text-xs text-[#3d4945]">
                    {inst.street} {inst.houseNumber} · {inst.postalCode}
                  </p>
                </div>
                <button
                  onClick={() => handleNavigateToInstitution(inst)}
                  className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center active:scale-95 transition-all hover:bg-[#48c2a9]/20"
                >
                  <Navigation size={16} className="text-[#3d4945]" />
                </button>
              </div>
              {inst.instructions && (
                <div className="mt-2 ml-11 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                  📋 {inst.instructions}
                </div>
              )}
              <div className="flex gap-2 mt-2 ml-11">
                {!isDelivered ? (
                  <button
                    onClick={() => setDeliveredInstitutions(prev => new Set([...prev, inst.id]))}
                    className="flex-1 h-10 bg-[#48c2a9] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Check size={15} strokeWidth={3} />
                    Afgeleverd
                  </button>
                ) : (
                  <button
                    onClick={() => setDeliveredInstitutions(prev => {
                      const next = new Set(prev);
                      next.delete(inst.id);
                      return next;
                    })}
                    className="flex-1 h-10 bg-[#f2f4f6] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={15} className="text-[#006b5a]" />
                    <span className="text-sm font-bold text-[#006b5a]">Bezocht</span>
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ── Wachtende pakketten ── */}
      {pendingPackages.length > 0 && (
        <div className="mb-4 bg-white rounded-2xl p-4" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#006b5a]" />
              <span className="text-sm font-display font-black text-[#191c1e]">
                {pendingPackages.length} pakket{pendingPackages.length !== 1 ? 'ten' : ''} zonder route
              </span>
            </div>
            <button
              onClick={toggleSelectAll}
              className="text-xs font-display font-black text-[#006b5a] active:opacity-70"
            >
              {selectedPendingIds.length === pendingPackages.length ? 'Deselecteer' : 'Alles'}
            </button>
          </div>

          <div className="space-y-2 mb-3">
            {pendingPackages.map(p => (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${
                  selectedPendingIds.includes(p.id)
                    ? 'bg-[#48c2a9]/10'
                    : 'bg-[#f2f4f6]'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selectedPendingIds.includes(p.id)
                    ? 'border-[#006b5a] bg-[#006b5a]'
                    : 'border-[#bccac4] bg-white'
                }`}>
                  {selectedPendingIds.includes(p.id) && <CheckCircle2 size={11} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-display font-black text-[#191c1e] truncate">
                    {p.address.street} {p.address.houseNumber}
                  </p>
                  <p className="text-[10px] font-body font-bold text-[#3d4945]/60 uppercase tracking-widest">
                    {p.address.postalCode} {p.address.city}
                  </p>
                </div>
                <ArrowRight size={14} className="text-[#bccac4] shrink-0" />
              </button>
            ))}
          </div>

          {onOptimize && (
            <button
              onClick={() => selectedPendingIds.length > 0 && handleRouteClick(selectedPendingIds)}
              disabled={isOptimizing || selectedPendingIds.length === 0}
              className="w-full flex items-center justify-center gap-2 text-white h-12 rounded-full font-display font-bold text-sm active:scale-95 disabled:opacity-40 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {isOptimizing ? <Loader2 size={16} className="animate-spin" /> : <MousePointerClick size={16} />}
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
      {sortedPackages.length === 0 && (!activeInstitutionRoute || activeInstitutionRoute.length === 0) ? (
        <div className="bg-white p-12 rounded-3xl text-center" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, rgba(0,107,90,0.1), rgba(72,194,169,0.1))' }}>
            <CheckCircle className="text-[#006b5a]" size={32} />
          </div>
          <p className="text-[#191c1e] font-display font-black text-xl">Lekker bezig!</p>
          <p className="text-[#3d4945]/60 text-sm font-body mt-1">Geen openstaande bezorgingen.</p>
        </div>
      ) : sortedPackages.length === 0 ? null : (
        <div className="space-y-2">
          {sortedPackages.map(pkg => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl overflow-hidden transition-opacity ${
                pkg.status === PackageStatus.REMOVED || !isActionable(pkg) ? 'opacity-60' : ''
              }`}
              style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
            >
              {/* Info sectie */}
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">

                {/* Pakjenummer badge */}
                <div
                  className="text-white rounded-xl w-11 h-11 flex flex-col items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                >
                  <span className="text-[8px] font-display font-black text-white/60 uppercase leading-none">#</span>
                  <span className="text-lg font-display font-black leading-none">
                    {pkg.scanNumber ?? '?'}
                  </span>
                </div>

                {/* Adres */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-[#191c1e] text-base leading-tight truncate">
                    {pkg.address.street} {pkg.address.houseNumber}
                  </p>
                  <p className="text-xs text-[#3d4945]/60 font-body font-bold mt-0.5">
                    {pkg.address.postalCode} · {pkg.address.city}
                  </p>
                  {pkg.pharmacyName && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-[#3d4945] bg-[#f2f4f6] px-2 py-0.5 rounded-full truncate max-w-full">
                      {pkg.pharmacyName}
                    </span>
                  )}
                </div>

                {/* Navigeer */}
                <button
                  onClick={() => handleNavigate(pkg)}
                  className="w-10 h-10 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] hover:bg-[#48c2a9]/15 hover:text-[#006b5a] active:scale-95 transition-all shrink-0"
                  title="Navigeer"
                >
                  <Navigation size={18} />
                </button>
              </div>

              {/* Actie sectie */}
              {isActionable(pkg) && (
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    onClick={() => handleDeliverPkg(pkg)}
                    disabled={!!isCapturingGPS}
                    className="flex-1 h-11 text-white rounded-full font-display font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                  >
                    {isCapturingGPS === pkg.id
                      ? <Clock size={15} className="animate-spin" />
                      : <Check size={16} strokeWidth={3} />}
                    Afgeleverd
                  </button>
                  <button
                    onClick={() => setNotHomePkg(pkg)}
                    disabled={!!isCapturingGPS}
                    className="h-11 px-4 bg-[#d7e2fe] text-[#101c30] rounded-full font-display font-semibold text-sm active:scale-95 disabled:opacity-50 transition-all"
                  >
                    Niet thuis
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Dit pakket uit de rit verwijderen?')) {
                        onUpdateMany([pkg.id], PackageStatus.REMOVED);
                      }
                    }}
                    disabled={!!isCapturingGPS}
                    className="h-11 w-11 bg-[#f2f4f6] text-[#3d4945] rounded-xl flex items-center justify-center active:scale-95 disabled:opacity-50 transition-all"
                    title="Verwijder uit bezorging"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}

              {/* Status badge */}
              {!isActionable(pkg) && (
                <div className="px-4 pb-3 flex items-center gap-2">
                  <span className={`text-xs font-display font-black px-2.5 py-1 rounded-full ${getStatusStyle(pkg.status)}`}>
                    {getStatusLabel(pkg.status)}
                  </span>
                  {pkg.deliveryEvidence?.timestamp && (
                    <span className="text-xs text-[#3d4945]/60 font-body font-bold">
                      {new Date(pkg.deliveryEvidence.timestamp).toLocaleTimeString('nl-NL', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {actionableCount === 0 && onNewRit && (
            <button
              onClick={onNewRit}
              className="w-full mt-4 h-12 rounded-full font-display font-bold text-white text-sm active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              🚀 Nieuwe rit starten
            </button>
          )}
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

      {/* ── Overzicht modal ── */}
      {showOverview && (
        <div className="fixed inset-0 z-[10000] flex flex-col animate-in fade-in duration-200"
          style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="flex items-center justify-between px-5 pt-safe pt-6 pb-4 text-white">
            <div>
              <h3 className="text-lg font-display font-black">Overzicht</h3>
              <p className="text-xs text-white/50 font-body font-bold mt-0.5">
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
                <p className="font-display font-black text-sm">Alle stops afgerond</p>
              </div>
            ) : (
              stops.map(stop => (
                <div key={stop.addressKey} className="bg-white rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex flex-col gap-1 shrink-0">
                      {stop.packages.map(p => (
                        <div key={p.id} className="text-white rounded-xl w-10 h-8 flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
                          <span className="text-sm font-display font-black leading-none">#{p.scanNumber ?? '?'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-black text-[#191c1e] text-sm leading-tight truncate">
                        {stop.address.street} {stop.address.houseNumber}
                      </p>
                      <p className="text-xs text-[#3d4945]/60 font-body font-bold mt-0.5">
                        {stop.address.postalCode} · {stop.address.city}
                      </p>
                    </div>
                    <button
                      onClick={() => { handleNavigate(stop.packages[0]); setShowOverview(false); }}
                      className="flex flex-col items-center justify-center text-white active:scale-95 rounded-2xl w-14 h-14 shrink-0 transition-all"
                      style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                    >
                      <Navigation size={20} className="mb-0.5" />
                      <span className="text-[8px] font-display font-black uppercase tracking-wide">Navigeer</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {showRouteOptions && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-1 bg-[#f2f4f6] rounded-full mx-auto mb-6" />
            <h3 className="font-display font-black text-[#191c1e] text-lg mb-1">
              Route starten
            </h3>
            <p className="text-sm text-[#3d4945] mb-6">
              Kies startpunt en eindpunt
            </p>

            <p className="text-sm font-display font-bold text-[#191c1e] mb-3">
              Startpunt
            </p>

            {/* Startpunt — per gekoppelde apotheek, of legacy fallback */}
            {linkedPharmacies.length > 0 ? (
              linkedPharmacies.map(ph => {
                const selected = startFrom === ph.id;
                return (
                  <button
                    key={`start-${ph.id}`}
                    onClick={() => setStartFrom(ph.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-3
                                border-2 active:scale-[0.98] transition-all ${
                      selected
                        ? 'bg-[#48c2a9]/10 border-[#006b5a]'
                        : 'bg-[#f2f4f6] border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#48c2a9]/20">
                      <Building2 size={20} className="text-[#006b5a]" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-display font-black text-[#191c1e] text-sm truncate">
                        Vanuit {ph.name}
                      </p>
                      {ph.address && (
                        <p className="text-xs text-[#3d4945] truncate">{ph.address}</p>
                      )}
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-[#006b5a] flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <button
                onClick={() => setStartFrom('pharmacy')}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-3
                            border-2 active:scale-[0.98] transition-all ${
                  startFrom === 'pharmacy'
                    ? 'bg-[#48c2a9]/10 border-[#006b5a]'
                    : 'bg-[#f2f4f6] border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#48c2a9]/20">
                  <Building2 size={20} className="text-[#006b5a]" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-display font-black text-[#191c1e] text-sm">
                    Vanuit de apotheek
                  </p>
                  <p className="text-xs text-[#3d4945]">
                    {pharmacyAddress ?? pharmacyName}
                  </p>
                </div>
                {startFrom === 'pharmacy' && (
                  <div className="w-5 h-5 rounded-full bg-[#006b5a] flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            )}

            <button
              onClick={() => setStartFrom('current')}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-3
                          border-2 active:scale-[0.98] transition-all ${
                startFrom === 'current'
                  ? 'bg-[#48c2a9]/10 border-[#006b5a]'
                  : 'bg-[#f2f4f6] border-transparent'
              }`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#48c2a9]/20">
                <Navigation size={20} className="text-[#006b5a]" />
              </div>
              <div className="text-left flex-1">
                <p className="font-display font-black text-[#191c1e] text-sm">
                  Vanuit mijn huidige locatie
                </p>
                <p className="text-xs text-[#3d4945]">
                  GPS bepaalt het startpunt
                </p>
              </div>
              {startFrom === 'current' && (
                <div className="w-5 h-5 rounded-full bg-[#006b5a] flex items-center justify-center shrink-0">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>

            {/* Scheidingslijn */}
            <div className="border-t border-[#48c2a9]/20 my-4" />

            <p className="text-sm font-display font-bold text-[#191c1e] mb-3">
              Eindpunt
            </p>

            {/* Eindpunt — per gekoppelde apotheek, of legacy fallback */}
            {linkedPharmacies.length > 0 ? (
              linkedPharmacies.map(ph => {
                const selected = returnTo === ph.id;
                return (
                  <button
                    key={`end-${ph.id}`}
                    onClick={() => setReturnTo(ph.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-3
                                active:scale-[0.98] transition-all border-2 ${
                      selected
                        ? 'bg-[#48c2a9]/10 border-[#006b5a]'
                        : 'bg-[#f2f4f6] border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#48c2a9]/20">
                      <Building2 size={20} className="text-[#006b5a]" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-display font-black text-[#191c1e] text-sm truncate">
                        Terug naar {ph.name}
                      </p>
                      {ph.address && (
                        <p className="text-xs text-[#3d4945] truncate">{ph.address}</p>
                      )}
                    </div>
                    {selected && (
                      <div className="w-5 h-5 rounded-full bg-[#006b5a] flex items-center justify-center shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <button
                onClick={() => setReturnTo('pharmacy')}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-3
                            active:scale-[0.98] transition-all border-2 ${
                  returnTo === 'pharmacy'
                    ? 'bg-[#48c2a9]/10 border-[#006b5a]'
                    : 'bg-[#f2f4f6] border-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#48c2a9]/20">
                  <Building2 size={20} className="text-[#006b5a]" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-display font-black text-[#191c1e] text-sm">
                    Terug naar de apotheek
                  </p>
                  <p className="text-xs text-[#3d4945]">
                    {pharmacyAddress ?? pharmacyName}
                  </p>
                </div>
                {returnTo === 'pharmacy' && (
                  <div className="w-5 h-5 rounded-full bg-[#006b5a] flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            )}

            {/* Optie: geen terugreis */}
            <button
              onClick={() => setReturnTo('none')}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-6
                          active:scale-[0.98] transition-all border-2 ${
                returnTo === 'none'
                  ? 'bg-[#48c2a9]/10 border-[#006b5a]'
                  : 'bg-[#f2f4f6] border-transparent'
              }`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#f2f4f6]">
                <X size={20} className="text-[#3d4945]" />
              </div>
              <div className="text-left flex-1">
                <p className="font-display font-black text-[#191c1e] text-sm">
                  Geen terugreis
                </p>
                <p className="text-xs text-[#3d4945]">
                  Route eindigt bij het laatste adres
                </p>
              </div>
              {returnTo === 'none' && (
                <div className="w-5 h-5 rounded-full bg-[#006b5a] flex items-center justify-center shrink-0">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>

            <button
              onClick={handleConfirmRoute}
              className="w-full h-12 rounded-full text-white font-display font-bold text-sm active:scale-[0.98] transition-all mb-3"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              Route starten
            </button>

            <button
              onClick={() => setShowRouteOptions(false)}
              className="w-full h-12 rounded-full border border-[#48c2a9]/30 text-[#3d4945] font-display font-bold text-sm active:scale-[0.98] transition-all"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Scan FAB — alleen op mobiel ── */}
      {onScanStart && (
        <>
          {/* Spacer zodat content niet achter FAB+bottom-nav verdwijnt */}
          <div className="h-32 lg:hidden" aria-hidden />

          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 lg:hidden flex flex-col items-center gap-2 pointer-events-none">
            {cooldown && (
              <div className="text-xs font-bold text-white/90 bg-black/50 px-3 py-1 rounded-full pointer-events-none">
                Even wachten...
              </div>
            )}

            <button
              onClick={!cooldown ? onScanStart : undefined}
              disabled={cooldown}
              aria-label="Scan label"
              className={`relative w-20 h-20 rounded-full shadow-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95 select-none pointer-events-auto ${
                cooldown
                  ? 'bg-[#3d4945] cursor-not-allowed'
                  : 'bg-gradient-to-br from-[#006b5a] to-[#48c2a9] cursor-pointer'
              }`}
              style={{
                boxShadow: cooldown
                  ? '0 4px 20px rgba(0,0,0,0.2)'
                  : '0 8px 32px rgba(0,107,90,0.45)',
              }}
            >
              {cooldown && (
                <svg className="absolute inset-0 w-20 h-20 -rotate-90 pointer-events-none" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                  <circle
                    cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - cooldownProgress)}`}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-75"
                  />
                </svg>
              )}
              <ScanLine size={28} className="text-white relative z-10" strokeWidth={2} />
              <span className="text-white text-[10px] font-display font-black tracking-wider relative z-10">
                {cooldown ? 'WACHT' : 'SCAN'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CourierView;
