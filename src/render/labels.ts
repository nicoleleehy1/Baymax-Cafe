// Lightweight screen-space labels for 3D anchors. Plain DOM elements positioned each frame
// (avoids creating extra React roots inside the Canvas).
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function container(): HTMLElement {
  let el = document.getElementById('labels');
  if (!el) {
    el = document.createElement('div');
    el.id = 'labels';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Attach a DOM label to a 3D position. `getPos` returns null to hide the label.
 * `html` is static markup (trusted, authored by us).
 */
export function useScreenLabel(className: string, html: string, getPos: () => THREE.Vector3 | null, style?: Partial<CSSStyleDeclaration>): void {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { camera, size } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useEffect(() => {
    const el = document.createElement('div');
    el.className = `screen-label ${className}`;
    el.innerHTML = html;
    if (style) Object.assign(el.style, style);
    el.style.display = 'none';
    container().appendChild(el);
    elRef.current = el;
    return () => {
      el.remove();
      elRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, html]);

  useFrame(() => {
    const el = elRef.current;
    if (!el) return;
    const p = getPos();
    if (!p) {
      el.style.display = 'none';
      return;
    }
    const v = tmp.current.copy(p).project(camera);
    if (v.z > 1) {
      el.style.display = 'none';
      return;
    }
    const canvas = document.querySelector('.stage canvas') as HTMLCanvasElement | null;
    const rect = canvas?.getBoundingClientRect();
    const x = (rect?.left ?? 0) + ((v.x + 1) / 2) * size.width;
    const y = (rect?.top ?? 0) + ((1 - v.y) / 2) * size.height;
    el.style.display = '';
    el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  });
}
