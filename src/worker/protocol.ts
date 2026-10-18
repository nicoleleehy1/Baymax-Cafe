// Typed, versioned messages between the main thread and the planning/learning worker.
import type { PlanResult, PreferenceExample, PreferenceModelState, UpdateReport } from '../core/types';
import type { PlanInput } from '../planning/planner';
import type { ScenarioId } from '../sim/scenarios';
import type { BeforeAfter } from '../eval/runner';
import type { NeuralPreference } from '../learning/neural/reward';

export const PROTOCOL_VERSION = 1;

export type ToWorker =
  | { v: 1; type: 'plan'; input: PlanInput; neural?: NeuralSpec }
  | { v: 1; type: 'learn'; jobId: number; model: PreferenceModelState; example: PreferenceExample; neural?: NeuralSpec }
  | { v: 1; type: 'evaluate'; jobId: number; scenarioId: ScenarioId; initialWeights: number[]; learnedWeights: number[]; neural?: NeuralSpec };

/** present when the neural reward model scores plans: every answer so far, as descriptor pairs */
export interface NeuralSpec {
  prefs: NeuralPreference[];
}

export type FromWorker =
  | { v: 1; type: 'plan'; result: PlanResult }
  | { v: 1; type: 'learned'; jobId: number; model: PreferenceModelState; report: UpdateReport }
  | { v: 1; type: 'evaluated'; jobId: number; result: BeforeAfter; ms: number }
  | { v: 1; type: 'error'; message: string; jobId?: number };
