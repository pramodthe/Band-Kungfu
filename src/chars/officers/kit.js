// Enemy builder (content for the crowd view's officer-model hook, src/crowd/view.js header): part box lists in the crowd's
// soldier space (metres, feet at 0, facing +Z; pelvis 0.86 · neck +0.5 over the waist · shoulders ±0.235 @ +0.43 · hand
// −0.5 below the shoulder · knee −0.42) and weapon / off-hand box lists (weapon space: grip at the origin, +Z along the
// weapon; off-hand: the left hand frame). Arena fighters wear hoodies, vests, visors and headsets.
// Every face is a generic voxel face (no real person's likeness), no brand marks anywhere.
import { shade } from '../../core/voxel.js';
import { hash01 } from '../../core/rng.js';

export const b = (a, bb, c, paint) => ({ a, b: bb, c, paint });
export const box = (s, p, c, r) => ({ s, p, c, r });

/** Human head (neck at y 0, crown ≈ 0.3, face toward +Z). opts: hair (colour | null = bald / covered), hood (colour: a
 *  hood up over the head), visor (colour: a glowing band over the eyes), mask (colour: a full-face mask with narrow eye
 *  slits), maskTrim, helmet { c, crest? (colour: a tall crest front to back), cheek? }, headset (colour), cap (colour),
 *  brows (heavy), horns (colour: two short antenna horns). */
export function humanHead(C, o = {}) {
  const h = [
    b([-0.095, 0.02, -0.09], [0.095, 0.25, 0.1], C.skin),                               // skull
    b([-0.095, 0.02, 0.06], [0.095, 0.06, 0.1], C.skinD, true),                          // jaw shadow
    b([-0.065, 0.125, 0.095], [-0.03, 0.15, 0.106], C.eye ?? 0x151515, true), b([0.03, 0.125, 0.095], [0.065, 0.15, 0.106], C.eye ?? 0x151515, true),
    b([-0.075, 0.16, 0.095], [-0.02, 0.18 + (o.brows ? 0.015 : 0), 0.11], C.brow ?? 0x241c18, true),
    b([0.02, 0.16, 0.095], [0.075, 0.18 + (o.brows ? 0.015 : 0), 0.11], C.brow ?? 0x241c18, true),
    b([-0.015, 0.08, 0.1], [0.02, 0.13, 0.125], C.skinD),                                // nose
    b([-0.03, 0.05, 0.1], [0.03, 0.06, 0.105], shade(C.skinD, 0.8), true),              // mouth
  ];
  if (o.hair != null) h.push(b([-0.105, 0.18, -0.105], [0.105, 0.29, 0.085], o.hair), b([-0.105, 0.06, -0.105], [0.105, 0.2, -0.05], o.hair),
    b([-0.108, 0.12, -0.05], [-0.09, 0.22, 0.05], o.hair), b([0.09, 0.12, -0.05], [0.108, 0.22, 0.05], o.hair));
  if (o.cap != null) h.push(b([-0.11, 0.2, -0.11], [0.11, 0.3, 0.1], o.cap), b([-0.1, 0.2, 0.08], [0.1, 0.225, 0.2], shade(o.cap, 0.8)));
  if (o.hood != null) h.push(b([-0.125, 0.0, -0.13], [0.125, 0.33, 0.06], o.hood), b([-0.125, 0.22, 0.06], [0.125, 0.33, 0.125], o.hood),   // crown + brim
    b([-0.125, 0.0, 0.06], [-0.095, 0.24, 0.115], o.hood), b([0.095, 0.0, 0.06], [0.125, 0.24, 0.115], o.hood),                           // cheeks
    b([-0.09, 0.3, -0.16], [0.09, 0.36, 0.0], shade(o.hood, 0.85)));                                                                       // peak
  if (o.helmet) {
    const H = o.helmet;
    h.push(b([-0.125, 0.16, -0.13], [0.125, 0.32, 0.115], H.c), b([-0.1, 0.32, -0.1], [0.1, 0.345, 0.08], shade(H.c, 1.25)),
      b([-0.125, 0.03, -0.13], [0.125, 0.18, -0.06], H.c));                             // neck guard
    if (H.cheek) h.push(b([-0.13, 0.02, -0.06], [-0.1, 0.18, 0.08], H.c), b([0.1, 0.02, -0.06], [0.13, 0.18, 0.08], H.c));
    if (H.crest != null) h.push(b([-0.03, 0.3, -0.2], [0.03, 0.5, 0.12], H.crest), b([-0.03, 0.2, -0.24], [0.03, 0.42, -0.18], shade(H.crest, 0.8)));
  }
  if (o.mask != null) h.push(b([-0.1, 0.02, 0.09], [0.1, 0.26, 0.125], o.mask),
    b([-0.075, 0.13, 0.124], [-0.02, 0.155, 0.15], 0x0a0a0c), b([0.02, 0.13, 0.124], [0.075, 0.155, 0.15], 0x0a0a0c),   // narrow eye slits
    b([-0.04, 0.05, 0.124], [0.04, 0.065, 0.14], 0x0a0a0c),                                                           // mouth slit
    b([-0.1, 0.24, 0.085], [0.1, 0.262, 0.13], o.maskTrim ?? shade(o.mask, 0.7)));
  if (o.visor != null) h.push(b([-0.11, 0.115, 0.1], [0.11, 0.165, 0.135], o.visor), b([-0.115, 0.125, -0.02], [-0.1, 0.155, 0.1], 0x1a1a1f),
    b([0.1, 0.125, -0.02], [0.115, 0.155, 0.1], 0x1a1a1f));
  if (o.headset != null) h.push(b([-0.13, 0.08, -0.04], [-0.105, 0.2, 0.04], o.headset), b([0.105, 0.08, -0.04], [0.13, 0.2, 0.04], o.headset),
    b([-0.12, 0.29, -0.02], [0.12, 0.31, 0.02], o.headset), b([-0.13, 0.07, 0.03], [-0.115, 0.085, 0.14], o.headset));   // band + boom mic
  if (o.horns != null) h.push(b([-0.09, 0.3, -0.03], [-0.06, 0.46, 0.0], o.horns), b([0.06, 0.3, -0.03], [0.09, 0.46, 0.0], o.horns));
  return h;
}

