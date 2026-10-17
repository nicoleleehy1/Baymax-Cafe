// Receding-horizon, prediction-aware, preference-scored local planner.
//
//  observation → predict humans → global route variants → candidate rollouts
//  → collision rejection (hard constraint) → feature extraction → learned scoring
//  (+ authored hysteresis) → choose → (optionally) propose a teaching query
import type {
  CandidateMeta,
  CandidateSummary,
  ConversationZone,
  HumanPrediction,
  Observation,
  PlanResult,
  QueryPair,
} from '../core/types';
import { add, clampLen, dist, len, norm, perp, scale, sub, wrapAngle, angleOf, type Vec2 } from '../core/vec';
import { utility, NF } from '../learning/model';
import { predictAll, PRED_DT, PRED_STEPS } from '../prediction/predictor';
import { getRobotGrid } from '../world/grid';
import { AISLES, inRect, ROBOT_RADIUS } from '../world/layout';
import { buildRoutes, buildZones, metersInZones, pointAt, projectOnRoute, routeTail, type Route } from './routes';

export const ROBOT = {
  vmax: 0.9,
  aMax: 0.7,
  aYield: 0.9,
  aBrake: 1.6,
  turnRate: 1.6,
  vNominal: 0.8,
};

export const PLAN = {
  dt: PRED_DT,
  steps: PRED_STEPS,
  horizon: PRED_DT * PRED_STEPS,
  hardCheckSteps: 25, // collision rejection over the first 2.5 s
  comfortClearance: 0.9,
  delayUnit: 3,
  speedFracs: [1.0, 0.65, 0.35],
  offsets: [0, -0.35, 0.35, -0.7, 0.7],
  routeSwitchPenalty: 0.35,
  maneuverSwitchPenalty: 0.08,
};

export interface PlanInput {
  reqId: number;
  epoch: number;
  modelRevision?: number;
  /** layout the observation came from; the worker refuses to plan on a different map */
  layoutId?: string;
  obs: Observation;
  weights: number[];
  initialWeights: number[];
  prev: CandidateMeta | null;
  stuckFor: number;
  allowQuery: boolean;
}

interface Rollout {
  pts: Vec2[];
  vels: Vec2[];
  arrivedAt: number | null;
  endRouteS: number;
}

// ------------------------------------------------------------------ rollouts

function rolloutGo(start: Observation['robot'], route: Route, goal: Vec2, speedFrac: number, offset: number): Rollout {
  const pts: Vec2[] = [{ ...start.pos }];
  const vels: Vec2[] = [{ ...start.vel }];
  let p = { ...start.pos };
  let vel = { ...start.vel };
  const s0 = projectOnRoute(route, p).s;
  let sCur = s0;
  let arrivedAt: number | null = null;
  const offsetAt = (s: number): number => {
    const ds = s - s0;
    const rampIn = Math.min(1, Math.max(0, ds / 0.8));
    const rampOut = Math.min(1, Math.max(0, (route.length - s) / 1.4));
    return offset * smooth01(rampIn) * smooth01(rampOut);
  };
  for (let k = 1; k <= PLAN.steps; k++) {
    // local projection search near previous s
    sCur = Math.max(sCur, projectOnRoute(route, p).s);
    const remaining = route.length - sCur + Math.max(0, dist(p, pointAt(route, sCur).p) - 0.05);
    const look = Math.min(route.length, sCur + 0.6 + 0.4 * len(vel));
    const { p: rp, tan } = pointAt(route, look);
    const target = remaining < 0.6 ? goal : add(rp, scale(perp(tan), offsetAt(look)));
    const toT = sub(target, p);
    const dT = len(toT);
    let speed = Math.min(ROBOT.vmax * speedFrac, Math.sqrt(2 * ROBOT.aMax * 0.8 * Math.max(0, dist(p, goal) - 0.03)));
    if (dT < 1e-3) speed = 0;
    let dir = norm(toT);
    const vlen = len(vel);
    if (vlen > 0.05) {
      const cur = angleOf(vel);
      const dAng = wrapAngle(angleOf(dir) - cur);
      const maxTurn = ROBOT.turnRate * PLAN.dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, dAng));
      dir = { x: Math.cos(cur + turn), y: Math.sin(cur + turn) };
      speed *= Math.max(0.35, Math.cos(dAng)); // careful turning with the tray
    }
    const desired = scale(dir, speed);
    vel = add(vel, clampLen(sub(desired, vel), ROBOT.aMax * PLAN.dt));
    p = add(p, scale(vel, PLAN.dt));
    if (arrivedAt === null && dist(p, goal) < 0.08) arrivedAt = k * PLAN.dt;
    pts.push(p);
    vels.push(vel);
  }
  return { pts, vels, arrivedAt, endRouteS: projectOnRoute(route, p).s };
}

