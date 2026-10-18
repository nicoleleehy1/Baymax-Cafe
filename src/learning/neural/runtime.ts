// The neural reward model inside the app: ships the pretrained weights and the replay set, and keeps
// the fine-tuned network for the current answers cached in the planning worker.
import type { CandidateSummary, PlanResult, PreferenceExample } from '../../core/types';
import { runEpisode, type BeforeAfter } from '../../eval/runner';
import type { PlanInput } from '../../planning/planner';
import { recordCustomerTrack } from '../../sim/engine';
import { SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { INITIAL_WEIGHTS } from '../model';
import { describe } from './descriptor';
import { fromJson, paramCount, type MLP, type MLPJson } from './mlp';
import pretrainedFile from './pretrained.json';
import replayFile from './replay.json';
import { fineTune, planNeural, prefProbNeural, type NeuralPreference } from './reward';

export type Brain = 'linear' | 'neural';

export const PRETRAINED: MLP = fromJson((pretrainedFile as { net: MLPJson }).net);
export const PARAMS = paramCount(PRETRAINED);
const REPLAY = replayFile as number[][][];

/** Descriptors of the two compared options, stored with the answer so the network can be re-fine-tuned later. */
export function withDescriptors(ex: PreferenceExample, q: PlanResult): PreferenceExample {
  const a: CandidateSummary = q.candidates[q.query!.a];
  const b: CandidateSummary = q.candidates[q.query!.b];
  return { ...ex, descA: describe(a, q), descB: describe(b, q) };
}

export function neuralPreferences(examples: PreferenceExample[]): NeuralPreference[] {
  return examples
    .filter((e) => e.descA && e.descB)
    .map((e) => (e.preferred === 'A' ? { preferred: e.descA!, other: e.descB! } : { preferred: e.descB!, other: e.descA! }));
}

let cache: { key: string; net: MLP } = { key: '', net: PRETRAINED };
const keyOf = (prefs: NeuralPreference[]): string => prefs.map((p) => `${p.preferred[0]}:${p.preferred[2]}:${p.other[0]}:${p.other[2]}`).join('|');

/** Network fine-tuned on these answers (cached: fine-tuning runs once per new answer, not per plan). */
export function netFor(prefs: NeuralPreference[]): MLP {
  const key = keyOf(prefs);
  if (key !== cache.key) cache = { key, net: prefs.length ? fineTune(PRETRAINED, prefs, {}, REPLAY) : PRETRAINED };
  return cache.net;
}

export const planWithNet = (input: PlanInput, prefs: NeuralPreference[]): PlanResult => planNeural(input, netFor(prefs), PRETRAINED);

/** Fine-tune on all answers including the newest; report how the newest answer's probability moved. */
export function learnNeural(prefs: NeuralPreference[]): { probBefore: number; probAfter: number; ms: number } {
  const last = prefs[prefs.length - 1];
  const before = prefProbNeural(netFor(prefs.slice(0, -1)), last);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const net = netFor(prefs);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { probBefore: before, probAfter: prefProbNeural(net, last), ms };
}

/** Controlled comparison with the networks: pretrained (before) vs fine-tuned (after), identical customers. */
export function beforeAfterNeural(scenarioId: ScenarioId, prefs: NeuralPreference[]): BeforeAfter {
  const track = recordCustomerTrack(SCENARIOS[scenarioId]);
  const tuned = netFor(prefs);
  const run = (net: MLP) => runEpisode(scenarioId, { weights: INITIAL_WEIGHTS, initialWeights: INITIAL_WEIGHTS, track, planner: (i) => planNeural(i, net, PRETRAINED) });
  const before = run(PRETRAINED);
  const after = run(tuned);
  return { scenarioId, before, after, identicalCustomers: true };
}
