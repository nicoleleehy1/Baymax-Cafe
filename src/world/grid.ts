// Global floor-plane pathfinding: an occupancy grid inflated by the agent radius,
// 8-connected A*, and line-of-sight string pulling to produce smooth polylines.
import { dist, type Vec2 } from '../core/vec';
import { ROOM, staticClearance } from './layout';

export class NavGrid {
  readonly cell: number;
  readonly w: number;
  readonly h: number;
  readonly free: Uint8Array;
  readonly radius: number;

  constructor(radius: number, cell = 0.1, includeChairs = true) {
    this.cell = cell;
    this.radius = radius;
    this.w = Math.ceil((ROOM.maxX - ROOM.minX) / cell);
    this.h = Math.ceil((ROOM.maxY - ROOM.minY) / cell);
    this.free = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const p = this.center(i, j);
        this.free[j * this.w + i] = staticClearance(p, includeChairs) >= radius ? 1 : 0;
      }
    }
  }

  center(i: number, j: number): Vec2 {
    return { x: ROOM.minX + (i + 0.5) * this.cell, y: ROOM.minY + (j + 0.5) * this.cell };
  }

  toCell(p: Vec2): [number, number] {
    return [Math.floor((p.x - ROOM.minX) / this.cell), Math.floor((p.y - ROOM.minY) / this.cell)];
  }

  isFreeCell(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.free[j * this.w + i] === 1;
  }

  /** Exact (non-discretized) free-space check against the analytic geometry. */
  isFreePoint(p: Vec2, includeChairs = true): boolean {
    return staticClearance(p, includeChairs) >= this.radius;
  }

  nearestFree(p: Vec2): Vec2 {
    const [ci, cj] = this.toCell(p);
    if (this.isFreeCell(ci, cj)) return p;
    for (let r = 1; r < 30; r++) {
      let best: Vec2 | null = null;
      let bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (!this.isFreeCell(ci + di, cj + dj)) continue;
          const c = this.center(ci + di, cj + dj);
          const d = dist(c, p);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
      }
      if (best) return best;
    }
    return p;
  }

  /** Line of sight over grid cells sampled every quarter cell. */
  lineFree(a: Vec2, b: Vec2): boolean {
    const d = dist(a, b);
    const n = Math.max(1, Math.ceil(d / (this.cell * 0.25)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const [i, j] = this.toCell({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      if (!this.isFreeCell(i, j)) return false;
    }
    return true;
  }

  findPath(start: Vec2, goal: Vec2, extraCost?: (p: Vec2) => number): Vec2[] | null {
    const s = this.nearestFree(start);
    const g = this.nearestFree(goal);
    const [si, sj] = this.toCell(s);
    const [gi, gj] = this.toCell(g);
    if (!this.isFreeCell(si, sj) || !this.isFreeCell(gi, gj)) return null;
    const N = this.w * this.h;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    const sIdx = sj * this.w + si;
    const gIdx = gj * this.w + gi;
    gScore[sIdx] = 0;
    heap.push(sIdx, this.h0(si, sj, gi, gj));
    const dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];
    let found = false;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (cur === gIdx) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % this.w;
      const cj = (cur - ci) / this.w;
      for (const [di, dj, c] of dirs) {
        const ni = ci + di;
        const nj = cj + dj;
        if (!this.isFreeCell(ni, nj)) continue;
        if (di !== 0 && dj !== 0 && (!this.isFreeCell(ci + di, cj) || !this.isFreeCell(ci, cj + dj))) continue;
        const nIdx = nj * this.w + ni;
        const ng = gScore[cur] + c * (1 + (extraCost ? extraCost(this.center(ni, nj)) : 0));
        if (ng < gScore[nIdx]) {
          gScore[nIdx] = ng;
          came[nIdx] = cur;
          heap.push(nIdx, ng + this.h0(ni, nj, gi, gj));
        }
      }
    }
    if (!found) return null;
    const cells: Vec2[] = [];
    for (let c = gIdx; c !== -1; c = came[c]) {
      const i = c % this.w;
      cells.push(this.center(i, (c - i) / this.w));
    }
    cells.reverse();
    cells[0] = s;
    cells[cells.length - 1] = g;
    return extraCost ? this.smooth(cells, extraCost) : this.smooth(cells);
  }

  private h0(i: number, j: number, gi: number, gj: number): number {
    const dx = Math.abs(i - gi);
    const dy = Math.abs(j - gj);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  /** Greedy string pulling. With a cost field, shortcuts may not enter costly cells. */
  smooth(pts: Vec2[], extraCost?: (p: Vec2) => number): Vec2[] {
    if (pts.length <= 2) return pts;
    const ok = (a: Vec2, b: Vec2): boolean => {
      if (!this.lineFree(a, b)) return false;
      if (!extraCost) return true;
      const n = Math.max(1, Math.ceil(dist(a, b) / this.cell));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        if (extraCost({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) > 0) return false;
      }
      return true;
    };
    const out: Vec2[] = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !ok(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, key: number): void {
    this.ids.push(id);
    this.keys.push(key);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.ids.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.ids.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

export function polylineLength(pts: Vec2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

let robotGrid: NavGrid | null = null;
let humanGrid: NavGrid | null = null;
/** Grid inflated for Baymax's footprint (+ small static margin). */
export function getRobotGrid(radius: number): NavGrid {
  if (!robotGrid) robotGrid = new NavGrid(radius + 0.04, 0.1, true);
  return robotGrid;
}
/** Grid for customers: chairs are not obstacles for them (they sit on them). */
export function getHumanGrid(radius: number): NavGrid {
  if (!humanGrid) humanGrid = new NavGrid(radius + 0.03, 0.1, false);
  return humanGrid;
}
