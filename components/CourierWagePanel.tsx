import React, { useState, useEffect, useCallback } from 'react';
import { Bike, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import type { CourierProfile } from '../types';

// Beheer van koerier-uurlonen (input voor de financiële module).
// Leest/schrijft via service-role Netlify functions (couriers / update-wage)
// omdat RLS de directe client-query blokkeert.
const CourierWagePanel: React.FC = () => {
  const [couriers, setCouriers] = useState<CourierProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [savedId, setSavedId]   = useState<string | null>(null);

  // Token van de huidige Supabase-sessie (demo-accounts hebben er geen)
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = await getToken();
    if (!token) {
      setCouriers([]);
      setError('Geen actieve Supabase-sessie. Log in met een echt account (geen demo-account) om uurlonen te beheren.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/.netlify/functions/couriers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setCouriers([]);
        setError(res.status === 403
          ? 'Geen toegang: je account heeft geen privileged rol.'
          : d.error ?? `Laden mislukt (${res.status}).`);
        return;
      }
      const { couriers } = await res.json() as { couriers: any[] };
      setCouriers((couriers ?? []).map(c => ({
        id:            c.id,
        name:          c.name,
        hourlyWage:    c.hourlyWage ?? 0,
        wageStartDate: c.wageStartDate ?? undefined,
      })));
    } catch (err) {
      setError('Verbindingsfout bij het laden van koeriers.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const saveWage = async (courierId: string, raw: string) => {
    const wage = parseFloat(raw);
    if (Number.isNaN(wage) || wage < 0) return;
    const token = await getToken();
    if (!token) {
      setError('Geen actieve Supabase-sessie — opslaan niet mogelijk.');
      return;
    }
    try {
      const res = await fetch('/.netlify/functions/update-wage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courierId, hourlyWage: wage }),
      });
      if (!res.ok) {
        setError(`Uurloon opslaan mislukt (${res.status}).`);
        return;
      }
      setCouriers(prev => prev.map(c => c.id === courierId ? { ...c, hourlyWage: wage } : c));
      setSavedId(courierId);
      setTimeout(() => setSavedId(s => (s === courierId ? null : s)), 1500);
    } catch (err) {
      console.error('Uurloon opslaan mislukt:', err);
      setError('Verbindingsfout bij het opslaan.');
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

      {error && (
        <div className="flex items-start gap-2 text-xs font-bold text-amber-700 bg-amber-50 rounded-xl px-3 py-2 mb-3">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#3d4945]/60 font-bold py-4">Koeriers laden...</p>
      ) : couriers.length === 0 ? (
        !error && <p className="text-sm text-[#3d4945]/60 font-bold py-4">Geen koeriers gevonden.</p>
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
