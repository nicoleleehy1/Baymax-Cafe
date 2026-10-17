// Fred: lanky and laid back. Slouchy olive beanie over shaggy blond hair, a blue tee with
// a little green monster on it, shorts and white sneakers; sleepy eyes and a wide grin.
import { Lock, type CharacterSpec, type Kit } from './rig';
import * as THREE from 'three';

const HAIR = '#c99a5a';
const BEANIE = '#6f7f5e';
const MONSTER = '#7fb07a';
const SKIN = '#f0caa6';

const DOME = new THREE.SphereGeometry(0.228, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56);

function Head(k: Kit) {
  const b = k.mat(BEANIE, { roughness: 0.9, sheen: 0.3 });
  // shaggy hair pokes out under the cuff all round, longest at the back
  const locks: [number, number, number][] = [
    [1.45, 0.06, 0.05],
    [1.75, 0.08, 0.05],
    [2.1, 0.09, 0.055],
    [2.5, 0.09, 0.055],
    [Math.PI, 0.1, 0.06],
  ];
  return (
    <group>
      {locks.flatMap(([p, l, w]) =>
        (p === Math.PI ? [1] : [-1, 1]).map((s) => <Lock key={`${p}${s}`} kit={k} color={HAIR} theta={1.12} phi={p * s} length={l} width={w} bias={[0, -1.1, 0]} />),
      )}
      <Lock kit={k} color={HAIR} theta={0.95} phi={0.55} length={0.07} width={0.045} bias={[0.2, -1.0, 0.3]} />
      <Lock kit={k} color={HAIR} theta={0.95} phi={-0.45} length={0.06} width={0.045} bias={[-0.2, -1.0, 0.3]} />
      {/* slouchy beanie: tilted back, slightly droopy crown, folded cuff */}
      <group rotation={[-0.42, 0, 0]} position={[0, 0.012, -0.01]}>
        <mesh geometry={DOME} material={b} scale={[1, 1.18, 1.04]} castShadow />
        <mesh position={[0, 0.228 * Math.cos(Math.PI * 0.56) * 1.18 + 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={b} scale={[1, 1.04, 1]}>
          <torusGeometry args={[0.226 * Math.sin(Math.PI * 0.56), 0.026, 10, 48]} />
        </mesh>
      </group>
    </group>
  );
}

function Tee(k: Kit) {
  const g = k.mat(MONSTER);
  return (
    <group scale={[k.girth, 1, k.girth]} position={[0, 0.555, 0.2]}>
      {/* the monster: a round green face with two eyes and little horns */}
      <mesh geometry={k.geo.ball} material={g} scale={[0.055, 0.05, 0.012]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={k.geo.ball} material={k.white} position={[s * 0.02, 0.01, 0.01]} scale={[0.012, 0.014, 0.004]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} geometry={k.geo.cone} material={g} position={[s * 0.035, 0.055, 0]} rotation={[0, 0, -s * 0.4]} scale={[0.012, 0.03, 0.008]} />
      ))}
      <mesh geometry={k.geo.capsule} material={k.ink} position={[0, -0.018, 0.011]} rotation={[0, 0, Math.PI / 2]} scale={[0.004, 0.04, 0.003]} />
    </group>
  );
}

export const FRED: CharacterSpec = {
  id: 'fred',
  name: 'Fred',
  height: 1.06,
  girth: 0.95,
  colors: { skin: SKIN, top: '#5f86a6', bottom: '#8a6a4a', shoe: '#ece6d8', hair: HAIR, shin: SKIN },
  top: 'tee',
  eyes: 'sleepy',
  mouth: 'grin',
  brows: -0.05,
  energy: 0.8,
  head: Head,
  body: Tee,
};
