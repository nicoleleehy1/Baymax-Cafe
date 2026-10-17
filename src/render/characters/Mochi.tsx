// Mochi, the ginger café cat, who trots after Baymax. Render-side only: the cat steers
// itself from Baymax's pose each frame (a follow point behind and to one side, arrival
// slow-down, a personal-space ring around the robot) and never feeds back into the sim.
// Motion: diagonal-pair trot with phase from distance travelled, settles into a sit after
// Baymax has been still for a moment, head tracks Baymax, tail sways and curls.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { wrapAngle, type Vec2 } from '../../core/vec';
import { headingToRotY } from '../geom';
import { PALETTE, limb, softMat } from '../style/shapes';

export interface LeaderPose {
  pos: Vec2;
  heading: number;
  visible: boolean;
}

const GINGER = '#e0914a';
const STRIPE = '#bf6a32';
const CREAM = '#f7e6c8';
const NOSE = '#e58a8a';

const FOLLOW_BACK = 0.78;
const FOLLOW_SIDE = 0.42;
const PERSONAL = 0.66; // Baymax footprint 0.52 m plus a little room
const MAX_SPEED = 1.2;
const ACCEL = 2.4;
const TURN = 5;
const LEG_LEN = 0.1;
const TAIL_N = 14;
const TAIL_STEP = 0.02;

