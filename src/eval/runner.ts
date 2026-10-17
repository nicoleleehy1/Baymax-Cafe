// Headless, deterministic episodes: the same planner code as the interactive app, run in
// lock-step (plan → apply → step) so results are repeatable.
import type { PlanResult, PreferenceExample } from '../core/types';
import { plan } from '../planning/planner';
import { recordCustomerTrack, SimEngine, type CustomerTrack } from '../sim/engine';
import type { Frame, Metrics } from '../sim/metrics';
import { SCENARIOS, type ScenarioId } from '../sim/scenarios';

export interface EpisodeOptions {
  weights: number[];
  initialWeights: number[];
  track?: CustomerTrack;
  /** called when the planner proposes a teaching query; return new weights to apply */
  onQuery?: (res: PlanResult, engine: SimEngine) => number[] | null;
  allowQuery?: boolean;
  maxQueries?: number;
}

export interface EpisodeResult {
  scenarioId: ScenarioId;
  frames: Frame[];
  metrics: Metrics;
  /** chosen behavior label timeline (deduplicated) */
  decisions: { t: number; label: string; routeId: string }[];
  /** for each planning step: whether initial weights would have chosen differently */
  divergentDecisions: number;
  planCount: number;
  queries: number;
  finalWeights: number[];
}

export function runEpisode(scenarioId: ScenarioId, o: EpisodeOptions): EpisodeResult {
  const scenario = SCENARIOS[scenarioId];
  const track = o.track ?? recordCustomerTrack(scenario);
  const eng = new SimEngine(scenario, { mode: 'evaluation', track, returnAfterDelivery: false, customersAvoidRobot: false });
  let weights = [...o.weights];
  const decisions: EpisodeResult['decisions'] = [];
  let divergent = 0;
  let planCount = 0;
  let queries = 0;
  let lastQueryT = -Infinity;
  while (!eng.finished) {
    if (eng.needsPlan()) {
      eng.markPlanRequested();
      const allowQuery = !!o.allowQuery && queries < (o.maxQueries ?? 1) && eng.t - lastQueryT > 15;
      const res = plan({
        reqId: eng.nextReqId(),
        epoch: eng.epoch,
        obs: eng.observe(),
        weights,
        initialWeights: o.initialWeights,
        prev: eng.prevMeta,
        stuckFor: eng.robot.stuckFor,
        allowQuery,
      });
      planCount++;
      if (res.query && o.onQuery) {
        queries++;
        lastQueryT = eng.t;
        const nw = o.onQuery(res, eng);
        if (nw) {
          weights = nw;
          // replan immediately with the updated model, from the same state
          const res2 = plan({ reqId: eng.nextReqId(), epoch: eng.epoch, obs: eng.observe(), weights, initialWeights: o.initialWeights, prev: eng.prevMeta, stuckFor: eng.robot.stuckFor, allowQuery: false });
          eng.applyPlan(res2);
          track2(res2);
        } else {
          eng.applyPlan(res);
          track2(res);
        }
      } else {
        eng.applyPlan(res);
        track2(res);
      }
    }
    eng.step();
  }

  function track2(res: PlanResult): void {
    if (res.chosen < 0) return;
    const c = res.candidates[res.chosen];
    if (res.chosenUnderInitial !== res.chosen && res.candidates[res.chosenUnderInitial]?.label !== c.label) divergent++;
    const last = decisions[decisions.length - 1];
    if (!last || last.label !== c.label) decisions.push({ t: eng.t, label: c.label, routeId: c.meta.routeId });
  }

  return {
    scenarioId,
    frames: eng.frames,
    metrics: eng.metrics(),
    decisions,
    divergentDecisions: divergent,
    planCount,
    queries,
    finalWeights: weights,
  };
}

export interface BeforeAfter {
  scenarioId: ScenarioId;
  before: EpisodeResult;
  after: EpisodeResult;
  /** sanity: both runs used the exact same customer frames */
  identicalCustomers: boolean;
}

/** Controlled comparison: identical recorded customer motion, initial vs learned weights. */
export function beforeAfter(scenarioId: ScenarioId, initialWeights: number[], learnedWeights: number[]): BeforeAfter {
  const track = recordCustomerTrack(SCENARIOS[scenarioId]);
  const before = runEpisode(scenarioId, { weights: initialWeights, initialWeights, track });
  const after = runEpisode(scenarioId, { weights: learnedWeights, initialWeights, track });
  const n = Math.min(before.frames.length, after.frames.length);
  let identical = true;
  for (let i = 0; i < n && identical; i++) {
    const a = before.frames[i].humans;
    const b = after.frames[i].humans;
    for (let j = 0; j < a.length; j++) {
      if (a[j].pos.x !== b[j].pos.x || a[j].pos.y !== b[j].pos.y) {
        identical = false;
        break;
      }
    }
  }
  return { scenarioId, before, after, identicalCustomers: identical };
}

/** Teaching oracle for tests/CLI: prefers whichever option intrudes less on conversations. */
export function conversationOracle(res: PlanResult): 'A' | 'B' {
  const a = res.candidates[res.query!.a];
  const b = res.candidates[res.query!.b];
  return b.features[2] < a.features[2] - 1e-6 ? 'B' : 'A';
}

export function exampleFromQuery(res: PlanResult, scenarioId: string, preferred: 'A' | 'B'): PreferenceExample {
  const a = res.candidates[res.query!.a];
  const b = res.candidates[res.query!.b];
  return {
    id: `ex-${scenarioId}-${res.tObs.toFixed(2)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    scenarioId,
    tObs: res.tObs,
    featuresA: [...a.features],
    featuresB: [...b.features],
    labelA: a.label,
    labelB: b.label,
    preferred,
  };
}
