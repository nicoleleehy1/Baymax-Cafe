// Interpretable linear reward model over trajectory features, trained online from
// pairwise human preferences with a Bradley-Terry / logistic likelihood:
//   U(traj) = -w · φ(traj)            (features are costs, weights are non-negative)
//   P(A ≻ B) = σ(U(A) - U(B))
//   loss = Σ -log P(preferred ≻ other) + (λ/2)‖w - w0‖²
import type { PreferenceExample, PreferenceModelState, UpdateReport } from '../core/types';

export const FEATURE_VERSION = 1;

export interface FeatureDef {
  key: string;
  name: string;
  unit: string;
  description: string;
}

export const FEATURES: FeatureDef[] = [
  { key: 'delay', name: 'Delivery delay', unit: '×3 s', description: 'Expected arrival time beyond the shortest route, per 3 seconds. Its weight is fixed at 1 and sets the scale for the others.' },
  { key: 'proximity', name: 'Closeness to people', unit: 'avg', description: 'Time-averaged closeness to predicted people within 0.9 m clearance.' },
  { key: 'conversation', name: 'Conversation intrusion', unit: 'm', description: 'Meters of path (horizon + remaining route) inside annotated conversation areas.' },
  { key: 'speedNear', name: 'Speed near people', unit: 'avg', description: 'Speed (fraction of max) weighted by closeness to people.' },
  { key: 'aisle', name: 'Aisle blocking', unit: 'avg', description: 'Time spent occupying the narrow aisle, more when others are predicted to need it.' },
  { key: 'abrupt', name: 'Abrupt motion', unit: 'avg', description: 'Squared acceleration and heading change along the trajectory.' },
];
export const FEATURE_NAMES = FEATURES.map((f) => f.key);
export const NF = FEATURES.length;

/**
 * Sensible defaults: Baymax already avoids crowding people and prefers smooth motion,
 * but barely values conversation space. That is the "socially clumsy" starting point.
 */
export const INITIAL_WEIGHTS: number[] = [1.0, 0.5, 0.15, 0.4, 0.6, 0.4];

/**
 * Bradley-Terry utilities are only defined up to scale, so the delay weight is held fixed
 * at 1 as the unit of measure: every other weight reads as "how many 3-second units of
 * delay Baymax will accept to avoid one unit of this cost".
 */
export const LEARNED: boolean[] = [false, true, true, true, true, true];

export const LEARN = { lambda: 0.15, lr: 0.2, iters: 400, minWeight: 0.02, maxWeight: 12 };

export const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

export function utility(w: number[], phi: number[]): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s -= w[i] * phi[i];
  return s;
}

export function prefProb(w: number[], phiPreferred: number[], phiOther: number[]): number {
  return sigmoid(utility(w, phiPreferred) - utility(w, phiOther));
}

export function createModel(): PreferenceModelState {
  return {
    featureVersion: FEATURE_VERSION,
    featureNames: [...FEATURE_NAMES],
    initialWeights: [...INITIAL_WEIGHTS],
    weights: [...INITIAL_WEIGHTS],
    examples: [],
    updatedAt: Date.now(),
  };
}

function pair(ex: PreferenceExample): [number[], number[]] {
  return ex.preferred === 'A' ? [ex.featuresA, ex.featuresB] : [ex.featuresB, ex.featuresA];
}

/** Full-batch gradient descent on the regularized logistic loss over all stored examples. */
export function fitWeights(w0: number[], examples: PreferenceExample[], start?: number[]): number[] {
  const w = [...(start ?? w0)];
  for (let it = 0; it < LEARN.iters; it++) {
    const g = w.map((wi, i) => LEARN.lambda * (wi - w0[i]));
    for (const ex of examples) {
      const [p, o] = pair(ex);
      // z = U(other) - U(preferred) = w·(φp - φo);  d/dw [log(1+e^z)] = σ(z)(φp - φo)
      let z = 0;
      for (let i = 0; i < NF; i++) z += w[i] * (p[i] - o[i]);
      const s = sigmoid(z);
      for (let i = 0; i < NF; i++) g[i] += s * (p[i] - o[i]);
    }
    for (let i = 0; i < NF; i++) {
      if (!LEARNED[i]) continue;
      w[i] = Math.min(LEARN.maxWeight, Math.max(LEARN.minWeight, w[i] - LEARN.lr * g[i]));
    }
  }
  return w;
}

export function loss(w: number[], w0: number[], examples: PreferenceExample[]): number {
  let L = 0;
  for (const ex of examples) {
    const [p, o] = pair(ex);
    L -= Math.log(prefProb(w, p, o) + 1e-12);
  }
  for (let i = 0; i < NF; i++) L += 0.5 * LEARN.lambda * (w[i] - w0[i]) ** 2;
  return L;
}

export function addPreference(model: PreferenceModelState, ex: PreferenceExample): { model: PreferenceModelState; report: UpdateReport } {
  const [p, o] = pair(ex);
  const before = [...model.weights];
  const examples = [...model.examples, ex];
  const after = fitWeights(model.initialWeights, examples);
  const report: UpdateReport = {
    weightsBefore: before,
    weightsAfter: after,
    featureDiff: p.map((x, i) => x - o[i]),
    probBefore: prefProb(before, p, o),
    probAfter: prefProb(after, p, o),
    rankBefore: { preferred: utility(before, p), other: utility(before, o) },
    rankAfter: { preferred: utility(after, p), other: utility(after, o) },
  };
  return { model: { ...model, weights: after, examples, updatedAt: Date.now() }, report };
}

export function isCompatible(m: PreferenceModelState | null | undefined): m is PreferenceModelState {
  return !!m && m.featureVersion === FEATURE_VERSION && Array.isArray(m.weights) && m.weights.length === NF;
}
