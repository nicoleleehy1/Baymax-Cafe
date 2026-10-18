import { describe, expect, it } from 'vitest';
import type { Observation } from '../src/core/types';
import { beforeAfter, conversationOracle, exampleFromQuery, runEpisode } from '../src/eval/runner';
import { addPreference, createModel, fitWeights, INITIAL_WEIGHTS, prefProb, utility } from '../src/learning/model';
import { plan } from '../src/planning/planner';
import { predictHuman } from '../src/prediction/predictor';
import { SimEngine } from '../src/sim/engine';
import { SCENARIOS, type Scenario } from '../src/sim/scenarios';
import { LAYOUT, LAYOUT_ID, ROBOT_RADIUS, HUMAN_RADIUS } from '../src/world/layout';
import type { Vec2 } from '../src/core/vec';

/** Run TEACH headlessly with a teacher that prefers less conversation intrusion. */
function teach() {
  let model = createModel();
  const ep = runEpisode('teach', {
    weights: model.weights,
    initialWeights: model.initialWeights,
    allowQuery: true,
    onQuery: (res) => {
      const pick = conversationOracle(res);
      model = addPreference(model, exampleFromQuery(res, 'teach', pick)).model;
      return model.weights;
    },
  });
  return { model, ep };
}

describe('preference model', () => {
  it('a single comparison moves P(preferred) up and re-ranks the pair', () => {
    const m = createModel();
    const between = [0.1, 0.1, 1.2, 0.1, 0, 0.2];
    const around = [0.6, 0.05, 0, 0.05, 0, 0.3];
    expect(utility(m.weights, between)).toBeGreaterThan(utility(m.weights, around)); // initially prefers "between"
    const { model, report } = addPreference(m, {
      id: 'x', createdAt: 0, scenarioId: 't', tObs: 0, featuresA: between, featuresB: around, labelA: 'between', labelB: 'around', preferred: 'B',
    });
    expect(report.probAfter).toBeGreaterThan(report.probBefore);
    expect(report.probAfter).toBeGreaterThan(0.5);
    expect(utility(model.weights, around)).toBeGreaterThan(utility(model.weights, between));
    expect(model.weights[2]).toBeGreaterThan(m.weights[2]); // conversation weight increased
    expect(model.weights[0]).toBe(m.weights[0]); // delay is the fixed scale anchor
  });

  it('regularization keeps weights near the initial model with no data', () => {
    expect(fitWeights(INITIAL_WEIGHTS, [])).toEqual(INITIAL_WEIGHTS);
  });

  it('pairwise probability is a logistic of the utility difference', () => {
    const w = [1, 1, 1, 1, 1, 1];
    expect(prefProb(w, [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0])).toBeCloseTo(0.5);
    expect(prefProb(w, [0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0])).toBeCloseTo(1 / (1 + Math.exp(-1)));
  });
});

