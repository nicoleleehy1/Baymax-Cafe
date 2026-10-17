// Hiro: the youngest. Small, big head, messy black spikes, open grey hoodie over a red tee,
// cargo shorts and red sneakers; restless, looks around a lot.
import { HairBowl, Lock, partialLathe, type CharacterSpec, type Kit } from './rig';
import { PALETTE } from '../style/shapes';

const HAIR = '#211b1d';
const TEE = '#c8574a';

// the tee shows through the open hoodie front
const TEE_PANEL = partialLathe(
  [
    [0.207, 0.38],
    [0.21, 0.45],
    [0.2, 0.57],
    [0.165, 0.67],
    [0.11, 0.715],
  ],
  -0.5,
  1.0,
);

// [theta, phi, length, width, bias]: crown spikes, a back flick and a fringe that falls forward
const SPIKES: [number, number, number, number, [number, number, number]?][] = [
  [0.15, 0, 0.1, 0.05],
  [0.35, 0.9, 0.09, 0.05],
  [0.35, -0.9, 0.09, 0.05],
  [0.45, 2.0, 0.1, 0.055],
  [0.45, -2.0, 0.1, 0.055],
  [0.5, Math.PI, 0.11, 0.06, [0, 0.3, 0]],
  [0.85, 2.6, 0.09, 0.05, [0, -0.4, 0]],
  [0.85, -2.6, 0.09, 0.05, [0, -0.4, 0]],
  [0.95, 1.55, 0.07, 0.045, [0, -0.6, 0]],
  [0.95, -1.55, 0.07, 0.045, [0, -0.6, 0]],
  [0.55, 0.35, 0.09, 0.05, [0, -0.5, 0.6]],
  [0.55, -0.3, 0.085, 0.05, [0.2, -0.6, 0.6]],
  [0.6, 0.0, 0.08, 0.05, [-0.1, -0.7, 0.6]],
];

function Hair(k: Kit) {
  return (
    <group>
      <HairBowl kit={k} color={HAIR} />
      {SPIKES.map(([t, p, l, w, b], i) => (
        <Lock key={i} kit={k} color={HAIR} theta={t} phi={p} length={l} width={w} bias={b} />
      ))}
    </group>
  );
}

function Tee(k: Kit) {
  return (
    <group scale={[k.girth, 1, k.girth]}>
      <mesh geometry={TEE_PANEL} material={k.mat(TEE)} />
      {/* hoodie drawstrings */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={k.geo.capsule} material={k.mat(PALETTE.cream)} position={[s * 0.07, 0.63, 0.165]} rotation={[0.35, 0, 0]} scale={[0.006, 0.1, 0.006]} />
      ))}
    </group>
  );
}

export const HIRO: CharacterSpec = {
  id: 'hiro',
  name: 'Hiro',
  height: 0.86,
  girth: 0.94,
  headSize: 1.06,
  colors: { skin: '#e9b892', top: '#8a8d93', bottom: '#9f8a68', shoe: TEE, hair: HAIR, shin: '#e9b892' },
  top: 'hoodie',
  eyes: 'bright',
  mouth: 'smirk',
  brows: 0.12,
  energy: 1.45,
  head: Hair,
  body: Tee,
};
