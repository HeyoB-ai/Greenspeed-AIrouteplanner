import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Check, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { extractAddressFromImage } from './services/geminiService';
import { Address } from './types';

interface ScannerProps {
  onScanComplete: (address: Address) => void;
  onCancel: () => void;
}

// Één gedeelde AudioContext — iOS Safari crasht bij meerdere instanties
const audioCtx = (() => {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
})();

const playSound = (type: 'success' | 'error') => {
  try {
    if (!audioCtx) return;
    // iOS Safari: AudioContext start altijd 'suspended' — resume() eerst
    audioCtx.resume().then(() => {
      const gain = audioCtx.createGain();
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      if (type === 'success') {
        [880, 1100].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          osc.connect(gain);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          osc.start(audioCtx.currentTime + i * 0.16);
          osc.stop(audioCtx.currentTime + i * 0.16 + 0.14);
        });
      } else {
        const osc = audioCtx.createOscillator();
        osc.connect(gain);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
      }
    });
  } catch {
    // AudioContext niet beschikbaar — scan gaat gewoon door
  }
};

type ScanStatus = 'pending' | 'ok' | 'err';

interface ScanEntry {
  id: number;
  status: ScanStatus;
  errorMsg?: string;
}

interface QueueItem {
  id: number;
  base64: string;
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Per-scan state voor de UI
  const [scans, setScans] = useState<ScanEntry[]>([]);
  // Camera geblokkeerd voor ~400ms na elke foto (voorkomt dubbele taps)
  const [cameraLocked, setCameraLocked] = useState(false);
  // iOS Safari heeft ~300ms nodig na getUserMedia voor de camera warm is
  const [cameraReady, setCameraReady] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Refs die geen re-render veroorzaken
  const idCounterRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  // Stabiele ref naar onScanComplete om stale-closure issues te voorkomen
  const onScanCompleteRef = useRef(onScanComplete);
  useEffect(() => { onScanCompleteRef.current = onScanComplete; }, [onScanComplete]);

