// Shared storybook character rig for the named cast. Same body plan, shading and motion
// language as the customer prototype (Person.tsx): big round head, bean body, short limbs,
// zero-slip stepping with two-bone leg IK, blended idle/walk/sit/chat states, seeded blinks.
// Each cast member is a CharacterSpec: proportions, palette, clothing cut, a face variant,
// and `head`/`body` slots where its own module adds hair, hats, glasses and props.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '../../core/vec';
import { wrapAngle } from '../../core/vec';
import { solveTwoBone } from '../Baymax';
import { headingToRotY } from '../geom';
import type { PersonPose } from '../Person';
import { PALETTE, limb, softMat } from '../style/shapes';

export type { PersonPose };

// unscaled body plan (matches Person.tsx; scaled per character)
const HIP_Y = 0.32;
const SEAT_Y = 0.4;
const THIGH = 0.137;
const SHIN = 0.137;
const HEAD_Y = 0.93;
export const HEAD_R = 0.21;
export const HEAD_SCALE = { y: 0.95, z: 0.97 };

/** z of the head surface at (x, y) in head space, so facial features sit on it, not in it */
export function faceZ(x: number, y: number): number {
  const yy = y / HEAD_SCALE.y;
  return Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - yy * yy)) * HEAD_SCALE.z + 0.003;
}

/** Point on the (slightly squashed) head surface; theta from +Y down, phi around from +Z. */
export function headPoint(theta: number, phi: number, lift = 1): THREE.Vector3 {
  const r = HEAD_R * lift;
  return new THREE.Vector3(Math.sin(theta) * Math.sin(phi) * r, Math.cos(theta) * r * HEAD_SCALE.y, Math.sin(theta) * Math.cos(phi) * r * HEAD_SCALE.z);
}

export type TopCut = 'shirt' | 'hoodie' | 'tee' | 'dress' | 'sweater';
export type Eyes = 'round' | 'sleepy' | 'bright' | 'sharp';
export type Mouth = 'smile' | 'grin' | 'flat' | 'smirk' | 'open';

export interface CharacterSpec {
  id: string;
  name: string;
  /** overall scale; the customer prototype is 1 */
  height: number;
  /** torso width multiplier */
  girth?: number;
  /** head size multiplier */
  headSize?: number;
  colors: {
    skin: string;
    top: string;
    bottom: string;
    shoe: string;
    hair: string;
    /** sleeve colour if different from the top (a jacket, a cardigan) */
    sleeve?: string;
    /** thigh colour: bottom by default, skin for a dress */
    thigh?: string;
    /** shin colour: bottom by default, skin for shorts or a dress */
    shin?: string;
    cheek?: string;
  };
  top: TopCut;
  eyes?: Eyes;
  mouth?: Mouth;
  brows?: number;
  /** idle liveliness: 0.5 calm, 1 normal, 1.6 restless */
  energy?: number;
  /** occasional friendly wave while idle */
  waves?: boolean;
  /** hair, hats, glasses; head space, origin at head centre, +Z is the face */
  head: (k: Kit) => ReactNode;
  /** clothing layers and props; body space, origin on the floor under the hips */
  body?: (k: Kit) => ReactNode;
}

export interface Kit {
  spec: CharacterSpec;
  girth: number;
  geo: SharedGeo;
  /** cached storybook material for a colour */
  mat: (color: string, opts?: { roughness?: number; sheen?: number }) => THREE.Material;
  ink: THREE.Material;
  white: THREE.Material;
}

export interface SharedGeo {
  ball: THREE.SphereGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  lower: THREE.BufferGeometry;
  head: THREE.SphereGeometry;
  hairCap: THREE.BufferGeometry;
  hairRim: THREE.BufferGeometry;
  hairBack: THREE.BufferGeometry;
  cone: THREE.ConeGeometry;
  capsule: THREE.CapsuleGeometry;
  mouth: THREE.BufferGeometry;
  smile: THREE.BufferGeometry;
}

/** Smooth lathe over a partial sweep (open jackets, aprons, hoods). Front is phi = 0 (+Z). */
export function partialLathe(ctrl: [number, number][], phiStart: number, phiLength: number, samples = 48, segments = 40): THREE.LatheGeometry {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  g.computeVertexNormals();
  return g;
}

