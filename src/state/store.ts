// UI/application state (Zustand). Updated on events and at a throttled rate, never per frame.
import { create } from 'zustand';
import type { PlanResult, PreferenceModelState, UpdateReport } from '../core/types';
import type { BeforeAfter } from '../eval/runner';
import { createModel } from '../learning/model';
import type { Brain } from '../learning/neural/runtime';
import type { Metrics } from '../sim/metrics';
import type { ScenarioId } from '../sim/scenarios';

export type RunState = 'ready' | 'running' | 'teaching' | 'learning' | 'finished';
export type ViewMode = 'cafe' | 'considering';

export interface DialogueLine {
  id: number;
  speaker: 'cass' | 'baymax' | 'system';
  text: string;
  t: number;
}

export interface Hud {
  t: number;
  phase: string;
  label: string;
  speed: number;
  tableId: string | null;
  latencyMs: number;
  replans: number;
  noSafe: boolean;
  chosenDiffersFromInitial: boolean;
  initialChoiceLabel: string | null;
}

export interface LearningEvidence {
  report: UpdateReport;
  preferredLabel: string;
  otherLabel: string;
  at: number;
}

export interface AppState {
  scenarioId: ScenarioId;
  runState: RunState;
  view: ViewMode;
  replayActive: boolean;
  askEnabled: boolean;
  /** which reward model scores Baymax's options: six linear weights, or the pretrained neural network */
  brain: Brain;
  model: PreferenceModelState;
  modelLoaded: boolean;
  query: PlanResult | null;
  /** teaching preview: pinned option (hover/selection) and comparison mode */
  previewFocus: 'A' | 'B' | null;
  previewCompare: boolean;
  /** show every storey of the building (otherwise floors above the active one are hidden) */
  buildingView: boolean;
  evidence: LearningEvidence | null;
  dialogue: DialogueLine[];
  hud: Hud;
  plan: PlanResult | null;
  liveMetrics: Metrics | null;
  evaluation: { status: 'idle' | 'running' | 'done' | 'error'; result?: BeforeAfter; ms?: number; error?: string };
  set: (p: Partial<AppState>) => void;
  say: (speaker: DialogueLine['speaker'], text: string, t: number) => void;
}

let lineId = 0;

function initialBrain(): Brain {
  const g = globalThis as { location?: { search: string } };
  return g.location && new URLSearchParams(g.location.search).get('brain') === 'neural' ? 'neural' : 'linear';
}

export const useApp = create<AppState>((set) => ({
  scenarioId: 'teach',
  runState: 'ready',
  view: 'cafe',
  replayActive: false,
  askEnabled: true,
  brain: initialBrain(),
  model: createModel(),
  modelLoaded: false,
  query: null,
  previewFocus: null,
  previewCompare: false,
  buildingView: false,
  evidence: null,
  dialogue: [],
  hud: { t: 0, phase: 'waiting', label: 'Waiting for an order', speed: 0, tableId: null, latencyMs: 0, replans: 0, noSafe: false, chosenDiffersFromInitial: false, initialChoiceLabel: null },
  plan: null,
  liveMetrics: null,
  evaluation: { status: 'idle' },
  set: (p) => set(p),
  say: (speaker, text, t) =>
    set((s) => ({ dialogue: [...s.dialogue.slice(-5), { id: ++lineId, speaker, text, t }] })),
}));
