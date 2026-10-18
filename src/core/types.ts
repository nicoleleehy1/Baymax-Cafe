// Shared data contracts between simulation, prediction, planning, learning and rendering.
import type { Vec2 } from './vec';

// ---------------- Observation (the ONLY thing the planner sees) ----------------

/** A person as Baymax observes them: kinematics + geometry. No private goals. */
export interface ObservedHuman {
  id: string;
  pos: Vec2;
  vel: Vec2;
  facing: number;
  radius: number;
}

/**
 * Explicit social annotation supplied by the scene (authored, not perceived).
 * The planner derives the zone geometry from the observed member positions.
 */
export interface SocialGroup {
  id: string;
  kind: 'conversation';
  memberIds: string[];
}

export interface RobotKinematics {
  pos: Vec2;
  vel: Vec2;
  heading: number;
}

export interface Observation {
  t: number;
  robot: RobotKinematics;
  goal: Vec2 | null;
  humans: ObservedHuman[];
  groups: SocialGroup[];
}

// ---------------- Prediction ----------------

export interface Hypothesis {
  label: 'continue' | 'slow' | 'turnLeft' | 'turnRight' | 'stationary';
  prob: number;
  /** positions at t = k * dt, k = 0..steps */
  pts: Vec2[];
}

export interface HumanPrediction {
  id: string;
  radius: number;
  hyps: Hypothesis[];
  /** positional uncertainty radius (1-sigma-ish, meters) at t = k * dt */
  sigma: number[];
}

// ---------------- Planning ----------------

export type ManeuverKind = 'go' | 'yield' | 'stepAside' | 'backOff';

export interface CandidateMeta {
  routeId: string;
  routeKind: 'direct' | 'detour';
  groupId?: string;
  side?: 'left' | 'right';
  maneuver: ManeuverKind;
  speedFrac: number;
  offset: number;
}

export interface CandidateSummary {
  index: number;
  meta: CandidateMeta;
  label: string;
  /** Rolled-out horizon states, dt = PLAN_DT, starting at the observation time. */
  pts: Vec2[];
  vels: Vec2[];
  /** Rest of the route after the horizon (for previews / tail costs). */
  tail: Vec2[];
  safe: boolean;
  rejectReason?: 'static' | 'human';
  minClearance: number;
  features: number[];
  /** learned utility  U = -w · features */
  utility: number;
  /** utility under the initial (untaught) weights, for counterfactual display */
  utility0: number;
  /** authored hysteresis penalty (not learned) */
  hysteresis: number;
  total: number;
}

export interface QueryPair {
  a: number;
  b: number;
  scoreGap: number;
  featureDistance: number;
  prompt: string;
}

export interface ConversationZone {
  groupId: string;
  /** capsules between member pairs */
  segments: { a: Vec2; b: Vec2 }[];
  radius: number;
  centroid: Vec2;
}

export interface PlanResult {
  reqId: number;
  epoch: number;
  /** preference-model revision the plan was scored with */
  modelRevision: number;
  tObs: number;
  /** Baymax's heading at the observation (previews start from it) */
  robotHeading: number;
  chosen: number;
  noSafe: boolean;
  candidates: CandidateSummary[];
  predictions: HumanPrediction[];
  zones: ConversationZone[];
  query: QueryPair | null;
  latencyMs: number;
  /** Fresh choice (no switching penalty) under the initial weights, same candidate set. */
  chosenUnderInitial: number;
}

// ---------------- Learning ----------------

export interface PreferenceExample {
  id: string;
  createdAt: number;
  scenarioId: string;
  tObs: number;
  featuresA: number[];
  featuresB: number[];
  labelA: string;
  labelB: string;
  /** 'A' or 'B' */
  preferred: 'A' | 'B';
  /** neural reward model inputs for the two options (absent on answers saved before it existed) */
  descA?: number[];
  descB?: number[];
}

export interface PreferenceModelState {
  featureVersion: number;
  featureNames: string[];
  initialWeights: number[];
  weights: number[];
  examples: PreferenceExample[];
  updatedAt: number;
}

export interface UpdateReport {
  weightsBefore: number[];
  weightsAfter: number[];
  featureDiff: number[]; // features(preferred) - features(other)
  probBefore: number; // P(preferred > other) before update
  probAfter: number;
  rankBefore: { preferred: number; other: number }; // utilities
  rankAfter: { preferred: number; other: number };
  /** set when the neural reward model was fine-tuned on this answer */
  neural?: { probBefore: number; probAfter: number; ms: number };
}
