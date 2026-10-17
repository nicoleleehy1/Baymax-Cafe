// Pure message handler shared by the Web Worker and by tests (which use it to simulate
// delayed or reordered worker replies).
import { beforeAfter } from '../eval/runner';
import { addPreference } from '../learning/model';
import { plan } from '../planning/planner';
import { LAYOUT_ID } from '../world/layout';
import { PROTOCOL_VERSION, type FromWorker, type ToWorker } from './protocol';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function handleMessage(msg: ToWorker): FromWorker {
  if (!msg || msg.v !== PROTOCOL_VERSION) return { v: 1, type: 'error', message: `protocol mismatch: ${JSON.stringify(msg?.v)}` };
  try {
    switch (msg.type) {
      case 'plan':
        if (msg.input.layoutId && msg.input.layoutId !== LAYOUT_ID) return { v: 1, type: 'error', message: `layout mismatch: page ${msg.input.layoutId}, worker ${LAYOUT_ID}` };
        return { v: 1, type: 'plan', result: plan(msg.input) };
      case 'learn': {
        const { model, report } = addPreference(msg.model, msg.example);
        return { v: 1, type: 'learned', jobId: msg.jobId, model, report };
      }
      case 'evaluate': {
        const t0 = now();
        const result = beforeAfter(msg.scenarioId, msg.initialWeights, msg.learnedWeights);
        return { v: 1, type: 'evaluated', jobId: msg.jobId, result, ms: now() - t0 };
      }
    }
  } catch (e) {
    return { v: 1, type: 'error', message: e instanceof Error ? e.message : String(e), jobId: 'jobId' in msg ? msg.jobId : undefined };
  }
}
