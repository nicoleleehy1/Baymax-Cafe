// Before/after for the neural reward model on the active floor (BAYMAX_LAYOUT).
//  - factory:    the linear planner with initial weights (what the network was distilled from)
//  - pretrained: the pretrained network, no human input
//  - fine-tuned: the network after answering Baymax's question(s) in TEACH on this floor
//  - transfer:   (optional argv[2]) a network fine-tuned on another floor, applied unchanged
// Also scores both networks on a held-out set of "conversation vs. go around" preference pairs.
//   BAYMAX_LAYOUT=long tsx src/learning/neural/eval.ts [transferNet.json] [--save out.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { beforeAfter, runEpisode, type EpisodeResult } from '../../eval/runner';
import { INITIAL_WEIGHTS } from '../model';
import { recordCustomerTrack } from '../../sim/engine';
import { SCENARIO_ORDER, SCENARIOS } from '../../sim/scenarios';
import { LAYOUT_ID } from '../../world/layout';
import { fromJson, toJson, type MLP, type MLPJson } from './mlp';
import { planNeural, prefProbNeural, score, type Decision, type NeuralPreference } from './reward';
import { teachNeural } from './teach';

const args = process.argv.slice(2);
const saveIdx = args.indexOf('--save');
const savePath = saveIdx >= 0 ? args[saveIdx + 1] : null;
const transferPath = args[0] && !args[0].startsWith('--') ? args[0] : null;

const base = fromJson((JSON.parse(readFileSync('src/learning/neural/pretrained.json', 'utf8')) as { net: MLPJson }).net);

const m = (e: EpisodeResult) => ({
  done: e.metrics.completed,
  t: e.metrics.deliveryTime === null ? null : +e.metrics.deliveryTime.toFixed(1),
  intr: e.metrics.conversationIntrusions,
  intrT: +e.metrics.intrusionTime.toFixed(1),
  clr: +e.metrics.minClearance.toFixed(2),
  col: e.metrics.collisions,
  path: e.decisions.map((d) => d.label).join(' → '),
});

function episode(id: (typeof SCENARIO_ORDER)[number], net: MLP | null): EpisodeResult {
  const track = recordCustomerTrack(SCENARIOS[id]);
  return runEpisode(id, { weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS, track, planner: net ? (input) => planNeural(input, net, base) : undefined });
}

/** Held-out social preference pairs from this floor's recorded decisions (not used in fine-tuning). */
function preferenceSets(): { social: NeuralPreference[]; other: [number[], number[]][] } {
  const file = `node_modules/.cache/baymax-neural/${LAYOUT_ID}.json`;
  const social: NeuralPreference[] = [];
  const other: [number[], number[]][] = [];
  if (!existsSync(file)) return { social, other };
  const ds = (JSON.parse(readFileSync(file, 'utf8')) as { decisions: Decision[] }).decisions;
  for (let k = 0; k < ds.length; k += 3) {
    const X = ds[k].X;
    for (let i = 0; i < X.length; i++)
      for (let j = i + 1; j < X.length; j++) {
        const [a, b] = [X[i], X[j]];
        // index 0 = delay (×3 s), 2 = meters through conversation areas
        if (Math.abs(a[2] - b[2]) > 0.3 && Math.abs(a[0] - b[0]) < 1) social.push(a[2] < b[2] ? { preferred: a, other: b } : { preferred: b, other: a });
        else if (a[2] < 0.01 && b[2] < 0.01 && other.length < 20000) other.push([a, b]);
      }
  }
  return { social, other };
}

const replay = JSON.parse(readFileSync('src/learning/neural/replay.json', 'utf8')) as number[][][];
const { net: tuned, examples, log } = teachNeural(base, replay);
if (savePath) writeFileSync(savePath, JSON.stringify(toJson(tuned)));
const transfer = transferPath ? fromJson(JSON.parse(readFileSync(transferPath, 'utf8')) as MLPJson) : null;

const rows = SCENARIO_ORDER.map((id) => {
  const ba = beforeAfter(id, INITIAL_WEIGHTS, INITIAL_WEIGHTS);
  return {
    scenario: id,
    factory: m(ba.before),
    pretrained: m(episode(id, base)),
    fineTuned: m(episode(id, tuned)),
    transfer: transfer ? m(episode(id, transfer)) : undefined,
  };
});

const { social, other } = preferenceSets();
const acc = (n: MLP): number => social.filter((ex) => prefProbNeural(n, ex) > 0.5).length / Math.max(1, social.length);
const keep = (n: MLP): number => other.filter(([a, b]) => Math.sign(score(n, a) - score(n, b)) === Math.sign(score(base, a) - score(base, b))).length / Math.max(1, other.length);
console.log(
  JSON.stringify({
    layout: LAYOUT_ID,
    answers: examples.length,
    log,
    rows,
    socialPairs: social.length,
    socialAccuracy: { pretrained: acc(base), fineTuned: acc(tuned), transfer: transfer ? acc(transfer) : undefined },
    otherPairs: other.length,
    unchangedOrdering: { fineTuned: keep(tuned), transfer: transfer ? keep(transfer) : undefined },
  }),
);
