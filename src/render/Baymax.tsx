// Baymax-inspired soft robot, storybook pass.
// Geometry: spline-smoothed pear torso (profile itself is a Catmull-Rom curve, not just
// finer radial tessellation), soft shoulders, two-bone tapered arms solved by IK so the
// hands visibly support the tray, short legs and small feet.
// Motion is driven only by simulation state (position, heading, velocity, lookAt):
//   - root transform = authoritative sim pose (never offset by animation)
//   - steps: phase advances by distance travelled / stride, so planted feet barely slide
//   - stop/turn: lean from real acceleration, shuffle steps when turning in place
//   - attention: head yaw toward the sim's lookAt; occasional blinks (seeded, not synced)
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { wrapAngle, type Vec2 } from '../core/vec';
import { CARRY_ENVELOPE } from '../world/robotBody';
import { headingToRotY } from './geom';
import { PALETTE, limb, softMat, splineLathe } from './style/shapes';

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
  /** preview/replay stand-in: opaque, tinted (no x-ray transparency) */
  ghost?: boolean;
  tint?: string;
  opacity?: number;
  seed?: number;
}

// Torso profile (radius, height). The tray rides at y≈1.12 where the torso is slim, so its
// near edge clears the belly and its far edge stays inside the 0.52 m planning footprint.
const TORSO: [number, number][] = [
  [0.0, 0.25],
  [0.2, 0.27],
  [0.34, 0.35],
  [0.42, 0.49],
  [0.445, 0.67],
  [0.432, 0.85],
  [0.392, 1.0],
  [0.33, 1.12],
  [0.262, 1.235],
  [0.18, 1.335],
  [0.1, 1.405],
  [0.0, 1.44],
];
const Z_SQUASH = 0.9;

export const TRAY = CARRY_ENVELOPE;
const SHOULDER = new THREE.Vector3(0.275, 1.17, 0.01);
const UPPER = 0.27;
const FORE = 0.26;
const HIP_X = 0.15;

