// Stylized procedural café customers (and Aunt Cass). Pose is driven by the simulated
// customer state: walking gait from actual displacement, seated pose, chat gestures.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '../core/vec';
import type { Look } from '../sim/customers';
import { headingToRotY } from './geom';

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

export function PersonModel({ look, source, apron = false, seed = 0 }: Props) {
  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const st = useRef({ t: seed * 1.7, sit: 0, fade: 1 });

  const m = useMemo(
    () => ({
      shirt: new THREE.MeshStandardMaterial({ color: look.shirt, roughness: 0.85 }),
      pants: new THREE.MeshStandardMaterial({ color: look.pants, roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.8 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#2b2522', roughness: 0.7 }),
      apron: new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.9 }),
    }),
    [look],
  );
  const h = look.height;

  useFrame((_, dt) => {
    const p = source();
    const g = root.current;
    if (!g) return;
    const s = st.current;
    s.t += dt;
    g.visible = p.visible;
    if (!p.visible) return;
    g.position.set(p.pos.x, 0, p.pos.y);
    g.rotation.y = headingToRotY(p.facing);
    const sitting = p.state === 'sitting';
    s.sit += ((sitting ? 1 : 0) - s.sit) * Math.min(1, dt * 5);
    const walking = p.state === 'walking' || p.state === 'entering' || p.state === 'leaving' || p.state === 'queueing';
    const swing = Math.sin(p.gait);
    const amp = walking ? 0.5 : 0;
    const sitDrop = s.sit * 0.42 * h;
    if (hips.current) hips.current.position.y = 0.88 * h - sitDrop + (walking ? Math.abs(Math.cos(p.gait)) * 0.02 : 0);
    if (legL.current && legR.current) {
      legL.current.rotation.x = -swing * amp - s.sit * 1.5;
      legR.current.rotation.x = swing * amp - s.sit * 1.5;
    }
    if (kneeL.current && kneeR.current) {
      kneeL.current.rotation.x = Math.max(0, swing) * amp * 0.6 + s.sit * 1.5;
      kneeR.current.rotation.x = Math.max(0, -swing) * amp * 0.6 + s.sit * 1.5;
    }
    const chatting = p.state === 'chatting';
    const gesture = chatting ? Math.max(0, Math.sin(s.t * 1.3 + seed)) * 0.7 : 0;
    if (armL.current) armL.current.rotation.x = swing * amp * 0.8 - gesture * 0.6 - s.sit * 0.5;
    if (armR.current) armR.current.rotation.x = -swing * amp * 0.8 - (p.state === 'ordering' ? 0.3 : 0) - s.sit * 0.5;
    if (torso.current) torso.current.rotation.x = p.state === 'browsing' ? 0.15 : s.sit * -0.05;
    if (head.current) {
      head.current.rotation.x = chatting ? Math.sin(s.t * 2.2 + seed) * 0.08 : p.state === 'browsing' ? 0.35 : 0;
      head.current.rotation.y = chatting ? Math.sin(s.t * 0.7 + seed) * 0.15 : 0;
    }
  });

  return (
    <group ref={root}>
      <group ref={hips} position={[0, 0.88 * h, 0]}>
        {/* legs: hip joint → thigh → knee joint → shin */}
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.09, 0, 0]}>
            <mesh position={[0, -0.21 * h, 0]} material={m.pants} castShadow>
              <capsuleGeometry args={[0.065, 0.3 * h, 6, 12]} />
            </mesh>
            <group ref={side < 0 ? kneeL : kneeR} position={[0, -0.43 * h, 0]}>
              <mesh position={[0, -0.2 * h, 0]} material={m.pants} castShadow>
                <capsuleGeometry args={[0.058, 0.3 * h, 6, 12]} />
              </mesh>
              <mesh position={[0, -0.42 * h, 0.04]} scale={[1, 0.6, 1.6]} material={m.shoe} castShadow>
                <sphereGeometry args={[0.06, 12, 8]} />
              </mesh>
            </group>
          </group>
        ))}
        <group ref={torso}>
          <mesh position={[0, 0.27 * h, 0]} material={m.shirt} castShadow>
            <capsuleGeometry args={[0.16, 0.34 * h, 8, 16]} />
          </mesh>
          {apron && (
            <mesh position={[0, 0.2 * h, 0.13]} material={m.apron} castShadow>
              <boxGeometry args={[0.27, 0.42 * h, 0.04]} />
            </mesh>
          )}
          {([-1, 1] as const).map((side) => (
            <group key={side} ref={side < 0 ? armL : armR} position={[side * 0.21, 0.5 * h, 0]} rotation={[0, 0, side * 0.08]}>
              <mesh position={[0, -0.24 * h, 0]} material={m.shirt} castShadow>
                <capsuleGeometry args={[0.05, 0.36 * h, 6, 12]} />
              </mesh>
              <mesh position={[0, -0.47 * h, 0]} material={m.skin}>
                <sphereGeometry args={[0.048, 12, 8]} />
              </mesh>
            </group>
          ))}
          <group ref={head} position={[0, 0.66 * h, 0]}>
            <mesh position={[0, 0.06, 0]} material={m.skin} castShadow>
              <sphereGeometry args={[0.12, 24, 16]} />
            </mesh>
            <Hair style={look.hairStyle} mat={m.hair} accent={look.shirt} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Hair({ style, mat, accent }: { style: Look['hairStyle']; mat: THREE.Material; accent: string }) {
  switch (style) {
    case 'bun':
      return (
        <group>
          <mesh position={[0, 0.1, -0.015]} scale={[1.05, 0.8, 1.05]} material={mat}>
            <sphereGeometry args={[0.122, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.2, -0.06]} material={mat}>
            <sphereGeometry args={[0.06, 14, 10]} />
          </mesh>
        </group>
      );
    case 'long':
      return (
        <group>
          <mesh position={[0, 0.09, -0.01]} scale={[1.08, 0.9, 1.08]} material={mat}>
            <sphereGeometry args={[0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, -0.02, -0.07]} material={mat}>
            <boxGeometry args={[0.24, 0.24, 0.08]} />
          </mesh>
        </group>
      );
    case 'cap':
      return (
        <group>
          <mesh position={[0, 0.11, 0]} scale={[1.06, 0.7, 1.06]}>
            <sphereGeometry args={[0.125, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.12, 0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.18, 0.015, 0.1]} />
            <meshStandardMaterial color={accent} roughness={0.8} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh position={[0, 0.1, -0.01]} scale={[1.06, 0.75, 1.06]} material={mat}>
          <sphereGeometry args={[0.124, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      );
  }
}
