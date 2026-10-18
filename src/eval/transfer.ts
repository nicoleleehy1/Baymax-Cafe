// Cross-floor transfer check: teach Baymax once on the café, then apply those weights, untouched,
// to every other floor's scenarios. Each layout is a module constant, so floors run as child
// processes selected with BAYMAX_LAYOUT.   npm run eval:transfer [source-layout]
import { execFileSync } from 'node:child_process';

const source = process.argv[2] ?? 'long';
const layouts = ['classic', 'long', 'cass', 'hiro'];
const run = (layout: string, script: string, arg?: string): string =>
  execFileSync('npx', ['tsx', script, ...(arg ? [arg] : [])], { env: { ...process.env, BAYMAX_LAYOUT: layout }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim().split('\n').pop()!;

const taught = JSON.parse(run(source, 'src/eval/teachWeights.ts')) as { weights: number[]; examples: number };
console.log(`Taught on "${source}" with ${taught.examples} answer(s). Weights:`, taught.weights.map((x) => x.toFixed(2)).join(' '));
let ok = true;
for (const layout of layouts.filter((l) => l !== source)) {
  const rows = JSON.parse(run(layout, 'src/eval/applyWeights.ts', JSON.stringify(taught.weights))) as Array<{ layout: string; scenario: string; before: { done: boolean; t: number | null; intr: number; clr: number; col: number }; after: { done: boolean; t: number | null; intr: number; clr: number; col: number }; firstChoice: { initial?: string; learned?: string } }>;
  for (const r of rows) {
    const f = (m: typeof r.before) => `done=${m.done} t=${m.t?.toFixed(1) ?? '—'}s intr=${m.intr} clr=${m.clr} col=${m.col}`;
    const transfer = r.scenario === 'adapt' ? 'n/a' : r.before.intr > 0 && r.after.intr === 0 ? 'TRANSFERRED' : 'no change';
    if (r.scenario !== 'adapt' && transfer !== 'TRANSFERRED') ok = false;
    if (!r.after.done || r.after.col > 0 || r.before.col > 0) ok = false;
    console.log(`${r.layout.padEnd(8)} ${r.scenario.padEnd(10)} before: ${f(r.before)} | after: ${f(r.after)} | ${transfer}`);
  }
}
console.log(ok ? 'OK: the café lesson transfers to every other floor with no collisions.' : 'FAILED: see rows above.');
process.exit(ok ? 0 : 1);
