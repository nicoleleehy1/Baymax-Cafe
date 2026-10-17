// The café set: procedural geometry built from the same layout the planner uses, so
// what you see is what Baymax navigates around.
import { useMemo } from 'react';
import * as THREE from 'three';
import { headingToRotY } from './geom';
import { BACK_SHELF, COUNTER, DOOR_RECT as DOOR, PASTRY_ISLAND, PLANTS, TABLES, WALL, CLASSIC } from '../world/layouts/classic';

const AISLES = CLASSIC.aisles;

const WALL_H = 3.2;

function useCanvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, repeat?: [number, number]) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat[0], repeat[1]);
    }
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function seeded(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function Cafe() {
  const floorTex = useCanvasTexture(
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
    [3, 2.2],
  );

  const menuTex = useCanvasTexture(
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

  const signTex = useCanvasTexture(
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

  const mats = useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({ color: '#efe1c8', roughness: 0.95 }),
      wallAccent: new THREE.MeshStandardMaterial({ color: '#7a9a84', roughness: 0.9 }),
      trim: new THREE.MeshStandardMaterial({ color: '#6b4630', roughness: 0.7 }),
      woodDark: new THREE.MeshStandardMaterial({ color: '#7b4f33', roughness: 0.65 }),
      woodLight: new THREE.MeshStandardMaterial({ color: '#c48d5c', roughness: 0.6 }),
      stone: new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.35 }),
      metal: new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.25, metalness: 0.85 }),
      blackMetal: new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.4, metalness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#e8f4f6', roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.18, depthWrite: false }),
      pot: new THREE.MeshStandardMaterial({ color: '#c46a4a', roughness: 0.8 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#5f8f4e', roughness: 0.8 }),
      leaf2: new THREE.MeshStandardMaterial({ color: '#77a85d', roughness: 0.8 }),
      cushion: new THREE.MeshStandardMaterial({ color: '#d8a24a', roughness: 0.9 }),
      window: new THREE.MeshBasicMaterial({ color: '#fff3d6' }),
      rug: new THREE.MeshStandardMaterial({ color: '#b5643f', roughness: 1 }),
    }),
    [],
  );

  const pastryColors = ['#e2a35c', '#d9785b', '#f0c987', '#8b5a3c', '#f2b8c6', '#e9d6a0'];

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.3, 0, 0]} receiveShadow>
        <planeGeometry args={[14.6, 10]} />
        <meshStandardMaterial map={floorTex} roughness={0.75} />
      </mesh>
      {/* rug under the seating area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-5.2, 0.005, 0.15]} receiveShadow material={mats.rug}>
        <planeGeometry args={[2.6, 4.6]} />
      </mesh>

      <Walls mats={mats} />

      {/* sign + menu on the back wall */}
      <mesh position={[-1.3, 2.75, WALL.back + 0.06]}>
        <planeGeometry args={[3.6, 0.63]} />
        <meshStandardMaterial map={signTex} roughness={0.6} />
      </mesh>
      <mesh position={[-3.4, 1.85, WALL.back + 0.06]}>
        <planeGeometry args={[1.4, 1.12]} />
        <meshStandardMaterial map={menuTex} roughness={0.9} />
      </mesh>

      {/* counter */}
      <Counter mats={mats} pastryColors={pastryColors} />

      {/* back shelf */}
      <group>
        <mesh position={[(BACK_SHELF.min.x + BACK_SHELF.max.x) / 2, 0.45, (BACK_SHELF.min.y + BACK_SHELF.max.y) / 2]} castShadow receiveShadow material={mats.woodDark}>
          <boxGeometry args={[BACK_SHELF.max.x - BACK_SHELF.min.x, 0.9, BACK_SHELF.max.y - BACK_SHELF.min.y]} />
        </mesh>
        <mesh position={[(BACK_SHELF.min.x + BACK_SHELF.max.x) / 2, 0.92, (BACK_SHELF.min.y + BACK_SHELF.max.y) / 2]} castShadow receiveShadow material={mats.stone}>
          <boxGeometry args={[BACK_SHELF.max.x - BACK_SHELF.min.x + 0.04, 0.04, BACK_SHELF.max.y - BACK_SHELF.min.y + 0.04]} />
        </mesh>
        {[1.6, 2.2].map((y) => (
          <mesh key={y} position={[4.7, y, WALL.back + 0.15]} castShadow material={mats.woodLight}>
            <boxGeometry args={[4.2, 0.05, 0.28]} />
          </mesh>
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <mesh key={i} position={[2.9 + (i % 7) * 0.62, i < 7 ? 1.74 : 2.34, WALL.back + 0.15]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.22, 16]} />
            <meshStandardMaterial color={['#d9c7a3', '#8b5a3c', '#c46a4a', '#e8dcc2'][i % 4]} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* pastry island (freestanding display) */}
      <group>
        <mesh position={[(PASTRY_ISLAND.min.x + PASTRY_ISLAND.max.x) / 2, 0.45, (PASTRY_ISLAND.min.y + PASTRY_ISLAND.max.y) / 2]} castShadow receiveShadow material={mats.woodLight}>
          <boxGeometry args={[PASTRY_ISLAND.max.x - PASTRY_ISLAND.min.x, 0.9, PASTRY_ISLAND.max.y - PASTRY_ISLAND.min.y]} />
        </mesh>
        <mesh position={[(PASTRY_ISLAND.min.x + PASTRY_ISLAND.max.x) / 2, 1.13, (PASTRY_ISLAND.min.y + PASTRY_ISLAND.max.y) / 2]} material={mats.glass}>
          <boxGeometry args={[PASTRY_ISLAND.max.x - PASTRY_ISLAND.min.x - 0.1, 0.45, PASTRY_ISLAND.max.y - PASTRY_ISLAND.min.y - 0.1]} />
        </mesh>
        {Array.from({ length: 16 }).map((_, i) => (
          <Pastry key={i} kind={i % 4} color={pastryColors[i % pastryColors.length]} position={[PASTRY_ISLAND.min.x + 0.3 + (i % 8) * 0.29, 0.95, PASTRY_ISLAND.min.y + 0.22 + Math.floor(i / 8) * 0.3]} />
        ))}
      </group>

      {/* tables, chairs */}
      {TABLES.map((t) => (
        <group key={t.id}>
          <group position={[t.c.x, 0, t.c.y]}>
            <mesh position={[0, 0.74, 0]} castShadow receiveShadow material={mats.woodLight}>
              <cylinderGeometry args={[0.45, 0.45, 0.04, 40]} />
            </mesh>
            <mesh position={[0, 0.37, 0]} castShadow material={mats.blackMetal}>
              <cylinderGeometry args={[0.04, 0.05, 0.72, 12]} />
            </mesh>
            <mesh position={[0, 0.015, 0]} castShadow material={mats.blackMetal}>
              <cylinderGeometry args={[0.24, 0.26, 0.03, 24]} />
            </mesh>
            <mesh position={[0.12, 0.8, -0.1]} castShadow>
              <cylinderGeometry args={[0.03, 0.035, 0.08, 12]} />
              <meshStandardMaterial color="#e0d6c2" />
            </mesh>
            <mesh position={[0.12, 0.88, -0.1]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color="#e2747e" roughness={0.8} />
            </mesh>
          </group>
          {t.seats.map((s) => (
            <Chair key={s.id} pos={[s.pos.x, s.pos.y]} facing={s.facing} mats={mats} />
          ))}
        </group>
      ))}

      {/* plants */}
      {PLANTS.map((p) => (
        <group key={p.id} position={[p.c.x, 0, p.c.y]}>
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow material={mats.pot}>
            <cylinderGeometry args={[p.r * 0.8, p.r * 0.6, 0.44, 20]} />
          </mesh>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i} position={[Math.cos(i * 2.4) * 0.14, 0.6 + (i % 3) * 0.22, Math.sin(i * 2.4) * 0.14]} castShadow material={i % 2 ? mats.leaf : mats.leaf2}>
              <sphereGeometry args={[0.2 - (i % 3) * 0.03, 12, 10]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* warm pendant light pools (fixtures omitted so they never block the top-down view) */}
      {[
        [-5.2, -1.2],
        [-5.2, 1.5],
        [-2.0, 1.0],
        [2.2, 3.7],
        [-1.4, 3.9],
        [5.7, 1.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {i % 2 === 0 && <pointLight position={[0, 2.25, 0]} intensity={2.2} distance={4.5} decay={2} color="#ffcf8a" />}
        </group>
      ))}

      {/* door frame + outside glow */}
      <group>
        <mesh position={[WALL.left, 1.15, DOOR.min.y - 0.03]} material={mats.trim}>
          <boxGeometry args={[0.18, 2.3, 0.08]} />
        </mesh>
        <mesh position={[WALL.left, 1.15, DOOR.max.y + 0.03]} material={mats.trim}>
          <boxGeometry args={[0.18, 2.3, 0.08]} />
        </mesh>
        <mesh position={[WALL.left, 2.32, (DOOR.min.y + DOOR.max.y) / 2]} material={mats.trim}>
          <boxGeometry args={[0.18, 0.08, DOOR.max.y - DOOR.min.y + 0.14]} />
        </mesh>
        <mesh position={[WALL.left - 0.25, 1.15, (DOOR.min.y + DOOR.max.y) / 2]} rotation={[0, Math.PI / 2, 0]} material={mats.window}>
          <planeGeometry args={[DOOR.max.y - DOOR.min.y, 2.3]} />
        </mesh>
      </group>

      {/* aisle floor marking (subtle) */}
      {AISLES.map((a) => (
        <mesh key={a.id} rotation={[-Math.PI / 2, 0, 0]} position={[(a.min.x + a.max.x) / 2, 0.004, (a.min.y + a.max.y) / 2]} receiveShadow>
          <planeGeometry args={[a.max.x - a.min.x, a.max.y - a.min.y]} />
          <meshStandardMaterial color="#b98a5f" roughness={0.9} />
        </mesh>
      ))}

      <SunShafts />
    </group>
  );
}

type Mats = Record<string, THREE.Material>;

function Walls({ mats }: { mats: Mats }) {
  // right wall with three windows (sunlight enters here)
  const winZ = [-2.4, 0.6, 3.4];
  const winW = 1.7;
  const sill = 0.9;
  const top = 2.5;
  const segs: [number, number][] = [];
  let z = WALL.back;
  for (const c of winZ) {
    segs.push([z, c - winW / 2]);
    z = c + winW / 2;
  }
  segs.push([z, WALL.front]);
  return (
    <group>
      {/* back wall */}
      <mesh position={[0, WALL_H / 2, WALL.back - 0.1]} receiveShadow material={mats.wall}>
        <boxGeometry args={[14.4, WALL_H, 0.2]} />
      </mesh>
      <mesh position={[0, 0.5, WALL.back + 0.005]} receiveShadow material={mats.wallAccent}>
        <planeGeometry args={[14, 1]} />
      </mesh>
      {/* left wall with door opening */}
      <mesh position={[WALL.left - 0.1, WALL_H / 2, (WALL.back + DOOR.min.y) / 2]} receiveShadow castShadow material={mats.wall}>
        <boxGeometry args={[0.2, WALL_H, DOOR.min.y - WALL.back]} />
      </mesh>
      <mesh position={[WALL.left - 0.1, WALL_H / 2, (DOOR.max.y + WALL.front) / 2]} receiveShadow castShadow material={mats.wall}>
        <boxGeometry args={[0.2, WALL_H, WALL.front - DOOR.max.y]} />
      </mesh>
      <mesh position={[WALL.left - 0.1, (2.35 + WALL_H) / 2, (DOOR.min.y + DOOR.max.y) / 2]} castShadow material={mats.wall}>
        <boxGeometry args={[0.2, WALL_H - 2.35, DOOR.max.y - DOOR.min.y]} />
      </mesh>
      {/* right wall: solid segments + below/above windows */}
      {segs.map(([a, b], i) => (
        <mesh key={i} position={[WALL.right + 0.1, WALL_H / 2, (a + b) / 2]} castShadow receiveShadow material={mats.wall}>
          <boxGeometry args={[0.2, WALL_H, b - a]} />
        </mesh>
      ))}
      {winZ.map((c) => (
        <group key={c}>
          <mesh position={[WALL.right + 0.1, sill / 2, c]} castShadow receiveShadow material={mats.wall}>
            <boxGeometry args={[0.2, sill, winW]} />
          </mesh>
          <mesh position={[WALL.right + 0.1, (top + WALL_H) / 2, c]} castShadow receiveShadow material={mats.wall}>
            <boxGeometry args={[0.2, WALL_H - top, winW]} />
          </mesh>
          {/* mullions */}
          <mesh position={[WALL.right + 0.02, (sill + top) / 2, c]} castShadow material={mats.trim}>
            <boxGeometry args={[0.06, top - sill, 0.05]} />
          </mesh>
          <mesh position={[WALL.right + 0.02, (sill + top) / 2, c]} castShadow material={mats.trim}>
            <boxGeometry args={[0.06, 0.05, winW]} />
          </mesh>
          <mesh position={[WALL.right - 0.02, sill, c]} material={mats.trim}>
            <boxGeometry args={[0.16, 0.05, winW + 0.1]} />
          </mesh>
          {/* bright outdoors */}
          <mesh position={[WALL.right + 0.35, (sill + top) / 2, c]} rotation={[0, -Math.PI / 2, 0]} material={mats.window}>
            <planeGeometry args={[winW, top - sill]} />
          </mesh>
        </group>
      ))}
      {/* baseboards */}
      <mesh position={[0, 0.06, WALL.back + 0.01]} material={mats.trim}>
        <boxGeometry args={[14, 0.12, 0.03]} />
      </mesh>
    </group>
  );
}

function Counter({ mats, pastryColors }: { mats: Mats; pastryColors: string[] }) {
  const cx = (COUNTER.min.x + COUNTER.max.x) / 2;
  const w = COUNTER.max.x - COUNTER.min.x;
  const front = COUNTER.max.y;
  return (
    <group>
      {/* counter body only along the front; staff area behind it */}
      <mesh position={[cx, 0.5, front - 0.3]} castShadow receiveShadow material={mats.woodDark}>
        <boxGeometry args={[w, 1.0, 0.6]} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[COUNTER.min.x + 0.3 + i * (w - 0.6) / 9, 0.5, front + 0.005]} material={mats.woodLight}>
          <boxGeometry args={[0.05, 0.85, 0.02]} />
        </mesh>
      ))}
      <mesh position={[cx, 1.02, front - 0.32]} castShadow receiveShadow material={mats.stone}>
        <boxGeometry args={[w + 0.06, 0.05, 0.7]} />
      </mesh>
      {/* back bar */}
      <mesh position={[cx, 0.45, COUNTER.min.y + 0.2]} castShadow receiveShadow material={mats.woodDark}>
        <boxGeometry args={[w, 0.9, 0.4]} />
      </mesh>
      {/* espresso machine */}
      <group position={[-2.2, 1.05, front - 0.4]}>
        <mesh position={[0, 0.22, 0]} castShadow material={mats.metal}>
          <boxGeometry args={[0.7, 0.44, 0.45]} />
        </mesh>
        <mesh position={[0, 0.46, 0]} castShadow material={mats.blackMetal}>
          <boxGeometry args={[0.72, 0.04, 0.47]} />
        </mesh>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} position={[x, 0.12, 0.26]} rotation={[Math.PI / 2, 0, 0]} material={mats.blackMetal}>
            <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
          </mesh>
        ))}
      </group>
      {/* cups stack + register */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={i} position={[-1.2 + (i % 2) * 0.12, 1.09 + Math.floor(i / 2) * 0.09, front - 0.5 + (i % 2) * 0.05]} castShadow>
          <cylinderGeometry args={[0.045, 0.035, 0.08, 16]} />
          <meshStandardMaterial color="#fbfaf6" roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[-3.5, 1.15, front - 0.35]} rotation={[-0.4, 0, 0]} castShadow material={mats.blackMetal}>
        <boxGeometry args={[0.36, 0.2, 0.26]} />
      </mesh>
      {/* lucky cat figurine */}
      <group position={[0.2, 1.05, front - 0.55]}>
        <mesh position={[0, 0.09, 0]} castShadow>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshStandardMaterial color="#fff4e0" />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color="#fff4e0" />
        </mesh>
        <mesh position={[0.08, 0.26, 0.02]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.02, 0.06, 4, 8]} />
          <meshStandardMaterial color="#fff4e0" />
        </mesh>
        <mesh position={[0, 0.16, 0.07]}>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshStandardMaterial color="#d6a63c" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {/* glass pastry case on the counter */}
      <group position={[1.05, 1.05, front - 0.38]}>
        <mesh position={[0, 0.2, 0]} material={mats.glass}>
          <boxGeometry args={[1.3, 0.4, 0.6]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={mats.woodLight}>
          <boxGeometry args={[1.3, 0.02, 0.6]} />
        </mesh>
        {Array.from({ length: 10 }).map((_, i) => (
          <Pastry key={i} kind={(i + 1) % 4} color={pastryColors[(i + 2) % pastryColors.length]} position={[-0.5 + (i % 5) * 0.25, i < 5 ? 0.04 : 0.24, -0.1 + (i < 5 ? 0 : 0.08)]} />
        ))}
      </group>
    </group>
  );
}

