import React, { useState, useEffect, useMemo } from 'react';
import { Institution, DeliveryFrequency } from '../types';
import {
  Building2, CheckCircle2, ChevronDown, X, Loader2, ArrowRight,
} from 'lucide-react';

interface Props {
  institutions: Institution[];
  onStartRoute: (selected: Institution[]) => void;
  isOptimizing: boolean;
  onClose?:     () => void;
}

const DAY_LABELS: Record<string, string> = {
  ma: 'Ma', di: 'Di', wo: 'Wo', do: 'Do', vr: 'Vr', za: 'Za', zo: 'Zo',
};

const FREQ_BADGE: Record<DeliveryFrequency, { cls: string; label: string }> = {
  daily:  { cls: 'bg-[#006b5a]/15 text-[#006b5a]', label: 'DAGELIJKS' },
  weekly: { cls: 'bg-[#253046]/10 text-[#253046]', label: 'WEKELIJKS' },
  both:   { cls: 'bg-[#48c2a9]/15 text-[#006b5a]', label: 'DAGELIJKS + WEKELIJKS' },
};

const dayLabels = (codes: string[]): string =>
  codes.map(c => DAY_LABELS[c]).filter(Boolean).join(' ');

const InstitutionSelector: React.FC<Props> = ({ institutions, onStartRoute, isOptimizing, onClose }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter]     = useState<'all' | 'daily' | 'weekly'>('all');

  // Selecteer standaard alle instellingen die vandaag aan de beurt zijn
  useEffect(() => {
    const today = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][new Date().getDay()];
    const todayInstitutions = institutions
      .filter(i => i.isActive && (i.frequency === 'daily' || i.deliveryDays.includes(today)))
      .map(i => i.id);
    setSelected(new Set(todayInstitutions));
  }, [institutions]);

  const activeInstitutions = useMemo(
    () => institutions.filter(i => i.isActive),
    [institutions],
  );

  const filtered = useMemo(() => {
    if (filter === 'daily')  return activeInstitutions.filter(i => i.frequency === 'daily' || i.frequency === 'both');
    if (filter === 'weekly') return activeInstitutions.filter(i => i.frequency === 'weekly' || i.frequency === 'both');
    return activeInstitutions;
  }, [activeInstitutions, filter]);

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleStart = () => {
    const chosen = institutions.filter(i => selected.has(i.id));
    if (chosen.length > 0) onStartRoute(chosen);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col animate-in fade-in duration-200 bg-[#f7f9fb]">
      {/* Header */}
      <div className="bg-white border-b border-[#bccac4]/20 px-5 pt-safe pt-6 pb-4 flex items-start justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#48c2a9]/15 flex items-center justify-center shrink-0">
            <Building2 size={20} className="text-[#006b5a]" />
          </div>
          <div>
            <h2 className="text-lg font-display font-black text-[#191c1e] leading-tight">Vaste instellingen</h2>
            <p className="text-xs text-[#3d4945]/60 font-body font-bold mt-0.5">
              Selecteer de instellingen voor vandaag
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-10 h-10 bg-[#f2f4f6] rounded-2xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all shrink-0"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="px-5 py-3 flex gap-2 shrink-0">
        {([
          { key: 'all',    label: 'Alle'      },
          { key: 'daily',  label: 'Dagelijks' },
          { key: 'weekly', label: 'Wekelijks' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 h-9 rounded-full text-xs font-display font-bold transition-all active:scale-95 ${
              filter === t.key ? 'text-white' : 'bg-white text-[#3d4945]'
            }`}
            style={filter === t.key ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lijst */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-[#48c2a9]/15 flex items-center justify-center mb-4">
              <Building2 className="text-[#006b5a]" size={26} />
            </div>
            <p className="text-[#191c1e] font-display font-black">Geen instellingen</p>
            <p className="text-[#3d4945]/60 text-sm font-body mt-1">
              Er zijn geen actieve instellingen voor dit filter.
            </p>
          </div>
        ) : (
          filtered.map(inst => {
            const isSelected = selected.has(inst.id);
            const isOpen = expanded.has(inst.id);
            const badge = FREQ_BADGE[inst.frequency];
            return (
              <div
                key={inst.id}
                className={`bg-white rounded-2xl overflow-hidden transition-all border-2 ${
                  isSelected ? 'border-[#006b5a]' : 'border-transparent'
                }`}
                style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
              >
                <button
                  onClick={() => toggleSelect(inst.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left active:scale-[0.99] transition-all"
                >
                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isSelected ? 'border-[#006b5a] bg-[#006b5a]' : 'border-[#bccac4] bg-white'
                  }`}>
                    {isSelected && <CheckCircle2 size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-black text-[#191c1e] text-sm truncate">
                        🏥 {inst.name}
                      </span>
                    </div>
                    <p className="text-xs text-[#3d4945]/70 font-body font-bold mt-0.5">
                      {inst.address || 'Geen adres'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {inst.deliveryDays.length > 0 && (
                        <span className="text-xs text-[#3d4945]/50 font-body font-bold">
                          {dayLabels(inst.deliveryDays)}
                        </span>
                      )}
                      <span className={`text-[10px] font-display font-black px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Instructies tonen */}
                {(inst.instructions || inst.contactPerson) && (
                  <button
                    onClick={() => toggleExpand(inst.id)}
                    className="w-full flex items-center justify-end gap-1 px-4 pb-3 text-xs font-display font-black text-[#006b5a] active:opacity-70"
                  >
                    {isOpen ? 'Instructies verbergen' : 'Instructies tonen'}
                    <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {isOpen && (
                  <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 text-sm">
                    <p className="font-bold text-amber-800 mb-1">📋 Bezorginstructies</p>
                    <p className="text-amber-700 whitespace-pre-wrap">
                      {inst.instructions || 'Geen instructies ingevoerd.'}
                    </p>
                    {inst.contactPerson && (
                      <p className="text-amber-700 mt-2">
                        👤 Contact: {inst.contactPerson}
                        {inst.contactPhone && ` — ${inst.contactPhone}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Onderbalk: route plannen */}
      {selected.size > 0 && (
        <div className="bg-white border-t border-[#bccac4]/20 px-5 pt-4 pb-safe pb-6 shrink-0">
          <button
            onClick={handleStart}
            disabled={selected.size === 0 || isOptimizing}
            className="w-full h-14 rounded-full text-white font-display font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
          >
            {isOptimizing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Route berekenen…
              </>
            ) : (
              <>
                Route plannen voor {selected.size} instelling{selected.size !== 1 ? 'en' : ''}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default InstitutionSelector;