describe('teaching → generalization', () => {
  const { model, ep } = teach();

  it('TEACH asks once, and the learned model avoids the conversation', () => {
    expect(ep.queries).toBe(1);
    expect(model.examples.length).toBe(1);
    expect(ep.metrics.conversationIntrusions).toBe(0);
    expect(ep.metrics.completed).toBe(true);
  });

  it('learned preferences transfer to a new conversation in a new place (GENERALIZE)', () => {
    const ba = beforeAfter('generalize', model.initialWeights, model.weights);
    expect(ba.identicalCustomers).toBe(true);
    expect(ba.before.metrics.conversationIntrusions).toBeGreaterThan(0);
    expect(ba.after.metrics.conversationIntrusions).toBe(0);
    expect(ba.after.metrics.completed).toBe(true);
    // the change comes from scoring the same candidate set differently
    expect(ba.after.divergentDecisions).toBeGreaterThan(0);
    // consideration usually costs time; in the café layouts it always does (upstairs the detour can be as quick)
    if (LAYOUT_ID === 'classic' || LAYOUT_ID === 'long') expect(ba.after.metrics.deliveryTime!).toBeGreaterThan(ba.before.metrics.deliveryTime!);
  });

  it('the very first GENERALIZE decision differs between initial and learned weights', () => {
    const eng = new SimEngine(SCENARIOS.generalize, { mode: 'evaluation' });
    while (eng.robot.phase === 'waiting') eng.step();
    const res = plan({ reqId: 1, epoch: 0, obs: eng.observe(), weights: model.weights, initialWeights: model.initialWeights, prev: null, stuckFor: 0, allowQuery: false });
    expect(res.candidates[res.chosen].meta.routeKind).toBe('detour');
    expect(res.candidates[res.chosenUnderInitial].meta.routeKind).toBe('direct');
  });

  it('collision constraints survive learning (no collisions in any scenario)', () => {
    for (const id of ['teach', 'generalize', 'adapt'] as const) {
      const ba = beforeAfter(id, model.initialWeights, model.weights);
      expect(ba.before.metrics.collisions).toBe(0);
      expect(ba.after.metrics.collisions).toBe(0);
    }
  });

  it('even extreme learned weights never select a candidate flagged unsafe', () => {
    const extreme = [1, 0.02, 12, 0.02, 0.02, 0.02];
    const eng = new SimEngine(SCENARIOS.adapt, { mode: 'evaluation' });
    let checked = 0;
    while (!eng.finished) {
      if (eng.needsPlan()) {
        eng.markPlanRequested();
        const res = plan({ reqId: eng.nextReqId(), epoch: 0, obs: eng.observe(), weights: extreme, initialWeights: INITIAL_WEIGHTS, prev: eng.prevMeta, stuckFor: eng.robot.stuckFor, allowQuery: false });
        if (!res.noSafe) expect(res.candidates[res.chosen].safe).toBe(true);
        checked++;
        eng.applyPlan(res);
      }
      eng.step();
    }
    expect(checked).toBeGreaterThan(10);
    expect(eng.metrics().collisions).toBe(0);
  });
});

describe('prediction and replanning', () => {
  it('uncertainty grows with horizon; stationary people get one hypothesis', () => {
    const moving = predictHuman({ id: 'a', pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 }, facing: 0, radius: 0.25 });
    expect(moving.hyps.length).toBeGreaterThan(1);
    expect(moving.sigma[30]).toBeGreaterThan(moving.sigma[10]);
    expect(moving.hyps[0].pts[10].x).toBeCloseTo(1.0, 5); // constant velocity at 1 s
    const still = predictHuman({ id: 'b', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, facing: 0, radius: 0.25 });
    expect(still.hyps.length).toBe(1);
  });

  it('a person crossing the route makes Baymax slow or yield; without the crossing it does not', () => {
    const crossing = runEpisode('adapt', { weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS });
    const yielded = crossing.decisions.some((d) => /Wait here|slowly|slower|Step/.test(d.label));
    expect(yielded).toBe(true);

    // same scenario with the crossing customer kept still
    const moves = (c: (typeof SCENARIOS.adapt.customers)[number]) =>
      c.script.some((a) => a.type === 'walk' || a.type === 'leave' || a.type === 'exit' || (a.type === 'sit' && a.seat !== c.start.seated));
    const mover = SCENARIOS.adapt.customers.find(moves)!;
    const stillScript = mover.start.seated ? [{ type: 'sit' as const, seat: mover.start.seated, dur: 1e6 }] : [{ type: 'browse' as const, face: -Math.PI / 2, dur: 1e6 }];
    const calm: Scenario = {
      ...SCENARIOS.adapt,
      customers: SCENARIOS.adapt.customers.map((c) => (c.id === mover.id ? { ...c, script: stillScript } : c)),
    };
    // count the plans where Baymax chose to slow down or hold back (wait / step aside / step back) in each run
    const holdBacks = (sc: Scenario): { n: number; completed: boolean } => {
      const eng = new SimEngine(sc, { mode: 'evaluation' });
      let n = 0;
      while (!eng.finished) {
        if (eng.needsPlan()) {
          eng.markPlanRequested();
          const res = plan({ reqId: eng.nextReqId(), epoch: 0, obs: eng.observe(), weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS, prev: eng.prevMeta, stuckFor: eng.robot.stuckFor, allowQuery: false });
          if (res.chosen >= 0 && (res.candidates[res.chosen].meta.maneuver !== 'go' || res.candidates[res.chosen].meta.speedFrac < 0.9)) n++;
          eng.applyPlan(res);
        }
        eng.step();
      }
      return { n, completed: eng.metrics().completed };
    };
    const withCrossing = holdBacks(SCENARIOS.adapt);
    const without = holdBacks(calm);
    expect(without.completed).toBe(true);
    // the moving person is what makes Baymax hold back; a still room needs (almost) none of it
    expect(withCrossing.n, `crossing ${withCrossing.n} vs still ${without.n}`).toBeGreaterThan(without.n);
  });

  it('stops when no candidate is safe', () => {
    const r = { x: 0, y: 0 };
    const ring = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const d = ROBOT_RADIUS + HUMAN_RADIUS + 0.08;
      return { id: `h${i}`, pos: { x: r.x + Math.cos(a) * d, y: r.y + Math.sin(a) * d }, vel: { x: -Math.cos(a) * 0.4, y: -Math.sin(a) * 0.4 }, facing: 0, radius: HUMAN_RADIUS };
    });
    const obs: Observation = { t: 0, robot: { pos: r, vel: { x: 0.6, y: 0 }, heading: 0 }, goal: { x: 3, y: 2 }, humans: ring, groups: [] };
    const res = plan({ reqId: 1, epoch: 0, obs, weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS, prev: null, stuckFor: 0, allowQuery: false });
    expect(res.noSafe).toBe(true);
    const stop = res.candidates[res.chosen];
    const vEnd = stop.vels[stop.vels.length - 1];
    expect(Math.hypot(vEnd.x, vEnd.y)).toBeLessThan(0.01);
  });

  it('the planner only receives observable data (no private customer goals)', () => {
    const eng = new SimEngine(SCENARIOS.teach, { mode: 'evaluation' });
    for (let i = 0; i < 60; i++) eng.step();
    const obs = eng.observe();
    for (const h of obs.humans) expect(Object.keys(h).sort()).toEqual(['facing', 'id', 'pos', 'radius', 'vel']);
    expect(JSON.stringify(obs)).not.toMatch(/script|priv|target|seat/);
  });
});

