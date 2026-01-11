import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';
import { extractAddressFromImage } from '../services/geminiService';
import { Address } from '../types';

interface ScannerProps {
  onScanComplete: (address: Address) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError("Kan de camera niet starten. Controleer je rechten.");
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    setError(null);
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      const address = await extractAddressFromImage(base64);
      
      if (address && address.street && address.houseNumber) {
        onScanComplete(address);
      } else {
        setError("Geen geldig afleveradres gevonden. Zorg dat het patiënt-adres goed in beeld is.");
        setIsProcessing(false);
      }
    } catch (err) {
      setError("Analyse mislukt. Probeer het opnieuw.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="w-full h-full object-cover" 
        />
        
        {/* Richtkruis / Scan Frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className="w-full max-w-md aspect-[4/3] border-2 border-white/30 rounded-3xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.6)]">
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
            <div className="scan-line" />
            <div className="absolute inset-0 flex items-center justify-center">
               <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                 Plaats patiënt-adres in dit kader
               </p>
            </div>
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-white z-20">
            <div className="bg-slate-800/50 p-8 rounded-4xl flex flex-col items-center border border-white/10">
              <RefreshCw className="animate-spin mb-4 text-blue-400" size={48} />
              <p className="font-black text-xl tracking-tight">AI Analyseert...</p>
              <p className="text-sm text-slate-400 mt-2 font-medium">Privacy filter is actief</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-12 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-2xl z-30 animate-in slide-in-from-top duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-black">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom Controls - Verhoogd voor iOS Safari bars */}
      <div className="px-10 pt-8 pb-16 bg-slate-950 flex justify-between items-center border-t border-white/5">
        <button 
          onClick={onCancel} 
          className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/10"
        >
          <X size={24} />
        </button>
        
        <button 
          onClick={capture} 
          disabled={isProcessing} 
          className="relative group"
        >
          <div className="absolute inset-[-8px] bg-blue-600/20 rounded-full blur-xl group-active:scale-150 transition-transform duration-500" />
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-2xl active:scale-90 transition-all relative z-10 border-[6px] border-slate-950">
             <Camera size={32} />
          </div>
        </button>
        
        <div className="w-14 h-14 opacity-0 pointer-events-none" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;