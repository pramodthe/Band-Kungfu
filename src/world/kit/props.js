// Map render kit — props as box lists (render-only). A prop builder returns boxes in its own frame (metres, origin on
// the floor at its centre, +Z = its front); place() moves them into the world, merge() bakes a list into one geometry
// (src/core/voxel.js boxesGeometry: { s: [w, h, d], p: [cx, cy, cz], c, r? }). A prop with lights returns
// { body, lit }: `lit` boxes go into an unlit bright mesh so they bloom (LEDs, screens, neon).
// Arena set: shipping containers, pallet racks, server racks, crates, barrels, forklifts, cable reels, hazard
// barriers, steel pillars, roof trusses, hanging lamps, the mainframe tower. Generic designs: no brands, no logos.
import * as THREE from 'three';
import { boxesGeometry, shade } from '../../core/voxel.js';
import { hash01 } from '../../core/rng.js';

export const bx = (s, p, c, r) => ({ s, p, c, r });
const _qy = new THREE.Quaternion(), _ql = new THREE.Quaternion(), _e = new THREE.Euler(), _Y = new THREE.Vector3(0, 1, 0);
/** Boxes of a prop frame → world: rotate by yaw about Y (composed with each box's own rotation), scale k, lift y, move. */
export function place(boxes, x, y, z, yaw = 0, k = 1) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  _qy.setFromAxisAngle(_Y, yaw);
  return boxes.map((q) => {
    const [px, py, pz] = q.p;
    let r = [0, yaw, 0];
    if (q.r) { _ql.setFromEuler(_e.set(q.r[0], q.r[1], q.r[2], 'XYZ')); _ql.premultiply(_qy); _e.setFromQuaternion(_ql, 'XYZ'); r = [_e.x, _e.y, _e.z]; }
    return { s: q.s.map((v) => v * k), p: [x + (px * c + pz * s) * k, y + py * k, z + (-px * s + pz * c) * k], c: q.c, r };
  });
}
export const merge = (boxes) => boxesGeometry(boxes);
export const propMaterial = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8, metalness: 0.05, ...o });

export const STEEL = 0x5a626c, STEEL_D = 0x353b44, CONCRETE = 0x6e7278, HAZARD = 0xf2c230, CARDBOARD = 0xa9835a;
export const NEON = { cyan: 0x38e8ff, green: 0x46ff8a, magenta: 0xff3ea8, amber: 0xffb02e, red: 0xff3a3a, violet: 0x9a6bff };
export const CONTAINER_COLS = [0x2f6f8f, 0x8f3a2f, 0x3f7a4a, 0xb08a2a, 0x4a4f78, 0x7a7f86];

/** 20 ft shipping container along +Z (6.1 × 2.6 × 2.44 m): corrugated sides (ribs), door bars on the front. */
export function container(c = 0x2f6f8f, L = 6.1) {
  const out = [bx([2.44, 2.6, L], [0, 1.3, 0], c)];
  const n = Math.round(L / 0.5);
  for (let k = 0; k < n; k++) {
    const z = -L / 2 + (k + 0.5) * L / n;
    for (const sx of [-1, 1]) out.push(bx([0.06, 2.3, L / n * 0.45], [sx * 1.24, 1.3, z], shade(c, 0.8)));
  }
  out.push(bx([2.5, 0.16, L + 0.06], [0, 2.56, 0], shade(c, 0.7)), bx([2.5, 0.16, L + 0.06], [0, 0.08, 0], shade(c, 0.6)));
  for (const x of [-0.7, -0.25, 0.25, 0.7]) out.push(bx([0.06, 2.3, 0.06], [x, 1.3, L / 2 + 0.03], 0xb8bcc2));
  out.push(bx([0.04, 2.4, 0.05], [0, 1.3, L / 2 + 0.03], shade(c, 0.5)));
  return out;
}

/** Cardboard crate / wooden crate. */
export const crate = (s = 1, c = CARDBOARD) => [bx([s, s, s], [0, s / 2, 0], c), bx([s + 0.02, 0.08 * s, s + 0.02], [0, s * 0.5, 0], shade(c, 0.75)),
  bx([0.12 * s, s + 0.02, s + 0.02], [0, s / 2, 0], shade(c, 0.85))];

