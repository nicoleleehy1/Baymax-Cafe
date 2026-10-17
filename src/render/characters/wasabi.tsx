// Wasabi: the tallest and broadest, gentle and tidy. Dreadlocks tied back in a bundle with
// a green band, a neat green shirt with a pocket, khaki trousers; calm, deliberate motion.
import { HairBowl, headPoint, type CharacterSpec, type Kit } from './rig';
import { PALETTE } from '../style/shapes';
import * as THREE from 'three';

const HAIR = '#2a1e1a';

function Hair(k: Kit) {
  const m = k.mat(HAIR, { roughness: 0.75, sheen: 0.35 });
  const tie = headPoint(1.25, Math.PI, 1.02);
  // locks fan from the tie and hang down the back of the neck
  const locks = [-0.06, -0.03, 0, 0.03, 0.06, -0.045, 0.045];
  return (
    <group>
      <HairBowl kit={k} color={HAIR} tilt={-0.55} scale={[1.0, 1.02, 1.02]} />
      {/* rows of short twists over the crown */}
      {[0.3, 0.6, 0.9].flatMap((t, r) =>
        [-1.6, -0.8, 0, 0.8, 1.6, 2.4, -2.4, Math.PI].map((p, i) => {
          const q = headPoint(t, p + r * 0.4, 1.05);
          return <mesh key={`${r}-${i}`} geometry={k.geo.ball} material={m} position={q} scale={0.032} />;
        }),
      )}
      <mesh position={tie} rotation={[0.3, 0, 0]} material={k.mat(PALETTE.green)}>
        <torusGeometry args={[0.035, 0.012, 8, 20]} />
      </mesh>
      {locks.map((x, i) => {
        const len = 0.16 + (i % 3) * 0.02;
        return (
          <mesh
            key={i}
            geometry={k.geo.capsule}
            material={m}
            position={new THREE.Vector3(tie.x + x, tie.y - len / 2 - 0.01, tie.z - 0.03 - Math.abs(x) * 0.3)}
            rotation={[-0.35, 0, x * 2.2]}
            scale={[0.016, len, 0.016]}
            castShadow
          />
        );
      })}
    </group>
  );
}

function Shirt(k: Kit) {
  return (
    <group scale={[k.girth, 1, k.girth]}>
      {/* button placket and a chest pocket */}
      <mesh geometry={k.geo.capsule} material={k.mat('#4d6e51')} position={[0, 0.54, 0.205]} scale={[0.008, 0.25, 0.006]} />
      <mesh geometry={k.geo.capsule} material={k.mat('#4d6e51')} position={[0.09, 0.6, 0.19]} rotation={[-0.25, 0.35, Math.PI / 2]} scale={[0.028, 0.07, 0.006]} />
    </group>
  );
}

export const WASABI: CharacterSpec = {
  id: 'wasabi',
  name: 'Wasabi',
  height: 1.14,
  girth: 1.2,
  colors: { skin: '#7b4f35', top: PALETTE.greenDeep, bottom: '#b8a27a', shoe: '#5a4535', hair: HAIR, cheek: '#c97b6a' },
  top: 'shirt',
  eyes: 'round',
  mouth: 'smile',
  brows: 0.05,
  energy: 0.55,
  head: Hair,
  body: Shirt,
};
