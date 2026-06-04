import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Euro, RefreshCw, TrendingUp } from 'lucide-react';
import { db } from '../services/supabaseService';
import type { PharmacyFinancials } from '../types';

type Period = 'today' | 'week' | 'month';

const eur = (n: number) => `€${n.toFixed(2)}`;

const FinancialDashboard: React.FC = () => {
  const [period, setPeriod]   = useState<Period>('week');
  const [data, setData]       = useState<PharmacyFinancials[]>([]);
  const [loading, setLoading] = useState(true);

  // Bereken [dateFrom, dateTo] op basis van de gekozen periode
  const getPeriod = useCallback((): [string, string] => {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];
    if (period === 'today') return [today, today];
    if (period === 'week') {
      const mon = new Date(now);
      mon.setDate(now.getDate() - now.getDay() + 1); // maandag van deze week
      return [mon.toISOString().split('T')[0], today];
    }
    return [`${today.slice(0, 7)}-01`, today]; // eerste van de maand
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const [from, to] = getPeriod();
    const result = await db.fetchFinancials(from, to);
    setData(result);
    setLoading(false);
  }, [getPeriod]);

  useEffect(() => { load(); }, [load]);

  // Totalen over alle apotheken
  const totals = data.reduce(
    (acc, p) => ({
      revenue:   acc.revenue   + p.revenue,
      laborCost: acc.laborCost + p.laborCost,
      profit:    acc.profit    + p.grossProfit,
    }),
    { revenue: 0, laborCost: 0, profit: 0 },
  );
  const avgMargin = totals.revenue > 0
    ? Math.round((totals.profit / totals.revenue) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* Header + periode tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 h-9 rounded-full text-sm font-display font-bold transition-all ${
                period === p
                  ? 'bg-[#253046] text-white'
                  : 'bg-[#f2f4f6] text-[#3d4945] hover:bg-[#e8eaec]'
              }`}
            >
              {p === 'today' ? 'Vandaag' : p === 'week' ? 'Deze week' : 'Deze maand'}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 h-9 bg-[#f2f4f6] rounded-full text-sm font-display font-bold text-[#3d4945] hover:bg-[#e8eaec] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Vernieuwen
        </button>
      </div>

      {/* Totaal-kaartjes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <Euro size={16} className="text-[#48c2a9]" />
            <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider">Totale omzet</p>
          </div>
          <p className="font-display font-black text-2xl text-[#006b5a]">{eur(totals.revenue)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <Euro size={16} className="text-[#3d4945]" />
            <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider">Loonkosten</p>
          </div>
          <p className="font-display font-black text-2xl text-[#191c1e]">{eur(totals.laborCost)}</p>
        </div>
        <div className={`rounded-2xl p-4 shadow-[0_2px_12px_rgba(25,28,30,0.04)] ${totals.profit >= 0 ? 'bg-[#48c2a9]/10' : 'bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className={totals.profit >= 0 ? 'text-[#006b5a]' : 'text-red-500'} />
            <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider">Brutowinst</p>
          </div>
          <p className={`font-display font-black text-2xl ${totals.profit >= 0 ? 'text-[#006b5a]' : 'text-red-600'}`}>{eur(totals.profit)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-[#48c2a9]" />
            <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider">Gem. marge</p>
          </div>
          <p className="font-display font-black text-2xl text-[#191c1e]">{avgMargin}%</p>
        </div>
      </div>

      {/* Lege staat / laden */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
          <RefreshCw size={24} className="mx-auto mb-3 text-[#3d4945]/30 animate-spin" />
          <p className="text-sm text-[#3d4945]/60 font-bold">Financiën berekenen...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
          <Euro size={24} className="mx-auto mb-3 text-[#3d4945]/30" />
          <p className="text-sm text-[#3d4945]/60 font-bold">Geen bezorgde pakketten in deze periode.</p>
          <p className="text-xs text-[#3d4945]/40 mt-1">Stel uurtarieven en uurlonen in om omzet en kosten te zien.</p>
        </div>
      ) : (
        /* Per apotheek */
        data.map(pharmacy => (
          <div
            key={pharmacy.pharmacyId}
            className="bg-white rounded-2xl p-5 shadow-[0_4px_24px_rgba(25,28,30,0.04)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-display font-black text-lg text-[#191c1e]">{pharmacy.pharmacyName}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#3d4945]">
                  €{pharmacy.hourlyRate}/u · {pharmacy.hoursWorked}u
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-black ${
                  pharmacy.profitMargin >= 20
                    ? 'bg-[#48c2a9]/15 text-[#006b5a]'
                    : pharmacy.profitMargin >= 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {pharmacy.profitMargin}% marge
                </span>
              </div>
            </div>

            {/* KPI rij */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#f2f4f6] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider mb-1">Omzet</p>
                <p className="font-black text-xl text-[#006b5a]">{eur(pharmacy.revenue)}</p>
              </div>
              <div className="bg-[#f2f4f6] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider mb-1">Loonkosten</p>
                <p className="font-black text-xl text-[#191c1e]">{eur(pharmacy.laborCost)}</p>
              </div>
              <div className={`rounded-xl p-3 ${pharmacy.grossProfit >= 0 ? 'bg-[#48c2a9]/10' : 'bg-red-50'}`}>
                <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-wider mb-1">Winst</p>
                <p className={`font-black text-xl ${pharmacy.grossProfit >= 0 ? 'text-[#006b5a]' : 'text-red-600'}`}>
                  {eur(pharmacy.grossProfit)}
                </p>
              </div>
            </div>

            {/* Per pakket */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm border-t border-[#f2f4f6] pt-3 mb-3">
              <span className="text-[#3d4945]">{pharmacy.packagesDelivered} pakketten</span>
              <span className="text-[#3d4945]">·</span>
              <span className="text-[#3d4945]">{eur(pharmacy.revenuePerPackage)} opbrengst/stuk</span>
              <span className="text-[#3d4945]">·</span>
              <span className={pharmacy.profitPerPackage >= 0 ? 'text-[#006b5a] font-bold' : 'text-red-600 font-bold'}>
                {eur(pharmacy.profitPerPackage)} winst/stuk
              </span>
            </div>

            {/* Koeriers uitklappen */}
            <details>
              <summary className="text-xs font-bold text-[#3d4945] cursor-pointer list-none flex items-center gap-1 hover:text-[#006b5a]">
                <ChevronDown size={12} />
                Koeriers ({pharmacy.couriers.length})
              </summary>
              <div className="mt-2 space-y-1.5">
                {pharmacy.couriers.map((c, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-xs py-1.5 border-t border-[#f2f4f6] gap-2"
                  >
                    <span className="font-bold text-[#191c1e]">{c.name}</span>
                    <span className="text-[#3d4945] text-right">
                      {c.packages} pkgs · {c.hours.toFixed(1)}u × €{c.wage}/u ={' '}
                      <strong className="text-[#191c1e]">{eur(c.cost)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        ))
      )}
    </div>
  );
};

export default FinancialDashboard;