/** Pallet rack bay along +Z (length L, depth 1.2, 3 shelves): orange beams, blue uprights, boxes on the shelves. */
export function palletRack(L = 8, seed = 0, h = 6) {
  const out = [], UP = 0x2a4f9a, BEAM = 0xe0782a;
  for (let z = -L / 2; z <= L / 2 + 0.01; z += L / Math.round(L / 2.7)) for (const x of [-0.6, 0.6]) out.push(bx([0.1, h, 0.1], [x, h / 2, z], UP));
  for (let s = 0; s < 3; s++) {
    const sy = s * (h - 0.6) / 3;
    for (const x of [-0.6, 0.6]) out.push(bx([0.08, 0.14, L], [x, sy + 1.75, 0], BEAM));
    out.push(bx([1.2, 0.05, L], [0, sy + 1.84, 0], 0x8a7a5a));
    for (let k = 0, z = -L / 2 + 0.7; z < L / 2 - 0.5; k++) {
      const w = 0.7 + hash01(seed, s, k) * 0.7, hh = 0.5 + hash01(seed + 1, s, k) * 0.9;
      if (hash01(seed + 2, s, k) > 0.2) out.push(bx([1.0, hh, w], [0, sy + 1.87 + hh / 2, z + w / 2], [CARDBOARD, shade(CARDBOARD, 0.85), 0x8f9aa6, 0x6d5a44][(seed + s + k) % 4]));
      z += w + 0.2;
    }
  }
  // floor level: pallets with boxes
  for (let k = 0, z = -L / 2 + 0.8; z < L / 2 - 0.6; k++) {
    out.push(bx([1.1, 0.14, 1.1], [0, 0.07, z + 0.55], 0x8a6a44));
    const hh = 0.7 + hash01(seed + 3, k) * 0.8;
    out.push(bx([1.0, hh, 1.0], [0, 0.14 + hh / 2, z + 0.55], [CARDBOARD, 0x7c8894, shade(CARDBOARD, 0.8)][(seed + k) % 3]));
    z += 1.4;
  }
  return out;
}

/** Server rack row along +Z: black cabinets 0.8 deep (along X) × 2.1 tall, LEDs on the side that faces −X and +X.
 *  → { body, lit }. */
export function serverRack(L = 10, seed = 0, tint = NEON.cyan) {
  const body = [bx([1.6, 2.3, L], [0, 1.15, 0], 0x15181d), bx([1.7, 0.1, L + 0.1], [0, 2.35, 0], 0x272c34), bx([1.7, 0.12, L + 0.1], [0, 0.06, 0], 0x0c0e11)];
  const lit = [], n = Math.round(L / 0.8);
  for (let k = 0; k < n; k++) {
    const z = -L / 2 + (k + 0.5) * L / n;
    for (const sx of [-1, 1]) {
      body.push(bx([0.04, 2.1, 0.05], [sx * 0.81, 1.15, z + L / n / 2 - 0.03], 0x2f353e));
      for (let r = 0; r < 9; r++) {
        const h = hash01(seed + k * 7, r, sx + 3);
        if (h < 0.35) continue;
        const col = h > 0.93 ? NEON.red : h > 0.8 ? NEON.amber : h > 0.62 ? NEON.green : tint;
        lit.push(bx([0.03, 0.04, 0.1 + hash01(seed, k, r) * 0.3], [sx * 0.82, 0.35 + r * 0.2, z - 0.12 + hash01(r, k, seed) * 0.2], col));
      }
    }
  }
  lit.push(bx([0.06, 0.06, L], [0, 2.43, 0], tint));                   // light strip along the top
  return { body, lit };
}

/** Forklift (+Z = forks). */
export const forklift = (c = 0xe8b02a) => [
  bx([1.2, 0.7, 2.0], [0, 0.65, -0.3], c), bx([1.1, 0.5, 0.9], [0, 1.1, -0.9], shade(c, 0.85)),
  bx([0.06, 1.5, 0.06], [-0.5, 1.75, -0.2], 0x2a2a2a), bx([0.06, 1.5, 0.06], [0.5, 1.75, -0.2], 0x2a2a2a),
  bx([0.06, 1.5, 0.06], [-0.5, 1.75, -1.0], 0x2a2a2a), bx([0.06, 1.5, 0.06], [0.5, 1.75, -1.0], 0x2a2a2a),
  bx([1.2, 0.08, 1.0], [0, 2.52, -0.6], 0x2a2a2a), bx([0.5, 0.5, 0.4], [0, 1.25, -0.45], 0x1a1a1a),
  bx([0.1, 2.6, 0.12], [-0.4, 1.4, 0.8], STEEL_D), bx([0.1, 2.6, 0.12], [0.4, 1.4, 0.8], STEEL_D), bx([1.0, 0.1, 0.12], [0, 2.6, 0.8], STEEL_D),
  bx([0.12, 0.06, 1.2], [-0.3, 0.12, 1.45], 0x3a3f46), bx([0.12, 0.06, 1.2], [0.3, 0.12, 1.45], 0x3a3f46),
  ...[[-0.6, 0.35, 0.4], [0.6, 0.35, 0.4], [-0.6, 0.3, -1.0], [0.6, 0.3, -1.0]].map(([x, y, z]) => bx([0.3, y * 2, y * 2], [x, y, z], 0x111111)),
];

/** Steel drum. */
export const barrel = (c = 0x2a6f9a) => [bx([0.6, 0.9, 0.6], [0, 0.45, 0], c), bx([0.64, 0.05, 0.64], [0, 0.3, 0], shade(c, 0.7)), bx([0.64, 0.05, 0.64], [0, 0.62, 0], shade(c, 0.7)),
  bx([0.5, 0.03, 0.5], [0, 0.91, 0], shade(c, 1.2))];