function Pastry({ kind, color, position }: { kind: number; color: string; position: [number, number, number] }) {
  if (kind === 0)
    return (
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.06, 0.03, 10, 20]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    );
  if (kind === 1)
    return (
      <mesh position={[position[0], position[1] + 0.03, position[2]]} scale={[1.3, 0.7, 1]} castShadow>
        <sphereGeometry args={[0.06, 14, 10]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    );
  if (kind === 2)
    return (
      <mesh position={[position[0], position[1] + 0.04, position[2]]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.08, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    );
  return (
    <mesh position={[position[0], position[1] + 0.035, position[2]]} castShadow>
      <boxGeometry args={[0.11, 0.07, 0.09]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function Chair({ pos, facing, mats }: { pos: [number, number]; facing: number; mats: Mats }) {
  return (
    <group position={[pos[0], 0, pos[1]]} rotation={[0, headingToRotY(facing), 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={mats.woodDark}>
        <boxGeometry args={[0.4, 0.04, 0.4]} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow material={mats.cushion}>
        <boxGeometry args={[0.36, 0.03, 0.36]} />
      </mesh>
      <mesh position={[0, 0.72, -0.19]} castShadow material={mats.woodDark}>
        <boxGeometry args={[0.4, 0.5, 0.04]} />
      </mesh>
      {[-0.17, 0.17].flatMap((x) =>
        [-0.17, 0.17].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.22, z]} castShadow material={mats.woodDark}>
            <boxGeometry args={[0.035, 0.45, 0.035]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Soft additive light shafts from the windows (decorative only). */
function SunShafts() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,230,180,0.55)');
    g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      {[-2.4, 0.6, 3.4].map((z) => (
        <mesh key={z} position={[5.4, 1.3, z - 0.3]} rotation={[0, Math.PI / 2, -0.95]}>
          <planeGeometry args={[1.6, 3.6]} />
          <meshBasicMaterial map={tex} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