/** Body parts. C keys: shirt, pants, boot, skin, belt, buckle, glove; opts: bulk (width ×), hoodie (colour: a hoodie with
 *  a front pocket and a hood lying on the back unless `hoodUp`), jacket (colour: open jacket over the shirt), vest (colour:
 *  an armour vest), bands (colour: glowing bands on the torso + arms), coat (colour: a long coat to the knee), trim (coat
 *  edge colour), cape (colour: a short cape down the back), chain (gold chain), bare (arms: skin forearms), pads (colour:
 *  shin guards), pack (colour: a backpack). */
export function humanBody(C, o = {}) {
  const w = (v) => v * (o.bulk ?? 1), S = o.hoodie ?? o.jacket ?? C.shirt;
  const p = {};
  p.hips = [
    b([-w(0.16), -0.1, -0.1], [w(0.16), 0.06, 0.1], C.pants),
    b([-w(0.17), -0.01, -0.11], [w(0.17), 0.05, 0.11], C.belt ?? 0x1c1c1c),
    b([-0.03, 0.0, 0.105], [0.03, 0.05, 0.125], C.buckle ?? 0x6a6c70),
  ];
  p.torso = [
    b([-w(0.15), -0.04, -0.1], [w(0.15), 0.22, 0.1], C.shirt),
    b([-w(0.18), 0.18, -0.115], [w(0.18), 0.46, 0.115], C.shirt),
    b([-0.07, 0.44, -0.07], [0.07, 0.5, 0.07], C.skin),                                  // neck
  ];
  if (o.hoodie != null) {
    const H = o.hoodie;
    p.torso.push(b([-w(0.19), -0.08, -0.125], [w(0.19), 0.47, 0.125], (x, y, z, i, j) => (j % 5 === 0 ? shade(H, 0.88) : H)),
      b([-w(0.12), 0.0, 0.12], [w(0.12), 0.14, 0.14], shade(H, 0.8)),                    // front pocket
      b([-0.015, 0.2, 0.12], [-0.005, 0.42, 0.135], 0xe0e0e0), b([0.005, 0.2, 0.12], [0.015, 0.42, 0.135], 0xe0e0e0));   // drawstrings
    if (!o.hoodUp) p.torso.push(b([-0.12, 0.36, -0.2], [0.12, 0.5, -0.12], shade(H, 0.9)));   // hood down on the back
  }
  if (o.vest != null) p.torso.push(b([-w(0.165), 0.02, -0.12], [w(0.165), 0.44, 0.125], (x, y, z, i, j) => (j % 4 === 0 ? shade(o.vest, 0.8) : o.vest)));
  if (o.jacket != null) p.torso.push(b([-w(0.19), -0.06, -0.125], [w(0.19), 0.46, 0.12], (x, y, z) => (z > 0.1 && Math.abs(x) < 0.07 ? null : o.jacket)),
    b([-0.06, 0.34, 0.11], [-0.02, 0.46, 0.13], shade(o.jacket, 1.2)), b([0.02, 0.34, 0.11], [0.06, 0.46, 0.13], shade(o.jacket, 1.2)));   // lapels
  if (o.chain) p.torso.push(b([-0.085, 0.38, 0.1], [-0.03, 0.4, 0.132], 0xd8b040), b([-0.035, 0.34, 0.1], [0.035, 0.37, 0.132], 0xd8b040),
    b([0.03, 0.38, 0.1], [0.085, 0.4, 0.132], 0xd8b040));
  if (o.bands != null) p.torso.push(b([-w(0.195), 0.12, -0.13], [w(0.195), 0.15, 0.135], o.bands), b([-w(0.195), 0.3, -0.13], [w(0.195), 0.33, 0.135], o.bands));
  if (o.coat != null) {
    p.torso.push(b([-w(0.2), -0.06, -0.13], [w(0.2), 0.47, 0.13], (x, y, z) => (z > 0.11 && Math.abs(x) < 0.05 ? null : o.coat)),
      b([-0.1, 0.4, -0.14], [0.1, 0.52, 0.08], o.trim ?? shade(o.coat, 1.4)));           // high collar
    p.hips.push(b([-w(0.21), -0.5, -0.15], [w(0.21), 0.04, 0.15], (x, y, z) => (z > 0.12 && Math.abs(x) < 0.06 ? null : y < -0.46 ? o.trim ?? shade(o.coat, 1.4) : o.coat)));
  }
  if (o.cape != null) p.torso.push(b([-w(0.2), -0.34, -0.19], [w(0.2), 0.46, -0.135], (x, y, z, i, j, k) => (y < -0.28 && hash01(i, 5, 2) < 0.4 ? null : j % 6 === 0 ? shade(o.cape, 0.8) : o.cape)));
  if (o.pack != null) p.torso.push(b([-0.13, 0.08, -0.24], [0.13, 0.42, -0.12], o.pack), b([-0.1, 0.3, -0.26], [0.1, 0.36, -0.24], shade(o.pack, 1.5)));
  p.arm = [
    b([-0.055, -0.24, -0.06], [0.055, 0.03, 0.06], S),
    b([-0.055, -0.46, -0.058], [0.055, -0.22, 0.058], o.bare ? C.skin : S),
    b([-0.045, -0.56, -0.05], [0.045, -0.46, 0.05], C.glove ?? C.skin),
  ];
  if (o.bands != null) p.arm.push(b([-0.06, -0.34, -0.063], [0.06, -0.31, 0.063], o.bands));
  if (o.coat != null) p.arm = [b([-0.065, -0.44, -0.065], [0.065, 0.03, 0.065], o.coat), b([-0.07, -0.46, -0.07], [0.07, -0.42, 0.07], o.trim ?? shade(o.coat, 1.4)),
    b([-0.045, -0.56, -0.05], [0.045, -0.46, 0.05], C.glove ?? C.skin)];
  p.thigh = [b([-0.068, -0.43, -0.072], [0.068, 0.02, 0.072], C.pants)];
  p.shin = [b([-0.062, -0.3, -0.066], [0.062, 0.02, 0.066], C.pants), b([-0.07, -0.42, -0.078], [0.07, -0.29, 0.13], C.boot),
    b([-0.072, -0.42, -0.08], [0.072, -0.4, 0.132], C.sole ?? shade(C.boot, 1.8))];
  if (o.pads != null) p.shin.push(b([-0.07, -0.26, 0.05], [0.07, 0.04, 0.1], o.pads));
  return p;
}

