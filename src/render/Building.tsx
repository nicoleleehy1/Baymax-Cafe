// The Lucky Cat building as a stacked dollhouse (inspired by Sentinel's floor groups):
// each storey is drawn from its own LayoutDef, offset vertically by FLOOR_HEIGHT. The active
// storey (where the simulation runs) sits at y = 0 so overlays, previews and characters need
// no changes. Floors below are always shown; floors above are hidden unless the whole
// building is on view, so nothing covers Baymax while he works.
import { useMemo } from 'react';
import * as THREE from 'three';
import { useApp } from '../state/store';
import { BUILDING, FLOOR_HEIGHT, LAYOUT } from '../world/layout';
import type { LayoutDef } from '../world/layoutTypes';
import { RUG } from '../world/layouts/long';
import { LongProps } from './LongProps';
import { PALETTE, softMat } from './style/shapes';

export function Building() {
  const whole = useApp((s) => s.buildingView);
  return (
    <group>
      {BUILDING.map((def) => {
        const dy = (def.floor - LAYOUT.floor) * FLOOR_HEIGHT;
        const above = def.floor > LAYOUT.floor;
        if (above && !whole) return null;
        return (
          <group key={def.id} position={[0, dy, 0]}>
            <Storey def={def} active={def.id === LAYOUT.id} />
          </group>
        );
      })}
    </group>
  );
}

function Storey({ def, active }: { def: LayoutDef; active: boolean }) {
  const mats = useMemo(
    () => ({
      wall: softMat(PALETTE.cream, { roughness: 0.95 }),
      slab: new THREE.MeshStandardMaterial({ color: '#cbb79b', roughness: 0.95 }),
      veil: new THREE.MeshBasicMaterial({ color: '#2a211c', transparent: true, opacity: 0.35, depthWrite: false }),
    }),
    [],
  );
  const R = def.room;
  const floorTex = useMemo(() => makeFloorTexture(def), [def]);
  const onEdge = (p: { x: number; y: number }): boolean => Math.abs(p.x - R.minX) < 0.05 || Math.abs(p.x - R.maxX) < 0.05 || Math.abs(p.y - R.minY) < 0.05 || Math.abs(p.y - R.maxY) < 0.05;
  // a wall is exterior when both ends sit on the building's outline (the café's angled
  // entrance wall counts too: its ends are on the outline)
  const exterior = (w: { a: { x: number; y: number }; b: { x: number; y: number } }): boolean => onEdge(w.a) && onEdge(w.b) && !(w.a.x === w.b.x && Math.abs(w.a.x - R.minX) > 0.05 && Math.abs(w.a.x - R.maxX) > 0.05) && !(w.a.y === w.b.y && Math.abs(w.a.y - R.minY) > 0.05 && Math.abs(w.a.y - R.maxY) > 0.05);
  return (
    <group>
      {/* slab + finished floor */}
      <mesh position={[(R.minX + R.maxX) / 2, -0.12, (R.minY + R.maxY) / 2]} material={mats.slab} receiveShadow>
        <boxGeometry args={[R.maxX - R.minX + 0.3, 0.24, R.maxY - R.minY + 0.3]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(R.minX + R.maxX) / 2, 0.001, (R.minY + R.maxY) / 2]} receiveShadow>
        <planeGeometry args={[R.maxX - R.minX, R.maxY - R.minY]} />
        <meshStandardMaterial map={floorTex} roughness={0.9} />
      </mesh>
      {def.walls.map((w, i) => {
        const dx = w.b.x - w.a.x;
        const dy = w.b.y - w.a.y;
        const L = Math.hypot(dx, dy);
        // dollhouse: exterior walls are taken down to a low plinth so every room is visible;
        // interior walls keep their height
        const h = w.h ?? (exterior(w) ? 0.22 : active ? 2.8 : 1.6);
        return (
          <mesh key={i} position={[(w.a.x + w.b.x) / 2, h / 2, (w.a.y + w.b.y) / 2]} rotation={[0, -Math.atan2(dy, dx), 0]} material={mats.wall} castShadow receiveShadow>
            <boxGeometry args={[L + 0.15, h, 0.15]} />
          </mesh>
        );
      })}
      {def.id === 'long' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(RUG.min.x + RUG.max.x) / 2, 0.006, (RUG.min.y + RUG.max.y) / 2]} receiveShadow>
          <planeGeometry args={[RUG.max.x - RUG.min.x, RUG.max.y - RUG.min.y]} />
          <meshStandardMaterial color="#c9a27a" roughness={1} />
        </mesh>
      )}
      {def.decor?.map((d) => (
        <Rug key={d.id} d={d} />
      ))}
      {def.windows?.map((w, i) => {
        const dx = w.b.x - w.a.x;
        const dy = w.b.y - w.a.y;
        return (
          <mesh key={`win${i}`} position={[(w.a.x + w.b.x) / 2, 0.3, (w.a.y + w.b.y) / 2]} rotation={[0, -Math.atan2(dy, dx), 0]}>
            <planeGeometry args={[Math.hypot(dx, dy), 0.16]} />
            <meshPhysicalMaterial color="#dff1f6" transparent opacity={0.5} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
      <LongProps obstacles={def.obstacles} />
      {!active && (
        // a soft veil so inactive storeys read as context, not as the stage
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(R.minX + R.maxX) / 2, 1.7, (R.minY + R.maxY) / 2]} material={mats.veil}>
          <planeGeometry args={[R.maxX - R.minX + 0.3, R.maxY - R.minY + 0.3]} />
        </mesh>
      )}
    </group>
  );
}

