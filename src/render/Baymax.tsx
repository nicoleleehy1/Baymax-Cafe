// Procedural, Baymax-inspired soft robot. All motion is driven by simulation state:
// position/heading/velocity from the sim, head attention from the sim's lookAt,
// lean from actual acceleration, waddle from actual speed.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { wrapAngle, type Vec2 } from '../core/vec';
import { headingToRotY } from './geom';

export interface BaymaxPose {
  pos: Vec2;
  heading: number;
  vel: Vec2;
  carrying: boolean;
  lookAt: Vec2 | null;
  visible: boolean;
}

interface Props {
  source: () => BaymaxPose;
  ghost?: boolean;
  tint?: string;
  opacity?: number;
}

const BODY_PROFILE: [number, number][] = [
  [0.0, 0.2],
  [0.2, 0.22],
  [0.33, 0.3],
  [0.41, 0.48],
  [0.44, 0.72],
  [0.43, 0.95],
  [0.39, 1.16],
  [0.32, 1.33],
  [0.22, 1.46],
  [0.1, 1.53],
  [0.0, 1.55],
];

export function BaymaxModel({ source, ghost = false, tint, opacity = 0.35 }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const tray = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const state = useRef({ phase: 0, lean: 0, headYaw: 0, prevVel: { x: 0, y: 0 }, prevPos: null as Vec2 | null, t: 0 });

  const bodyGeom = useMemo(() => new THREE.LatheGeometry(BODY_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48), []);
  const mat = useMemo(() => {
    if (ghost)
      return new THREE.MeshStandardMaterial({ color: tint ?? '#ff8a65', transparent: true, opacity, roughness: 0.6, depthWrite: false });
    return new THREE.MeshPhysicalMaterial({ color: '#f6f5f1', roughness: 0.48, sheen: 0.7, sheenColor: new THREE.Color('#ffffff'), clearcoat: 0.2, clearcoatRoughness: 0.6 });
  }, [ghost, tint, opacity]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.4 }), []);
  const port = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.35, metalness: 0.2 }), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a5a3b', roughness: 0.6 }), []);
  const ceramic = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.3 }), []);
  const latte = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c89a6b', roughness: 0.5 }), []);

  useFrame((_, dt) => {
    const p = source();
    const g = root.current;
    if (!g) return;
    g.visible = p.visible;
    if (!p.visible) return;
    const s = state.current;
    s.t += dt;
    g.position.set(p.pos.x, 0, p.pos.y);
    g.rotation.y = headingToRotY(p.heading);

    const speed = Math.hypot(p.vel.x, p.vel.y);
    // forward acceleration (from actual velocity change) drives a gentle lean
    const fwd = { x: Math.cos(p.heading), y: Math.sin(p.heading) };
    const dv = { x: p.vel.x - s.prevVel.x, y: p.vel.y - s.prevVel.y };
    const aF = dt > 0 ? (dv.x * fwd.x + dv.y * fwd.y) / Math.max(dt, 1 / 120) : 0;
    s.prevVel = { ...p.vel };
    s.lean += (THREE.MathUtils.clamp(aF * 0.06, -0.08, 0.08) - s.lean) * Math.min(1, dt * 6);
    // backward stepping keeps facing forward; detect it to reverse the gait
    const along = speed > 0.02 ? (p.vel.x * fwd.x + p.vel.y * fwd.y) / speed : 1;
    const moved = s.prevPos ? Math.hypot(p.pos.x - s.prevPos.x, p.pos.y - s.prevPos.y) : 0;
    s.prevPos = { ...p.pos };
    s.phase += moved * 7.5 * (along < -0.3 ? -1 : 1);
    const gaitAmp = Math.min(1, speed / 0.6);
    const breathe = 1 + Math.sin(s.t * 1.7) * 0.012;

    if (body.current) {
      body.current.rotation.z = Math.sin(s.phase) * 0.045 * gaitAmp;
      body.current.rotation.x = -s.lean;
      body.current.position.y = Math.abs(Math.sin(s.phase)) * 0.018 * gaitAmp;
      body.current.scale.set(1, breathe, 1);
    }
    if (legL.current && legR.current) {
      legL.current.rotation.x = Math.sin(s.phase) * 0.35 * gaitAmp;
      legR.current.rotation.x = -Math.sin(s.phase) * 0.35 * gaitAmp;
    }
    // Head attention: turn toward the person the sim says Baymax is attending to.
    let yaw = 0;
    if (p.lookAt) {
      const ang = Math.atan2(p.lookAt.y - p.pos.y, p.lookAt.x - p.pos.x);
      yaw = THREE.MathUtils.clamp(-wrapAngle(ang - p.heading), -0.85, 0.85);
    }
    s.headYaw += (yaw - s.headYaw) * Math.min(1, dt * 3);
    if (head.current) {
      head.current.rotation.y = s.headYaw;
      head.current.rotation.x = -s.lean * 0.5 + Math.sin(s.t * 0.9) * 0.015;
    }
    // Tray stays level and steady; the arms hold it.
    if (tray.current) {
      tray.current.rotation.z = -Math.sin(s.phase) * 0.02 * gaitAmp;
      tray.current.position.y = 1.0 + Math.abs(Math.sin(s.phase)) * 0.008 * gaitAmp;
    }
    if (cup.current) cup.current.visible = p.carrying;
    const armSwing = p.carrying ? 0 : Math.sin(s.phase) * 0.25 * gaitAmp;
    if (armL.current) armL.current.rotation.x = p.carrying ? -1.05 : -0.1 + armSwing;
    if (armR.current) armR.current.rotation.x = p.carrying ? -1.05 : -0.1 - armSwing;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh geometry={bodyGeom} material={mat} castShadow receiveShadow />
        {!ghost && (
          <mesh position={[0.17, 1.12, 0.36]} rotation={[-0.35, 0.4, 0]} material={port}>
            <cylinderGeometry args={[0.055, 0.055, 0.012, 24]} />
          </mesh>
        )}
        {/* arms */}
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.37, 1.24, 0.02]} rotation={[0, 0, side * 0.12]}>
            <mesh position={[side * 0.05, -0.3, 0]} material={mat} castShadow>
              <capsuleGeometry args={[0.105, 0.42, 8, 16]} />
            </mesh>
            <mesh position={[side * 0.06, -0.58, 0.01]} material={mat} castShadow>
              <sphereGeometry args={[0.1, 16, 12]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* legs */}
      {([-1, 1] as const).map((side) => (
        <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.16, 0.32, 0]}>
          <mesh position={[0, -0.14, 0]} material={mat} castShadow>
            <capsuleGeometry args={[0.13, 0.12, 8, 16]} />
          </mesh>
          <mesh position={[0, -0.27, 0.05]} scale={[1, 0.55, 1.35]} material={mat} castShadow>
            <sphereGeometry args={[0.13, 16, 12]} />
          </mesh>
        </group>
      ))}
      {/* head */}
      <group ref={head} position={[0, 1.6, 0]}>
        <mesh position={[0, 0.13, 0]} scale={[1.28, 0.78, 1.0]} material={mat} castShadow>
          <sphereGeometry args={[0.2, 32, 24]} />
        </mesh>
        {!ghost && (
          <group position={[0, 0.13, 0.192]}>
            <mesh position={[-0.085, 0, 0]} scale={[1, 1, 0.35]} material={dark}>
              <sphereGeometry args={[0.03, 16, 12]} />
            </mesh>
            <mesh position={[0.085, 0, 0]} scale={[1, 1, 0.35]} material={dark}>
              <sphereGeometry args={[0.03, 16, 12]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={dark}>
              <cylinderGeometry args={[0.006, 0.006, 0.17, 8]} />
            </mesh>
          </group>
        )}
      </group>
      {/* tray (kept level, inside the 0.5 m footprint) */}
      <group ref={tray} position={[0, 1.0, 0.38]}>
        <mesh material={ghost ? mat : wood} castShadow receiveShadow>
          <cylinderGeometry args={[0.13, 0.12, 0.02, 32]} />
        </mesh>
        <group ref={cup} position={[0, 0.011, 0]}>
          <mesh position={[0, 0.004, 0]} material={ghost ? mat : ceramic} castShadow>
            <cylinderGeometry args={[0.07, 0.065, 0.008, 24]} />
          </mesh>
          <mesh position={[0, 0.045, 0]} material={ghost ? mat : ceramic} castShadow>
            <cylinderGeometry args={[0.045, 0.034, 0.075, 24]} />
          </mesh>
          {!ghost && (
            <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={latte}>
              <circleGeometry args={[0.041, 24]} />
            </mesh>
          )}
          <mesh position={[0.052, 0.048, 0]} rotation={[0, 0, Math.PI / 2]} material={ghost ? mat : ceramic}>
            <torusGeometry args={[0.018, 0.006, 8, 16]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
