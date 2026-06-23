import React, { useState, useCallback } from 'react';
import {
  MapPin, Camera, Wifi, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronRight,
} from 'lucide-react';

type CheckState = 'idle' | 'checking' | 'ok' | 'warn' | 'fail';

interface CheckRow {
  key:     'location' | 'camera' | 'internet' | 'secure';
  label:   string;
  icon:    React.ComponentType<{ size?: number; className?: string }>;
  state:   CheckState;
  message?: string;
  fix?:    string[];   // herstelstappen
  gate?:   boolean;    // blokkeert starten als deze faalt
}

interface DienstCheckProps {
  courierName?: string;
  onReady: () => void;
}

const isIOS       = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isChromeIOS = typeof navigator !== 'undefined' && /CriOS/.test(navigator.userAgent);

const locationFix = (): string[] => {
  if (isIOS) {
    const browserStap = isChromeIOS
      ? "Ga naar Instellingen → Chrome → Locatie en kies 'Bij gebruik van de app'."
      : "Ga naar Instellingen → Safari → Locatie en kies 'Vraag' of 'Sta toe'.";
    return [
      'Open de Instellingen van je iPhone.',
      'Privacy en beveiliging → Locatievoorzieningen → zet deze AAN.',
      browserStap,
      'Kom terug en tik op "Opnieuw controleren".',
    ];
  }
  return [
    'Tik op het slotje in de adresbalk.',
    'Zet Locatie op "Toestaan".',
    'Tik op "Opnieuw controleren".',
  ];
};

const cameraFix = (): string[] => {
  if (isIOS) {
    return isChromeIOS
      ? ['Instellingen → Chrome → Camera → zet AAN.', 'Kom terug en tik op "Opnieuw controleren".']
      : ['Instellingen → Safari → Camera → "Sta toe".', 'Kom terug en tik op "Opnieuw controleren".'];
  }
  return ['Tik op het slotje in de adresbalk.', 'Zet Camera op "Toestaan".', 'Tik op "Opnieuw controleren".'];
};

// Locatie MOET actief getest worden: op iOS rapporteert de permissie-API onbetrouwbaar.
const probeLocation = (): Promise<{ state: CheckState; message?: string; fix?: string[] }> =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ state: 'fail', message: 'Dit apparaat ondersteunt geen locatie.', fix: locationFix() });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ state: 'ok', message: 'Locatie werkt.' }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ state: 'fail', message: 'Locatie is geblokkeerd. Zonder locatie kun je geen pakketten afleveren of een route maken.', fix: locationFix() });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          resolve({ state: 'fail', message: 'Locatievoorzieningen staan uit op je telefoon.', fix: locationFix() });
        } else {
          resolve({ state: 'fail', message: 'Locatie duurt te lang. Ga even naar buiten en probeer opnieuw.', fix: ['Tik op "Opnieuw controleren".'] });
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  });

// Camera-permissie is op iOS wél betrouwbaar uit te lezen; geen actieve camera-start nodig.
const probeCamera = async (): Promise<{ state: CheckState; message?: string; fix?: string[] }> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { state: 'warn', message: 'Camera wordt gevraagd zodra je gaat scannen.' };
  }
  try {
    const res = await (navigator as any).permissions?.query?.({ name: 'camera' as PermissionName });
    if (res?.state === 'granted') return { state: 'ok', message: 'Camera werkt.' };
    if (res?.state === 'denied')  return { state: 'fail', message: 'Camera is geblokkeerd. Scannen lukt dan niet.', fix: cameraFix() };
    return { state: 'warn', message: 'Camera wordt gevraagd zodra je gaat scannen.' };
  } catch {
    return { state: 'warn', message: 'Camera wordt gevraagd zodra je gaat scannen.' };
  }
};

