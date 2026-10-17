// Honey Lemon: tall and sunny. Long honey-blonde hair with a loose bun and side-swept
// bangs, big round pink glasses, a pink dress, yellow shoes and a little yellow bag;
// the most energetic of the group and waves often.
import { HairBowl, Lock, faceZ, type CharacterSpec, type Kit } from './rig';
import { PALETTE } from '../style/shapes';

const HAIR = '#d9a24e';
const FRAME = '#c94f7c';
const SKIN = '#f3cfb0';

function Hair(k: Kit) {
  const m = k.mat(HAIR, { roughness: 0.65, sheen: 0.5 });
  return (
    <group>
      <HairBowl kit={k} color={HAIR} />
      {/* long fall down the back, past the shoulders */}
      <mesh geometry={k.geo.hairBack} material={m} rotation={[0.05, Math.PI, 0]} position={[0, -0.05, -0.01]} scale={[1.02, 1.45, 1.0]} castShadow />
      <mesh geometry={k.geo.ball} material={m} position={[0, 0.2, -0.13]} scale={0.072} castShadow />
      {/* long strands falling in front of the shoulders */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={k.geo.capsule} material={m} position={[s * 0.185, -0.12, -0.03]} rotation={[0.1, 0, s * 0.12]} scale={[0.05, 0.3, 0.055]} castShadow />
      ))}
      {/* side-swept bangs */}
      <Lock kit={k} color={HAIR} theta={0.55} phi={-0.25} length={0.12} width={0.055} bias={[0.8, -0.6, 0.4]} />
      <Lock kit={k} color={HAIR} theta={0.6} phi={0.1} length={0.1} width={0.05} bias={[0.8, -0.6, 0.4]} />
      <Glasses k={k} />
    </group>
  );
}

function Glasses({ k }: { k: Kit }) {
  const m = k.mat(FRAME, { roughness: 0.4, sheen: 0.4 });
  const y = 0.005;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.07, y, faceZ(s * 0.07, y) + 0.012]} rotation={[0, s * 0.3, 0]} material={m}>
          <torusGeometry args={[0.043, 0.0065, 10, 32]} />
        </mesh>
      ))}
      <mesh position={[0, y + 0.012, faceZ(0, y) + 0.012]} rotation={[0, 0, Math.PI / 2]} material={m}>
        <torusGeometry args={[0.014, 0.005, 6, 12, Math.PI]} />
      </mesh>
    </group>
  );
}

function Bag(k: Kit) {
  return (
    <group scale={[k.girth, 1, k.girth]}>
      <mesh geometry={k.geo.capsule} material={k.mat(PALETTE.butter)} position={[0.235, 0.36, 0.03]} rotation={[0, Math.PI / 2, Math.PI / 2]} scale={[0.04, 0.1, 0.025]} castShadow />
      {/* strap across the chest */}
      <mesh position={[0.02, 0.55, 0.0]} rotation={[0, Math.PI / 2, -0.75]} scale={[1.05, 1.22, 1]} material={k.mat('#d9a95f')}>
        <torusGeometry args={[0.215, 0.006, 6, 48, Math.PI]} />
      </mesh>
    </group>
  );
}

export const HONEY_LEMON: CharacterSpec = {
  id: 'honey-lemon',
  name: 'Honey Lemon',
  height: 1.1,
  girth: 0.9,
  colors: { skin: SKIN, top: '#ec8fa0', bottom: '#ec8fa0', shoe: PALETTE.butter, hair: HAIR, thigh: SKIN, shin: SKIN },
  top: 'dress',
  eyes: 'bright',
  mouth: 'open',
  brows: -0.08,
  energy: 1.6,
  waves: true,
  head: Hair,
  body: Bag,
};
