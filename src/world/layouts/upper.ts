// Upper floors of the Lucky Cat building, sharing the café's footprint and plan→meters
// mapping. Positions are fractions of the footprint: u along the building (0 = back wall,
// 1 = front window wall), v across it (0 = plan-left wall, 1 = plan-right/bay-window wall).
import { v, type Vec2 } from '../../core/vec';
import { polygonWallClearance, type CircleObstacle, type LayoutDef, type Obstacle, type RectObstacle, type Seat, type Table } from '../layoutTypes';
import { LONG_DIM } from './long';

const { x0, x1, y0, y1 } = LONG_DIM;
const Lx = x1 - x0;
const Ly = y1 - y0;
/** fraction → world floor point */
export const F = (u: number, w: number): Vec2 => v(x0 + u * Lx, y0 + w * Ly);

const rect = (id: string, visual: RectObstacle['visual'], a: Vec2, b: Vec2): RectObstacle => ({
  kind: 'rect',
  id,
  visual,
  min: v(Math.min(a.x, b.x), Math.min(a.y, b.y)),
  max: v(Math.max(a.x, b.x), Math.max(a.y, b.y)),
});
const box = (id: string, visual: RectObstacle['visual'], c: Vec2, sx: number, sy: number): RectObstacle => rect(id, visual, v(c.x - sx / 2, c.y - sy / 2), v(c.x + sx / 2, c.y + sy / 2));
const circ = (id: string, visual: CircleObstacle['visual'], c: Vec2, r: number, facing?: number): CircleObstacle => ({ kind: 'circle', id, visual, c, r, facing });
const at = (c: Vec2, dx: number, dy: number): Vec2 => v(c.x + dx, c.y + dy);

const outer = [
  { a: v(x0, y0), b: v(x1, y0) },
  { a: v(x1, y0), b: v(x1, y1) },
  { a: v(x1, y1), b: v(x0, y1) },
  { a: v(x0, y1), b: v(x0, y0) },
];
const boundary: Vec2[] = [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];
const seg = (a: Vec2, b: Vec2) => ({ a, b });
const CHAIR_R = 0.22;

// =====================================================================================
// Floor 2 · Aunt Cass's apartment
// =====================================================================================
// stairs climb along the plan-left wall from the back; the landing is where Baymax arrives
const STAIRS2 = rect('stairs2', 'stairsUp', F(0.08, 0.0), F(0.36, 0.11));
const LANDING2 = F(0.2, 0.22);
// bathroom (tub + toilet) at the left middle, behind its own walls
const BATH2 = { min: F(0.3, 0.0), max: F(0.5, 0.33) };
const BATH2_DOOR = { a: F(0.5, 0.2), b: F(0.5, 0.3) };
// kitchen at the back right with the bay nook
const KITCHENETTE2 = rect('kitchenette2', 'kitchenette', F(0.0, 0.52), F(0.085, 0.86));
const FRIDGE2 = box('fridge2', 'fridge', F(0.045, 0.94), 0.75, 0.75);
const NOOK2 = rect('nook2', 'windowSeat', F(0.0, 0.86), F(0.07, 0.94));
// dining table in the middle of the living room
const DINE_C = F(0.56, 0.62);
const DINING2 = box('dining2', 'diningTable', DINE_C, 1.1, 1.1);
const dineSeats: Seat[] = [
  { id: 'D1', pos: at(DINE_C, -0.85, 0), facing: 0 },
  { id: 'D2', pos: at(DINE_C, 0.85, 0), facing: Math.PI },
  { id: 'D3', pos: at(DINE_C, 0, -0.85), facing: Math.PI / 2 },
  { id: 'D4', pos: at(DINE_C, 0, 0.85), facing: -Math.PI / 2 },
];
// sofa cluster by the front bay window
const SOFA_C = F(0.83, 0.78);
const SOFA2 = box('sofa2', 'sofa', SOFA_C, 0.9, 2.0);
const ARM2 = box('armchair2', 'armchair', F(0.93, 0.56), 0.85, 0.85);
const COFFEE2 = box('coffee2', 'squareTable', F(0.86, 0.6), 0.9, 0.55);
// bedroom at the front left
const BED_C = F(0.9, 0.17);
const BED2 = box('bed2', 'bed', BED_C, 2.0, 1.5);
const WARD2 = box('wardrobe2', 'wardrobe', F(0.62, 0.04), 1.4, 0.6);
const BEDWALL = { a: F(0.68, 0.0), b: F(0.68, 0.2) };
const BEDWALL2 = { a: F(0.68, 0.34), b: F(0.68, 0.42) };

const sofaSeats: Seat[] = [
  { id: 'S1', pos: at(SOFA_C, 0.0, -0.45), facing: Math.PI },
  { id: 'S2', pos: at(SOFA_C, 0.0, 0.45), facing: Math.PI },
];
const bedSeats: Seat[] = [{ id: 'BD', pos: at(BED_C, 0.3, 0.45), facing: -Math.PI / 2 }];
const armSeats: Seat[] = [{ id: 'AC', pos: F(0.93, 0.56), facing: Math.PI }];

