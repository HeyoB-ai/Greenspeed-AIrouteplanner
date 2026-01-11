import React, { useState } from 'react';
import { Package as PackageType, PackageStatus, DeliveryEvidence } from '../types';
import { MapPin, Navigation, CheckCircle, Truck, Map as MapIcon, X, Clock, MapPinned } from 'lucide-react';

interface Props {
  packages: PackageType[];
  onUpdate: (id: string, status: PackageStatus, evidence?: DeliveryEvidence) => void;
}

const CourierView: React.FC<Props> = ({ packages, onUpdate }) => {
  const [showMapModal, setShowMapModal] = useState(false);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);

  const activePackages = packages
    .filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP)
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const handleDeliver = (p: PackageType) => {
    setIsCapturingGPS(true);
    
    if (!navigator.geolocation) {
      alert("GPS is niet beschikbaar op dit apparaat.");
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
        onUpdate(p.id, PackageStatus.DELIVERED, evidence);
        setIsCapturingGPS(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        alert("Kon locatie niet vastleggen. Bezorging zonder GPS bewijs niet toegestaan.");
        setIsCapturingGPS(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // Generate Google Maps URL with waypoints
  const getRouteUrl = () => {
    if (activePackages.length === 0) return '';
    const origin = 'Apotheek+Lamberts+Hilversum';
    const waypoints = activePackages.slice(0, -1).map(p => `${p.address.street}+${p.address.houseNumber}+${p.address.city}`).join('|');
    const destination = activePackages[activePackages.length - 1];
    const destStr = `${destination.address.street}+${destination.address.houseNumber}+${destination.address.city}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destStr}&waypoints=${waypoints}&travelmode=bicycling`;
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vandaag</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Route Geoptimaliseerd door AI</p>
        </div>
        {activePackages.length > 0 && (
          <button 
            onClick={() => setShowMapModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
          >
            <MapIcon size={20} />
            <span>Kaart</span>
          </button>
        )}
      </div>

      {activePackages.length === 0 ? (
        <div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Truck className="text-slate-300" size={40} />
          </div>
          <p className="text-slate-900 font-black text-xl">Lege Route</p>
          <p className="text-slate-400 text-sm mt-2 max-w-[200px] mx-auto font-medium leading-relaxed">Wacht op de apotheek om je rit klaar te zetten.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activePackages.map((p, i) => (
            <div 
              key={p.id} 
              className={`relative bg-white p-8 rounded-[2.5rem] border-2 shadow-sm transition-all ${
                i === 0 ? 'border-blue-600 ring-8 ring-blue-50' : 'border-slate-100 opacity-60'
              }`}
            >
              {i === 0 && (
                <div className="absolute -top-3 left-8 bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Volgende Stop
                </div>
              )}
              
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center space-x-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                    i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-black text-xl leading-tight text-slate-900">{p.address.street} {p.address.houseNumber}</h3>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">{p.address.postalCode} {p.address.city}</p>
                  </div>
                </div>
              </div>

              {i === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.address.street}+${p.address.houseNumber}+${p.address.city}`)}
                    className="flex items-center justify-center space-x-3 bg-slate-100 text-slate-900 py-5 rounded-3xl font-black active:scale-95 transition-all border border-slate-200"
                  >
                    <Navigation size={22} />
                    <span>Route</span>
                  </button>
                  <button 
                    onClick={() => handleDeliver(p)}
                    disabled={isCapturingGPS}
                    className="flex items-center justify-center space-x-3 bg-green-600 text-white py-5 rounded-3xl font-black shadow-xl shadow-green-100 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isCapturingGPS ? <Clock className="animate-spin" size={22} /> : <CheckCircle size={22} />}
                    <span>{isCapturingGPS ? 'Locatie...' : 'Bezorgd'}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Map Modal */}
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
             <iframe 
               src={getRouteUrl().replace('https://www.google.com/maps/dir/', 'https://www.google.com/maps/embed/v1/directions?key=YOUR_API_KEY_HERE&')}
               className="w-full h-full border-0"
               title="Route Kaart"
               // Opmerking: Voor een echte embed is een Google Maps Embed API key nodig.
               // Als fallback gebruiken we hier een directe link visualisatie in de knop hieronder.
             />
             <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-xs border border-white/20">
                   <MapIcon size={48} className="mx-auto text-blue-600 mb-6" />
                   <p className="text-slate-900 font-black text-xl mb-4">Interactieve Kaart</p>
                   <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">Bekijk de volledige route met alle stops in de Google Maps app.</p>
                   <button 
                     onClick={() => window.open(getRouteUrl())}
                     className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg"
                   >
                     Open in Google Maps
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