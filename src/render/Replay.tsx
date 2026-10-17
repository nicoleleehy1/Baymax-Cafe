// Synchronized before/after playback: identical recorded customers, two Baymaxes
// (initial weights as a ghost, learned weights solid), both trails drawn on the floor.
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { BeforeAfter } from '../eval/runner';
import type { Frame } from '../sim/metrics';
import { SCENARIOS } from '../sim/scenarios';
import { controller } from '../state/controller';
import { BaymaxModel, type BaymaxPose } from './Baymax';
import { buildRibbons, lerpAngle } from './geom';
import { PersonModel, type PersonPose } from './Person';
import { useScreenLabel } from './labels';

export const REPLAY_COLORS = { before: '#ff7a59', after: '#2ec4b6' };

function frameAt(frames: Frame[], t: number): { a: Frame; b: Frame; f: number } {
  if (frames.length === 0) throw new Error('empty');
  const dt = frames.length > 1 ? frames[1].t - frames[0].t : 1;
  const k = Math.max(0, (t - frames[0].t) / dt);
  const i = Math.min(frames.length - 1, Math.floor(k));
  const j = Math.min(frames.length - 1, i + 1);
  return { a: frames[i], b: frames[j], f: Math.min(1, k - i) };
}

function robotPose(frames: Frame[], t: number): BaymaxPose {
  const { a, b, f } = frameAt(frames, t);
  return {
    pos: { x: a.robot.pos.x + (b.robot.pos.x - a.robot.pos.x) * f, y: a.robot.pos.y + (b.robot.pos.y - a.robot.pos.y) * f },
    heading: lerpAngle(a.robot.heading, b.robot.heading, f),
    vel: a.robot.vel,
    carrying: a.robot.carrying,
    lookAt: null,
    visible: true,
  };
}

export function ReplayScene({ result }: { result: BeforeAfter }) {
  const scenario = SCENARIOS[result.scenarioId];
  const trails = useMemo(() => {
    const g = new THREE.BufferGeometry();
    buildRibbons(g, [
      { pts: result.before.frames.filter((_, i) => i % 3 === 0).map((f) => f.robot.pos), width: 0.07, color: new THREE.Color(REPLAY_COLORS.before), y: 0.04 },
      { pts: result.after.frames.filter((_, i) => i % 3 === 0).map((f) => f.robot.pos), width: 0.07, color: new THREE.Color(REPLAY_COLORS.after), y: 0.042 },
    ]);
    return g;
  }, [result]);

  // The replay clock is a mutable object (not React state) advanced once per frame.
  useFrame((_, dt) => {
    const c = controller.replay;
    if (!c.playing) return;
    c.t = Math.min(c.duration, c.t + dt * c.speed);
    if (c.t >= c.duration) c.playing = false;
  });

  const tNow = (): number => controller.replay.t;
  const humanPose = (id: string) => (): PersonPose => {
    const { a, b, f } = frameAt(result.after.frames, tNow());
    const ha = a.humans.find((h) => h.id === id)!;
    const hb = b.humans.find((h) => h.id === id) ?? ha;
    return {
      pos: { x: ha.pos.x + (hb.pos.x - ha.pos.x) * f, y: ha.pos.y + (hb.pos.y - ha.pos.y) * f },
      facing: lerpAngle(ha.facing, hb.facing, f),
      state: ha.state,
      gait: ha.gait + (hb.gait - ha.gait) * f,
      visible: ha.visible,
    };
  };

  return (
    <group>
      <mesh geometry={trails}>
        <meshBasicMaterial vertexColors transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {scenario.customers.map((c, i) => (
        <PersonModel key={c.id} look={c.look} source={humanPose(c.id)} seed={i} />
      ))}
      <BaymaxModel source={() => robotPose(result.before.frames, tNow())} ghost tint={REPLAY_COLORS.before} opacity={0.45} />
      <BaymaxModel source={() => robotPose(result.after.frames, tNow())} />
      <ReplayTag frames={result.before.frames} label="Before teaching" color={REPLAY_COLORS.before} />
      <ReplayTag frames={result.after.frames} label="After teaching" color={REPLAY_COLORS.after} />
    </group>
  );
}

function ReplayTag({ frames, label, color }: { frames: Frame[]; label: string; color: string }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useScreenLabel('replay-tag', label, () => {
    const p = robotPose(frames, controller.replay.t).pos;
    return v.set(p.x, 2.35, p.y);
  }, { borderColor: color, color });
  return null;
}
