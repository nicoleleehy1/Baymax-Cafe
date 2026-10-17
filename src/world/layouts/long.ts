// Long café traced from Nicole's first-floor reference plan (Lucky Cat Café).
//
// Positions are measured on the plan image (px) and mapped to meters with piecewise-linear
// scales: furniture keeps real-world sizes, while aisles are widened just enough for Baymax's
// 1.04 m carrying envelope. The plan's arrangement and proportions are preserved.
//
// Orientation in the 3D scene: plan top (kitchen) = −x (screen left), plan bottom (front
// window + angled door) = +x, plan left wall (galley) = −y (far side), plan right wall
// (window booths, communal table) = +y (near side, cut away in the dollhouse view).
import { v, type Vec2 } from '../../core/vec';
import { polygonWallClearance, type CircleObstacle, type LayoutDef, type Obstacle, type RectObstacle, type Seat, type Table } from '../layoutTypes';

// ---------------------------------------------------------------- plan → meters
const pwl = (pts: [number, number][]) => (p: number): number => {
  if (p <= pts[0][0]) return pts[0][1] + (p - pts[0][0]) * ((pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]));
  for (let i = 1; i < pts.length; i++) {
    const [a, A] = pts[i - 1];
    const [b, B] = pts[i];
    if (p <= b) return A + ((p - a) / (b - a)) * (B - A);
  }
  const [a, A] = pts[pts.length - 2];
  const [b, B] = pts[pts.length - 1];
  return B + (p - b) * ((B - A) / (b - a));
};
// plan y (px, top→bottom) → depth along the café (m)
// (the ordering area below the counter's top arm is opened up by ~1 m so a pair can stand and talk there)
const depth = pwl([[150, 0], [465, 3.6], [495, 3.9], [615, 4.85], [705, 5.7], [760, 7.15], [837, 8.45], [895, 9.05], [953, 9.75], [1010, 10.75], [1075, 11.5], [1178, 12.55], [1325, 14.45], [1395, 15.15], [1525, 17.1]]);
// plan x (px, left→right) → width across the café (m)
// (aisles get extra room: seated customers' bodies stick out past their chairs)
const across = pwl([[35, 0], [215, 2.2], [290, 3.0], [385, 3.8], [470, 5.7], [535, 6.36], [600, 7.02], [655, 9.05], [722, 9.77], [790, 10.42], [810, 10.72]]);
const L = depth(1525);
const Wd = across(810);
/** plan pixel → world floor point (centred on the room) */
export const P = (px: number, py: number): Vec2 => v(depth(py) - L / 2, across(px) - Wd / 2);

const x0 = -L / 2;
const x1 = L / 2;
const y0 = -Wd / 2;
const y1 = Wd / 2;
export const LONG_DIM = { x0, x1, y0, y1 };

const rect = (id: string, visual: RectObstacle['visual'], a: Vec2, b: Vec2): RectObstacle => ({
  kind: 'rect',
  id,
  visual,
  min: v(Math.min(a.x, b.x), Math.min(a.y, b.y)),
  max: v(Math.max(a.x, b.x), Math.max(a.y, b.y)),
});
/** rect of real size (sx along the café, sy across) centred on a plan point */
const box = (id: string, visual: RectObstacle['visual'], c: Vec2, sx: number, sy: number): RectObstacle => rect(id, visual, v(c.x - sx / 2, c.y - sy / 2), v(c.x + sx / 2, c.y + sy / 2));
const circ = (id: string, visual: CircleObstacle['visual'], c: Vec2, r: number, facing?: number): CircleObstacle => ({ kind: 'circle', id, visual, c, r, facing });
const at = (c: Vec2, dx: number, dy: number): Vec2 => v(c.x + dx, c.y + dy);

// ---------------------------------------------------------------- walls
// angled entrance at the front-right corner
const CUT_A = P(708, 1525);
const CUT_B = P(810, 1392);
const DOOR_A = at(CUT_A, (CUT_B.x - CUT_A.x) * 0.22, (CUT_B.y - CUT_A.y) * 0.22);
const DOOR_B = at(CUT_A, (CUT_B.x - CUT_A.x) * 0.78, (CUT_B.y - CUT_A.y) * 0.78);
const outN = (() => {
  const dx = CUT_B.x - CUT_A.x;
  const dy = CUT_B.y - CUT_A.y;
  const l = Math.hypot(dx, dy);
  return v(dy / l, -dx / l); // outward (+x,+y)
})();
const boundary: Vec2[] = [v(x0, y0), v(x1, y0), CUT_A, CUT_B, v(x0, y1)];
const porch: Vec2[] = [DOOR_A, DOOR_B, at(DOOR_B, outN.x, outN.y), at(DOOR_A, outN.x, outN.y)];