function makeFloorTexture(def: LayoutDef): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  if (def.id === 'long') {
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        g.fillStyle = (i + j) % 2 ? '#e6d6bd' : '#efe4d1';
        g.fillRect(i * 32, j * 32, 32, 32);
      }
  } else if (def.id === 'cass') {
    // warm plank floor
    g.fillStyle = '#d8b48b';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(90,50,20,0.25)';
    for (let r = 0; r < 8; r++) g.fillRect(0, r * 32, 256, 2);
    for (let r = 0; r < 8; r++) g.fillRect(((r * 97) % 256), r * 32, 2, 32);
  } else {
    // rooftop deck boards + room carpet blend
    g.fillStyle = '#cfc2a8';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(70,60,40,0.2)';
    for (let r = 0; r < 16; r++) g.fillRect(r * 16, 0, 1, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const R = def.room;
  t.repeat.set((R.maxX - R.minX) / 4, (R.maxY - R.minY) / 4);
  return t;
}

function Rug({ d }: { d: NonNullable<LayoutDef['decor']>[number] }) {
  const w = d.max.x - d.min.x;
  const h = d.max.y - d.min.y;
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = d.color ?? '#b5643f';
    g.fillRect(0, 0, 128, 128);
    if (d.kind !== 'tile') {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 4;
      g.strokeRect(10, 10, 108, 108);
      g.strokeRect(24, 24, 80, 80);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.moveTo(64, 34);
      g.lineTo(94, 64);
      g.lineTo(64, 94);
      g.lineTo(34, 64);
      g.closePath();
      g.fill();
    } else {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          g.fillStyle = (i + j) % 2 ? 'rgba(120,90,60,0.12)' : 'rgba(255,255,255,0.25)';
          g.fillRect(i * 32, j * 32, 32, 32);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (d.kind === 'tile') {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w / 1.2, h / 1.2);
    }
    return t;
  }, [d, w, h]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(d.min.x + d.max.x) / 2, d.kind === 'tile' ? 0.004 : 0.012, (d.min.y + d.max.y) / 2]} receiveShadow>
      {d.kind === 'roundRug' ? <circleGeometry args={[Math.min(w, h) / 2, 40]} /> : <planeGeometry args={[w, h]} />}
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}
