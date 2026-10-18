// Recognisable café/kitchen props for the long layout. Every prop is built on the exact
// footprint rectangle from the shared layout data, so what is drawn is what is navigated.
import { RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Obstacle, RectObstacle } from '../world/layoutTypes';
import { CHAIR_SEAT_Y, StoryChair, StoryTable, useFurnitureKit } from './Furniture';
import { PALETTE, softMat } from './style/shapes';

type Mats = ReturnType<typeof usePropMats>;

function usePropMats() {
  return useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#cfd3d6', roughness: 0.35, metalness: 0.7 }),
      darkSteel: new THREE.MeshStandardMaterial({ color: '#5e6266', roughness: 0.4, metalness: 0.6 }),
      black: new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.5 }),
      wood: softMat(PALETTE.wood, { roughness: 0.65 }),
      woodLight: softMat(PALETTE.woodLight, { roughness: 0.6 }),
      woodDark: softMat(PALETTE.woodDark, { roughness: 0.7 }),
      cream: softMat(PALETTE.cream),
      stone: softMat('#efe9df', { roughness: 0.4 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#eaf4f6', roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
      white: softMat('#f7f7f4', { roughness: 0.5 }),
      cushion: softMat(PALETTE.terracottaSoft, { roughness: 0.95, sheen: 0.6 }),
      cushionAlt: softMat(PALETTE.green, { roughness: 0.95, sheen: 0.6 }),
      pot: softMat('#c46a4a'),
      leaf: softMat('#5f8f4e'),
      rug: new THREE.MeshStandardMaterial({ color: '#b5643f', roughness: 1 }),
      wall: softMat(PALETTE.cream, { roughness: 0.95 }),
      tile: new THREE.MeshStandardMaterial({ color: '#dcd4c6', roughness: 0.9 }),
      pastry: ['#e2a35c', '#d9785b', '#f0c987', '#8b5a3c', '#f2b8c6', '#e9d6a0'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })),
    }),
    [],
  );
}

const mid = (o: RectObstacle) => ({ x: (o.min.x + o.max.x) / 2, z: (o.min.y + o.max.y) / 2, w: o.max.x - o.min.x, d: o.max.y - o.min.y });

export function LongProps({ obstacles }: { obstacles: Obstacle[] }) {
  const m = usePropMats();
  const kit = useFurnitureKit();
  const rects = obstacles.filter((o): o is RectObstacle => o.kind === 'rect');
  const circles = obstacles.filter((o) => o.kind === 'circle');
  return (
    <group>
      {rects.map((o) => (
        <RectProp key={o.id} o={o} m={m} />
      ))}
      {circles.map((o) => {
        if (o.kind !== 'circle') return null;
        switch (o.visual) {
          case 'table':
            return <StoryTable key={o.id} kit={kit} x={o.c.x} z={o.c.y} />;
          case 'chair':
            return <StoryChair key={o.id} kit={kit} x={o.c.x} z={o.c.y} facing={o.facing ?? 0} alt={o.id.endsWith('b')} />;
          case 'post':
            return (
              <mesh key={o.id} position={[o.c.x, 1.4, o.c.y]} material={m.woodDark} castShadow receiveShadow>
                <cylinderGeometry args={[o.r, o.r * 1.1, 2.8, 24]} />
              </mesh>
            );
          case 'stool':
            return (
              <mesh key={o.id} position={[o.c.x, 0.3, o.c.y]} material={m.woodDark} castShadow>
                <cylinderGeometry args={[o.r * 0.9, o.r * 0.7, 0.6, 20]} />
              </mesh>
            );
          case 'parts':
            return (
              <group key={o.id} position={[o.c.x, 0, o.c.y]}>
                <mesh position={[0, 0.06, 0]} rotation={[0, o.c.x * 3, 0]} material={m.darkSteel} castShadow>
                  <boxGeometry args={[0.26, 0.12, 0.18]} />
                </mesh>
                <mesh position={[0.1, 0.08, -0.08]} material={m.steel} castShadow>
                  <sphereGeometry args={[0.07, 12, 10]} />
                </mesh>
                <mesh position={[-0.1, 0.04, 0.1]} rotation={[0, 0, Math.PI / 2]} material={m.pastry[1]} castShadow>
                  <cylinderGeometry args={[0.03, 0.03, 0.18, 10]} />
                </mesh>
              </group>
            );
          case 'plant':
            return (
              <group key={o.id} position={[o.c.x, 0, o.c.y]}>
                <mesh position={[0, 0.22, 0]} material={m.pot} castShadow>
                  <cylinderGeometry args={[o.r * 0.8, o.r * 0.6, 0.44, 20]} />
                </mesh>
                {[0, 1, 2, 3, 4].map((i) => (
                  <mesh key={i} position={[Math.cos(i * 2.4) * 0.12, 0.62 + (i % 3) * 0.18, Math.sin(i * 2.4) * 0.12]} material={m.leaf} castShadow>
                    <sphereGeometry args={[0.19 - (i % 3) * 0.03, 12, 10]} />
                  </mesh>
                ))}
              </group>
            );
          default:
            return null;
        }
      })}
    </group>
  );
}