export function MochiCat({ leader, seed = 0, start }: { leader: () => LeaderPose; seed?: number; start?: Vec2 }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const tail = useRef<(THREE.Mesh | null)[]>([]);
  const st = useRef({
    pos: (start ? { ...start } : null) as Vec2 | null,
    heading: 0,
    speed: 0,
    phase: seed,
    still: 0,
    sit: 0,
    t: seed * 2.3,
    nextBlink: 2,
    blink: 0,
    yaw: 0,
  });

  const geo = useMemo(() => {
    const leg = limb(LEG_LEN, [[0, 0.04], [0.6, 0.033], [1, 0.03]], 14);
    return { ball: new THREE.SphereGeometry(1, 28, 18), leg, cone: new THREE.ConeGeometry(1, 1, 3, 1) };
  }, []);
  const m = useMemo(
    () => ({
      fur: softMat(GINGER, { roughness: 0.85, sheen: 0.6 }),
      stripe: softMat(STRIPE, { roughness: 0.85, sheen: 0.5 }),
      cream: softMat(CREAM, { roughness: 0.85, sheen: 0.6 }),
      nose: softMat(NOSE),
      ear: softMat('#f0b3a0'),
      ink: new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.4 }),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    }),
    [],
  );

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const L = leader();
    const g = root.current;
    if (!g) return;
    const s = st.current;
    s.t += dt;
    const fwd = { x: Math.cos(L.heading), y: Math.sin(L.heading) };
    const left = { x: -fwd.y, y: fwd.x };
    const goal = { x: L.pos.x - fwd.x * FOLLOW_BACK + left.x * FOLLOW_SIDE, y: L.pos.y - fwd.y * FOLLOW_BACK + left.y * FOLLOW_SIDE };
    if (!s.pos) {
      s.pos = { ...goal };
      s.heading = L.heading;
    }

    // steer: arrive at the follow point, never cut inside Baymax's personal space
    let dx = goal.x - s.pos.x;
    let dy = goal.y - s.pos.y;
    const dGoal = Math.hypot(dx, dy);
    const want = dGoal < 0.08 ? 0 : Math.min(MAX_SPEED, (dGoal - 0.05) * 2.2);
    const ax = s.pos.x - L.pos.x;
    const ay = s.pos.y - L.pos.y;
    const dLead = Math.hypot(ax, ay) || 1;
    if (dLead < PERSONAL) {
      const push = (PERSONAL - dLead) * 4;
      dx += (ax / dLead) * push;
      dy += (ay / dLead) * push;
    }
    s.speed += THREE.MathUtils.clamp(want - s.speed, -ACCEL * dt * 1.5, ACCEL * dt);
    if (s.speed > 0.02 && Math.hypot(dx, dy) > 1e-3) {
      const desired = Math.atan2(dy, dx);
      s.heading += THREE.MathUtils.clamp(wrapAngle(desired - s.heading), -TURN * dt, TURN * dt);
    } else if (s.sit > 0.5) {
      // sitting: turn to face Baymax
      const face = Math.atan2(-ay, -ax);
      s.heading += THREE.MathUtils.clamp(wrapAngle(face - s.heading), -1.5 * dt, 1.5 * dt);
    }
    const step = s.speed * dt;
    s.pos.x += Math.cos(s.heading) * step;
    s.pos.y += Math.sin(s.heading) * step;
    if (dLead < PERSONAL - 0.02) {
      // hard guarantee: slide out to the ring
      s.pos.x = L.pos.x + (ax / dLead) * (PERSONAL - 0.02);
      s.pos.y = L.pos.y + (ay / dLead) * (PERSONAL - 0.02);
    }
    s.still = s.speed < 0.05 ? s.still + dt : 0;
    s.sit += ((s.still > 1.2 ? 1 : 0) - s.sit) * Math.min(1, dt * 3);
    const walk = Math.min(1, s.speed / 0.35);

    g.visible = L.visible;
    g.position.set(s.pos.x, 0, s.pos.y);
    g.rotation.y = headingToRotY(s.heading);

    // trot: diagonal pairs, one stride (0.16 m) per half cycle
    s.phase += (step * Math.PI) / 0.16;
    const bounce = Math.abs(Math.sin(s.phase)) * 0.012 * walk;
    if (body.current) {
      body.current.position.set(0, 0.145 + bounce - s.sit * 0.035, -s.sit * 0.03);
      body.current.rotation.set(-s.sit * 0.55, 0, Math.sin(s.phase) * 0.03 * walk);
    }
    const legSet: [number, number, number][] = [
      [-1, 1, 0],
      [1, 1, Math.PI],
      [-1, -1, Math.PI],
      [1, -1, 0],
    ];
    legSet.forEach(([, front, off], i) => {
      const lg = legs[i].current;
      if (!lg) return;
      const swing = Math.sin(s.phase + off) * 0.55 * walk;
      // sitting: front legs straight down in front, back legs folded under
      const sitRot = front > 0 ? 0.55 : -1.25;
      lg.rotation.set(swing * (1 - s.sit) + sitRot * s.sit, 0, 0);
      lg.scale.set(1, front > 0 ? 1 : 1 - s.sit * 0.35, 1);
    });

    // head: look at Baymax's face when sitting, ahead when walking
    const look = Math.atan2(-(L.pos.y - s.pos.y), L.pos.x - s.pos.x);
    const rel = wrapAngle(look + s.heading);
    s.yaw += (THREE.MathUtils.clamp(rel, -0.9, 0.9) * (0.35 + s.sit * 0.65) - s.yaw) * Math.min(1, dt * 3);
    if (head.current) head.current.rotation.set(-0.15 - s.sit * 0.45 + Math.sin(s.t * 0.7 + seed) * 0.04, s.yaw, Math.sin(s.t * 0.5) * 0.06 * s.sit);

    // tail: a chain that sways; up and curled when trotting, wrapped low when sitting
    const segs = tail.current;
    let px = 0;
    let py = 0;
    let pz = 0;
    for (let i = 0; i < TAIL_N; i++) {
      const f = i / (TAIL_N - 1);
      const sway = Math.sin(s.t * 2.2 - f * 2.4 + seed) * (0.25 + f * 0.6) * (0.4 + walk * 0.3);
      const up = (0.95 - f * 0.9) * (1 - s.sit) + -0.15 * s.sit;
      const wrap = s.sit * f * 1.6;
      const dir = new THREE.Vector3(Math.sin(sway + wrap) * 0.8, up, -Math.cos(sway + wrap * 0.6) * (1 - f * 0.4)).normalize();
      px += dir.x * TAIL_STEP;
      py += dir.y * TAIL_STEP;
      pz += dir.z * TAIL_STEP;
      const seg = segs[i];
      if (seg) {
        seg.position.set(px, py - s.sit * 0.04, pz + s.sit * 0.03);
        seg.scale.setScalar(0.025 - f * 0.004 + (i === TAIL_N - 1 ? 0.002 : 0));
      }
    }

    if (s.t > s.nextBlink) {
      s.blink = 0.14;
      s.nextBlink = s.t + 2.5 + ((Math.sin(s.t * 13.7 + seed) + 1) / 2) * 3.5;
    }
    s.blink = Math.max(0, s.blink - dt);
    if (eyes.current) eyes.current.scale.y = s.blink > 0 ? 0.15 : 1 - s.sit * 0.35;
  });

  return (
    <group ref={root}>
      {/* legs hang from the hips/shoulders in root space so the paws stay on the floor */}
      {[
        [-0.055, 0.135, 0.1],
        [0.055, 0.135, 0.1],
        [-0.06, 0.135, -0.1],
        [0.06, 0.135, -0.1],
      ].map(([x, y, z], i) => (
        <group key={i} ref={legs[i]} position={[x, y, z]}>
          <mesh geometry={geo.leg} material={m.fur} rotation={[Math.PI, 0, 0]} scale={[1, 1.05, 1]} castShadow />
          <mesh geometry={geo.ball} material={m.cream} position={[0, -0.118, 0.014]} scale={[0.036, 0.022, 0.044]} castShadow />
        </group>
      ))}
      <group ref={body}>
        {/* loaf body, cream belly, stripes over the back */}
        <mesh geometry={geo.ball} material={m.fur} scale={[0.11, 0.1, 0.18]} castShadow receiveShadow />
        <mesh geometry={geo.ball} material={m.cream} position={[0, -0.035, 0.03]} scale={[0.075, 0.06, 0.14]} />
        {[-0.08, 0, 0.08].map((z) => (
          <mesh key={z} position={[0, 0.0, z]} rotation={[0, Math.PI / 2, 0]} material={m.stripe} scale={[1.9, 0.95, 1]}>
            <torusGeometry args={[0.051, 0.008, 6, 24, Math.PI * 0.7]} />
          </mesh>
        ))}
        {/* tail root sits at the back of the body; segments are positioned per frame */}
        <group position={[0, 0.02, -0.17]}>
          {Array.from({ length: TAIL_N }, (_, i) => (
            <mesh key={i} ref={(el) => void (tail.current[i] = el)} geometry={geo.ball} material={i >= TAIL_N - 3 ? m.stripe : m.fur} castShadow />
          ))}
        </group>
        <group ref={head} position={[0, 0.08, 0.16]}>
          <mesh geometry={geo.ball} material={m.fur} scale={[0.1, 0.088, 0.088]} castShadow />
          {/* cheeks and muzzle */}
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={geo.ball} material={m.cream} position={[sd * 0.026, -0.03, 0.065]} scale={[0.034, 0.026, 0.026]} />
          ))}
          <mesh geometry={geo.ball} material={m.nose} position={[0, -0.012, 0.087]} scale={[0.011, 0.008, 0.007]} />
          {/* forehead stripes */}
          {[-0.022, 0, 0.022].map((x) => (
            <mesh key={x} geometry={geo.ball} material={m.stripe} position={[x, 0.06, 0.055]} rotation={[0.9, 0, x * 8]} scale={[0.006, 0.022, 0.005]} />
          ))}
          <group ref={eyes} position={[0, 0.012, 0]}>
            {[-1, 1].map((sd) => (
              <group key={sd} position={[sd * 0.04, 0, 0.078]}>
                <mesh geometry={geo.ball} material={m.ink} scale={[0.014, 0.018, 0.008]} />
                <mesh geometry={geo.ball} material={m.white} position={[0.004, 0.006, 0.006]} scale={0.004} />
              </group>
            ))}
          </group>
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 0.058, 0.07, -0.005]} rotation={[0, 0, -sd * 0.35]}>
              <mesh geometry={geo.cone} material={m.fur} scale={[0.036, 0.06, 0.02]} rotation={[0, Math.PI / 6, 0]} castShadow />
              <mesh geometry={geo.cone} material={m.ear} position={[0, -0.004, 0.008]} scale={[0.022, 0.042, 0.008]} rotation={[0, Math.PI / 6, 0]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
