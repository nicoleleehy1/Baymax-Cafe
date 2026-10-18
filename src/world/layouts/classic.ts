// Original square café (kept as the fallback layout).
import { v } from '../../core/vec';
import { roundTable, type CircleObstacle, type LayoutDef, type Obstacle, type RectObstacle } from '../layoutTypes';

export const WALL = { left: -7, right: 7, back: -5, front: 5 };
const ROOM = { minX: -7.6, maxX: 7, minY: -5, maxY: 5 };
const TABLE_R = 0.45;
const CHAIR_R = 0.22;

export const TABLES = [
  roundTable('T1', 'Table 1', v(-5.2, -1.2), 'x', v(-5.2, -0.15)),
  roundTable('T2', 'Table 2', v(-5.2, 1.5), 'x', v(-5.2, 0.45)),
  roundTable('T3', 'Table 3', v(-2.0, 1.0), 'y', v(-0.94, 1.0)),
  roundTable('T4', 'Table 4', v(5.7, 1.4), 'y', v(4.64, 1.4)),
  roundTable('T5', 'Table 5', v(2.2, 3.7), 'x', v(2.2, 2.64)),
  roundTable('T6', 'Table 6', v(-1.4, 3.9), 'x', v(-1.4, 2.84)),
];

export const COUNTER: RectObstacle = { kind: 'rect', id: 'counter', min: v(-4.4, -5), max: v(1.8, -3.6), visual: 'counter' };
export const BACK_SHELF: RectObstacle = { kind: 'rect', id: 'shelf', min: v(2.4, -5), max: v(7, -4.3), visual: 'shelf' };
export const PASTRY_ISLAND: RectObstacle = { kind: 'rect', id: 'pastry', min: v(2.9, -2.8), max: v(5.5, -2.05), visual: 'pastryIsland' };
export const PLANTS: CircleObstacle[] = [
  { kind: 'circle', id: 'plant1', c: v(6.45, 4.45), r: 0.35, visual: 'plant' },
  { kind: 'circle', id: 'plant2', c: v(-6.5, -4.4), r: 0.35, visual: 'plant' },
  { kind: 'circle', id: 'plant3', c: v(6.45, -3.6), r: 0.3, visual: 'plant' },
];

const OBSTACLES: Obstacle[] = [
  COUNTER,
  BACK_SHELF,
  PASTRY_ISLAND,
  ...PLANTS,
  ...TABLES.map((t): CircleObstacle => ({ kind: 'circle', id: t.id, c: t.c, r: TABLE_R, visual: 'table' })),
  ...TABLES.flatMap((t) => t.seats.map((s): CircleObstacle => ({ kind: 'circle', id: s.id, c: s.pos, r: CHAIR_R, visual: 'chair', facing: s.facing }))),
];

export const DOOR_RECT = { min: v(-7.6, 2.55), max: v(-7, 3.85) };

export const CLASSIC: LayoutDef = {
  id: 'classic',
  name: 'Original café',
  floor: 1,
  room: ROOM,
  wallClearance: (p) => {
    const inDoor = p.y > DOOR_RECT.min.y && p.y < DOOR_RECT.max.y;
    const left = inDoor ? p.x - ROOM.minX : p.x - WALL.left;
    return Math.min(left, WALL.right - p.x, p.y - WALL.back, WALL.front - p.y);
  },
  walls: [
    { a: v(-7, -5), b: v(7, -5) },
    { a: v(7, -5), b: v(7, 5) },
    { a: v(-7, -5), b: v(-7, 2.55) },
    { a: v(-7, 3.85), b: v(-7, 5) },
  ],
  obstacles: OBSTACLES,
  tables: TABLES,
  extraSeats: [],
  aisles: [{ id: 'pastry-aisle', min: v(2.9, -4.3), max: v(5.5, -2.8) }],
  door: { inside: v(-6.4, 3.2), outside: v(-7.4, 3.2), a: v(-7, 2.55), b: v(-7, 3.85) },
  pickup: v(-0.8, -2.95),
  orderSpot: v(-3.4, -3.1),
  queueSpots: [v(-3.4, -3.1), v(-3.4, -2.3), v(-3.55, -1.5), v(-3.8, -0.7)],
  auntCass: { pos: v(-1.3, -4.4), facing: Math.PI / 2 },
};
