// Storybook café customer (one parametric prototype; variations come from Look).
// Proportions: big round head, short limbs, full bean body, rounded clothing, simple face.
// Animation blends idle / walk / sit / chat / browse / order from the simulated state:
//   - root transform is the authoritative sim pose
//   - feet: zero-slip stepping with two-bone leg IK (planted foot sweeps one stride)
//   - weight shift, start/stop lean from real acceleration, head attention, seeded blinks,
//     conversation gestures that alternate between partners (phase from seed, not synced)
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '../core/vec';
import { wrapAngle } from '../core/vec';
import type { Look } from '../sim/customers';
import { solveTwoBone } from './Baymax';
import { headingToRotY } from './geom';
import { PALETTE, limb, softMat, splineLathe } from './style/shapes';

export interface PersonPose {
  pos: Vec2;
  facing: number;
  state: string;
  gait: number;
  visible: boolean;
}

interface Props {
  look: Look;
  source: () => PersonPose;
  apron?: boolean;
  seed?: number;
}

// unscaled body plan (scaled by look.height)
const HIP_Y = 0.32;
const SEAT_Y = 0.4;
const THIGH = 0.137;
const SHIN = 0.137;
const HEAD_Y = 0.93;
const HEAD_R = 0.21;
const HEAD_SCALE = { y: 0.95, z: 0.97 };
/** z of the head surface at (x, y) in head space, so facial features sit on it, not in it */
function faceZ(x: number, y: number): number {
  const yy = y / HEAD_SCALE.y;
  return Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - yy * yy)) * HEAD_SCALE.z + 0.003;
}

const SHIRT: [number, number][] = [
  [0.0, 0.36],
  [0.17, 0.365],
  [0.208, 0.4],
  [0.205, 0.5],
  [0.19, 0.6],
  [0.155, 0.68],
  [0.09, 0.725],
  [0.0, 0.735],
];
const PANTS: [number, number][] = [
  [0.0, 0.27],
  [0.13, 0.275],
  [0.175, 0.31],
  [0.19, 0.38],
  [0.17, 0.43],
  [0.0, 0.44],
];

