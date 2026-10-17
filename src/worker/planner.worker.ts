/// <reference lib="webworker" />
import { handleMessage } from './handler';
import type { ToWorker } from './protocol';

self.onmessage = (ev: MessageEvent<ToWorker>) => {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(handleMessage(ev.data));
};