// interior walls (rendered + navigation): kitchen wall, galley partition, office, restroom
const KITCHEN_WALL_Y_END = P(495, 465).y;
const interiorWalls: { a: Vec2; b: Vec2 }[] = [
  { a: P(215, 465), b: P(495, 465) }, // kitchen / café wall (the pastry shelf hangs on it)
  { a: P(215, 435), b: P(215, 1000) }, // galley partition
  { a: P(620, 270), b: P(620, 440) }, // office
  { a: P(620, 270), b: P(810, 270) },
  { a: P(620, 480), b: P(810, 480) },
  { a: P(215, 1105), b: P(215, 1300) }, // restroom
  { a: P(35, 1105), b: P(215, 1105) },
  { a: P(35, 1395), b: P(85, 1395) },
  { a: P(150, 1395), b: P(215, 1395) },
];
const outerWalls = [
  { a: v(x0, y0), b: v(x1, y0) },
  { a: v(x1, y0), b: CUT_A },
  { a: CUT_A, b: DOOR_A },
  { a: DOOR_B, b: CUT_B },
  { a: CUT_B, b: v(x0, y1) },
  { a: v(x0, y1), b: v(x0, y0) },
];
const walls = [...outerWalls, ...interiorWalls];

// ---------------------------------------------------------------- kitchen (plan top)
export const KITCHEN_PROPS: Obstacle[] = [
  box('sink', 'kitchenSink', at(P(125, 215), 0, 0), 0.75, 1.5),
  box('prep', 'prepTable', P(262, 250), 1.5, 0.8),
  box('oven', 'conveyorOven', P(390, 228), 0.75, 1.8),
  box('island', 'prepTable', P(318, 397), 0.85, 1.55),
  box('rack', 'trayRack', P(462, 410), 0.6, 0.6),
  box('stairs', 'stairs', P(578, 210), 1.2, 1.1),
  rect('office', 'office', P(620, 270), P(810, 480)),
];

// ---------------------------------------------------------------- galley (plan left strip)
export const GALLEY_PROPS: Obstacle[] = [
  box('cups', 'shelf', P(65, 375), 1.3, 0.45),
  box('stove', 'stove', P(95, 530), 1.4, 0.9),
  box('galleyCounter', 'counter', P(70, 700), 1.9, 0.6),
  box('fridge1', 'fridge', P(78, 900), 1.1, 0.75),
  box('fridge2', 'fridge', P(78, 1035), 1.1, 0.75),
  box('dishShelf', 'dishRack', P(115, 1095), 0.35, 1.3),
];

// ---------------------------------------------------------------- service: pastry counter, display, espresso bar
const ARM_A = P(295, 615);
const ARM_B = P(560, 705);
export const COUNTER_ARM = rect('counterArm', 'counter', ARM_A, ARM_B); // the L's top: register + cake stands
export const COUNTER_LEG = rect('counterLeg', 'pastryCase', P(290, 705), P(385, 1210)); // long glass pastry cases
export const DISH_COUNTER = rect('dishCounter', 'dishCounter', P(230, 1230), P(360, 1300)); // dish return
export const WALL_DISPLAY = rect('wallDisplay', 'shelf', P(230, 465), P(510, 505)); // pastry wall display
export const ESPRESSO_BACK = rect('espressoBack', 'counter', P(640, 495), P(810, 525));
export const ESPRESSO_FRONT = rect('espressoFront', 'espressoBar', P(612, 595), P(810, 650));

export const POSTS = [circ('P1', 'post', P(560, 733), 0.16), circ('P2', 'post', P(557, 1090), 0.16), circ('P3', 'post', P(662, 600), 0.16)];