export function BaymaxModel({ source, ghost = false, tint, seed = 0 }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const tray = useRef<THREE.Group>(null);
  const cup = useRef<THREE.Group>(null);
  const feet = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const upper = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const fore = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const elbow = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const hand = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];

  const st = useRef({
    phase: 0,
    lean: 0,
    roll: 0,
    yaw: 0,
    prevVel: { x: 0, y: 0 },
    prevPos: null as Vec2 | null,
    prevHeading: 0,
    t: seed * 3.1,
    nextBlink: 2 + (seed % 3),
    blink: 0,
    carryW: 1,
    handL: new THREE.Vector3(),
    handR: new THREE.Vector3(),
  });

  const geo = useMemo(() => {
    const torso = splineLathe(TORSO, 90, 72);
    const headG = new THREE.SphereGeometry(0.17, 48, 32);
    const upperG = limb(UPPER, [[0, 0.105], [0.45, 0.112], [1, 0.096]], 28);
    const foreG = limb(FORE, [[0, 0.095], [0.6, 0.085], [1, 0.07]], 28);
    const legG = limb(0.2, [[0, 0.12], [0.5, 0.14], [1, 0.135]], 28);
    const footG = new THREE.SphereGeometry(1, 24, 16);
    const handG = new THREE.SphereGeometry(1, 20, 14);
    const jointG = new THREE.SphereGeometry(1, 20, 14);
    upperG.userData.len = UPPER;
    foreG.userData.len = FORE;
    return { torso, headG, upperG, foreG, legG, footG, handG, jointG };
  }, []);

  const mats = useMemo(() => {
    const base = ghost ? new THREE.Color(PALETTE.baymax).lerp(new THREE.Color(tint ?? '#ff8a65'), 0.55).getStyle() : PALETTE.baymax;
    return {
      skin: softMat(base, { roughness: 0.62, sheen: 0.5 }),
      ink: new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.5 }),
      port: new THREE.MeshStandardMaterial({ color: '#c9c6bf', roughness: 0.5 }),
      tray: softMat(PALETTE.woodDark, { roughness: 0.7 }),
      trayRim: softMat(PALETTE.wood, { roughness: 0.7 }),
      ceramic: softMat('#fffaf1', { roughness: 0.35 }),
      latte: new THREE.MeshStandardMaterial({ color: '#c79465', roughness: 0.6 }),
    };
  }, [ghost, tint]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = source();
    const g = root.current;
    if (!g) return;
    g.visible = p.visible;
    if (!p.visible) return;
    const s = st.current;
    s.t += dt;

    // authoritative pose
    g.position.set(p.pos.x, 0, p.pos.y);
    g.rotation.y = headingToRotY(p.heading);

    const speed = Math.hypot(p.vel.x, p.vel.y);
    const fwd = { x: Math.cos(p.heading), y: Math.sin(p.heading) };
    const aF = dt > 0 ? ((p.vel.x - s.prevVel.x) * fwd.x + (p.vel.y - s.prevVel.y) * fwd.y) / dt : 0;
    s.prevVel = { ...p.vel };
    const moved = s.prevPos ? Math.hypot(p.pos.x - s.prevPos.x, p.pos.y - s.prevPos.y) : 0;
    const along = speed > 0.02 ? (p.vel.x * fwd.x + p.vel.y * fwd.y) / speed : 1;
    s.prevPos = { ...p.pos };
    const dHead = Math.abs(wrapAngle(p.heading - s.prevHeading));
    s.prevHeading = p.heading;

    // stepping: zero-slip phase advance (planted foot sweeps exactly one stride per half cycle)
    const stride = 0.16 + 0.22 * Math.min(1, speed / 0.9);
    const shuffle = speed < 0.08 ? dHead * 0.35 : 0; // small steps while turning in place
    s.phase += ((moved + shuffle) * Math.PI) / stride * (along < -0.3 ? -1 : 1);
    const gait = Math.min(1, (speed + shuffle / Math.max(dt, 1e-3) * 0.4) / 0.35);

    // anticipation & settling: lean from real forward acceleration, damped
    s.lean += (THREE.MathUtils.clamp(aF * 0.05, -0.06, 0.06) - s.lean) * Math.min(1, dt * 5);
    // weight shift onto the planted foot
    const rollTarget = Math.sin(s.phase) * 0.04 * gait;
    s.roll += (rollTarget - s.roll) * Math.min(1, dt * 10);
    const breathe = 1 + Math.sin(s.t * 1.5 + seed) * 0.008;

    if (body.current) {
      body.current.rotation.set(-s.lean, 0, s.roll);
      body.current.position.y = Math.abs(Math.cos(s.phase)) * 0.01 * gait;
      body.current.scale.set(1, breathe, 1);
    }

    // feet: planted half moves backward under the body, swing half lifts and moves forward
    for (let i = 0; i < 2; i++) {
      const f = feet[i].current;
      if (!f) continue;
      const ph = s.phase + (i === 0 ? 0 : Math.PI);
      const planted = Math.sin(ph) >= 0;
      const z = (stride / 2) * Math.cos(ph) * Math.min(1, gait * 1.2);
      const lift = planted ? 0 : -Math.sin(ph) * 0.045 * gait;
      f.position.set((i === 0 ? -1 : 1) * HIP_X, lift, 0.03 + z);
    }

    // head attention + blinks
    let yaw = Math.sin(s.t * 0.23 + seed) * 0.08; // idle glance
    if (p.lookAt) {
      const ang = Math.atan2(p.lookAt.y - p.pos.y, p.lookAt.x - p.pos.x);
      yaw = THREE.MathUtils.clamp(-wrapAngle(ang - p.heading), -0.8, 0.8);
    }
    s.yaw += (yaw - s.yaw) * Math.min(1, dt * 2.5);
    if (head.current) {
      head.current.rotation.set(-s.lean * 0.6 + Math.sin(s.t * 0.7 + seed) * 0.012, s.yaw, -s.roll * 0.5);
    }
    if (s.t > s.nextBlink) {
      s.blink = 0.14;
      s.nextBlink = s.t + 2.8 + ((Math.sin(s.t * 12.9898 + seed) + 1) / 2) * 3.5;
    }
    s.blink = Math.max(0, s.blink - dt);
    if (eyes.current) eyes.current.scale.y = s.blink > 0 ? 0.15 : 1;

    // arms: two-bone IK to hand targets (carry: under the tray; otherwise relaxed swing)
    s.carryW += ((p.carrying ? 1 : 0) - s.carryW) * Math.min(1, dt * 4);
    const swing = Math.sin(s.phase) * 0.08 * gait;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const sh = new THREE.Vector3(side * SHOULDER.x, SHOULDER.y, SHOULDER.z);
      const carryT = new THREE.Vector3(side * 0.105, TRAY.y - 0.045, TRAY.z - 0.01);
      const relaxT = new THREE.Vector3(side * 0.37, 0.72, 0.06 + side * swing);
      const target = relaxT.lerp(carryT, s.carryW);
      const pole = new THREE.Vector3(side * 1, -0.8, -0.4);
      const { elbowP } = solveTwoBone(sh, target, UPPER, FORE, pole);
      placeLimb(upper[i].current, sh, elbowP);
      placeLimb(fore[i].current, elbowP, target);
      elbow[i].current?.position.copy(elbowP);
      hand[i].current?.position.copy(target);
    }

    // tray: steady and level (counter the body roll), hands underneath
    if (tray.current) {
      tray.current.position.set(0, TRAY.y + body.current!.position.y, TRAY.z);
      tray.current.rotation.set(s.lean * 0.8, 0, -s.roll * 0.9);
      tray.current.visible = s.carryW > 0.02 || p.carrying;
    }
    if (cup.current) cup.current.visible = p.carrying;
  });

  return (
    <group ref={root}>
      {/* feet stay on the floor */}
      {[0, 1].map((i) => (
        <group key={i} ref={feet[i]}>
          <mesh geometry={geo.footG} material={mats.skin} scale={[0.1, 0.052, 0.14]} position={[0, 0.052, 0]} castShadow receiveShadow />
        </group>
      ))}
      <group ref={body}>
        {/* legs */}
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={geo.legG} material={mats.skin} position={[side * HIP_X, 0.08, 0.01]} castShadow />
        ))}
        <mesh geometry={geo.torso} material={mats.skin} scale={[1, 1, Z_SQUASH]} castShadow receiveShadow />
        {!ghost && (
          <mesh position={[0.17, 1.02, 0.33]} rotation={[-0.25, 0.42, 0]} material={mats.port}>
            <cylinderGeometry args={[0.042, 0.042, 0.01, 28]} />
          </mesh>
        )}
        {/* neck blend + head */}
        <group ref={head} position={[0, 1.415, 0.0]}>
          <mesh geometry={geo.headG} material={mats.skin} position={[0, 0.07, 0]} scale={[1.32, 0.86, 1.06]} castShadow />
          <group ref={eyes} position={[0, 0.075, 0.172]}>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.074, 0, 0]} scale={[1, 1, 0.3]} material={mats.ink}>
                <sphereGeometry args={[0.025, 20, 14]} />
              </mesh>
            ))}
            <mesh rotation={[0, 0, Math.PI / 2]} material={mats.ink}>
              <cylinderGeometry args={[0.0045, 0.0045, 0.148, 8]} />
            </mesh>
          </group>
        </group>
        {/* soft shoulders */}
        {[-1, 1].map((side) => (
          <mesh key={side} geometry={geo.jointG} material={mats.skin} position={[side * SHOULDER.x, SHOULDER.y, SHOULDER.z]} scale={0.1} castShadow />
        ))}
      </group>
      {/* arms are posed in the root frame each frame (IK), so they never sink into the torso */}
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh ref={upper[i]} geometry={geo.upperG} material={mats.skin} castShadow />
          <mesh ref={elbow[i]} geometry={geo.jointG} material={mats.skin} scale={0.098} castShadow />
          <mesh ref={fore[i]} geometry={geo.foreG} material={mats.skin} castShadow />
          <group ref={hand[i]}>
            <mesh geometry={geo.handG} material={mats.skin} scale={[0.072, 0.06, 0.085]} castShadow />
          </group>
        </group>
      ))}
      {/* tray held in front of the chest, fully outside the torso */}
      <group ref={tray} position={[0, TRAY.y, TRAY.z]}>
        {TRAY.kind === 'tray' && (
          <>
            <mesh material={mats.tray} castShadow receiveShadow>
              <cylinderGeometry args={[TRAY.r, TRAY.r * 0.94, 0.018, 40]} />
            </mesh>
            <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trayRim}>
              <torusGeometry args={[TRAY.r - 0.006, 0.007, 8, 40]} />
            </mesh>
          </>
        )}
        <group ref={cup} position={[0, 0.01, 0]}>
          <mesh position={[0, 0.004, 0]} material={mats.ceramic} castShadow>
            <cylinderGeometry args={[0.06, 0.055, 0.008, 28]} />
          </mesh>
          <mesh position={[0, 0.042, 0]} material={mats.ceramic} castShadow>
            <cylinderGeometry args={[0.04, 0.031, 0.068, 28]} />
          </mesh>
          <mesh position={[0, 0.0765, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.latte}>
            <circleGeometry args={[0.036, 24]} />
          </mesh>
          <mesh position={[0.046, 0.045, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.ceramic}>
            <torusGeometry args={[0.015, 0.0055, 8, 16]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
function placeLimb(m: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3): void {
  if (!m) return;
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  const nominal = (m.geometry as THREE.BufferGeometry).userData.len as number;
  m.scale.set(1, L / nominal, 1);
}

/** Analytic two-bone IK: elbow position for shoulder S reaching target T with a pole hint. */
export function solveTwoBone(S: THREE.Vector3, T: THREE.Vector3, a: number, b: number, pole: THREE.Vector3): { elbowP: THREE.Vector3 } {
  const ST = new THREE.Vector3().subVectors(T, S);
  let d = ST.length();
  d = THREE.MathUtils.clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = ST.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const elbowP = S.clone().add(dir.multiplyScalar(a * cosA)).add(perp.multiplyScalar(a * sinA));
  return { elbowP };
}
