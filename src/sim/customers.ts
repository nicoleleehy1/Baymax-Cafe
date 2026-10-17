// Customer behavior: a small scripted state machine per customer (enter → queue → order
// → sit/chat/browse → leave) plus local avoidance. Customers' scripts and targets are
// PRIVATE: the planner only ever receives their observed kinematics (see engine.observe).
import { add, angleOf, clampLen, dist, len, norm, scale, sub, wrapAngle, type Vec2 } from '../core/vec';
import { getHumanGrid } from '../world/grid';
import { DOOR, HUMAN_RADIUS, ORDER_SPOT, QUEUE_SPOTS, seatById } from '../world/layout';

export type CustomerState =
  | 'entering'
  | 'walking'
  | 'queueing'
  | 'ordering'
  | 'sitting'
  | 'chatting'
  | 'browsing'
  | 'leaving'
  | 'gone';

export type Action =
  | { type: 'walk'; to: Vec2; speed?: number }
  | { type: 'wait'; dur: number; face?: number }
  | { type: 'waitUntil'; t: number; face?: number; pose?: 'browsing' | 'chatting' }
  | { type: 'queue'; orderDur?: number }
  | { type: 'sit'; seat: string; dur: number }
  | { type: 'chat'; group: string; lookAt: Vec2; dur: number }
  | { type: 'browse'; face: number; dur: number }
  | { type: 'leave' };

export interface Look {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  hairStyle: 'short' | 'bun' | 'long' | 'cap';
  height: number;
}

export interface CustomerSpec {
  id: string;
  name: string;
  look: Look;
  start: { pos: Vec2; facing: number; seated?: string };
  speed?: number;
  script: Action[];
}

export interface Customer {
  spec: CustomerSpec;
  id: string;
  pos: Vec2;
  vel: Vec2;
  facing: number;
  state: CustomerState;
  /** private plan: never exposed to Baymax */
  priv: {
    step: number;
    timer: number;
    path: Vec2[] | null;
    pathIdx: number;
    target: Vec2 | null;
    faceGoal: number | null;
    queueIdx: number;
    ordered: boolean;
    group: string | null;
  };
  visible: boolean;
  /** animation phase accumulator (renderer reads it) */
  gait: number;
}

export function makeCustomer(spec: CustomerSpec): Customer {
  const seated = spec.start.seated ? seatById(spec.start.seated) : null;
  return {
    spec,
    id: spec.id,
    pos: seated ? { ...seated.pos } : { ...spec.start.pos },
    vel: { x: 0, y: 0 },
    facing: seated ? seated.facing : spec.start.facing,
    state: seated ? 'sitting' : 'walking',
    priv: { step: 0, timer: 0, path: null, pathIdx: 0, target: null, faceGoal: null, queueIdx: -1, ordered: false, group: null },
    visible: true,
    gait: 0,
  };
}

export interface CustomerWorld {
  t: number;
  dt: number;
  queue: string[];
  /** other agents to avoid: customers, and Baymax in interactive mode */
  agents: { id: string; pos: Vec2; vel: Vec2; radius: number }[];
}

const ARRIVE = 0.08;

function startWalk(c: Customer, to: Vec2): boolean {
  const grid = getHumanGrid(HUMAN_RADIUS);
  const path = grid.findPath(c.pos, to);
  c.priv.path = path ?? [c.pos, to];
  c.priv.pathIdx = 1;
  c.priv.target = to;
  return true;
}

/** Follow the current path; returns true when arrived. */
function follow(c: Customer, w: CustomerWorld, speed: number): boolean {
  const path = c.priv.path;
  if (!path || path.length === 0) return true;
  const goal = path[path.length - 1];
  const dGoal = dist(c.pos, goal);
  if (dGoal < ARRIVE) {
    c.vel = { x: 0, y: 0 };
    c.pos = { ...goal };
    return true;
  }
  while (c.priv.pathIdx < path.length - 1 && dist(c.pos, path[c.priv.pathIdx]) < 0.35) c.priv.pathIdx++;
  const wp = path[c.priv.pathIdx];
  const sp = Math.min(speed, Math.max(0.25, dGoal * 1.5));
  let pref = scale(norm(sub(wp, c.pos)), sp);

  // Simple time-to-collision avoidance (heuristic, not ORCA): steer away from agents we
  // are predicted to approach closely within 2.5 s, and keep a minimum separation.
  let push = { x: 0, y: 0 };
  for (const o of w.agents) {
    if (o.id === c.id) continue;
    const rel = sub(o.pos, c.pos);
    const d = len(rel);
    if (d > 3.5) continue;
    const rsum = HUMAN_RADIUS + o.radius + 0.12;
    const vrel = sub(pref, o.vel);
    const vv = vrel.x * vrel.x + vrel.y * vrel.y;
    const tca = vv > 1e-6 ? Math.max(0, (rel.x * vrel.x + rel.y * vrel.y) / vv) : 0;
    if (tca < 2.5) {
      const closest = sub(rel, scale(vrel, tca)); // other's position relative to us at closest approach
      const dc = len(closest);
      if (dc < rsum + 0.3) {
        const away = dc > 1e-4 ? scale(closest, -1 / dc) : norm({ x: -rel.y, y: rel.x });
        push = add(push, scale(away, ((2.5 - tca) / 2.5) * (rsum + 0.3 - dc) * 1.6));
      }
    }
    if (d < rsum) push = add(push, scale(norm(rel), -(rsum - d) * 4));
  }
  let vel = clampLen(add(pref, push), speed * 1.15);
  const grid = getHumanGrid(HUMAN_RADIUS);
  const next = add(c.pos, scale(vel, w.dt));
  if (!grid.isFreePoint(next, false)) {
    vel = pref;
  }
  // smooth acceleration
  c.vel = add(c.vel, clampLen(sub(vel, c.vel), 2.5 * w.dt));
  c.pos = add(c.pos, scale(c.vel, w.dt));
  return false;
}

