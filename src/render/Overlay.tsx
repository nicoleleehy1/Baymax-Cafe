// "What Baymax is considering": candidate trajectories, chosen path, predicted human motion
// with uncertainty, conversation areas, aisle, and Baymax's clearance. Geometry is rebuilt
// imperatively only when a new plan arrives (5 Hz), never via React state.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PlanResult } from '../core/types';
import { PLAN } from '../planning/planner';
import { controller } from '../state/controller';
import { AISLES, HUMAN_RADIUS, ROBOT_RADIUS } from '../world/layout';
import { buildRibbons, circlePts, dashed, type Ribbon } from './geom';

const C = {
  chosen: new THREE.Color('#37e0c8'),
  unsafe: new THREE.Color('#c0392b'),
  low: new THREE.Color('#5b7bd5'),
  high: new THREE.Color('#ffb347'),
  pred: new THREE.Color('#ff6f91'),
  sigma: new THREE.Color('#ff9fb6'),
  zone: new THREE.Color('#ffcf5c'),
  tail: new THREE.Color('#9ff5e7'),
  clear: new THREE.Color('#ffffff'),
  aisle: new THREE.Color('#a0e7ff'),
  trail: new THREE.Color('#fff1d6'),
};

export function ConsideringOverlay({ plan: fixedPlan }: { plan?: PlanResult | null }) {
  const candGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const chosenGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const predGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const trailGeom = useMemo(() => new THREE.BufferGeometry(), []);
  const trailTimer = useRef(0);
  const zoneGroup = useRef<THREE.Group>(null);
  const clearRef = useRef<THREE.Mesh>(null);
  const comfortRef = useRef<THREE.Mesh>(null);
  const lastVersion = useRef(-1);
  const zoneMat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.zone, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), []);

  const staticRibbons = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const rs: Ribbon[] = [];
    for (const a of AISLES) {
      const pts = [a.min, { x: a.max.x, y: a.min.y }, a.max, { x: a.min.x, y: a.max.y }, a.min];
      for (const d of dashed(pts, 0.25, 0.15)) rs.push({ pts: d, width: 0.03, color: C.aisle, y: 0.02 });
    }
    buildRibbons(g, rs);
    return g;
  }, []);

  useFrame((_, dt) => {
    // executed movement: what Baymax actually did (from sim frames), refreshed at ~6 Hz
    trailTimer.current += dt;
    if (trailTimer.current > 0.16) {
      trailTimer.current = 0;
      const fr = controller.engine.frames;
      const pts = [];
      for (let i = Math.max(0, fr.length - 30 * 12); i < fr.length; i += 3) pts.push(fr[i].robot.pos);
      if (pts.length > 1) buildRibbons(trailGeom, [{ pts, width: 0.03, color: C.trail, y: 0.028 }]);
    }
    const plan = fixedPlan ?? controller.latestPlan;
    const version = fixedPlan ? -2 : controller.planVersion;
    // clearance rings follow the interpolated robot each frame
    const r = controller.curFrame.robot;
    const pr = controller.prevFrame.robot;
    const a = controller.alpha;
    const x = pr.pos.x + (r.pos.x - pr.pos.x) * a;
    const z = pr.pos.y + (r.pos.y - pr.pos.y) * a;
    clearRef.current?.position.set(x, 0.025, z);
    comfortRef.current?.position.set(x, 0.022, z);

    if (version === lastVersion.current && !fixedPlan) return;
    if (fixedPlan && lastVersion.current === -2) return;
    lastVersion.current = version;
    if (!plan) {
      buildRibbons(candGeom, []);
      buildRibbons(chosenGeom, []);
      buildRibbons(predGeom, []);
      zoneGroup.current?.clear();
      return;
    }
    const safe = plan.candidates.filter((c) => c.safe);
    const lo = Math.min(...safe.map((c) => c.total), 0);
    const hi = Math.max(...safe.map((c) => c.total), 1e-6);
    const cands: Ribbon[] = [];
    for (const c of plan.candidates) {
      if (c.index === plan.chosen) continue;
      const t = hi > lo ? (c.total - lo) / (hi - lo) : 1;
      const color = c.safe ? C.low.clone().lerp(C.high, t) : C.unsafe;
      cands.push({ pts: c.pts, width: c.safe ? 0.025 : 0.015, color, y: 0.03 + (c.safe ? 0.002 : 0) });
    }
    buildRibbons(candGeom, cands);

    const chosenR: Ribbon[] = [];
    const ch = plan.candidates[plan.chosen];
    if (ch) {
      chosenR.push({ pts: ch.pts, width: 0.08, color: C.chosen, y: 0.04 });
      for (const d of dashed(ch.tail)) chosenR.push({ pts: d, width: 0.04, color: C.tail, y: 0.035 });
    }
    buildRibbons(chosenGeom, chosenR);

    const preds: Ribbon[] = [];
    for (const p of plan.predictions) {
      const moving = p.hyps.length > 1;
      for (const h of p.hyps) {
        if (!moving) continue;
        preds.push({ pts: h.pts, width: h.label === 'continue' ? 0.035 : 0.015, color: C.pred, y: 0.045 });
      }
      for (const k of [10, 20, 30]) {
        const c = p.hyps[0].pts[k];
        if (!c) continue;
        if (!moving && k !== 30) continue;
        preds.push({ pts: circlePts(c, HUMAN_RADIUS + p.sigma[k], 32), width: 0.012, color: C.sigma, y: 0.046 });
      }
    }
    buildRibbons(predGeom, preds);

    const zg = zoneGroup.current;
    if (zg) {
      zg.clear();
      for (const zn of plan.zones) {
        for (const s of zn.segments) {
          const dx = s.b.x - s.a.x;
          const dy = s.b.y - s.a.y;
          const L = Math.hypot(dx, dy);
          const shape = new THREE.Shape();
          // capsule outline in local coords (x along segment), y = -floorY to keep orientation
          shape.absarc(0, 0, zn.radius, Math.PI / 2, (3 * Math.PI) / 2, false);
          shape.absarc(L, 0, zn.radius, -Math.PI / 2, Math.PI / 2, false);
          const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), zoneMat);
          m.rotation.x = Math.PI / 2;
          m.rotation.z = Math.atan2(dy, dx);
          m.position.set(s.a.x, 0.015, s.a.y);
          zg.add(m);
        }
      }
    }
  });

  const ribbonMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }), []);
  const strongMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }), []);

  return (
    <group renderOrder={10}>
      <mesh geometry={staticRibbons} material={ribbonMat} />
      <group ref={zoneGroup} />
      <mesh geometry={trailGeom} material={strongMat} />
      <mesh geometry={candGeom} material={ribbonMat} />
      <mesh geometry={predGeom} material={strongMat} />
      <mesh geometry={chosenGeom} material={strongMat} />
      <mesh ref={clearRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ROBOT_RADIUS - 0.02, ROBOT_RADIUS + 0.01, 48]} />
        <meshBasicMaterial color={C.clear} transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <mesh ref={comfortRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ROBOT_RADIUS + PLAN.comfortClearance - 0.01, ROBOT_RADIUS + PLAN.comfortClearance + 0.01, 64]} />
        <meshBasicMaterial color={C.clear} transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}