// ---------------------------------------------------------------- seating
const CHAIR_R = 0.22;
const chairsAlongY = (id: string, c: Vec2, d: number): Seat[] => [
  { id: `${id}a`, pos: at(c, 0, -d), facing: Math.PI / 2 },
  { id: `${id}b`, pos: at(c, 0, d), facing: -Math.PI / 2 },
];

// two round tables (chairs on the left/right as in the plan)
const R1c = P(535, 895);
const R2c = P(535, 1010);
const R1: Table = { id: 'T1', label: 'Round table 1', c: R1c, seats: chairsAlongY('T1', R1c, 0.66), serve: at(R1c, -1.02, 0) };
const R2: Table = { id: 'T2', label: 'Round table 2', c: R2c, seats: chairsAlongY('T2', R2c, 0.66), serve: at(R2c, 0.55, -1.4) }; // from the aisle, beside the chair

// square table with chairs left, right and front
const SQc = P(535, 1178);
export const SQUARE = box('T3', 'squareTable', SQc, 0.8, 0.8);
const SQ: Table = {
  id: 'T3',
  label: 'Square table',
  c: SQc,
  seats: chairsAlongY('T3', SQc, 0.66),
  serve: at(SQc, 1.4, -0.75),
};

// three window booths: table + bench against the window wall + one chair on the aisle side
const BOOTH_PY = [760, 837, 953];
const booths: Table[] = BOOTH_PY.map((py, i) => {
  const c = P(722, py);
  return {
    id: `B${i + 1}`,
    label: `Booth ${i + 1}`,
    c,
    seats: [
      { id: `B${i + 1}a`, pos: at(c, 0, y1 - 0.32 - c.y), facing: -Math.PI / 2 },
      { id: `B${i + 1}b`, pos: P(655, py), facing: Math.PI / 2 },
    ],
    serve: at(P(655, py), 0, -0.82),
  };
});
const boothObstacles: Obstacle[] = [
  ...booths.map((b) => box(`${b.id}t`, 'boothTable', b.c, 0.85, 0.65)),
  rect('wallBench', 'bench', v(P(790, 720).x, y1 - 0.5), v(P(790, 995).x, y1)),
];

// long communal table
const CM_A = P(665, 1075);
const CM_B = P(760, 1325);
export const COMMUNAL = rect('communal', 'communal', v(CM_A.x, CM_A.y + 0.3), v(CM_B.x, Math.min(CM_B.y + 0.1, y1 - 0.62)));
const COMM_PY = [1110, 1175, 1240, 1300];
const communalSeats: Seat[] = [
  ...COMM_PY.map((py, i) => ({ id: `C${i + 1}a`, pos: v(depth(py) - L / 2, COMMUNAL.min.y - 0.36), facing: Math.PI / 2 })),
  ...COMM_PY.map((py, i) => ({ id: `C${i + 1}b`, pos: v(depth(py) - L / 2, COMMUNAL.max.y + 0.36), facing: -Math.PI / 2 })),
];
const COMM: Table = { id: 'C', label: 'Communal table', c: v((COMMUNAL.min.x + COMMUNAL.max.x) / 2, (COMMUNAL.min.y + COMMUNAL.max.y) / 2), seats: communalSeats, serve: v(COMMUNAL.max.x + 0.62, (COMMUNAL.min.y + COMMUNAL.max.y) / 2) };

// front of house: restroom, rug, window bench
export const RESTROOM = rect('restroom', 'restroom', P(35, 1105), P(215, 1395));
export const FRONT_BENCH = rect('frontBench', 'bench', v(x1 - 0.5, P(235, 1497).y), v(x1, P(665, 1497).y));
export const RUG = { min: P(255, 1360), max: P(615, 1445) };
const benchSeats: Seat[] = [-1.2, 0, 1.2].map((dy, i) => ({ id: `F${i + 1}`, pos: v(x1 - 0.32, (FRONT_BENCH.min.y + FRONT_BENCH.max.y) / 2 + dy), facing: Math.PI }));

// customers on the window bench get their drinks handed over from the rug in front of it
const BENCH_T: Table = { id: 'F', label: 'Window bench', c: benchSeats[1].pos, seats: [benchSeats[1], benchSeats[2]], serve: v(benchSeats[1].pos.x - 0.95, benchSeats[1].pos.y + 0.6) };
const BENCH_L: Table = { id: 'FL', label: 'Window bench (by the restroom)', c: benchSeats[0].pos, seats: [benchSeats[0]], serve: v(benchSeats[0].pos.x - 0.95, benchSeats[0].pos.y - 0.4) };

