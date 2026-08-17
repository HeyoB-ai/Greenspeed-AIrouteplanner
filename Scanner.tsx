import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { extractAddressFromImage, validateAddressPDOK } from './services/geminiService';
import { playSuccess, playError, buzz, unlockAudio } from './services/sound';
import { Address } from './types';

interface ScannerProps {
  onScanComplete: (result: { scanId: string; address: Address; pharmacyName?: string }) => void;
  onCancel: () => void;
}

type ScanEntry = {
  scanId: string;
  // 'ok' = geverifieerd, 'corrected' = officiële straat afwijkend, 'unverified' = niet te verifiëren
  status: 'processing' | 'ok' | 'corrected' | 'unverified';
  address?: Address;
  message?: string;
  originalStreet?: string;
};

const UNVERIFIED_MSG = 'Adres niet geverifieerd — controleer en scan opnieuw';

type CameraFault = { title: string; text: string; detail?: string };

// iOS behandelt een app vanaf het beginscherm als een eigen permissie-context:
// camerarechten die in Safari gegeven zijn gelden daar niet, en ze zijn niet via
// Instellingen te herstellen — alleen door het icoon te verwijderen en opnieuw
// toe te voegen. Zonder deze uitleg ziet de koerier enkel een zwart scherm.
const isStandaloneMode = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;

