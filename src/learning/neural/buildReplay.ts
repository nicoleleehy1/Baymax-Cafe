// Replay set for fine-tuning: a small sample of pretraining situations with no conversation nearby.
// During fine-tuning the network is asked to keep ranking these the way the pretrained network does,
// so a lesson about conversations doesn't leak into unrelated behavior (rehearsal, as in RLHF's
// pull toward the reference model).   Run by `npm run neural:train` after train.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { makeRng } from '../../core/rng';
import type { Decision } from './reward';

const FLOORS = ['classic', 'long', 'cass']; // pretraining floors only; hiro stays held out
const N = 96;
const MAX_CANDIDATES = 10;
const rng = makeRng(11);
const pool: number[][][] = [];
for (const id of FLOORS) {
  const ds = (JSON.parse(readFileSync(`node_modules/.cache/baymax-neural/${id}.json`, 'utf8')) as { decisions: Decision[] }).decisions;
  // index 2 = meters through conversation areas
  for (const d of ds) if (d.X.length >= 3 && d.X.every((x) => x[2] < 0.01)) pool.push(d.X);
}
const out: number[][][] = [];
for (let i = 0; i < N && pool.length; i++) {
  const X = pool.splice(Math.floor(rng() * pool.length), 1)[0];
  while (X.length > MAX_CANDIDATES) X.splice(Math.floor(rng() * X.length), 1);
  out.push(X.map((x) => x.map((v) => Math.round(v * 1000) / 1000)));
}
writeFileSync('src/learning/neural/replay.json', JSON.stringify(out));
console.log(`Replay set: ${out.length} decisions, ${out.reduce((s, X) => s + X.length, 0)} candidates (from ${pool.length + out.length} without conversations)`);
