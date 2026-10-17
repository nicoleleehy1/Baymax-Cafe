// Authoritative fixed-step café simulation. Rendering only reads from it (and interpolates);
// the planner only receives `observe()` output and returns PlanResults that are applied here.
import type { CandidateMeta, CandidateSummary, Observation, PlanResult, SocialGroup } from '../core/types';
import { angleOf, dist, len, lerp, scale, sub, wrapAngle, type Vec2 } from '../core/vec';
import { buildZones } from '../planning/routes';
import { PLAN, ROBOT } from '../planning/planner';
import { HUMAN_RADIUS, PICKUP, ROBOT_RADIUS, tableById } from '../world/layout';
import { isChatting, makeCustomer, stepCustomer, type Customer } from './customers';
import { computeMetrics, type Frame, type FrameHuman, type Metrics } from './metrics';
import type { Scenario } from './scenarios';

export const SIM_DT = 1 / 30;
export const PLAN_INTERVAL = 0.2; // 5 Hz replanning
export const PLAN_STALE_AFTER = 0.8; // brake if no fresh plan for this long

export type RobotPhase = 'waiting' | 'delivering' | 'placing' | 'returning' | 'idle' | 'done';

export interface RobotState {
  pos: Vec2;
  vel: Vec2;
  heading: number;
  phase: RobotPhase;
  goal: Vec2 | null;
  tableId: string | null;
  carrying: boolean;
  placeTimer: number;
  stuckFor: number;
  lookAt: Vec2 | null;
  maneuver: string;
  label: string;
}

export interface SimEvent {
  t: number;
  kind: 'assign' | 'say' | 'placed' | 'arrived' | 'nosafe';
  speaker?: 'cass' | 'baymax';
  text?: string;
}

/** Pre-recorded customer motion for controlled evaluation (exogenous to the robot). */
export interface CustomerTrack {
  scenarioId: string;
  frames: FrameHuman[][];
  activeGroups: string[][];
}

export interface EngineOptions {
  mode: 'interactive' | 'evaluation';
  track?: CustomerTrack;
  autoAssign?: boolean;
  /** evaluation runs end at delivery; interactive runs return to the counter */
  returnAfterDelivery?: boolean;
  /** include Baymax as an agent for customers' avoidance (interactive only) */
  customersAvoidRobot?: boolean;
  /** record frames (for metrics / replay) */
  record?: boolean;
  epoch?: number;
}

export class SimEngine {
  readonly scenario: Scenario;
  readonly opts: Required<Omit<EngineOptions, 'track'>> & { track?: CustomerTrack };
  t = 0;
  tick = 0;
  epoch: number;
  customers: Customer[];
  queue: string[] = [];
  robot: RobotState;
  plan: PlanResult | null = null;
  chosen: CandidateSummary | null = null;
  prevMeta: CandidateMeta | null = null;
  frames: Frame[] = [];
  latencies: number[] = [];
  events: SimEvent[] = [];
  assignedAt: number | null = null;
  arrivedAt: number | null = null;
  lastPlanReqT = -Infinity;
  private planOffset: Vec2 = { x: 0, y: 0 };
  private prevPos = new Map<string, Vec2>();
  private said = new Map<string, number>();
  private reqCounter = 0;

  constructor(scenario: Scenario, opts: EngineOptions) {
    this.scenario = scenario;
    this.opts = {
      mode: opts.mode,
      track: opts.track,
      autoAssign: opts.autoAssign ?? true,
      returnAfterDelivery: opts.returnAfterDelivery ?? opts.mode === 'interactive',
      customersAvoidRobot: opts.customersAvoidRobot ?? opts.mode === 'interactive',
      record: opts.record ?? true,
      epoch: opts.epoch ?? 0,
    };
    this.epoch = this.opts.epoch;
    this.customers = scenario.customers.map(makeCustomer);
    this.robot = {
      pos: { ...scenario.robotStart.pos },
      vel: { x: 0, y: 0 },
      heading: scenario.robotStart.heading,
      phase: 'waiting',
      goal: null,
      tableId: null,
      carrying: false,
      placeTimer: 0,
      stuckFor: 0,
      lookAt: null,
      maneuver: 'idle',
      label: 'Waiting for an order',
    };
    if (this.opts.track) this.applyTrack(0);
    for (const c of this.customers) this.prevPos.set(c.id, { ...c.pos });
    if (this.opts.record) this.frames.push(this.snapshot());
  }

  // ------------------------------------------------------------ tasks

