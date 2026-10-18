// Neural reward model: U(traj) = −delay(traj) + T · f_θ(descriptor(traj)), an MLP over trajectory
// descriptors. As in the linear model, delay keeps a fixed weight of 1 as the unit of measure; it also
// means no amount of fine-tuning can make waiting forever look free.
//
//  1. PRETRAIN (offline, `npm run neural:train`): distill the factory planner. For every recorded
//     decision, match softmax(f_θ) over the safe candidates to softmax(U_factory / T) (listwise KL).
//  2. FINE-TUNE (online, from a person's answers): Bradley-Terry preference loss
//     P(A ≻ B) = σ(U(A) − U(B)) plus an L2-SP pull back to the pretrained weights,
//     ‖θ − θ_pre‖², so one answer adjusts the network instead of overwriting it.
import type { PlanResult } from '../../core/types';
import { selectQuery } from '../../planning/planner';
import type { PlanInput } from '../../planning/planner';
import { plan } from '../../planning/planner';
import { describe } from './descriptor';
import { adamStep, backward, cloneMLP, createAdam, forward, forwardAll, zeroGrads, type MLP } from './mlp';

/** Score scale: utilities come out in the same units as the linear planner's U = −w·φ. */
export const T = 0.1;

/** descriptor index 0 is the delay feature (×3 s), weight fixed at 1 */
export const score = (net: MLP, x: ArrayLike<number>): number => -x[0] + T * forward(net, x);

// ------------------------------------------------------------------ planning with the network

/**
 * Run the normal planner (rollouts, prediction, hard safety rejection), then rank the surviving
 * candidates with the network instead of the linear weights. Safety is untouched: unsafe
 * candidates are never eligible, exactly as with the linear model.
 * `base` (the pretrained network) fills utility0, the "what would untaught Baymax do" counterfactual.
 */
