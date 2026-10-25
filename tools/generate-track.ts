import * as fs from 'fs';
import * as path from 'path';

/**
 * Slime Mold Procedural Soundtrack Generator
 * Composes and synthesizes an authentic 16-bar looping theme: "Pulse & Creep"
 * Format: 44.1kHz 16-bit stereo PCM WAV
 */

const SAMPLE_RATE = 44100;
const BPM = 72;
const BEAT_SEC = 60 / BPM;
const BAR_SEC = BEAT_SEC * 4;
const TOTAL_BARS = 16;
const TOTAL_SEC = TOTAL_BARS * BAR_SEC;
const TOTAL_SAMPLES = Math.floor(TOTAL_SEC * SAMPLE_RATE);

console.log(`Generating Slime Mold soundtrack...`);
console.log(`Tempo: ${BPM} BPM | Length: ${TOTAL_BARS} bars (${TOTAL_SEC.toFixed(2)}s) | Samples: ${TOTAL_SAMPLES}`);

// Buffers for stereo output (floating point -1.0 to 1.0)
const leftChannel = new Float32Array(TOTAL_SAMPLES);
const rightChannel = new Float32Array(TOTAL_SAMPLES);

// Note frequencies (Hz) in D Minor Pentatonic / Dorian
const D1 = 36.71, F1 = 43.65, G1 = 49.00, A1 = 55.00, C2 = 65.41;
const D2 = 73.42, F2 = 87.31, G2 = 98.00, A2 = 110.00, C3 = 130.81;
const D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00, A3 = 220.00, C4 = 261.63;
const D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, C5 = 523.25;
const D5 = 587.33;

// Fast deterministic RNG
let randSeed = 0x5113e;
function rand(): number {
  randSeed = (randSeed * 1664525 + 1013904223) >>> 0;
  return randSeed / 4294967296;
}

// ----------------------------------------------------------------------
// 1. Primordial Biomass Drone (Continuous Organic Bed)
// ----------------------------------------------------------------------
console.log('Rendering Layer 1: Primordial Biomass Drone...');
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  // Slow breathing LFOs
  const lfo1 = Math.sin(2 * Math.PI * 0.08 * t);
  const lfo2 = Math.cos(2 * Math.PI * 0.05 * t);
  const lfo3 = Math.sin(2 * Math.PI * 0.13 * t);

  // Detuned foundation (D2 fundamental + sub D1 + fifth A2)
  const osc1 = Math.sin(2 * Math.PI * D2 * t);
  const osc2 = Math.sin(2 * Math.PI * (D2 * 1.006) * t); // subtle detune
  const osc3 = 0.5 * Math.sin(2 * Math.PI * D1 * t);      // sub weight
  const osc4 = 0.4 * Math.sin(2 * Math.PI * A2 * t);      // warm 5th
  // Soft harmonic texture (triangle/saw emulation)
  const saw1 = 0.25 * ((2 * ((D2 * 2 * t) % 1)) - 1);

  const raw = (osc1 + osc2 + osc3 + osc4 + saw1) * 0.18;
  // Dynamic breathing swell across the 16 bars
  const swell = 0.75 + 0.25 * lfo1;

  // Stereo spread
  leftChannel[i] = (leftChannel[i] ?? 0) + raw * swell * (0.8 + 0.2 * lfo2);
  rightChannel[i] = (rightChannel[i] ?? 0) + raw * swell * (0.8 - 0.2 * lfo2);
}

// ----------------------------------------------------------------------
// 2. Cytoplasmic Pulse Bass (Heartbeat of the Veins)
// ----------------------------------------------------------------------
console.log('Rendering Layer 2: Cytoplasmic Pulse Bass...');
// Rhythmic bass pattern: kicks on 1, syncopated 16th hits
interface BassNote {
  bar: number;
  beat: number; // 0..3.75
  freq: number;
  dur: number;
  gain: number;
}

