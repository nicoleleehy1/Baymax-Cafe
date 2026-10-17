// Long, narrow café adapted from the reference first-floor plan.
//
// Orientation: the plan's back (kitchen) is at −x (screen left), the plan's front window
// wall + angled entrance at +x (screen right). The plan's left wall (galley + long pastry
// counter) is the far side (−y); the plan's right wall (window booths, communal table) is
// the near side (+y), cut away in the dollhouse view.
import { v, type Vec2 } from '../../core/vec';
import { polygonWallClearance, roundTable, type CircleObstacle, type LayoutDef, type Obstacle, type RectObstacle, type Seat, type Table } from '../layoutTypes';

export const LONG_DIM = { x0: -8.5, x1: 8.5, y0: -4, y1: 4, kitchenX: -6.6, counterY: -2.6 };
const { x0, x1, y0, y1 } = LONG_DIM;

// angled front-right entrance: the corner (x1, y1) is cut diagonally
const CUT_A = v(7.0, y1);
const CUT_B = v(x1, 2.5);
const DOOR_A = v(7.42, 3.58);
const DOOR_B = v(8.08, 2.92);
const OUT = { x: 0.7071, y: 0.7071 };

const boundary: Vec2[] = [v(x0, y0), v(x1, y0), CUT_B, CUT_A, v(x0, y1)];
const porch: Vec2[] = [DOOR_A, DOOR_B, v(DOOR_B.x + OUT.x * 1.0, DOOR_B.y + OUT.y * 1.0), v(DOOR_A.x + OUT.x * 1.0, DOOR_A.y + OUT.y * 1.0)];
const walls = [
  { a: v(x0, y0), b: v(x1, y0) },
  { a: v(x1, y0), b: CUT_B },
  { a: CUT_B, b: DOOR_B },
  { a: DOOR_A, b: CUT_A },
  { a: CUT_A, b: v(x0, y1) },
  { a: v(x0, y1), b: v(x0, y0) },
];

const rect = (id: string, visual: RectObstacle['visual'], ax: number, ay: number, bx: number, by: number): RectObstacle => ({ kind: 'rect', id, visual, min: v(ax, ay), max: v(bx, by) });
const circ = (id: string, visual: CircleObstacle['visual'], x: number, y: number, r: number, facing?: number): CircleObstacle => ({ kind: 'circle', id, visual, c: v(x, y), r, facing });

// ---- service side (far wall)
export const KITCHEN = rect('kitchen', 'kitchen', x0, y0, LONG_DIM.kitchenX, y1);
export const GALLEY = rect('galley', 'galley', LONG_DIM.kitchenX, y0, 2.4, LONG_DIM.counterY); // staff strip + long pastry counter leg
export const COUNTER_TOP = rect('counterTop', 'counter', LONG_DIM.kitchenX, LONG_DIM.counterY, -6.0, -0.9); // the L's short arm under the kitchen
export const RESTROOM = rect('restroom', 'restroom', 6.0, y0, x1, -2.1);
export const FRONT_BENCH = rect('frontBench', 'bench', 7.95, -1.9, x1, 2.2);

// ---- centre column: three small round tables + one square table near the front
const TABLE_R = 0.4;
const CHAIR_R = 0.22;
const T1 = roundTable('T1', 'Table 1', v(-3.4, 0.4), 'y', v(-2.32, 0.4), 0.62);
const T2 = roundTable('T2', 'Table 2', v(-0.9, 0.4), 'y', v(0.18, 0.4), 0.62);
const T3 = roundTable('T3', 'Table 3', v(1.6, 0.4), 'y', v(2.68, 0.4), 0.62);
const SQUARE_C = v(7.0, -0.3);
export const SQUARE = rect('T4', 'squareTable', SQUARE_C.x - 0.4, SQUARE_C.y - 0.4, SQUARE_C.x + 0.4, SQUARE_C.y + 0.4);
const T4: Table = {
  id: 'T4',
  label: 'Window table',
  c: SQUARE_C,
  seats: [
    { id: 'T4a', pos: v(8.12, -0.3), facing: Math.PI }, // on the front bench
    { id: 'T4b', pos: v(7.0, -1.05), facing: Math.PI / 2 },
  ],
  serve: v(5.98, -0.3),
};

