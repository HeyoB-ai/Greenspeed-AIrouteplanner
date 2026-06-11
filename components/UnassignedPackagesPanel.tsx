import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Check, ChevronDown } from 'lucide-react';
import { Pharmacy } from '../types';
import { supabase } from '../services/supabaseService';

interface Addr { street?: string; houseNumber?: string; postalCode?: string; city?: string; }
interface UnassignedPkg { id: string; pharmacyName?: string; courierName?: string; createdAt: string; address?: Addr; }
interface Props { pharmacies: Pharmacy[]; }

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const fmtAddr = (a?: Addr) => {
  if (!a) return 'Geen adres';
  const line1 = [a.street, a.houseNumber].filter(Boolean).join(' ');
  const line2 = [a.postalCode, a.city].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ') || 'Geen adres';
};
const fmtDate = (s: string) => {
  try { return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); } catch { return ''; }
};

const UnassignedPackagesPanel: React.FC<Props> = ({ pharmacies }) => {
  const [pkgs, setPkgs] = useState<UnassignedPkg[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [target, setTarget] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/unassigned-packages', { headers: { ...(await authHeader()) } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setPkgs(data.packages ?? []);
    } catch {
      setError('Kon niet-toegewezen pakketten niet laden.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const m = new Map<string, UnassignedPkg[]>();
    pkgs.forEach(p => {
      const key = (p.pharmacyName || 'Onbekend').trim() || 'Onbekend';
      m.set(key, [...(m.get(key) ?? []), p]);
    });
    return [...m.entries()];
  }, [pkgs]);

  const assign = async (label: string, ids: string[]) => {
    const pharmacyId = target[label];
    if (!pharmacyId) return;
    const pharmacy = pharmacies.find(p => p.id === pharmacyId);
    setBusy(label); setError('');
    try {
      const res = await fetch('/.netlify/functions/unassigned-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ action: 'assign', packageIds: ids, pharmacyId, pharmacyName: pharmacy?.name ?? '' }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `status ${res.status}`); }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Toewijzen mislukt');
    } finally { setBusy(''); }
  };

  if (!loading && pkgs.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 mb-6">
      <h3 className="text-sm font-black text-amber-900 mb-1">Niet-toegewezen pakketten</h3>
      <p className="text-xs font-bold text-amber-700 mb-4">Deze pakketten zijn gescand met een label dat bij geen bekende apotheek hoorde. Klap een groep uit om de adressen te zien, en koppel ze aan de juiste apotheek.</p>
      {error && <p className="text-sm font-bold text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-sm font-bold text-amber-700">Laden…</p>}
      <div className="space-y-3">
        {groups.map(([label, items]) => {
          const isOpen = open[label];
          return (
            <div key={label} className="bg-white rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setOpen(o => ({ ...o, [label]: !o[label] }))}
                  className="min-w-0 flex-1 flex items-center gap-2 text-left">
                  <ChevronDown size={16} className={`text-[#3d4945]/50 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  <span className="min-w-0">
                    <span className="block font-bold text-[#191c1e] truncate">{label}</span>
                    <span className="block text-xs text-[#3d4945]/70">{items.length} pakket{items.length === 1 ? '' : 'ten'} · bekijk details</span>
                  </span>
                </button>
                <select
                  value={target[label] ?? ''}
                  onChange={e => setTarget(t => ({ ...t, [label]: e.target.value }))}
                  className="h-9 px-3 rounded-lg bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none">
                  <option value="">— Kies apotheek —</option>
                  {pharmacies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                  onClick={() => assign(label, items.map(i => i.id))}
                  disabled={!target[label] || busy === label}
                  className="h-9 px-4 rounded-full bg-[#006b5a] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                  {busy === label ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Toewijzen
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-[#f2f4f6] divide-y divide-[#f2f4f6]">
                  {items.map(p => (
                    <div key={p.id} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#191c1e] min-w-0 truncate">{fmtAddr(p.address)}</span>
                      <span className="text-[#3d4945]/60 shrink-0">{p.courierName ?? '—'} · {fmtDate(p.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnassignedPackagesPanel;
