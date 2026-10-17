// 3D long café, generated directly from the shared layout obstacles so the rendered
// footprints are exactly the navigation footprints. Dollhouse cutaway: the near
// (window) wall and the far counter are kept low so Baymax and the choices stay visible.
import { useMemo } from 'react';
import * as THREE from 'three';
import { LAYOUT } from '../world/layout';
import { PALETTE, softMat } from './style/shapes';
import { LongProps } from './LongProps';
import { RUG } from '../world/layouts/long';

export function LongBlockout() {
  const mats = useMemo(() => {
    const m: Record<string, THREE.Material> = {};
    m.wall = softMat(PALETTE.cream, { roughness: 0.95 });
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
      {/* rug by the front window */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(RUG.min.x + RUG.max.x) / 2, 0.006, (RUG.min.y + RUG.max.y) / 2]} receiveShadow>
        <planeGeometry args={[RUG.max.x - RUG.min.x, RUG.max.y - RUG.min.y]} />
        <meshStandardMaterial color="#c9a27a" roughness={1} />
      </mesh>
      <LongProps obstacles={LAYOUT.obstacles} />
    </group>
  );
}