const bassProgression: BassNote[] = [];
for (let b = 0; b < TOTAL_BARS; b++) {
  // Harmonic root progression:
  // Bars 1-4: D min (D1)
  // Bars 5-8: D min -> F -> G -> D
  // Bars 9-12: Bb / G -> A -> D (tension)
  // Bars 13-16: D -> F -> G -> A -> resolution
  let root = D1;
  let fifth = A1;
  if (b % 4 === 1) { root = F1; fifth = C2; }
  else if (b % 4 === 2) { root = G1; fifth = D2; }
  else if (b % 4 === 3) { root = (b >= 8 ? A1 : D1); fifth = (b >= 8 ? E3 : A1); }

  // Pattern hits
  bassProgression.push({ bar: b, beat: 0.0, freq: root, dur: 0.7, gain: 0.8 });
  bassProgression.push({ bar: b, beat: 1.5, freq: root, dur: 0.4, gain: 0.6 });
  bassProgression.push({ bar: b, beat: 2.0, freq: root, dur: 0.5, gain: 0.75 });
  bassProgression.push({ bar: b, beat: 3.25, freq: fifth, dur: 0.35, gain: 0.65 });
  if (b >= 4) {
    bassProgression.push({ bar: b, beat: 0.75, freq: root, dur: 0.3, gain: 0.5 });
    bassProgression.push({ bar: b, beat: 2.75, freq: root, dur: 0.3, gain: 0.55 });
  }
}

for (const note of bassProgression) {
  const startTime = (note.bar * 4 + note.beat) * BEAT_SEC;
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const durSamples = Math.floor(note.dur * SAMPLE_RATE);

  for (let s = 0; s < durSamples; s++) {
    const idx = (startSample + s) % TOTAL_SAMPLES;
    const t = s / SAMPLE_RATE;
    const progress = s / durSamples;

    // Fast pitch drop on attack for punchy squelch
    const pitchEnv = Math.exp(-progress * 18);
    const instFreq = note.freq * (1 + 0.8 * pitchEnv);

    // Amplitude envelope: quick attack, punchy sustain, gentle exponential decay
    const ampEnv = Math.sin(Math.min(1, progress * 10) * (Math.PI / 2)) * Math.pow(1 - progress, 1.8);

    // Warm saturated wave: fundamental + 2nd harmonic + soft overdrive
    const fund = Math.sin(2 * Math.PI * instFreq * t);
    const h2 = 0.4 * Math.sin(4 * Math.PI * instFreq * t);
    const drive = Math.tanh((fund + h2) * 1.5) * note.gain * ampEnv * 0.32;

    leftChannel[idx] = (leftChannel[idx] ?? 0) + drive * 0.95;
    rightChannel[idx] = (rightChannel[idx] ?? 0) + drive * 0.95;
  }
}

// ----------------------------------------------------------------------
// 3. Spore & Squelch Organic Percussion
// ----------------------------------------------------------------------
console.log('Rendering Layer 3: Organic Percussion & Spore Drops...');

function addSquelch(timeSec: number, pan: number, brightness: number, volume: number): void {
  const start = Math.floor(timeSec * SAMPLE_RATE);
  const dur = Math.floor(0.12 * SAMPLE_RATE);
  for (let s = 0; s < dur; s++) {
    const idx = (start + s) % TOTAL_SAMPLES;
    const p = s / dur;
    // Resonant sweep
    const sweepFreq = 800 * brightness * Math.exp(-p * 12) + 90;
    const env = (1 - p) * Math.exp(-p * 8);
    const tone = Math.sin(2 * Math.PI * sweepFreq * (s / SAMPLE_RATE));
    const noise = (rand() * 2 - 1) * Math.exp(-p * 15) * 0.4;
    const sample = (tone + noise) * volume * env * 0.22;
    leftChannel[idx] = (leftChannel[idx] ?? 0) + sample * (1 - pan);
    rightChannel[idx] = (rightChannel[idx] ?? 0) + sample * pan;
  }
}

function addSporeClick(timeSec: number, pan: number, pitch: number, volume: number): void {
  const start = Math.floor(timeSec * SAMPLE_RATE);
  const dur = Math.floor(0.045 * SAMPLE_RATE);
  for (let s = 0; s < dur; s++) {
    const idx = (start + s) % TOTAL_SAMPLES;
    const p = s / dur;
    const tone = Math.sin(2 * Math.PI * pitch * (s / SAMPLE_RATE));
    const click = (rand() * 2 - 1) * 0.5;
    const sample = (tone * 0.7 + click * 0.3) * (1 - p) * Math.exp(-p * 10) * volume * 0.18;
    leftChannel[idx] = (leftChannel[idx] ?? 0) + sample * (1 - pan);
    rightChannel[idx] = (rightChannel[idx] ?? 0) + sample * pan;
  }
}

