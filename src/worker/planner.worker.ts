/// <reference lib="webworker" />
import { plan } from '../planning/planner';
import { addPreference } from '../learning/model';
import { beforeAfter } from '../eval/runner';
import { PROTOCOL_VERSION, type FromWorker, type ToWorker } from './protocol';

const post = (m: FromWorker): void => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  if (!msg || msg.v !== PROTOCOL_VERSION) {
    post({ v: 1, type: 'error', message: `protocol mismatch: ${JSON.stringify(msg?.v)}` });
    return;
  }
  try {
    switch (msg.type) {
      case 'plan':
        post({ v: 1, type: 'plan', result: plan(msg.input) });
        break;
      case 'learn': {
        const { model, report } = addPreference(msg.model, msg.example);
        post({ v: 1, type: 'learned', jobId: msg.jobId, model, report });
        break;
      }
      case 'evaluate': {
        const t0 = performance.now();
        const result = beforeAfter(msg.scenarioId, msg.initialWeights, msg.learnedWeights);
        post({ v: 1, type: 'evaluated', jobId: msg.jobId, result, ms: performance.now() - t0 });
        break;
      }
    }
  } catch (e) {
    post({ v: 1, type: 'error', message: e instanceof Error ? e.message : String(e), jobId: 'jobId' in msg ? msg.jobId : undefined });
  }
};
