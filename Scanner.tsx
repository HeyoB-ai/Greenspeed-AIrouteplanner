import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Check, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { extractAddressFromImage, ScanResult } from './services/geminiService';
import { Address } from './types';

interface ScannerProps {
  onScanComplete: (result: ScanResult) => void;
  onCancel: () => void;
  nextScanNumber: number;
}

type QueueItem = {
  id: string;
  base64: string;
  status: 'pending' | 'success' | 'error';
  address?: Address;
};

// Één gedeelde AudioContext — iOS Safari crasht bij meerdere instanties
const audioCtx = (() => {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
})();

const playSound = (type: 'click' | 'success' | 'error') => {
  try {
    if (!audioCtx) return;
    audioCtx.resume().then(() => {
      const gain = audioCtx.createGain();
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        // Instant piepje bij shutter — NIET wachten op Gemini
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        const osc = audioCtx.createOscillator();
        osc.connect(gain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.08);
      } else if (type === 'success') {
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        [880, 1100].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          osc.connect(gain);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          osc.start(audioCtx.currentTime + i * 0.16);
          osc.stop(audioCtx.currentTime + i * 0.16 + 0.14);
        });
      } else {
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        const osc = audioCtx.createOscillator();
        osc.connect(gain);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
      }
    });
  } catch {
    // AudioContext niet beschikbaar — scan gaat door
  }
};

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel, nextScanNumber }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [overlayNumber, setOverlayNumber] = useState<number | null>(null);
  const [overlayAddress, setOverlayAddress] = useState('');

  // Stabiele refs om stale-closure issues te voorkomen
  const onScanCompleteRef = useRef(onScanComplete);
  useEffect(() => { onScanCompleteRef.current = onScanComplete; }, [onScanComplete]);
  const nextScanNumberRef = useRef(nextScanNumber);
  useEffect(() => { nextScanNumberRef.current = nextScanNumber; }, [nextScanNumber]);
  const successCountRef   = useRef(0);

  // Voorkom dat hetzelfde item twee keer tegelijk verwerkt wordt
  const processingIds = useRef(new Set<string>());

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
          // iOS Safari: geef camera 300ms om te initialiseren
          setTimeout(() => setCameraReady(true), 300);
        }
      } catch {
        setCameraError('Kan de camera niet starten. Controleer je rechten.');
      }
    }
    setupCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Scroll tray naar rechts zodra nieuwe items binnenkomen
  useEffect(() => {
    if (trayRef.current) {
      trayRef.current.scrollLeft = trayRef.current.scrollWidth;
    }
  }, [queue.length]);

  const updateQueueItem = useCallback((id: string, status: QueueItem['status'], address?: Address) => {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status, address } : item
    ));
  }, []);

  const processItem = useCallback(async (item: QueueItem) => {
    // Voorkom dubbele verwerking van hetzelfde item
    if (processingIds.current.has(item.id)) return;
    processingIds.current.add(item.id);
    try {
      const result = await extractAddressFromImage(item.base64);
      if (result?.address?.street && result.address.houseNumber) {
        updateQueueItem(item.id, 'success', result.address);
        playSound('success');

        // Toon scannummer — koerier schrijft dit op het pakje
        successCountRef.current += 1;
        const thisNumber = nextScanNumberRef.current + successCountRef.current - 1;
        setOverlayNumber(thisNumber);
        setOverlayAddress(`${result.address.street} ${result.address.houseNumber}, ${result.address.city}`);

        // Wacht 1.5s zodat de koerier het nummer kan zien, dan sluiten
        await new Promise(r => setTimeout(r, 1500));
        setOverlayNumber(null);
        onScanCompleteRef.current(result);
      } else {
        updateQueueItem(item.id, 'error');
        playSound('error');
      }
    } catch {
      updateQueueItem(item.id, 'error');
      playSound('error');
    } finally {
      processingIds.current.delete(item.id);
    }
  }, [updateQueueItem]);

  const retryItem = useCallback((item: QueueItem) => {
    updateQueueItem(item.id, 'pending');
    processItem(item);
  }, [updateQueueItem, processItem]);

  // Capture: foto direct in queue, camera meteen weer vrij
  const capture = useCallback(() => {
    if (!cameraReady || cameraError) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (!videoRef.current.videoWidth || videoRef.current.videoWidth === 0) return;

    // Witte sluiter-flash + direct geluid
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);
    playSound('click');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    if (!base64 || base64.length < 1000) {
      setCameraError('Camera niet gereed, probeer opnieuw');
      return;
    }

    const newItem: QueueItem = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      base64,
      status: 'pending',
    };

    // Teller direct omhoog + item in tray
    setScanCount(prev => prev + 1);
    setQueue(prev => [...prev, newItem]);

    // Gemini verwerkt op de achtergrond — camera is nu al vrij
    processItem(newItem);
  }, [cameraReady, cameraError, processItem]);

  const pendingCount = queue.filter(i => i.status === 'pending').length;

  const handleKlaar = () => {
    if (pendingCount > 0) {
      setShowCloseModal(true);
    } else {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">

      {/* Camera feed */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Witte sluiter-flash */}
        {showFlash && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

        {/* Burst Mode badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
            ⚡ Burst Mode
          </div>
        </div>

        {/* Scan-teller rechts bovenaan */}
        {scanCount > 0 && (
          <div className="absolute top-3 right-4 z-20 bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-1.5 text-center pointer-events-none">
            <p className="text-white font-black text-xl leading-none">{scanCount}</p>
            <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest">gescand</p>
          </div>
        )}

        {/* Scan frame met hoekmarkeringen */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className="w-full max-w-md aspect-[4/3] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.65)]">
            {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
              <div key={corner} className={`absolute w-8 h-8 border-blue-500 ${
                corner === 'tl' ? '-top-1 -left-1 border-t-4 border-l-4 rounded-tl-xl' :
                corner === 'tr' ? '-top-1 -right-1 border-t-4 border-r-4 rounded-tr-xl' :
                corner === 'bl' ? '-bottom-1 -left-1 border-b-4 border-l-4 rounded-bl-xl' :
                                  '-bottom-1 -right-1 border-b-4 border-r-4 rounded-br-xl'
              }`} />
            ))}
            <div className="scan-line" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                Plaats label in dit kader
              </p>
            </div>
          </div>
        </div>

        {/* Scannummer overlay — toont na succesvolle scan */}
        {overlayNumber !== null && (
          <div className="absolute inset-0 bg-emerald-500/20 z-40 pointer-events-none flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="bg-emerald-500 rounded-3xl px-8 py-6 shadow-2xl text-center mb-4">
              <p className="text-white/80 text-xs font-black uppercase tracking-widest mb-1">Schrijf op pakje</p>
              <p className="text-white font-black" style={{ fontSize: '72px', lineHeight: 1 }}>
                {overlayNumber}
              </p>
            </div>
            <div className="bg-white/90 rounded-2xl px-6 py-3 text-center max-w-xs mx-4">
              <p className="text-emerald-700 font-black text-sm">✓ Adres herkend</p>
              <p className="text-slate-500 text-xs mt-0.5 truncate">{overlayAddress}</p>
            </div>
          </div>
        )}

        {/* Scan tray — horizontaal scrollende statuskaartjes */}
        {queue.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 pb-3 px-3 bg-gradient-to-t from-black/60 to-transparent pt-6">
            <div
              ref={trayRef}
              className="flex gap-2 overflow-x-auto scrollbar-none touch-pan-x"
            >
              {queue.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => item.status === 'error' ? retryItem(item) : undefined}
                  disabled={item.status !== 'error'}
                  className={`flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all duration-300 ${
                    item.status === 'pending'
                      ? 'bg-slate-700/90 border-slate-500'
                      : item.status === 'success'
                      ? 'bg-emerald-900/90 border-emerald-500'
                      : 'bg-red-900/90 border-red-500 active:scale-90'
                  }`}
                  aria-label={
                    item.status === 'error'
                      ? `Scan ${index + 1} mislukt — tik om opnieuw te proberen`
                      : `Scan ${index + 1} ${item.status}`
                  }
                >
                  <span className="text-[7px] font-black text-white/40 leading-none">#{index + 1}</span>
                  {item.status === 'pending' && <Loader2 size={18} className="text-slate-300 animate-spin" />}
                  {item.status === 'success' && <Check size={18} className="text-emerald-400" />}
                  {item.status === 'error' && <RotateCcw size={18} className="text-red-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Camerafout */}
        {cameraError && (
          <div className="absolute bottom-4 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-2xl z-30 animate-in slide-in-from-bottom duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-black">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Controls — pb-safe voor iOS home-indicator */}
      <div className="px-8 pt-6 pb-safe bg-slate-950 flex justify-between items-center border-t border-white/5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>

        {/* Annuleer */}
        <button
          onClick={onCancel}
          className="w-14 h-14 bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/5"
          aria-label="Annuleer"
        >
          <X size={24} />
        </button>

        {/* Sluiterknop — altijd beschikbaar tijdens verwerking */}
        <button
          onClick={capture}
          disabled={!cameraReady || !!cameraError}
          className="relative group outline-none"
          aria-label="Scan pakket"
        >
          <div className="absolute inset-[-12px] rounded-full blur-2xl bg-blue-600/20 group-active:scale-150 transition-all duration-300" />
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10 border-[10px] border-slate-950 ${
            !cameraReady ? 'bg-slate-300 text-slate-500' : 'bg-white text-slate-900 active:scale-90'
          }`}>
            <Camera size={40} />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">
            {!cameraReady ? 'Camera starten...' : 'Klik om te scannen'}
          </div>
        </button>

        {/* Klaar-knop met pending indicator */}
        <button
          onClick={handleKlaar}
          className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex flex-col items-center justify-center hover:bg-emerald-500 active:scale-90 transition-all shadow-lg shadow-emerald-900/40"
          aria-label={pendingCount > 0 ? `Klaar — ${pendingCount} nog bezig` : 'Klaar'}
        >
          <Check size={20} />
          {pendingCount > 0 && (
            <span className="text-[7px] font-black uppercase leading-none mt-0.5 opacity-80">
              {pendingCount}…
            </span>
          )}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Modal: sluiten terwijl items nog in queue zitten */}
      {showCloseModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 mx-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <p className="text-white font-black text-lg mb-1">Nog bezig…</p>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Er worden nog{' '}
              <span className="text-white font-black">{pendingCount}</span>{' '}
              {pendingCount === 1 ? 'adres' : 'adressen'} verwerkt.
              Wacht even of ga toch door?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-3 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-700 active:scale-95 transition-all"
              >
                Wacht even
              </button>
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-500 active:scale-95 transition-all"
              >
                Toch sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