function addDeepThump(timeSec: number): void {
  const start = Math.floor(timeSec * SAMPLE_RATE);
  const dur = Math.floor(0.35 * SAMPLE_RATE);
  for (let s = 0; s < dur; s++) {
    const idx = (start + s) % TOTAL_SAMPLES;
    const p = s / dur;
    const freq = 120 * Math.exp(-p * 14) + 40;
    const env = Math.exp(-p * 7);
    const sample = Math.sin(2 * Math.PI * freq * (s / SAMPLE_RATE)) * env * 0.38;
    leftChannel[idx] = (leftChannel[idx] ?? 0) + sample;
    rightChannel[idx] = (rightChannel[idx] ?? 0) + sample;
  }
}

for (let b = 0; b < TOTAL_BARS; b++) {
  const barTime = b * BAR_SEC;
  // Beat 0: Deep nutrient thump
  addDeepThump(barTime);
  if (b >= 4) {
    addDeepThump(barTime + 2 * BEAT_SEC);
  }

  // Squelch snare / pop on beat 1 and 3
  addSquelch(barTime + 1 * BEAT_SEC, 0.4, 1.2, 0.85);
  addSquelch(barTime + 3 * BEAT_SEC, 0.6, 0.9, 0.75);

  // 16th note spore chatter / clicks
  for (let step = 0; step < 16; step++) {
    const t = barTime + step * (BEAT_SEC / 4);
    if (step % 4 !== 0 && rand() > 0.35) {
      const clickPitch = 1200 + rand() * 800;
      addSporeClick(t, rand(), clickPitch, 0.4 + rand() * 0.4);
    }
  }
}

// ----------------------------------------------------------------------
// 4. Mycelium Plucks & Melodic Motif (Cel-Shaded Exploration)
// ----------------------------------------------------------------------
console.log('Rendering Layer 4: Mycelium Plucks & Cel-Shaded Melody...');

interface MelodyNote {
  bar: number;
  beat: number;
  freq: number;
  dur: number;
  vel: number;
}