export function planNeural(input: PlanInput, net: MLP, base?: MLP): PlanResult {
  const t0 = now();
  const r = plan({ ...input, allowQuery: false });
  if (r.chosen < 0 || r.noSafe) return r;
  for (const c of r.candidates) {
    const x = describe(c, r);
    c.utility = score(net, x);
    if (base) c.utility0 = score(base, x);
    c.total = c.utility - c.hysteresis;
  }
  const safe = r.candidates.filter((c) => c.safe);
  r.chosen = safe.reduce((a, b) => (b.total > a.total ? b : a)).index;
  r.chosenUnderInitial = safe.reduce((a, b) => (b.utility0 > a.utility0 ? b : a)).index;
  if (input.allowQuery) r.query = selectQuery(r, input.obs, r.zones);
  r.latencyMs += now() - t0;
  return r;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ------------------------------------------------------------------ pretraining (distillation)

export interface Decision {
  /** descriptors of the safe candidates */
  X: number[][];
  /** factory (initial-weight) utility of each, the distillation target */
  u0: number[];
}

/** weight of the centered utility-matching term (keeps far-apart options in the right order too) */
export const DISTILL = { alpha: 5 };

/**
 * Distillation loss for one decision; accumulates gradients into g when given.
 * Listwise KL between softmax(U/T) of network and factory sharpens the top choice; a centered
 * squared error on the utilities keeps the gaps between clearly worse options, which matter
 * when Baymax decides which alternative is worth asking about.
 */
export function distillLoss(net: MLP, d: Decision, g?: ReturnType<typeof zeroGrads>): { loss: number; top1: boolean; regret: number } {
  const n = d.X.length;
  const acts = d.X.map((x) => forwardAll(net, x));
  const s = acts.map((a, i) => a[a.length - 1][0] - d.X[i][0] / T); // = score / T
  const p = softmax(d.u0.map((u) => u / T));
  const q = softmax(s);
  const mU = (T * s.reduce((x, y) => x + y, 0)) / n;
  const m0 = d.u0.reduce((x, y) => x + y, 0) / n;
  const r = s.map((si, i) => T * si - mU - (d.u0[i] - m0));
  let loss = 0;
  for (let i = 0; i < n; i++) {
    if (p[i] > 0) loss += p[i] * (Math.log(p[i]) - Math.log(q[i] + 1e-12));
    loss += (DISTILL.alpha * r[i] * r[i]) / n;
  }
  if (g) for (let i = 0; i < n; i++) backward(net, acts[i], q[i] - p[i] + (2 * DISTILL.alpha * T * r[i]) / n, g);
  // regret: how much factory utility is lost by taking the network's pick instead of the factory's
  return { loss, top1: argmax(s) === argmax(d.u0), regret: Math.max(...d.u0) - d.u0[argmax(s)] };
}

// ------------------------------------------------------------------ fine-tuning (preferences)

export interface NeuralPreference {
  preferred: number[];
  other: number[];
}

/** steps/lr: Adam; lambda: L2-SP pull to the pretrained weights; mu: weight of the replay (rehearsal) term */
export const FINETUNE = { steps: 150, lr: 2e-3, lambda: 0.02, mu: 3 };

export function prefProbNeural(net: MLP, ex: NeuralPreference): number {
  return sigmoid(score(net, ex.preferred) - score(net, ex.other));
}

export function preferenceLoss(net: MLP, pretrained: MLP, examples: NeuralPreference[], lambda = FINETUNE.lambda): number {
  let L = 0;
  for (const ex of examples) L -= Math.log(prefProbNeural(net, ex) + 1e-12);
  return L + 0.5 * lambda * sqDist(net, pretrained);
}

/**
 * Full-batch Adam on the Bradley-Terry loss over every stored answer, starting from the pretrained net.
 * `replay` holds candidate sets from situations without conversations; the network is asked to keep
 * ranking them like the pretrained network (listwise KL), so the lesson stays about conversations.
 */
export function fineTune(pretrained: MLP, examples: NeuralPreference[], o: Partial<typeof FINETUNE> = {}, replay: number[][][] = []): MLP {
  const { steps, lr, lambda, mu } = { ...FINETUNE, ...o };
  const net = cloneMLP(pretrained);
  if (examples.length === 0) return net;
  const anchors: Decision[] = replay.map((X) => ({ X, u0: X.map((x) => score(pretrained, x)) }));
  const opt = createAdam(net);
  for (let it = 0; it < steps; it++) {
    const g = zeroGrads(net);
    for (const ex of examples) {
      const ap = forwardAll(net, ex.preferred);
      const ao = forwardAll(net, ex.other);
      const z = -ex.preferred[0] + ex.other[0] + T * (ap[ap.length - 1][0] - ao[ao.length - 1][0]);
      const k = T * (1 - sigmoid(z)); // d(−log σ(z)) / d s_preferred = −k
      backward(net, ap, -k, g);
      backward(net, ao, k, g);
    }
    if (anchors.length && mu > 0) {
      const gr = zeroGrads(net);
      for (const d of anchors) distillLoss(net, d, gr);
      const c = mu / anchors.length;
      for (let l = 0; l < net.W.length; l++) {
        for (let i = 0; i < g.W[l].length; i++) g.W[l][i] += c * gr.W[l][i];
        for (let i = 0; i < g.b[l].length; i++) g.b[l][i] += c * gr.b[l][i];
      }
    }
    for (let l = 0; l < net.W.length; l++) {
      for (let i = 0; i < net.W[l].length; i++) g.W[l][i] += lambda * (net.W[l][i] - pretrained.W[l][i]);
      for (let i = 0; i < net.b[l].length; i++) g.b[l][i] += lambda * (net.b[l][i] - pretrained.b[l][i]);
    }
    adamStep(net, g, opt, lr);
  }
  return net;
}

export function sqDist(a: MLP, b: MLP): number {
  let s = 0;
  for (let l = 0; l < a.W.length; l++) {
    for (let i = 0; i < a.W[l].length; i++) s += (a.W[l][i] - b.W[l][i]) ** 2;
    for (let i = 0; i < a.b[l].length; i++) s += (a.b[l][i] - b.b[l][i]) ** 2;
  }
  return s;
}

// ------------------------------------------------------------------ helpers

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export function softmax(v: number[]): number[] {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

export function argmax(v: number[]): number {
  let b = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[b]) b = i;
  return b;
}
