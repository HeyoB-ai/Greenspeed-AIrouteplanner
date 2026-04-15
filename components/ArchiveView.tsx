import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Package as PackageType, PackageStatus, Pharmacy, HeatmapPoint, DailyCount } from '../types';
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
  pharmacyId?: string;
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
  { label: 'Totaal',         value: s.totalPackages,       icon: '📦' },
  { label: 'Bezorgd',        value: s.delivered,           icon: '✅' },
  { label: 'Brievenbus',     value: s.mailbox,             icon: '📬' },
  { label: 'Bij buren',      value: s.neighbour,           icon: '🏠' },
  { label: 'Retour',         value: s.returned,            icon: '🔙' },
  { label: 'Mislukt',        value: s.failed,              icon: '❌' },
  { label: 'Verhuisd',       value: s.moved,               icon: '📦' },
  { label: 'Andere locatie', value: s.otherLocation,       icon: '🏥' },
  { label: 'Bezorgd %',      value: `${s.deliveryRate}%`,  icon: '📊' },
  { label: 'Gem. per dag',   value: s.avgPerDay,           icon: '📅' },
];

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
  const [activePeriod, setActivePeriod]                 = useState<Period>('week');
  const [activePharmacyFilter, setActivePharmacyFilter] = useState<string>('all');
  const [heatmapPoints, setHeatmapPoints]               = useState<HeatmapPoint[]>([]);
  const [showMap, setShowMap]                           = useState(false);

  const filteredPharmacyId = pharmacyId ?? (activePharmacyFilter === 'all' ? undefined : activePharmacyFilter);

  const periodPackages = useMemo(
    () => filterPackagesByPeriod(packages, activePeriod, filteredPharmacyId),
    [packages, activePeriod, filteredPharmacyId]
  );

  const stats      = useMemo(() => calculateStats(periodPackages, activePeriod), [periodPackages, activePeriod]);
  const dailyCounts = useMemo(() => getDailyCounts(periodPackages), [periodPackages]);

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

  useEffect(() => {
    setHeatmapPoints(buildHeatmapPoints(periodPackages));
  }, [activePeriod, activePharmacyFilter, packages]);

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
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-display font-black uppercase tracking-widest transition-all ${
                activePeriod === tab.key
                  ? 'text-white'
                  : 'bg-[#f2f4f6] text-[#3d4945]/60 hover:bg-[#e8eceb]'
              }`}
              style={activePeriod === tab.key ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
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
            className="mt-3 text-sm font-bold text-[#006b5a] bg-[#48c2a9]/10 px-3 py-2 rounded-xl border border-[#48c2a9]/30 focus:outline-none focus:ring-2 focus:ring-[#006b5a]/20"
          >
            <option value="all">Alle apotheken</option>
            {pharmacies.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Statistiekenkaartjes ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {STAT_CARDS(stats).map(card => (
          <div
            key={card.label}
            className="bg-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow"
            style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-display font-black text-[#191c1e]">{card.value}</div>
            <div className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Trendgrafiek ── */}
      {showChart && (
        <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
          <h3 className="font-display font-black text-[#191c1e] mb-4 text-sm uppercase tracking-widest">Bezorgingen over tijd</h3>
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
              <Line type="monotone" dataKey="total"     stroke="#006b5a" strokeWidth={2} dot={false} name="total" />
              <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} name="delivered" />
              <Line type="monotone" dataKey="failed"    stroke="#ef4444" strokeWidth={2} dot={false} name="failed" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3 text-[10px] font-display font-black uppercase tracking-widest">
            <span className="flex items-center gap-1.5 text-[#006b5a]"><span className="w-4 h-0.5 bg-[#006b5a] inline-block rounded"/>Totaal</span>
            <span className="flex items-center gap-1.5 text-emerald-500"><span className="w-4 h-0.5 bg-emerald-500 inline-block rounded"/>Bezorgd</span>
            <span className="flex items-center gap-1.5 text-red-500"><span className="w-4 h-0.5 bg-red-500 inline-block rounded"/>Mislukt</span>
          </div>
        </div>
      )}

      {/* ── Niet-thuis rapportage ── */}
      {(() => {
        const notHomeStatuses = [PackageStatus.RETURN, PackageStatus.MOVED, PackageStatus.OTHER_LOCATION, PackageStatus.FAILED];
        const notHomePkgs = periodPackages.filter(p => notHomeStatuses.includes(p.status));
        if (notHomePkgs.length === 0) return null;
        return (
          <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
            <div className="px-6 py-4 border-b border-[#bccac4]/20">
              <h3 className="font-display font-black text-[#191c1e] text-sm uppercase tracking-widest">Niet-thuis rapportage</h3>
              <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase mt-0.5">
                {notHomePkgs.length} bezorgingen met afwijkende uitkomst
              </p>
            </div>
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {notHomePkgs.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {p.status === PackageStatus.MOVED          && <span className="text-base">📦</span>}
                    {p.status === PackageStatus.OTHER_LOCATION && <span className="text-base">🏥</span>}
                    {p.status === PackageStatus.RETURN         && <span className="text-base">🔙</span>}
                    {p.status === PackageStatus.FAILED         && <span className="text-base">❌</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-black text-[#191c1e] leading-tight truncate">
                      {p.address.street} {p.address.houseNumber}, {p.address.city}
                    </p>
                    {p.deliveryEvidence?.deliveryNote && (
                      <p className="text-xs font-body text-[#3d4945]/60 mt-0.5 leading-snug">
                        {p.deliveryEvidence.deliveryNote}
                      </p>
                    )}
                    <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-0.5">
                      {new Date(p.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      {p.pharmacyName && ` · ${p.pharmacyName}`}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-display font-black uppercase tracking-widest ${
                    p.status === PackageStatus.MOVED          ? 'bg-[#48c2a9]/15 text-[#006b5a]' :
                    p.status === PackageStatus.OTHER_LOCATION ? 'bg-[#f2f4f6] text-[#3d4945]' :
                    p.status === PackageStatus.RETURN         ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Heatmap ── */}
      <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
        <div className="p-5 border-b border-[#bccac4]/20 flex items-center justify-between">
          <div>
            <h3 className="font-display font-black text-[#191c1e] text-sm uppercase tracking-widest">Bezorglocaties — heatmap</h3>
            <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase mt-0.5">
              {periodPackages.length} zendingen in deze periode
            </p>
          </div>
          <button
            onClick={() => setShowMap(v => !v)}
            className={`px-4 py-2 rounded-full text-xs font-display font-black uppercase tracking-widest transition-all active:scale-95 ${
              showMap ? 'bg-[#f2f4f6] text-[#3d4945]' : 'text-white'
            }`}
            style={!showMap ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
          >
            {showMap ? 'Verberg kaart' : 'Toon kaart'}
          </button>
        </div>

        {showMap && (
          <>
            <div className="px-5 py-3 border-b border-[#bccac4]/20 flex items-center gap-5 text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/>1</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"/>2–3</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block"/>3–5</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/>5+</span>
            </div>

            {heatmapPoints.length === 0 ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center text-[#3d4945]/50">
                  <p className="text-3xl mb-2">📍</p>
                  <p className="font-display font-black text-sm">Geen GPS-data voor deze periode</p>
                  <p className="text-xs font-body mt-1">
                    GPS-locatie wordt opgeslagen bij bezorging via de koeriers-app
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-80">
                <MapContainer
                  center={[52.228, 5.179]}
                  zoom={12}
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
                        <div className="text-xs text-slate-500 mt-1">
                          {point.weight} pakket{point.weight !== 1 ? 'jes' : ''}
                        </div>
                        {point.deliveredAt && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(point.deliveredAt).toLocaleString('nl-NL', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        )}
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
