/** WebAudio micro-sounds — synthesized, no assets, toggleable, off-able. */

const STORAGE_KEY = "cw-sound";

let ctx: AudioContext | null = null;
let enabled = localStorage.getItem(STORAGE_KEY) !== "off";

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function soundEnabled(): boolean {
  return enabled;
}

export function toggleSound(): boolean {
  enabled = !enabled;
  localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  if (enabled) blip(660, 0.06, 0.04);
  return enabled;
}

function blip(
  freq: number,
  duration: number,
  gain = 0.05,
  type: OscillatorType = "square",
  when = 0,
): void {
  if (!enabled) return;
  try {
    const a = audio();
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + duration);
    osc.connect(g).connect(a.destination);
    osc.start(a.currentTime + when);
    osc.stop(a.currentTime + when + duration + 0.02);
  } catch {
    /* audio blocked — stay silent */
  }
}

export const sfx = {
  tap: () => blip(520 + Math.random() * 60, 0.045, 0.03),
  flip: (color: 0 | 1 | 2) => blip(color === 2 ? 740 : color === 1 ? 560 : 330, 0.09, 0.04, "triangle"),
  error: () => {
    blip(180, 0.12, 0.06, "sawtooth");
    blip(140, 0.14, 0.05, "sawtooth", 0.08);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, 0.06, "triangle", i * 0.11));
  },
  seal: () => {
    blip(300, 0.1, 0.05, "sine");
    blip(200, 0.18, 0.06, "sine", 0.09);
  },
};
