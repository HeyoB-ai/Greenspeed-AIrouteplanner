import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Package as PackageType, Pharmacy, HeatmapPoint, DailyCount } from '../types';
import {
  filterPackagesByPeriod,
  calculateStats,
  getDailyCounts,
  buildHeatmapPoints,
  Period,
} from '../services/archiveService';

// Fix Leaflet default icon paths broken by Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

interface Props {
  packages:    PackageType[];
  pharmacyId?: string;    // undefined = superuser (alle apotheken)
  pharmacies?: Pharmacy[];
}

const TABS: { key: Period; label: string }[] = [
  { key: 'today',     label: 'Vandaag'         },
  { key: 'yesterday', label: 'Gisteren'        },
  { key: 'week',      label: 'Afgelopen week'  },
  { key: 'month',     label: 'Afgelopen maand' },
  { key: 'year',      label: 'Afgelopen jaar'  },
];

const STAT_CARDS = (s: ReturnType<typeof calculateStats>) => [
  { label: 'Totaal',       value: s.totalPackages,       icon: '📦', color: 'blue'    },
  { label: 'Bezorgd',      value: s.delivered,           icon: '✅', color: 'emerald' },
  { label: 'Brievenbus',   value: s.mailbox,             icon: '📬', color: 'emerald' },
  { label: 'Bij buren',    value: s.neighbour,           icon: '🏠', color: 'blue'    },
  { label: 'Retour',       value: s.returned,            icon: '🔙', color: 'amber'   },
  { label: 'Mislukt',      value: s.failed,              icon: '❌', color: 'red'     },
  { label: 'Bezorgd %',    value: `${s.deliveryRate}%`,  icon: '📊', color: 'purple'  },
  { label: 'Gem. per dag', value: s.avgPerDay,           icon: '📅', color: 'slate'   },
];

// Auto-zoom map to fit all points
const MapBounds: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
};

const getColor = (weight: number) => {
  if (weight >= 5) return '#ef4444';
  if (weight >= 3) return '#f97316';
  if (weight >= 2) return '#eab308';
  return '#22c55e';
};

