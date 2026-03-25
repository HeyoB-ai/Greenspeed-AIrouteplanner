import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, AlertCircle, RefreshCw } from 'lucide-react';
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

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  // iOS Safari heeft ~300ms nodig na getUserMedia voor de camera warm is
  const [cameraReady, setCameraReady] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraError, setCameraError] = useState('');

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

  // Eenvoudige flow: foto → Gemini → feedback → klaar voor volgende scan
  const capture = useCallback(async () => {
    if (!cameraReady || isProcessing || cameraError) return;
    if (!videoRef.current || !canvasRef.current) return;
    if (!videoRef.current.videoWidth || videoRef.current.videoWidth === 0) return;

    // Witte sluiter-flash
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);

    setIsProcessing(true);
    setErrorMsg('');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setIsProcessing(false); return; }

    // iOS debug — zichtbaar in Safari console via Develop menu
    console.log('iOS debug:', video.videoWidth, video.videoHeight);

    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    if (!base64 || base64.length < 1000) {
      setCameraError('Camera niet gereed, probeer opnieuw');
      setIsProcessing(false);
      return;
    }

    try {
      const result = await extractAddressFromImage(base64);
      if (result?.street && result.houseNumber) {
        playSound('success');
        // Groene flash (500ms) als visuele bevestiging
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 500);
        onScanCompleteRef.current(result);
      } else {
        playSound('error');
        setErrorMsg('Adres niet herkend — probeer opnieuw');
      }
    } catch (err: any) {
      playSound('error');
      setErrorMsg(err?.message || String(err));
    } finally {
      setIsProcessing(false);
    }
  }, [cameraReady, isProcessing, cameraError]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">

      {/* Camera feed */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Witte sluiter-flash */}
        {showFlash && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

        {/* Groene success-flash */}
        {showSuccess && <div className="absolute inset-0 bg-emerald-400/50 z-50 pointer-events-none" />}

        {/* Foutmelding — zichtbaar op iPhone zonder Mac/console */}
        {errorMsg && (
          <div className="absolute top-8 left-4 right-4 z-20 bg-black/80 rounded-2xl px-4 py-3">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Scanfout</p>
            <p className="text-[11px] font-mono text-white/90 break-all leading-snug">{errorMsg}</p>
          </div>
        )}

        {/* Scan frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className={`w-full max-w-md aspect-[4/3] border-2 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.65)] transition-colors duration-300 ${
            isProcessing ? 'border-blue-400' : 'border-white/20'
          }`}>
            {/* Hoekdecoraties */}
            {(['tl','tr','bl','br'] as const).map(corner => (
              <div key={corner} className={`absolute w-8 h-8 transition-colors ${
                corner === 'tl' ? '-top-1 -left-1 border-t-4 border-l-4 rounded-tl-xl' :
                corner === 'tr' ? '-top-1 -right-1 border-t-4 border-r-4 rounded-tr-xl' :
                corner === 'bl' ? '-bottom-1 -left-1 border-b-4 border-l-4 rounded-bl-xl' :
                                  '-bottom-1 -right-1 border-b-4 border-r-4 rounded-br-xl'
              } ${isProcessing ? 'border-blue-400' : 'border-blue-500'}`} />
            ))}

            {/* Scan-line animatie alleen wanneer camera vrij is */}
            {!isProcessing && <div className="scan-line" />}

            <div className="absolute inset-0 flex items-center justify-center">
              {isProcessing && <RefreshCw className="animate-spin text-blue-400" size={32} />}
              {!isProcessing && (
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                  Plaats label in dit kader
                </p>
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

        {/* Sluiten */}
        <button
          onClick={onCancel}
          className="w-14 h-14 bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/5"
        >
          <X size={24} />
        </button>

        {/* Capture knop */}
        <button
          onClick={capture}
          disabled={!cameraReady || isProcessing || !!cameraError}
          className="relative group outline-none"
          aria-label="Scan pakket"
        >
          <div className={`absolute inset-[-12px] rounded-full blur-2xl transition-all duration-300 ${
            isProcessing ? 'bg-blue-600/40' : 'bg-blue-600/20 group-active:scale-150'
          }`} />
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10 border-[10px] border-slate-950 ${
            isProcessing ? 'bg-slate-300 text-slate-500' : 'bg-white text-slate-900 active:scale-90'
          }`}>
            {isProcessing ? <RefreshCw className="animate-spin" size={40} /> : <Camera size={40} />}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">
            {!cameraReady ? 'Camera starten...' : isProcessing ? 'Verwerken...' : 'Klik om te scannen'}
          </div>
        </button>

        {/* Lege ruimte rechts voor symmetrie */}
        <div className="w-14 h-14" />

      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;
