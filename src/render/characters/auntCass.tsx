// Aunt Cass: warm café owner. Short wavy auburn bob, green cardigan under a cream apron,
// bright eyes and a big grin; lively, and waves at customers while idle.
import { HairBowl, partialLathe, type CharacterSpec, type Kit } from './rig';
import { PALETTE } from '../style/shapes';

const HAIR = '#8a4b2a';

const APRON = partialLathe(
  [
    [0.214, 0.3],
    [0.218, 0.4],
    [0.212, 0.5],
    [0.198, 0.6],
    [0.17, 0.66],
  ],
  -0.95,
  1.9,
);

function Hair(k: Kit) {
  const m = k.mat(HAIR, { roughness: 0.7, sheen: 0.4 });
  // wavy fringe: a row of soft curls along the hairline
  const curls = [-0.12, -0.06, 0, 0.06, 0.12];
  return (
    <group>
      <HairBowl kit={k} color={HAIR} />
      {/* bob volume: back and both sides, rounding out just below the ears */}
      <mesh geometry={k.geo.ball} material={m} position={[0, 0.0, -0.075]} scale={[0.205, 0.19, 0.16]} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={k.geo.ball} material={m} position={[s * 0.165, -0.05, -0.02]} scale={[0.075, 0.11, 0.12]} castShadow />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`c${s}`} geometry={k.geo.ball} material={m} position={[s * 0.175, -0.13, 0.0]} scale={0.05} castShadow />
      ))}
      {curls.map((x, i) => (
        <mesh key={x} geometry={k.geo.ball} material={m} position={[x, 0.15 - Math.abs(x) * 0.35 + (i % 2) * 0.008, 0.125 - Math.abs(x) * 0.25]} scale={[0.048, 0.04, 0.04]} />
      ))}
    </group>
  );
}

function Apron(k: Kit) {
  return (
    <group scale={[k.girth, 1, k.girth]}>
      <mesh geometry={APRON} material={k.mat(PALETTE.cream)} castShadow />
      {/* waist tie and a terracotta pocket */}
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} material={k.mat(PALETTE.creamShade)}>
        <torusGeometry args={[0.212, 0.009, 8, 48]} />
      </mesh>
      <mesh geometry={k.geo.capsule} material={k.mat(PALETTE.terracotta)} position={[0, 0.41, 0.214]} rotation={[0, 0, Math.PI / 2]} scale={[0.035, 0.12, 0.008]} />
    </group>
  );
}

export const AUNT_CASS: CharacterSpec = {
  id: 'aunt-cass',
  name: 'Aunt Cass',
  height: 0.98,
  girth: 1.06,
  colors: { skin: '#f2c7a6', top: PALETTE.greenDeep, bottom: '#6b4a3a', shoe: PALETTE.woodDark, hair: HAIR, cheek: '#f29a8a' },
  top: 'sweater',
  eyes: 'bright',
  mouth: 'grin',
  brows: 0.08,
  energy: 1.15,
  waves: true,
  head: Hair,
  body: Apron,
};
