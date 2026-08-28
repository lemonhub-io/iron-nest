export const COLS = "ABCDEFGHIJKLMNOPQRST";
export const ROWS = 12;
export const MAP_W = COLS.length;
export const MAP_H = ROWS;

export type Km = { x: number; y: number };

export function parseGrid(col: string, row: number, sx: number, sy: number): Km {
  const c = COLS.indexOf(col.toUpperCase());
  if (c < 0) throw new Error(`bad col ${col}`);
  return { x: c + sx / 10, y: row - 1 + sy / 10 };
}

export function formatGrid(p: Km): string {
  let x = Math.min(MAP_W - 0.01, Math.max(0, p.x));
  let y = Math.min(MAP_H - 0.01, Math.max(0, p.y));
  let c = Math.floor(x);
  let r = Math.floor(y) + 1;
  let sx = Math.round((x - Math.floor(x)) * 10);
  let sy = Math.round((y - Math.floor(y)) * 10);
  if (sx >= 10) {
    sx = 0;
    c += 1;
  }
  if (sy >= 10) {
    sy = 0;
    r += 1;
  }
  c = Math.min(MAP_W - 1, c);
  r = Math.min(ROWS, r);
  return `${COLS[c]}${r} ${sx}:${sy}`;
}

/** Bearing in degrees, 0 = north, clockwise. */
export function bearingDeg(from: Km, to: Km): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function rangeKm(from: Km, to: Km): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function project(from: Km, bearing: number, range: number): Km {
  const rad = (bearing * Math.PI) / 180;
  return {
    x: from.x + Math.sin(rad) * range,
    y: from.y + Math.cos(rad) * range,
  };
}

export function angleDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path interpolate degrees, result in [0, 360). */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  let v = a + d * t;
  if (v < 0) v += 360;
  if (v >= 360) v -= 360;
  return v;
}

export function clampKm(p: Km): Km {
  return {
    x: Math.max(0, Math.min(MAP_W, p.x)),
    y: Math.max(0, Math.min(MAP_H, p.y)),
  };
}

export function dist(a: Km, b: Km): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Segment intersection. Returns null if parallel or outside both segments. */
export function intersectSeg(a1: Km, a2: Km, b1: Km, b2: Km): Km | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const det = dax * dby - day * dbx;
  if (Math.abs(det) < 1e-8) return null;
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / det;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / det;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a1.x + t * dax, y: a1.y + t * day };
}