export function PersonModel({ look, source, apron = false, seed = 0 }: Props) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const thigh = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const shin = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const foot = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const st = useRef({
    t: seed * 1.37,
    w: { walk: 0, sit: 0, chat: 0, browse: 0 },
    prevPos: null as Vec2 | null,
    prevSpeed: 0,
    lean: 0,
    phase: seed,
    nextBlink: 1.5 + (seed % 4) * 0.9,
    blink: 0,
    yaw: 0,
    shiftT: 3 + seed,
    shift: 0,
    shiftTarget: 0,
  });

  const geo = useMemo(() => {
    const shirt = splineLathe(SHIRT, 64, 48);
    const pants = splineLathe(PANTS, 48, 40);
    const headG = new THREE.SphereGeometry(HEAD_R, 48, 32);
    const arm = limb(0.24, [[0, 0.058], [0.5, 0.055], [1, 0.05]], 20);
    const leg = limb(THIGH, [[0, 0.068], [1, 0.062]], 20);
    const lower = limb(SHIN, [[0, 0.06], [1, 0.056]], 20);
    leg.userData.len = THIGH;
    lower.userData.len = SHIN;
    const ball = new THREE.SphereGeometry(1, 24, 16);
    // hair: one spherical bowl tilted back (front rim at the hairline, sides over the ears,
    // back down to the nape) with a rolled rim so the edge reads soft, not cut
    const HAIR_T = Math.PI * 0.58;
    const hairCap = new THREE.SphereGeometry(HEAD_R * 1.06, 48, 24, 0, Math.PI * 2, 0, HAIR_T);
    const hairShell = new THREE.TorusGeometry(HEAD_R * 1.06 * Math.sin(HAIR_T), 0.013, 10, 64);
    hairShell.rotateX(Math.PI / 2);
    hairShell.translate(0, HEAD_R * 1.06 * Math.cos(HAIR_T), 0);
    const hairBack = new THREE.SphereGeometry(HEAD_R * 1.08, 40, 24, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI * 0.82);
    const mouth = new THREE.TorusGeometry(0.02, 0.0042, 6, 16, Math.PI * 0.8);
    return { shirt, pants, headG, arm, leg, lower, ball, hairCap, hairShell, hairBack, mouth };
  }, []);

  const m = useMemo(
    () => ({
      shirt: softMat(look.shirt),
      pants: softMat(look.pants),
      skin: softMat(look.skin, { roughness: 0.75, sheen: 0.35 }),
      hair: softMat(look.hair, { roughness: 0.7, sheen: 0.4 }),
      shoe: softMat('#4a3b33', { roughness: 0.6 }),
      apron: softMat(PALETTE.cream),
      ink: new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.4 }),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      blush: new THREE.MeshStandardMaterial({ color: PALETTE.blush, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
    }),
    [look],
  );
  const H = look.height;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const p = source();
    const g = root.current;
    if (!g) return;
    g.visible = p.visible;
    if (!p.visible) return;
    const s = st.current;
    s.t += dt;
    g.position.set(p.pos.x, 0, p.pos.y);
    g.rotation.y = headingToRotY(p.facing);

    const moved = s.prevPos ? Math.hypot(p.pos.x - s.prevPos.x, p.pos.y - s.prevPos.y) : 0;
    s.prevPos = { ...p.pos };
    const speed = dt > 0 ? moved / dt : 0;
    const accel = dt > 0 ? (speed - s.prevSpeed) / dt : 0;
    s.prevSpeed = speed;

    const target = {
      walk: p.state === 'sitting' ? 0 : Math.min(1, speed / 0.5),
      sit: p.state === 'sitting' ? 1 : 0,
      chat: p.state === 'chatting' ? 1 : 0,
      browse: p.state === 'browsing' || p.state === 'ordering' ? 1 : 0,
    };
    const k = Math.min(1, dt * 6);
    for (const key of Object.keys(target) as (keyof typeof target)[]) s.w[key] += (target[key] - s.w[key]) * k;
    const { walk, sit, chat, browse } = s.w;

    // stepping (zero-slip): one stride per half cycle of the planted foot
    const stride = 0.2 * H;
    s.phase += (moved * Math.PI) / stride;
    // start/stop anticipation
    s.lean += (THREE.MathUtils.clamp(accel * 0.05, -0.08, 0.08) - s.lean) * Math.min(1, dt * 6);
    // idle weight shifts at irregular, per-person intervals
    if (s.t > s.shiftT) {
      s.shiftTarget = (Math.sin(s.t * 7.31 + seed * 3.7) > 0 ? 1 : -1) * 0.5;
      s.shiftT = s.t + 2.5 + ((Math.sin(s.t * 3.3 + seed) + 1) / 2) * 4;
    }
    s.shift += (s.shiftTarget * (1 - walk) * (1 - sit) - s.shift) * Math.min(1, dt * 1.5);

    const bob = Math.abs(Math.cos(s.phase)) * 0.012 * walk;
    const hipY = (HIP_Y * (1 - sit) + SEAT_Y * sit) * H + bob;
    const sway = Math.sin(s.phase) * 0.012 * walk + s.shift * 0.018;
    const breathe = 1 + Math.sin(s.t * 1.6 + seed * 2.1) * 0.012;
    if (body.current) {
      body.current.position.set(sway * H, hipY - HIP_Y * H, sit * -0.02);
      body.current.rotation.set(-s.lean + browse * 0.12 - sit * 0.04, 0, Math.sin(s.phase) * 0.035 * walk - s.shift * 0.04);
      body.current.scale.set(H, H * breathe, H);
    }

    // legs: IK from hip to foot targets
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const ph = s.phase + (i === 0 ? 0 : Math.PI);
      const planted = Math.sin(ph) >= 0;
      const fz = (stride / 2) * Math.cos(ph) * walk;
      const lift = planted ? 0 : -Math.sin(ph) * 0.05 * walk * H;
      const standFoot = new THREE.Vector3(side * 0.085 * H + sway * H, 0.055 * H + lift, 0.02 + fz);
      // seated: feet dangle forward under the table edge
      const sitFoot = new THREE.Vector3(side * 0.09 * H, (SEAT_Y - 0.26) * H, 0.24 * H + Math.sin(s.t * 1.1 + i + seed) * 0.01);
      const footP = standFoot.lerp(sitFoot, sit);
      const hip = new THREE.Vector3(side * 0.085 * H + sway * H, hipY, sit * -0.02);
      const { elbowP: knee } = solveTwoBone(hip, footP, THIGH * H, SHIN * H, new THREE.Vector3(0, 0, 1));
      const reach = Math.min(footP.distanceTo(hip), (THIGH + SHIN) * H - 1e-3);
      const footEnd = hip.clone().add(footP.clone().sub(hip).normalize().multiplyScalar(reach));
      placeLimb(thigh[i].current, hip, knee, H);
      placeLimb(shin[i].current, knee, footEnd, H);
      foot[i].current?.position.copy(footEnd);
    }

    // arms: walk swing / chat gestures (alternating between partners) / ordering point
    const talk = Math.max(0, Math.sin(s.t * 0.55 + seed * 1.9)); // whose turn it is to talk
    for (let i = 0; i < 2; i++) {
      const a = arms[i].current;
      if (!a) continue;
      const side = i === 0 ? -1 : 1;
      const swing = Math.sin(s.phase) * 0.55 * walk * side;
      const gesture = i === 1 ? chat * talk * (0.9 + Math.sin(s.t * 3.1 + seed) * 0.25) : 0;
      const sitRest = sit * 0.9;
      a.rotation.set(-swing - gesture - sitRest - browse * 0.2, 0, side * (0.12 + gesture * 0.25 + walk * 0.05));
    }

    // head: attention, chat nods, blinks
    s.yaw += ((chat ? Math.sin(s.t * 0.4 + seed) * 0.15 : Math.sin(s.t * 0.21 + seed) * 0.25 * (1 - walk)) - s.yaw) * Math.min(1, dt * 2);
    if (head.current) {
      head.current.rotation.set(chat * talk * Math.sin(s.t * 4.2 + seed) * 0.06 + browse * 0.3 + s.lean * 0.5, s.yaw, wrapAngle(s.shift * 0.06 + chat * (1 - talk) * 0.08));
    }
    if (s.t > s.nextBlink) {
      s.blink = 0.13;
      s.nextBlink = s.t + 2.2 + ((Math.sin(s.t * 17.1 + seed * 5.3) + 1) / 2) * 3.8;
    }
    s.blink = Math.max(0, s.blink - dt);
    if (eyes.current) eyes.current.scale.y = s.blink > 0 ? 0.12 : 1;
  });

  return (
    <group ref={root}>
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh ref={thigh[i]} geometry={geo.leg} material={m.pants} castShadow />
          <mesh ref={shin[i]} geometry={geo.lower} material={m.pants} castShadow />
          <group ref={foot[i]}>
            <mesh geometry={geo.ball} material={m.shoe} scale={[0.065 * H, 0.045 * H, 0.09 * H]} position={[0, -0.01 * H, 0.025 * H]} castShadow />
          </group>
        </group>
      ))}
      <group ref={body}>
        <mesh geometry={geo.pants} material={m.pants} castShadow />
        <mesh geometry={geo.shirt} material={m.shirt} castShadow receiveShadow />
        {/* collar */}
        <mesh position={[0, 0.715, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.shirt}>
          <torusGeometry args={[0.085, 0.022, 10, 28]} />
        </mesh>
        {apron && (
          <mesh position={[0, 0.5, 0.19]} rotation={[-0.08, 0, 0]} material={m.apron} castShadow>
            <capsuleGeometry args={[0.12, 0.12, 6, 16]} />
          </mesh>
        )}
        {[0, 1].map((i) => (
          <group key={i} ref={arms[i]} position={[(i === 0 ? -1 : 1) * 0.19, 0.655, 0]}>
            <mesh geometry={geo.arm} material={m.shirt} rotation={[Math.PI, 0, 0]} castShadow />
            <mesh geometry={geo.ball} material={m.skin} position={[0, -0.27, 0.01]} scale={0.052} castShadow />
          </group>
        ))}
        <group ref={head} position={[0, HEAD_Y - 0.17, 0]}>
          <group position={[0, 0.17, 0]}>
            <mesh geometry={geo.headG} material={m.skin} scale={[1, HEAD_SCALE.y, HEAD_SCALE.z]} castShadow />
            {/* face */}
            <group ref={eyes} position={[0, 0.005, 0]}>
              {[-1, 1].map((sd) => (
                <group key={sd} position={[sd * 0.07, 0, faceZ(sd * 0.07, 0.005)]}>
                  <mesh geometry={geo.ball} material={m.ink} scale={[0.02, 0.028, 0.012]} />
                  <mesh geometry={geo.ball} material={m.white} position={[0.006, 0.01, 0.009]} scale={0.006} />
                </group>
              ))}
            </group>
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={geo.ball} material={m.blush} position={[sd * 0.112, -0.045, faceZ(sd * 0.112, -0.045) - 0.006]} scale={[0.032, 0.019, 0.01]} />
            ))}
            <mesh geometry={geo.ball} material={m.skin} position={[0, -0.028, faceZ(0, -0.028)]} scale={[0.016, 0.012, 0.011]} />
            <mesh geometry={geo.mouth} material={m.ink} position={[0, -0.064, faceZ(0, -0.064) - 0.002]} rotation={[0.35, 0, Math.PI * 1.1]} />
            <Hair style={look.hairStyle} mat={m.hair} geo={geo} accent={look.shirt} />
          </group>
        </group>
      </group>
    </group>
  );
}

