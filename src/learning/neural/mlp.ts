// A small multilayer perceptron with hand-written backprop and Adam. Dependency-free so the
// same code trains offline in Node and fine-tunes online in the planning Web Worker.
import { makeRng } from '../../core/rng';

export interface MLP {
  /** layer sizes, input first, e.g. [53, 32, 32, 1] */
  sizes: number[];
  /** W[l] is sizes[l+1] × sizes[l], row-major */
  W: Float64Array[];
  b: Float64Array[];
  /** input standardization fitted on the pretraining data */
  mean: Float64Array;
  std: Float64Array;
}

export interface MLPJson {
  sizes: number[];
  W: number[][];
  b: number[][];
  mean: number[];
  std: number[];
}

export function createMLP(sizes: number[], seed = 1): MLP {
  const rng = makeRng(seed);
  const gauss = (): number => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  const W: Float64Array[] = [];
  const b: Float64Array[] = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l];
    const w = new Float64Array(sizes[l + 1] * fanIn);
    for (let i = 0; i < w.length; i++) w[i] = gauss() / Math.sqrt(fanIn);
    W.push(w);
    b.push(new Float64Array(sizes[l + 1]));
  }
  return { sizes, W, b, mean: new Float64Array(sizes[0]), std: new Float64Array(sizes[0]).fill(1) };
}

export const cloneMLP = (m: MLP): MLP => ({
  sizes: [...m.sizes],
  W: m.W.map((w) => new Float64Array(w)),
  b: m.b.map((x) => new Float64Array(x)),
  mean: new Float64Array(m.mean),
  std: new Float64Array(m.std),
});

const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;
export const toJson = (m: MLP): MLPJson => ({
  sizes: m.sizes,
  W: m.W.map((w) => Array.from(w, r6)),
  b: m.b.map((x) => Array.from(x, r6)),
  mean: Array.from(m.mean, r6),
  std: Array.from(m.std, r6),
});
export const fromJson = (j: MLPJson): MLP => ({
  sizes: [...j.sizes],
  W: j.W.map((w) => Float64Array.from(w)),
  b: j.b.map((x) => Float64Array.from(x)),
  mean: Float64Array.from(j.mean),
  std: Float64Array.from(j.std),
});

export const paramCount = (m: MLP): number => m.W.reduce((s, w) => s + w.length, 0) + m.b.reduce((s, x) => s + x.length, 0);

/** Activations of every layer (index 0 = standardized input); hidden layers use tanh, output is linear. */
export function forwardAll(m: MLP, x: ArrayLike<number>): Float64Array[] {
  const a0 = new Float64Array(m.sizes[0]);
  for (let i = 0; i < a0.length; i++) a0[i] = (x[i] - m.mean[i]) / m.std[i];
  const acts = [a0];
  for (let l = 0; l < m.W.length; l++) {
    const nIn = m.sizes[l];
    const nOut = m.sizes[l + 1];
    const prev = acts[l];
    const out = new Float64Array(nOut);
    const w = m.W[l];
    for (let o = 0; o < nOut; o++) {
      let s = m.b[l][o];
      const row = o * nIn;
      for (let i = 0; i < nIn; i++) s += w[row + i] * prev[i];
      out[o] = l < m.W.length - 1 ? Math.tanh(s) : s;
    }
    acts.push(out);
  }
  return acts;
}

export const forward = (m: MLP, x: ArrayLike<number>): number => forwardAll(m, x)[m.W.length][0];

export interface Grads {
  W: Float64Array[];
  b: Float64Array[];
}
export const zeroGrads = (m: MLP): Grads => ({ W: m.W.map((w) => new Float64Array(w.length)), b: m.b.map((x) => new Float64Array(x.length)) });

/** Accumulate dScore/dθ · gOut into g, given the cached activations of one forward pass. */
export function backward(m: MLP, acts: Float64Array[], gOut: number, g: Grads): void {
  let delta = new Float64Array([gOut]);
  for (let l = m.W.length - 1; l >= 0; l--) {
    const nIn = m.sizes[l];
    const nOut = m.sizes[l + 1];
    const prev = acts[l];
    const w = m.W[l];
    const gw = g.W[l];
    const next = new Float64Array(nIn);
    for (let o = 0; o < nOut; o++) {
      const d = delta[o];
      if (d === 0) continue;
      g.b[l][o] += d;
      const row = o * nIn;
      for (let i = 0; i < nIn; i++) {
        gw[row + i] += d * prev[i];
        next[i] += d * w[row + i];
      }
    }
    if (l > 0) for (let i = 0; i < nIn; i++) next[i] *= 1 - prev[i] * prev[i]; // tanh'
    delta = next;
  }
}

export interface Adam {
  t: number;
  m: Grads;
  v: Grads;
}
export const createAdam = (net: MLP): Adam => ({ t: 0, m: zeroGrads(net), v: zeroGrads(net) });

export function adamStep(net: MLP, g: Grads, opt: Adam, lr: number, b1 = 0.9, b2 = 0.999): void {
  opt.t++;
  const c1 = 1 - b1 ** opt.t;
  const c2 = 1 - b2 ** opt.t;
  const upd = (p: Float64Array, gr: Float64Array, mm: Float64Array, vv: Float64Array): void => {
    for (let i = 0; i < p.length; i++) {
      mm[i] = b1 * mm[i] + (1 - b1) * gr[i];
      vv[i] = b2 * vv[i] + (1 - b2) * gr[i] * gr[i];
      p[i] -= (lr * (mm[i] / c1)) / (Math.sqrt(vv[i] / c2) + 1e-8);
    }
  };
  for (let l = 0; l < net.W.length; l++) {
    upd(net.W[l], g.W[l], opt.m.W[l], opt.v.W[l]);
    upd(net.b[l], g.b[l], opt.m.b[l], opt.v.b[l]);
  }
}