// 4-bar melodic motif that develops across the track
const melodyNotes: MelodyNote[] = [
  // Motif phrase 1 (Bars 1-4: Curiosity)
  { bar: 0, beat: 0.5, freq: D3, dur: 1.2, vel: 0.7 },
  { bar: 0, beat: 1.5, freq: A3, dur: 0.9, vel: 0.75 },
  { bar: 0, beat: 2.5, freq: C4, dur: 0.8, vel: 0.8 },
  { bar: 1, beat: 0.0, freq: D4, dur: 1.4, vel: 0.85 },
  { bar: 1, beat: 2.0, freq: C4, dur: 0.7, vel: 0.7 },
  { bar: 1, beat: 3.0, freq: A3, dur: 1.0, vel: 0.65 },
  { bar: 2, beat: 1.0, freq: F3, dur: 1.2, vel: 0.75 },
  { bar: 2, beat: 2.5, freq: G3, dur: 0.8, vel: 0.8 },
  { bar: 3, beat: 0.0, freq: A3, dur: 2.2, vel: 0.9 },

  // Phrase 2 (Bars 5-8: Expansion & Confidence)
  { bar: 4, beat: 0.5, freq: D4, dur: 1.0, vel: 0.8 },
  { bar: 4, beat: 1.5, freq: F4, dur: 0.9, vel: 0.85 },
  { bar: 4, beat: 2.5, freq: E4, dur: 0.7, vel: 0.75 },
  { bar: 5, beat: 0.0, freq: D4, dur: 1.5, vel: 0.85 },
  { bar: 5, beat: 2.0, freq: C4, dur: 0.8, vel: 0.8 },
  { bar: 5, beat: 3.0, freq: A3, dur: 1.0, vel: 0.75 },
  { bar: 6, beat: 0.5, freq: G3, dur: 0.8, vel: 0.7 },
  { bar: 6, beat: 1.5, freq: A3, dur: 0.8, vel: 0.8 },
  { bar: 6, beat: 2.5, freq: C4, dur: 1.0, vel: 0.85 },
  { bar: 7, beat: 0.0, freq: D4, dur: 2.5, vel: 0.95 },

  // Phrase 3 (Bars 9-12: The Rival Encounter - Higher Tension)
  { bar: 8, beat: 0.0, freq: D4, dur: 0.8, vel: 0.85 },
  { bar: 8, beat: 1.0, freq: F4, dur: 0.8, vel: 0.9 },
  { bar: 8, beat: 2.0, freq: A4, dur: 1.2, vel: 0.95 },
  { bar: 9, beat: 0.0, freq: C5, dur: 1.4, vel: 0.9 },
  { bar: 9, beat: 2.0, freq: A4, dur: 0.9, vel: 0.85 },
  { bar: 9, beat: 3.0, freq: G4, dur: 0.8, vel: 0.8 },
  { bar: 10, beat: 0.5, freq: F4, dur: 1.0, vel: 0.8 },
  { bar: 10, beat: 2.0, freq: D4, dur: 0.9, vel: 0.85 },
  { bar: 10, beat: 3.0, freq: F4, dur: 0.7, vel: 0.8 },
  { bar: 11, beat: 0.0, freq: E4, dur: 2.0, vel: 0.85 },

  // Phrase 4 (Bars 13-16: Grand Network & Returning to Dormancy)
  { bar: 12, beat: 0.5, freq: A4, dur: 1.0, vel: 0.9 },
  { bar: 12, beat: 2.0, freq: F4, dur: 0.9, vel: 0.85 },
  { bar: 12, beat: 3.0, freq: D4, dur: 0.9, vel: 0.8 },
  { bar: 13, beat: 0.0, freq: C4, dur: 1.2, vel: 0.8 },
  { bar: 13, beat: 1.5, freq: D4, dur: 1.5, vel: 0.85 },
  { bar: 14, beat: 0.0, freq: F3, dur: 1.0, vel: 0.75 },
  { bar: 14, beat: 1.5, freq: G3, dur: 1.0, vel: 0.75 },
  { bar: 14, beat: 3.0, freq: A3, dur: 1.2, vel: 0.8 },
  { bar: 15, beat: 0.0, freq: D3, dur: 3.2, vel: 0.85 },
];

// Synth plucks with FM bell harmonics and ping-pong delay
const delaySamples = Math.floor(BEAT_SEC * 0.75 * SAMPLE_RATE); // dotted 8th note delay
const delayLeft = new Float32Array(TOTAL_SAMPLES);
const delayRight = new Float32Array(TOTAL_SAMPLES);

for (const m of melodyNotes) {
  const startTime = (m.bar * 4 + m.beat) * BEAT_SEC;
  const startSample = Math.floor(startTime * SAMPLE_RATE);
  const durSamples = Math.floor(m.dur * SAMPLE_RATE);

  for (let s = 0; s < durSamples; s++) {
    const idx = (startSample + s) % TOTAL_SAMPLES;
    const t = s / SAMPLE_RATE;
    const progress = s / durSamples;

    // Organic pluck envelope (instant attack, resonant tail)
    const env = Math.exp(-progress * 4.5);

    // FM timbre: Carrier = freq, Modulator = freq * 2.003
    const mod = 0.5 * Math.sin(2 * Math.PI * (m.freq * 2.003) * t) * Math.exp(-progress * 8);
    const carrier = Math.sin(2 * Math.PI * m.freq * t + mod);
    const subWarmth = 0.3 * Math.sin(2 * Math.PI * (m.freq * 0.5) * t);

    const drySample = (carrier + subWarmth) * env * m.vel * 0.24;

    // Panning based on pitch
    const pan = 0.3 + 0.4 * ((m.freq - D3) / (D5 - D3));
    leftChannel[idx] = (leftChannel[idx] ?? 0) + drySample * (1 - pan);
    rightChannel[idx] = (rightChannel[idx] ?? 0) + drySample * pan;

    // Feed delay lines
    delayLeft[idx] = (delayLeft[idx] ?? 0) + drySample * 0.6;
    delayRight[idx] = (delayRight[idx] ?? 0) + drySample * 0.6;
  }
}