export default function DienstCheck({ courierName, onReady }: DienstCheckProps) {
  const [rows, setRows]       = useState<CheckRow[]>([]);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setStarted(true);
    setRows([
      { key: 'location', label: 'Locatie',    icon: MapPin,      state: 'checking', gate: true },
      { key: 'camera',   label: 'Camera',     icon: Camera,      state: 'checking' },
      { key: 'internet', label: 'Internet',   icon: Wifi,        state: 'checking' },
      { key: 'secure',   label: 'Verbinding', icon: ShieldCheck, state: 'checking' },
    ]);

    const internetOk = typeof navigator === 'undefined' ? true : navigator.onLine;
    const secureOk   = typeof window === 'undefined' ? true : window.isSecureContext;
    const [loc, cam] = await Promise.all([probeLocation(), probeCamera()]);

    setRows([
      { key: 'location', label: 'Locatie', icon: MapPin, gate: true, state: loc.state, message: loc.message, fix: loc.fix },
      { key: 'camera',   label: 'Camera',  icon: Camera, state: cam.state, message: cam.message, fix: cam.fix },
      { key: 'internet', label: 'Internet', icon: Wifi,
        state: internetOk ? 'ok' : 'fail',
        message: internetOk ? 'Verbonden.' : 'Geen internetverbinding.',
        fix: internetOk ? undefined : ['Controleer wifi of mobiele data.', 'Tik op "Opnieuw controleren".'] },
      { key: 'secure', label: 'Verbinding', icon: ShieldCheck,
        state: secureOk ? 'ok' : 'fail',
        message: secureOk ? 'Beveiligd.' : 'Onveilige verbinding — open de app via https.' },
    ]);
    setRunning(false);
  }, []);

  const locationOk = rows.find(r => r.key === 'location')?.state === 'ok';

  // Intro vóór de eerste tik: de tik is nodig zodat de iOS-toestemmingsvraag betrouwbaar verschijnt.
  if (!started) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl border border-[#e6ebe9] p-6 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#48c2a9]/15 flex items-center justify-center mx-auto mb-4">
            <MapPin className="text-[#006b5a]" size={26} />
          </div>
          <h2 className="font-display font-black text-xl text-[#1f2a26] mb-1">
            {courierName ? `Hoi ${courierName}!` : 'Klaar om te starten?'}
          </h2>
          <p className="text-sm text-[#3d4945]/70 mb-6">
            We controleren even of je telefoon klaar is voor je dienst — vooral locatie en camera.
            Dit duurt een paar seconden.
          </p>
          <button
            onClick={run}
            className="w-full py-3.5 rounded-2xl bg-[#006b5a] text-white font-display font-black tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            Controleer &amp; start <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl border border-[#e6ebe9] p-5 shadow-sm">
        <h2 className="font-display font-black text-lg text-[#1f2a26] mb-4 px-1">Dienst-check</h2>

        <div className="space-y-2.5">
          {rows.map((r) => {
            const Icon = r.icon;
            const tone =
              r.state === 'ok'   ? { bg: 'bg-[#48c2a9]/10', ic: 'text-[#006b5a]',    Status: CheckCircle2,  sc: 'text-[#006b5a]' } :
              r.state === 'warn' ? { bg: 'bg-amber-50',     ic: 'text-amber-600',    Status: AlertTriangle, sc: 'text-amber-600' } :
              r.state === 'fail' ? { bg: 'bg-red-50',       ic: 'text-red-500',      Status: XCircle,       sc: 'text-red-500' } :
                                   { bg: 'bg-[#f2f4f6]',    ic: 'text-[#3d4945]/50', Status: Loader2,       sc: 'text-[#3d4945]/40' };
            const Status = tone.Status;
            return (
              <div key={r.key} className={`rounded-2xl ${tone.bg} p-3`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
                    <Icon size={18} className={tone.ic} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-black text-sm text-[#1f2a26]">{r.label}</span>
                      {r.gate && <span className="text-[9px] font-black uppercase tracking-widest text-[#3d4945]/40">verplicht</span>}
                    </div>
                    {r.message && <p className="text-xs text-[#3d4945]/70 leading-snug mt-0.5">{r.message}</p>}
                  </div>
                  <Status size={20} className={`${tone.sc} shrink-0 ${r.state === 'checking' ? 'animate-spin' : ''}`} />
                </div>

                {r.fix && r.fix.length > 0 && (
                  <ol className="mt-2.5 ml-12 list-decimal space-y-1 text-xs text-[#3d4945]/80 marker:text-[#3d4945]/40">
                    {r.fix.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onReady}
            disabled={!locationOk}
            className={`w-full py-3.5 rounded-2xl font-display font-black tracking-wide flex items-center justify-center gap-2 transition active:scale-[0.98]
              ${locationOk ? 'bg-[#006b5a] text-white' : 'bg-[#f2f4f6] text-[#3d4945]/40 cursor-not-allowed'}`}
          >
            Start mijn dienst <ChevronRight size={18} />
          </button>
          <button
            onClick={run}
            disabled={running}
            className="w-full py-3 rounded-2xl border border-[#e6ebe9] text-[#3d4945] font-display font-black tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
          >
            <RefreshCw size={16} className={running ? 'animate-spin' : ''} /> Opnieuw controleren
          </button>
          {!locationOk && !running && (
            <p className="text-[11px] text-center text-[#3d4945]/50 px-3">
              Locatie moet groen zijn voordat je kunt starten — zonder locatie kun je geen route maken of pakketten afleveren.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
