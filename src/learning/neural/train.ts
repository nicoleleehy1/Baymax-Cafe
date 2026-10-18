// Pretrain the neural reward model by distilling the factory planner, then save the weights the app
// and evals load.   npm run neural:train   (collects data first; see package.json)
// Train floors: classic, long, cass. Held out: hiro (top floor), never seen during pretraining.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeRng } from '../../core/rng';
import { DESCRIPTOR_DIM } from './descriptor';
import { adamStep, createAdam, createMLP, paramCount, toJson, zeroGrads, type MLP } from './mlp';
import { distillLoss, type Decision } from './reward';

const DATA_DIR = 'node_modules/.cache/baymax-neural';
const TRAIN = ['classic', 'long', 'cass'];
const HELD_OUT = ['hiro'];
const HP = { hidden: [32, 32], epochs: 40, batch: 32, lr: 3e-3, lrEnd: 3e-4, seed: 7 };

const load = (id: string): Decision[] => (JSON.parse(readFileSync(`${DATA_DIR}/${id}.json`, 'utf8')) as { decisions: Decision[] }).decisions;
const train = TRAIN.flatMap(load);
const held = HELD_OUT.flatMap(load);

// a slice of the train floors is held back for validation
const rng = makeRng(HP.seed);
shuffle(train);
const nVal = Math.round(train.length * 0.1);
const val = train.splice(0, nVal);

const net = createMLP([DESCRIPTOR_DIM, ...HP.hidden, 1], HP.seed);
standardize(net, train);
console.log(`Pretraining a ${net.sizes.join('→')} MLP (${paramCount(net)} parameters)`);
console.log(`Decisions: train ${train.length}, validation ${val.length} (same floors), held-out floor ${held.length} (${HELD_OUT.join(', ')})`);
report('untrained', net);

const opt = createAdam(net);
const t0 = Date.now();
for (let ep = 0; ep < HP.epochs; ep++) {
  shuffle(train);
  const lr = HP.lr * (HP.lrEnd / HP.lr) ** (ep / Math.max(1, HP.epochs - 1));
  for (let i = 0; i < train.length; i += HP.batch) {
    const batch = train.slice(i, i + HP.batch);
    const g = zeroGrads(net);
    for (const d of batch) distillLoss(net, d, g);
    for (const gw of [...g.W, ...g.b]) for (let k = 0; k < gw.length; k++) gw[k] /= batch.length;
    adamStep(net, g, opt, lr);
  }
  if (ep % 10 === 9 || ep === HP.epochs - 1) report(`epoch ${ep + 1}`, net);
}
console.log(`Training took ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const out = 'src/learning/neural/pretrained.json';
writeFileSync(out, JSON.stringify({ trainedOn: TRAIN, heldOut: HELD_OUT, decisions: train.length, hyper: HP, net: toJson(net) }));
console.log(`Saved ${out}`);

function report(tag: string, m: MLP): void {
  const f = (ds: Decision[]): string => {
    let L = 0;
    let top = 0;
    let reg = 0;
    for (const d of ds) {
      const r = distillLoss(m, d);
      L += r.loss;
      top += r.top1 ? 1 : 0;
      reg += r.regret;
    }
    return `KL ${(L / ds.length).toFixed(3)}, same pick ${((100 * top) / ds.length).toFixed(1)}%, regret ${(reg / ds.length).toFixed(4)}`;
  };
  console.log(`  ${tag.padEnd(10)} train: ${f(train)} | val: ${f(val)} | held-out floor: ${f(held)}`);
}

function standardize(m: MLP, ds: Decision[]): void {
  const n = DESCRIPTOR_DIM;
  const s = new Float64Array(n);
  const s2 = new Float64Array(n);
  let c = 0;
  for (const d of ds)
    for (const x of d.X) {
      for (let i = 0; i < n; i++) {
        s[i] += x[i];
        s2[i] += x[i] * x[i];
      }
      c++;
    }
  for (let i = 0; i < n; i++) {
    m.mean[i] = s[i] / c;
    const v = s2[i] / c - m.mean[i] ** 2;
    m.std[i] = v > 1e-8 ? Math.sqrt(v) : 1;
  }
}

function shuffle<X>(a: X[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
