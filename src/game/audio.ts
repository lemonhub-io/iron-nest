let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(duration: number, gain: number, type: "white" | "brown" = "white"): void {
  const c = ac();
  const n = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
  const d = n.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = type === "brown" ? (last + 0.02 * w) / 1.02 : w;
    d[i] = last;
  }
  const src = c.createBufferSource();
  src.buffer = n;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  src.connect(g).connect(c.destination);
  src.start();
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = "square"): void {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const sfx = {
  unlock: () => ac(),
  tick: () => tone(180 + Math.random() * 40, 0.04, 0.03, "square"),
  pencil: () => noise(0.12, 0.04, "brown"),
  stamp: () => {
    tone(90, 0.08, 0.06, "square");
    noise(0.08, 0.05, "white");
  },
  clunk: () => tone(70, 0.12, 0.07, "sawtooth"),
  ram: () => {
    noise(0.18, 0.08, "brown");
    tone(55, 0.16, 0.05, "square");
  },
  fire: () => {
    noise(0.55, 0.22, "white");
    tone(48, 0.4, 0.12, "sawtooth");
    tone(32, 0.5, 0.1, "sine");
  },
  impact: () => {
    noise(0.35, 0.14, "brown");
    tone(40, 0.25, 0.08, "square");
  },
  meow: () => {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(620, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(380, c.currentTime + 0.22);
    g.gain.setValueAtTime(0.05, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.28);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.3);
  },
};
