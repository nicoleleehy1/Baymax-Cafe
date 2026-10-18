// Upper floors of the Lucky Cat building, traced item by item from the reference plan
// (zoomed per-floor crops of the three-floor sheet). Each floor's crop is mapped onto the
// café footprint: plan top (back wall) = −x, plan left wall = −y, plan right (bay-window
// side) = +y. Furniture keeps the plan's proportions; doorways are widened to Baymax's size.
import { v, type Vec2 } from '../../core/vec';
import { polygonWallClearance, type CircleObstacle, type LayoutDef, type Obstacle, type RectObstacle, type Seat, type Table } from '../layoutTypes';
import { LONG_DIM } from './long';

const { x0, x1, y0, y1 } = LONG_DIM;
const Lx = x1 - x0;
const Ly = y1 - y0;

/** plan-crop pixel → world, given the crop's building rectangle */
const mapper = (left: number, right: number, top: number, bottom: number) => (px: number, py: number): Vec2 =>
  v(x0 + ((py - top) / (bottom - top)) * Lx, y0 + ((px - left) / (right - left)) * Ly);

const circ = (id: string, visual: CircleObstacle['visual'], c: Vec2, r: number, facing?: number): CircleObstacle => ({ kind: 'circle', id, visual, c, r, facing });
const at = (c: Vec2, dx: number, dy: number): Vec2 => v(c.x + dx, c.y + dy);
const outer = [
  { a: v(x0, y0), b: v(x1, y0), exterior: true },
  { a: v(x1, y0), b: v(x1, y1), exterior: true },
  { a: v(x1, y1), b: v(x0, y1), exterior: true },
  { a: v(x0, y1), b: v(x0, y0), exterior: true },
];
const boundary: Vec2[] = [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];
const CHAIR_R = 0.22;

function makeKit(P: (px: number, py: number) => Vec2) {
  const rect = (id: string, visual: RectObstacle['visual'], ax: number, ay: number, bx: number, by: number, facing?: number): RectObstacle => {
    const a = P(ax, ay);
    const b = P(bx, by);
    return { kind: 'rect', id, visual, min: v(Math.min(a.x, b.x), Math.min(a.y, b.y)), max: v(Math.max(a.x, b.x), Math.max(a.y, b.y)), facing };
  };
  const seg = (ax: number, ay: number, bx: number, by: number, h?: number) => ({ a: P(ax, ay), b: P(bx, by), h });
  const rug = (id: string, ax: number, ay: number, bx: number, by: number, color: string, kind: 'rug' | 'roundRug' | 'tile' = 'rug') => {
    const a = P(ax, ay);
    const b = P(bx, by);
    return { id, kind, min: v(Math.min(a.x, b.x), Math.min(a.y, b.y)), max: v(Math.max(a.x, b.x), Math.max(a.y, b.y)), color };
  };
  const plant = (id: string, px: number, py: number, r = 0.28) => circ(id, 'plant', P(px, py), r);
  return { rect, seg, rug, plant };
}

// headings in world terms: plan "down" (toward the front) = +x, plan "right" = +y
const TO_FRONT = 0;
const TO_BACK = Math.PI;
const TO_RIGHT = Math.PI / 2;
const TO_LEFT = -Math.PI / 2;

// =====================================================================================
// Floor 2 · Aunt Cass's apartment   (crop: building spans px 165–945 × 185–1470)
// =====================================================================================
const P2 = mapper(165, 945, 185, 1470);
const K2 = makeKit(P2);

