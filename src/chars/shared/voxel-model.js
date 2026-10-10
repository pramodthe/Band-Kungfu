// Shared voxel geometry and material lighting for the active fighter roster.
import * as THREE from 'three';
import { hash01 } from '../../core/rng.js';
import { shade, FACES, makeBuilder } from '../../core/voxel.js';

export const V = 0.025;
export const HV = 0.0175;

const _col = new THREE.Color();

/**
 * boxes: { a:[x,y,z], b:[x,y,z] (voxel units, integers, b exclusive), c: 0xRRGGBB | -1 (carve) | fn(x,y,z) → colour|null,
 * paint?: only recolour existing voxels }. Later boxes win. Vertex = (voxel + off) * v.
 */
export function vox(boxes, v = V, { off = [0, 0, 0], jitter = 0.05, ao = 0.42 } = {}) {
  const mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  for (const b of boxes)
    if (!b.paint && b.c !== -1)
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], b.a[k]);
        mx[k] = Math.max(mx[k], b.b[k]);
      }
  const o = mn.map((m) => m - 1),
    n = mx.map((m, k) => m - mn[k] + 2); // 1-voxel empty border for neighbour tests
  const grid = new Int32Array(n[0] * n[1] * n[2]).fill(-1);
  const id = (i, j, k) => i + n[0] * (j + n[1] * k);
  for (const b of boxes) {
    for (let z = Math.max(b.a[2], o[2]); z < Math.min(b.b[2], o[2] + n[2]); z++)
      for (let y = Math.max(b.a[1], o[1]); y < Math.min(b.b[1], o[1] + n[1]); y++)
        for (let x = Math.max(b.a[0], o[0]); x < Math.min(b.b[0], o[0] + n[0]); x++) {
          const g = id(x - o[0], y - o[1], z - o[2]);
          if (b.paint && grid[g] < 0) continue;
          const c = typeof b.c === 'function' ? b.c(x, y, z) : b.c;
          if (c == null) continue;
          grid[g] = c;
        }
  }
  const full = (i, j, k) =>
    i >= 0 && j >= 0 && k >= 0 && i < n[0] && j < n[1] && k < n[2] && grid[id(i, j, k)] >= 0 ? 1 : 0;
  const vb = makeBuilder();
  const AO = [1 - ao, 1 - ao * 0.6, 1 - ao * 0.25, 1];
  const lv = [0, 0, 0, 0],
    kq = [0, 0, 0, 0];
  for (let k = 1; k < n[2] - 1; k++)
    for (let j = 1; j < n[1] - 1; j++)
      for (let i = 1; i < n[0] - 1; i++) {
        const c = grid[id(i, j, k)];
        if (c < 0) continue;
        _col.set(shade(c, 1 - jitter / 2 + hash01(i + o[0], j + o[1], k + o[2]) * jitter));
        for (const f of FACES) {
          const [nx, ny, nz] = f.n;
          if (full(i + nx, j + ny, k + nz)) continue;
          const ax = f.n[0] ? [1, 2] : f.n[1] ? [0, 2] : [0, 1];
          const corners = f.v.map((cv, q) => {
            const p = [i + nx, j + ny, k + nz];
            const s1 = [...p],
              s2 = [...p];
            s1[ax[0]] += cv[ax[0]] ? 1 : -1;
            s2[ax[1]] += cv[ax[1]] ? 1 : -1;
            const cc = [...s1];
            cc[ax[1]] += cv[ax[1]] ? 1 : -1;
            const a = full(...s1),
              b = full(...s2);
            lv[q] = a && b ? 0 : 3 - a - b - full(...cc);
            kq[q] = AO[lv[q]];
            return [
              (i + o[0] + cv[0] + off[0]) * v,
              (j + o[1] + cv[1] + off[1]) * v,
              (k + o[2] + cv[2] + off[2]) * v,
            ];
          });
          vb.quad(corners, f.n, _col.r, _col.g, _col.b, kq, lv[0] + lv[2] < lv[1] + lv[3]);
        }
      }
  return vb.build();
}

export function heroLook(mat, fill = 0.4, rim = 0.9) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHeroFill = { value: fill };
    sh.uniforms.uHeroRim = { value: rim };
    sh.fragmentShader =
      'uniform float uHeroFill, uHeroRim;\n' +
      sh.fragmentShader
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
      float heroNdv = abs(dot(normal, normalize(vViewPosition)));
      float heroFl = max(dot(normal, normalize(vec3(-0.4, 0.55, 0.75))), 0.0) * 0.8 + 0.2;
      vec3 heroExtra = diffuseColor.rgb * uHeroFill * heroFl * vec3(0.78, 0.84, 1.0)
        + max(diffuseColor.rgb, vec3(0.4)) * uHeroRim * pow(1.0 - heroNdv, 2.2) * vec3(1.0, 0.7, 0.45);   // rim floor: black lamellar still gets an edge`,
        )
        .replace(
          '#include <opaque_fragment>',
          `
      outgoingLight += heroExtra * (1.0 - smoothstep(0.2, 0.85, dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722))));
      #include <opaque_fragment>`,
        );
  };
  mat.customProgramCacheKey = () => `hero-look-${fill}-${rim}`;
  return mat;
}
