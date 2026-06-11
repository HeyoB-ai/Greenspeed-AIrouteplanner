// Gesynthetiseerde feedback-tonen + trilsignaal. Geen audiobestanden nodig.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.2): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function playSuccess(): void {
  unlockAudio();
  tone(660, 0, 0.12, 'sine', 0.2);
  tone(880, 0.1, 0.16, 'sine', 0.2);
}

export function playError(): void {
  unlockAudio();
  tone(200, 0, 0.18, 'square', 0.25);
  tone(160, 0.22, 0.3, 'square', 0.25);
}

export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { (navigator as any).vibrate(pattern); } catch { /* no-op */ }
  }
}