describe('authored scenes', () => {
  it('conversation partners stand in the same room (no wall between them)', () => {
    const cross = (p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean => {
      const d = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      return d(p, q, a) * d(p, q, b) < 0 && d(a, b, p) * d(a, b, q) < 0;
    };
    for (const sc of Object.values(SCENARIOS)) {
      for (const g of sc.groups) {
        const [a, b] = g.members.map((m) => sc.customers.find((c) => c.id === m)!.start.pos);
        const between = LAYOUT.walls.filter((w) => cross(a, b, w.a, w.b));
        expect(between, `${sc.id}/${g.id} has a wall between its members`).toEqual([]);
      }
    }
  });
});

describe('repeatability', () => {
  it('replays are deterministic and before/after share customer motion', () => {
    const a = runEpisode('teach', { weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS });
    const b = runEpisode('teach', { weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS });
    expect(a.frames.length).toBe(b.frames.length);
    const strip = (m: typeof a.metrics) => ({ ...m, planLatencyMeanMs: 0, planLatencyP95Ms: 0 });
    expect(strip(a.metrics)).toEqual(strip(b.metrics));
    expect(a.frames[a.frames.length - 1].robot.pos).toEqual(b.frames[b.frames.length - 1].robot.pos);
  });

  it('route hysteresis keeps Baymax from flip-flopping between routes', () => {
    const { model } = teach();
    const ep = runEpisode('generalize', { weights: model.weights, initialWeights: model.initialWeights });
    const routeSwitches = ep.decisions.filter((d, i) => i > 0 && d.routeId !== ep.decisions[i - 1].routeId).length;
    // upstairs rooms are tight, so the detour is intermittently infeasible and switches back more often
    expect(routeSwitches).toBeLessThanOrEqual(LAYOUT_ID === 'classic' ? 2 : LAYOUT_ID === 'long' ? 3 : 5);
  });
});
