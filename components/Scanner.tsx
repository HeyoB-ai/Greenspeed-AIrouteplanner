import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        alert("Camera toegang geweigerd.");
        onCancel();
      }
    }
    setupCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [onCancel]);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);
    
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    const address = await extractAddressFromImage(base64);
    
    if (address) {
      onScanComplete(address);
    } else {
      alert("Geen adres gevonden. Zorg dat het label goed verlicht is.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 bg-slate-900 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute inset-0 border-[3rem] border-black/40 pointer-events-none">
          <div className="w-full h-full border-2 border-blue-400/50 rounded-xl relative">
            <div className="scan-line" />
          </div>
        </div>
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <RefreshCw className="animate-spin mb-4" size={48} />
            <p className="font-bold text-lg">AI analyseert privacy-veilig...</p>
          </div>
        )}
      </div>
      <div className="p-8 bg-slate-900 flex justify-around items-center">
        <button onClick={onCancel} className="p-4 bg-slate-800 text-white rounded-full"><X /></button>
        <button onClick={capture} disabled={isProcessing} className="w-20 h-20 bg-blue-600 border-4 border-white/20 rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform">
          <Camera size={32} />
        </button>
        <div className="w-12 h-12" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Scanner;