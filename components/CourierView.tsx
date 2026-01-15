import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import { MapPin, Navigation, CheckCircle, Truck, Map as MapIcon, X, Clock, MapPinned, ChevronDown, Package } from 'lucide-react';

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

const CourierView: React.FC<Props> = ({ packages, onUpdate, onUpdateMany }) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);

  // Groepeer pakketten naar Stops op basis van orderIndex en displayIndex
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
    setIsCapturingGPS(true);
    
    if (!navigator.geolocation) {
      alert("GPS niet beschikbaar.");
      setIsCapturingGPS(false);
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
        setIsCapturingGPS(false);
      },
      (error) => {
        alert("GPS lokalisatie mislukt.");
        setIsCapturingGPS(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const getRouteUrl = () => {
    if (stops.length === 0) return '';
    const origin = 'Apotheek+Lamberts+Hilversum';
    const waypoints = stops.slice(0, -1).map(s => `${s.address.street}+${s.address.houseNumber}+${s.address.city}`).join('|');
    const destination = stops[stops.length - 1];
    const destStr = `${destination.address.street}+${destination.address.houseNumber}+${destination.address.city}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destStr}&waypoints=${waypoints}&travelmode=bicycling`;
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Rit Overzicht</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {stops.length} STOPS • {packages.filter(p => p.status === PackageStatus.ASSIGNED).length} PAKKETTEN
          </p>
        </div>
        {stops.length > 0 && (
          <button 
            onClick={() => setShowMapModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
          >
            <MapIcon size={20} />
            <span>Route</span>
          </button>
        )}
      </div>

      {stops.length === 0 ? (
        <div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Truck className="text-slate-300" size={40} />
          </div>
          <p className="text-slate-900 font-black text-xl">Geen stops</p>
          <p className="text-slate-400 text-sm mt-2 max-w-[200px] mx-auto font-medium">Alle medicijnen zijn bezorgd of er is nog geen rit gepland.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {stops.map((stop, i) => (
            <div 
              key={stop.addressKey} 
              className={`relative bg-white p-8 rounded-[2.5rem] border-2 shadow-sm transition-all ${
                i === 0 ? 'border-blue-600 ring-8 ring-blue-50' : 'border-slate-100 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                    i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {stop.displayIndex}
                  </div>
                  <div>
                    <h3 className="font-black text-xl leading-tight text-slate-900">{stop.address.street} {stop.address.houseNumber}</h3>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">{stop.address.postalCode} {stop.address.city}</p>
                  </div>
                </div>
                {stop.packages.length > 1 && (
                  <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center space-x-1">
                    <Package size={10} />
                    <span>{stop.packages.length}</span>
                  </div>
                )}
              </div>

              {i === 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.address.street}+${stop.address.houseNumber}+${stop.address.city}`)}
                      className="flex items-center justify-center space-x-3 bg-slate-100 text-slate-900 py-5 rounded-3xl font-black active:scale-95 transition-all border border-slate-200"
                    >
                      <Navigation size={22} />
                      <span>Navigeer</span>
                    </button>
                    <button 
                      onClick={() => handleDeliverStop(stop)}
                      disabled={isCapturingGPS}
                      className="flex items-center justify-center space-x-3 bg-green-600 text-white py-5 rounded-3xl font-black shadow-xl shadow-green-100 active:scale-95 disabled:opacity-50 transition-all"
                    >
                      {isCapturingGPS ? <Clock className="animate-spin" size={22} /> : <CheckCircle size={22} />}
                      <span>{isCapturingGPS ? 'Locatie...' : 'Lever Af'}</span>
                    </button>
                  </div>
                  
                  {stop.packages.length > 1 && (
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Inhoud van deze stop:</p>
                      <div className="space-y-1">
                        {stop.packages.map((p, idx) => (
                          <div key={p.id} className="text-xs font-bold text-slate-600 flex items-center space-x-2">
                             <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                             <span>Pakket {idx + 1} (ID: {p.id.split('-').pop()})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-400">
                   <p className="text-[10px] font-black uppercase tracking-widest">Wachten op vorige stop</p>
                   <div className="flex -space-x-2">
                     {stop.packages.map((_, idx) => (
                       <div key={idx} className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                         <Package size={10} />
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showMapModal && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
          <div className="p-6 flex items-center justify-between text-white">
            <div className="flex items-center space-x-3">
              <MapPinned size={24} className="text-blue-400" />
              <h3 className="text-xl font-black">Route Overzicht</h3>
            </div>
            <button onClick={() => setShowMapModal(false)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 bg-slate-100 rounded-t-[3rem] overflow-hidden relative">
             <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs border border-white/20">
                   <MapIcon size={48} className="mx-auto text-blue-600 mb-6" />
                   <p className="text-slate-900 font-black text-xl mb-4">Google Maps Route</p>
                   <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">De route bevat {stops.length} unieke stops voor optimale efficiëntie.</p>
                   <button 
                     onClick={() => window.open(getRouteUrl())}
                     className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg"
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