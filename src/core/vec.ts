// Minimal 2D vector math for the floor plane. World X maps to x, world Z maps to y.
export interface Vec2 {
  x: number;
  y: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const perp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

export function norm(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function clampLen(a: Vec2, max: number): Vec2 {
  const l = Math.hypot(a.x, a.y);
  return l > max ? { x: (a.x / l) * max, y: (a.y / l) * max } : a;
}

export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function rotate(a: Vec2, ang: number): Vec2 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Distance from point p to segment ab, plus the projection parameter t in [0,1]. */
export function pointSegment(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 1e-12 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return { d: Math.hypot(p.x - cx, p.y - cy), t };
}

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
