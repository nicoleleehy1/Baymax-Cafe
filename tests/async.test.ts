// Asynchronous correctness: delayed/reordered worker replies, resets during learning and
// evaluation, faithful preview timing, and sequences of (contradictory) preferences.
import { beforeEach, describe, expect, it } from 'vitest';
import type { CandidateSummary, PreferenceExample } from '../src/core/types';
import { addPreference, createModel, prefProb } from '../src/learning/model';
import { describeAction, plan, PLAN, queryPrompt } from '../src/planning/planner';
import { previewDuration, sampleCandidate } from '../src/planning/preview';
import { SimEngine, SIM_DT } from '../src/sim/engine';
import { SCENARIOS } from '../src/sim/scenarios';
import { Controller, type Transport } from '../src/state/controller';
import { useApp } from '../src/state/store';
import { LAYOUT_ID } from '../src/world/layout';
import { handleMessage } from '../src/worker/handler';
import type { FromWorker, ToWorker } from '../src/worker/protocol';

const INITIAL_STATE = useApp.getState();

class FakeWorker implements Transport {
  queue: ToWorker[] = [];
  onMessage: ((m: FromWorker) => void) | null = null;
  post(m: ToWorker): void {
    this.queue.push(m);
  }
  /** compute a reply now but deliver it later */
  take(i = 0): FromWorker {
    return handleMessage(this.queue.splice(i, 1)[0]);
  }
  deliver(m: FromWorker): void {
    this.onMessage!(m);
  }
  flush(): void {
    while (this.queue.length) this.deliver(this.take());
  }
}

function setup(): { c: Controller; w: FakeWorker } {
  useApp.setState({ ...INITIAL_STATE, model: createModel(), scenarioId: 'teach' }, true);
  const c = new Controller();
  const w = new FakeWorker();
  c.attach(w);
  return { c, w };
}

/** Advance the live controller, answering every worker request immediately, until `until()` holds. */
function runUntil(c: Controller, w: FakeWorker, until: () => boolean, maxSteps = 3000): void {
  for (let i = 0; i < maxSteps && !until(); i++) {
    c.advance(SIM_DT);
    w.flush();
  }
}

/** Advance until the controller posts a plan request (bounded). */
function waitForRequest(c: Controller, w: FakeWorker): void {
  for (let i = 0; i < 5000 && w.queue.length === 0; i++) c.advance(SIM_DT);
  if (w.queue.length === 0) throw new Error('no plan request');
}

/** Advance until the next worker reply would carry a teaching query; return that undelivered reply. */
function nextQueryReply(c: Controller, w: FakeWorker): FromWorker {
  for (let i = 0; i < 3000; i++) {
    c.advance(SIM_DT);
    while (w.queue.length) {
      const r = w.take();
      if (r.type === 'plan' && r.result.query) return r;
      w.deliver(r);
    }
  }
  throw new Error('no query produced');
}

beforeEach(() => {
  useApp.setState({ ...INITIAL_STATE }, true);
});

describe('delayed worker replies', () => {
  it('a plan that arrives after a scenario reset is dropped and never opens teaching', () => {
    const { c, w } = setup();
    c.start();
    const stale = nextQueryReply(c, w);
    c.reset(); // bumps the epoch
    w.deliver(stale);
    expect(useApp.getState().runState).toBe('ready');
    expect(useApp.getState().query).toBeNull();
    expect(c.dropped.plans).toBeGreaterThanOrEqual(1);
  });

  it('a plan scored with an outdated model revision is dropped', () => {
    const { c, w } = setup();
    useApp.getState().set({ askEnabled: false }); // a teaching pause would stop plan requests
    c.start();
    runUntil(c, w, () => w.queue.length > 0 || c.engine.taskActive);
    runUntil(c, w, () => false, 5); // ensure a request is queued
    waitForRequest(c, w);
    const reply = w.take();
    c.resetPreferences(); // bumps model revision
    const before = c.dropped.plans;
    w.deliver(reply);
    expect(c.dropped.plans).toBe(before + 1);
  });

  it('an older plan arriving after a newer one is ignored', () => {
    const { c, w } = setup();
    useApp.getState().set({ askEnabled: false });
    c.start();
    for (let i = 0; i < 5000 && !c.engine.taskActive; i++) {
      c.advance(SIM_DT);
      w.flush();
    }
    waitForRequest(c, w);
    const old = w.take();
    // no reply for > 1 s → controller supersedes the request
    for (let i = 0; i < 40; i++) c.advance(SIM_DT);
    expect(w.queue.length).toBe(1);
    w.flush(); // newer reply applied
    const applied = c.engine.plan?.reqId;
    w.deliver(old); // late, older reply
    expect(c.engine.plan?.reqId).toBe(applied);
    expect(c.dropped.plans).toBeGreaterThanOrEqual(1);
  });
});