function smoothLathe(ctrl: [number, number][], samples: number, segments: number): THREE.LatheGeometry {
  const g = partialLathe(ctrl, 0, Math.PI * 2, samples, segments);
  return g;
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
// a tunic/dress: same shoulders, flares out over the hips and ends above the knee
const DRESS: [number, number][] = [
  [0.0, 0.2],
  [0.2, 0.205],
  [0.235, 0.24],
  [0.215, 0.36],
  [0.2, 0.5],
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

export function CharacterModel({ spec, source, seed = 0 }: { spec: CharacterSpec; source: () => PersonPose; seed?: number }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const arms = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const thigh = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const shin = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const foot = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const energy = spec.energy ?? 1;
  const G = spec.girth ?? 1;
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
    waveT: 4 + (seed % 5),
    wave: 0,
  });

  const kit = useMemo<Kit>(() => {
    const ball = new THREE.SphereGeometry(1, 24, 16);
    const HAIR_T = Math.PI * 0.58;
    const hairCap = new THREE.SphereGeometry(HEAD_R * 1.06, 48, 24, 0, Math.PI * 2, 0, HAIR_T);
    const hairRim = new THREE.TorusGeometry(HEAD_R * 1.06 * Math.sin(HAIR_T), 0.013, 10, 64);
    hairRim.rotateX(Math.PI / 2);
    hairRim.translate(0, HEAD_R * 1.06 * Math.cos(HAIR_T), 0);
    const geo: SharedGeo = {
      ball,
      arm: limb(0.24, [[0, 0.058], [0.5, 0.055], [1, 0.05]], 20),
      leg: limb(THIGH, [[0, 0.068], [1, 0.062]], 20),
      lower: limb(SHIN, [[0, 0.06], [1, 0.056]], 20),
      head: new THREE.SphereGeometry(HEAD_R, 48, 32),
      hairCap,
      hairRim,
      hairBack: new THREE.SphereGeometry(HEAD_R * 1.08, 40, 24, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI * 0.82),
      cone: new THREE.ConeGeometry(1, 1, 16, 1),
      // unit capsule: radius 1 across, total height 1 along +Y, so scale [r, h, r] reads directly
      capsule: new THREE.CapsuleGeometry(0.5, 1, 6, 16).scale(2, 0.5, 2),
      mouth: new THREE.TorusGeometry(0.02, 0.0042, 6, 16, Math.PI * 0.8),
      smile: new THREE.TorusGeometry(0.026, 0.0045, 6, 18, Math.PI),
    };
    geo.leg.userData.len = THIGH;
    geo.lower.userData.len = SHIN;
    const cache = new Map<string, THREE.Material>();
    return {
      spec,
      girth: G,
      geo,
      mat: (color, opts) => {
        const key = `${color}|${opts?.roughness ?? ''}|${opts?.sheen ?? ''}`;
        let m = cache.get(key);
        if (!m) cache.set(key, (m = softMat(color, opts)));
        return m;
      },
      ink: new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.4 }),
      white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    };
  }, [spec, G]);

  const torso = useMemo(() => {
    const top = smoothLathe(spec.top === 'dress' ? DRESS : SHIRT, 64, 48);
    const pants = smoothLathe(PANTS, 48, 40);
    return { top, pants };
  }, [spec.top]);

  const c = spec.colors;
  const m = useMemo(
    () => ({
      top: kit.mat(c.top),
      sleeve: kit.mat(c.sleeve ?? c.top),
      bottom: kit.mat(c.bottom),
      thigh: kit.mat(c.thigh ?? c.bottom),
      shin: kit.mat(c.shin ?? c.thigh ?? c.bottom),
      skin: kit.mat(c.skin, { roughness: 0.75, sheen: 0.35 }),
      shoe: kit.mat(c.shoe, { roughness: 0.6 }),
      blush: new THREE.MeshStandardMaterial({ color: c.cheek ?? PALETTE.blush, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
    }),
    [kit, c],
  );
  const H = spec.height;

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
    const still = (1 - walk) * (1 - sit);

    const stride = 0.2 * H;
    s.phase += (moved * Math.PI) / stride;
    s.lean += (THREE.MathUtils.clamp(accel * 0.05, -0.08, 0.08) - s.lean) * Math.min(1, dt * 6);
    if (s.t > s.shiftT) {
      s.shiftTarget = (Math.sin(s.t * 7.31 + seed * 3.7) > 0 ? 1 : -1) * 0.5 * energy;
      s.shiftT = s.t + (2.5 + ((Math.sin(s.t * 3.3 + seed) + 1) / 2) * 4) / energy;
    }
    s.shift += (s.shiftTarget * still - s.shift) * Math.min(1, dt * 1.5);

    // friendly wave: a short raise-and-wag of the right arm every so often while idle
    if (spec.waves && s.t > s.waveT) {
      s.wave = 1.8;
      s.waveT = s.t + 7 + ((Math.sin(s.t * 5.7 + seed) + 1) / 2) * 5;
    }
    s.wave = Math.max(0, s.wave - dt);
    const waveW = Math.min(1, s.wave * 3, (1.8 - s.wave) * 4) * still * (1 - chat);

    const bob = Math.abs(Math.cos(s.phase)) * 0.012 * walk;
    const hipY = (HIP_Y * (1 - sit) + SEAT_Y * sit) * H + bob;
    const sway = Math.sin(s.phase) * 0.012 * walk + s.shift * 0.018;
    const breathe = 1 + Math.sin(s.t * 1.6 + seed * 2.1) * 0.012;
    if (body.current) {
      body.current.position.set(sway * H, hipY - HIP_Y * H, sit * -0.02);
      body.current.rotation.set(-s.lean + browse * 0.12 - sit * 0.04, 0, Math.sin(s.phase) * 0.035 * walk - s.shift * 0.04);
      body.current.scale.set(H, H * breathe, H);
    }

    const hipX = 0.085 * G;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const ph = s.phase + (i === 0 ? 0 : Math.PI);
      const planted = Math.sin(ph) >= 0;
      const fz = (stride / 2) * Math.cos(ph) * walk;
      const lift = planted ? 0 : -Math.sin(ph) * 0.05 * walk * H;
      const standFoot = new THREE.Vector3(side * hipX * H + sway * H, 0.055 * H + lift, 0.02 + fz);
      const sitFoot = new THREE.Vector3(side * (hipX + 0.005) * H, (SEAT_Y - 0.26) * H, 0.24 * H + Math.sin(s.t * 1.1 + i + seed) * 0.01);
      const footP = standFoot.lerp(sitFoot, sit);
      const hip = new THREE.Vector3(side * hipX * H + sway * H, hipY, sit * -0.02);
      const { elbowP: knee } = solveTwoBone(hip, footP, THIGH * H, SHIN * H, new THREE.Vector3(0, 0, 1));
      const reach = Math.min(footP.distanceTo(hip), (THIGH + SHIN) * H - 1e-3);
      const footEnd = hip.clone().add(footP.clone().sub(hip).normalize().multiplyScalar(reach));
      placeLimb(thigh[i].current, hip, knee, H);
      placeLimb(shin[i].current, knee, footEnd, H);
      foot[i].current?.position.copy(footEnd);
    }

    const talk = Math.max(0, Math.sin(s.t * 0.55 + seed * 1.9));
    for (let i = 0; i < 2; i++) {
      const a = arms[i].current;
      if (!a) continue;
      const side = i === 0 ? -1 : 1;
      const swing = Math.sin(s.phase) * 0.55 * walk * side;
      const gesture = i === 1 ? chat * talk * (0.9 + Math.sin(s.t * 3.1 + seed) * 0.25) * Math.min(1.3, energy) : 0;
      const sitRest = sit * 0.9;
      const raise = i === 1 ? waveW * 2.6 : 0;
      const wag = i === 1 ? waveW * Math.sin(s.t * 11) * 0.35 : 0;
      a.rotation.set(-swing - gesture - sitRest - browse * 0.2 - raise * 0.25, 0, side * (0.12 + gesture * 0.25 + walk * 0.05 + raise) + wag);
    }

    const look = chat ? Math.sin(s.t * 0.4 + seed) * 0.15 : Math.sin(s.t * 0.21 * energy + seed) * 0.25 * energy * (1 - walk);
    s.yaw += (look - s.yaw) * Math.min(1, dt * 2);
    if (head.current) {
      head.current.rotation.set(
        chat * talk * Math.sin(s.t * 4.2 + seed) * 0.06 + browse * 0.3 + s.lean * 0.5,
        s.yaw,
        wrapAngle(s.shift * 0.06 + chat * (1 - talk) * 0.08 + waveW * 0.08),
      );
    }
    if (s.t > s.nextBlink) {
      s.blink = 0.13;
      s.nextBlink = s.t + 2.2 + ((Math.sin(s.t * 17.1 + seed * 5.3) + 1) / 2) * 3.8;
    }
    s.blink = Math.max(0, s.blink - dt);
    if (eyes.current) eyes.current.scale.y = s.blink > 0 ? 0.12 : 1;
  });

  const HS = spec.headSize ?? 1;
  return (
    <group ref={root}>
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh ref={thigh[i]} geometry={kit.geo.leg} material={m.thigh} castShadow />
          <mesh ref={shin[i]} geometry={kit.geo.lower} material={m.shin} castShadow />
          <group ref={foot[i]}>
            <mesh geometry={kit.geo.ball} material={m.shoe} scale={[0.065 * H, 0.045 * H, 0.09 * H]} position={[0, -0.01 * H, 0.025 * H]} castShadow />
          </group>
        </group>
      ))}
      <group ref={body}>
        <group scale={[G, 1, G]}>
          {spec.top !== 'dress' && <mesh geometry={torso.pants} material={m.bottom} castShadow />}
          <mesh geometry={torso.top} material={m.top} castShadow receiveShadow />
          {spec.top === 'sweater' ? (
            <mesh position={[0, 0.712, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.top} scale={[1, 1, 1.6]}>
              <torusGeometry args={[0.088, 0.03, 12, 28]} />
            </mesh>
          ) : spec.top === 'hoodie' ? (
            // hood rolled down behind the neck
            <mesh position={[0, 0.7, -0.07]} rotation={[Math.PI / 2 - 0.35, 0, 0]} material={m.top} scale={[1.1, 1, 0.9]} castShadow>
              <torusGeometry args={[0.11, 0.045, 12, 28]} />
            </mesh>
          ) : (
            <mesh position={[0, 0.715, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.top}>
              <torusGeometry args={[0.085, 0.022, 10, 28]} />
            </mesh>
          )}
        </group>
        {spec.body?.(kit)}
        {[0, 1].map((i) => (
          <group key={i} ref={arms[i]} position={[(i === 0 ? -1 : 1) * 0.19 * G, 0.655, 0]}>
            <mesh geometry={kit.geo.arm} material={m.sleeve} rotation={[Math.PI, 0, 0]} castShadow />
            <mesh geometry={kit.geo.ball} material={m.skin} position={[0, -0.27, 0.01]} scale={0.052} castShadow />
          </group>
        ))}
        <group ref={head} position={[0, HEAD_Y - 0.17, 0]}>
          <group position={[0, 0.17, 0]} scale={HS}>
            <mesh geometry={kit.geo.head} material={m.skin} scale={[1, HEAD_SCALE.y, HEAD_SCALE.z]} castShadow />
            <Face kit={kit} eyesRef={eyes} skin={m.skin} blush={m.blush} />
            {spec.head(kit)}
          </group>
        </group>
      </group>
    </group>
  );
}

