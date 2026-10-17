// Tiny IndexedDB wrapper: one store for the preference model, one for evaluation run summaries.
// Every call degrades gracefully (returns null / no-ops) if IndexedDB is unavailable.
import type { PreferenceModelState } from '../core/types';
import type { Metrics } from '../sim/metrics';

const DB_NAME = 'after-you-baymax';
const DB_VERSION = 1;

export interface RunSummary {
  id: string;
  createdAt: number;
  scenarioId: string;
  featureVersion: number;
  initialWeights: number[];
  learnedWeights: number[];
  before: Metrics;
  after: Metrics;
  identicalCustomers: boolean;
}

let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('model')) db.createObjectStore('model');
        if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const r = fn(db.transaction(store, mode).objectStore(store));
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const loadModel = (): Promise<PreferenceModelState | null> => tx<PreferenceModelState>('model', 'readonly', (s) => s.get('current'));
export const saveModel = (m: PreferenceModelState): Promise<unknown> => tx('model', 'readwrite', (s) => s.put(m, 'current'));
export const saveRun = (r: RunSummary): Promise<unknown> => tx('runs', 'readwrite', (s) => s.put(r));
export const listRuns = (): Promise<RunSummary[] | null> => tx<RunSummary[]>('runs', 'readonly', (s) => s.getAll() as IDBRequest<RunSummary[]>);
export const clearRuns = (): Promise<unknown> => tx('runs', 'readwrite', (s) => s.clear());
