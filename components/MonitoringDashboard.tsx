import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Activity, Package,
  TrendingUp, Zap, Map, Database, Euro,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { db } from '../services/supabaseService';

interface ServiceStatus {
  service: string;
  ok: boolean;
  code?: number | string;
  error?: string | null;
}

interface Health {
  timestamp: string;
  overall: 'healthy' | 'degraded';
  services: ServiceStatus[];
}

type Stats = Awaited<ReturnType<typeof db.fetchMonitorStats>>;

const MonitoringDashboard: React.FC = () => {
  const [health, setHealth]       = useState<Health | null>(null);
  const [stats, setStats]         = useState<Stats>(null);
  const [loading, setLoading]     = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    const [h, s] = await Promise.all([
      fetch('/.netlify/functions/health').then(r => r.json()).catch(() => null) as Promise<Health | null>,
      db.fetchMonitorStats(),
    ]);
    setHealth(h);
    setStats(s);
    setLastCheck(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [check]);

  const ServiceCard: React.FC<{
    service: string;
    label: string;
    icon: LucideIcon;
  }> = ({ service, label, icon: Icon }) => {
    const s = health?.services?.find(x => x.service === service);
    const ok = s?.ok ?? null;
    return (
      <div
        className={`bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(25,28,30,0.04)] border-2 transition-colors ${
          ok === null ? 'border-[#f2f4f6]' : ok ? 'border-[#48c2a9]/30' : 'border-red-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              ok === null ? 'bg-[#f2f4f6]' : ok ? 'bg-[#48c2a9]/15' : 'bg-red-50'
            }`}
          >
            <Icon
              size={18}
              className={
                ok === null ? 'text-[#3d4945]' : ok ? 'text-[#006b5a]' : 'text-red-500'
              }
            />
          </div>
          {ok === null ? (
            <div className="w-2.5 h-2.5 rounded-full bg-[#f2f4f6]" />
          ) : ok ? (
            <CheckCircle2 size={18} className="text-[#006b5a]" />
          ) : (
            <XCircle size={18} className="text-red-500" />
          )}
        </div>
        <p className="font-display font-black text-[#191c1e] text-sm">{label}</p>
        <p
          className={`text-xs font-bold mt-0.5 ${
            ok === null ? 'text-[#3d4945]' : ok ? 'text-[#006b5a]' : 'text-red-500'
          }`}
        >
          {ok === null ? 'Controleren...' : ok ? 'Operationeel' : s?.error ?? `Fout (${s?.code})`}
        </p>
      </div>
    );
  };

  const StatCard: React.FC<{
    value: React.ReactNode;
    label: string;
    icon: LucideIcon;
    warning?: string | null;
  }> = ({ value, label, icon: Icon, warning }) => (
    <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
      <div className="flex items-center justify-between mb-2">
        <Icon size={16} className="text-[#48c2a9]" />
        {warning && <AlertTriangle size={14} className="text-amber-500" />}
      </div>
      <p className="font-display font-black text-2xl text-[#191c1e]">
        {value ?? '—'}
      </p>
      <p className="text-xs text-[#3d4945] font-bold uppercase tracking-wider mt-1">
        {label}
      </p>
      {warning && <p className="text-xs text-amber-600 font-bold mt-1">{warning}</p>}
    </div>
  );

  const geminiWeek = parseFloat(stats?.kostenGeminiWeek ?? '0');
  const mapsWeek   = parseFloat(stats?.kostenMapsWeek ?? '0');

  return (
    <div className="p-6 max-w-4xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-black text-2xl text-[#191c1e]">
            Systeem Monitor
          </h2>
          <p className="text-sm text-[#3d4945] mt-0.5">
            {lastCheck
              ? `Laatste check: ${lastCheck.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
              : 'Bezig met controleren...'}
          </p>
        </div>
        <button
          onClick={check}
          disabled={loading}
          className="flex items-center gap-2 px-4 h-10 bg-[#f2f4f6] rounded-full text-sm font-display font-bold text-[#3d4945] hover:bg-[#e8eaec] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Vernieuwen
        </button>
      </div>

      {/* Algehele status banner */}
      {health && (
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 ${
            health.overall === 'healthy'
              ? 'bg-[#48c2a9]/10 border border-[#48c2a9]/20'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {health.overall === 'healthy' ? (
            <CheckCircle2 size={20} className="text-[#006b5a]" />
          ) : (
            <AlertTriangle size={20} className="text-red-500" />
          )}
          <div>
            <p
              className={`font-display font-black text-sm ${
                health.overall === 'healthy' ? 'text-[#006b5a]' : 'text-red-700'
              }`}
            >
              {health.overall === 'healthy'
                ? 'Alle systemen operationeel'
                : 'Let op: één of meer services hebben een probleem'}
            </p>
            <p className="text-xs text-[#3d4945] mt-0.5">
              {new Date(health.timestamp).toLocaleString('nl-NL')}
            </p>
          </div>
        </div>
      )}

      {/* API Status */}
      <div>
        <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-wider mb-3">
          API Services
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ServiceCard service="gemini"          label="Gemini AI"      icon={Zap} />
          <ServiceCard service="maps_geocoding"  label="Maps Geocoding" icon={Map} />
          <ServiceCard service="maps_directions" label="Maps Routing"   icon={Activity} />
          <ServiceCard service="supabase"        label="Database"       icon={Database} />
        </div>
      </div>

      {/* Gebruik statistieken */}
      <div>
        <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-wider mb-3">
          Gebruik
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard
            value={stats?.scansVandaag}
            label="Scans vandaag"
            icon={Package}
            warning={(stats?.scansVandaag ?? 0) > 1200 ? '⚠️ Nadert quota (1.500/dag)' : null}
          />
          <StatCard value={stats?.scansDezWeek}   label="Scans deze week"   icon={TrendingUp} />
          <StatCard value={stats?.scansDezeMaand} label="Scans deze maand"  icon={TrendingUp} />
          <StatCard value={stats?.openPakketten}  label="Open pakketten"    icon={Package} />
          <StatCard value={stats?.bezorgd}        label="Bezorgd totaal"    icon={CheckCircle2} />
          <StatCard
            value={stats ? `${stats.bezorgPercentage}%` : undefined}
            label="Bezorgpercentage"
            icon={Activity}
          />
        </div>
      </div>

      {/* Kosten */}
      <div>
        <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-wider mb-3">
          Kostenschatting deze week
        </h3>
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_12px_rgba(25,28,30,0.04)]">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#48c2a9]/15 flex items-center justify-center">
              <Euro size={18} className="text-[#006b5a]" />
            </div>
            <div>
              <p className="font-display font-black text-[#191c1e]">
                Totaal: ~€{(geminiWeek + mapsWeek).toFixed(2)} deze week
              </p>
              <p className="text-xs text-[#3d4945] mt-0.5">
                Schatting op basis van API-gebruik
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-[#f2f4f6] pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#3d4945]">Gemini AI (OCR scans)</span>
              <span className="font-bold text-[#191c1e]">
                ~€{stats?.kostenGeminiWeek ?? '0.00'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#3d4945]">Google Maps (geocoding + routes)</span>
              <span className="font-bold text-[#191c1e]">
                ~€{stats?.kostenMapsWeek ?? '0.00'}
              </span>
            </div>
          </div>
          <p className="text-xs text-amber-600 font-bold mt-2">
            ⚠️ Dit is een schatting. Controleer de werkelijke kosten in Google Cloud Console en Google AI Studio.
          </p>
          <a
            href="https://console.cloud.google.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#006b5a] underline mt-1 inline-block"
          >
            Bekijk werkelijke kosten →
          </a>
        </div>
      </div>

    </div>
  );
};

export default MonitoringDashboard;