function Face({ kit, eyesRef, skin, blush }: { kit: Kit; eyesRef: React.RefObject<THREE.Group | null>; skin: THREE.Material; blush: THREE.Material }) {
  const { spec, geo, ink, white } = kit;
  const eyes = spec.eyes ?? 'round';
  const mouth = spec.mouth ?? 'smile';
  const ex = 0.07;
  const ey = 0.005;
  const eyeScale: [number, number, number] =
    eyes === 'sleepy' ? [0.021, 0.014, 0.012] : eyes === 'bright' ? [0.023, 0.032, 0.013] : eyes === 'sharp' ? [0.022, 0.022, 0.012] : [0.02, 0.028, 0.012];
  return (
    <>
      <group ref={eyesRef} position={[0, ey, 0]}>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * ex, 0, faceZ(sd * ex, ey)]}>
            <mesh geometry={geo.ball} material={ink} scale={eyeScale} />
            {eyes !== 'sleepy' && <mesh geometry={geo.ball} material={white} position={[0.006, 0.01, 0.009]} scale={eyes === 'bright' ? 0.008 : 0.006} />}
          </group>
        ))}
      </group>
      {/* sleepy eyes get a heavy skin-coloured upper lid */}
      {eyes === 'sleepy' &&
        [-1, 1].map((sd) => (
          <mesh
            key={sd}
            geometry={geo.capsule}
            material={skin}
            position={[sd * ex, ey + 0.012, faceZ(sd * ex, ey + 0.015) + 0.002]}
            rotation={[0, 0, Math.PI / 2]}
            scale={[0.016, 0.05, 0.012]}
          />
        ))}
      {spec.brows !== undefined &&
        [-1, 1].map((sd) => (
          <mesh
            key={sd}
            geometry={geo.capsule}
            material={kit.mat(spec.colors.hair)}
            position={[sd * ex, ey + 0.05, faceZ(sd * ex, ey + 0.05) + 0.001]}
            rotation={[0, 0, Math.PI / 2 - sd * spec.brows!]}
            scale={[0.006, 0.05, 0.005]}
          />
        ))}
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={geo.ball} material={blush} position={[sd * 0.112, -0.045, faceZ(sd * 0.112, -0.045) - 0.006]} scale={[0.032, 0.019, 0.01]} />
      ))}
      <mesh geometry={geo.ball} material={skin} position={[0, -0.028, faceZ(0, -0.028)]} scale={[0.016, 0.012, 0.011]} />
      {mouth === 'smile' && <mesh geometry={geo.mouth} material={ink} position={[0, -0.064, faceZ(0, -0.064) - 0.002]} rotation={[0.35, 0, Math.PI * 1.1]} />}
      {mouth === 'grin' && <mesh geometry={geo.smile} material={ink} position={[0, -0.058, faceZ(0, -0.058) - 0.002]} rotation={[0.35, 0, Math.PI]} />}
      {mouth === 'smirk' && <mesh geometry={geo.mouth} material={ink} position={[0.012, -0.064, faceZ(0.012, -0.064) - 0.002]} rotation={[0.35, 0, Math.PI * 1.25]} scale={0.8} />}
      {mouth === 'flat' && <mesh geometry={geo.capsule} material={ink} position={[0, -0.066, faceZ(0, -0.066)]} rotation={[0, 0, Math.PI / 2]} scale={[0.004, 0.04, 0.004]} />}
      {mouth === 'open' && (
        <mesh geometry={geo.ball} material={ink} position={[0, -0.066, faceZ(0, -0.066) - 0.002]} scale={[0.022, 0.016, 0.008]} />
      )}
    </>
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

