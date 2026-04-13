import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { Package, Pharmacy } from '../types';
import { exportPerCourier, exportAllInOne, filterPackages } from '../services/exportService';

interface ExportModalProps {
  packages:    Package[];
  pharmacies:  Pharmacy[];
  pharmacyId?: string;   // vooraf gefilterd als admin/apotheek — verbergt apotheekkiezer
  onClose:     () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
  packages, pharmacies, pharmacyId, onClose,
}) => {
  // Standaard: afgelopen week
  const today   = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [startDate, setStartDate]       = useState(weekAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate]           = useState(today.toISOString().split('T')[0]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(pharmacyId ?? 'all');
  const [exportMode, setExportMode]     = useState<'per_courier' | 'all_in_one'>('per_courier');

  // Preview: hoeveel pakketjes worden geëxporteerd
  const previewCount = filterPackages({
    packages,
    startDate:  new Date(startDate),
    endDate:    new Date(endDate),
    pharmacyId: selectedPharmacy === 'all' ? undefined : selectedPharmacy,
  }).length;

  const handleExport = () => {
    const opts = {
      packages,
      startDate:  new Date(startDate),
      endDate:    new Date(endDate),
      pharmacyId: selectedPharmacy === 'all' ? undefined : selectedPharmacy,
    };
    if (exportMode === 'per_courier') {
      exportPerCourier(opts);
    } else {
      exportAllInOne(opts);
    }
    onClose();
  };

  // Snelknoppen
  const setPeriod = (days: number) => {
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Download size={20} />
            </div>
            <h2 className="font-black text-slate-900">Exporteren naar CSV</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Snelknoppen periode */}
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Periode</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Vandaag',  days: 0  },
                { label: 'Gisteren', days: 1  },
                { label: '7 dagen',  days: 7  },
                { label: '30 dagen', days: 30 },
                { label: '90 dagen', days: 90 },
              ].map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => setPeriod(days)}
                  className="px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Datumvelden */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                Startdatum
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                max={endDate}
                className="w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                Einddatum
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
                className="w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {/* Apotheek filter (alleen voor superuser) */}
          {!pharmacyId && pharmacies.length > 1 && (
            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                Apotheek
              </label>
              <select
                value={selectedPharmacy}
                onChange={e => setSelectedPharmacy(e.target.value)}
                className="w-full h-11 px-3 rounded-2xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">Alle apotheken</option>
                {pharmacies.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Export modus */}
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Bestand</p>
            <div className="space-y-2">
              {[
                {
                  key:   'per_courier' as const,
                  label: 'Per koerier (apart bestand per koerier)',
                  desc:  'Eén CSV bestand per koerier, per dag gegroepeerd',
                },
                {
                  key:   'all_in_one' as const,
                  label: 'Alles in één bestand',
                  desc:  'Gesorteerd op koerier, dan op datum',
                },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    exportMode === opt.key
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportMode"
                    value={opt.key}
                    checked={exportMode === opt.key}
                    onChange={() => setExportMode(opt.key)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-black text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview teller */}
          <div className="bg-slate-50 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-sm text-slate-600 font-bold">Te exporteren pakketjes</span>
            <span className="font-black text-slate-900 text-lg">{previewCount}</span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-colors"
          >
            Annuleer
          </button>
          <button
            onClick={handleExport}
            disabled={previewCount === 0}
            className="flex-1 h-12 bg-blue-600 text-white rounded-2xl font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Download size={16} />
            Exporteer ({previewCount})
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExportModal;
