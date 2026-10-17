// Look-development stage (open with ?lookdev). Shows the storybook Baymax, the customer
// prototype and one table/chair set under café lighting, driven by a small scripted motion
// loop purely for animation review. The café itself still runs the real planner.
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '../core/vec';
import type { Look } from '../sim/customers';
import { ROBOT_RADIUS } from '../world/layout';
import { BaymaxModel, type BaymaxPose } from './Baymax';
import { StoryChair, StoryTable, useFurnitureKit } from './Furniture';
import { PersonModel, type PersonPose } from './Person';
import { PALETTE } from './style/shapes';

const PROTO: Look = { shirt: '#d9826a', pants: '#56607a', skin: '#f2c7a6', hair: '#5a3b2a', hairStyle: 'bun', height: 1 };
const PROTO_B: Look = { ...PROTO, shirt: '#7f9f78', hair: '#2f2420', hairStyle: 'short' };

type Shot = 'overview' | 'baymax' | 'customer' | 'portrait' | 'table';
const SHOTS: Record<Shot, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [0.6, 3.6, 6.4], target: [0.2, 0.6, 0] },
  baymax: { pos: [1.3, 1.6, 2.7], target: [-0.1, 0.95, 0] },
  customer: { pos: [2.3, 1.0, 2.6], target: [1.7, 0.55, 0.2] },
  portrait: { pos: [1.95, 0.95, -0.55], target: [1.38, 0.82, -1.3] },
  table: { pos: [-1.0, 1.5, 3.0], target: [-1.9, 0.45, -0.9] },
};

/** Scripted review loop: accelerate, cruise, brake, turn in place, idle, return. */
function baymaxScript(t: number): { pos: Vec2; heading: number; vel: Vec2 } {
  const T = 14;
  const u = t % T;
  // segment 1: 0-5s walk +x from -2.2 to 0.6 with ease in/out; 5-6.6 turn 180; 6.6-8 idle; 8-13 walk back; 13-14 turn
  const ease = (x: number) => x * x * (3 - 2 * x);
  const easeD = (x: number) => 6 * x * (1 - x);
  if (u < 5) {
    const f = u / 5;
    const x = -2.2 + 2.8 * ease(f);
    return { pos: { x, y: 0.2 }, heading: 0, vel: { x: (2.8 * easeD(f)) / 5, y: 0 } };
  }
  if (u < 6.6) return { pos: { x: 0.6, y: 0.2 }, heading: Math.PI * ease((u - 5) / 1.6), vel: { x: 0, y: 0 } };
  if (u < 8) return { pos: { x: 0.6, y: 0.2 }, heading: Math.PI, vel: { x: 0, y: 0 } };
  if (u < 13) {
    const f = (u - 8) / 5;
    return { pos: { x: 0.6 - 2.8 * ease(f), y: 0.2 }, heading: Math.PI, vel: { x: (-2.8 * easeD(f)) / 5, y: 0 } };
  }
  return { pos: { x: -2.2, y: 0.2 }, heading: Math.PI * (1 - ease(u - 13)), vel: { x: 0, y: 0 } };
}

function customerScript(t: number): PersonPose & { pos: Vec2 } {
  const T = 9;
  const u = t % T;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (u < 3.5) {
    const f = ease(u / 3.5);
    return { pos: { x: 2.6 - 1.4 * f, y: 1.4 - 1.2 * f }, facing: Math.atan2(-1.2, -1.4), state: 'walking', gait: 0, visible: true };
  }
  if (u < 6.5) return { pos: { x: 1.2, y: 0.2 }, facing: Math.atan2(-1.2, -1.4) * 0.3 + 0.7 * Math.PI * 0.5, state: 'idle', gait: 0, visible: true };
  const f = ease((u - 6.5) / 2.5);
  return { pos: { x: 1.2 + 1.4 * f, y: 0.2 + 1.2 * f }, facing: Math.atan2(1.2, 1.4), state: 'walking', gait: 0, visible: true };
}

