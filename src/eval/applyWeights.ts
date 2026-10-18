// Before/after on the active layout using weights learned somewhere else (argv[2] = JSON array).
import { INITIAL_WEIGHTS } from '../learning/model';
import { SCENARIO_ORDER } from '../sim/scenarios';
import { LAYOUT } from '../world/layout';
import { beforeAfter } from './runner';

const w = JSON.parse(process.argv[2]) as number[];
const rows = SCENARIO_ORDER.map((id) => {
  const ba = beforeAfter(id, INITIAL_WEIGHTS, w);
  const m = (x: typeof ba.before.metrics) => ({ done: x.completed, t: x.deliveryTime, intr: x.conversationIntrusions, clr: +x.minClearance.toFixed(2), col: x.collisions });
  return { layout: LAYOUT.id, scenario: id, identicalCustomers: ba.identicalCustomers, before: m(ba.before.metrics), after: m(ba.after.metrics), firstChoice: { initial: ba.before.decisions[0]?.label, learned: ba.after.decisions[0]?.label } };
});
console.log(JSON.stringify(rows));
