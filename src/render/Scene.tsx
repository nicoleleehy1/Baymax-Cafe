import { OrbitControls } from '@react-three/drei';
import { useScreenLabel } from './labels';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { angleOf, sub } from '../core/vec';
import { SCENARIOS } from '../sim/scenarios';
import { controller } from '../state/controller';
import { useApp } from '../state/store';
import { AUNT_CASS, FLOOR_HEIGHT, LAYOUT, LAYOUT_ID, tableById } from '../world/layout';
import { Building } from './Building';
import { CAST, CharacterModel } from './characters';
import { BaymaxModel, type BaymaxPose } from './Baymax';
import { Cafe } from './Cafe';
import { lerpAngle } from './geom';
import { ConsideringOverlay } from './Overlay';
import { PersonModel, type PersonPose } from './Person';
import { ReplayScene } from './Replay';
import { TeachingPreview } from './Teaching';
import { SimDriver } from './SimDriver';

// dollhouse framing per layout: the building is viewed from its cut-away window side
const DEFAULT_SHOT =
  LAYOUT_ID === 'classic'
    ? { pos: new THREE.Vector3(1.0, 9.2, 11.6), target: new THREE.Vector3(0.2, 0, 0.4) }
    : { pos: new THREE.Vector3(0.0, 15.5, 12.5), target: new THREE.Vector3(0.0, 0, 0.6) };
// whole-building shot: pull back and aim at the middle of the stack (active floor is y = 0)
const BUILDING_SHOT = (() => {
  const mid = (2 - LAYOUT.floor) * FLOOR_HEIGHT;
  return { pos: new THREE.Vector3(14, mid + 16, 24), target: new THREE.Vector3(0, mid, 0) };
})();

export function Scene() {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: DEFAULT_SHOT.pos.toArray(), fov: 38, near: 0.1, far: 80 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#2a211c');
        scene.fog = new THREE.Fog('#2a211c', 22, 40);
      }}
    >
      <SimDriver />
      <Lights />
      {LAYOUT_ID === 'classic' ? <Cafe /> : <Building />}
      <World />
      <CameraRig />
    </Canvas>
  );
}

function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const s = sun.current;
    if (!s) return;
    s.target.position.set(1.5, 0, 0);
    s.target.updateMatrixWorld();
  }, []);
  return (
    <>
      <hemisphereLight args={['#ffe8c7', '#6b4a35', 0.75]} />
      <ambientLight intensity={0.18} color="#ffd9a8" />
      <directionalLight
        ref={sun}
        position={LAYOUT_ID === 'classic' ? [13, 8.5, 1.5] : [3, 10, 9]}
        intensity={3.1}
        color="#ffdcae"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight position={[-4, 6, 9]} intensity={0.55} color="#c9d8ff" />
    </>
  );
}

function World() {
  const scenarioId = useApp((s) => s.scenarioId);
  const view = useApp((s) => s.view);
  const runState = useApp((s) => s.runState);
  const query = useApp((s) => s.query);
  const replayActive = useApp((s) => s.replayActive);
  const evaluation = useApp((s) => s.evaluation);
  const scenario = SCENARIOS[scenarioId];

  if (replayActive && evaluation.result) {
    return (
      <>
        <ReplayScene key={`${evaluation.result.scenarioId}-${evaluation.ms}`} result={evaluation.result} />
        <AuntCass />
      </>
    );
  }
  return (
    <>
      {scenario.customers.map((c, i) => {
        const spec = c.character ? CAST_BY_ID[c.character] : undefined;
        return spec ? (
          <CharacterModel key={`${scenarioId}-${c.id}`} spec={spec} source={liveHuman(c.id)} seed={i} />
        ) : (
          <PersonModel key={`${scenarioId}-${c.id}`} look={c.look} source={liveHuman(c.id)} seed={i} />
        );
      })}
      {!scenario.customers.some((c) => c.character === 'cass') && <AuntCass />}
      <BaymaxModel source={liveRobotUnlessPreviewing} />
      <DeliveredCup />
      <ChatBubbles groups={scenario.groups.map((g) => g.id)} />
      {view === 'considering' && <ConsideringOverlay />}
      {(runState === 'teaching' || runState === 'learning') && query?.query && <TeachingPreview plan={query} />}
    </>
  );
}

const liveRobot = (): BaymaxPose => {
  const a = controller.prevFrame.robot;
  const b = controller.curFrame.robot;
  const f = controller.alpha;
  return {
    pos: { x: a.pos.x + (b.pos.x - a.pos.x) * f, y: a.pos.y + (b.pos.y - a.pos.y) * f },
    heading: lerpAngle(a.heading, b.heading, f),
    vel: b.vel,
    carrying: b.carrying,
    lookAt: controller.engine.robot.lookAt,
    visible: true,
  };
};

/** While a teaching preview plays, the ghost *is* Baymax rehearsing; hide the paused body. */
const liveRobotUnlessPreviewing = (): BaymaxPose => {
  const p = liveRobot();
  const rs = useApp.getState().runState;
  p.visible = !((rs === 'teaching' || rs === 'learning') && useApp.getState().query?.query);
  return p;
};

const liveHuman = (id: string) => (): PersonPose => {
  const fa = controller.prevFrame.humans.find((h) => h.id === id);
  const fb = controller.curFrame.humans.find((h) => h.id === id);
  if (!fa || !fb) return { pos: { x: 0, y: 0 }, facing: 0, state: 'gone', gait: 0, visible: false };
  const f = controller.alpha;
  return {
    pos: { x: fa.pos.x + (fb.pos.x - fa.pos.x) * f, y: fa.pos.y + (fb.pos.y - fa.pos.y) * f },
    facing: lerpAngle(fa.facing, fb.facing, f),
    state: fb.state,
    gait: fa.gait + (fb.gait - fa.gait) * f,
    visible: fb.visible,
  };
};