describe('resets during learning and evaluation', () => {
  it('scenario reset while a preference update is in flight discards the update', () => {
    const { c, w } = setup();
    c.start();
    w.deliver(nextQueryReply(c, w));
    expect(useApp.getState().runState).toBe('teaching');
    c.answerQuery('B');
    expect(useApp.getState().runState).toBe('learning');
    const learned = w.take();
    expect(learned.type).toBe('learned');
    c.reset();
    w.deliver(learned);
    expect(c.dropped.learned).toBe(1);
    expect(useApp.getState().model.examples.length).toBe(0);
    expect(useApp.getState().model.weights).toEqual(createModel().weights);
  });

  it('preference reset while learning discards the update and resumes the run', () => {
    const { c, w } = setup();
    c.start();
    w.deliver(nextQueryReply(c, w));
    c.answerQuery('B');
    const learned = w.take();
    c.resetPreferences();
    w.deliver(learned);
    expect(c.dropped.learned).toBe(1);
    expect(useApp.getState().model.examples.length).toBe(0);
    w.flush(); // replan with the reset model
    expect(useApp.getState().runState).toBe('running');
  });

  it('a successful update is applied once and bumps the model revision', () => {
    const { c, w } = setup();
    c.start();
    w.deliver(nextQueryReply(c, w));
    const rev = c.modelRevision;
    c.answerQuery('B');
    w.flush();
    expect(c.modelRevision).toBe(rev + 1);
    expect(useApp.getState().model.examples.length).toBe(1);
    expect(useApp.getState().runState).toBe('running');
    expect(useApp.getState().evidence).not.toBeNull();
  });

  it('scenario reset during evaluation discards the result', () => {
    const { c, w } = setup();
    c.evaluate('generalize');
    const res = w.take();
    c.reset();
    w.deliver(res);
    expect(c.dropped.evaluated).toBe(1);
    expect(useApp.getState().replayActive).toBe(false);
    expect(useApp.getState().evaluation.status).toBe('idle');
  });

  it('learning during evaluation invalidates the evaluation (it would no longer be "after teaching")', () => {
    const { c, w } = setup();
    c.start();
    w.deliver(nextQueryReply(c, w));
    c.evaluate('generalize');
    const evalReply = w.take();
    c.answerQuery('B');
    w.flush(); // learned + replan
    w.deliver(evalReply);
    expect(c.dropped.evaluated).toBe(1);
    expect(useApp.getState().evaluation.status).toBe('idle');
  });
});

describe('teaching preview timing', () => {
  function teachPlan(atT: number) {
    const eng = new SimEngine(SCENARIOS.teach, { mode: 'evaluation' });
    while (eng.t < atT) {
      if (eng.needsPlan()) {
        eng.markPlanRequested();
        eng.applyPlan(plan({ reqId: eng.nextReqId(), epoch: 0, obs: eng.observe(), weights: createModel().weights, initialWeights: createModel().weights, prev: eng.prevMeta, stuckFor: 0, allowQuery: false }));
      }
      eng.step();
    }
    return plan({ reqId: 999, epoch: 0, obs: eng.observe(), weights: createModel().weights, initialWeights: createModel().weights, prev: eng.prevMeta, stuckFor: 0, allowQuery: false });
  }

  it('plays the candidate’s own timestamps over the 3 s horizon, not a fixed-duration route', () => {
    const res = teachPlan(3.0);
    for (const c of res.candidates) {
      expect(previewDuration(c)).toBeCloseTo(PLAN.horizon, 6);
      for (const k of [0, 7, 15, 30]) {
        const s = sampleCandidate(c, k * PLAN.dt, res.robotHeading);
        expect(s.pos.x).toBeCloseTo(c.pts[k].x, 9);
        expect(s.pos.y).toBeCloseTo(c.pts[k].y, 9);
      }
      const after = sampleCandidate(c, PLAN.horizon + 0.8, res.robotHeading);
      expect(after.pos).toEqual(c.pts[c.pts.length - 1]); // holds; never walks the dashed tail
      expect(after.inHorizon).toBe(false);
    }
  });

  // candidate kinematics at a known café moment
  it.skipIf(LAYOUT_ID === 'cass' || LAYOUT_ID === 'hiro')('waiting, slowing and stepping back stay distinct', () => {
    const res = teachPlan(3.0);
    const find = (f: (c: CandidateSummary) => boolean) => res.candidates.find(f)!;
    const wait = find((c) => c.meta.maneuver === 'yield');
    const slow = find((c) => c.meta.maneuver === 'go' && c.meta.speedFrac === 0.35 && c.meta.offset === 0 && c.meta.routeId === 'direct');
    const back = res.candidates.find((c) => c.meta.maneuver === 'backOff');
    const end = (c: CandidateSummary) => sampleCandidate(c, PLAN.horizon, res.robotHeading);
    expect(Math.hypot(end(wait).vel.x, end(wait).vel.y)).toBeLessThan(0.02); // comes to rest
    expect(Math.hypot(end(slow).vel.x, end(slow).vel.y)).toBeGreaterThan(0.2); // still moving
    const fwd = { x: Math.cos(res.robotHeading), y: Math.sin(res.robotHeading) };
    const disp = (c: CandidateSummary) => ({ x: end(c).pos.x - c.pts[0].x, y: end(c).pos.y - c.pts[0].y });
    expect(disp(slow).x * fwd.x + disp(slow).y * fwd.y).toBeGreaterThan(0.3);
    expect(back).toBeUndefined(); // not offered while moving at speed (it would only be braking)
  });

  // uses classic-café coordinates
  it.skipIf(LAYOUT_ID !== 'classic')('step back (offered when nearly stopped) moves backward while facing forward', () => {
    const obs = { t: 0, robot: { pos: { x: 0.5, y: -0.5 }, vel: { x: 0, y: 0 }, heading: Math.PI / 2 }, goal: { x: 4.7, y: 1.4 }, humans: [], groups: [] };
    const w = createModel().weights;
    const res = plan({ reqId: 1, epoch: 0, obs, weights: w, initialWeights: w, prev: null, stuckFor: 0, allowQuery: false });
    const back = res.candidates.find((c) => c.meta.maneuver === 'backOff')!;
    expect(back).toBeDefined();
    const s = sampleCandidate(back, PLAN.horizon, res.robotHeading);
    expect(s.pos.y - back.pts[0].y).toBeLessThan(-0.3); // moved backward (−y is behind)
    expect(s.heading).toBeCloseTo(Math.PI / 2, 6); // never turned around
  });
});