const cassWalls = [
  ...outer,
  K2.seg(300, 290, 580, 290), // study back wall (170–300 is the landing from the lower stairs)
  // study (reading room): right wall with a door to the kitchen, bottom wall with a door to the hall
  K2.seg(580, 290, 580, 380),
  K2.seg(580, 500, 580, 560),
  K2.seg(260, 560, 320, 560),
  K2.seg(430, 560, 480, 560),
  // kitchen: short left wall, then open to the living room (the diagonal on the plan is the
  // edge of the checkered floor, not a wall); bottom wall behind the fridge
  K2.seg(580, 560, 580, 640),
  K2.seg(745, 790, 880, 790),
  // bathroom box (doors on top from the hall and on the bottom into the bedroom)
  K2.seg(170, 570, 320, 570),
  K2.seg(430, 570, 480, 570),
  K2.seg(480, 570, 480, 845),
  K2.seg(170, 845, 320, 845),
  K2.seg(430, 845, 480, 845),
  // bedroom wall to the living room, with its doorway
  K2.seg(480, 850, 480, 1130),
  K2.seg(480, 1330, 480, 1470),
];

const cassObstacles: Obstacle[] = [
  K2.rect('stairs2', 'stairsUp', 170, 290, 260, 560), // down to the café
  K2.rect('stairsRoof2', 'stairsUp', 460, 200, 690, 290), // up to Hiro's floor
  K2.rect('entry2', 'landing', 700, 190, 880, 290), // back entry / landing
  K2.rect('nookBack2', 'windowSeat', 310, 190, 480, 215),
  // kitchen
  K2.rect('stove2', 'stove', 650, 345, 800, 440, TO_FRONT),
  K2.rect('counter2', 'kitchenette', 592, 440, 652, 620, TO_RIGHT),
  K2.rect('ovens2', 'shelf', 820, 450, 880, 540),
  K2.rect('nookKitchen2', 'windowSeat', 880, 400, 942, 620),
  K2.rect('fridge2', 'fridge', 770, 655, 880, 770),
  // bathroom
  K2.rect('tub2', 'tub', 185, 620, 320, 840),
  K2.rect('basin2', 'sink', 425, 655, 475, 720),
  K2.rect('toilet2', 'toilet', 385, 765, 445, 825, TO_LEFT),
  // dining
  K2.rect('dining2', 'diningTable', 672, 920, 845, 1092),
  circ('D1', 'chair', P2(758, 898), CHAIR_R, TO_FRONT),
  circ('D2', 'chair', P2(758, 1114), CHAIR_R, TO_BACK),
  circ('D3', 'chair', P2(648, 1006), CHAIR_R, TO_RIGHT),
  circ('D4', 'chair', P2(868, 1006), CHAIR_R, TO_LEFT),
  // living room by the front bay
  K2.rect('sofa2a', 'sofa', 510, 1275, 625, 1420, TO_RIGHT),
  K2.rect('sofa2b', 'sofa', 640, 1292, 845, 1410, TO_BACK),
  K2.rect('bay2', 'windowSeat', 850, 1150, 942, 1450),
  K2.rect('side2', 'squareTable', 830, 1115, 885, 1150),
  // bedroom
  K2.rect('dresser2a', 'wardrobe', 175, 870, 235, 1060),
  K2.rect('dresser2b', 'wardrobe', 175, 1100, 235, 1240),
  K2.rect('bed2', 'bed', 230, 1210, 400, 1465, TO_FRONT),
  K2.rect('night2', 'squareTable', 405, 1375, 462, 1432),
  K2.rect('bayBed2', 'windowSeat', 215, 1440, 390, 1468),
  // plants
  K2.plant('pl2a', 298, 378, 0.24),
  K2.plant('pl2b', 530, 380, 0.26),
  K2.plant('pl2c', 545, 445, 0.2),
  K2.plant('pl2d', 442, 892, 0.24),
  K2.plant('pl2e', 838, 832, 0.3),
  K2.plant('pl2f', 905, 942, 0.26),
  K2.plant('pl2g', 905, 470, 0.22),
  K2.plant('pl2h', 620, 1410, 0.22),
  K2.plant('pl2i', 740, 1432, 0.26),
  K2.plant('pl2j', 822, 1400, 0.24),
  K2.plant('pl2k', 885, 1340, 0.28),
];

const cassDecor = [
  K2.rug('rugStudy2', 320, 390, 500, 520, '#8fb7a0'),
  K2.rug('rugBed2', 240, 965, 450, 1150, '#9fc3ad'),
  K2.rug('rugLiving2', 560, 1150, 790, 1300, '#a9c9b4'),
  K2.rug('tileKitchen2', 592, 345, 880, 790, '#f1e4c8', 'tile'),
  K2.rug('tileKitchenWedge2', 592, 640, 745, 790, '#f1e4c8', 'tile'),
  K2.rug('tileBath2', 320, 575, 478, 840, '#efe6d2', 'tile'),
];

const dineSeats: Seat[] = [
  { id: 'D1', pos: P2(758, 898), facing: TO_FRONT },
  { id: 'D2', pos: P2(758, 1114), facing: TO_BACK },
  { id: 'D3', pos: P2(648, 1006), facing: TO_RIGHT },
  { id: 'D4', pos: P2(868, 1006), facing: TO_LEFT },
];
const sofaA = P2(562, 1347);
const sofaB = P2(742, 1351);
const sofaSeats: Seat[] = [
  { id: 'S1', pos: at(sofaA, -0.45, 0.1), facing: TO_RIGHT },
  { id: 'S2', pos: at(sofaA, 0.45, 0.1), facing: TO_RIGHT },
];
const sofaBSeats: Seat[] = [{ id: 'AC', pos: at(sofaB, 0.1, 0.0), facing: TO_BACK }];
const bedC = P2(315, 1337);
const DINE_C = P2(758, 1006);

const cassTables: Table[] = [
  { id: 'DIN', label: 'Dining table', c: DINE_C, seats: dineSeats, serve: at(P2(648, 1006), -0.1, -1.05) },
  { id: 'SOFA', label: 'Sofa by the window', c: sofaA, seats: sofaSeats, serve: at(sofaA, -1.55, 0) },
  { id: 'ARM', label: 'Second sofa', c: sofaB, seats: sofaBSeats, serve: at(sofaB, -1.5, 0) },
  { id: 'BED', label: 'Bedroom', c: bedC, seats: [{ id: 'BD', pos: at(bedC, 0.5, 0.2), facing: TO_RIGHT }], serve: at(bedC, -2.4, 0.2) },
  { id: 'KIT', label: 'Kitchen counter', c: P2(622, 530), seats: [], serve: at(P2(622, 530), 0, 1.05) },
  { id: 'STUDY', label: 'Reading room', c: P2(410, 455), seats: [], serve: P2(470, 455) },
];

export const CASS: LayoutDef = {
  id: 'cass',
  name: "Aunt Cass's apartment",
  floor: 2,
  carry: 'cup',
  room: { minX: x0, maxX: x1, minY: y0, maxY: y1 },
  wallClearance: polygonWallClearance([boundary], cassWalls),
  walls: cassWalls,
  obstacles: cassObstacles,
  tables: cassTables,
  extraSeats: [],
  decor: cassDecor,
  windows: [
    { a: P2(310, 185), b: P2(480, 185) },
    { a: P2(945, 400), b: P2(945, 620) },
    { a: P2(945, 1150), b: P2(945, 1450) },
    { a: P2(215, 1470), b: P2(390, 1470) },
  ],
  aisles: [{ id: 'hallway', min: P2(480, 570), max: P2(580, 1170) }],
  door: { inside: P2(300, 420), outside: P2(215, 420), a: P2(260, 290), b: P2(260, 560) },
  pickup: P2(400, 470),
  orderSpot: P2(700, 560),
  queueSpots: [P2(700, 560), P2(700, 640)],
  auntCass: { pos: P2(690, 500), facing: TO_BACK },
  restroom: P2(400, 700),
  notes: {
    labels: [
      { pos: P2(215, 420), text: 'Stairs' },
      { pos: P2(410, 420), text: 'Reading room' },
      { pos: P2(730, 560), text: 'Kitchen' },
      { pos: P2(330, 700), text: 'Bathroom' },
      { pos: P2(320, 1050), text: 'Bedroom' },
      { pos: P2(760, 1000), text: 'Dining' },
      { pos: P2(700, 1230), text: 'Living' },
    ],
  },
};

// =====================================================================================
// Floor 3 · Hiro's room + rooftop garden   (crop: building spans px 75–800 × 190–1470)
// =====================================================================================
const P3 = mapper(75, 800, 190, 1470);
const K3 = makeKit(P3);

const hiroWalls = [
  ...outer,
  // garden / room divider with the garden door next to the stairs
  K3.seg(170, 630, 220, 630),
  K3.seg(350, 630, 800, 630),
  // stair enclosure on the garden side
  K3.seg(170, 190, 170, 500),
  // bathroom (door on its right wall)
  K3.seg(80, 840, 300, 840),
  K3.seg(300, 840, 300, 860),
  K3.seg(300, 960, 300, 1130),
  K3.seg(80, 1130, 300, 1130),
];

// robot parts on the floor: the bigger piles are obstacles, the rest is left as walkable clutter
const parts3: CircleObstacle[] = [
  [640, 790], [500, 1050], [680, 1185], [760, 1360],
].map(([px, py], i) => circ(`parts${i}`, 'parts', P3(px, py), 0.17));

const hiroObstacles: Obstacle[] = [
  K3.rect('stairsGarden3', 'stairsUp', 80, 290, 170, 490), // down to the apartment (garden side)
  K3.rect('landing3', 'landing', 80, 195, 170, 290),
  K3.rect('stairsRoom3', 'stairsUp', 85, 500, 170, 770), // the flight that arrives in Hiro's room
  K3.rect('roofStairs3', 'stairsUp', 470, 190, 590, 290),
  K3.rect('shed3', 'wardrobe', 590, 190, 790, 290),
  // garden
  K3.rect('planter3a', 'planter', 305, 425, 490, 490),
  K3.rect('planter3b', 'planter', 305, 540, 490, 600),
  K3.rect('planter3c', 'planter', 690, 395, 760, 530),
  K3.rect('nookGarden3', 'windowSeat', 760, 540, 798, 620),
  K3.plant('bush3a', 230, 300, 0.34),
  K3.plant('bush3b', 310, 250, 0.3),
  K3.plant('bush3c', 400, 300, 0.34),
  K3.plant('bush3d', 600, 350, 0.3),
  K3.plant('bush3e', 730, 330, 0.3),
  K3.plant('bush3f', 700, 570, 0.3),
  // bathroom
  K3.rect('basin3', 'sink', 100, 858, 162, 905),
  K3.rect('toilet3', 'toilet', 98, 950, 168, 1012, TO_RIGHT),
  K3.rect('tub3', 'tub', 100, 1030, 290, 1120),
  // workbenches along the back wall of the room
  K3.rect('bench3a', 'workbench', 325, 650, 430, 740, TO_BACK),
  K3.rect('bench3b', 'workbench', 445, 650, 545, 780, TO_BACK),
  K3.rect('bench3c', 'workstation', 560, 655, 780, 740, TO_BACK), // two monitors, mouse, hardware
  circ('benchChair3', 'officeChair', P3(670, 800), 0.26, TO_BACK),
  K3.rect('side3', 'squareTable', 722, 760, 790, 880),
  // beds: Tadashi's by the right bay, Hiro's in the front-left bay
  K3.rect('bedRight3', 'bed', 590, 910, 798, 1080, TO_RIGHT),
  K3.rect('dresser3', 'wardrobe', 722, 1100, 790, 1200),
  K3.rect('dresserL3', 'wardrobe', 95, 1150, 230, 1185),
  K3.rect('bedLeft3', 'bed', 160, 1235, 285, 1430, TO_FRONT),
  K3.rect('shelfL3', 'bookshelf', 95, 1265, 150, 1420),
  // desk with the computer, and the chair in front of it
  K3.rect('desk3', 'desk', 325, 1345, 500, 1425, TO_FRONT),
  K3.rect('deskChair3', 'armchair', 350, 1272, 440, 1340, TO_FRONT),
  K3.rect('bayFront3', 'windowSeat', 640, 1420, 798, 1468),
  // lounge corner on the round rug: a couch facing the bay, with a beanbag beside it
  K3.rect('couch3', 'sofa', 560, 1300, 650, 1430, TO_RIGHT),
  circ('beanbag3', 'pouf', P3(690, 1290), 0.42),
  // oriental folding screen standing in the open floor
  K3.rect('divider3', 'divider', 560, 1130, 590, 1260, TO_RIGHT), // screens the lounge corner off the room
  ...parts3,
];

