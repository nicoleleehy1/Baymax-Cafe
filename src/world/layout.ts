// Authored café floor plan. Everything here is static geometry shared by the simulation,
// the planner (as its map) and the renderer. Units are meters; floor plane uses (x, y=worldZ).
import { v, type Vec2 } from '../core/vec';

export const ROOM = { minX: -7.6, maxX: 7, minY: -5, maxY: 5 };
export const WALL = { left: -7, right: 7, back: -5, front: 5 };

export const ROBOT_RADIUS = 0.5; // Baymax footprint incl. tray
export const HUMAN_RADIUS = 0.25;

export interface RectObstacle {
  kind: 'rect';
  id: string;
  min: Vec2;
  max: Vec2;
  /** visual category used by the renderer */
  visual: 'counter' | 'shelf' | 'pastryIsland' | 'staff';
}
export interface CircleObstacle {
  kind: 'circle';
  id: string;
  c: Vec2;
  r: number;
  visual: 'table' | 'chair' | 'plant';
  /** chair facing angle (radians, floor plane) */
  facing?: number;
}
export type Obstacle = RectObstacle | CircleObstacle;

export interface Table {
  id: string;
  label: string;
  c: Vec2;
  seats: { id: string; pos: Vec2; facing: number }[];
  /** Where Baymax stops to set down an order. */
  serve: Vec2;
}

const TABLE_R = 0.45;
const CHAIR_R = 0.22;

function table(id: string, label: string, c: Vec2, axis: 'x' | 'y', serve: Vec2): Table {
  const d = 0.68;
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

export const TABLES: Table[] = [
  table('T1', 'Table 1', v(-5.2, -1.2), 'x', v(-5.2, -0.2)),
  table('T2', 'Table 2', v(-5.2, 1.5), 'x', v(-5.2, 0.5)),
  table('T3', 'Table 3', v(-2.0, 1.0), 'y', v(-1.0, 1.0)),
  table('T4', 'Table 4', v(5.7, 1.4), 'y', v(4.7, 1.4)),
  table('T5', 'Table 5', v(2.2, 3.7), 'x', v(2.2, 2.7)),
  table('T6', 'Table 6', v(-1.4, 3.9), 'x', v(-1.4, 2.9)),
];

export const COUNTER: RectObstacle = { kind: 'rect', id: 'counter', min: v(-4.4, -5), max: v(1.8, -3.6), visual: 'counter' };
export const BACK_SHELF: RectObstacle = { kind: 'rect', id: 'shelf', min: v(2.4, -5), max: v(7, -4.3), visual: 'shelf' };
export const PASTRY_ISLAND: RectObstacle = { kind: 'rect', id: 'pastry', min: v(2.9, -2.8), max: v(5.5, -2.05), visual: 'pastryIsland' };

export const PLANTS: CircleObstacle[] = [
  { kind: 'circle', id: 'plant1', c: v(6.45, 4.45), r: 0.35, visual: 'plant' },
  { kind: 'circle', id: 'plant2', c: v(-6.5, -4.4), r: 0.35, visual: 'plant' },
  { kind: 'circle', id: 'plant3', c: v(6.45, -3.6), r: 0.3, visual: 'plant' },
];

export const OBSTACLES: Obstacle[] = [
  COUNTER,
  BACK_SHELF,
  PASTRY_ISLAND,
  ...PLANTS,
  ...TABLES.map((t): CircleObstacle => ({ kind: 'circle', id: t.id, c: t.c, r: TABLE_R, visual: 'table' })),
  ...TABLES.flatMap((t) =>
    t.seats.map((s): CircleObstacle => ({ kind: 'circle', id: s.id, c: s.pos, r: CHAIR_R, visual: 'chair', facing: s.facing })),
  ),
];

/** Narrow aisle between the back shelf and the pastry island. Annotated, not inferred. */
export interface AisleZone {
  id: string;
  min: Vec2;
  max: Vec2;
}
export const AISLES: AisleZone[] = [{ id: 'pastry-aisle', min: v(2.9, -4.3), max: v(5.5, -2.8) }];

export const DOOR = { inside: v(-6.4, 3.2), outside: v(-7.4, 3.2), min: v(-7.6, 2.55), max: v(-7, 3.85) };
export const PICKUP = v(-0.8, -3.0); // Baymax's spot at the counter where Aunt Cass loads the tray
export const ORDER_SPOT = v(-3.4, -3.1);
export const QUEUE_SPOTS = [v(-3.4, -3.1), v(-3.4, -2.3), v(-3.55, -1.5), v(-3.8, -0.7)];
export const AUNT_CASS = { pos: v(-1.3, -4.4), facing: Math.PI / 2 };

export function tableById(id: string): Table {
  const t = TABLES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown table ${id}`);
  return t;
}

export function seatById(id: string): { pos: Vec2; facing: number; table: Table } {
  for (const t of TABLES) {
    const s = t.seats.find((x) => x.id === id);
    if (s) return { ...s, table: t };
  }
  throw new Error(`unknown seat ${id}`);
}

export function inRect(p: Vec2, min: Vec2, max: Vec2, pad = 0): boolean {
  return p.x >= min.x - pad && p.x <= max.x + pad && p.y >= min.y - pad && p.y <= max.y + pad;
}

/** Signed clearance from point to an obstacle surface (negative = inside). */
export function obstacleClearance(p: Vec2, o: Obstacle): number {
  if (o.kind === 'circle') return Math.hypot(p.x - o.c.x, p.y - o.c.y) - o.r;
  const dx = Math.max(o.min.x - p.x, 0, p.x - o.max.x);
  const dy = Math.max(o.min.y - p.y, 0, p.y - o.max.y);
  if (dx === 0 && dy === 0) {
    return -Math.min(p.x - o.min.x, o.max.x - p.x, p.y - o.min.y, o.max.y - p.y);
  }
  return Math.hypot(dx, dy);
}

/** Clearance to walls (the room boundary, with the door opening on the left wall). */
export function wallClearance(p: Vec2): number {
  const inDoor = p.y > DOOR.min.y && p.y < DOOR.max.y;
  const left = inDoor ? p.x - ROOM.minX : p.x - WALL.left;
  return Math.min(left, WALL.right - p.x, p.y - WALL.back, WALL.front - p.y);
}

export function staticClearance(p: Vec2, includeChairs = true): number {
  let c = wallClearance(p);
  for (const o of OBSTACLES) {
    if (!includeChairs && o.kind === 'circle' && o.visual === 'chair') continue;
    const d = obstacleClearance(p, o);
    if (d < c) c = d;
  }
  return c;
}