// Render Stereo Ping-Pong Delay with seamless wrap-around loop
console.log('Rendering Ping-Pong Delay & Spatialization...');
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const prevIdx = (i - delaySamples + TOTAL_SAMPLES) % TOTAL_SAMPLES;
  // Left delay feeds from right previous; Right delay feeds from left previous
  const echoL = (delayRight[prevIdx] ?? 0) * 0.42;
  const echoR = (delayLeft[prevIdx] ?? 0) * 0.42;

  leftChannel[i] = (leftChannel[i] ?? 0) + echoL;
  rightChannel[i] = (rightChannel[i] ?? 0) + echoR;

  // Feedback into delay buffer for second echo
  delayLeft[i] = (delayLeft[i] ?? 0) + echoL * 0.3;
  delayRight[i] = (delayRight[i] ?? 0) + echoR * 0.3;
}

// ----------------------------------------------------------------------
// 5. Final Mastering: Soft-Clipping Limiter & Normalization
// ----------------------------------------------------------------------
console.log('Mastering audio and compiling 16-bit PCM WAV...');
let peak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Gentle soft clipper / saturation: tanh
  const l = Math.tanh((leftChannel[i] ?? 0) * 1.15);
  const r = Math.tanh((rightChannel[i] ?? 0) * 1.15);
  leftChannel[i] = l;
  rightChannel[i] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}

console.log(`Peak amplitude before normalize: ${peak.toFixed(3)}`);
const norm = peak > 0 ? 0.94 / peak : 1;

// Construct WAV buffer
const numChannels = 2;
const bytesPerSample = 2;
const blockAlign = numChannels * bytesPerSample;
const byteRate = SAMPLE_RATE * blockAlign;
const dataSize = TOTAL_SAMPLES * blockAlign;
const headerSize = 44;
const totalBufferSize = headerSize + dataSize;

const wavBuffer = Buffer.alloc(totalBufferSize);

// RIFF chunk descriptor
wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(totalBufferSize - 8, 4);
wavBuffer.write('WAVE', 8);

// "fmt " sub-chunk
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16);          // Subchunk1Size (16 for PCM)
wavBuffer.writeUInt16LE(1, 20);           // AudioFormat (1 = PCM)
wavBuffer.writeUInt16LE(numChannels, 22); // NumChannels (2)
wavBuffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
wavBuffer.writeUInt32LE(byteRate, 28);    // ByteRate
wavBuffer.writeUInt16LE(blockAlign, 32);  // BlockAlign
wavBuffer.writeUInt16LE(16, 34);          // BitsPerSample

// "data" sub-chunk
wavBuffer.write('data', 36);
wavBuffer.writeUInt32LE(dataSize, 40);

// Write interleaved 16-bit PCM samples
let offset = 44;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const l = Math.max(-1, Math.min(1, (leftChannel[i] ?? 0) * norm));
  const r = Math.max(-1, Math.min(1, (rightChannel[i] ?? 0) * norm));

  const sampleL = l < 0 ? l * 32768 : l * 32767;
  const sampleR = r < 0 ? r * 32768 : r * 32767;

  wavBuffer.writeInt16LE(Math.round(sampleL), offset);
  wavBuffer.writeInt16LE(Math.round(sampleR), offset + 2);
  offset += 4;
}

// Save outputs
const outPublicDir = path.resolve('public', 'music');
if (!fs.existsSync(outPublicDir)) {
  fs.mkdirSync(outPublicDir, { recursive: true });
}
const publicTrackPath = path.join(outPublicDir, 'slime_mold_theme.wav');
fs.writeFileSync(publicTrackPath, wavBuffer);
console.log(`Saved public game track to: ${publicTrackPath} (${(wavBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

// Also save to artifact directory
const artifactDir = 'C:\\Users\\cyber\\.gemini\\antigravity\\brain\\947d36ab-bfd8-4b77-af88-720be720ddb8';
if (fs.existsSync(artifactDir)) {
  const artifactTrackPath = path.join(artifactDir, 'slime_mold_theme.wav');
  fs.writeFileSync(artifactTrackPath, wavBuffer);
  console.log(`Saved artifact copy to: ${artifactTrackPath}`);
}

console.log('Soundtrack generation completed successfully!');
