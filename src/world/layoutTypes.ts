// Shared layout data contract. One LayoutDef drives navigation obstacles, the renderer,
// serving positions, customer destinations and aisle annotations.
import { pointSegment, v, type Vec2 } from '../core/vec';

export const ROBOT_RADIUS = 0.52; // Baymax footprint: torso (0.445 max) and tray far edge (0.52) fit inside
export const HUMAN_RADIUS = 0.25;

export interface RectObstacle {
  kind: 'rect';
  id: string;
  min: Vec2;
  max: Vec2;
  /** visual category used by the renderer */
  visual:
    | 'counter' | 'shelf' | 'pastryIsland' | 'staff' | 'kitchen' | 'galley' | 'bench' | 'booth' | 'communal' | 'restroom' | 'squareTable'
    | 'kitchenSink' | 'prepTable' | 'conveyorOven' | 'trayRack' | 'stairs' | 'office' | 'stove' | 'fridge' | 'dishRack'
    | 'pastryCase' | 'dishCounter' | 'espressoBar' | 'boothTable'
    | 'bed' | 'sofa' | 'armchair' | 'desk' | 'workbench' | 'planter' | 'tub' | 'toilet' | 'sink' | 'diningTable' | 'kitchenette'
    | 'windowSeat' | 'wardrobe' | 'clutter' | 'bookshelf' | 'rug' | 'stairsUp' | 'landing';
}
export interface CircleObstacle {
  kind: 'circle';
  id: string;
  c: Vec2;
  r: number;
  visual: 'table' | 'chair' | 'plant' | 'post' | 'stool' | 'pouf' | 'parts';
  /** chair facing angle (radians, floor plane) */
  facing?: number;
}
export type Obstacle = RectObstacle | CircleObstacle;

export interface Seat {
  id: string;
  pos: Vec2;
  facing: number;
}

export interface Table {
  id: string;
  label: string;
  c: Vec2;
  seats: Seat[];
  /** Where Baymax stops to set down an order. */
  serve: Vec2;
}

export interface AisleZone {
  id: string;
  min: Vec2;
  max: Vec2;
}

export interface LayoutDef {
  id: 'classic' | 'long' | 'cass' | 'hiro';
  name: string;
  /** storey of the Lucky Cat building (1 = café); classic is a standalone café */
  floor: 1 | 2 | 3;
  /** navigation grid bounds (may extend beyond the walls to an outdoor porch) */
  room: { minX: number; maxX: number; minY: number; maxY: number };
  wallClearance: (p: Vec2) => number;
  /** wall polyline segments, for rendering and blockout drawing */
  walls: { a: Vec2; b: Vec2 }[];
  obstacles: Obstacle[];
  tables: Table[];
  /** seats that are not at a Table (benches, booths) */
  extraSeats: Seat[];
  aisles: AisleZone[];
  door: { inside: Vec2; outside: Vec2; a: Vec2; b: Vec2 };
  pickup: Vec2;
  orderSpot: Vec2;
  queueSpots: Vec2[];
  auntCass: { pos: Vec2; facing: number };
  /** where customers go to "use the restroom" (they disappear there) */
  restroom?: Vec2;
  /** blockout annotations (documentation only; the planner never reads these) */
  notes?: { yieldPoint?: Vec2; waitingSpace?: Vec2; labels?: { pos: Vec2; text: string }[] };
}

export function inRect(p: Vec2, min: Vec2, max: Vec2, pad = 0): boolean {
  return p.x >= min.x - pad && p.x <= max.x + pad && p.y >= min.y - pad && p.y <= max.y + pad;
}

/** Signed clearance from point to an obstacle surface (negative = inside). */
export function obstacleClearance(p: Vec2, o: Obstacle): number {
  if (o.kind === 'circle') return Math.hypot(p.x - o.c.x, p.y - o.c.y) - o.r;
  const dx = Math.max(o.min.x - p.x, 0, p.x - o.max.x);
  const dy = Math.max(o.min.y - p.y, 0, p.y - o.max.y);
  if (dx === 0 && dy === 0) return -Math.min(p.x - o.min.x, o.max.x - p.x, p.y - o.min.y, o.max.y - p.y);
  return Math.hypot(dx, dy);
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Wall clearance for a polygonal room: distance to wall segments, negative outside the walkable region. */
export function polygonWallClearance(walkable: Vec2[][], walls: { a: Vec2; b: Vec2 }[]): (p: Vec2) => number {
  return (p) => {
    let d = Infinity;
    for (const w of walls) d = Math.min(d, pointSegment(p, w.a, w.b).d);
    return walkable.some((poly) => pointInPolygon(p, poly)) ? d : -d;
  };
}

export function roundTable(id: string, label: string, c: Vec2, axis: 'x' | 'y', serve: Vec2, d = 0.68): Table {
  const seats =
    axis === 'x'
      ? [
          { id: `${id}a`, pos: v(c.x - d, c.y), facing: 0 },
          { id: `${id}b`, pos: v(c.x + d, c.y), facing: Math.PI },
        ]
      : [
          { id: `${id}a`, pos: v(c.x, c.y - d), facing: Math.PI / 2 },
          { id: `${id}b`, pos: v(c.x, c.y + d), facing: -Math.PI / 2 },
        ];
  return { id, label, c, seats, serve };
}