  assign(tableId: string): void {
    const table = tableById(tableId);
    this.robot.tableId = tableId;
    this.robot.goal = { ...table.serve };
    this.robot.phase = 'delivering';
    this.robot.carrying = true;
    this.robot.stuckFor = 0;
    this.plan = null;
    this.chosen = null;
    this.prevMeta = null;
    this.lastPlanReqT = -Infinity;
    this.assignedAt = this.t;
    this.arrivedAt = null;
    this.emit({ t: this.t, kind: 'assign', speaker: 'cass', text: `${table.label} needs ${/^[aeiou]/i.test(this.scenario.delivery.item) ? 'an' : 'a'} ${this.scenario.delivery.item}, Baymax.` });
  }

  get taskActive(): boolean {
    return this.robot.phase === 'delivering' || this.robot.phase === 'returning';
  }

  get finished(): boolean {
    return this.robot.phase === 'done' || this.t >= this.scenario.duration;
  }

  // ------------------------------------------------------------ planning interface

  needsPlan(): boolean {
    return this.taskActive && this.t - this.lastPlanReqT >= PLAN_INTERVAL - 1e-9;
  }

  nextReqId(): number {
    return ++this.reqCounter;
  }

  markPlanRequested(): void {
    this.lastPlanReqT = this.t;
  }

  /** What Baymax can observe: kinematics, geometry and explicit social annotations only. */
  observe(): Observation {
    const humans = this.customers
      .filter((c) => c.visible && c.state !== 'gone')
      .map((c) => {
        const pp = this.prevPos.get(c.id) ?? c.pos;
        return {
          id: c.id,
          pos: { ...c.pos },
          vel: { x: (c.pos.x - pp.x) / SIM_DT, y: (c.pos.y - pp.y) / SIM_DT },
          facing: c.facing,
          radius: HUMAN_RADIUS,
        };
      });
    return {
      t: this.t,
      robot: { pos: { ...this.robot.pos }, vel: { ...this.robot.vel }, heading: this.robot.heading },
      goal: this.robot.goal ? { ...this.robot.goal } : null,
      humans,
      groups: this.activeGroups(),
    };
  }

  activeGroups(): SocialGroup[] {
    if (this.opts.track) {
      const ids = this.opts.track.activeGroups[Math.min(this.tick, this.opts.track.activeGroups.length - 1)] ?? [];
      return this.scenario.groups.filter((g) => ids.includes(g.id)).map((g) => ({ id: g.id, kind: 'conversation', memberIds: g.members }));
    }
    return this.scenario.groups
      .filter((g) => g.members.every((m) => {
        const c = this.customers.find((x) => x.id === m);
        return !!c && c.visible && isChatting(c, g.id);
      }))
      .map((g) => ({ id: g.id, kind: 'conversation', memberIds: g.members }));
  }

  /** Apply a planner result. Returns false (and discards it) if stale. */
  applyPlan(res: PlanResult): boolean {
    if (res.epoch !== this.epoch) return false;
    if (this.plan && res.reqId <= this.plan.reqId) return false;
    if (!this.taskActive) return false;
    if (res.chosen < 0) return false;
    const prevChosen = this.chosen;
    this.plan = res;
    this.chosen = res.candidates[res.chosen];
    this.latencies.push(res.latencyMs);
    // continuity: offset between where the plan expects us to be now and where we are
    const exp = this.samplePlan(this.t);
    this.planOffset = exp ? sub(this.robot.pos, exp.pos) : { x: 0, y: 0 };
    this.prevMeta = this.chosen.meta;
    this.robot.maneuver = this.chosen.meta.maneuver;
    this.robot.label = this.chosen.label;
    this.groundedDialogue(res, prevChosen);
    return true;
  }

  private groundedDialogue(res: PlanResult, prev: CandidateSummary | null): void {
    const c = this.chosen!;
    if (res.noSafe) {
      this.sayOnce('nosafe', 'I will wait until there is room to pass.', 6);
      this.emit({ t: this.t, kind: 'nosafe' });
      return;
    }
    // Chose to skirt a conversation while the best direct option would have crossed it.
    if (c.meta.routeKind === 'detour' && c.meta.routeId.startsWith('around') && (!prev || prev.meta.routeKind !== 'detour')) {
      const bestDirect = res.candidates.filter((x) => x.safe && x.meta.routeId === 'direct').sort((a, b) => b.total - a.total)[0];
      if (bestDirect && bestDirect.features[2] > 0.05) {
        this.sayOnce(`scenic:${c.meta.routeId}`, 'Your conversation appears to be ongoing. I will take the scenic route.', 1e6);
      }
    }
    // Yielding to someone moving across our path.
    const yielding = c.meta.maneuver !== 'go' || c.meta.speedFrac <= 0.35;
    if (yielding) {
      const fullSpeed = res.candidates.find((x) => x.meta.routeId === c.meta.routeId && x.meta.maneuver === 'go' && x.meta.speedFrac === 1 && x.meta.offset === 0);
      const blocker = res.predictions.find((p) => p.hyps.length > 1 && dist(p.hyps[0].pts[0], this.robot.pos) < 3.5);
      if (blocker && fullSpeed && (!fullSpeed.safe || fullSpeed.features[1] > c.features[1] + 0.05)) {
        this.sayOnce(`after:${blocker.id}`, 'After you.', 12);
      }
    }
  }