const UP = new THREE.Vector3(0, 1, 0);
function placeLimb(mesh: THREE.Mesh | null, a: THREE.Vector3, b: THREE.Vector3, H: number): void {
  if (!mesh) return;
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  const nominal = (mesh.geometry as THREE.BufferGeometry).userData.len as number;
  mesh.scale.set(H, L / nominal, H);
}

type HairGeo = { hairCap: THREE.BufferGeometry; hairShell: THREE.BufferGeometry; hairBack: THREE.BufferGeometry; ball: THREE.BufferGeometry };

function Hair({ style, mat, geo, accent }: { style: Look['hairStyle']; mat: THREE.Material; geo: HairGeo; accent: string }) {
  // the bowl is tilted back so the face stays open
  const cap = (
    <group rotation={[-0.62, 0, 0]} position={[0, 0.006, -0.004]}>
      <mesh geometry={geo.hairCap} material={mat} />
      <mesh geometry={geo.hairShell} material={mat} />
    </group>
  );
  switch (style) {
    case 'bun':
      return (
        <group>
          {cap}
          <mesh geometry={geo.ball} material={mat} position={[0, 0.2, -0.1]} scale={0.085} />
        </group>
      );
    case 'long':
      return (
        <group>
          {cap}
          <mesh geometry={geo.hairBack} material={mat} rotation={[0.05, Math.PI, 0]} position={[0, -0.03, -0.01]} scale={[1, 1.12, 1]} />
        </group>
      );
    case 'cap':
      return (
        <group>
          <mesh geometry={geo.hairCap} rotation={[-0.3, 0, 0]} scale={[1.02, 0.9, 1.02]}>
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.115, 0.2]} rotation={[0.35, 0, 0]} scale={[1, 0.25, 1]}>
            <cylinderGeometry args={[0.13, 0.13, 0.04, 28, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
        </group>
      );
    default:
      return (
        <group>
          {cap}
        </group>
      );
  }
}