function rolloutToPoint(start: Observation['robot'], route: Route, target: Vec2 | null, speedMax: number, decel: number): Rollout {
  const pts: Vec2[] = [{ ...start.pos }];
  const vels: Vec2[] = [{ ...start.vel }];
  let p = { ...start.pos };
  let vel = { ...start.vel };
  for (let k = 1; k <= PLAN.steps; k++) {
    let desired = { x: 0, y: 0 };
    let accel = decel;
    if (target) {
      const toT = sub(target, p);
      const d = len(toT);
      const sp = Math.min(speedMax, Math.sqrt(2 * 0.5 * Math.max(0, d - 0.02)));
      // shed existing forward velocity first (yield-like), then move to the waiting spot
      desired = scale(norm(toT), sp);
      accel = ROBOT.aMax;
    }
    vel = add(vel, clampLen(sub(desired, vel), accel * PLAN.dt));
    p = add(p, scale(vel, PLAN.dt));
    pts.push(p);
    vels.push(vel);
  }
  return { pts, vels, arrivedAt: null, endRouteS: projectOnRoute(route, p).s };
}

const smooth01 = (t: number): number => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ features & safety

interface Evaluated {
  features: number[];
  safe: boolean;
  rejectReason?: 'static' | 'human';
  minClearance: number;
}