function RectProp({ o, m }: { o: RectObstacle; m: Mats }) {
  const { x, z, w, d } = mid(o);
  switch (o.visual) {
    case 'kitchenSink':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.9, d]} radius={0.03} position={[0, 0.45, 0]} material={m.steel} castShadow receiveShadow />
          {[-0.25, 0.25].map((dz) => (
            <mesh key={dz} position={[0, 0.9, dz * (d / 0.75)]} rotation={[-Math.PI / 2, 0, 0]} material={m.darkSteel}>
              <planeGeometry args={[w * 0.7, d * 0.4]} />
            </mesh>
          ))}
          <mesh position={[-w * 0.3, 1.15, 0]} material={m.steel}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 10]} />
          </mesh>
        </group>
      );
    case 'prepTable':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.06, d]} radius={0.02} position={[0, 0.88, 0]} material={m.steel} castShadow receiveShadow />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[(sx * (w - 0.08)) / 2, 0.43, (sz * (d - 0.08)) / 2]} material={m.darkSteel}>
                <cylinderGeometry args={[0.02, 0.02, 0.86, 8]} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.93, 0]} material={m.woodLight}>
            <boxGeometry args={[w * 0.5, 0.04, d * 0.5]} />
          </mesh>
        </group>
      );
    case 'conveyorOven':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 1.1, d]} radius={0.04} position={[0, 0.55, 0]} material={m.darkSteel} castShadow receiveShadow />
          <mesh position={[0, 1.12, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.black}>
            <planeGeometry args={[w * 0.6, d * 0.85]} />
          </mesh>
          {[-0.3, 0, 0.3].map((t) => (
            <mesh key={t} position={[0, 1.16, t * d]} material={m.pastry[0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
            </mesh>
          ))}
        </group>
      );
    case 'trayRack':
      return (
        <group position={[x, 0, z]}>
          {[0.4, 0.75, 1.1, 1.45].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={m.steel}>
              <boxGeometry args={[w, 0.02, d]} />
            </mesh>
          ))}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[(sx * (w - 0.04)) / 2, 0.8, (sz * (d - 0.04)) / 2]} material={m.darkSteel}>
                <cylinderGeometry args={[0.012, 0.012, 1.6, 8]} />
              </mesh>
            )),
          )}
        </group>
      );
    case 'stairs':
      return (
        <group position={[x, 0, z]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} position={[-w / 2 + ((i + 0.5) * w) / 6, 0.1 + i * 0.2, 0]} material={m.woodDark} castShadow receiveShadow>
              <boxGeometry args={[w / 6, 0.2 + i * 0.4, d]} />
            </mesh>
          ))}
        </group>
      );
    case 'office':
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.tile}>
            <planeGeometry args={[w, d]} />
          </mesh>
          <RoundedBox args={[1.2, 0.75, 0.6]} radius={0.03} position={[w * 0.15, 0.375, -d * 0.2]} material={m.woodDark} castShadow />
          <mesh position={[w * 0.15, 0.95, -d * 0.2]} material={m.black}>
            <boxGeometry args={[0.45, 0.3, 0.04]} />
          </mesh>
          <RoundedBox args={[0.5, 0.45, 0.5]} radius={0.06} position={[w * 0.15, 0.3, d * 0.2]} material={m.cushionAlt} castShadow />
        </group>
      );
    case 'stove':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.9, d]} radius={0.03} position={[0, 0.45, 0]} material={m.steel} castShadow receiveShadow />
          <mesh position={[0, 0.9, 0]} material={m.black}>
            <boxGeometry args={[w, 0.02, d]} />
          </mesh>
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * w * 0.25, 0.92, sz * d * 0.25]} rotation={[-Math.PI / 2, 0, 0]} material={m.darkSteel}>
                <ringGeometry args={[0.06, 0.12, 24]} />
              </mesh>
            )),
          )}
          <mesh position={[0, 1.4, -d / 2 + 0.05]} material={m.darkSteel}>
            <boxGeometry args={[w, 0.25, 0.1]} />
          </mesh>
        </group>
      );
    case 'fridge':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 2.0, d]} radius={0.04} position={[0, 1.0, 0]} material={m.white} castShadow receiveShadow />
          <mesh position={[0, 1.0, d / 2 + 0.005]} material={m.steel}>
            <boxGeometry args={[0.03, 0.9, 0.02]} />
          </mesh>
        </group>
      );
    case 'dishRack':
    case 'shelf':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.9, d]} radius={0.02} position={[0, 0.45, 0]} material={m.woodDark} castShadow receiveShadow />
          {[1.3, 1.75].map((y) => (
            <mesh key={y} position={[0, y, 0]} material={m.woodLight} castShadow>
              <boxGeometry args={[w, 0.04, d]} />
            </mesh>
          ))}
          {Array.from({ length: Math.max(2, Math.floor((Math.max(w, d) / 0.25) * 2)) }).map((_, i) => {
            const along = Math.max(w, d);
            const t = ((i % Math.ceil(along / 0.25)) + 0.5) / Math.ceil(along / 0.25) - 0.5;
            const y = i < Math.ceil(along / 0.25) ? 1.42 : 1.87;
            const px = w >= d ? t * w : 0;
            const pz = w >= d ? 0 : t * d;
            return (
              <mesh key={i} position={[px, y, pz]} material={o.visual === 'dishRack' ? m.white : m.pastry[i % 6]} castShadow>
                <cylinderGeometry args={[0.07, 0.06, o.visual === 'dishRack' ? 0.14 : 0.2, 14]} />
              </mesh>
            );
          })}
        </group>
      );
    case 'counter':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 1.0, d]} radius={0.03} position={[0, 0.5, 0]} material={m.woodDark} castShadow receiveShadow />
          <RoundedBox args={[w + 0.06, 0.05, d + 0.06]} radius={0.02} position={[0, 1.02, 0]} material={m.stone} castShadow receiveShadow />
          {o.id === 'counterArm' && (
            <>
              <mesh position={[0, 1.14, -d * 0.3]} material={m.black}>
                <boxGeometry args={[0.32, 0.2, 0.26]} />
              </mesh>
              {[0.1, 0.35].map((t, i) => (
                <group key={t} position={[0, 1.05, t * d]}>
                  <mesh position={[0, 0.1, 0]} material={m.stone}>
                    <cylinderGeometry args={[0.02, 0.02, 0.2, 10]} />
                  </mesh>
                  <mesh position={[0, 0.21, 0]} material={m.stone}>
                    <cylinderGeometry args={[0.16, 0.16, 0.015, 24]} />
                  </mesh>
                  <mesh position={[0, 0.26, 0]} material={m.pastry[i + 2]}>
                    <cylinderGeometry args={[0.12, 0.13, 0.08, 24]} />
                  </mesh>
                </group>
              ))}
            </>
          )}
        </group>
      );
    case 'pastryCase':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.8, d]} radius={0.03} position={[0, 0.4, 0]} material={m.woodDark} castShadow receiveShadow />
          <mesh position={[0, 0.82, 0]} material={m.stone}>
            <boxGeometry args={[w + 0.04, 0.04, d + 0.04]} />
          </mesh>
          <mesh position={[0, 1.1, 0]} material={m.glass}>
            <boxGeometry args={[w - 0.06, 0.5, d - 0.06]} />
          </mesh>
          <mesh position={[0, 1.36, 0]} material={m.steel}>
            <boxGeometry args={[w - 0.04, 0.02, d - 0.04]} />
          </mesh>
          {Array.from({ length: Math.floor(w / 0.32) * 2 }).map((_, i) => {
            const n = Math.floor(w / 0.32);
            const px = -w / 2 + ((i % n) + 0.5) * (w / n);
            const pz = i < n ? -d * 0.22 : d * 0.22;
            const k = i % 4;
            return k === 0 ? (
              <mesh key={i} position={[px, 0.9, pz]} rotation={[Math.PI / 2, 0, 0]} material={m.pastry[i % 6]} castShadow>
                <torusGeometry args={[0.06, 0.03, 10, 20]} />
              </mesh>
            ) : k === 1 ? (
              <mesh key={i} position={[px, 0.9, pz]} scale={[1.3, 0.7, 1]} material={m.pastry[i % 6]} castShadow>
                <sphereGeometry args={[0.06, 14, 10]} />
              </mesh>
            ) : k === 2 ? (
              <mesh key={i} position={[px, 0.9, pz]} material={m.pastry[i % 6]} castShadow>
                <cylinderGeometry args={[0.06, 0.07, 0.08, 16]} />
              </mesh>
            ) : (
              <mesh key={i} position={[px, 0.885, pz]} material={m.pastry[i % 6]} castShadow>
                <boxGeometry args={[0.11, 0.07, 0.09]} />
              </mesh>
            );
          })}
        </group>
      );
    case 'dishCounter':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.9, d]} radius={0.03} position={[0, 0.45, 0]} material={m.woodDark} castShadow receiveShadow />
          <mesh position={[0, 0.92, 0]} material={m.stone}>
            <boxGeometry args={[w + 0.04, 0.04, d + 0.04]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[-w * 0.25 + i * 0.16, 0.97 + i * 0.015, 0]} material={m.white}>
              <cylinderGeometry args={[0.1, 0.1, 0.02, 20]} />
            </mesh>
          ))}
        </group>
      );
    case 'espressoBar':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 1.0, d]} radius={0.03} position={[0, 0.5, 0]} material={m.woodDark} castShadow receiveShadow />
          <RoundedBox args={[w + 0.06, 0.05, d + 0.06]} radius={0.02} position={[0, 1.02, 0]} material={m.stone} castShadow />
          <group position={[0, 1.05, -d * 0.25]}>
            <RoundedBox args={[0.5, 0.42, 0.55]} radius={0.03} position={[0, 0.21, 0]} material={m.steel} castShadow />
            <mesh position={[0, 0.44, 0]} material={m.black}>
              <boxGeometry args={[0.52, 0.04, 0.57]} />
            </mesh>
            {[-0.15, 0.15].map((dx) => (
              <mesh key={dx} position={[dx, 0.12, 0.3]} rotation={[Math.PI / 2, 0, 0]} material={m.black}>
                <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
              </mesh>
            ))}
          </group>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-0.1 + (i % 2) * 0.12, 1.09 + Math.floor(i / 2) * 0.09, d * 0.3]} material={m.white} castShadow>
              <cylinderGeometry args={[0.045, 0.035, 0.08, 16]} />
            </mesh>
          ))}
        </group>
      );
    case 'boothTable':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.05, d]} radius={0.02} position={[0, 0.72, 0]} material={m.woodLight} castShadow receiveShadow />
          <mesh position={[0, 0.36, 0]} material={m.black}>
            <cylinderGeometry args={[0.04, 0.05, 0.7, 12]} />
          </mesh>
          <mesh position={[0, 0.015, 0]} material={m.black}>
            <cylinderGeometry args={[0.22, 0.24, 0.03, 24]} />
          </mesh>
        </group>
      );
    case 'bench':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.4, d]} radius={0.03} position={[0, 0.2, 0]} material={m.wood} castShadow receiveShadow />
          <RoundedBox args={[w - 0.04, 0.08, d - 0.04]} radius={0.03} position={[0, 0.44, 0]} material={m.cushion} castShadow receiveShadow />
        </group>
      );
    case 'communal':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.06, d]} radius={0.02} position={[0, 0.72, 0]} material={m.woodLight} castShadow receiveShadow />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * (w - 0.5)) / 2, 0.35, 0]} material={m.woodDark} castShadow>
              <boxGeometry args={[0.08, 0.7, d - 0.3]} />
            </mesh>
          ))}
          {[-0.3, 0, 0.3].map((t, i) => (
            <mesh key={t} position={[t * w, 0.8, 0]} material={m.pastry[(i + 1) % 6]}>
              <sphereGeometry args={[0.05, 12, 8]} />
            </mesh>
          ))}
        </group>
      );
    case 'squareTable':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.05, d]} radius={0.02} position={[0, 0.72, 0]} material={m.woodLight} castShadow receiveShadow />
          <mesh position={[0, 0.36, 0]} material={m.black}>
            <cylinderGeometry args={[0.04, 0.05, 0.7, 12]} />
          </mesh>
          <mesh position={[0, 0.015, 0]} material={m.black}>
            <cylinderGeometry args={[0.24, 0.26, 0.03, 24]} />
          </mesh>
        </group>
      );
    case 'restroom':
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.tile}>
            <planeGeometry args={[w, d]} />
          </mesh>
          <RoundedBox args={[0.5, 0.4, 0.7]} radius={0.08} position={[-w * 0.25, 0.2, 0]} material={m.white} castShadow />
          <RoundedBox args={[0.5, 0.1, 0.3]} radius={0.04} position={[w * 0.25, 0.85, -d * 0.25]} material={m.white} castShadow />
        </group>
      );
    case 'bed':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.3, d]} radius={0.04} position={[0, 0.15, 0]} material={m.woodDark} castShadow receiveShadow />
          <RoundedBox args={[w - 0.1, 0.2, d - 0.1]} radius={0.06} position={[0, 0.4, 0]} material={m.white} castShadow receiveShadow />
          <RoundedBox args={[w * 0.6, 0.12, d - 0.14]} radius={0.05} position={[w * 0.15, 0.56, 0]} material={m.cushionAlt} castShadow receiveShadow />
          <RoundedBox args={[0.3, 0.1, d * 0.3]} radius={0.04} position={[-w / 2 + 0.3, 0.55, 0]} material={m.cream} castShadow />
          <mesh position={[-w / 2 + 0.05, 0.55, 0]} material={m.woodDark} castShadow>
            <boxGeometry args={[0.08, 0.9, d]} />
          </mesh>
        </group>
      );
    case 'sofa':
    case 'armchair':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.42, d]} radius={0.08} position={[0, 0.21, 0]} material={m.cushion} castShadow receiveShadow />
          <RoundedBox args={[0.25, 0.45, d]} radius={0.08} position={[w / 2 - 0.12, 0.6, 0]} material={m.cushion} castShadow receiveShadow />
          {[-1, 1].map((sd) => (
            <RoundedBox key={sd} args={[w, 0.2, 0.2]} radius={0.06} position={[0, 0.5, (sd * (d - 0.2)) / 2]} material={m.cushion} castShadow />
          ))}
        </group>
      );
    case 'desk':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.05, d]} radius={0.02} position={[0, 0.74, 0]} material={m.woodLight} castShadow receiveShadow />
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[0, 0.36, (sd * (d - 0.1)) / 2]} material={m.woodDark} castShadow>
              <boxGeometry args={[w - 0.1, 0.72, 0.05]} />
            </mesh>
          ))}
          <mesh position={[w * 0.15, 0.95, 0]} rotation={[0, -Math.PI / 2, 0]} material={m.black}>
            <boxGeometry args={[0.6, 0.36, 0.04]} />
          </mesh>
          <mesh position={[-w * 0.1, 0.78, d * 0.2]} material={m.white}>
            <boxGeometry args={[0.14, 0.02, 0.36]} />
          </mesh>
        </group>
      );
    case 'workbench':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.08, d]} radius={0.02} position={[0, 0.9, 0]} material={m.woodLight} castShadow receiveShadow />
          <mesh position={[0, 0.4, 0]} material={m.darkSteel} castShadow>
            <boxGeometry args={[w - 0.2, 0.8, d - 0.3]} />
          </mesh>
          {[-0.3, 0, 0.3].map((t, i) => (
            <mesh key={t} position={[0.1 * (i - 1), 0.98, t * d]} rotation={[0, i, 0]} material={i === 1 ? m.steel : m.pastry[(i * 2) % 6]} castShadow>
              <boxGeometry args={[0.18, 0.08, 0.1]} />
            </mesh>
          ))}
          <mesh position={[w * 0.3, 1.0, -d * 0.35]} material={m.pastry[1]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.12, 12]} />
          </mesh>
        </group>
      );
    case 'planter':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.5, d]} radius={0.03} position={[0, 0.25, 0]} material={m.woodDark} castShadow receiveShadow />
          <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.black}>
            <planeGeometry args={[w - 0.1, d - 0.1]} />
          </mesh>
          {Array.from({ length: Math.max(2, Math.round((w * d) / 0.35)) }).map((_, i) => {
            const n = Math.max(2, Math.round((w * d) / 0.35));
            const t = (i + 0.5) / n;
            return (
              <mesh key={i} position={[w >= d ? -w / 2 + t * w : (i % 2) * 0.2 - 0.1, 0.72 + (i % 3) * 0.06, w >= d ? (i % 2) * 0.2 - 0.1 : -d / 2 + t * d]} material={i % 2 ? m.leaf : m.cushionAlt} castShadow>
                <sphereGeometry args={[0.22, 12, 10]} />
              </mesh>
            );
          })}
        </group>
      );
    case 'tub':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.55, d]} radius={0.1} position={[0, 0.275, 0]} material={m.white} castShadow receiveShadow />
          <mesh position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}>
            <planeGeometry args={[w - 0.3, d - 0.3]} />
          </mesh>
          <mesh position={[-w / 2 + 0.15, 0.75, 0]} material={m.steel}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 10]} />
          </mesh>
        </group>
      );
    case 'toilet':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w * 0.9, 0.4, d]} radius={0.12} position={[0, 0.2, 0]} material={m.white} castShadow />
          <RoundedBox args={[0.2, 0.35, d * 0.9]} radius={0.04} position={[-w / 2 + 0.1, 0.55, 0]} material={m.white} castShadow />
        </group>
      );
    case 'sink':
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.4, 0]} material={m.white} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.8, 12]} />
          </mesh>
          <RoundedBox args={[w, 0.12, d]} radius={0.06} position={[0, 0.84, 0]} material={m.white} castShadow />
        </group>
      );
    case 'diningTable':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.05, d]} radius={0.03} position={[0, 0.74, 0]} material={m.woodLight} castShadow receiveShadow />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[(sx * (w - 0.12)) / 2, 0.36, (sz * (d - 0.12)) / 2]} material={m.woodDark} castShadow>
                <boxGeometry args={[0.07, 0.72, 0.07]} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.82, 0]} material={m.pot}>
            <cylinderGeometry args={[0.07, 0.09, 0.14, 14]} />
          </mesh>
          <mesh position={[0, 0.95, 0]} material={m.pastry[4]}>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
        </group>
      );
    case 'kitchenette':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.9, d]} radius={0.03} position={[0, 0.45, 0]} material={m.woodLight} castShadow receiveShadow />
          <mesh position={[0, 0.92, 0]} material={m.stone}>
            <boxGeometry args={[w + 0.04, 0.04, d + 0.04]} />
          </mesh>
          <mesh position={[0, 0.93, -d * 0.25]} material={m.black}>
            <boxGeometry args={[w * 0.8, 0.02, 0.6]} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * w * 0.22, 0.95, -d * 0.25]} rotation={[-Math.PI / 2, 0, 0]} material={m.darkSteel}>
              <ringGeometry args={[0.06, 0.11, 24]} />
            </mesh>
          ))}
          <mesh position={[0, 0.95, d * 0.25]} material={m.steel}>
            <boxGeometry args={[w * 0.6, 0.04, 0.45]} />
          </mesh>
        </group>
      );
    case 'windowSeat':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, 0.45, d]} radius={0.04} position={[0, 0.225, 0]} material={m.wood} castShadow receiveShadow />
          <RoundedBox args={[w - 0.06, 0.1, d - 0.06]} radius={0.04} position={[0, 0.5, 0]} material={m.cushionAlt} castShadow />
        </group>
      );
    case 'wardrobe':
    case 'bookshelf':
      return (
        <group position={[x, 0, z]}>
          <RoundedBox args={[w, o.visual === 'wardrobe' ? 2.0 : 1.7, d]} radius={0.02} position={[0, o.visual === 'wardrobe' ? 1.0 : 0.85, 0]} material={m.woodDark} castShadow receiveShadow />
          {o.visual === 'bookshelf' &&
            [0.4, 0.8, 1.2].map((yy, i) => (
              <mesh key={yy} position={[0, yy, 0]} material={m.pastry[i]}>
                <boxGeometry args={[w * 0.6, 0.25, d * 0.7]} />
              </mesh>
            ))}
        </group>
      );
    case 'stairsUp':
      return (
        <group position={[x, 0, z]}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <mesh key={i} position={[-w / 2 + ((i + 0.5) * w) / 7, -0.1 - i * 0.22, 0]} material={m.woodDark} castShadow receiveShadow>
              <boxGeometry args={[w / 7, 0.2, d]} />
            </mesh>
          ))}
          <mesh position={[0, 0.5, d / 2]} material={m.woodDark}>
            <boxGeometry args={[w, 0.06, 0.05]} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh position={[x, 0.45, z]} material={m.wood} castShadow receiveShadow>
          <boxGeometry args={[w, 0.9, d]} />
        </mesh>
      );
  }
}

export { CHAIR_SEAT_Y };
