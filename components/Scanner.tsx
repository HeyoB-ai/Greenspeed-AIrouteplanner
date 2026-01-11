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
        // Forceer een hogere resolutie voor betere OCR
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Belangrijk voor iOS: play() expliciet aanroepen
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

    // Schaal het beeld naar een werkbaar formaat (max 1280px breed)
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      // Gebruik iets lagere kwaliteit om de payload klein te houden (sneller)
      const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      const address = await extractAddressFromImage(base64);
      
      if (address && address.street && address.houseNumber) {
        onScanComplete(address);
      } else {
        setError("Geen geldig afleveradres gevonden. Probeer het label recht van voren te fotograferen.");
        setIsProcessing(false);
      }
    } catch (err) {
      setError("Er ging iets mis tijdens het analyseren. Probeer het opnieuw.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="w-full h-full object-cover" 
        />
        
        {/* Richtkruis / Scan Frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[85%] h-[40%] border-2 border-white/50 rounded-2xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-right-4 border-blue-500 rounded-tr-lg" style={{borderRightWidth: '4px', borderRightStyle: 'solid'}} />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-right-4 border-blue-500 rounded-br-lg" style={{borderRightWidth: '4px', borderRightStyle: 'solid'}} />
            <div className="scan-line" />
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
            <div className="bg-white/10 p-6 rounded-3xl flex flex-col items-center">
              <RefreshCw className="animate-spin mb-4 text-blue-400" size={48} />
              <p className="font-bold text-lg">AI filtert privacy-data...</p>
              <p className="text-xs text-slate-400 mt-2">Alleen adresgegevens worden verwerkt</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-10 left-4 right-4 bg-red-500 text-white p-4 rounded-2xl flex items-center space-x-3 shadow-2xl z-30 animate-in slide-in-from-top duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}
      </div>

      <div className="p-8 pb-12 bg-slate-900 flex justify-around items-center">
        <button 
          onClick={onCancel} 
          className="p-4 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors"
        >
          <X size={24} />
        </button>
        
        <button 
          onClick={capture} 
          disabled={isProcessing} 
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-90 transition-transform disabled:opacity-50"
        >
          <div className="w-16 h-16 border-4 border-slate-900 rounded-full flex items-center justify-center">
             <Camera size={32} />
          </div>
        </button>
        
        <div className="w-12 h-12" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;