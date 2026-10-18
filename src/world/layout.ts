// Active café layout. Everything here is static geometry shared by the simulation, the
// planner (as its map) and the renderer. Units are meters; floor plane uses (x, y=worldZ).
// Select with ?layout=long|cass|hiro or ?floor=1|2|3 (browser), BAYMAX_LAYOUT=… (Node). Default: classic.
import type { Vec2 } from '../core/vec';
import { obstacleClearance, type LayoutDef, type Table } from './layoutTypes';
import { CLASSIC } from './layouts/classic';
import { LONG } from './layouts/long';
import { CASS, HIRO } from './layouts/upper';

export * from './layoutTypes';

export const LAYOUTS: Record<LayoutDef['id'], LayoutDef> = { classic: CLASSIC, long: LONG, cass: CASS, hiro: HIRO };
/** The Lucky Cat building, bottom to top. */
export const BUILDING: LayoutDef[] = [LONG, CASS, HIRO];
export const FLOOR_HEIGHT = 3.4;
const FLOOR_IDS: Record<string, LayoutDef['id']> = { '1': 'long', '2': 'cass', '3': 'hiro' };

function pickLayout(): LayoutDef {
  const g = globalThis as { __BAYMAX_LAYOUT?: string; name?: string; location?: { search: string }; process?: { env: Record<string, string | undefined> } };
  // the planning worker is started with name "layout=<id>" so it uses the same map as the page
  const fromWorkerName = typeof g.name === 'string' && g.name.startsWith('layout=') ? g.name.slice(7) : null;
  const params = g.location ? new URLSearchParams(g.location.search) : null;
  // ?floor=2 selects a storey of the building; ?layout=classic keeps the original café
  const fromFloor = params?.get('floor') ? FLOOR_IDS[params.get('floor')!] : null;
  const fromUrl = params?.get('layout') ?? null;
  const id = g.__BAYMAX_LAYOUT ?? fromWorkerName ?? fromFloor ?? fromUrl ?? g.process?.env?.BAYMAX_LAYOUT ?? 'classic';
  return LAYOUTS[id as LayoutDef['id']] ?? CLASSIC;
}

export const LAYOUT: LayoutDef = pickLayout();
export const LAYOUT_ID = LAYOUT.id;
export const ROOM = LAYOUT.room;
export const TABLES = LAYOUT.tables;
export const OBSTACLES = LAYOUT.obstacles;
export const AISLES = LAYOUT.aisles;
export const DOOR = LAYOUT.door;
export const PICKUP = LAYOUT.pickup;
export const ORDER_SPOT = LAYOUT.orderSpot;
export const QUEUE_SPOTS = LAYOUT.queueSpots;
export const AUNT_CASS = LAYOUT.auntCass;
export const wallClearance = LAYOUT.wallClearance;

export function tableById(id: string): Table {
  const t = TABLES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown table ${id}`);
  return t;
}

export function seatById(id: string): { pos: Vec2; facing: number; table: Table | null } {
  for (const t of TABLES) {
    const s = t.seats.find((x) => x.id === id);
    if (s) return { ...s, table: t };
  }
  const e = LAYOUT.extraSeats.find((x) => x.id === id);
  if (e) return { ...e, table: null };
  throw new Error(`unknown seat ${id}`);
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
