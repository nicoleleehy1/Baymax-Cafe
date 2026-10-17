// Global route variants on the floor plane. The planner never decides here; it only
// constructs geometric alternatives (shortest route, a route that skirts annotated
// conversation areas, and a people-aware reroute when stuck). Choosing between them is
// done by the learned trajectory scoring.
import type { ConversationZone, ObservedHuman, SocialGroup } from '../core/types';
import { dist, pointSegment, sub, norm, type Vec2 } from '../core/vec';
import { getRobotGrid, polylineLength } from '../world/grid';
import { HUMAN_RADIUS, ROBOT_RADIUS } from '../world/layout';

export interface Route {
  id: string;
  kind: 'direct' | 'detour';
  groupId?: string;
  pts: Vec2[];
  cum: number[];
  length: number;
}

export const ZONE_RADIUS = 0.6;

export function makeRoute(id: string, kind: Route['kind'], pts: Vec2[], groupId?: string): Route {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { id, kind, groupId, pts, cum, length: cum[cum.length - 1] };
}

export function projectOnRoute(r: Route, p: Vec2): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < r.pts.length; i++) {
    const { d, t } = pointSegment(p, r.pts[i - 1], r.pts[i]);
    if (d < best.d - 1e-9) best = { s: r.cum[i - 1] + t * (r.cum[i] - r.cum[i - 1]), d };
  }
  if (r.pts.length === 1) best = { s: 0, d: dist(p, r.pts[0]) };
  return best;
}

export function pointAt(r: Route, s: number): { p: Vec2; tan: Vec2 } {
  if (r.pts.length === 1) return { p: r.pts[0], tan: { x: 1, y: 0 } };
  const ss = Math.max(0, Math.min(r.length, s));
  let i = 1;
  while (i < r.pts.length - 1 && r.cum[i] < ss) i++;
  const a = r.pts[i - 1];
  const b = r.pts[i];
  const segL = r.cum[i] - r.cum[i - 1];
  const t = segL > 1e-9 ? (ss - r.cum[i - 1]) / segL : 0;
  return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, tan: norm(sub(b, a)) };
}

export function routeTail(r: Route, s: number, step = 0.25): Vec2[] {
  const out: Vec2[] = [];
  for (let x = s; x < r.length; x += step) out.push(pointAt(r, x).p);
  out.push(r.pts[r.pts.length - 1]);
  return out;
}

/** Conversation zones derived from annotated groups + the members' observed positions. */
export function buildZones(groups: SocialGroup[], humans: ObservedHuman[]): ConversationZone[] {
  const byId = new Map(humans.map((h) => [h.id, h]));
  const zones: ConversationZone[] = [];
  for (const g of groups) {
    const ms = g.memberIds.map((id) => byId.get(id)).filter((h): h is ObservedHuman => !!h);
    if (ms.length < 2) continue;
    const segments: { a: Vec2; b: Vec2 }[] = [];
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) segments.push({ a: ms[i].pos, b: ms[j].pos });
    const centroid = {
      x: ms.reduce((s, m) => s + m.pos.x, 0) / ms.length,
      y: ms.reduce((s, m) => s + m.pos.y, 0) / ms.length,
    };
    zones.push({ groupId: g.id, segments, radius: ZONE_RADIUS, centroid });
  }
  return zones;
}

export function inZone(p: Vec2, z: ConversationZone, extra = 0): boolean {
  for (const s of z.segments) if (pointSegment(p, s.a, s.b).d < z.radius + extra) return true;
  return false;
}

/** Meters of a polyline that lie inside any zone (segment midpoint test, subdivided). */
export function metersInZones(pts: Vec2[], zones: ConversationZone[]): number {
  if (zones.length === 0) return 0;
  let m = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const L = dist(a, b);
    if (L < 1e-6) continue;
    const n = Math.max(1, Math.ceil(L / 0.1));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      for (const z of zones) {
        if (inZone(p, z)) {
          m += L / n;
          break;
        }
      }
    }
  }
  return m;
}

export interface RouteRequest {
  start: Vec2;
  goal: Vec2;
  zones: ConversationZone[];
  humans: ObservedHuman[];
  stuckFor: number;
}

export function buildRoutes(req: RouteRequest): Route[] {
  const grid = getRobotGrid(ROBOT_RADIUS);
  const routes: Route[] = [];
  const directPts = grid.findPath(req.start, req.goal);
  if (!directPts) return routes;
  const direct = makeRoute('direct', 'direct', directPts);
  routes.push(direct);
  const directConv = metersInZones(direct.pts, req.zones);

  // Skirt all conversation areas the direct route passes through (soft cost on zone cells).
  const crossed = req.zones.filter((z) => metersInZones(direct.pts, [z]) > 0.01 || nearPolyline(direct.pts, z, 0.35));
  if (crossed.length > 0) {
    const pad = 0.4;
    const pts = grid.findPath(req.start, req.goal, (p) => {
      for (const z of crossed) if (inZone(p, z, pad)) return 25;
      return 0;
    });
    if (pts) {
      const r = makeRoute(`around:${crossed.map((z) => z.groupId).join('+')}`, 'detour', pts, crossed[0].groupId);
      const conv = metersInZones(r.pts, req.zones);
      if (conv < directConv - 0.1 && r.length < direct.length + 9) routes.push(r);
    }
  }

  // Deadlock breaker: after waiting a while, also offer a route that treats nearby people as obstacles.
  if (req.stuckFor > 3) {
    const near = req.humans.filter((h) => dist(h.pos, req.start) < 4);
    if (near.length > 0) {
      const rr = ROBOT_RADIUS + HUMAN_RADIUS + 0.25;
      const pts = grid.findPath(req.start, req.goal, (p) => {
        for (const h of near) if (dist(p, h.pos) < rr) return 40;
        return 0;
      });
      if (pts && polylineLength(pts) < direct.length + 10) routes.push(makeRoute('reroute', 'detour', pts));
    }
  }
  return routes;
}

function nearPolyline(pts: Vec2[], z: ConversationZone, extra: number): boolean {
  for (let i = 1; i < pts.length; i++) {
    for (const s of z.segments) {
      // sample along the polyline segment
      const L = dist(pts[i - 1], pts[i]);
      const n = Math.max(1, Math.ceil(L / 0.15));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
        if (pointSegment(p, s.a, s.b).d < z.radius + extra) return true;
      }
    }
  }
  return false;
}