/** Cable reel on its side. */
export const cableReel = () => [bx([0.16, 1.5, 1.5], [-0.5, 0.75, 0], 0x8a6a44), bx([0.16, 1.5, 1.5], [0.5, 0.75, 0], 0x8a6a44), bx([0.9, 1.0, 1.0], [0, 0.75, 0], 0x15181d)];

/** Striped hazard barrier along X (width w). */
export function hazardBarrier(w = 2.4) {
  const out = [bx([0.1, 1.0, 0.4], [-w / 2, 0.5, 0], 0x2a2a2a), bx([0.1, 1.0, 0.4], [w / 2, 0.5, 0], 0x2a2a2a)];
  const n = Math.round(w / 0.3);
  for (let k = 0; k < n; k++) out.push(bx([w / n, 0.26, 0.06], [-w / 2 + (k + 0.5) * w / n, 0.8, 0], k % 2 ? HAZARD : 0x1a1a1a));
  return out;
}

/** Square steel pillar (H-column look) h tall, with a hazard-striped foot. */
export const pillar = (h = 12, w = 1.2) => [bx([w, h, w], [0, h / 2, 0], STEEL_D), bx([w + 0.16, 0.2, w + 0.16], [0, h - 0.4, 0], STEEL),
  bx([w + 0.06, 0.4, w + 0.06], [0, 0.2, 0], HAZARD), bx([w + 0.06, 0.4, w + 0.06], [0, 0.6, 0], 0x1a1a1a), bx([w + 0.06, 0.4, w + 0.06], [0, 1.0, 0], HAZARD)];

/** Roof truss across X (span w) at height y: two chords and diagonals. */
export function truss(w, y = 13, depth = 0.3) {
  const out = [bx([w, 0.22, depth], [0, y, 0], STEEL_D), bx([w, 0.22, depth], [0, y + 1.4, 0], STEEL_D)];
  const n = Math.round(w / 3);
  for (let k = 0; k < n; k++) out.push(bx([0.14, 2.0, depth * 0.7], [-w / 2 + (k + 0.5) * w / n, y + 0.7, 0], STEEL, [0, 0, k % 2 ? 0.75 : -0.75]));
  return out;
}

/** Hanging industrial lamp: cable, shade, glow (→ { body, glow }; origin = the lamp's bulb). */
export const hangingLamp = (drop = 3) => ({ body: [bx([0.04, drop, 0.04], [0, drop / 2 + 0.2, 0], 0x1a1a1a), bx([0.9, 0.16, 0.9], [0, 0.26, 0], 0x2a2e33), bx([0.6, 0.2, 0.6], [0, 0.4, 0], 0x2a2e33)],
  glow: [bx([0.7, 0.08, 0.7], [0, 0.14, 0], 0xfff2d0)] });

/** The mainframe: a black monolith (w × h × d) with glowing seams, side fins and a crown ring. → { body, lit } */
export function mainframe(w = 8, h = 16, d = 8, tint = NEON.cyan) {
  const body = [bx([w, h, d], [0, h / 2, 0], 0x0d1014), bx([w + 1.2, 1.0, d + 1.2], [0, 0.5, 0], 0x1a1e24), bx([w + 0.6, 0.6, d + 0.6], [0, h + 0.3, 0], 0x1a1e24)];
  const lit = [];
  for (let k = 0; k < 7; k++) {
    const y = 1.6 + k * (h - 2.4) / 6;
    lit.push(bx([w + 0.06, 0.1, d + 0.06], [0, y, 0], k % 3 === 0 ? NEON.magenta : tint));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) lit.push(bx([0.14, h - 1.2, 0.14], [sx * (w / 2 + 0.02), h / 2 + 0.4, sz * (d / 2 + 0.02)], tint));
  for (const sx of [-1, 1]) body.push(bx([0.5, h * 0.7, d * 0.6], [sx * (w / 2 + 0.8), h * 0.4, 0], 0x15181d));
  // front face (−Z, toward the arena): a column of status windows
  for (let r = 0; r < 10; r++) for (let q = 0; q < 5; q++) {
    const on = hash01(r, q, 17);
    if (on < 0.3) continue;
    lit.push(bx([0.9, 0.5, 0.06], [-2.4 + q * 1.2, 2.4 + r * 1.2, -d / 2 - 0.03], on > 0.9 ? NEON.magenta : on > 0.75 ? NEON.green : tint));
  }
  return { body, lit };
}

/** Rolling shutter door leaf (w × h), slats along X; origin at its bottom centre. */
export function shutter(w = 18, h = 7) {
  const out = [], n = Math.round(h / 0.35);
  for (let k = 0; k < n; k++) out.push(bx([w, h / n * 0.92, 0.12], [0, (k + 0.5) * h / n, 0], k % 2 ? 0x6a727c : 0x5a626c));
  out.push(bx([w, 0.3, 0.2], [0, 0.15, 0], HAZARD));
  return out;
}
