// Rule feedback: a short beep and desktop notifications (falls back to a toast).
import { toast } from '../core/events.js';

export let audio;
/** Browsers only allow audio after a user gesture; call once at startup. */
export function unlockAudio() {
  document.addEventListener('pointerdown', () => { try { audio = audio || new AudioContext(); audio.resume(); } catch {} });
}
export function beep() {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.15, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.26);
  } catch {}
}
export function desktopNotify(text) {
  try { if ('Notification' in window && Notification.permission === 'granted') { new Notification('UnifyWeb', { body:text }); return; } } catch {}
  toast(text);
}