function evaluate(
  ro: Rollout,
  route: Route,
  directRemaining: number,
  preds: HumanPrediction[],
  zones: ConversationZone[],
  tail: Vec2[],
): Evaluated {
  const grid = getRobotGrid(ROBOT_RADIUS);
  const H = PLAN.horizon;
  const dt = PLAN.dt;
  let safe = true;
  let rejectReason: Evaluated['rejectReason'];
  let minClear = Infinity;
  let prox = 0;
  let speedNear = 0;
  let aisle = 0;
  let abrupt = 0;

  for (let k = 1; k <= PLAN.steps; k++) {
    const p = ro.pts[k];
    const vel = ro.vels[k];
    const sp = len(vel);
    const t = k * dt;
    if (safe && !grid.isFreePoint(p)) {
      // allow tiny penetration only if already there at start (numerical), otherwise reject
      safe = false;
      rejectReason = 'static';
    }
    let closeSum = 0;
    for (const h of preds) {
      let eClose = 0;
      for (const hy of h.hyps) {
        const q = hy.pts[k];
        const c = dist(p, q) - ROBOT_RADIUS - h.radius;
        if (hy.prob >= 0.12 && k <= PLAN.hardCheckSteps) {
          const margin = 0.05 + h.sigma[k];
          if (c - margin < 0 && safe) {
            safe = false;
            rejectReason = 'human';
          }
        }
        if (hy.label === 'continue' || hy.label === 'stationary') minClear = Math.min(minClear, c);
        eClose += hy.prob * Math.max(0, 1 - Math.max(0, c) / PLAN.comfortClearance);
      }
      closeSum += eClose;
    }
    prox += closeSum * dt;
    speedNear += closeSum * (sp / ROBOT.vmax) * dt;

    for (const a of AISLES) {
      if (inRect(p, a.min, a.max, ROBOT_RADIUS * 0.5)) {
        let others = 0;
        for (const h of preds) {
          const q = h.hyps[0].pts[k];
          if (inRect(q, a.min, a.max, 1.2)) others = 1;
        }
        aisle += (0.3 + others) * (sp < 0.1 ? 1.5 : 1) * dt;
      }
    }

    const a = sub(vel, ro.vels[k - 1]);
    const acc = len(a) / dt;
    abrupt += 0.5 * (acc / ROBOT.aMax) ** 2 * dt;
    if (sp > 0.1 && len(ro.vels[k - 1]) > 0.1) {
      abrupt += (Math.abs(wrapAngle(angleOf(vel) - angleOf(ro.vels[k - 1]))) / Math.PI) * (sp / ROBOT.vmax) * 2;
    }
    void t;
  }

  // Delay: expected arrival time vs. the shortest route from the current position.
  let tEst: number;
  if (ro.arrivedAt !== null) tEst = ro.arrivedAt;
  else {
    const end = ro.pts[ro.pts.length - 1];
    const lateral = dist(end, pointAt(route, ro.endRouteS).p);
    const endSpeed = len(ro.vels[ro.vels.length - 1]);
    const restart = endSpeed < 0.2 ? 0.6 : 0;
    tEst = H + (route.length - ro.endRouteS + lateral) / ROBOT.vNominal + restart;
  }
  const tBase = directRemaining / ROBOT.vNominal;
  const delay = (tEst - tBase) / PLAN.delayUnit;

  const conv = metersInZones(ro.pts, zones) + metersInZones(tail, zones);

  const features = [delay, prox / H, conv, speedNear / H, aisle / H, abrupt / H];
  return { features, safe, rejectReason, minClearance: minClear };
}

// ------------------------------------------------------------------ labels

function labelFor(meta: CandidateMeta, conv: number): string {
  const slow = meta.speedFrac < 0.5 ? ' slowly' : meta.speedFrac < 0.9 ? ', a little slower' : '';
  // offset sign: +perp(tangent) is Baymax's right in the café's floor coordinates
  const sideOf = (o: number): string => (o > 0 ? 'right' : 'left');
  switch (meta.maneuver) {
    case 'yield':
      return 'Wait here';
    case 'stepAside':
      return `Step aside to the ${meta.side}`;
    case 'backOff':
      return 'Step back';
    default:
      break;
  }
  if (meta.routeKind === 'detour') {
    if (meta.routeId === 'reroute') return `Reroute around people${slow}`;
    return `Go around the conversation${slow}`;
  }
  if (conv > 0.05) return `Pass between the people talking${slow}`;
  if (meta.offset !== 0) return `Pass on the ${sideOf(meta.offset)}${slow}`;
  return meta.speedFrac >= 0.9 ? 'Head straight to the table' : `Continue${slow}`;
}

// ------------------------------------------------------------------ planner

