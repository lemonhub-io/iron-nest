/* Copyright (c) 2026 lemonhub-io; SPDX-License-Identifier: AGPL-3.0-or-later */

type NoiseColor = "white" | "pink" | "brown";

interface NoiseOptions {
  duration: number;
  gain: number;
  color?: NoiseColor;
  filter?: BiquadFilterType;
  cutoff?: number;
  q?: number;
  attack?: number;
  when?: number;
}

interface ToneOptions {
  frequency: number;
  duration: number;
  gain: number;
  wave?: OscillatorType;
  endFrequency?: number;
  filter?: BiquadFilterType;
  cutoff?: number;
  attack?: number;
  when?: number;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    master.gain.value = 0.72;
    compressor.threshold.value = -18;
    compressor.knee.value = 16;
    compressor.ratio.value = 9;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;
    master.connect(compressor).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function out(): GainNode {
  ac();
  return master!;
}

function noiseBuffer(c: AudioContext, duration: number, color: NoiseColor): AudioBuffer {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
  const samples = buffer.getChannelData(0);
  let brown = 0;
  let pink = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.035 * white) / 1.035;
    pink = pink * 0.985 + white * 0.15;
    samples[index] = color === "brown" ? brown * 3.5 : color === "pink" ? pink : white;
  }
  return buffer;
}

function shape(gain: GainNode, when: number, peak: number, duration: number, attack: number): void {
  const rise = Math.max(0.002, attack);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + rise);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
}

function noise({
  duration,
  gain,
  color = "white",
  filter = "lowpass",
  cutoff = 1200,
  q = 0.8,
  attack = 0.004,
  when = 0,
}: NoiseOptions): void {
  const c = ac();
  const at = c.currentTime + when;
  const source = c.createBufferSource();
  const tone = c.createBiquadFilter();
  const envelope = c.createGain();
  source.buffer = noiseBuffer(c, duration, color);
  tone.type = filter;
  tone.frequency.value = cutoff;
  tone.Q.value = q;
  shape(envelope, at, gain, duration, attack);
  source.connect(tone).connect(envelope).connect(out());
  source.start(at);
}

function tone({
  frequency,
  duration,
  gain,
  wave = "sine",
  endFrequency,
  filter,
  cutoff = 1500,
  attack = 0.003,
  when = 0,
}: ToneOptions): void {
  const c = ac();
  const at = c.currentTime + when;
  const oscillator = c.createOscillator();
  const envelope = c.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (endFrequency != null) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + duration);
  }
  shape(envelope, at, gain, duration, attack);
  if (filter) {
    const toneFilter = c.createBiquadFilter();
    toneFilter.type = filter;
    toneFilter.frequency.value = cutoff;
    oscillator.connect(toneFilter).connect(envelope).connect(out());
  } else {
    oscillator.connect(envelope).connect(out());
  }
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

function metalClick(when = 0, gain = 0.035): void {
  tone({
    frequency: 230,
    endFrequency: 118,
    duration: 0.07,
    gain,
    wave: "triangle",
    filter: "bandpass",
    cutoff: 780,
    when,
  });
  tone({ frequency: 1460, endFrequency: 760, duration: 0.035, gain: gain * 0.34, wave: "sine", when });
}

function thud(when = 0, gain = 0.08): void {
  tone({ frequency: 118, endFrequency: 47, duration: 0.16, gain, wave: "sine", when, attack: 0.002 });
  noise({ duration: 0.09, gain: gain * 0.48, color: "brown", filter: "lowpass", cutoff: 420, when });
}

export const sfx = {
  unlock: () => ac(),
  tick: () => {
    const note = 680 + Math.random() * 70;
    tone({ frequency: note, endFrequency: note * 0.73, duration: 0.045, gain: 0.018, wave: "triangle" });
    noise({ duration: 0.022, gain: 0.008, filter: "highpass", cutoff: 1800, attack: 0.001 });
  },
  hover: () => tone({ frequency: 500 + Math.random() * 35, duration: 0.028, gain: 0.007, wave: "sine" }),
  deny: () => {
    tone({ frequency: 150, endFrequency: 82, duration: 0.14, gain: 0.042, wave: "triangle" });
    tone({ frequency: 104, endFrequency: 68, duration: 0.17, gain: 0.025, wave: "sine", when: 0.045 });
  },
  pencil: () => noise({ duration: 0.12, gain: 0.026, color: "pink", filter: "bandpass", cutoff: 2100, q: 1.7 }),
  scratch: () => noise({ duration: 0.052, gain: 0.012, color: "pink", filter: "bandpass", cutoff: 1850, q: 1.4 }),
  stamp: () => {
    thud(0, 0.055);
    metalClick(0.018, 0.018);
    noise({ duration: 0.09, gain: 0.019, color: "pink", filter: "highpass", cutoff: 780, when: 0.008 });
  },
  clunk: () => {
    thud(0, 0.052);
    metalClick(0.012, 0.03);
  },
  whir: () => {
    const base = 72 + Math.random() * 12;
    tone({ frequency: base, endFrequency: base * 0.82, duration: 0.09, gain: 0.012, wave: "sawtooth", filter: "lowpass", cutoff: 340 });
    tone({ frequency: base * 3.8, endFrequency: base * 3.1, duration: 0.055, gain: 0.004, wave: "triangle" });
  },
  ram: () => {
    noise({ duration: 0.18, gain: 0.052, color: "brown", filter: "lowpass", cutoff: 620 });
    thud(0.02, 0.075);
    metalClick(0.028, 0.054);
    tone({ frequency: 430, endFrequency: 190, duration: 0.12, gain: 0.018, wave: "triangle", when: 0.05 });
  },
  fire: () => {
    noise({ duration: 0.1, gain: 0.1, color: "white", filter: "highpass", cutoff: 250, attack: 0.001 });
    noise({ duration: 0.78, gain: 0.145, color: "brown", filter: "lowpass", cutoff: 640, attack: 0.008 });
    noise({ duration: 0.46, gain: 0.042, color: "pink", filter: "lowpass", cutoff: 1550, when: 0.08, attack: 0.01 });
    tone({ frequency: 76, endFrequency: 28, duration: 0.72, gain: 0.14, wave: "sine", attack: 0.002 });
    tone({ frequency: 176, endFrequency: 58, duration: 0.27, gain: 0.042, wave: "triangle" });
    metalClick(0.075, 0.043);
    thud(0.11, 0.048);
  },
  impact: () => {
    noise({ duration: 0.42, gain: 0.09, color: "brown", filter: "lowpass", cutoff: 520, attack: 0.006 });
    noise({ duration: 0.18, gain: 0.036, color: "pink", filter: "bandpass", cutoff: 1100, q: 0.7 });
    tone({ frequency: 62, endFrequency: 31, duration: 0.38, gain: 0.065, wave: "sine", attack: 0.004 });
    tone({ frequency: 240, endFrequency: 94, duration: 0.16, gain: 0.019, wave: "triangle", when: 0.025 });
  },
  arm: () => {
    metalClick(0, 0.03);
    metalClick(0.065, 0.022);
    tone({ frequency: 520, endFrequency: 740, duration: 0.085, gain: 0.012, wave: "sine", when: 0.035 });
  },
  meow: () => {
    tone({ frequency: 560, endFrequency: 360, duration: 0.25, gain: 0.035, wave: "sine", attack: 0.012 });
    tone({ frequency: 840, endFrequency: 520, duration: 0.18, gain: 0.012, wave: "triangle", when: 0.025 });
  },
};
