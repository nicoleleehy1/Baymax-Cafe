// `npm run eval` — reproduces the core demo headlessly and prints real measured numbers.
//  1. TEACH with a scripted "teacher" that answers Baymax's query (prefers less conversation intrusion)
//  2. Before/after on all three scenarios with identical recorded customer motion
import { addPreference, createModel, FEATURES } from '../learning/model';
import { SCENARIO_ORDER } from '../sim/scenarios';
import { beforeAfter, conversationOracle, exampleFromQuery, runEpisode } from './runner';
import type { Metrics } from '../sim/metrics';

let model = createModel();
const fmtW = (w: number[]): string => w.map((x, i) => `${FEATURES[i].key}=${x.toFixed(2)}`).join('  ');

console.log('Initial weights:', fmtW(model.weights));
const teach = runEpisode('teach', {
  weights: model.weights,
  initialWeights: model.initialWeights,
  allowQuery: true,
  onQuery: (res) => {
    const a = res.candidates[res.query!.a];
    const b = res.candidates[res.query!.b];
    const pick = conversationOracle(res);
    console.log(`\n[t=${res.tObs.toFixed(2)}s] Query: "${res.query!.prompt}"`);
    console.log(`  A: ${a.label}  U=${a.utility.toFixed(3)}  φ=[${a.features.map((x) => x.toFixed(2)).join(', ')}]`);
    console.log(`  B: ${b.label}  U=${b.utility.toFixed(3)}  φ=[${b.features.map((x) => x.toFixed(2)).join(', ')}]`);
    console.log(`  Teacher prefers ${pick}`);
    const { model: m2, report } = addPreference(model, exampleFromQuery(res, 'teach', pick));
    model = m2;
    console.log(`  P(preferred) ${report.probBefore.toFixed(3)} → ${report.probAfter.toFixed(3)}`);
    console.log('  Weights after:', fmtW(model.weights));
    return model.weights;
  },
});
console.log('\nTEACH decisions:', teach.decisions.map((d) => `${d.t.toFixed(1)}s ${d.label}`).join(' | '));
console.log('TEACH metrics:', summarize(teach.metrics));

for (const id of SCENARIO_ORDER) {
  const ba = beforeAfter(id, model.initialWeights, model.weights);
  console.log(`\n=== ${id.toUpperCase()} (identical customer motion: ${ba.identicalCustomers}) ===`);
  console.log('  before:', summarize(ba.before.metrics));
  console.log('          ', ba.before.decisions.map((d) => d.label).join(' → '));
  console.log('  after: ', summarize(ba.after.metrics));
  console.log('          ', ba.after.decisions.map((d) => d.label).join(' → '));
}

function summarize(m: Metrics): string {
  return [
    `done=${m.completed}`,
    `time=${m.deliveryTime?.toFixed(1) ?? '—'}s`,
    `intrusions=${m.conversationIntrusions} (${m.intrusionTime.toFixed(1)}s)`,
    `minClear=${m.minClearance.toFixed(2)}m`,
    `tooClose=${m.timeTooClose.toFixed(1)}s`,
    `hardBrakes=${m.hardBrakes}`,
    `collisions=${m.collisions}`,
    `plan=${m.planLatencyMeanMs.toFixed(2)}/${m.planLatencyP95Ms.toFixed(2)}ms`,
  ].join('  ');
}