export function plan(input: PlanInput): PlanResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { obs } = input;
  const preds = predictAll(obs.humans);
  const zones = buildZones(obs.groups, obs.humans);
  const result: PlanResult = {
    reqId: input.reqId,
    epoch: input.epoch,
    modelRevision: input.modelRevision ?? 0,
    tObs: obs.t,
    robotHeading: obs.robot.heading,
    chosen: -1,
    noSafe: false,
    candidates: [],
    predictions: preds,
    zones,
    query: null,
    latencyMs: 0,
    chosenUnderInitial: -1,
  };
  if (!obs.goal) {
    result.latencyMs = now() - t0;
    return result;
  }
  const goal = obs.goal;
  const routes = buildRoutes({ start: obs.robot.pos, goal, zones, humans: obs.humans, stuckFor: input.stuckFor });
  if (routes.length === 0) {
    result.noSafe = true;
    result.latencyMs = now() - t0;
    return result;
  }
  const directRemaining = routes[0].length;
  const grid = getRobotGrid(ROBOT_RADIUS);

  const push = (meta: CandidateMeta, ro: Rollout, route: Route): void => {
    const tail = ro.arrivedAt !== null ? [] : routeTail(route, ro.endRouteS);
    const ev = evaluate(ro, route, directRemaining, preds, zones, tail);
    const u = utility(input.weights, ev.features);
    const u0 = utility(input.initialWeights, ev.features);
    let hyst = 0;
    if (input.prev) {
      if (input.prev.routeId !== meta.routeId) hyst += PLAN.routeSwitchPenalty;
      if (input.prev.maneuver !== meta.maneuver) hyst += PLAN.maneuverSwitchPenalty;
    }
    result.candidates.push({
      index: result.candidates.length,
      meta,
      label: labelFor(meta, ev.features[2]),
      pts: ro.pts,
      vels: ro.vels,
      tail,
      safe: ev.safe,
      rejectReason: ev.rejectReason,
      minClearance: ev.minClearance,
      features: ev.features,
      utility: u,
      utility0: u0,
      hysteresis: hyst,
      total: u - hyst,
    });
  };

  for (const route of routes) {
    const base = { routeId: route.id, routeKind: route.kind, groupId: route.groupId } as const;
    for (const sf of PLAN.speedFracs) {
      for (const off of PLAN.offsets) {
        push({ ...base, maneuver: 'go', speedFrac: sf, offset: off }, rolloutGo(obs.robot, route, goal, sf, off), route);
      }
    }
    if (route.kind === 'direct') {
      push({ ...base, maneuver: 'yield', speedFrac: 0, offset: 0 }, rolloutToPoint(obs.robot, route, null, 0, ROBOT.aYield), route);
      const { tan } = pointAt(route, projectOnRoute(route, obs.robot.pos).s);
      const right = perp(tan);
      for (const side of ['left', 'right'] as const) {
        const n = side === 'right' ? right : scale(right, -1);
        const spot = add(obs.robot.pos, scale(n, 0.7));
        if (grid.isFreePoint(spot))
          push({ ...base, maneuver: 'stepAside', side, speedFrac: 0.35, offset: 0 }, rolloutToPoint(obs.robot, route, spot, 0.35, ROBOT.aYield), route);
      }
      const heading = { x: Math.cos(obs.robot.heading), y: Math.sin(obs.robot.heading) };
      const back = sub(obs.robot.pos, scale(heading, 0.55));
      // only a real step back when nearly stopped; at speed it would just be a hard brake
      if (len(obs.robot.vel) < 0.3 && grid.isFreePoint(back))
        push({ ...base, maneuver: 'backOff', speedFrac: 0.3, offset: 0 }, rolloutToPoint(obs.robot, route, back, 0.3, ROBOT.aYield), route);
    }
  }

  const safeIdx = result.candidates.filter((c) => c.safe).map((c) => c.index);
  if (safeIdx.length === 0) {
    // No safe candidate: stop as quickly as allowed. Simulation behavior, not a safety guarantee.
    result.noSafe = true;
    const stop = rolloutToPoint(obs.robot, routes[0], null, 0, ROBOT.aBrake);
    const meta: CandidateMeta = { routeId: 'direct', routeKind: 'direct', maneuver: 'yield', speedFrac: 0, offset: 0 };
    push(meta, stop, routes[0]);
    const c = result.candidates[result.candidates.length - 1];
    c.label = 'Stop (no safe option)';
    result.chosen = c.index;
    result.chosenUnderInitial = c.index;
    result.latencyMs = now() - t0;
    return result;
  }

  result.chosen = argmax(safeIdx, (i) => result.candidates[i].total);
  result.chosenUnderInitial = argmax(safeIdx, (i) => result.candidates[i].utility0);

  if (input.allowQuery) result.query = selectQuery(result, obs, zones);
  result.latencyMs = now() - t0;
  return result;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function argmax(ids: number[], f: (i: number) => number): number {
  let best = ids[0];
  let bv = -Infinity;
  for (const i of ids) {
    const v = f(i);
    if (v > bv) {
      bv = v;
      best = i;
    }
  }
  return best;
}

