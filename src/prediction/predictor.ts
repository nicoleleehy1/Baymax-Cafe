// Short-horizon human motion prediction from observed kinematics only.
// Constant-velocity baseline plus a few plausible continuations (slow / turn),
// with an uncertainty radius that grows with prediction time.
import type { HumanPrediction, Hypothesis, ObservedHuman } from '../core/types';
import { rotate, len, type Vec2 } from '../core/vec';

export const PRED_DT = 0.1;
export const PRED_STEPS = 30; // 3.0 s horizon

const MOVING_SPEED = 0.15;

export function sigmaAt(t: number, speed: number): number {
  return 0.04 * t + 0.12 * t * Math.min(1, speed / 0.6);
}

function rollout(h: ObservedHuman, speedScale: (t: number) => number, turnRate: number): Vec2[] {
  const pts: Vec2[] = [{ ...h.pos }];
  let p = { ...h.pos };
  let vel = { ...h.vel };
  for (let k = 1; k <= PRED_STEPS; k++) {
    const t = k * PRED_DT;
    // turning hypotheses curve for the first 1.2 s then continue straight
    if (turnRate !== 0 && t <= 1.2) vel = rotate(vel, turnRate * PRED_DT);
    const s = speedScale(t);
    p = { x: p.x + vel.x * s * PRED_DT, y: p.y + vel.y * s * PRED_DT };
    pts.push(p);
  }
  return pts;
}

export function predictHuman(h: ObservedHuman): HumanPrediction {
  const speed = len(h.vel);
  const sigma: number[] = [];
  for (let k = 0; k <= PRED_STEPS; k++) sigma.push(sigmaAt(k * PRED_DT, speed));

  let hyps: Hypothesis[];
  if (speed < MOVING_SPEED) {
    hyps = [{ label: 'stationary', prob: 1, pts: rollout({ ...h, vel: { x: 0, y: 0 } }, () => 1, 0) }];
  } else {
    hyps = [
      { label: 'continue', prob: 0.55, pts: rollout(h, () => 1, 0) },
      { label: 'slow', prob: 0.2, pts: rollout(h, (t) => Math.max(0.2, 1 - 0.6 * t), 0) },
      { label: 'turnLeft', prob: 0.125, pts: rollout(h, () => 1, 0.45) },
      { label: 'turnRight', prob: 0.125, pts: rollout(h, () => 1, -0.45) },
    ];
  }
  return { id: h.id, radius: h.radius, hyps, sigma };
}

export function predictAll(humans: ObservedHuman[]): HumanPrediction[] {
  return humans.map(predictHuman);
}
