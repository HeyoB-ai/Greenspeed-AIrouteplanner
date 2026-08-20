import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Bike, Clock, Route as RouteIcon } from 'lucide-react';
import type { LatLng } from '../services/geminiService';
import type { Address } from '../types';
import { addressKey } from '../utils/addressKey';

// ── Schattingen voor de bezorgtijd ──────────────────────────────────────────
// Dit zijn SCHATTINGEN, geen gemeten waarden. Zodra er echte tijdregistratie per
// stop is, horen deze getallen daaruit te komen.
//
// De fietstijd zelf komt van de Google Routes API (travelMode BICYCLE) en is dus
// werkelijke wegafstand met Google's fietsmodel — er wordt hier niets over de
// snelheid aangenomen. Wat ontbrak is de tijd die stilstaan bij de deur kost.
const STOP_SECONDS_PER_ADDRESS       = 90; // aanbellen, overdracht, terug naar de fiets
const STOP_SECONDS_PER_EXTRA_PACKAGE = 15; // tweede/derde pakket op hetzelfde adres

/** Eén pakket in de geoptimaliseerde volgorde. */
export interface RouteStop {
  id:          string;
  scanNumber?: number;
  address:     Address;
}

interface Props {
  coords:         LatLng[];
  totalDistanceM: number;
  totalDurationS: number;
  /** Pakketten in bezorgvolgorde — voedt de markers, de teller en de bezorgtijd. */
  stops?:         RouteStop[];
  onClose:        () => void;
}

// Marge waarbinnen twee coördinaten als hetzelfde punt gelden. ~0,0002° is op
// deze breedtegraad ruwweg 20 m: genoeg om het verschil tussen de leg-coördinaat
// van Google en de PDOK-coördinaat van hetzelfde adres te overbruggen.
const SAME_POINT_DEG = 0.0002;

const isSamePoint = (a?: LatLng | null, b?: { lat?: number | null; lng?: number | null } | null): boolean => {
  if (!a || b?.lat == null || b?.lng == null) return false;
  return Math.abs(a.lat - b.lat) < SAME_POINT_DEG && Math.abs(a.lng - b.lng) < SAME_POINT_DEG;
};

// Pakketmarker: toont het scannummer dat de koerier op het pakje schrijft.
// Bewust niet de routepositie erbij — twee getallen zijn op 26 px onleesbaar.
const scanIcon = (scanNumber?: number) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:#006b5a;color:#fff;width:26px;height:26px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:800;
      font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">${scanNumber ?? '?'}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

// Vertrek- en eindpunt zijn geen pakketten: kleiner, zonder nummer, eigen kleur.
const endpointIcon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="
      background:${color};width:16px;height:16px;border-radius:50%;
      border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