/** Round shield in the left hand frame (a disc of boxes, a rim, a centre boss). */
export function roundShield(c, rim, r = 0.34, zo = 0.12) {
  const out = [];
  for (let k = -3; k <= 3; k++) { const h = Math.sqrt(Math.max(0, 1 - (k / 3.5) ** 2)) * r * 2; out.push(box([r * 2 / 7 + 0.005, h, 0.035], [k * r * 2 / 7, 0.05, zo], k % 2 ? c : shade(c, 0.92))); }
  out.push(box([r * 2 + 0.02, 0.03, 0.04], [0, 0.05 + r, zo], rim), box([r * 2 + 0.02, 0.03, 0.04], [0, 0.05 - r, zo], rim), box([0.1, 0.1, 0.03], [0, 0.05, zo + 0.03], rim));
  return out;
}
/** A straight rod along +Z (grip at 0): from `butt` to `tip`, width w, colour c, darker bands every `node` m. */
export function stick(c, { butt = -0.2, tip = 0.6, w = 0.04, node = 0, nodeC = shade(c, 0.7) } = {}) {
  const out = [box([w, w, tip - butt], [0, 0, (tip + butt) / 2], c)];
  if (node) for (let z = butt + node; z < tip - 0.05; z += node) out.push(box([w + 0.012, w + 0.012, 0.03], [0, 0, z], nodeC));
  return out;
}
/** A keyboard swung like a club (weapon space): the board lies along +Z, keys on its +Y face. */
export const keyboard = (c = 0x1c1e24, keys = 0x3a3f4a, glow = null) => [box([0.2, 0.03, 0.62], [0, 0, 0.36], c), box([0.17, 0.012, 0.56], [0, 0.02, 0.36], keys),
  box([0.04, 0.04, 0.16], [0, 0, 0.0], 0x111111), ...(glow != null ? [box([0.205, 0.008, 0.625], [0, -0.018, 0.36], glow)] : [])];