const cassTables: Table[] = [
  { id: 'DIN', label: 'Dining table', c: DINE_C, seats: dineSeats, serve: at(DINE_C, -1.25, -1.25) },
  { id: 'SOFA', label: 'Sofa', c: SOFA_C, seats: sofaSeats, serve: at(SOFA_C, -1.2, 0) },
  { id: 'ARM', label: 'Armchair', c: F(0.93, 0.56), seats: armSeats, serve: F(0.9, 0.44) },
  { id: 'BED', label: 'Bedroom', c: BED_C, seats: bedSeats, serve: at(BED_C, -0.3, 1.5) },
  { id: 'KIT', label: 'Kitchen counter', c: F(0.04, 0.69), seats: [], serve: F(0.14, 0.69) },
];

const cassWalls = [
  ...outer,
  seg(BATH2.min, v(BATH2.max.x, BATH2.min.y)), // bathroom back wall (along x at v=0 is the outer wall; this is the inner one)
  seg(v(BATH2.min.x, BATH2.min.y), v(BATH2.min.x, BATH2.max.y)),
  seg(v(BATH2.min.x, BATH2.max.y), v(BATH2.max.x, BATH2.max.y)),
  seg(v(BATH2.max.x, BATH2.min.y), BATH2_DOOR.a),
  seg(BATH2_DOOR.b, v(BATH2.max.x, BATH2.max.y)),
  seg(BEDWALL.a, BEDWALL.b),
  seg(BEDWALL2.a, BEDWALL2.b),
];

const cassObstacles: Obstacle[] = [
  STAIRS2,
  box('tub2', 'tub', F(0.4, 0.06), 1.6, 0.75),
  box('toilet2', 'toilet', F(0.34, 0.26), 0.6, 0.45),
  box('sink2', 'sink', F(0.46, 0.27), 0.55, 0.45),
  KITCHENETTE2,
  FRIDGE2,
  NOOK2,
  circ('plant2a', 'plant', F(0.1, 0.97), 0.28),
  DINING2,
  ...dineSeats.map((s) => circ(s.id, 'chair', s.pos, CHAIR_R, s.facing)),
  SOFA2,
  ARM2,
  COFFEE2,
  circ('plant2b', 'plant', F(0.97, 0.95), 0.3),
  circ('plant2c', 'plant', F(0.72, 0.96), 0.26),
  BED2,
  WARD2,
  box('nightstand2', 'squareTable', F(0.97, 0.3), 0.45, 0.45),
];

export const CASS: LayoutDef = {
  id: 'cass',
  name: "Aunt Cass's apartment",
  floor: 2,
  room: { minX: x0, maxX: x1, minY: y0, maxY: y1 },
  wallClearance: polygonWallClearance([boundary], cassWalls),
  walls: cassWalls,
  obstacles: cassObstacles,
  tables: cassTables,
  extraSeats: [],
  aisles: [{ id: 'hallway', min: F(0.5, 0.0), max: F(0.68, 0.36) }],
  door: { inside: LANDING2, outside: at(LANDING2, -0.6, -0.9), a: F(0.36, 0.0), b: F(0.36, 0.11) },
  pickup: LANDING2,
  orderSpot: F(0.2, 0.7),
  queueSpots: [F(0.2, 0.7), F(0.26, 0.7)],
  auntCass: { pos: F(0.12, 0.69), facing: 0 },
  restroom: F(0.4, 0.17),
  notes: {
    labels: [
      { pos: F(0.22, 0.05), text: 'Stairs' },
      { pos: F(0.4, 0.17), text: 'Bathroom' },
      { pos: F(0.06, 0.7), text: 'Kitchen' },
      { pos: F(0.56, 0.62), text: 'Dining' },
      { pos: F(0.85, 0.75), text: 'Living' },
      { pos: F(0.9, 0.17), text: 'Bedroom' },
    ],
  },
};

// =====================================================================================
// Floor 3 · Hiro's room + rooftop garden
// =====================================================================================
const GARDEN_WALL_U = 0.44;
const STAIRS3 = rect('stairs3', 'stairsUp', F(0.1, 0.84), F(0.3, 0.97));
const LANDING3 = F(0.36, 0.78);
const GARDEN_DOOR = { a: F(GARDEN_WALL_U, 0.62), b: F(GARDEN_WALL_U, 0.74) };
// bathroom at the left middle of the room half
const BATH3 = { min: F(0.46, 0.0), max: F(0.64, 0.3) };
const BATH3_DOOR = { a: F(0.64, 0.18), b: F(0.64, 0.28) };
// desk + computer by the front-left window, bed at the front bay, workbench mid-room
const DESK_C = F(0.93, 0.18);
const DESK3 = box('desk3', 'desk', DESK_C, 0.75, 1.7);
const BED3_C = F(0.92, 0.78);
const BED3 = box('bed3', 'bed', BED3_C, 1.5, 2.0);
const BENCH_C = F(0.66, 0.55);
const BENCH3 = box('workbench3', 'workbench', BENCH_C, 1.0, 2.2);
const SHELF3 = box('shelf3', 'bookshelf', F(0.5, 0.45), 0.4, 1.4);

