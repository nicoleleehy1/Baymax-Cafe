// Evaluation metrics, computed purely from recorded simulation frames.
import type { ConversationZone } from '../core/types';
import { dist, len, type Vec2 } from '../core/vec';
import { HUMAN_RADIUS, ROBOT_RADIUS } from '../world/layout';
import { inZone } from '../planning/routes';

export interface FrameHuman {
  id: string;
  pos: Vec2;
  facing: number;
  state: string;
  visible: boolean;
  gait: number;
}

export interface Frame {
  t: number;
  robot: { pos: Vec2; vel: Vec2; heading: number; phase: string; maneuver: string; carrying: boolean };
  humans: FrameHuman[];
  zones: ConversationZone[];
}

export const METRIC_DEFS = {
  completed: 'Order placed at the table before the scenario time limit.',
  deliveryTime: 'Seconds from the order being assigned to Baymax arriving at the table.',
  conversationIntrusions: 'Number of times Baymax’s center entered an annotated conversation area (capsules between group members, 0.6 m radius).',
  intrusionTime: 'Seconds Baymax’s center spent inside conversation areas.',
  minClearance: 'Smallest gap (m) between Baymax’s footprint (0.5 m) and any person’s footprint (0.25 m).',
  timeTooClose: 'Seconds with a gap under 0.35 m to anyone.',
  hardBrakes: 'Number of episodes where Baymax’s acceleration magnitude exceeded 1.0 m/s².',
  collisions: 'Number of contact episodes (gap < 0) with any person.',
  planLatencyMs: 'Mean / p95 planner wall-clock time per update on this machine.',
};

export const TOO_CLOSE = 0.35;
export const HARD_ACCEL = 1.0;

export interface Metrics {
  completed: boolean;
  deliveryTime: number | null;
  conversationIntrusions: number;
  intrusionTime: number;
  minClearance: number;
  timeTooClose: number;
  hardBrakes: number;
  collisions: number;
  pathLength: number;
  planLatencyMeanMs: number;
  planLatencyP95Ms: number;
  replans: number;
}

export function computeMetrics(frames: Frame[], assignedAt: number | null, arrivedAt: number | null, latencies: number[]): Metrics {
  let intrusions = 0;
  let intrusionTime = 0;
  let minClear = Infinity;
  let tooClose = 0;
  let brakes = 0;
  let collisions = 0;
  let pathLength = 0;
  let wasIn = false;
  let wasBrake = false;
  const contact = new Map<string, boolean>();
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const dt = i > 0 ? f.t - frames[i - 1].t : 0;
    if (i > 0) pathLength += dist(f.robot.pos, frames[i - 1].robot.pos);
    const inside = f.zones.some((z) => inZone(f.robot.pos, z));
    if (inside && !wasIn) intrusions++;
    if (inside) intrusionTime += dt;
    wasIn = inside;
    let frameMin = Infinity;
    for (const h of f.humans) {
      if (!h.visible) continue;
      const c = dist(f.robot.pos, h.pos) - ROBOT_RADIUS - HUMAN_RADIUS;
      frameMin = Math.min(frameMin, c);
      const was = contact.get(h.id) ?? false;
      if (c < 0 && !was) collisions++;
      contact.set(h.id, c < 0);
    }
    minClear = Math.min(minClear, frameMin);
    if (frameMin < TOO_CLOSE) tooClose += dt;
    if (i > 0 && dt > 0) {
      const a = len({ x: f.robot.vel.x - frames[i - 1].robot.vel.x, y: f.robot.vel.y - frames[i - 1].robot.vel.y }) / dt;
      const brake = a > HARD_ACCEL;
      if (brake && !wasBrake) brakes++;
      wasBrake = brake;
    }
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    completed: arrivedAt !== null,
    deliveryTime: arrivedAt !== null && assignedAt !== null ? arrivedAt - assignedAt : null,
    conversationIntrusions: intrusions,
    intrusionTime,
    minClearance: minClear,
    timeTooClose: tooClose,
    hardBrakes: brakes,
    collisions,
    pathLength,
    planLatencyMeanMs: sorted.length ? sorted.reduce((s, x) => s + x, 0) / sorted.length : 0,
    planLatencyP95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
    replans: latencies.length,
  };
}
