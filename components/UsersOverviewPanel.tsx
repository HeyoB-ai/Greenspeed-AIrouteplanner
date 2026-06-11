import React, { useEffect, useState, useCallback } from 'react';
import { Users, RefreshCw, Bike } from 'lucide-react';
import { supabase } from '../services/supabaseService';

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const eur = (n: number) => '€ ' + (n ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PerPharmacy { pharmacyName: string; hours: number; packages: number; revenue: number; cost: number; margin: number; }
interface Pnl {
  employmentType: string; hourlyWage: number; trueHourlyCost: number;
  pharmacies: string[]; hours: number; packages: number;
  revenue: number; cost: number; margin: number; marginPct: number;
  perPharmacy: PerPharmacy[];
}
interface UserRow { id: string; name: string; role: string; pnl: Pnl | null; }

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const UsersOverviewPanel: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/.netlify/functions/users-overview?month=${month}&year=${year}`, {
        headers: { ...(await authHeader()) },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setError('Kon gegevens niet laden. Log in met een echt account (geen demo).');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  const couriers = users.filter(u => u.role === 'courier');
  const others   = users.filter(u => u.role !== 'courier');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#191c1e]">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#191c1e]">
          {[0, 1, 2].map(d => now.getFullYear() - d).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="h-10 px-4 rounded-xl bg-[#006b5a] text-white text-sm font-bold flex items-center gap-2">
          <RefreshCw size={15} /> Vernieuwen
        </button>
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {loading && <p className="text-sm font-bold text-[#3d4945]/60">Laden…</p>}

      <div>
        <h3 className="text-sm font-black text-[#191c1e] mb-3 flex items-center gap-2"><Bike size={16} className="text-[#006b5a]" /> Koeriers</h3>
        <div className="space-y-3">
          {couriers.map(u => {
            const p = u.pnl!;
            const pos = p.margin >= 0;
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-[#f2f4f6] overflow-hidden">
                <button onClick={() => setOpen(open === u.id ? null : u.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div>
                    <div className="font-bold text-[#191c1e]">{u.name}</div>
                    <div className="text-xs text-[#3d4945]/70">
                      {p.employmentType} · {eur(p.hourlyWage)}/uur · {p.pharmacies.join(', ') || 'geen apotheken'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-black ${pos ? 'text-[#006b5a]' : 'text-red-600'}`}>{eur(p.margin)}</div>
                    <div className="text-xs text-[#3d4945]/60">marge ({p.marginPct}%)</div>
                  </div>
                </button>
                {open === u.id && (
                  <div className="px-4 pb-4 border-t border-[#f2f4f6] pt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-xs text-[#3d4945]/60">Opbrengst</div><div className="font-bold text-[#191c1e]">{eur(p.revenue)}</div></div>
                      <div><div className="text-xs text-[#3d4945]/60">Kosten</div><div className="font-bold text-[#191c1e]">{eur(p.cost)}</div></div>
                      <div><div className="text-xs text-[#3d4945]/60">Uren · pakketten</div><div className="font-bold text-[#191c1e]">{p.hours} · {p.packages}</div></div>
                    </div>
                    <div className="text-xs text-[#3d4945]/60">Kostprijs/uur: {eur(p.trueHourlyCost)} ({p.employmentType === 'zzp' ? 'zzp, rauw tarief' : 'loondienst, incl. 40% werkgeverslasten'})</div>
                    {p.perPharmacy.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-[#3d4945]/70">Per apotheek</div>
                        {p.perPharmacy.map((pp, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#f2f4f6] last:border-0">
                            <span className="text-[#191c1e] flex-1">{pp.pharmacyName}</span>
                            <span className="text-[#3d4945]/70 w-24 text-right">{pp.hours}u · {pp.packages}p</span>
                            <span className={`w-24 text-right font-bold ${pp.margin >= 0 ? 'text-[#006b5a]' : 'text-red-600'}`}>{eur(pp.margin)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {couriers.length === 0 && !loading && <p className="text-sm text-[#3d4945]/60">Geen koeriers gevonden.</p>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-black text-[#191c1e] mb-3 flex items-center gap-2"><Users size={16} className="text-[#006b5a]" /> Overige gebruikers</h3>
        <div className="space-y-2">
          {others.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-white rounded-xl border border-[#f2f4f6] px-4 py-2.5">
              <span className="font-bold text-[#191c1e]">{u.name}</span>
              <span className="text-xs font-bold text-[#3d4945]/70 uppercase">{u.role}</span>
            </div>
          ))}
          {others.length === 0 && !loading && <p className="text-sm text-[#3d4945]/60">Geen overige gebruikers.</p>}
        </div>
      </div>
    </div>
  );
};

export default UsersOverviewPanel;
