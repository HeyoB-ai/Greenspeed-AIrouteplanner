import React from 'react';
import { Package as PackageType, PackageStatus } from '../types';
import { MapPin, Navigation, CheckCircle, Truck } from 'lucide-react';

interface Props {
  packages: PackageType[];
  onUpdate: (id: string, status: PackageStatus) => void;
}

const CourierView: React.FC<Props> = ({ packages, onUpdate }) => {
  const myPackages = packages.filter(p => p.status !== PackageStatus.DELIVERED);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black">Jouw Route</h2>
        <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
        </div>
      </div>

      {myPackages.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400">
          <Truck className="mx-auto mb-4 opacity-20" size={48} />
          <p className="font-bold">Geen stops meer over!</p>
          <p className="text-sm">Meld je bij de supervisor voor nieuwe ritten.</p>
        </div>
      ) : (
        myPackages.map((p, i) => (
          <div key={p.id} className={`bg-white p-6 rounded-3xl border-2 shadow-sm transition-all ${i === 0 ? 'border-blue-600 ring-4 ring-blue-50' : 'border-slate-100 opacity-60'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${i === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-black text-lg leading-tight">{p.address.street} {p.address.houseNumber}</h3>
                  <p className="text-slate-500 text-sm font-medium">{p.address.postalCode} {p.address.city}</p>
                </div>
              </div>
            </div>

            {i === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.address.street}+${p.address.houseNumber}+${p.address.city}`)}
                  className="flex items-center justify-center space-x-2 bg-slate-100 text-slate-900 py-4 rounded-2xl font-bold active:scale-95 transition-transform"
                >
                  <Navigation size={18} /><span>Navigeer</span>
                </button>
                <button 
                  onClick={() => onUpdate(p.id, PackageStatus.DELIVERED)}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-100 active:scale-95 transition-transform"
                >
                  <CheckCircle size={18} /><span>Bezorgd</span>
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default CourierView;