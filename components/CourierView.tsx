import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import { MapPin, Navigation, CheckCircle, Truck, Map as MapIcon, X, Clock, MapPinned, Package, ChevronRight, Zap, Building2 } from 'lucide-react';

interface Props {
  packages: PackageType[];
  onUpdate: (id: string, status: PackageStatus, evidence?: DeliveryEvidence) => void;
  onUpdateMany: (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => void;
}

interface Stop {
  addressKey: string;
  address: PackageType['address'];
  packages: PackageType[];
  orderIndex: number;
  displayIndex: number;
}

const CourierView: React.FC<Props> = ({ packages, onUpdateMany }) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [isCapturingGPS, setIsCapturingGPS] = useState<string | null>(null);

  const stops = useMemo(() => {
    const active = packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP);
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
          displayIndex: p.displayIndex ?? 0
        });
      }
    });

    return Array.from(stopsMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [packages]);

  const handleDeliverStop = (stop: Stop) => {
    setIsCapturingGPS(stop.addressKey);
    
    if (!navigator.geolocation) {
      alert("GPS niet beschikbaar.");
      setIsCapturingGPS(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const evidence: DeliveryEvidence = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString()
        };
        const ids = stop.packages.map(p => p.id);
        onUpdateMany(ids, PackageStatus.DELIVERED, evidence);
        setIsCapturingGPS(null);
      },
      (error) => {
        alert("Locatie vastleggen mislukt.");
        setIsCapturingGPS(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getFullRouteUrl = () => {
    if (stops.length === 0) return '';
    const waypoints = stops.slice(0, -1).map(s => `${s.address.street}+${s.address.houseNumber}+${s.address.city}`).join('|');
    const destination = stops[stops.length - 1];
    const destStr = `${destination.address.street}+${destination.address.houseNumber}+${destination.address.city}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${destStr}&waypoints=${waypoints}&travelmode=bicycling`;
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Jouw Rit</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            {stops.length} STOPS OVER • {packages.filter(p => p.status === PackageStatus.ASSIGNED).length} PAKKETTEN
          </p>
        </div>
        {stops.length > 0 && (
          <button 
            onClick={() => setShowMapModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg"
          >
            <MapIcon size={18} />
            <span className="text-sm">Hele Route</span>
          </button>
        )}
      </div>

      {stops.length === 0 ? (
        <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-slate-200 text-center">
          <CheckCircle className="text-green-500 mx-auto mb-6" size={40} />
          <p className="text-slate-900 font-black text-xl">Lekker bezig!</p>
          <p className="text-slate-400 text-sm mt-2">Geen openstaande bezorgingen.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stops.map((stop, i) => (
            <div 
              key={stop.addressKey} 
              className={`bg-white p-6 rounded-[2.5rem] border-2 transition-all shadow-sm ${
                i === 0 ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-100'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                    i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {stop.displayIndex}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-900">{stop.address.street} {stop.address.houseNumber}</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                      {stop.address.postalCode} {stop.address.city}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pakket-details per apotheek */}
              <div className="mb-6 space-y-2">
                {stop.packages.map(p => (
                  <div key={p.id} className="flex items-center space-x-3 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-blue-600">
                      <Building2 size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-900 leading-none">{p.pharmacyName}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">ID: {p.id.split('-').pop()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.address.street}+${stop.address.houseNumber}+${stop.address.city}`)}
                  className="flex items-center justify-center space-x-2 bg-slate-50 text-slate-900 py-4 rounded-2xl font-black text-sm border border-slate-200 active:scale-95 transition-all"
                >
                  <Navigation size={18} />
                  <span>Navigeer</span>
                </button>
                <button 
                  onClick={() => handleDeliverStop(stop)}
                  disabled={!!isCapturingGPS}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isCapturingGPS === stop.addressKey ? <Clock className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                  <span>Lever Af</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showMapModal && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex flex-col p-6">
          <div className="flex items-center justify-between text-white mb-8">
            <h3 className="text-xl font-black">Route Overzicht</h3>
            <button onClick={() => setShowMapModal(false)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><X size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white p-10 rounded-[3rem] text-center max-w-xs">
               <MapIcon size={40} className="text-blue-600 mx-auto mb-6" />
               <p className="text-slate-900 font-black text-xl mb-3">Google Maps</p>
               <p className="text-slate-500 text-sm font-medium mb-8">Open de volledige geoptimaliseerde route.</p>
               <button 
                 onClick={() => { window.open(getFullRouteUrl()); setShowMapModal(false); }}
                 className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl"
               >
                 Start Navigatie
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourierView;