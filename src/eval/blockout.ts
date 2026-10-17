// Top-down blockout of the active layout, drawn from the SAME layout data, nav grid and
// route generator the planner uses.  BAYMAX_LAYOUT=long npx tsx src/eval/blockout.ts out.svg
import { writeFileSync } from 'node:fs';
import type { Vec2 } from '../core/vec';
import { buildRoutes, buildZones, metersInZones } from '../planning/routes';
import { recordCustomerTrack, SimEngine } from '../sim/engine';
import { SCENARIO_ORDER, SCENARIOS } from '../sim/scenarios';
import { getRobotGrid } from '../world/grid';
import { LAYOUT, ROBOT_RADIUS, TABLES } from '../world/layout';
import { TRAY_ENVELOPE } from '../world/robotBody';

const out = process.argv[2] ?? 'blockout.svg';
const S = 46; // px per meter
const R = LAYOUT.room;
const W = (R.maxX - R.minX) * S;
const H = (R.maxY - R.minY) * S;
const X = (x: number) => ((x - R.minX) * S).toFixed(1);
const Y = (y: number) => ((y - R.minY) * S).toFixed(1); // +y (near/window side) is drawn at the bottom
const pts = (p: Vec2[]) => p.map((q) => `${X(q.x)},${Y(q.y)}`).join(' ');

const FILL: Record<string, string> = {
  kitchen: '#d9cbb4', galley: '#e7d9c2', counter: '#c99566', restroom: '#d8d1c4', bench: '#b07a4f', booth: '#c99566',
  communal: '#c99566', squareTable: '#c99566', table: '#c99566', chair: '#7e5235', post: '#5b4a40', plant: '#7f9f78',
  shelf: '#b07a4f', pastryIsland: '#c99566', staff: '#e7d9c2', kitchenSink: '#c9ced3', prepTable: '#a9a3a0', conveyorOven: '#6d6f73',
  trayRack: '#b9a58f', stairs: '#d9cbb4', office: '#d8d1c4', stove: '#55585c', fridge: '#eef0f2', dishRack: '#b9a58f',
  pastryCase: '#e7d9c2', dishCounter: '#cdbfae', espressoBar: '#c99566', boothTable: '#d08a4a',
};

function base(title: string): string[] {
  const g: string[] = [];
  g.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#f7f1e6"/>`);
  // where Baymax's centre may go (nav grid free cells, inflated by his 0.52 m footprint)
  const grid = getRobotGrid(ROBOT_RADIUS);
  for (let j = 0; j < grid.h; j++)
    for (let i = 0; i < grid.w; i++) {
      if (!grid.isFreeCell(i, j)) continue;
      const c = grid.center(i, j);
      g.push(`<rect x="${X(c.x - grid.cell / 2)}" y="${Y(c.y - grid.cell / 2)}" width="${(grid.cell * S).toFixed(1)}" height="${(grid.cell * S).toFixed(1)}" fill="#cfe9e3"/>`);
    }
  for (const o of LAYOUT.obstacles) {
    const f = FILL[o.visual] ?? '#bbb';
    if (o.kind === 'rect') g.push(`<rect x="${X(o.min.x)}" y="${Y(o.min.y)}" width="${((o.max.x - o.min.x) * S).toFixed(1)}" height="${((o.max.y - o.min.y) * S).toFixed(1)}" fill="${f}" stroke="#6b4630" stroke-width="1" rx="3"/>`);
    else g.push(`<circle cx="${X(o.c.x)}" cy="${Y(o.c.y)}" r="${(o.r * S).toFixed(1)}" fill="${f}" stroke="#4a3426" stroke-width="1"/>`);
  }
  for (const w of LAYOUT.walls) g.push(`<line x1="${X(w.a.x)}" y1="${Y(w.a.y)}" x2="${X(w.b.x)}" y2="${Y(w.b.y)}" stroke="#4a3426" stroke-width="6" stroke-linecap="round"/>`);
  for (const a of LAYOUT.aisles)
    g.push(`<rect x="${X(a.min.x)}" y="${Y(a.min.y)}" width="${((a.max.x - a.min.x) * S).toFixed(1)}" height="${((a.max.y - a.min.y) * S).toFixed(1)}" fill="none" stroke="#3a8fb7" stroke-dasharray="6 4" stroke-width="1.5"/>`);
  for (const l of LAYOUT.notes?.labels ?? []) g.push(`<text x="${X(l.pos.x)}" y="${Y(l.pos.y)}" font-size="13" fill="#4a3426" text-anchor="middle" font-family="Nunito, sans-serif">${l.text}</text>`);
  for (const t of TABLES) g.push(`<text x="${X(t.c.x)}" y="${Y(t.c.y) }" dy="4" font-size="10" fill="#3a2a20" text-anchor="middle" font-family="Nunito, sans-serif">${t.id}</text>`);
  // Baymax at the pickup: collision footprint + carried tray
  const p = LAYOUT.pickup;
  g.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(ROBOT_RADIUS * S).toFixed(1)}" fill="rgba(255,255,255,0.85)" stroke="#2ec4b6" stroke-width="2.5"/>`);
  g.push(`<circle cx="${X(p.x + TRAY_ENVELOPE.z)}" cy="${Y(p.y)}" r="${(TRAY_ENVELOPE.r * S).toFixed(1)}" fill="#7e5235"/>`);
  g.push(`<text x="${X(p.x)}" y="${Y(p.y - 0.62)}" font-size="11" text-anchor="middle" fill="#1f6f66" font-family="Nunito, sans-serif">Baymax 0.52 m footprint (tray inside)</text>`);
  const n = LAYOUT.notes;
  if (n?.yieldPoint) {
    g.push(`<circle cx="${X(n.yieldPoint.x)}" cy="${Y(n.yieldPoint.y)}" r="9" fill="#ffb347" stroke="#a35a00" stroke-width="2"/>`);
    g.push(`<text x="${X(n.yieldPoint.x)}" y="${Y(n.yieldPoint.y + 0.42)}" font-size="11" text-anchor="middle" fill="#a35a00" font-family="Nunito, sans-serif">narrow yielding point</text>`);
  }
  if (n?.waitingSpace) {
    g.push(`<circle cx="${X(n.waitingSpace.x)}" cy="${Y(n.waitingSpace.y)}" r="${(ROBOT_RADIUS * S).toFixed(1)}" fill="none" stroke="#a35a00" stroke-dasharray="4 3" stroke-width="2"/>`);
    g.push(`<text x="${X(n.waitingSpace.x)}" y="${Y(n.waitingSpace.y - 0.62)}" font-size="11" text-anchor="middle" fill="#a35a00" font-family="Nunito, sans-serif">waiting space</text>`);
  }
  g.push(`<text x="12" y="22" font-size="17" font-weight="800" fill="#2a211c" font-family="Nunito, sans-serif">${title}</text>`);
  return g;
}

const panels: string[] = [];
if (process.argv.includes('--plain')) {
  panels.push(`<g>${base(`${LAYOUT.name} · layout only`).join('')}</g>`);
}
const report: string[] = [];
const CUST = ['#d86f7e', '#5d8fc9', '#e9a23b', '#8a6bb0', '#3f9c9a', '#7fa37a'];
for (const id of process.argv.includes('--plain') ? [] : SCENARIO_ORDER) {
  const sc = SCENARIOS[id];
  const g = base(`${LAYOUT.name} · ${sc.title}: ${sc.subtitle}`);
  // customer routes (recorded, exogenous)
  const track = recordCustomerTrack(sc);
  sc.customers.forEach((c, k) => {
    const path = track.frames.filter((_, i) => i % 6 === 0).map((f) => f.find((h) => h.id === c.id)!).filter((h) => h.visible).map((h) => h.pos);
    if (path.length > 1) g.push(`<polyline points="${pts(path)}" fill="none" stroke="${CUST[k % CUST.length]}" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/>`);
    const p0 = path[0] ?? c.start.pos;
    g.push(`<circle cx="${X(p0.x)}" cy="${Y(p0.y)}" r="${(0.25 * S).toFixed(1)}" fill="${CUST[k % CUST.length]}" stroke="#fff" stroke-width="1.5"/>`);
    g.push(`<text x="${X(p0.x)}" y="${Y(p0.y)}" dy="3.5" font-size="9" fill="#fff" text-anchor="middle" font-family="Nunito, sans-serif">${c.name[0]}</text>`);
  });
  // delivery destination
  const dest = TABLES.find((t) => t.id === sc.delivery.tableId)!.serve;
  g.push(`<circle cx="${X(dest.x)}" cy="${Y(dest.y)}" r="${(ROBOT_RADIUS * S).toFixed(1)}" fill="none" stroke="#d9603b" stroke-width="2.5"/>`);
  g.push(`<text x="${X(dest.x)}" y="${Y(dest.y)}" dy="4" font-size="11" font-weight="800" text-anchor="middle" fill="#d9603b" font-family="Nunito, sans-serif">deliver</text>`);
  // the planner's own route variants from the moment the order is assigned
  const eng = new SimEngine(sc, { mode: 'evaluation', track });
  while (eng.robot.phase === 'waiting') eng.step();
  const obs = eng.observe();
  const zones = buildZones(obs.groups, obs.humans);
  for (const z of zones)
    for (const s of z.segments)
      g.push(`<line x1="${X(s.a.x)}" y1="${Y(s.a.y)}" x2="${X(s.b.x)}" y2="${Y(s.b.y)}" stroke="rgba(255,207,92,0.55)" stroke-width="${(2 * z.radius * S).toFixed(1)}" stroke-linecap="round"/>`);
  const routes = buildRoutes({ start: obs.robot.pos, goal: obs.goal!, zones, humans: obs.humans, stuckFor: 0 });
  for (const r of routes) {
    const conv = metersInZones(r.pts, zones);
    const color = r.kind === 'direct' ? '#ff7a59' : '#2ec4b6';
    g.push(`<polyline points="${pts(r.pts)}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`);
    report.push(`${id}: ${r.id} length ${r.length.toFixed(2)} m, conversation ${conv.toFixed(2)} m`);
  }
  g.push(`<text x="12" y="${H - 12}" font-size="12" fill="#2a211c" font-family="Nunito, sans-serif">orange = shortest route (through)   teal = around   yellow = conversation area   light teal = where Baymax's centre fits   dotted = recorded customer paths   dashed blue = annotated aisles</text>`);
  panels.push(`<g>${g.join('')}</g>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H * panels.length + 12 * (panels.length - 1)}">${panels
  .map((p, i) => `<g transform="translate(0 ${i * (H + 12)})">${p}</g>`)
  .join('')}</svg>`;
writeFileSync(out, svg);
console.log(report.join('\n'));
console.log(`wrote ${out}`);