const tables: Table[] = [R1, R2, SQ, ...booths, COMM, BENCH_T, BENCH_L];
const seatObstacles: Obstacle[] = [
  ...[R1, R2, SQ].flatMap((t) => t.seats.map((s) => circ(s.id, 'chair', s.pos, CHAIR_R, s.facing))),
  ...booths.map((b) => circ(b.seats[1].id, 'chair', b.seats[1].pos, CHAIR_R, b.seats[1].facing)),
  ...communalSeats.map((s) => circ(s.id, 'chair', s.pos, CHAIR_R, s.facing)),
];

const obstacles: Obstacle[] = [
  ...KITCHEN_PROPS,
  ...GALLEY_PROPS,
  COUNTER_ARM,
  COUNTER_LEG,
  DISH_COUNTER,
  WALL_DISPLAY,
  ESPRESSO_BACK,
  ESPRESSO_FRONT,
  ...POSTS,
  circ(R1.id, 'table', R1.c, 0.4),
  circ(R2.id, 'table', R2.c, 0.4),
  SQUARE,
  ...boothObstacles,
  COMMUNAL,
  ...seatObstacles,
  RESTROOM,
  FRONT_BENCH,
  circ('plant1', 'plant', P(70, 1450), 0.28),
];

// the café floor (where customers and Baymax operate): everything below the kitchen wall,
// right of the galley partition, plus the passage past the espresso bar
const PICKUP = v(ESPRESSO_FRONT.max.x + 0.62, ESPRESSO_FRONT.min.y + 0.62); // at the espresso bar / register
void KITCHEN_WALL_Y_END;

export const LONG: LayoutDef = {
  id: 'long',
  name: 'Lucky Cat Café (plan)',
  room: { minX: x0, maxX: x1 + 1.2, minY: y0, maxY: y1 + 1.2 },
  wallClearance: polygonWallClearance([boundary, porch], walls),
  walls,
  obstacles,
  tables,
  extraSeats: [],
  aisles: [
    // the walkway between the pastry cases and the round tables
    { id: 'pastry-aisle', min: v(COUNTER_ARM.max.x, COUNTER_LEG.max.y), max: v(COUNTER_LEG.max.x, R1.seats[0].pos.y - CHAIR_R) },
    // the walkway in front of the window booths
    { id: 'booth-aisle', min: v(booths[0].c.x - 0.6, R1.seats[1].pos.y + CHAIR_R), max: v(booths[2].c.x + 0.6, booths[0].seats[1].pos.y - CHAIR_R) },
  ],
  door: { inside: at(v((DOOR_A.x + DOOR_B.x) / 2, (DOOR_A.y + DOOR_B.y) / 2), -outN.x * 0.7, -outN.y * 0.7), outside: at(v((DOOR_A.x + DOOR_B.x) / 2, (DOOR_A.y + DOOR_B.y) / 2), outN.x * 0.7, outN.y * 0.7), a: DOOR_A, b: DOOR_B },
  pickup: PICKUP,
  orderSpot: at(COUNTER_ARM.max, 0.32, -1.2),
  queueSpots: [at(COUNTER_ARM.max, 0.32, -1.2), at(COUNTER_ARM.max, 1.05, -1.0), at(COUNTER_ARM.max, 1.75, -0.6), at(COUNTER_ARM.max, 2.4, -0.3)],
  auntCass: { pos: v(ESPRESSO_FRONT.min.x - 0.45, ESPRESSO_FRONT.min.y + 0.75), facing: 0 },
  restroom: at(P(180, 1395), 0, 0),
  notes: {
    labels: [
      { pos: P(300, 300), text: 'Kitchen' },
      { pos: P(120, 760), text: 'Galley' },
      { pos: P(340, 960), text: 'Pastry cases' },
      { pos: P(700, 580), text: 'Espresso bar' },
      { pos: P(710, 380), text: 'Office' },
      { pos: P(125, 1250), text: 'Restroom' },
      { pos: P(745, 870), text: 'Booths' },
      { pos: P(712, 1200), text: 'Communal' },
      { pos: P(450, 1470), text: 'Front bench' },
    ],
  },
};