  // Camera setup
  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error('Video play failed:', e));
          // iOS Safari: geef camera 300ms om te initialiseren voor eerste capture
          setTimeout(() => setCameraReady(true), 300);
        }
      } catch {
        setCameraError('Kan de camera niet starten. Controleer je rechten.');
      }
    }
    setupCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  /**
   * Verwerkt de queue één item tegelijk.
   * onScanComplete wordt nooit parallel aangeroepen —
   * App.tsx's setPackages is dus altijd safe.
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!;
        try {
          const result = await extractAddressFromImage(item.base64);
          if (result?.street && result.houseNumber) {
            playSound('success');
            setScans(prev => prev.map(s => s.id === item.id ? { ...s, status: 'ok' } : s));
            onScanCompleteRef.current(result);
          } else {
            playSound('error');
            setScans(prev => prev.map(s => s.id === item.id ? { ...s, status: 'err', errorMsg: 'Adres niet herkend' } : s));
          }
        } catch (err: any) {
          const msg = err?.message || String(err);
          console.error('[processQueue] extractAddressFromImage error:', msg);
          playSound('error');
          setScans(prev => prev.map(s => s.id === item.id ? { ...s, status: 'err', errorMsg: msg } : s));
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, []); // lege deps: gebruikt alleen refs en stable setState

  /**
   * Maakt een foto en zet die in de queue.
   * Camera is na ~400ms direct weer beschikbaar.
   */
  const capture = useCallback(() => {
    if (!cameraReady || cameraLocked || cameraError) return;
    if (!videoRef.current || !canvasRef.current) return;

    // Flash-effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);

    // Camera kort blokkeren (voorkomt dubbele tap, niet de AI-wachttijd)
    setCameraLocked(true);
    setTimeout(() => setCameraLocked(false), 400);

    // Foto vastleggen
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCameraLocked(false); return; }

    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('Camera not ready — probeer opnieuw.');
      setCameraLocked(false);
      return;
    }

    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // iOS debug — zichtbaar in Safari console via Develop menu
    console.log('iOS debug:', video.videoWidth, video.videoHeight, base64?.length);

    if (!base64 || base64.length < 1000) {
      setCameraError('Camera niet gereed, probeer opnieuw');
      setCameraLocked(false);
      return;
    }

    // Voeg toe aan state en queue
    const id = ++idCounterRef.current;
    setScans(prev => [...prev, { id, status: 'pending' }]);
    queueRef.current.push({ id, base64 });
    processQueue();
  }, [cameraReady, cameraLocked, cameraError, processQueue]);

  // Afgeleide telwaarden
  const successCount = scans.filter(s => s.status === 'ok').length;
  const pendingCount = scans.filter(s => s.status === 'pending').length;
  const totalCount = scans.length;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">

      {/* Camera feed */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Flash overlay */}
        {showFlash && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

        {/* Burst Mode badge */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-blue-600/90 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter flex items-center space-x-2 shadow-lg">
            <Zap size={10} fill="currentColor" />
            <span>Burst Mode — scan meerdere pakketten achter elkaar</span>
          </span>
        </div>

        {/* Scan status dots — bovenaan gecentreerd, onder de badge */}
        {totalCount > 0 && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 flex flex-wrap gap-1.5 justify-center max-w-[70vw] z-10">
            {scans.map(s => (
              <div
                key={s.id}
                title={s.status === 'ok' ? 'Herkend' : s.status === 'err' ? (s.errorMsg || 'Mislukt') : 'Bezig...'}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  s.status === 'ok'      ? 'bg-emerald-400 scale-110' :
                  s.status === 'err'     ? 'bg-red-400' :
                  /* pending */            'bg-blue-400 animate-pulse'
                }`}
              />
            ))}
          </div>
        )}

        {/* Foutmelding — zichtbaar op iPhone zonder Mac/console */}
        {scans.some(s => s.status === 'err') && (
          <div className="absolute top-28 left-4 right-4 z-20 bg-black/80 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Scanfout</p>
            <p className="text-[11px] font-mono text-white/90 break-all leading-snug">
              {scans.filter(s => s.status === 'err').slice(-1)[0]?.errorMsg || 'Mislukt'}
            </p>
          </div>
        )}

        {/* Succesbadge rechtsboven */}
        {successCount > 0 && (
          <div className="absolute top-14 right-5 z-10 animate-in zoom-in duration-300">
            <div className="bg-emerald-600 text-white w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-white/20">
              <span className="text-xl font-black leading-none">{successCount}</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter">OK</span>
            </div>
          </div>
        )}

        {/* Scan frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className={`w-full max-w-md aspect-[4/3] border-2 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.65)] transition-colors duration-300 ${
            cameraLocked ? 'border-blue-400' : 'border-white/20'
          }`}>
            {/* Hoekdecoraties */}
            {(['tl','tr','bl','br'] as const).map(corner => (
              <div key={corner} className={`absolute w-8 h-8 transition-colors ${
                corner === 'tl' ? '-top-1 -left-1 border-t-4 border-l-4 rounded-tl-xl' :
                corner === 'tr' ? '-top-1 -right-1 border-t-4 border-r-4 rounded-tr-xl' :
                corner === 'bl' ? '-bottom-1 -left-1 border-b-4 border-l-4 rounded-bl-xl' :
                                  '-bottom-1 -right-1 border-b-4 border-r-4 rounded-br-xl'
              } ${cameraLocked ? 'border-blue-400' : 'border-blue-500'}`} />
            ))}

            {/* Scan-line animatie alleen wanneer camera vrij is */}
            {!cameraLocked && <div className="scan-line" />}

            <div className="absolute inset-0 flex items-center justify-center">
              {!cameraLocked && (
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                  Plaats label in dit kader
                </p>
              )}
              {cameraLocked && (
                <RefreshCw className="animate-spin text-blue-400" size={32} />
              )}
            </div>
          </div>
        </div>

        {/* Camerafout */}
        {cameraError && (
          <div className="absolute bottom-4 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-2xl z-30 animate-in slide-in-from-bottom duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-black">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-8 pt-8 pb-20 bg-slate-950 flex justify-between items-center border-t border-white/5">

        {/* Annuleer */}
        <button
          onClick={onCancel}
          className="w-14 h-14 bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/5"
        >
          <X size={24} />
        </button>

        {/* Capture knop */}
        <button
          onClick={capture}
          disabled={!cameraReady || cameraLocked || !!cameraError}
          className="relative group outline-none"
          aria-label="Scan pakket"
        >
          <div className={`absolute inset-[-12px] rounded-full blur-2xl transition-all duration-300 ${
            cameraLocked ? 'bg-blue-600/40' : 'bg-blue-600/20 group-active:scale-150'
          }`} />
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10 border-[10px] border-slate-950 ${
            cameraLocked ? 'bg-slate-300 text-slate-500' : 'bg-white text-slate-900 active:scale-90'
          }`}>
            {cameraLocked ? <RefreshCw className="animate-spin" size={40} /> : <Camera size={40} />}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">
            {!cameraReady ? 'Camera starten...' : cameraLocked ? 'Even wachten...' : 'Klik om te scannen'}
          </div>
        </button>

        {/* Klaar-knop — actief zodra er ≥1 succesvolle scan is */}
        <button
          onClick={onCancel}
          disabled={successCount === 0}
          className={`relative w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
            successCount > 0
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-90'
              : 'bg-slate-900 text-slate-700 pointer-events-none'
          }`}
          aria-label="Klaar met scannen"
        >
          <Check size={successCount > 0 ? 20 : 28} />
          {successCount > 0 && (
            <span className="text-[9px] font-black leading-none">{successCount}</span>
          )}
          {/* Badge: aantal nog in verwerking */}
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;
