import React, { useState, useEffect, useCallback } from 'react';
import { Bike, RefreshCw, Check } from 'lucide-react';
import { db } from '../services/supabaseService';
import type { CourierProfile } from '../types';

// Beheer van koerier-uurlonen (input voor de financiële module).
// Zichtbaar in het Gebruikers-tabblad voor privileged rollen.
const CourierWagePanel: React.FC = () => {
  const [couriers, setCouriers] = useState<CourierProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [savedId, setSavedId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCouriers(await db.fetchCouriers());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveWage = async (courierId: string, raw: string) => {
    const wage = parseFloat(raw);
    if (Number.isNaN(wage) || wage < 0) return;
    try {
      await db.updateCourierWage(courierId, wage);
      setCouriers(prev => prev.map(c => c.id === courierId ? { ...c, hourlyWage: wage } : c));
      setSavedId(courierId);
      setTimeout(() => setSavedId(s => (s === courierId ? null : s)), 1500);
    } catch (err) {
      console.error('Uurloon opslaan mislukt:', err);
      alert('Uurloon opslaan mislukt. Heb je de RLS-policy uit migratie 007 uitgevoerd?');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-black text-[#191c1e] flex items-center gap-2">
          <Bike size={18} className="text-[#006b5a]" />
          Koerier-uurlonen
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 h-9 bg-[#f2f4f6] rounded-full text-xs font-display font-bold text-[#3d4945] hover:bg-[#e8eaec] transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Vernieuwen
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#3d4945]/60 font-bold py-4">Koeriers laden...</p>
      ) : couriers.length === 0 ? (
        <p className="text-sm text-[#3d4945]/60 font-bold py-4">
          Geen koeriers gevonden. (Vereist de RLS-policy uit migratie 007 zodat
          privileged rollen alle profielen mogen lezen.)
        </p>
      ) : (
        <div className="space-y-2">
          {couriers.map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 py-2 border-t border-[#f2f4f6]"
            >
              <span className="font-bold text-sm text-[#191c1e] min-w-0 truncate">{c.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {savedId === c.id && <Check size={14} className="text-emerald-600" />}
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  defaultValue={c.hourlyWage ?? 0}
                  onBlur={e => saveWage(c.id, e.target.value)}
                  className="w-24 h-8 px-2 text-sm bg-[#f2f4f6] rounded-lg font-bold text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/20"
                />
                <span className="text-xs text-[#3d4945]">€/uur</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourierWagePanel;
