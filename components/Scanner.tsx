
import React, { useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, CheckCircle2 } from 'lucide-react';
import { extractAddressFromImage } from '../services/geminiService';
import { Address } from '../types';

interface ScannerProps {
  onScanComplete: (address: Address) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (err) {
      setError("Toegang tot camera geweigerd of niet beschikbaar.");
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCapturing(false);
    }
  }, []);

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
    const base64Data = dataUrl.split(',')[1];

    try {
      const address = await extractAddressFromImage(base64Data);
      if (address) {
        stopCamera();
        onScanComplete(address);
      } else {
        setError("Geen adres herkend op het etiket. Probeer het opnieuw.");
      }
    } catch (err) {
      setError("Er is een fout opgetreden bij het verwerken.");
    } finally {
      setIsProcessing(false);
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        {/* Overlay targeting area */}
        <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none">
          <div className="w-full h-full border-2 border-white/50 rounded-lg relative">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl"></div>
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr"></div>
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl"></div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br"></div>
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-6 text-center">
            <RefreshCw className="w-12 h-12 mb-4 animate-spin text-blue-400" />
            <p className="text-xl font-bold">AI extraheert adres...</p>
            <p className="text-sm text-slate-300 mt-2">Privacy-check: Namen en medische gegevens worden genegeerd.</p>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg text-sm flex items-center space-x-2">
            <X size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-8 flex items-center space-x-6">
        <button 
          onClick={onCancel}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700 active:scale-95 transition-all shadow-lg"
        >
          <X size={28} />
        </button>
        
        <button 
          disabled={!isCapturing || isProcessing}
          onClick={captureFrame}
          className="w-20 h-20 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 active:scale-95 transition-all shadow-xl border-4 border-white/10"
        >
          <Camera size={36} />
        </button>

        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-slate-800/50 text-slate-500">
          <CheckCircle2 size={28} />
        </div>
      </div>
      
      <p className="text-slate-400 text-xs mt-6 px-8 text-center max-w-xs">
        Richt de camera op het verzendetiket. Alleen adresgegevens worden opgeslagen.
      </p>
    </div>
  );
};

export default Scanner;