const ArchiveView: React.FC<Props> = ({ packages, pharmacyId, pharmacies }) => {
  const [activePeriod, setActivePeriod]         = useState<Period>('week');
  const [activePharmacyFilter, setActivePharmacyFilter] = useState<string>('all');
  const [heatmapPoints, setHeatmapPoints]       = useState<HeatmapPoint[]>([]);
  const [isLoadingMap, setIsLoadingMap]         = useState(false);
  const [showMap, setShowMap]                   = useState(false);

  const filteredPharmacyId = pharmacyId ?? (activePharmacyFilter === 'all' ? undefined : activePharmacyFilter);

  const periodPackages = useMemo(
    () => filterPackagesByPeriod(packages, activePeriod, filteredPharmacyId),
    [packages, activePeriod, filteredPharmacyId]
  );

  const stats = useMemo(() => calculateStats(periodPackages, activePeriod), [periodPackages, activePeriod]);

  const dailyCounts = useMemo(() => getDailyCounts(periodPackages), [periodPackages]);

  // Groepeer per maand voor jaaroverzicht
  const chartData: DailyCount[] = useMemo(() => {
    if (activePeriod !== 'year') return dailyCounts;
    return dailyCounts.reduce((acc, day) => {
      const month = day.date.substring(0, 7);
      const existing = acc.find(m => m.date === month);
      if (existing) {
        existing.total     += day.total;
        existing.delivered += day.delivered;
        existing.failed    += day.failed;
      } else {
        acc.push({ ...day, date: month });
      }
      return acc;
    }, [] as DailyCount[]);
  }, [dailyCounts, activePeriod]);

  const formatDate = (dateStr: string) => {
    if (activePeriod === 'year') {
      const [y, m] = dateStr.split('-');
      return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('nl-NL', { month: 'short' });
    }
    return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  // Laad heatmap punten als kaart geopend wordt of periode verandert
  useEffect(() => {
    if (!showMap) return;
    if (periodPackages.length === 0) { setHeatmapPoints([]); return; }
    setIsLoadingMap(true);
    setHeatmapPoints([]);
    buildHeatmapPoints(periodPackages).then(points => {
      setHeatmapPoints(points);
      setIsLoadingMap(false);
    });
  }, [showMap, activePeriod, activePharmacyFilter]);

  const showChart = ['week', 'month', 'year'].includes(activePeriod) && chartData.length > 0;

  return (
    <div className="space-y-6">

      {/* ── Periode tabs ── */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActivePeriod(tab.key)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                activePeriod === tab.key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Apotheek selector voor superuser */}
        {!pharmacyId && pharmacies && pharmacies.length > 0 && (
          <select
            value={activePharmacyFilter}
            onChange={e => setActivePharmacyFilter(e.target.value)}
            className="mt-3 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">Alle apotheken</option>
            {pharmacies.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Statistiekenkaartjes ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS(stats).map(card => (
          <div
            key={card.label}
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-black text-slate-900">{card.value}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Trendgrafiek ── */}
      {showChart && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-black text-slate-900 mb-4 text-sm uppercase tracking-widest">Bezorgingen over tijd</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              />
              <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value,
                  name === 'total' ? 'Totaal' : name === 'delivered' ? 'Bezorgd' : 'Mislukt',
                ]}
                labelFormatter={formatDate}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700 }}
              />
              <Line type="monotone" dataKey="total"     stroke="#3b82f6" strokeWidth={2} dot={false} name="total" />
              <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} name="delivered" />
              <Line type="monotone" dataKey="failed"    stroke="#ef4444" strokeWidth={2} dot={false} name="failed" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3 text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-blue-500"><span className="w-4 h-0.5 bg-blue-500 inline-block rounded"/>Totaal</span>
            <span className="flex items-center gap-1.5 text-emerald-500"><span className="w-4 h-0.5 bg-emerald-500 inline-block rounded"/>Bezorgd</span>
            <span className="flex items-center gap-1.5 text-red-500"><span className="w-4 h-0.5 bg-red-500 inline-block rounded"/>Mislukt</span>
          </div>
        </div>
      )}

      {/* ── Heatmap ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header met toggle */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Bezorglocaties — heatmap</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
              {periodPackages.length} zendingen in deze periode
            </p>
          </div>
          <button
            onClick={() => setShowMap(v => !v)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              showMap ? 'bg-slate-100 text-slate-600' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showMap ? 'Verberg kaart' : 'Toon kaart'}
          </button>
        </div>

        {showMap && (
          <>
            {/* Legenda */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/>1</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"/>2–3</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block"/>3–5</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/>5+</span>
            </div>

            {isLoadingMap ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <div className="text-3xl mb-2">🗺️</div>
                  <p className="font-bold text-sm">Adressen worden geladen...</p>
                  <p className="text-xs mt-1 text-slate-400">Max 50 adressen · ca. 1 sec. per adres</p>
                </div>
              </div>
            ) : periodPackages.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <p className="font-bold">Geen bezorgdata voor deze periode</p>
              </div>
            ) : heatmapPoints.length === 0 && !isLoadingMap ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <p className="font-bold text-sm">Geocoding mislukt — controleer internetverbinding</p>
              </div>
            ) : (
              <div className="h-80">
                <MapContainer
                  center={[52.2, 5.3]}
                  zoom={11}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap"
                  />
                  {heatmapPoints.map((point, i) => (
                    <CircleMarker
                      key={i}
                      center={[point.lat, point.lng]}
                      radius={Math.min(6 + point.weight * 3, 24)}
                      fillColor={getColor(point.weight)}
                      color="white"
                      weight={2}
                      opacity={0.9}
                      fillOpacity={0.7}
                    >
                      <Popup>
                        <div className="font-bold text-sm">{point.address}</div>
                        <div className="text-xs text-slate-500">
                          {point.weight} pakket{point.weight !== 1 ? 'jes' : ''}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                  <MapBounds points={heatmapPoints} />
                </MapContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ArchiveView;
