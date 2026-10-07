// Pure helpers shared by the map engine (map.js) and the map definitions (maps/<id>/map.js): stable value noise, smoothstep,
// signed rect distance. No state, no THREE, no RNG state (hash01 only).
import { hash01 } from '../core/rng.js';

// smooth 2D value noise from the stable hash (no RNG state) — also used by the terrain/dressing builders
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash01(xi, zi, seed), b = hash01(xi + 1, zi, seed), c = hash01(xi, zi + 1, seed), d = hash01(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const noise2 = (x, z, seed = 1) => vnoise(x, z, seed) * 0.62 + vnoise(x * 2.3 + 7, z * 2.3 + 3, seed + 1) * 0.38;
export const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Inside value of rect [x0, z0, x1, z1] at (x, z): metres inside the edge (> 0), negative outside. */
export function rectIn(r, x, z) {
  const dx = Math.max(r[0] - x, x - r[2]), dz = Math.max(r[1] - z, z - r[3]);
  return dx > 0 || dz > 0 ? -Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : -Math.max(dx, dz);
}
