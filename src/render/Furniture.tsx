// Storybook furniture prototype: rounded-rim tabletop, flared pedestal, soft chairs with a
// curved back, puffy cushion and gently splayed legs. Proportioned for the café customers.
import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { headingToRotY } from './geom';
import { PALETTE, softMat, splineLathe } from './style/shapes';

export const TABLE_TOP_Y = 0.62;
export const CHAIR_SEAT_Y = 0.38;
// shape plane → horizontal arc, extrusion → vertical; bulge faces the chair's back (−Z)
const BACK_ROT = new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0, 'YXZ');

export function useFurnitureKit() {
  return useMemo(() => {
    const top = splineLathe([[0, 0.585], [0.4, 0.585], [0.44, 0.59], [0.458, 0.603], [0.452, 0.616], [0.43, 0.623], [0, 0.624]], 40, 64);
    const pedestal = splineLathe([[0, 0.0], [0.24, 0.0], [0.255, 0.018], [0.2, 0.04], [0.08, 0.075], [0.045, 0.16], [0.042, 0.45], [0.06, 0.55], [0.13, 0.585], [0, 0.586]], 60, 40);
    // curved chair back: an arc-shaped slab, extruded and beveled
    const arc = new THREE.Shape();
    const R = 0.27;
    const T = 0.035;
    const a0 = -0.85;
    const a1 = 0.85;
    arc.absarc(0, 0, R, a0, a1, false);
    arc.absarc(0, 0, R - T, a1, a0, true);
    const back = new THREE.ExtrudeGeometry(arc, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 32 });
    back.translate(0, 0, -0.1);
    back.computeVertexNormals();
    back;
    const leg = splineLathe([[0, -0.012], [0.018, -0.008], [0.019, 0.02], [0.022, 0.2], [0.026, CHAIR_SEAT_Y - 0.03], [0, CHAIR_SEAT_Y - 0.02]], 30, 16);
    const mats = {
      woodLight: softMat(PALETTE.woodLight, { roughness: 0.62, sheen: 0.15 }),
      wood: softMat(PALETTE.wood, { roughness: 0.65, sheen: 0.1 }),
      woodDark: softMat(PALETTE.woodDark, { roughness: 0.7, sheen: 0.1 }),
      cushion: softMat(PALETTE.terracottaSoft, { roughness: 0.95, sheen: 0.6 }),
      cushionAlt: softMat(PALETTE.green, { roughness: 0.95, sheen: 0.6 }),
      metal: softMat('#5b4a40', { roughness: 0.5 }),
    };
    return { top, pedestal, back, leg, mats };
  }, []);
}

type Kit = ReturnType<typeof useFurnitureKit>;

export function StoryTable({ kit, x, z }: { kit: Kit; x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={kit.top} material={kit.mats.woodLight} castShadow receiveShadow />
      <mesh geometry={kit.pedestal} material={kit.mats.woodDark} castShadow receiveShadow />
      {/* tiny vase + flower */}
      <mesh position={[0.13, TABLE_TOP_Y + 0.04, -0.1]} castShadow>
        <cylinderGeometry args={[0.025, 0.032, 0.08, 20]} />
        <meshStandardMaterial color={PALETTE.cream} roughness={0.5} />
      </mesh>
      <mesh position={[0.13, TABLE_TOP_Y + 0.105, -0.1]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshStandardMaterial color={PALETTE.blush} roughness={0.9} />
      </mesh>
    </group>
  );
}

export function StoryChair({ kit, x, z, facing, alt = false }: { kit: Kit; x: number; z: number; facing: number; alt?: boolean }) {
  const splay = 0.07;
  return (
    <group position={[x, 0, z]} rotation={[0, headingToRotY(facing), 0]}>
      <RoundedBox args={[0.38, 0.05, 0.36]} radius={0.022} smoothness={4} position={[0, CHAIR_SEAT_Y - 0.025, 0]} material={kit.mats.wood} castShadow receiveShadow />
      <RoundedBox args={[0.33, 0.05, 0.31]} radius={0.024} smoothness={5} position={[0, CHAIR_SEAT_Y + 0.02, 0.01]} scale={[1, 0.9, 1]} material={alt ? kit.mats.cushionAlt : kit.mats.cushion} castShadow receiveShadow />
      {/* curved back rest (centre of curvature in front of the seat) */}
      <mesh geometry={kit.back} material={kit.mats.wood} position={[0, CHAIR_SEAT_Y + 0.24, 0.1]} rotation={BACK_ROT} castShadow receiveShadow />
      {[-1, 1].map((sx) => (
        <mesh key={`p${sx}`} position={[sx * 0.15, CHAIR_SEAT_Y + 0.08, -0.155]} rotation={[-0.12, 0, 0]} material={kit.mats.wood} castShadow>
          <cylinderGeometry args={[0.018, 0.02, 0.2, 12]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={kit.leg} material={kit.mats.woodDark} position={[sx * 0.14, 0, sz * 0.13]} rotation={[sz * splay, 0, -sx * splay]} castShadow />
        )),
      )}
    </group>
  );
}
