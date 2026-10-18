// `npm run eval:neural` — neural reward model before/after on every floor, plus cross-floor transfer:
// fine-tune on the café (floor 1) from one answer, then apply that network unchanged upstairs.
// Each layout is a module constant, so floors run as child processes selected with BAYMAX_LAYOUT.
import { execFileSync } from 'node:child_process';

type M = { done: boolean; t: number | null; intr: number; intrT: number; clr: number; col: number; path: string };
type Out = {
  layout: string;
  answers: number;
  log: string[];
  rows: { scenario: string; factory: M; pretrained: M; fineTuned: M; transfer?: M }[];
  socialPairs: number;
  socialAccuracy: { pretrained: number; fineTuned: number; transfer?: number };
  otherPairs: number;
  unchangedOrdering: { fineTuned: number; transfer?: number };
};

const tuned = 'node_modules/.cache/baymax-neural/tuned-long.json';
const run = (layout: string, extra: string[]): Out =>
  JSON.parse(
    execFileSync('npx', ['tsx', 'src/learning/neural/eval.ts', ...extra], { env: { ...process.env, BAYMAX_LAYOUT: layout }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim().split('\n').pop()!,
  ) as Out;

const outs = [run('long', ['--save', tuned]), ...['classic', 'cass', 'hiro'].map((l) => run(l, [tuned]))];
const f = (x: M | undefined): string => (x ? `${x.done ? '✓' : '✗'} ${x.t?.toFixed(1) ?? '—'}s intr=${x.intr} clr=${x.clr.toFixed(2)} col=${x.col}` : '');
const pct = (x: number | undefined): string => (x === undefined ? '—' : `${(100 * x).toFixed(1)}%`);
let ok = true;
for (const o of outs) {
  console.log(`\n=== ${o.layout} (${o.answers} answer${o.answers === 1 ? '' : 's'} on this floor) ===`);
  for (const l of o.log) console.log('  ' + l);
  for (const r of o.rows) {
    console.log(`  ${r.scenario.padEnd(10)} factory: ${f(r.factory)} | pretrained: ${f(r.pretrained)} | fine-tuned: ${f(r.fineTuned)}${r.transfer ? ` | from café: ${f(r.transfer)}` : ''}`);
    for (const x of [r.factory, r.pretrained, r.fineTuned, r.transfer]) if (x && (!x.done || x.col > 0)) ok = false;
  }
  console.log(`  held-out social pairs (${o.socialPairs}): pretrained ${pct(o.socialAccuracy.pretrained)} → fine-tuned ${pct(o.socialAccuracy.fineTuned)}${o.socialAccuracy.transfer !== undefined ? `, café-tuned ${pct(o.socialAccuracy.transfer)}` : ''}`);
  console.log(`  other pairs keeping the pretrained ordering (${o.otherPairs}): fine-tuned ${pct(o.unchangedOrdering.fineTuned)}${o.unchangedOrdering.transfer !== undefined ? `, café-tuned ${pct(o.unchangedOrdering.transfer)}` : ''}`);
}
console.log(ok ? '\nOK: every delivery completed with zero collisions.' : '\nFAILED: a delivery failed or collided, see rows above.');
process.exit(ok ? 0 : 1);