function faceToward(c: Customer, target: number, dt: number): void {
  const d = wrapAngle(target - c.facing);
  const m = 4 * dt;
  c.facing = wrapAngle(c.facing + Math.max(-m, Math.min(m, d)));
}

export function stepCustomer(c: Customer, w: CustomerWorld): void {
  if (c.state === 'gone') return;
  const pv = c.priv;
  const act = c.spec.script[pv.step];
  const speed = c.spec.speed ?? 1.05;
  const prev = { ...c.pos };
  const next = (): void => {
    pv.step++;
    pv.timer = 0;
    pv.path = null;
    pv.faceGoal = null;
  };

  if (!act) {
    // idle in place (script finished)
    c.vel = { x: 0, y: 0 };
  } else {
    switch (act.type) {
      case 'walk': {
        if (!pv.path) startWalk(c, act.to);
        c.state = c.spec.start.pos.x < DOOR.inside.x && pv.step === 0 ? 'entering' : 'walking';
        if (follow(c, w, act.speed ?? speed)) next();
        break;
      }
      case 'wait': {
        c.vel = { x: 0, y: 0 };
        pv.timer += w.dt;
        if (act.face !== undefined) pv.faceGoal = act.face;
        if (pv.timer >= act.dur) next();
        break;
      }
      case 'waitUntil': {
        c.vel = { x: 0, y: 0 };
        if (act.face !== undefined) pv.faceGoal = act.face;
        if (act.pose) c.state = act.pose;
        if (w.t >= act.t) next();
        break;
      }
      case 'queue': {
        if (pv.queueIdx < 0 && !pv.ordered) {
          w.queue.push(c.id);
          pv.queueIdx = w.queue.length - 1;
          pv.path = null;
        }
        const idx = w.queue.indexOf(c.id);
        if (idx < 0) {
          next();
          break;
        }
        const spot = idx === 0 ? ORDER_SPOT : QUEUE_SPOTS[Math.min(idx, QUEUE_SPOTS.length - 1)];
        if (!pv.target || dist(pv.target, spot) > 0.01 || !pv.path) startWalk(c, spot);
        const arrived = follow(c, w, speed * 0.8);
        c.state = idx === 0 && arrived ? 'ordering' : 'queueing';
        if (arrived) pv.faceGoal = -Math.PI / 2; // face the counter
        if (idx === 0 && arrived) {
          pv.timer += w.dt;
          if (pv.timer >= (act.orderDur ?? 3)) {
            w.queue.splice(0, 1);
            pv.ordered = true;
            pv.queueIdx = -1;
            next();
          }
        }
        break;
      }
      case 'sit': {
        const seat = seatById(act.seat);
        if (c.state !== 'sitting') {
          if (!pv.path) startWalk(c, seat.pos);
          c.state = 'walking';
          if (follow(c, w, speed)) {
            c.state = 'sitting';
            pv.timer = 0;
          }
        } else {
          c.vel = { x: 0, y: 0 };
          pv.faceGoal = seat.facing;
          pv.timer += w.dt;
          if (pv.timer >= act.dur) next();
        }
        break;
      }
      case 'chat': {
        c.vel = { x: 0, y: 0 };
        c.state = 'chatting';
        pv.group = act.group;
        pv.faceGoal = angleOf(sub(act.lookAt, c.pos));
        pv.timer += w.dt;
        if (pv.timer >= act.dur) {
          pv.group = null;
          next();
        }
        break;
      }
      case 'browse': {
        c.vel = { x: 0, y: 0 };
        c.state = 'browsing';
        pv.faceGoal = act.face;
        pv.timer += w.dt;
        if (pv.timer >= act.dur) next();
        break;
      }
      case 'leave': {
        if (!pv.path) startWalk(c, DOOR.outside);
        c.state = 'leaving';
        if (follow(c, w, speed)) {
          c.state = 'gone';
          c.visible = false;
          c.vel = { x: 0, y: 0 };
        }
        break;
      }
    }
  }
  // facing follows motion, otherwise turns toward the action's facing goal
  const moved = dist(prev, c.pos);
  if (len(c.vel) > 0.12) faceToward(c, angleOf(c.vel), w.dt);
  else if (pv.faceGoal !== null) faceToward(c, pv.faceGoal, w.dt);
  c.gait += moved * 3.2;
}

export function isChatting(c: Customer, group: string): boolean {
  return c.state === 'chatting' && c.priv.group === group;
}