const RouteMapModal: React.FC<Props> = ({ coords, totalDistanceM, totalDurationS, stops = [], onClose }) => {
  const km  = (totalDistanceM / 1000).toFixed(1);
  const hasStats = totalDistanceM > 0;

  // Markers komen uit de pakketten, niet uit coords. coords bevat de leg-punten
  // van de Routes API inclusief vertrek- en eindpunt, en bij meer dan 25 stops
  // de punten van meerdere clusters achter elkaar — die index zegt niets over
  // welk pakket het is.
  const mappable   = stops.filter(s => s.address.lat != null && s.address.lng != null);
  const unmappable = stops.filter(s => s.address.lat == null || s.address.lng == null);

  // Vertrek- en eindpunt alleen tonen als ze niet samenvallen met het eerste of
  // laatste pakket. Zonder extern startpunt ís coords[0] het eerste pakket, en
  // dan zou er een tweede marker bovenop komen.
  const first = coords[0];
  const last  = coords[coords.length - 1];
  const startPoint = coords.length > 0 && !isSamePoint(first, mappable[0]?.address) ? first : null;
  const endPoint   = coords.length > 1 && !isSamePoint(last, mappable[mappable.length - 1]?.address) ? last : null;

  // Groepeer op adres: twee pakketten op één adres kosten één stop plus een
  // beetje extra, niet twee volle stops.
  const stopAddresses   = stops.map(s => s.address);
  const uniqueAddresses = new Set(stopAddresses.map(addressKey)).size;
  const extraPackages   = Math.max(0, stopAddresses.length - uniqueAddresses);

  const cyclingMin  = Math.round(totalDurationS / 60);
  const deliveryMin = Math.round(
    (uniqueAddresses * STOP_SECONDS_PER_ADDRESS + extraPackages * STOP_SECONDS_PER_EXTRA_PACKAGE) / 60
  );
  const totalMin = cyclingMin + deliveryMin;
  // Alles wat de kaart moet omvatten: de route én de pakketmarkers. Zonder de
  // markers erbij valt een pakket buiten beeld als de Routes API niets teruggaf.
  const bounds: LatLng[] = [
    ...coords,
    ...mappable.map(s => ({ lat: s.address.lat!, lng: s.address.lng! })),
  ];
  const center: [number, number] = bounds.length
    ? [bounds[0].lat, bounds[0].lng]
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

        {/* Eén regel met "Fietsen · Bezorgen · Totaal" wordt op een telefoon te
            breed, dus het totaal staat groot en de splitsing eronder klein. */}
        <div className="px-6 py-3 bg-[#f7f9fa]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {/* Aantal pakketten, niet coords.length: dat telde vertrek- en
                  eindpunt mee en bij clusters ook de tussenpunten daarvan. */}
              <span className="w-7 h-7 rounded-full bg-[#006b5a] text-white text-xs font-black flex items-center justify-center">{stops.length}</span>
              <span className="text-xs font-bold text-[#3d4945]">
                {stops.length === 1 ? 'pakket' : 'pakketten'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Bike size={15} className="text-[#006b5a]" />
              <span className="text-sm font-black text-[#191c1e]">{hasStats ? `${km} km` : '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-[#006b5a]" />
              <span className="text-sm font-black text-[#191c1e]">
                {hasStats ? `Totaal ~${totalMin} min` : '—'}
              </span>
              {hasStats && (
                <span className="text-[11px] font-bold text-[#3d4945]/60">(indicatie)</span>
              )}
            </div>
          </div>
          {hasStats && (
            <p className="mt-1 text-[11px] font-bold text-[#3d4945]/60">
              Fietsen ~{cyclingMin} min · Bezorgen ~{deliveryMin} min
              {uniqueAddresses > 0 && ` · ${uniqueAddresses} adres${uniqueAddresses === 1 ? '' : 'sen'}`}
            </p>
          )}
        </div>

        {/* Pakketten zonder coördinaten hebben geen marker. Ze stil weglaten zou
            betekenen dat een te bezorgen pakket nergens opduikt, dus ze worden
            hier bij scannummer genoemd. */}
        {unmappable.length > 0 && (
          <div className="px-6 py-2.5 bg-amber-100 text-amber-900">
            <p className="text-xs font-black">
              {unmappable.length} van {stops.length} {stops.length === 1 ? 'pakket staat' : 'pakketten staan'} niet op de kaart
            </p>
            <p className="text-[11px] font-bold mt-0.5 leading-snug">
              Geen coördinaten gevonden voor {unmappable.map(s => `#${s.scanNumber ?? '?'}`).join(', ')}
              {' '}— {unmappable.map(s => `${s.address.street} ${s.address.houseNumber}`).join(' · ')}.
              Ze staan wel gewoon in de lijst en moeten bezorgd worden.
            </p>
          </div>
        )}

        <div className="flex-1 min-h-[320px]">
          {coords.length === 0 && mappable.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm font-bold text-[#3d4945]/60 py-10">
              Geen coördinaten beschikbaar voor deze route.
            </div>
          ) : (
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', minHeight: 320 }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {/* De lijn blijft de werkelijke route volgen — die komt uit coords */}
              <Polyline positions={coords.map(c => [c.lat, c.lng] as [number, number])} pathOptions={{ color: '#006b5a', weight: 4, opacity: 0.7 }} />

              {startPoint && (
                <Marker position={[startPoint.lat, startPoint.lng]} icon={endpointIcon('#253046')} title="Vertrekpunt" />
              )}
              {endPoint && (
                <Marker position={[endPoint.lat, endPoint.lng]} icon={endpointIcon('#c2410c')} title="Eindpunt" />
              )}

              {mappable.map(s => (
                <Marker
                  key={s.id}
                  position={[s.address.lat!, s.address.lng!]}
                  icon={scanIcon(s.scanNumber)}
                  title={`#${s.scanNumber ?? '?'} — ${s.address.street} ${s.address.houseNumber}`}
                />
              ))}
              <FitBounds coords={bounds} />
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
