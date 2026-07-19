import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let audioCtx: AudioContext | null = null;
let lastPlayTime = 0;

export const playSendSound = () => {
  try {
    const now = Date.now();
    // Debounce to prevent multiple overlapping sounds if sending very fast
    if (now - lastPlayTime < 150) return;
    lastPlayTime = now;

    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const t = audioCtx.currentTime;

    // Layer 1: Main body (Sine wave for smooth, warm, and audible tone)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(750, t); // Mid frequency, pleasant to the ear
    
    gain1.gain.setValueAtTime(0, t);
    // Strong attack to make it clearly audible (around 80-90% volume feel)
    gain1.gain.linearRampToValueAtTime(0.8, t + 0.002);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    // Layer 2: The "Tick" transient (Triangle wave for crispness and mobile speaker clarity)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, t);
    // Subtle, fast pitch drop gives the percussive "tick" character instead of a "beep"
    osc2.frequency.exponentialRampToValueAtTime(400, t + 0.02);
    
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.5, t + 0.001); // Instant attack
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04); // Fast decay

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    // Play both
    osc1.start(t);
    osc2.start(t);
    
    // Clean stop to prevent artifacts
    osc1.stop(t + 0.08);
    osc2.stop(t + 0.05);
  } catch (e) {
    // Silently ignore audio errors
  }
};