function Stage({ shot, showFootprint }: { shot: Shot; showFootprint: boolean }) {
  const kit = useFurnitureKit();
  const clock = useRef(0);
  const [footprint] = useState(() => new THREE.Vector3());
  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.05);
  });
  const bay = (): BaymaxPose => {
    const s = baymaxScript(clock.current);
    footprint.set(s.pos.x, 0.01, s.pos.y);
    return { ...s, carrying: true, lookAt: { x: 1.2, y: 0.4 }, visible: true };
  };
  const cust = (): PersonPose => customerScript(clock.current);
  const seat = (facing: number, x: number, z: number) => (): PersonPose => ({ pos: { x, y: z }, facing, state: 'sitting', gait: 0, visible: true });
  const chatA = (): PersonPose => ({ pos: { x: 2.2, y: -1.3 }, facing: Math.PI, state: 'chatting', gait: 0, visible: true });
  const chatB = (): PersonPose => ({ pos: { x: 1.3, y: -1.3 }, facing: 0, state: 'chatting', gait: 0, visible: true });
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    ring.current?.position.copy(footprint);
  });
  return (
    <>
      <Rig shot={shot} />
      <hemisphereLight args={['#fff1dc', '#8a6a52', 0.9]} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={2.0}
        color="#ffe2bf"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-radius={8}
        shadow-blurSamples={16}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-4, 3, 5]} intensity={0.45} color="#d6e2ff" />
      {/* floor + back wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#d9b48d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.5, -2.6]} receiveShadow>
        <planeGeometry args={[12, 3]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={1} />
      </mesh>
      <mesh position={[0, 0.45, -2.59]}>
        <planeGeometry args={[12, 0.9]} />
        <meshStandardMaterial color={PALETTE.green} roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={10} resolution={1024} blur={2.6} opacity={0.35} far={1.5} color="#5a3a26" />

      <BaymaxModel source={bay} seed={1} />
      <PersonModel look={PROTO} source={cust} seed={2} />
      <PersonModel look={PROTO} source={chatA} seed={3} />
      <PersonModel look={PROTO_B} source={chatB} seed={8} />

      <StoryTable kit={kit} x={-1.9} z={-0.9} />
      <StoryChair kit={kit} x={-2.55} z={-0.9} facing={0} />
      <StoryChair kit={kit} x={-1.25} z={-0.9} facing={Math.PI} alt />
      <PersonModel look={PROTO_B} source={seat(0, -2.55, -0.9)} seed={5} />

      {showFootprint && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[ROBOT_RADIUS - 0.012, ROBOT_RADIUS + 0.012, 64]} />
          <meshBasicMaterial color="#2ec4b6" />
        </mesh>
      )}
    </>
  );
}

function Rig({ shot }: { shot: Shot }) {
  const { camera } = useThree();
  const ctl = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const anim = useRef<{ fp: THREE.Vector3; ft: THREE.Vector3; t: number } | null>(null);
  useEffect(() => {
    const c = ctl.current as unknown as { target: THREE.Vector3 } | null;
    anim.current = { fp: camera.position.clone(), ft: c ? c.target.clone() : new THREE.Vector3(), t: 0 };
  }, [shot, camera]);
  useFrame((_, dt) => {
    const a = anim.current;
    const c = ctl.current as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + dt / 1.0);
    const e = a.t * a.t * (3 - 2 * a.t);
    camera.position.lerpVectors(a.fp, new THREE.Vector3(...SHOTS[shot].pos), e);
    c.target.lerpVectors(a.ft, new THREE.Vector3(...SHOTS[shot].target), e);
    c.update();
    if (a.t >= 1) anim.current = null;
  });
  return <OrbitControls ref={ctl} makeDefault enableDamping target={SHOTS[(params.get('shot') as Shot) || 'overview'].target} />;
}

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export function LookDev() {
  const [shot, setShot] = useState<Shot>((params.get('shot') as Shot) || 'overview');
  const [fp, setFp] = useState(params.has('fp'));
  const shots = useMemo(() => Object.keys(SHOTS) as Shot[], []);
  return (
    <div className="app">
      <div className="stage">
        <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: SHOTS[(params.get('shot') as Shot) || 'overview'].pos, fov: 35 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }} onCreated={({ scene }) => (scene.background = new THREE.Color('#efe3cf'))}>
          <Stage shot={shot} showFootprint={fp} />
        </Canvas>
      </div>
      <div className="topbar" style={{ right: 'auto', display: params.has('clean') ? 'none' : undefined }}>
        <div className="brand">
          <div>
            <div className="brand-title">Look-dev stage</div>
            <div className="brand-sub">Storybook prototypes · scripted motion for animation review only</div>
          </div>
        </div>
        <div className="scenarios">
          {shots.map((s) => (
            <button key={s} className={`tab ${s === shot ? 'active' : ''}`} onClick={() => setShot(s)}>
              {s}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={fp} onChange={(e) => setFp(e.target.checked)} /> Show 0.52 m footprint
        </label>
      </div>
    </div>
  );
}
