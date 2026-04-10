import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import {
  Navigation, CheckCircle, Map as MapIcon, X, Clock, Building2,
  RotateCcw, Pencil, Truck
} from 'lucide-react';

interface Props {
  packages: PackageType[];
  onUpdate: (id: string, status: PackageStatus, evidence?: DeliveryEvidence) => void;
  onUpdateMany: (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => void;
  pharmacyName?: string;
  pharmacyAddress?: string;
}

interface Stop {
  addressKey: string;
  address: PackageType['address'];
  packages: PackageType[];
  orderIndex: number;
  displayIndex: number;
}

const CourierView: React.FC<Props> = ({
  packages,
  onUpdateMany,
  pharmacyName = 'Apotheek',
  pharmacyAddress,
}) => {
  const [showMapModal, setShowMapModal]     = useState(false);
  const [isCapturingGPS, setIsCapturingGPS] = useState<string | null>(null);
  const [returnToPharmacy, setReturnToPharmacy] = useState(false);
  const [editingReturn, setEditingReturn]   = useState(false);
  const [returnAddr, setReturnAddr]         = useState(pharmacyAddress || pharmacyName);

  const totalAssigned = packages.filter(
    p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP
  ).length;
  const delivered = packages.filter(p => p.status === PackageStatus.DELIVERED).length;

  const stops: Stop[] = useMemo(() => {
    const active = packages.filter(
      p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP
    );
    const stopsMap = new Map<string, Stop>();
    active.forEach(p => {
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
  }, [packages]);

  const handleDeliverStop = (stop: Stop) => {
    setIsCapturingGPS(stop.addressKey);
    if (!navigator.geolocation) {
      alert('GPS niet beschikbaar.');
      setIsCapturingGPS(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const evidence: DeliveryEvidence = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
        };
        onUpdateMany(stop.packages.map(p => p.id), PackageStatus.DELIVERED, evidence);
        setIsCapturingGPS(null);
      },
      () => {
        alert('Locatie vastleggen mislukt.');
        setIsCapturingGPS(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
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

      {/* ── Header: titel + route-knop ── */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 lg:text-3xl tracking-tight">Jouw Rit</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
            {stops.length} STOPS OVER &bull; {packages.filter(p => p.status === PackageStatus.ASSIGNED).length} PAKKETTEN
          </p>
        </div>
        {stops.length > 0 && (
          <button
            onClick={() => setShowMapModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-5 h-12 rounded-2xl font-bold shadow-lg shrink-0"
          >
            <MapIcon size={18} />
            <span className="text-sm">Hele Route</span>
          </button>
        )}
      </div>

      {/* ── Stop-kaartjes ── */}
      {stops.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] border-2 border-dashed border-slate-200 text-center">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={40} />
          <p className="text-slate-900 font-black text-xl">Lekker bezig!</p>
          <p className="text-slate-400 text-sm mt-1">Geen openstaande bezorgingen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stops.map((stop, i) => (
            <div
              key={stop.addressKey}
              className={`bg-white rounded-[2rem] border-2 p-5 shadow-sm transition-all ${
                i === 0 ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-100'
              }`}
            >
              {/* Stop header */}
              <div className="flex items-start space-x-4 mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0 ${
                  i === 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  {stop.displayIndex}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-lg lg:text-xl text-slate-900 leading-tight truncate">
                    {stop.address.street} {stop.address.houseNumber}
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {stop.address.postalCode} {stop.address.city}
                  </p>
                </div>
              </div>

              {/* Pakket-details */}
              <div className="mb-4 space-y-2">
                {stop.packages.map(p => (
                  <div key={p.id} className="flex items-center space-x-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{p.pharmacyName}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        ID: {p.id.split('-').pop()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actieknoppen — minimaal 56px hoog voor touch */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      `${stop.address.street} ${stop.address.houseNumber} ${stop.address.city}`
                    )}&travelmode=bicycling`
                  )}
                  className="flex items-center justify-center space-x-2 bg-slate-50 text-slate-900 h-14 rounded-2xl font-black text-sm border border-slate-200 active:scale-95 transition-all"
                >
                  <Navigation size={18} />
                  <span>Navigeer</span>
                </button>
                <button
                  onClick={() => handleDeliverStop(stop)}
                  disabled={!!isCapturingGPS}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white h-14 rounded-2xl font-black text-sm shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isCapturingGPS === stop.addressKey
                    ? <Clock className="animate-spin" size={18} />
                    : <CheckCircle size={18} />}
                  <span>Lever Af</span>
                </button>
              </div>
            </div>
          ))}
        </div>
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