// ---- window booths (near wall, plan's right side, upper half)
const BOOTH_X = [-5.7, -4.0, -2.3, -0.6];
const booths: Table[] = BOOTH_X.map((cx, i) => ({
  id: `B${i + 1}`,
  label: `Booth ${i + 1}`,
  c: v(cx, 3.62),
  seats: [
    { id: `B${i + 1}a`, pos: v(cx - 0.66, 3.5), facing: 0 },
    { id: `B${i + 1}b`, pos: v(cx + 0.66, 3.5), facing: Math.PI },
  ],
  serve: v(cx, 2.48),
}));
const boothObstacles: Obstacle[] = BOOTH_X.flatMap((cx, i) => [
  rect(`B${i + 1}t`, 'booth', cx - 0.35, 3.25, cx + 0.35, y1),
  rect(`B${i + 1}l`, 'bench', cx - 0.85, 2.9, cx - 0.5, y1),
  rect(`B${i + 1}r`, 'bench', cx + 0.5, 2.9, cx + 0.85, y1),
]);

// ---- communal table (near wall, lower half)
export const COMMUNAL = rect('communal', 'communal', 1.2, 2.95, 5.6, 3.45);
const COMMUNAL_X = [1.65, 2.55, 3.45, 4.35, 5.25];
const communalSeats: Seat[] = [
  ...COMMUNAL_X.map((x, i) => ({ id: `C${i + 1}a`, pos: v(x, 2.6), facing: Math.PI / 2 })),
  ...COMMUNAL_X.map((x, i) => ({ id: `C${i + 1}b`, pos: v(x, 3.76), facing: -Math.PI / 2 })),
];
const COMMUNAL_T: Table = { id: 'C', label: 'Communal table', c: v(3.4, 3.2), seats: communalSeats, serve: v(6.2, 3.1) };

// ---- posts between the counter and the tables; P2 makes the one deliberate pinch
export const POSTS = [circ('P1', 'post', -6.25, 1.3, 0.16), circ('P2', 'post', -0.9, -1.15, 0.16), circ('P3', 'post', 2.1, -3.65, 0.16)];

const tables = [T1, T2, T3, T4, ...booths, COMMUNAL_T];
const roundObs: Obstacle[] = [T1, T2, T3].flatMap((t) => [
  circ(t.id, 'table', t.c.x, t.c.y, TABLE_R),
  ...t.seats.map((s) => circ(s.id, 'chair', s.pos.x, s.pos.y, CHAIR_R, s.facing)),
]);

const obstacles: Obstacle[] = [
  KITCHEN,
  GALLEY,
  COUNTER_TOP,
  RESTROOM,
  FRONT_BENCH,
  SQUARE,
  circ('T4b', 'chair', 7.0, -1.05, CHAIR_R, Math.PI / 2),
  COMMUNAL,
  ...communalSeats.map((s) => circ(s.id, 'chair', s.pos.x, s.pos.y, CHAIR_R, s.facing)),
  ...boothObstacles,
  ...roundObs,
  ...POSTS,
  circ('plant1', 'plant', 5.6, -1.75, 0.28),
];

export const LONG: LayoutDef = {
  id: 'long',
  name: 'Long café',
  room: { minX: x0, maxX: x1 + 1.2, minY: y0, maxY: y1 + 1.2 },
  wallClearance: polygonWallClearance([boundary, porch], walls),
  walls,
  obstacles,
  tables,
  extraSeats: [],
  aisles: [
    // the post pinch: one Baymax-width gap between P2 and the counter
    { id: 'post-pinch', min: v(-1.6, LONG_DIM.counterY), max: v(-0.2, -0.99) },
    // the walkway in front of the window booths
    { id: 'booth-aisle', min: v(-6.4, 1.24), max: v(0.2, 2.9) },
  ],
  door: { inside: v(7.25, 2.75), outside: v(8.25, 3.75), a: DOOR_A, b: DOOR_B },
  pickup: v(-5.42, -1.98),
  orderSpot: v(-4.4, -2.3),
  queueSpots: [v(-4.4, -2.3), v(-3.6, -2.3), v(-2.8, -2.3), v(-2.0, -2.25)],
  auntCass: { pos: v(-5.2, -3.3), facing: Math.PI / 2 },
  restroom: v(5.72, -3.05),
  notes: {
    yieldPoint: v(-0.9, -1.92),
    waitingSpace: v(-2.6, -1.45),
    labels: [
      { pos: v(-7.5, 0), text: 'Kitchen' },
      { pos: v(-2.0, -3.3), text: 'Galley + long pastry counter' },
      { pos: v(7.2, -3.05), text: 'Restroom' },
      { pos: v(-3.2, 3.85), text: 'Window booths' },
      { pos: v(3.4, 3.85), text: 'Communal table' },
      { pos: v(8.2, 0.2), text: 'Front bench' },
    ],
  },
};