const CAST_BY_ID: Record<string, (typeof CAST)[number]> = {
  cass: CAST[0],
  hiro: CAST[1],
  gogo: CAST[2],
  wasabi: CAST[3],
  honey: CAST[4],
  fred: CAST[5],
};

const CASS_LOOK = { shirt: '#5a7fb5', pants: '#3d3a46', skin: '#f2c9a8', hair: '#7a4b2a', hairStyle: 'bun' as const, height: 0.98 };

function AuntCass() {
  const facing = useRef(AUNT_CASS.facing);
  const src = (): PersonPose => {
    const r = controller.curFrame.robot.pos;
    const target = angleOf(sub(r, AUNT_CASS.pos));
    facing.current = lerpAngle(facing.current, Math.max(0.6, Math.min(Math.PI - 0.6, target)), 0.05);
    return { pos: AUNT_CASS.pos, facing: facing.current, state: 'ordering', gait: 0, visible: true };
  };
  return <PersonModel look={CASS_LOOK} source={src} apron seed={7} />;
}

/** Little "talking" bubbles over active conversation groups (the annotation, made visible). */
function ChatBubbles({ groups }: { groups: string[] }) {
  return (
    <>
      {groups.map((id) => (
        <ChatBubble key={id} id={id} />
      ))}
    </>
  );
}

function ChatBubble({ id }: { id: string }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useScreenLabel('chat-bubble', '<i></i><i></i><i></i>', () => {
    const z = controller.curFrame.zones.find((x) => x.groupId === id);
    return z ? v.set(z.centroid.x, 2.05, z.centroid.y) : null;
  });
  return null;
}

/** The delivered drink appears on the table once the sim says it was placed. */
function DeliveredCup() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const r = controller.engine.robot;
    const placed = !!r.tableId && !r.carrying && (r.phase === 'placing' || r.phase === 'returning' || r.phase === 'idle' || r.phase === 'done');
    g.visible = placed;
    if (placed && r.tableId) {
      const t = tableById(r.tableId);
      const d = sub(t.serve, t.c);
      const L = Math.hypot(d.x, d.y) || 1;
      g.position.set(t.c.x + (d.x / L) * 0.25, 0.76, t.c.y + (d.y / L) * 0.25);
    }
  });
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfaf6', roughness: 0.3 }), []);
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 0.004, 0]} material={mat} castShadow>
        <cylinderGeometry args={[0.07, 0.065, 0.008, 24]} />
      </mesh>
      <mesh position={[0, 0.045, 0]} material={mat} castShadow>
        <cylinderGeometry args={[0.045, 0.034, 0.075, 24]} />
      </mesh>
      <mesh position={[0, 0.083, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.041, 24]} />
        <meshStandardMaterial color="#c89a6b" />
      </mesh>
    </group>
  );
}

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const runState = useApp((s) => s.runState);
  const query = useApp((s) => s.query);
  const replayActive = useApp((s) => s.replayActive);
  const buildingView = useApp((s) => s.buildingView);
  const anim = useRef<{ fromP: THREE.Vector3; fromT: THREE.Vector3; toP: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    let toP = (buildingView ? BUILDING_SHOT : DEFAULT_SHOT).pos.clone();
    let toT = (buildingView ? BUILDING_SHOT : DEFAULT_SHOT).target.clone();
    if (!buildingView && (runState === 'teaching' || runState === 'learning') && query?.query) {
      const a = query.candidates[query.query.a];
      const b = query.candidates[query.query.b];
      const pts = [...a.pts, ...a.tail, ...b.pts, ...b.tail];
      const xs = pts.map((p) => p.x);
      const zs = pts.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const ext = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.5, 4);
      const d = 1.45 * ext + 2.2;
      // aim slightly below centre so the teaching card does not cover the paths
      toT = new THREE.Vector3(cx, 0, cz + 0.22 * d);
      toP = new THREE.Vector3(cx + 0.4, 0.78 * d + 1.5, cz + 0.62 * d + 1.2);
      // keep Baymax's head clear of the toolbar (top ~14% of the screen): slide the shot back if needed
      const head = new THREE.Vector3(a.pts[0].x, 2.0, a.pts[0].y);
      const probe = (camera as THREE.PerspectiveCamera).clone();
      for (let i = 0; i < 12; i++) {
        probe.position.copy(toP);
        probe.lookAt(toT);
        probe.updateMatrixWorld();
        const ndcY = head.clone().project(probe).y;
        if (ndcY < 0.68) break;
        toT.z -= 0.35;
        toP.z -= 0.35;
      }
    }
    anim.current = { fromP: camera.position.clone(), fromT: ctl.target.clone(), toP, toT, t: 0 };
  }, [runState === 'teaching' || runState === 'learning', query, replayActive, buildingView, camera]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const a = anim.current;
    const ctl = controls.current;
    if (!a || !ctl) return;
    a.t = Math.min(1, a.t + dt / 1.3);
    const e = a.t * a.t * (3 - 2 * a.t);
    camera.position.lerpVectors(a.fromP, a.toP, e);
    ctl.target.lerpVectors(a.fromT, a.toT, e);
    ctl.update();
    if (a.t >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2.25}
      target={DEFAULT_SHOT.target.toArray()}
    />
  );
}
