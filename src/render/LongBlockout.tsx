// 3D blockout of the long café, generated directly from the shared layout obstacles so the
// rendered footprints are exactly the navigation footprints. Dollhouse cutaway: the near
// (window) wall and the far counter are kept low so Baymax and the choices stay visible.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Obstacle } from '../world/layoutTypes';
import { LAYOUT } from '../world/layout';
import { PALETTE, softMat } from './style/shapes';

const HEIGHT: Record<string, number> = {
  kitchen: 1.0, galley: 0.95, counter: 0.95, restroom: 1.2, bench: 0.42, booth: 0.62, communal: 0.62,
  squareTable: 0.62, table: 0.62, chair: 0.38, post: 1.3, plant: 0.9,
};
const COLOR: Record<string, string> = {
  kitchen: PALETTE.creamShade, galley: PALETTE.woodDark, counter: PALETTE.wood, restroom: '#d8d1c4', bench: PALETTE.wood,
  booth: PALETTE.woodLight, communal: PALETTE.woodLight, squareTable: PALETTE.woodLight, table: PALETTE.woodLight,
  chair: PALETTE.terracottaSoft, post: '#8a6a52', plant: PALETTE.green,
};

export function LongBlockout() {
  const mats = useMemo(() => {
    const m: Record<string, THREE.Material> = {};
    for (const [k, c] of Object.entries(COLOR)) m[k] = softMat(c, { roughness: 0.85 });
    m.wall = softMat(PALETTE.cream, { roughness: 0.95 });
    m.floorA = new THREE.MeshStandardMaterial({ color: '#e9dcc6', roughness: 0.9 });
    m.floorB = new THREE.MeshStandardMaterial({ color: '#dccbb0', roughness: 0.9 });
    return m;
  }, []);
  const R = LAYOUT.room;
  const checker = useMemo(() => {
    // soft, low-contrast checkered floor (from the reference plan)
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        g.fillStyle = (i + j) % 2 ? '#e6d6bd' : '#efe4d1';
        g.fillRect(i * 32, j * 32, 32, 32);
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set((R.maxX - R.minX) / 4, (R.maxY - R.minY) / 4);
    return t;
  }, [R]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(R.minX + R.maxX) / 2, 0, (R.minY + R.maxY) / 2]} receiveShadow>
        <planeGeometry args={[R.maxX - R.minX + 2, R.maxY - R.minY + 2]} />
        <meshStandardMaterial map={checker} roughness={0.9} />
      </mesh>
      {LAYOUT.walls.map((w, i) => {
        const dx = w.b.x - w.a.x;
        const dy = w.b.y - w.a.y;
        const L = Math.hypot(dx, dy);
        // dollhouse: far walls full height, near (window) side and front walls kept low
        const near = (w.a.y + w.b.y) / 2 > 2 || (w.a.x + w.b.x) / 2 > 7.5;
        const h = near ? 0.35 : 2.8;
        return (
          <mesh key={i} position={[(w.a.x + w.b.x) / 2, h / 2, (w.a.y + w.b.y) / 2]} rotation={[0, -Math.atan2(dy, dx), 0]} material={mats.wall} castShadow receiveShadow>
            <boxGeometry args={[L + 0.15, h, 0.15]} />
          </mesh>
        );
      })}
      {LAYOUT.obstacles.map((o) => (
        <ObstacleMesh key={o.id} o={o} mat={mats[o.visual] ?? mats.wall} />
      ))}
    </group>
  );
}

function ObstacleMesh({ o, mat }: { o: Obstacle; mat: THREE.Material }) {
  const h = HEIGHT[o.visual] ?? 0.6;
  if (o.kind === 'rect') {
    const w = o.max.x - o.min.x;
    const d = o.max.y - o.min.y;
    return (
      <mesh position={[(o.min.x + o.max.x) / 2, h / 2, (o.min.y + o.max.y) / 2]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
    );
  }
  return (
    <mesh position={[o.c.x, h / 2, o.c.y]} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[o.r, o.r, h, 32]} />
    </mesh>
  );
}