/** The standard tilted hair bowl (front rim at the hairline, open face). */
export function HairBowl({ kit, color, tilt = -0.62, scale = 1 }: { kit: Kit; color: string; tilt?: number; scale?: number | [number, number, number] }) {
  const mat = kit.mat(color, { roughness: 0.7, sheen: 0.4 });
  return (
    <group rotation={[tilt, 0, 0]} position={[0, 0.006, -0.004]} scale={scale}>
      <mesh geometry={kit.geo.hairCap} material={mat} castShadow />
      <mesh geometry={kit.geo.hairRim} material={mat} />
    </group>
  );
}

/** A soft tapered lock/spike rooted on the head surface and pointing outward (plus a bias). */
export function Lock({
  kit,
  color,
  theta,
  phi,
  length,
  width,
  bias = [0, 0, 0],
  lift = 0.97,
}: {
  kit: Kit;
  color: string;
  theta: number;
  phi: number;
  length: number;
  width: number;
  bias?: [number, number, number];
  lift?: number;
}) {
  const base = headPoint(theta, phi, lift);
  const dir = base.clone().normalize().add(new THREE.Vector3(...bias)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  const pos = base.clone().add(dir.clone().multiplyScalar(length / 2));
  return <mesh geometry={kit.geo.cone} material={kit.mat(color, { roughness: 0.7, sheen: 0.4 })} position={pos} quaternion={q} scale={[width, length, width * 0.8]} castShadow />;
}
