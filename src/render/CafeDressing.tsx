// The original Lucky Cat Café look, applied to the traced ground floor: plank floor, the red
// "Lucky Cat Café" sign and chalkboard menu on the wall behind the counter, a green wainscot,
// warm pendant light pools over the tables and sun shafts from the window side.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { LayoutDef } from '../world/layoutTypes';

function seeded(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** Warm oak planks, as in the original café. */
export function plankTexture(repeatX: number, repeatY: number): THREE.CanvasTexture {
  return canvasTexture(
    (ctx, w, h) => {
      const rows = 16;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -((r * 97) % 180);
        let i = 0;
        while (x < w) {
          const pw = 160 + seeded(r * 31 + i) * 140;
          const l = 52 + seeded(r * 17 + i * 3) * 10;
          ctx.fillStyle = `hsl(30, 42%, ${l}%)`;
          ctx.fillRect(x, r * rh, pw, rh);
          ctx.fillStyle = 'rgba(80,45,20,0.10)';
          for (let k = 0; k < 6; k++) ctx.fillRect(x + seeded(r + i + k) * pw, r * rh + 2, 1 + seeded(k + i) * 2, rh - 4);
          ctx.fillStyle = 'rgba(60,35,15,0.55)';
          ctx.fillRect(x, r * rh, 2, rh);
          x += pw;
          i++;
        }
        ctx.fillStyle = 'rgba(60,35,15,0.45)';
        ctx.fillRect(0, r * rh, w, 2);
      }
    },
    1024,
    1024,
    [repeatX, repeatY],
  );
}

function menuTexture(): THREE.CanvasTexture {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#2f3a33';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#c9a46a';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#f3ead8';
      ctx.font = 'bold 64px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Café Menu', w / 2, 96);
      ctx.font = '38px Nunito, sans-serif';
      const items = [
        ['Latte', '4.50'],
        ['Cocoa', '3.75'],
        ['Espresso', '3.00'],
        ['Matcha', '4.75'],
        ['Hot-wing donut', '2.50'],
      ];
      items.forEach(([a, b], i) => {
        ctx.textAlign = 'left';
        ctx.fillText(a, 60, 170 + i * 60);
        ctx.textAlign = 'right';
        ctx.fillText(b, w - 60, 170 + i * 60);
      });
    },
    640,
    512,
  );
}

function signTexture(): THREE.CanvasTexture {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#b8413a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe9c4';
      ctx.font = 'bold 92px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Lucky Cat Café', w / 2, h / 2 + 4);
    },
    1024,
    180,
  );
}

function shaftTexture(): THREE.CanvasTexture {
  return canvasTexture(
    (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,230,180,0.55)');
      g.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 256);
    },
    64,
    256,
  );
}

/**
 * Dressing for the traced café. `wall` is the interior wall the sign hangs on (the galley
 * partition behind the pastry cases): a segment along x plus the side (±y) it faces.
 */
/** Pendant pools over the tables and sun shafts from the window side: the warm look for any storey. */
export function WarmLighting({ def }: { def: LayoutDef }) {
  const tex = useMemo(() => shaftTexture(), []);
  const R = def.room;
  return (
    <group>
      {def.tables
        .filter((t) => t.seats.length > 0)
        .map((t, i) => (
          <group key={t.id} position={[t.c.x, 0, t.c.y]}>
            <mesh position={[0, 2.38, 0]}>
              <sphereGeometry args={[0.06, 12, 8]} />
              <meshBasicMaterial color="#ffe1a8" />
            </mesh>
            {i % 2 === 0 && <pointLight position={[0, 2.25, 0]} intensity={2.2} distance={4.5} decay={2} color="#ffcf8a" />}
          </group>
        ))}
      {[-5.5, -1.5, 2.5, 6.0].map((x) => (
        <mesh key={x} position={[x, 1.3, R.maxY - 1.9]} rotation={[0.95, 0, 0]}>
          <planeGeometry args={[1.6, 3.6]} />
          <meshBasicMaterial map={tex} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function LongCafeDressing({ def, wall }: { def: LayoutDef; wall: { a: { x: number; y: number }; b: { x: number; y: number }; face: 1 | -1 } }) {
  const tex = useMemo(() => ({ menu: menuTexture(), sign: signTexture() }), []);
  // the wall runs along x (constant y) and its signage faces `face` along y: toward the camera
  const wy = wall.a.y + wall.face * 0.09;
  const xmid = (wall.a.x + wall.b.x) / 2;
  const wallLen = Math.abs(wall.b.x - wall.a.x);
  const rotY = wall.face > 0 ? 0 : Math.PI;
  return (
    <group>
      {/* green wainscot on the sign wall */}
      <mesh position={[xmid, 0.5, wy - wall.face * 0.04]} rotation={[0, rotY, 0]}>
        <planeGeometry args={[wallLen, 1]} />
        <meshStandardMaterial color="#7a9a84" roughness={0.9} />
      </mesh>
      <mesh position={[xmid + 0.4, 2.45, wy]} rotation={[0, rotY, 0]}>
        <planeGeometry args={[3.4, 0.6]} />
        <meshStandardMaterial map={tex.sign} roughness={0.6} />
      </mesh>
      <mesh position={[xmid - 2.6, 1.95, wy]} rotation={[0, rotY, 0]}>
        <planeGeometry args={[1.4, 1.12]} />
        <meshStandardMaterial map={tex.menu} roughness={0.9} />
      </mesh>
      <WarmLighting def={def} />
    </group>
  );
}