const describeCameraError = (err: any): CameraFault => {
  const name = err?.name ?? '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return isStandaloneMode()
      ? {
          title: 'Geen toegang tot de camera',
          text: "Houd het Greenspeed-icoon op je beginscherm ingedrukt, kies 'App verwijderen', " +
                'open greenspeed.netlify.app opnieuw in Safari en zet hem via het deel-icoon weer ' +
                'op je beginscherm. Daarna vraagt de app opnieuw om cameratoegang.',
        }
      : {
          title: 'Geen toegang tot de camera',
          text: 'Tik op het aA-icoon in de adresbalk, kies Website-instellingen en zet Camera op ' +
                'Vragen of Sta toe.',
        };
  }

  if (name === 'NotFoundError') {
    return { title: 'Geen camera gevonden', text: 'Geen camera gevonden op dit apparaat.' };
  }

  if (name === 'NotReadableError') {
    return {
      title: 'Camera niet beschikbaar',
      text: 'De camera is in gebruik door een andere app. Sluit die app en probeer opnieuw.',
    };
  }

  return {
    title: 'Camera kon niet starten',
    text: 'Probeer het opnieuw of sluit de scanner.',
    detail: [name, err?.message].filter(Boolean).join(' — ') || undefined,
  };
};

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, onCancel }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Voorkomt dat de pause-listener zich opstapelt bij elke retry
  const pauseHandlerRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<CameraFault | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  // Cooldown van 2s na elke fysieke capture, voorkomt rate-limit bursts
  const [cooldown, setCooldown] = useState(false);

  // Tracks which scans are still active (scanner not yet closed)
  const activeScansRef = useRef<Set<string>>(new Set());

  // Semaphore: maximaal 2 gelijktijdige Gemini-aanroepen om de gratis-tier
  // rate limit niet te overschrijden (gecombineerd met retry-with-backoff in callGemini)
  const semaphore = useRef(0);
  const MAX_CONCURRENT = 2;

  // Stabiele ref voor onScanComplete — voorkomt stale closure in processScan
  const onScanCompleteRef = useRef(onScanComplete);
  useEffect(() => { onScanCompleteRef.current = onScanComplete; }, [onScanComplete]);

  // Camera setup — uitgelicht uit de useEffect zodat "Probeer opnieuw" hem
  // opnieuw kan aanroepen. De stream hangt aan een ref in plaats van een
  // effect-lokale variabele, anders kan de cleanup een latere stream niet stoppen.
  const startCamera = useCallback(async () => {
    // Vorige stream vrijgeven — een tweede getUserMedia op een bezette camera
    // faalt op iOS met NotReadableError
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraError(null);
    setCameraReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        // Zet attributen expliciet — sommige iOS Safari versies negeren JSX props
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');

        video.srcObject = stream;
        video.play().catch(e => console.error('Video play failed:', e));

        // Hervat direct als video onverwacht pauzeert (iOS Safari freeze).
        // Eenmalig — bij een retry zou de listener zich anders opstapelen.
        if (!pauseHandlerRef.current) {
          pauseHandlerRef.current = true;
          video.addEventListener('pause', () => {
            video.play().catch(() => {});
          });
        }

        // iOS Safari: geef camera 300ms om te initialiseren
        setTimeout(() => setCameraReady(true), 300);
      }
    } catch (err: any) {
      console.error('[Scan] getUserMedia mislukt:', err?.name, err?.message, 'standalone:', isStandaloneMode(), err);
      setCameraError(describeCameraError(err));
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  // OCR verwerking — volledig geïsoleerd per scanId via de base64 parameter
  // Markeer een scan als rood (niet geverifieerd) + luid signaal
  const markUnverified = (scanId: string, message: string) => {
    playError(); buzz([80, 60, 80]);
    setScans(prev => prev.map(s =>
      s.scanId === scanId ? { ...s, status: 'unverified', message } : s
    ));
  };

  const processScan = useCallback(async (scanId: string, base64: string) => {
    if (semaphore.current >= MAX_CONCURRENT) {
      markUnverified(scanId, 'Te druk — scan opnieuw');
      return;
    }
    semaphore.current++;
    try {
      // base64 is een lokale parameter — geen gedeelde variabele, geen stale closure
      const result = await extractAddressFromImage(base64);

      // Scanner gesloten terwijl Gemini bezig was — resultaat weggooien
      if (!activeScansRef.current.has(scanId)) return;

      const address = result?.address;
      const hasCore = !!address?.street && !!address?.houseNumber && !!address?.postalCode;

      // OCR leverde geen volledig adres → rood, niet stil accepteren
      if (!hasCore || !address) {
        markUnverified(scanId, UNVERIFIED_MSG);
        return;
      }

      // Officiële BAG-validatie via PDOK vóór definitief opslaan
      const norm = (s?: string | null) => (s ?? '').toLowerCase().replace(/\s+/g, '');
      const pdok = await validateAddressPDOK(address.postalCode, address.houseNumber);

      // Scanner ondertussen gesloten — resultaat weggooien
      if (!activeScansRef.current.has(scanId)) return;

      if (pdok.found) {
        const corrected = norm(pdok.street) !== norm(address.street);
        const finalAddress: Address = {
          ...address,
          street: pdok.street!,                 // officiële straatnaam
          city:   pdok.city ?? address.city,
          lat:    pdok.lat!,                     // officiële coördinaat → route klopt
          lng:    pdok.lng!,
        };

        if (corrected) {
          // ORANJE: opgeslagen met officiële versie, correctie tonen
          playSuccess(); buzz(60);
          setScans(prev => prev.map(s =>
            s.scanId === scanId
              ? { ...s, status: 'corrected', address: finalAddress, originalStreet: address.street, message: `${address.street} → ${pdok.street}` }
              : s
          ));
        } else {
          // GROEN
          playSuccess(); buzz(40);
          setScans(prev => prev.map(s =>
            s.scanId === scanId ? { ...s, status: 'ok', address: finalAddress } : s
          ));
        }

        onScanCompleteRef.current({ scanId, address: finalAddress, pharmacyName: result.pharmacyName });
      } else {
        // ROOD + LUID: niet geverifieerd, niet stil accepteren
        markUnverified(scanId, UNVERIFIED_MSG);
      }
    } catch {
      if (activeScansRef.current.has(scanId)) {
        markUnverified(scanId, 'Verwerking mislukt — scan opnieuw');
      }
    } finally {
      semaphore.current--;
    }
  }, []);

  // Legt alleen het gebied binnen het blauwe richtkader vast.
  // Nieuw canvas per scan — omzeilt iOS Safari GPU-cache freeze.
  function captureFrame(): string {
    const video = videoRef.current;
    if (!video) throw new Error('Camera niet beschikbaar');
    if (video.readyState < 2) throw new Error('Video nog niet klaar');

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Richtkader: ~82% van de videobreedte, aspect 4:3, gecentreerd
    const frameRatio = 0.82;
    const cropW = Math.round(vw * frameRatio);
    const cropH = Math.round(cropW * (3 / 4));
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const context = tempCanvas.getContext('2d');
    if (!context) throw new Error('Canvas context niet beschikbaar');

    // Teken alleen het kader-gebied — niet de volledige video
    context.drawImage(
      video,
      cropX, cropY, cropW, cropH,  // bron: uitsnede van het richtkader
      0, 0, cropW, cropH            // doel: volledig canvas
    );

    const base64 = tempCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    console.log(`[Scan] crop: ${cropX},${cropY} ${cropW}x${cropH} van ${vw}x${vh}`);
    console.log(`[Scan] base64 length: ${base64.length}`);

    // Geef canvas vrij — voorkomt geheugenlek bij burst scans
    tempCanvas.width = 0;
    tempCanvas.height = 0;

    return base64;
  }

  const handleCapture = useCallback(() => {
    if (!cameraReady || cooldown) return;

    // Vereist op iOS: deblokkeer de AudioContext binnen deze user-gesture
    unlockAudio();

    let base64: string;
    try {
      base64 = captureFrame();
    } catch (err: any) {
      setCameraError({ title: 'Camera niet gereed', text: err?.message ?? 'Probeer het opnieuw.' });
      return;
    }

    if (!base64 || base64.length < 1000) {
      setCameraError({ title: 'Camera niet gereed', text: 'Er kwam nog geen beeld door. Probeer het opnieuw.' });
      return;
    }

    // Cooldown start vanaf het moment dat de fysieke capture geslaagd is.
    setCooldown(true);
    setTimeout(() => setCooldown(false), 2000);

    // Unieke ID koppelt deze capture atomisch aan het Gemini-resultaat
    const scanId = crypto.randomUUID();

    // Voeg toe aan state als 'processing'
    setScans(prev => [...prev, { scanId, status: 'processing' }]);
    activeScansRef.current.add(scanId);

    // Witte sluiter-flash
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 100);

    // Audio feedback — AudioContext aanmaken binnen user gesture is veilig
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio niet beschikbaar — scan gaat door
    }

    // Verwerk asynchroon — camera is nu al vrij voor de volgende scan
    processScan(scanId, base64);
  }, [cameraReady, cooldown, processScan]);

  const handleClose = useCallback(() => {
    activeScansRef.current.clear();
    onCancel();
  }, [onCancel]);

  // Maximaal 7 tiles zichtbaar — oudste verdwijnt als er meer zijn
  const visibleScans = scans.slice(-7);
  // 'ok' én 'corrected' zijn opgeslagen (onScanComplete aangeroepen) → tellen als succes
  const isSaved = (s: ScanEntry) => s.status === 'ok' || s.status === 'corrected';
  const hasSuccess = scans.some(isSaved);
  const successCount = scans.filter(isSaved).length;
  // Aantal scans dat nog op Gemini wacht — derived uit dezelfde scans-array,
  // dus altijd consistent met de tile-status zonder kans op race-conditions.
  const pendingScans = scans.filter(s => s.status === 'processing').length;
  const canFinish = hasSuccess && pendingScans === 0;

  // Banner toont de laatst afgeronde scan als die aandacht vraagt (oranje/rood)
  const lastDone = [...scans].reverse().find(s => s.status !== 'processing');
  const feedback = lastDone && lastDone.status !== 'ok' ? lastDone : null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-in fade-in duration-300">

      {/* Camera feed */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Witte sluiter-flash */}
        {showFlash && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

        {/* Burst Mode badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="text-white px-4 py-1.5 rounded-full text-[10px] font-display font-black uppercase tracking-widest shadow-lg"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
            ⚡ Burst Mode Actief
          </div>
        </div>

        {/* Scan-teller rechtsboven */}
        {scans.length > 0 && (
          <div className="absolute top-3 right-4 z-20 bg-black/60 backdrop-blur-sm rounded-2xl px-3 py-1.5 text-center pointer-events-none">
            <p className="text-white font-black text-xl leading-none">{successCount}</p>
            <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest">gescand</p>
          </div>
        )}

        {/* Bevestiging dat de foto al binnen is. Zonder dit denken koeriers dat ze de
            camera stil moeten houden tijdens de 6-7s Gemini-verwerking, terwijl de
            capture al klaar is op het moment van de flits. Zichtbaar zolang er een
            zandlopertje draait; verdwijnt als de laatste tile zijn vinkje krijgt. */}
        {pendingScans > 0 && (
          <div className="absolute top-16 left-4 right-4 z-30 pointer-events-none animate-in fade-in slide-in-from-top duration-200">
            <div className="bg-[#d7e2fe] text-[#101c30] rounded-2xl px-4 py-2.5 shadow-2xl flex items-center justify-center">
              <p className="text-sm font-black leading-tight text-center">
                📸 Foto gemaakt — je kunt verder scannen
              </p>
            </div>
          </div>
        )}

        {/* Scan frame met hoek-accenten */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className="w-full max-w-md aspect-[4/3] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_2000px_rgba(0,0,0,0.65)]">
            {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
              <div key={corner} className={`absolute w-8 h-8 border-[#48c2a9] ${
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

        {/* Validatie-feedback — luid en duidelijk (oranje = gecorrigeerd, rood = niet geverifieerd) */}
        {feedback && (
          <div
            className={`absolute bottom-24 left-4 right-4 z-30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom duration-300 text-white ${
              feedback.status === 'unverified' ? 'bg-red-500' : 'bg-orange-500'
            }`}
          >
            {feedback.status === 'unverified'
              ? <AlertCircle size={22} className="shrink-0" />
              : <Check size={22} className="shrink-0" />}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
                {feedback.status === 'unverified' ? 'Niet geverifieerd' : 'Adres gecorrigeerd'}
              </p>
              <p className="text-sm font-black leading-tight truncate">{feedback.message}</p>
            </div>
          </div>
        )}

        {/* Status tiles */}
        {visibleScans.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 pb-3 px-3 bg-gradient-to-t from-black/60 to-transparent pt-6">
            <div className="flex gap-2 justify-center">
              {visibleScans.map(scan => (
                <div
                  key={scan.scanId}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    scan.status === 'processing'
                      ? 'bg-slate-800'
                      : scan.status === 'unverified'
                      ? 'bg-red-500'
                      : scan.status === 'corrected'
                      ? 'bg-orange-500'
                      : ''
                  }`}
                  style={scan.status === 'ok' ? { background: '#006b5a' } : {}}
                >
                  {scan.status === 'processing' && <Loader2     size={18} className="text-white/80 animate-spin" />}
                  {scan.status === 'ok'         && <Check       size={18} className="text-white" />}
                  {scan.status === 'corrected'  && <AlertCircle size={18} className="text-white" />}
                  {scan.status === 'unverified' && <X           size={18} className="text-white" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Camerafout — midden in het kader, want bij een fout is het beeld zwart
            en las niemand de melding onderaan. Titel + uitleg met een concrete
            volgende stap in plaats van "Controleer je rechten". */}
        {cameraError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl px-5 py-5 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertCircle size={20} className="text-red-500" />
                </div>
                <p className="font-display font-black text-[#191c1e] text-base leading-tight">
                  {cameraError.title}
                </p>
              </div>
              <p className="text-sm text-[#3d4945] font-body leading-snug">
                {cameraError.text}
              </p>
              {cameraError.detail && (
                <p className="mt-2 text-[11px] text-[#3d4945]/60 font-body break-words">
                  {cameraError.detail}
                </p>
              )}
              <button
                onClick={startCamera}
                className="mt-4 w-full h-11 bg-red-500 text-white rounded-full font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <RefreshCw size={16} />
                Probeer opnieuw
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Knoppen — pb-safe voor iOS home-indicator */}
      <div
        className="px-8 pt-6 bg-slate-950 flex justify-between items-center border-t border-white/5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
      >
        {/* Sluiten */}
        <button
          onClick={handleClose}
          className="w-14 h-14 bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-800 active:scale-90 transition-all border border-white/5"
          aria-label="Sluiten"
        >
          <X size={24} />
        </button>

        {/* Sluiterknop */}
        <button
          onClick={cooldown ? undefined : handleCapture}
          disabled={!cameraReady || cooldown}
          className="relative group outline-none"
          aria-label="Scan pakket"
        >
          <div className="absolute inset-[-12px] rounded-full blur-2xl bg-blue-600/20 group-active:scale-150 transition-all duration-300" />
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10 border-[10px] border-slate-950 ${
            !cameraReady || cooldown ? 'bg-slate-300 text-slate-500' : 'bg-white text-slate-900 active:scale-90'
          }`}>
            <Camera size={40} />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-[#48c2a9] uppercase tracking-widest whitespace-nowrap">
            {!cameraReady ? 'Camera starten...' : cooldown ? 'Even wachten…' : 'Klik om te scannen'}
          </div>
        </button>

        {/* Klaar — geblokkeerd zolang er nog scans in de wachtrij zitten */}
        <div className="relative">
          {pendingScans > 0 && (
            <p className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-amber-400 uppercase tracking-widest whitespace-nowrap">
              {pendingScans} bezig…
            </p>
          )}
          <button
            onClick={canFinish ? handleClose : undefined}
            disabled={!canFinish}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
              canFinish
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/40'
                : pendingScans > 0
                  ? 'bg-slate-800 text-amber-300 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            aria-label={pendingScans > 0 ? `Wachten op ${pendingScans} scan(s)` : 'Klaar'}
          >
            {pendingScans > 0
              ? <Loader2 size={20} className="animate-spin" />
              : <Check size={20} />}
          </button>
        </div>
      </div>

    </div>
  );
};

export default Scanner;
