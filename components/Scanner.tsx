import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check, Zap, AlertCircle } from 'lucide-react';

interface ScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play failed:", e));
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Kan de camera niet starten.");
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Visuele feedback: Flash effect
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Snelle capture op medium resolutie voor snelheid
    const maxWidth = 1024;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    
    // Stuur naar App.tsx maar blijf HIER in de scanner!
    onCapture(base64);
    setScanCount(prev => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="w-full h-full object-cover" 
        />
        
        {/* Flash Overlay */}
        {showFlash && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-100" />}

        {/* Richtkruis */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className="w-full max-w-md aspect-[4/3] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.7)]">
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
            <div className="scan-line" />
            
            {/* Real-time feedback in kader */}
            <div className="absolute top-4 left-0 right-0 flex justify-center">
               <span className="bg-blue-600/90 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter flex items-center space-x-2">
                 <Zap size={10} fill="currentColor" />
                 <span>Burst Mode Actief</span>
               </span>
            </div>
          </div>
        </div>

        {/* Scan Counter Bubble */}
        {scanCount > 0 && (
          <div className="absolute top-12 right-6 animate-in zoom-in duration-300">
            <div className="bg-blue-600 text-white w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-white/20">
              <span className="text-xl font-black leading-none">{scanCount}</span>
              <span className="text-[8px] font-bold uppercase tracking-tighter">Items</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-12 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-2xl z-[10001]">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-black">{error}</p>
          </div>
        )}
      </div>

      {/* Burst Mode Controls */}
      <div className="px-8 pt-8 pb-20 bg-slate-950 flex justify-between items-center border-t border-white/5 relative">
        {/* Cancel/Dismiss */}
        <button 
          onClick={onClose} 
          className="w-14 h-14 bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/5"
        >
          <X size={24} />
        </button>
        
        {/* MAIN CAPTURE BUTTON */}
        <button 
          onClick={capture} 
          className="relative group outline-none"
        >
          <div className="absolute inset-[-12px] bg-blue-600/40 rounded-full blur-2xl group-active:scale-150 transition-transform duration-300" />
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-2xl active:scale-90 transition-all relative z-10 border-[10px] border-slate-950">
             <Camera size={44} />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-400 uppercase tracking-widest whitespace-nowrap">
            Klik om te scannen
          </div>
        </button>

        {/* FINISH BUTTON */}
        <button 
          onClick={onClose}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            scanCount > 0 ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'bg-slate-900 text-slate-700 pointer-events-none'
          }`}
        >
          <Check size={28} />
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;