  private sayOnce(key: string, text: string, cooldown: number): void {
    const last = this.said.get(key);
    if (last !== undefined && this.t - last < cooldown) return;
    this.said.set(key, this.t);
    this.emit({ t: this.t, kind: 'say', speaker: 'baymax', text });
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private samplePlan(t: number): { pos: Vec2; vel: Vec2 } | null {
    if (!this.chosen || !this.plan) return null;
    const age = t - this.plan.tObs;
    const k = age / PLAN.dt;
    const pts = this.chosen.pts;
    const vels = this.chosen.vels;
    if (k >= pts.length - 1) return { pos: pts[pts.length - 1], vel: { x: 0, y: 0 } };
    const i = Math.max(0, Math.floor(k));
    const f = Math.max(0, k - i);
    return { pos: lerp(pts[i], pts[i + 1], f), vel: lerp(vels[i], vels[i + 1], f) };
  }

  // ------------------------------------------------------------ stepping

  step(): void {
    const dt = SIM_DT;
    this.t = +(this.t + dt).toFixed(6);
    this.tick++;

    if (this.opts.autoAssign && this.assignedAt === null && this.robot.phase === 'waiting' && this.t >= this.scenario.delivery.at) {
      this.assign(this.scenario.delivery.tableId);
    }

    // customers
    for (const c of this.customers) this.prevPos.set(c.id, { ...c.pos });
    if (this.opts.track) this.applyTrack(this.tick);
    else {
      const agents = this.customers.filter((c) => c.visible).map((c) => ({ id: c.id, pos: c.pos, vel: c.vel, radius: HUMAN_RADIUS }));
      if (this.opts.customersAvoidRobot) agents.push({ id: 'baymax', pos: this.robot.pos, vel: this.robot.vel, radius: ROBOT_RADIUS });
      const world = { t: this.t, dt, queue: this.queue, agents };
      for (const c of this.customers) stepCustomer(c, world);
    }

    this.stepRobot(dt);
    if (this.opts.record) this.frames.push(this.snapshot());
  }

  private stepRobot(dt: number): void {
    const r = this.robot;
    if (r.phase === 'delivering' || r.phase === 'returning') {
      const s = this.samplePlan(this.t);
      const age = this.plan ? this.t - this.plan.tObs : Infinity;
      if (!s || age > PLAN_STALE_AFTER) {
        // no fresh plan: brake to a stop
        const sp = len(r.vel);
        const nsp = Math.max(0, sp - ROBOT.aBrake * dt);
        r.vel = sp > 1e-6 ? scale(r.vel, nsp / sp) : { x: 0, y: 0 };
        r.pos = { x: r.pos.x + r.vel.x * dt, y: r.pos.y + r.vel.y * dt };
      } else {
        const decay = Math.exp(-dt / 0.15);
        this.planOffset = scale(this.planOffset, decay);
        r.pos = { x: s.pos.x + this.planOffset.x, y: s.pos.y + this.planOffset.y };
        r.vel = s.vel;
      }
      const sp = len(r.vel);
      r.stuckFor = sp < 0.05 ? r.stuckFor + dt : 0;
      if (r.goal && dist(r.pos, r.goal) < 0.14 && sp < 0.2) {
        this.plan = null;
        this.chosen = null;
        if (r.phase === 'delivering') {
          r.phase = 'placing';
          r.placeTimer = 0;
          this.arrivedAt = this.t;
          r.label = 'Setting down the order';
          this.emit({ t: this.t, kind: 'arrived' });
        } else {
          r.phase = 'idle';
          r.goal = null;
          r.label = 'Ready for the next order';
        }
      }
    } else if (r.phase === 'placing' || r.phase === 'idle') {
      // settle the last bit of speed gently
      const sp0 = len(r.vel);
      const nsp = Math.max(0, sp0 - ROBOT.aMax * dt);
      r.vel = sp0 > 1e-6 ? scale(r.vel, nsp / sp0) : { x: 0, y: 0 };
      r.pos = { x: r.pos.x + r.vel.x * dt, y: r.pos.y + r.vel.y * dt };
    }
    if (r.phase === 'placing') {
      r.placeTimer += dt;
      if (r.placeTimer > 1.4 && r.carrying) {
        r.carrying = false;
        this.emit({ t: this.t, kind: 'placed' });
        this.emit({ t: this.t, kind: 'say', speaker: 'baymax', text: `Your ${this.scenario.delivery.item}. I hope you enjoy it.` });
      }
      if (r.placeTimer > 2.2) {
        if (this.opts.returnAfterDelivery) {
          r.phase = 'returning';
          r.goal = { ...PICKUP };
          this.lastPlanReqT = -Infinity;
          r.label = 'Returning to the counter';
        } else {
          r.phase = 'done';
        }
      }
    }

    // heading: careful turning, keeps facing forward when stepping back
    const sp = len(r.vel);
    let targetHeading: number | null = null;
    if (sp > 0.08 && r.maneuver !== 'backOff') targetHeading = angleOf(r.vel);
    if (r.phase === 'placing' && r.tableId) targetHeading = angleOf(sub(tableById(r.tableId).c, r.pos));
    if (targetHeading !== null) {
      const d = wrapAngle(targetHeading - r.heading);
      const m = ROBOT.turnRate * 1.4 * dt;
      r.heading = wrapAngle(r.heading + Math.max(-m, Math.min(m, d)));
    }

    // head attention: the nearest moving person ahead, else the nearest person very close
    let look: Vec2 | null = null;
    let best = Infinity;
    for (const c of this.customers) {
      if (!c.visible) continue;
      const d = dist(c.pos, r.pos);
      const moving = len(c.vel) > 0.3;
      const ahead = Math.cos(angleOf(sub(c.pos, r.pos)) - r.heading) > -0.2;
      const score = moving && ahead && d < 3.5 ? d : d < 1.4 ? d + 2 : Infinity;
      if (score < best) {
        best = score;
        look = c.pos;
      }
    }
    r.lookAt = look ? { ...look } : null;
  }

  private applyTrack(tick: number): void {
    const tr = this.opts.track!;
    const f = tr.frames[Math.min(tick, tr.frames.length - 1)];
    for (const c of this.customers) {
      const h = f.find((x) => x.id === c.id);
      if (!h) continue;
      c.pos = { ...h.pos };
      c.facing = h.facing;
      c.state = h.state as Customer['state'];
      c.visible = h.visible;
      c.gait = h.gait;
    }
  }

  snapshot(): Frame {
    const r = this.robot;
    return {
      t: this.t,
      robot: { pos: { ...r.pos }, vel: { ...r.vel }, heading: r.heading, phase: r.phase, maneuver: r.maneuver, carrying: r.carrying },
      humans: this.customers.map((c) => ({ id: c.id, pos: { ...c.pos }, facing: c.facing, state: c.state, visible: c.visible, gait: c.gait })),
      zones: buildZones(this.activeGroups(), this.customers.filter((c) => c.visible).map((c) => ({ id: c.id, pos: c.pos, vel: { x: 0, y: 0 }, facing: c.facing, radius: HUMAN_RADIUS }))),
    };
  }

  metrics(): Metrics {
    return computeMetrics(this.frames, this.assignedAt, this.arrivedAt, this.latencies);
  }
}

/** Run customers alone (no robot influence) and record their motion for controlled evaluation. */
export function recordCustomerTrack(scenario: Scenario): CustomerTrack {
  const eng = new SimEngine(scenario, { mode: 'evaluation', autoAssign: false, customersAvoidRobot: false, record: false });
  const frames: FrameHuman[][] = [];
  const activeGroups: string[][] = [];
  const snap = (): void => {
    frames.push(eng.customers.map((c) => ({ id: c.id, pos: { ...c.pos }, facing: c.facing, state: c.state, visible: c.visible, gait: c.gait })));
    activeGroups.push(eng.activeGroups().map((g) => g.id));
  };
  snap();
  const n = Math.ceil(scenario.duration / SIM_DT) + 2;
  for (let i = 0; i < n; i++) {
    eng.step();
    snap();
  }
  return { scenarioId: scenario.id, frames, activeGroups };
}