export const QUERY = { maxGap: 1.2, minFeatureDistance: 0.3, minSocialDiff: 0.25, socialRange: 3.2 };

/**
 * Active-learning query heuristic (not a calibrated uncertainty estimate):
 * pair the chosen trajectory with the best representative of a *different* behavior class
 * whose score is close but whose social consequences differ meaningfully.
 */
export function selectQuery(r: PlanResult, obs: Observation, zones: ConversationZone[]): QueryPair | null {
  const nearSocial =
    zones.some((z) => dist(z.centroid, obs.robot.pos) < QUERY.socialRange) || obs.humans.some((h) => dist(h.pos, obs.robot.pos) < 2.5);
  if (!nearSocial) return null;
  const A = r.candidates[r.chosen];
  const classOf = (c: CandidateSummary): string => `${c.meta.routeId}|${c.meta.maneuver}|${c.label.split(',')[0].replace(' slowly', '')}`;
  const bestByClass = new Map<string, CandidateSummary>();
  for (const c of r.candidates) {
    if (!c.safe) continue;
    const k = classOf(c);
    const cur = bestByClass.get(k);
    if (!cur || c.utility > cur.utility) bestByClass.set(k, c);
  }
  let best: QueryPair | null = null;
  for (const [k, B] of bestByClass) {
    if (k === classOf(A)) continue;
    let fd = 0;
    for (let i = 0; i < NF; i++) fd += Math.abs(A.features[i] - B.features[i]);
    const social = Math.abs(A.features[1] - B.features[1]) + Math.abs(A.features[2] - B.features[2]) + Math.abs(A.features[3] - B.features[3]) + Math.abs(A.features[4] - B.features[4]);
    const gap = A.utility - B.utility;
    if (fd < QUERY.minFeatureDistance || social < QUERY.minSocialDiff || gap > QUERY.maxGap) continue;
    if (!best || gap < best.scoreGap) best = { a: A.index, b: B.index, scoreGap: gap, featureDistance: fd, prompt: '' };
  }
  if (best) best.prompt = queryPrompt(r.candidates[best.a], r.candidates[best.b]);
  return best;
}

/** Short verb phrase for what a candidate actually does (used to word teaching questions). */
export function describeAction(c: CandidateSummary): string {
  const slow = c.meta.speedFrac < 0.5 ? ' slowly' : c.meta.speedFrac < 0.9 ? ' a little slower' : '';
  switch (c.meta.maneuver) {
    case 'yield':
      return 'wait here';
    case 'stepAside':
      return `step aside to the ${c.meta.side}`;
    case 'backOff':
      return 'step back';
    default:
      break;
  }
  if (c.meta.routeKind === 'detour') return c.meta.routeId === 'reroute' ? `take a wider route around people${slow}` : `go around the conversation${slow}`;
  if (c.features[2] > 0.05) return `pass between them${slow}`;
  if (c.meta.offset !== 0) return `pass on the ${c.meta.offset > 0 ? 'right' : 'left'}${slow}`;
  return c.meta.speedFrac >= 0.9 ? 'keep going' : `keep going${slow}`;
}

/** Teaching question worded from the two candidates' actual actions. */
export function queryPrompt(a: CandidateSummary, b: CandidateSummary): string {
  const pa = describeAction(a);
  let pb = describeAction(b);
  if (pa === pb) pb = `${pb} (the other way)`;
  const conv = a.features[2] > 0.05 || b.features[2] > 0.05;
  const lead = conv ? 'They appear to be in conversation. ' : '';
  return `${lead}Would you prefer that I ${pa}, or ${pb}?`;
}
