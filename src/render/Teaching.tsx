// Teaching preview: while the shared scene is paused, two ghost Baymaxes rehearse options A and B
// from the same initial state (the planner's rolled-out horizon + the rest of each route).
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlanResult } from '../core/types';
import type { Vec2 } from '../core/vec';
import { BaymaxModel, type BaymaxPose } from './Baymax';
import { buildRibbons, samplePolyline } from './geom';
import { useScreenLabel } from './labels';

export const OPTION_COLORS = { A: '#ff7a59', B: '#2ec4b6' };

function fullPath(plan: PlanResult, idx: number): Vec2[] {
  const c = plan.candidates[idx];
  return [...c.pts, ...c.tail];
}

export function TeachingPreview({ plan }: { plan: PlanResult }) {
  const q = plan.query!;
  const paths = useMemo(() => ({ A: fullPath(plan, q.a), B: fullPath(plan, q.b) }), [plan, q.a, q.b]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    buildRibbons(g, [
      { pts: paths.A, width: 0.09, color: new THREE.Color(OPTION_COLORS.A), y: 0.05 },
      { pts: paths.B, width: 0.09, color: new THREE.Color(OPTION_COLORS.B), y: 0.052 },
    ]);
    return g;
  }, [paths]);
  const clock = useRef(0);
  useFrame((_, dt) => {
    clock.current += dt;
  });
  const poseFor = (key: 'A' | 'B') => (): BaymaxPose => {
    const loop = 5.5;
    const f = Math.min(1, (clock.current % (loop + 0.8)) / loop);
    const ease = f * f * (3 - 2 * f);
    const { p, dir } = samplePolyline(paths[key], ease);
    return { pos: p, heading: Math.atan2(dir.y, dir.x), vel: { x: dir.x * 0.6, y: dir.y * 0.6 }, carrying: true, lookAt: null, visible: true };
  };
  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <BaymaxModel source={poseFor('A')} ghost tint={OPTION_COLORS.A} opacity={0.42} />
      <BaymaxModel source={poseFor('B')} ghost tint={OPTION_COLORS.B} opacity={0.42} />
      <OptionPin k="A" path={paths.A} />
      <OptionPin k="B" path={paths.B} />
    </group>
  );
}

function OptionPin({ k, path }: { k: 'A' | 'B'; path: Vec2[] }) {
  const pos = useMemo(() => {
    const { p } = samplePolyline(path, 0.55);
    return new THREE.Vector3(p.x, 0.4, p.y);
  }, [path]);
  useScreenLabel('option-pin', k, () => pos, { background: OPTION_COLORS[k] });
  return null;
}
