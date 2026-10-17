// Rendering helpers: floor-plane ↔ world mapping, interpolation, and ribbon geometry
// for drawing many polylines in a single draw call.
import * as THREE from 'three';
import { wrapAngle, type Vec2 } from '../core/vec';

/** Models are authored facing +Z; floor heading θ points along (cos θ, sin θ) in (x, z). */
export const headingToRotY = (theta: number): number => Math.PI / 2 - theta;

export const lerpAngle = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

export interface Ribbon {
  pts: Vec2[];
  width: number;
  color: THREE.Color;
  y?: number;
}

/** Writes ribbons into a (re)usable BufferGeometry with vertex colors. */
export function buildRibbons(geom: THREE.BufferGeometry, ribbons: Ribbon[]): void {
  let nQuads = 0;
  for (const r of ribbons) nQuads += Math.max(0, r.pts.length - 1);
  const pos = new Float32Array(nQuads * 4 * 3);
  const col = new Float32Array(nQuads * 4 * 3);
  const idx = new Uint32Array(nQuads * 6);
  let q = 0;
  for (const r of ribbons) {
    const y = r.y ?? 0.03;
    const hw = r.width / 2;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const L = Math.hypot(dx, dy);
      if (L < 1e-6) {
        dx = 1;
        dy = 0;
      } else {
        dx /= L;
        dy /= L;
      }
      const nx = -dy * hw;
      const ny = dx * hw;
      const o = q * 12;
      pos.set([a.x + nx, y, a.y + ny, a.x - nx, y, a.y - ny, b.x + nx, y, b.y + ny, b.x - nx, y, b.y - ny], o);
      for (let k = 0; k < 4; k++) col.set([r.color.r, r.color.g, r.color.b], o + k * 3);
      const v0 = q * 4;
      idx.set([v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2], q * 6);
      q++;
    }
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geom.setIndex(new THREE.BufferAttribute(idx, 1));
  geom.computeBoundingSphere();
}

export function circlePts(c: Vec2, r: number, n = 40): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return out;
}

/** Split a polyline into dashes. */
export function dashed(pts: Vec2[], on = 0.18, off = 0.12): Vec2[][] {
  const out: Vec2[][] = [];
  let cur: Vec2[] = [];
  let acc = 0;
  let drawing = true;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let segL = Math.hypot(b.x - a.x, b.y - a.y);
    while (segL > 1e-6) {
      const lim = (drawing ? on : off) - acc;
      const step = Math.min(lim, segL);
      const t = step / segL;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (drawing) {
        if (cur.length === 0) cur.push(a);
        cur.push(p);
      }
      acc += step;
      segL -= step;
      a = p;
      if (acc >= (drawing ? on : off) - 1e-9) {
        if (drawing && cur.length > 1) out.push(cur);
        cur = [];
        acc = 0;
        drawing = !drawing;
      }
    }
  }
  if (drawing && cur.length > 1) out.push(cur);
  return out;
}

/** Sample a polyline at arc-length fraction f in [0,1]. */
export function samplePolyline(pts: Vec2[], f: number): { p: Vec2; dir: Vec2 } {
  if (pts.length === 1) return { p: pts[0], dir: { x: 1, y: 0 } };
  let L = 0;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push((L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)));
  const s = Math.max(0, Math.min(1, f)) * L;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1];
  const t = seg > 1e-9 ? (s - cum[i - 1]) / seg : 0;
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dir: { x: (b.x - a.x) / d, y: (b.y - a.y) / d } };
}
