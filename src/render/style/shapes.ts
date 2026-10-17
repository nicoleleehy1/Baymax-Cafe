// Storybook shape kit: smooth spline lathe profiles, tapered limbs between two joints,
// and a soft shared shading term so forms read as gentle illustrated volumes.
import * as THREE from 'three';

export const PALETTE = {
  cream: '#f6efe2',
  creamShade: '#e7dcc8',
  wood: '#b07a4f',
  woodLight: '#c99566',
  woodDark: '#7e5235',
  terracotta: '#c8694a',
  terracottaSoft: '#dc8a68',
  green: '#7f9f78',
  greenDeep: '#5f8462',
  butter: '#e9c07a',
  ink: '#2b2321',
  blush: '#f0a69a',
  baymax: '#f7f6f2',
};

/** Smooth lathe from sparse (radius, height) control points via a centripetal Catmull-Rom spline. */
export function splineLathe(ctrl: [number, number][], samples = 72, segments = 64): THREE.LatheGeometry {
  const curve = new THREE.CatmullRomCurve3(
    ctrl.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'centripetal',
  );
  const pts = curve.getPoints(samples).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  // force the poles exactly onto the axis so normals close smoothly
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/**
 * A rounded, tapered limb along +Y from 0 to `length`, radii given at fractions along it.
 * Ends are capped with hemispherical rounding so it joins neighbouring joints softly.
 */
export function limb(length: number, radii: [number, number][], segments = 24): THREE.LatheGeometry {
  const r0 = radii[0][1];
  const r1 = radii[radii.length - 1][1];
  const ctrl: [number, number][] = [[0, -r0 * 0.95], [r0 * 0.7, -r0 * 0.7]];
  for (const [f, r] of radii) ctrl.push([r, f * length]);
  ctrl.push([r1 * 0.7, length + r1 * 0.7], [0, length + r1 * 0.95]);
  return splineLathe(ctrl, 48, segments);
}

/**
 * Soft matte "storybook" material. Instead of textures or outline filters it applies a gentle
 * height-based ambient term in the shader (forms darken softly toward the floor, like bounce
 * light in a cosy room), so every prop and character shares one illustrated shading language.
 */
export function softMat(color: string, opts: { roughness?: number; sheen?: number } = {}): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: opts.roughness ?? 0.82,
    metalness: 0,
    sheen: opts.sheen ?? 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color('#fff6ea'),
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  float storyAO = mix(0.8, 1.0, sqrt(clamp(vWorldY / 1.5, 0.0, 1.0)));\n  diffuseColor.rgb *= vec3(storyAO, storyAO * 0.985 + 0.004, storyAO * 0.97 + 0.01);',
      );
  };
  m.customProgramCacheKey = () => 'storybook-soft';
  return m;
}

/** Place an object so its local +Y axis runs from a to b (for limbs between joints). */
export function alignY(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): number {
  const d = new THREE.Vector3().subVectors(b, a);
  const L = d.length();
  obj.position.copy(a);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return L;
}
