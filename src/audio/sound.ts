/**
 * All sound is synthesised: little effects for every tool and pickup, a babbling voice per
 * speaker (a pitched blip for each syllable), and a different tune for every hour of the day
 * — a seeded chord progression, bass, and a melody on a mallet voice, gentle at night and
 * bouncy at noon. Rain adds a noise bed.
 */
import { rng } from "../core/noise";

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let started = false;

export const audio = {
  music: 0.5,
  sfx: 0.8,
};

function init(): boolean {
  if (ctx) return true;
  try {
    ctx = new AudioContext();
  } catch {
    return false;
  }
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  musicBus = ctx.createGain();
  musicBus.gain.value = audio.music * 0.35;
  musicBus.connect(master);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = audio.sfx * 0.6;
  sfxBus.connect(master);
  return true;
}

/** Call from a user gesture. */
export function unlock(): void {
  if (!init()) return;
  if (ctx!.state === "suspended") void ctx!.resume();
  started = true;
}

export function setVolumes(music: number, sfx: number): void {
  audio.music = music;
  audio.sfx = sfx;
  if (!ctx) return;
  musicBus.gain.value = music * 0.35;
  sfxBus.gain.value = sfx * 0.6;
}

function tone(freq: number, t: number, dur: number, o: { type?: OscillatorType; gain?: number; bus?: GainNode; slide?: number; attack?: number } = {}): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * o.slide), t + dur);
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(o.bus ?? sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(t: number, dur: number, o: { freq?: number; q?: number; gain?: number; type?: BiquadFilterType } = {}): void {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.frequency.value = o.freq ?? 1200;
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

export function sfx(name: string): void {
  if (!started || !ctx) return;
  const t = ctx.currentTime;
  switch (name) {
    case "step":
      noise(t, 0.05, { freq: 900, q: 0.8, gain: 0.05 });
      break;
    case "dig":
      noise(t, 0.18, { freq: 500, q: 0.7, gain: 0.35 });
      noise(t + 0.08, 0.12, { freq: 300, gain: 0.25 });
      break;
    case "fill":
      noise(t, 0.25, { freq: 350, gain: 0.3 });
      break;
    case "chop":
      tone(180, t, 0.12, { type: "square", gain: 0.12, slide: 0.6 });
      noise(t, 0.08, { freq: 2200, gain: 0.25 });
      break;
    case "fell":
      noise(t, 0.6, { freq: 400, gain: 0.35 });
      tone(90, t + 0.1, 0.4, { type: "triangle", gain: 0.3, slide: 0.5 });
      break;
    case "rockhit":
      tone(900, t, 0.1, { type: "square", gain: 0.08, slide: 0.7 });
      noise(t, 0.06, { freq: 3500, q: 3, gain: 0.25 });
      break;
    case "rockbreak":
      noise(t, 0.5, { freq: 700, gain: 0.45 });
      break;
    case "shake":
      for (let k = 0; k < 5; k++) noise(t + k * 0.07, 0.1, { freq: 2600 + k * 200, q: 0.6, gain: 0.12 });
      break;
    case "pick":
      tone(880, t, 0.08, { type: "triangle", gain: 0.2 });
      tone(1320, t + 0.06, 0.12, { type: "triangle", gain: 0.18 });
      break;
    case "drop":
      tone(520, t, 0.08, { type: "triangle", gain: 0.18, slide: 0.7 });
      break;
    case "plant":
      tone(660, t, 0.1, { type: "triangle", gain: 0.2 });
      noise(t, 0.12, { freq: 500, gain: 0.15 });
      break;
    case "water":
    case "splash":
      noise(t, 0.35, { freq: 1600, q: 0.5, gain: 0.25 });
      break;
    case "swing":
      noise(t, 0.16, { freq: 1800, q: 2, gain: 0.2, type: "bandpass" });
      break;
    case "cast":
      noise(t, 0.3, { freq: 2500, q: 3, gain: 0.15 });
      tone(700, t + 0.35, 0.1, { gain: 0.1 });
      break;
    case "bite":
      noise(t, 0.2, { freq: 1200, q: 1, gain: 0.4 });
      break;
    case "catch":
    case "fanfare": {
      const n = [523, 659, 784, 1047];
      n.forEach((f, k) => tone(f, t + k * 0.09, 0.35, { type: "triangle", gain: 0.2 }));
      tone(1568, t + 0.4, 0.5, { type: "sine", gain: 0.12 });
      break;
    }
    case "coin":
      tone(1318, t, 0.08, { type: "square", gain: 0.06 });
      tone(1760, t + 0.07, 0.25, { type: "square", gain: 0.06 });
      break;
    case "menu":
      tone(1046, t, 0.05, { type: "triangle", gain: 0.1 });
      break;
    case "open":
      tone(660, t, 0.08, { type: "triangle", gain: 0.12 });
      tone(990, t + 0.07, 0.12, { type: "triangle", gain: 0.12 });
      break;
    case "door":
      tone(300, t, 0.15, { type: "triangle", gain: 0.12, slide: 1.5 });
      noise(t + 0.1, 0.1, { freq: 800, gain: 0.1 });
      break;
    case "fail":
      tone(300, t, 0.18, { type: "triangle", gain: 0.15, slide: 0.7 });
      break;
    case "wasp":
      for (let k = 0; k < 12; k++) tone(220 + Math.random() * 40, t + k * 0.05, 0.06, { type: "sawtooth", gain: 0.04 });
      break;
    case "joy":
      [784, 988, 1175].forEach((f, k) => tone(f, t + k * 0.07, 0.2, { type: "triangle", gain: 0.15 }));
      break;
  }
}

/** One babble syllable in a speaker's voice. */
export function voice(ch: string, pitch = 1): void {
  if (!started || !ctx) return;
  const t = ctx.currentTime;
  const code = ch.charCodeAt(0);
  // Vowel of a Hangul syllable picks the formant; everything else hashes.
  const v = code >= 0xac00 && code <= 0xd7a3 ? Math.floor(((code - 0xac00) % 588) / 28) : code % 21;
  const base = 240 * pitch * (1 + (v % 7) * 0.06);
  tone(base, t, 0.07, { type: "triangle", gain: 0.12, slide: 1.12 });
  tone(base * 2.02, t, 0.05, { type: "sine", gain: 0.04 });
}

// ---------------------------------------------------------------- music

const SCALE = [0, 2, 4, 5, 7, 9, 11];
let nextBar = 0;
let bar = 0;
let tuneHour = -1;
let tune: { key: number; bpm: number; chords: number[]; motif: number[]; wave: OscillatorType; swing: number; night: boolean } | null = null;
let rainGain: GainNode | null = null;

function makeTune(hour: number, seed: number): NonNullable<typeof tune> {
  const R = rng(seed * 31 + hour * 977);
  const night = hour < 5 || hour >= 20;
  const noonish = hour >= 10 && hour <= 16;
  const progs = [
    [0, 5, 3, 4],
    [0, 3, 4, 0],
    [0, 4, 5, 3],
    [5, 3, 0, 4],
    [0, 2, 3, 4],
    [3, 4, 2, 5],
  ];
  const motif: number[] = [];
  for (let k = 0; k < 16; k++) motif.push(R() < (night ? 0.45 : 0.3) ? -99 : Math.floor(R() * 8) - 1);
  return {
    key: [0, 2, 5, 7, 9, -3, 3][Math.floor(R() * 7)],
    bpm: night ? 70 + R() * 12 : noonish ? 104 + R() * 16 : 88 + R() * 14,
    chords: progs[Math.floor(R() * progs.length)],
    motif,
    wave: night ? "sine" : R() < 0.5 ? "triangle" : "sine",
    swing: R() < 0.5 ? 0.12 : 0,
    night,
  };
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Keep the hour's tune playing (call every frame). */
export function music(hour: number, seed: number, rain: boolean, inside: boolean): void {
  if (!started || !ctx) return;
  const h = Math.floor(hour);
  if (h !== tuneHour) {
    tuneHour = h;
    tune = makeTune(h, seed);
    bar = 0;
  }
  // Rain bed.
  if (rain && !rainGain) {
    const s = ctx.createBufferSource();
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    s.buffer = b;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1800;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.09;
    s.connect(f);
    f.connect(rainGain);
    rainGain.connect(master);
    s.start();
  }
  if (rainGain) rainGain.gain.value = rain ? (inside ? 0.03 : 0.09) : 0;
  const T = tune!;
  const beat = 60 / T.bpm;
  const now = ctx.currentTime;
  if (nextBar < now) nextBar = now + 0.1;
  // Schedule one bar ahead.
  while (nextBar < now + 0.6) {
    const t0 = nextBar;
    const chord = T.chords[bar % 4];
    const root = 48 + T.key + SCALE[chord % 7];
    const vol = inside ? 0.6 : 1;
    // Bass on beats 1 and 3.
    for (const b of [0, 2]) tone(midi(root - 12 + (b === 2 ? 7 : 0)), t0 + b * beat, beat * 0.9, { type: "triangle", gain: 0.22 * vol, bus: musicBus, attack: 0.01 });
    // Chord pad / offbeat stabs.
    const triad = [0, 2, 4].map((k) => 60 + T.key + SCALE[(chord + k) % 7] + ((chord + k) >= 7 ? 12 : 0));
    for (let b = 0; b < 4; b++) {
      const on = T.night ? b === 0 : b % 2 === 1;
      if (!on) continue;
      for (const n of triad) tone(midi(n), t0 + b * beat, T.night ? beat * 3.5 : beat * 0.35, { type: "sine", gain: (T.night ? 0.05 : 0.06) * vol, bus: musicBus, attack: T.night ? 0.3 : 0.005 });
    }
    // Melody: the motif walks the scale over the chord; the second half of the loop varies it.
    for (let s = 0; s < 4; s++) {
      const m = T.motif[(bar % 4) * 4 + s];
      if (m === -99) continue;
      const deg = chord + m + (bar % 8 >= 4 && s === 3 ? 2 : 0);
      const n = 72 + T.key + SCALE[((deg % 7) + 7) % 7] + Math.floor(deg / 7) * 12;
      const sw = s % 2 ? T.swing * beat : 0;
      tone(midi(n), t0 + s * beat + sw, beat * (T.night ? 1.4 : 0.55), { type: T.wave, gain: 0.1 * vol, bus: musicBus });
      if (!T.night) tone(midi(n + 12), t0 + s * beat + sw, beat * 0.2, { type: "sine", gain: 0.025 * vol, bus: musicBus });
    }
    nextBar += beat * 4;
    bar++;
  }
}
