// Teaching preview. Both candidate paths stay visible: the planner's rolled-out horizon as a
// solid ribbon (what the ghost actually does, with its real timing), the rest of the route as a
// dashed intention. One ghost previews at a time (hover/select pins it; otherwise it alternates
// A, B), or both in comparison mode. Ghost poses come from the timestamped candidate states.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CandidateSummary, PlanResult } from '../core/types';
import type { Vec2 } from '../core/vec';
import { previewDuration, PREVIEW_HOLD, sampleCandidate } from '../planning/preview';
import { useApp } from '../state/store';
import { BaymaxModel, type BaymaxPose } from './Baymax';
import { buildRibbons, circlePts, dashed, samplePolyline, type Ribbon } from './geom';
import { useScreenLabel } from './labels';

export const OPTION_COLORS = { A: '#ff7a59', B: '#2ec4b6' };

export function TeachingPreview({ plan }: { plan: PlanResult }) {
  const q = plan.query!;
  const cands = useMemo(() => ({ A: plan.candidates[q.a], B: plan.candidates[q.b] }), [plan, q.a, q.b]);
  const startHeading = plan.robotHeading;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rs: Ribbon[] = [];
    for (const k of ['A', 'B'] as const) {
      const c = cands[k];
      const color = new THREE.Color(OPTION_COLORS[k]);
      const y = k === 'A' ? 0.05 : 0.052;
      rs.push({ pts: c.pts, width: 0.1, color, y });
      // the remaining route is an intention, not a prediction: dashed and thinner
      const tail = c.tail.length ? [c.pts[c.pts.length - 1], ...c.tail] : [];
      for (const d of dashed(tail, 0.22, 0.16)) rs.push({ pts: d, width: 0.05, color, y });
      // end-of-horizon marker
      rs.push({ pts: circlePts(c.pts[c.pts.length - 1], 0.16, 24), width: 0.03, color, y: y + 0.001 });
    }
    rs.push({ pts: circlePts(plan.candidates[q.a].pts[0], 0.5, 40), width: 0.025, color: new THREE.Color('#fff7e8'), y: 0.055 });
    buildRibbons(g, rs);
    return g;
  }, [cands, plan, q.a]);

  const clock = useRef(0);
  useFrame((_, dt) => {
    clock.current += dt;
  });
  const loopOf = (c: CandidateSummary): number => previewDuration(c) + PREVIEW_HOLD;

  /** Which ghost(s) are showing right now. */
  const active = (): Array<'A' | 'B'> => {
    const s = useApp.getState();
    if (s.previewCompare) return ['A', 'B'];
    if (s.previewFocus) return [s.previewFocus];
    const L = loopOf(cands.A) + loopOf(cands.B);
    return clock.current % L < loopOf(cands.A) ? ['A'] : ['B'];
  };
  const localT = (k: 'A' | 'B'): number => {
    const s = useApp.getState();
    if (s.previewCompare || s.previewFocus) return clock.current % Math.max(loopOf(cands.A), loopOf(cands.B));
    const L = loopOf(cands.A) + loopOf(cands.B);
    const t = clock.current % L;
    return k === 'A' ? t : t - loopOf(cands.A);
  };
  const poseFor = (k: 'A' | 'B') => (): BaymaxPose => {
    const smp = sampleCandidate(cands[k], localT(k), startHeading);
    return { pos: smp.pos, heading: smp.heading, vel: smp.vel, carrying: true, lookAt: null, visible: active().includes(k) };
  };

  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial vertexColors transparent opacity={0.92} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <BaymaxModel source={poseFor('A')} ghost tint={OPTION_COLORS.A} />
      <BaymaxModel source={poseFor('B')} ghost tint={OPTION_COLORS.B} />
      <OptionPin k="A" path={cands.A.pts} />
      <OptionPin k="B" path={cands.B.pts} />
    </group>
  );
}

function OptionPin({ k, path }: { k: 'A' | 'B'; path: Vec2[] }) {
  const pos = useMemo(() => {
    const { p } = samplePolyline(path, 0.75);
    return new THREE.Vector3(p.x, 0.35, p.y);
  }, [path]);
  useScreenLabel('option-pin', k, () => pos, { background: OPTION_COLORS[k] });
  return null;
}
