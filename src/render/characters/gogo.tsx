// Go Go Tomago: compact and cool. Choppy black bob with a purple streak, black leather
// jacket with a yellow stripe, sharp eyes, a flat mouth and a bubble of gum that slowly
// inflates and pops. Calm, minimal fidgeting.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { HairBowl, Lock, faceZ, partialLathe, type CharacterSpec, type Kit } from './rig';
import { PALETTE } from '../style/shapes';

const HAIR = '#1d1a20';
const STREAK = '#8c5bb5';
const JACKET = '#2f2c33';

const JACKET_SHELL = partialLathe(
  [
    [0.214, 0.37],
    [0.216, 0.42],
    [0.214, 0.5],
    [0.198, 0.6],
    [0.162, 0.68],
    [0.1, 0.725],
  ],
  0.42,
  Math.PI * 2 - 0.84,
);
const STRIPE = partialLathe(
  [
    [0.219, 0.555],
    [0.218, 0.575],
  ],
  0.42,
  Math.PI * 2 - 0.84,
  4,
);

// choppy fringe swept to one side, side pieces down past the ears, one purple lock
const LOCKS: [number, number, number, number, [number, number, number], string?][] = [
  [0.6, 0.45, 0.09, 0.05, [0.3, -0.8, 0.4]],
  [0.58, 0.15, 0.1, 0.05, [0.4, -0.8, 0.5]],
  [0.6, -0.15, 0.1, 0.05, [0.5, -0.8, 0.5]],
  [0.65, -0.5, 0.09, 0.05, [0.4, -0.9, 0.3], STREAK],
  [1.0, 1.35, 0.11, 0.05, [0, -1.0, 0]],
  [1.0, -1.35, 0.11, 0.05, [0, -1.0, 0]],
  [1.15, 2.0, 0.1, 0.05, [0, -1.0, 0]],
  [1.15, -2.0, 0.1, 0.05, [0, -1.0, 0]],
  [1.2, 2.7, 0.09, 0.055, [0, -1.0, 0]],
  [1.2, -2.7, 0.09, 0.055, [0, -1.0, 0]],
];

function Hair(k: Kit) {
  return (
    <group>
      <HairBowl kit={k} color={HAIR} tilt={-0.5} scale={[1.02, 1.04, 1.04]} />
      {LOCKS.map(([t, p, l, w, b, c], i) => (
        <Lock key={i} kit={k} color={c ?? HAIR} theta={t} phi={p} length={l} width={w} bias={b} />
      ))}
      <GumBubble k={k} />
    </group>
  );
}

/** Pink gum: inflates over a few seconds, pops, rests, repeats. */
function GumBubble({ k }: { k: Kit }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(1.3);
  useFrame((_, dt) => {
    t.current = (t.current + Math.min(dt, 0.05)) % 6;
    const u = t.current;
    const r = u < 3.2 ? 0.006 + 0.044 * (u / 3.2) ** 1.6 : 0;
    if (ref.current) {
      ref.current.visible = r > 0;
      ref.current.scale.setScalar(Math.max(r, 1e-4));
      ref.current.position.set(0.01, -0.066, faceZ(0.01, -0.066) + r * 0.85);
    }
  });
  return <mesh ref={ref} geometry={k.geo.ball} material={k.mat('#f08fb0', { roughness: 0.35, sheen: 0.6 })} />;
}

function Jacket(k: Kit) {
  const m = k.mat(JACKET, { roughness: 0.45, sheen: 0.3 });
  return (
    <group scale={[k.girth, 1, k.girth]}>
      <mesh geometry={JACKET_SHELL} material={m} castShadow />
      <mesh geometry={STRIPE} material={k.mat(PALETTE.butter)} />
      {/* popped collar */}
      <mesh position={[0, 0.72, -0.01]} rotation={[Math.PI / 2 - 0.25, 0, 0]} material={m}>
        <torusGeometry args={[0.1, 0.022, 10, 28, Math.PI * 1.4]} />
      </mesh>
    </group>
  );
}

export const GO_GO: CharacterSpec = {
  id: 'go-go',
  name: 'Go Go Tomago',
  height: 0.92,
  girth: 0.9,
  colors: { skin: '#efc8a2', top: '#45434d', sleeve: JACKET, bottom: '#3c3f4a', shoe: PALETTE.ink, hair: HAIR },
  top: 'tee',
  eyes: 'sharp',
  mouth: 'flat',
  brows: 0.3,
  energy: 0.65,
  head: Hair,
  body: Jacket,
};
