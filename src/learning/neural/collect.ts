// Pretraining data: record the factory planner's decisions on the active floor.
// Each episode runs with randomly perturbed weights so Baymax visits varied states (passing through,
// going around, waiting), and every planning step stores the safe candidates' descriptors together
// with their utility under the factory (initial) weights, the distillation target.
//   BAYMAX_LAYOUT=long tsx src/learning/neural/collect.ts [episodesPerScenario]
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeRng } from '../../core/rng';
import { runEpisode } from '../../eval/runner';
import { INITIAL_WEIGHTS, LEARNED } from '../model';
import { plan } from '../../planning/planner';
import { SCENARIO_ORDER } from '../../sim/scenarios';
import { LAYOUT_ID } from '../../world/layout';
import { describe } from './descriptor';
import type { Decision } from './reward';

export const DATA_DIR = 'node_modules/.cache/baymax-neural';

const perScenario = Number(process.argv[2] ?? 12);
const rng = makeRng(0xbe11 + LAYOUT_ID.length * 977);
const gauss = (): number => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());

const decisions: (Decision & { scenario: string; episode: number })[] = [];
for (const scenario of SCENARIO_ORDER) {
  for (let e = 0; e < perScenario; e++) {
    // episode 0 = factory weights; the rest are log-normal perturbations of the learned weights
    const w = INITIAL_WEIGHTS.map((x, i) => (e === 0 || !LEARNED[i] ? x : x * Math.exp(1.0 * gauss())));
    runEpisode(scenario, {
      weights: w,
      initialWeights: INITIAL_WEIGHTS,
      planner: (input) => {
        const r = plan(input);
        const safe = r.candidates.filter((c) => c.safe);
        if (!r.noSafe && safe.length >= 2) decisions.push({ scenario, episode: e, X: safe.map((c) => describe(c, r)), u0: safe.map((c) => c.utility0) });
        return r;
      },
    });
  }
}
mkdirSync(DATA_DIR, { recursive: true });
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;
writeFileSync(`${DATA_DIR}/${LAYOUT_ID}.json`, JSON.stringify({ layout: LAYOUT_ID, decisions: decisions.map((d) => ({ ...d, X: d.X.map((x) => x.map(r4)), u0: d.u0.map(r4) })) }));
const cands = decisions.reduce((s, d) => s + d.X.length, 0);
console.log(JSON.stringify({ layout: LAYOUT_ID, decisions: decisions.length, candidates: cands }));