const deskSeat: Seat[] = [{ id: 'DK', pos: at(DESK_C, -0.7, 0), facing: 0 }];
const benchSeat: Seat[] = [{ id: 'WB', pos: at(BENCH_C, -0.85, 0.3), facing: 0 }];
const bedSeat3: Seat[] = [{ id: 'HB', pos: at(BED3_C, -0.1, -0.5), facing: Math.PI / 2 }];
const gardenSeat: Seat[] = [{ id: 'GB', pos: F(0.14, 0.52), facing: 0 }];

const hiroTables: Table[] = [
  { id: 'DESK', label: "Hiro's desk", c: DESK_C, seats: deskSeat, serve: at(DESK_C, -1.1, 1.45) },
  { id: 'WORK', label: 'Workbench', c: BENCH_C, seats: benchSeat, serve: at(BENCH_C, -1.45, -0.45) },
  { id: 'HBED', label: 'Bed', c: BED3_C, seats: bedSeat3, serve: at(BED3_C, -1.65, -0.3) },
  { id: 'GARDEN', label: 'Garden bench', c: F(0.14, 0.52), seats: gardenSeat, serve: F(0.22, 0.52) },
];

const hiroWalls = [
  ...outer,
  seg(F(GARDEN_WALL_U, 0.0), GARDEN_DOOR.a),
  seg(GARDEN_DOOR.b, F(GARDEN_WALL_U, 1.0)),
  seg(v(BATH3.min.x, BATH3.max.y), v(BATH3.max.x, BATH3.max.y)),
  seg(v(BATH3.max.x, BATH3.min.y), BATH3_DOOR.a),
  seg(BATH3_DOOR.b, v(BATH3.max.x, BATH3.max.y)),
];

const parts: CircleObstacle[] = [
  [0.78, 0.4],
  [0.74, 0.62],
  [0.84, 0.5],
  [0.58, 0.82],
  [0.7, 0.9],
].map(([u, w], i) => circ(`parts${i}`, 'parts', F(u, w), 0.18));

const hiroObstacles: Obstacle[] = [
  STAIRS3,
  box('planter3a', 'planter', F(0.06, 0.2), 0.7, 2.2),
  box('planter3b', 'planter', F(0.26, 0.2), 0.7, 2.2),
  box('planter3c', 'planter', F(0.16, 0.68), 0.7, 0.9),
  box('gardenBench3', 'bench', F(0.14, 0.52), 0.5, 1.2),
  circ('plant3a', 'plant', F(0.36, 0.1), 0.3),
  circ('plant3b', 'plant', F(0.38, 0.48), 0.3),
  box('tub3', 'tub', F(0.55, 0.06), 1.6, 0.75),
  box('toilet3', 'toilet', F(0.5, 0.24), 0.6, 0.45),
  box('sink3', 'sink', F(0.6, 0.25), 0.55, 0.45),
  DESK3,
  circ('deskChair3', 'chair', at(DESK_C, -0.7, 0), CHAIR_R, 0),
  BED3,
  BENCH3,
  circ('stool3', 'stool', at(BENCH_C, -0.85, 0.3), 0.2, 0),
  SHELF3,
  box('nook3', 'windowSeat', F(0.96, 0.96), 0.6, 0.6),
  ...parts,
];

export const HIRO: LayoutDef = {
  id: 'hiro',
  name: "Hiro's room",
  floor: 3,
  room: { minX: x0, maxX: x1, minY: y0, maxY: y1 },
  wallClearance: polygonWallClearance([boundary], hiroWalls),
  walls: hiroWalls,
  obstacles: hiroObstacles,
  tables: hiroTables,
  extraSeats: [],
  aisles: [{ id: 'garden-door', min: F(GARDEN_WALL_U - 0.05, 0.6), max: F(GARDEN_WALL_U + 0.05, 0.76) }],
  door: { inside: LANDING3, outside: at(LANDING3, -0.8, 0.4), a: F(0.3, 0.84), b: F(0.3, 0.97) },
  pickup: LANDING3,
  orderSpot: F(0.2, 0.4),
  queueSpots: [F(0.2, 0.4), F(0.26, 0.4)],
  auntCass: { pos: F(0.33, 0.9), facing: 0 },
  restroom: F(0.55, 0.15),
  notes: {
    labels: [
      { pos: F(0.16, 0.2), text: 'Rooftop garden' },
      { pos: F(0.2, 0.9), text: 'Stairs' },
      { pos: F(0.55, 0.15), text: 'Bathroom' },
      { pos: F(0.66, 0.55), text: 'Workbench' },
      { pos: F(0.93, 0.18), text: 'Desk' },
      { pos: F(0.92, 0.78), text: 'Bed' },
    ],
  },
};
