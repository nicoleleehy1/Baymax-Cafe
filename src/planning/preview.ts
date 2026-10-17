// Faithful playback of a candidate trajectory for teaching previews: positions and
// velocities come straight from the planner's timestamped rollout (dt = PLAN.dt).
// Beyond the horizon the ghost holds its final state; the remaining route is only an
// intention and is drawn, not animated.
import type { CandidateSummary } from '../core/types';
import { lerp, wrapAngle, type Vec2 } from '../core/vec';
import { PLAN, ROBOT } from './planner';

export interface PreviewSample {
  pos: Vec2;
  vel: Vec2;
  heading: number;
  /** true while t is inside the rolled-out horizon */
  inHorizon: boolean;
}

export const PREVIEW_HOLD = 1.0; // seconds to hold the end state before looping

export function previewDuration(c: CandidateSummary): number {
  return (c.pts.length - 1) * PLAN.dt;
}

/**
 * Sample the candidate at time t (seconds since the paused observation).
 * Heading follows velocity while moving forward; when the candidate steps backward
 * (velocity opposes the start heading) or is nearly stopped, the heading is held.
 */
export function sampleCandidate(c: CandidateSummary, t: number, startHeading: number): PreviewSample {
  const T = previewDuration(c);
  const tt = Math.max(0, Math.min(T, t));
  const k = tt / PLAN.dt;
  const i = Math.min(c.pts.length - 2, Math.floor(k));
  const f = Math.min(1, k - i);
  const pos = lerp(c.pts[i], c.pts[i + 1], f);
  const vel = lerp(c.vels[i], c.vels[i + 1], f);
  // heading: integrate the same rule the sim uses (face motion unless stepping back)
  let heading = startHeading;
  const fwd0 = { x: Math.cos(startHeading), y: Math.sin(startHeading) };
  for (let j = 1; j <= Math.ceil(k) && j < c.vels.length; j++) {
    const vj = c.vels[j];
    const sp = Math.hypot(vj.x, vj.y);
    const backward = c.meta.maneuver === 'backOff' || vj.x * fwd0.x + vj.y * fwd0.y < -0.05;
    if (sp > 0.08 && !backward) {
      // same turn-rate limit the simulation applies to Baymax's heading
      const d = wrapAngle(Math.atan2(vj.y, vj.x) - heading);
      const m = ROBOT.turnRate * 1.4 * PLAN.dt;
      heading = wrapAngle(heading + Math.max(-m, Math.min(m, d)));
    }
  }
  return { pos, vel, heading, inHorizon: t <= T };
}