describe('question wording comes from the actual actions', () => {
  const mk = (meta: Partial<CandidateSummary['meta']>, conv = 0): CandidateSummary =>
    ({
      meta: { routeId: 'direct', routeKind: 'direct', maneuver: 'go', speedFrac: 1, offset: 0, ...meta },
      features: [0, 0, conv, 0, 0, 0],
    }) as CandidateSummary;

  it('never says "wait or go around" for pass-right vs step-back', () => {
    const p = queryPrompt(mk({ offset: 0.35 }), mk({ maneuver: 'backOff', speedFrac: 0.3 }));
    expect(p).toBe('Would you prefer that I pass on the right, or step back?');
    expect(p).not.toMatch(/wait|around/);
  });

  it('describes the conversation choice and the wait/go-around choice faithfully', () => {
    expect(queryPrompt(mk({}, 1.2), mk({ routeId: 'around:g', routeKind: 'detour' }))).toBe(
      'They appear to be in conversation. Would you prefer that I pass between them, or go around the conversation?',
    );
    expect(queryPrompt(mk({ maneuver: 'yield', speedFrac: 0 }), mk({ routeId: 'around:g', routeKind: 'detour' }))).toBe(
      'Would you prefer that I wait here, or go around the conversation?',
    );
    expect(describeAction(mk({ maneuver: 'stepAside', side: 'left', speedFrac: 0.35 }))).toBe('step aside to the left');
  });
});

describe('several sequential and contradictory preferences', () => {
  const between = [0.0, 0.15, 1.2, 0.15, 0, 0.1];
  const around = [0.6, 0.05, 0, 0.05, 0, 0.35];
  const ex = (preferred: 'A' | 'B', i: number): PreferenceExample => ({
    id: `e${i}`, createdAt: i, scenarioId: 'teach', tObs: i, featuresA: between, featuresB: around, labelA: 'between', labelB: 'around', preferred,
  });
  const train = (choices: ('A' | 'B')[]) => choices.reduce((m, ch, i) => addPreference(m, ex(ch, i)).model, createModel());

  it('repeated agreement strengthens the preference monotonically, with bounded weights', () => {
    let last = prefProb(createModel().weights, around, between);
    for (let n = 1; n <= 4; n++) {
      const m = train(Array(n).fill('B'));
      const p = prefProb(m.weights, around, between);
      expect(p).toBeGreaterThan(last);
      last = p;
      for (const w of m.weights) expect(Number.isFinite(w) && w >= 0.02 && w <= 12).toBe(true);
    }
  });

  it('contradictory answers pull the model back toward indifference, independent of order', () => {
    const one = train(['B']);
    const mixed = train(['B', 'A']);
    const mixedRev = train(['A', 'B']);
    const pOne = prefProb(one.weights, around, between);
    const pMixed = prefProb(mixed.weights, around, between);
    expect(Math.abs(pMixed - 0.5)).toBeLessThan(Math.abs(pOne - 0.5));
    mixed.weights.forEach((w, i) => expect(w).toBeCloseTo(mixedRev.weights[i], 6)); // full-batch refit
    expect(mixed.examples.length).toBe(2);
  });

  it('the latest answers dominate when the user changes their mind repeatedly', () => {
    const m = train(['B', 'A', 'A', 'A']);
    expect(prefProb(m.weights, between, around)).toBeGreaterThan(0.5);
  });
});