const hiroDecor = [
  K3.rug('rugRound3', 570, 1270, 700, 1430, '#9bbfae', 'roundRug'),
  K3.rug('tileBath3', 100, 845, 298, 1128, '#efe6d2', 'tile'),
  K3.rug('deck3', 172, 192, 798, 628, '#cdb79a', 'tile'),
];

const deskC = P3(412, 1385);
const benchC = P3(495, 715);
const bedRC = P3(695, 995);
const bedLC = P3(222, 1332);
const hiroTables: Table[] = [
  { id: 'DESK', label: "Hiro's desk", c: deskC, seats: [{ id: 'DK', pos: P3(395, 1306), facing: TO_FRONT }], serve: at(P3(395, 1306), -1.15, 0.05) },
  { id: 'WORK', label: 'Workbench', c: benchC, seats: [{ id: 'WB', pos: at(benchC, 0.85, 0), facing: TO_BACK }], serve: at(benchC, 1.5, -0.1) },
  { id: 'HBED', label: "Tadashi's bed", c: bedRC, seats: [{ id: 'HB', pos: at(bedRC, -0.3, -0.5), facing: TO_LEFT }], serve: at(bedRC, -0.3, -2.3) },
  { id: 'HBED2', label: "Hiro's bed", c: bedLC, seats: [{ id: 'HB2', pos: at(bedLC, -0.5, 0.35), facing: TO_RIGHT }], serve: at(bedLC, -1.95, 0.7) },
  { id: 'GARDEN', label: 'Rooftop garden', c: P3(400, 460), seats: [], serve: P3(600, 440) },
];

export const HIRO: LayoutDef = {
  id: 'hiro',
  name: "Hiro's room",
  floor: 3,
  carry: 'cup',
  room: { minX: x0, maxX: x1, minY: y0, maxY: y1 },
  wallClearance: polygonWallClearance([boundary], hiroWalls),
  walls: hiroWalls,
  obstacles: hiroObstacles,
  tables: hiroTables,
  extraSeats: [],
  decor: hiroDecor,
  windows: [
    { a: P3(800, 390), b: P3(800, 620) },
    { a: P3(800, 880), b: P3(800, 1100) },
    { a: P3(640, 1470), b: P3(800, 1470) },
    { a: P3(100, 1470), b: P3(320, 1470) },
    { a: P3(220, 190), b: P3(380, 190) },
  ],
  aisles: [{ id: 'garden-door', min: P3(230, 600), max: P3(340, 680) }],
  door: { inside: P3(215, 760), outside: P3(130, 760), a: P3(170, 500), b: P3(170, 770) },
  pickup: P3(260, 780),
  orderSpot: P3(300, 900),
  queueSpots: [P3(300, 900), P3(300, 980)],
  auntCass: { pos: P3(260, 1000), facing: TO_FRONT },
  restroom: P3(230, 985),
  notes: {
    labels: [
      { pos: P3(430, 300), text: 'Rooftop garden' },
      { pos: P3(125, 640), text: 'Stairs' },
      { pos: P3(190, 985), text: 'Bathroom' },
      { pos: P3(495, 715), text: 'Workbenches' },
      { pos: P3(695, 995), text: "Tadashi's bed" },
      { pos: P3(222, 1332), text: "Hiro's bed" },
      { pos: P3(412, 1385), text: 'Desk' },
    ],
  },
};
