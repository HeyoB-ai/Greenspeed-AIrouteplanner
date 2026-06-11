import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Bike, Clock, Route as RouteIcon } from 'lucide-react';
import type { LatLng } from '../services/geminiService';

interface Props {
  coords:         LatLng[];
  totalDistanceM: number;
  totalDurationS: number;
  onClose:        () => void;
}

const numberedIcon = (n: number, color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${color};color:#fff;width:26px;height:26px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:800;
      font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const FitBounds: React.FC<{ coords: LatLng[] }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [coords, map]);
  return null;
};

const RouteMapModal: React.FC<Props> = ({ coords, totalDistanceM, totalDurationS, onClose }) => {
  const km  = (totalDistanceM / 1000).toFixed(1);
  const min = Math.round(totalDurationS / 60);
  const hasStats = totalDistanceM > 0;
  const center: [number, number] = coords.length
    ? [coords[0].lat, coords[0].lng]
    : [52.0907, 5.1214];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ boxShadow: '0 12px 48px rgba(25,28,30,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f2f4f6]">
          <h3 className="text-base font-black text-[#191c1e] flex items-center gap-2">
            <RouteIcon size={18} className="text-[#006b5a]" />
            Routeoverzicht
          </h3>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#f2f4f6] hover:bg-[#e8eaec] transition-all" aria-label="Sluiten">
            <X size={18} className="text-[#3d4945]" />
          </button>
        </div>

        <div className="flex items-center gap-6 px-6 py-3 bg-[#f7f9fa]">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#006b5a] text-white text-xs font-black flex items-center justify-center">{coords.length}</span>
            <span className="text-xs font-bold text-[#3d4945]">stops</span>
          </div>
          <div className="flex items-center gap-2">
            <Bike size={15} className="text-[#006b5a]" />
            <span className="text-sm font-black text-[#191c1e]">{hasStats ? `${km} km` : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-[#006b5a]" />
            <span className="text-sm font-black text-[#191c1e]">{hasStats ? `${min} min` : '—'}</span>
          </div>
        </div>

        <div className="flex-1 min-h-[320px]">
          {coords.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm font-bold text-[#3d4945]/60 py-10">
              Geen coördinaten beschikbaar voor deze route.
            </div>
          ) : (
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', minHeight: 320 }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Polyline positions={coords.map(c => [c.lat, c.lng] as [number, number])} pathOptions={{ color: '#006b5a', weight: 4, opacity: 0.7 }} />
              {coords.map((c, i) => {
                const color = i === 0 ? '#253046' : i === coords.length - 1 ? '#c2410c' : '#006b5a';
                return <Marker key={i} position={[c.lat, c.lng]} icon={numberedIcon(i + 1, color)} />;
              })}
              <FitBounds coords={coords} />
            </MapContainer>
          )}
        </div>

        {!hasStats && coords.length > 0 && (
          <p className="px-6 py-3 text-xs font-bold text-amber-700 bg-amber-50">
            Afstand/tijd niet beschikbaar (route uit fallback-volgorde). De volgorde klopt wel.
          </p>
        )}
      </div>
    </div>
  );
};

export default RouteMapModal;
