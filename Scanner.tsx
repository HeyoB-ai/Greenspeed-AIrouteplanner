import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Check, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import { extractAddressFromImage } from './services/geminiService';
import { Address } from './types';

interface ScannerProps {
  onScanComplete: (address: Address) => void;
  onCancel: () => void;
}

// Web Audio API tonen — geen externe bestanden nodig
const playSound = (type: 'success' | 'error') => {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);

    if (type === 'success') {
      // Twee oplopende tonen: 880Hz → 1100Hz
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.start(ctx.currentTime + i * 0.16);
        osc.stop(ctx.currentTime + i * 0.16 + 0.14);
      });
    } else {
      // Één lage buzzer: 220Hz
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext niet beschikbaar (bijv. server-side render)
  }
};

type ScanState = 'ready' | 'processing' | 'success' | 'error';

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanState, setScanState] = useState<ScanState>('ready');
  const [scanCount, setScanCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [showFlash, setShowFlash] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        }
      } catch {
        setScanState('error');
        setErrorMsg('Kan de camera niet starten. Controleer je rechten.');
      }
    }

    setupCamera();

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const capture = useCallback(async () => {
    if (scanState !== 'ready') return;
    if (!videoRef.current || !canvasRef.current) return;

    // Flash-effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);

    // Foto vastleggen
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // ✅ Meteen terug naar ready — volgende scan kan al beginnen
    setScanState('ready');
    setScanCount(prev => prev + 1);
    setErrorMsg('');

    // AI-analyse op de achtergrond (niet-blokkerend)
    try {
      const result = await extractAddressFromImage(base64);
      if (result?.address?.street && result.address.houseNumber) {
        playSound('success');
        if (typeof onScanComplete === 'function') onScanComplete(result.address);
      } else {
        playSound('error');
      }
    } catch {
      playSound('error');
    }
  }, [scanState, onScanComplete]);

  const handleCancel = () => {
    if (typeof onCancel === 'function') onCancel();
  };

  const isCapturing = scanState === 'processing';

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Camera feed */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Flash overlay */}
        {showFlash && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

        {/* Succes overlay — groen */}
        {scanState === 'success' && (
          <div className="absolute inset-0 bg-emerald-500/20 z-40 pointer-events-none flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-emerald-500 text-white rounded-full p-6 shadow-2xl">
              <Check size={48} strokeWidth={3} />
            </div>
          </div>
        )}

        {/* Scan frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className={`w-full max-w-md aspect-[4/3] border-2 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.65)] transition-colors duration-300 ${
            scanState === 'success' ? 'border-emerald-400' :
            scanState === 'error'   ? 'border-red-400' :
            isCapturing             ? 'border-blue-400' :
                                      'border-white/20'
          }`}>
            <div className={`absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors ${scanState === 'success' ? 'border-emerald-400' : 'border-blue-500'}`} />
            <div className={`absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors ${scanState === 'success' ? 'border-emerald-400' : 'border-blue-500'}`} />
            <div className={`absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors ${scanState === 'success' ? 'border-emerald-400' : 'border-blue-500'}`} />
            <div className={`absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors ${scanState === 'success' ? 'border-emerald-400' : 'border-blue-500'}`} />

            {/* Scan-line animatie alleen in ready staat */}
            {scanState === 'ready' && <div className="scan-line" />}

            <div className="absolute inset-0 flex items-center justify-center">
              {scanState === 'ready' && (
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                  Plaats label in dit kader
                </p>
              )}
              {isCapturing && (
                <div className="flex flex-col items-center space-y-2">
                  <RefreshCw className="animate-spin text-blue-400" size={32} />
                  <p className="text-blue-300 text-[10px] font-black uppercase tracking-widest">AI analyseert...</p>
                </div>
              )}
              {scanState === 'success' && (
                <p className="text-emerald-300 text-sm font-black uppercase tracking-widest">Adres herkend!</p>
              )}
            </div>
          </div>
        </div>

        {/* Burst mode badge */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600/90 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter flex items-center space-x-2 shadow-lg">
            <Zap size={10} fill="currentColor" />
            <span>Burst Mode — scan meerdere pakketten achter elkaar</span>
          </span>
        </div>

        {/* Scan counter */}
        {scanCount > 0 && (
          <div className="absolute top-14 right-5 animate-in zoom-in duration-300">
            <div className="bg-emerald-600 text-white w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-white/20">
              <span className="text-xl font-black leading-none">{scanCount}</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter">Scans</span>
            </div>
          </div>
        )}

        {/* Foutmelding */}
        {scanState === 'error' && errorMsg && (
          <div className="absolute bottom-4 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-2xl z-30 animate-in slide-in-from-bottom duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-black">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-8 pt-8 pb-20 bg-slate-950 flex justify-between items-center border-t border-white/5">
        {/* Annuleer */}
        <button
          onClick={handleCancel}
          className="w-14 h-14 bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/5"
        >
          <X size={24} />
        </button>

        {/* Capture knop */}
        <button
          onClick={capture}
          disabled={isCapturing}
          className="relative group outline-none"
          aria-label="Scan pakket"
        >
          <div className={`absolute inset-[-12px] rounded-full blur-2xl transition-all duration-300 ${
            scanState === 'success' ? 'bg-emerald-500/40 scale-150' :
            isCapturing             ? 'bg-blue-600/40' :
                                      'bg-blue-600/20 group-active:scale-150'
          }`} />
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all relative z-10 border-[10px] border-slate-950 ${
            scanState === 'success' ? 'bg-emerald-500 text-white' :
            isCapturing             ? 'bg-slate-300 text-slate-500' :
                                      'bg-white text-slate-900'
          }`}>
            {isCapturing ? <RefreshCw className="animate-spin" size={40} /> :
             scanState === 'success' ? <Check size={40} strokeWidth={3} /> :
             <Camera size={40} />}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">
            {isCapturing ? 'Verwerken...' : scanState === 'success' ? 'Volgende' : 'Klik om te scannen'}
          </div>
        </button>

        {/* Klaar knop — groen zodra er ≥1 scan is */}
        <button
          onClick={handleCancel}
          disabled={scanCount === 0}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            scanCount > 0
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-90'
              : 'bg-slate-900 text-slate-700 pointer-events-none'
          }`}
          aria-label="Klaar met scannen"
        >
          <Check size={28} />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;
