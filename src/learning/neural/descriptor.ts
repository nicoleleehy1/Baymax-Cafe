// Trajectory descriptor: what the neural reward model sees for one candidate. Richer than the six
// hand-made cost features: it also gets a 10-step timeline of the rollout (closeness to predicted
// people, being inside a conversation area, speed, aisle occupancy) and what kind of maneuver it is.
// Built only from PlanResult data, so the planner itself is unchanged.
import type { CandidateSummary, PlanResult } from '../../core/types';
import { dist, len } from '../../core/vec';
import { inZone, metersInZones } from '../../planning/routes';
import { AISLES, inRect, ROBOT_RADIUS } from '../../world/layout';

export const TIMELINE_STEPS = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
const VMAX = 0.9;
const COMFORT = 0.9;
const MANEUVERS = ['go', 'yield', 'stepAside', 'backOff'] as const;

export const DESCRIPTOR_NAMES: string[] = [
  'f.delay', 'f.proximity', 'f.conversation', 'f.speedNear', 'f.aisle', 'f.abrupt',
  ...TIMELINE_STEPS.map((k) => `close@${k}`),
  ...TIMELINE_STEPS.map((k) => `inConv@${k}`),
  ...TIMELINE_STEPS.map((k) => `speed@${k}`),
  ...TIMELINE_STEPS.map((k) => `inAisle@${k}`),
  'tailConvMeters', 'tailLength', 'minClearance',
  'speedFrac', 'absOffset', 'detour', ...MANEUVERS.map((m) => `m.${m}`),
];
export const DESCRIPTOR_DIM = DESCRIPTOR_NAMES.length;

export function describe(c: CandidateSummary, r: PlanResult): number[] {
  const x: number[] = [...c.features];
  const close: number[] = [];
  const conv: number[] = [];
  const speed: number[] = [];
  const aisle: number[] = [];
  for (const k of TIMELINE_STEPS) {
    const p = c.pts[Math.min(k, c.pts.length - 1)];
    const v = c.vels[Math.min(k, c.vels.length - 1)];
    let cl = 0;
    for (const h of r.predictions) {
      let e = 0;
      for (const hy of h.hyps) {
        const q = hy.pts[Math.min(k, hy.pts.length - 1)];
        const gap = dist(p, q) - ROBOT_RADIUS - h.radius;
        e += hy.prob * Math.max(0, 1 - Math.max(0, gap) / COMFORT);
      }
      cl = Math.max(cl, e);
    }
    close.push(cl);
    conv.push(r.zones.some((z) => inZone(p, z)) ? 1 : 0);
    speed.push(len(v) / VMAX);
    aisle.push(AISLES.some((a) => inRect(p, a.min, a.max, ROBOT_RADIUS * 0.5)) ? 1 : 0);
  }
  let tailLen = 0;
  for (let i = 1; i < c.tail.length; i++) tailLen += dist(c.tail[i - 1], c.tail[i]);
  x.push(...close, ...conv, ...speed, ...aisle);
  x.push(metersInZones(c.tail, r.zones), tailLen, Math.min(2, Number.isFinite(c.minClearance) ? c.minClearance : 2));
  x.push(c.meta.speedFrac, Math.abs(c.meta.offset), c.meta.routeKind === 'detour' ? 1 : 0, ...MANEUVERS.map((m) => (c.meta.maneuver === m ? 1 : 0)));
  return x;
}
