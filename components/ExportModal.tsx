import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { Package, Pharmacy } from '../types';
import { exportPerCourier, exportAllInOne, filterPackages } from '../services/exportService';

interface ExportModalProps {
  packages:    Package[];
  pharmacies:  Pharmacy[];
  pharmacyId?: string;
  onClose:     () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
  packages, pharmacies, pharmacyId, onClose,
}) => {
  const today   = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [startDate, setStartDate]           = useState(weekAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate]               = useState(today.toISOString().split('T')[0]);
  const [selectedPharmacy, setSelectedPharmacy] = useState(pharmacyId ?? 'all');
  const [exportMode, setExportMode]         = useState<'per_courier' | 'all_in_one'>('per_courier');

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

  const setPeriod = (days: number) => {
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const inputCls = 'w-full h-11 px-3 rounded-2xl border border-[#bccac4]/30 text-sm font-body font-bold text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/20 focus:border-[#006b5a] transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <div className="bg-white w-full max-w-md rounded-3xl animate-in zoom-in-95 duration-200"
        style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.20)' }}>

        {/* Header */}
        <div className="p-5 border-b border-[#bccac4]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#48c2a9]/15 rounded-full flex items-center justify-center text-[#006b5a]">
              <Download size={20} />
            </div>
            <h2 className="font-display font-black text-[#191c1e]">Exporteren naar CSV</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] hover:bg-red-50 hover:text-red-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Snelknoppen periode */}
          <div>
            <p className="text-xs font-display font-black text-[#3d4945]/60 uppercase tracking-widest mb-2">Periode</p>
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
                  className="px-3 py-1.5 rounded-full text-xs font-display font-black bg-[#f2f4f6] text-[#3d4945]/60 hover:bg-[#48c2a9]/15 hover:text-[#006b5a] transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Datumvelden */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-display font-black text-[#3d4945]/60 uppercase tracking-widest mb-1.5 block">Startdatum</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-display font-black text-[#3d4945]/60 uppercase tracking-widest mb-1.5 block">Einddatum</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={new Date().toISOString().split('T')[0]} className={inputCls} />
            </div>
          </div>

          {/* Apotheek filter */}
          {!pharmacyId && pharmacies.length > 1 && (
            <div>
              <label className="text-xs font-display font-black text-[#3d4945]/60 uppercase tracking-widest mb-1.5 block">Apotheek</label>
              <select value={selectedPharmacy} onChange={e => setSelectedPharmacy(e.target.value)} className={inputCls}>
                <option value="all">Alle apotheken</option>
                {pharmacies.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Export modus */}
          <div>
            <p className="text-xs font-display font-black text-[#3d4945]/60 uppercase tracking-widest mb-2">Bestand</p>
            <div className="space-y-2">
              {[
                { key: 'per_courier' as const, label: 'Per koerier (apart bestand per koerier)', desc: 'Eén CSV bestand per koerier, per dag gegroepeerd' },
                { key: 'all_in_one' as const,  label: 'Alles in één bestand',                    desc: 'Gesorteerd op koerier, dan op datum' },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    exportMode === opt.key
                      ? 'border-[#48c2a9]/30 bg-[#48c2a9]/10'
                      : 'border-[#bccac4]/20 hover:border-[#bccac4]/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportMode"
                    value={opt.key}
                    checked={exportMode === opt.key}
                    onChange={() => setExportMode(opt.key)}
                    className="mt-0.5"
                    style={{ accentColor: '#006b5a' }}
                  />
                  <div>
                    <p className="text-sm font-display font-black text-[#191c1e]">{opt.label}</p>
                    <p className="text-xs font-body text-[#3d4945]/60 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview teller */}
          <div className="bg-[#f7f9fb] rounded-2xl p-3 flex items-center justify-between">
            <span className="text-sm font-body font-bold text-[#3d4945]">Te exporteren pakketjes</span>
            <span className="font-display font-black text-[#191c1e] text-lg">{previewCount}</span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 bg-[#f2f4f6] text-[#3d4945] rounded-full font-display font-black text-sm hover:bg-[#e8eceb] transition-colors"
          >
            Annuleer
          </button>
          <button
            onClick={handleExport}
            disabled={previewCount === 0}
            className="flex-1 h-12 text-white rounded-full font-display font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
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
