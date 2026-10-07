// Crowd skins (src/crowd/view.js skin hook): foe `redguard` and ally `blueguard`.
// Head frame: soldier head space (neck at y 0, crown ≈ 0.32, face toward +Z), metres. The standard-bearer's pole carries
// a glowing monitor instead of cloth (flag: null).
// Weapon slots of the crowd rig: spear → antenna rod · sword (+ shield) → keyboard + a laptop-lid shield · glaive (the
// squad captain) → a halberd · pole (the bearer) → the banner on a pole.
import { shade } from '../../core/voxel.js';
import { keyboard } from './kit.js';

const box = (s, p, c) => ({ s, p, c });

/** Hood up, skin in its shadow, a glowing visor band over the eyes; captains and lieutenants add a headset. */
const hoodHead = (visor) => (C, officer, b) => [
  b([-0.1, 0.02, -0.09], [0.1, 0.25, 0.1], C.skin),
  b([-0.1, 0.02, 0.06], [0.1, 0.07, 0.1], C.skinD, true),
  b([-0.015, 0.07, 0.1], [0.02, 0.12, 0.125], C.skinD),
  b([-0.03, 0.045, 0.1], [0.03, 0.055, 0.105], shade(C.skinD, 0.75), true),
  b([-0.13, 0.0, -0.135], [0.13, 0.335, 0.06], C.helm), b([-0.13, 0.22, 0.06], [0.13, 0.335, 0.13], C.helm),      // hood: crown + brim
  b([-0.13, 0.0, 0.06], [-0.098, 0.24, 0.12], C.helm), b([0.098, 0.0, 0.06], [0.13, 0.24, 0.12], C.helm),         // hood cheeks
  b([-0.09, 0.31, -0.17], [0.09, 0.37, 0.0], C.helmHi),                                                            // peak
  b([-0.105, 0.115, 0.1], [0.105, 0.17, 0.137], officer ? shade(visor, 1.15) : visor),                              // visor
  ...(officer ? [b([-0.145, 0.06, -0.05], [-0.13, 0.2, 0.05], 0x2a2e36), b([0.13, 0.06, -0.05], [0.145, 0.2, 0.05], 0x2a2e36)] : []),
];

function weapons(glow, dark, rod) {
  return {
    spear: [box([0.035, 0.035, 1.7], [0, 0, 0.45], rod), box([0.05, 0.05, 0.1], [0, 0, -0.35], dark), box([0.07, 0.07, 0.07], [0, 0, 1.33], glow),
      box([0.02, 0.02, 0.22], [0, 0, 1.46], glow)],                                                                 // antenna rod, lit tip
    sword: keyboard(dark, 0x343944, glow),
    glaive: [box([0.05, 0.05, 2.0], [0, 0, 0.5], rod), box([0.06, 0.34, 0.5], [0, 0.06, 1.55], dark), box([0.064, 0.04, 0.46], [0, 0.22, 1.55], glow),
      box([0.064, 0.3, 0.03], [0, 0.06, 1.8], glow), box([0.07, 0.07, 0.08], [0, 0, 1.27], 0x8a9098)],              // rack-rail halberd
    pole: [box([0.05, 0.05, 3.0], [0, 0, 0.7], rod), box([0.9, 0.08, 0.6], [0, 0, 2.2], dark), box([0.8, 0.02, 0.5], [0, 0.05, 2.2], glow),
      box([0.8, 0.02, 0.5], [0, -0.05, 2.2], glow)],                                                                // a monitor held up
    shield: { rim: dark, a: 0x2a2e36, b: 0x23262d, boss: glow, ring: glow, far: 0x2a2e36 },                        // laptop lid
  };
}

// ---------------------------------------------------------------- red guards: dark hoodies, red visors
const BLACK_PAL = {
  armor: 0x1b1d23, hi: 0x2a2d35, lace: 0x121317, plate: 0x22252c, rivet: 0x2f333c,
  cloth: 0x1b1d23, pants: 0x23262e, wrap: 0x23262e, wrapD: 0x191b21, boot: 0x0e0e10,
  skin: 0xd6a67e, skinD: 0xa87e5c, eye: 0x151515, brow: 0x201a18,
  helm: 0x17181d, helmHi: 0x262930, band: 0x17181d, tassel: 0xff3a3a, belt: 0x0e0e10, buckle: 0x5a5e66, bracer: 0x2a2d35,
};
const BLACK_OFF = { ...BLACK_PAL, armor: 0x2a1820, hi: 0x4a2430, plate: 0x351c26, cloth: 0x2a1820, helm: 0x23141a, helmHi: 0x3a1e28, capeA: 0x5a1420, capeB: 0x7a1c2a };
export const REDGUARD = { palette: BLACK_PAL, officerPalette: BLACK_OFF, head: hoodHead(0xff3a3a),
  crest: (C, b) => [b([-0.14, 0.175, -0.14], [0.14, 0.2, 0.14], 0xff3a3a), b([-0.02, 0.36, -0.1], [0.02, 0.5, -0.06], 0xff3a3a)],
  weapons: weapons(0xff3a3a, 0x1a1c22, 0x3a3f48), flag: null };

// ---------------------------------------------------------------- blue guards (your team): white hoodies, cyan visors
const WHITE_PAL = {
  armor: 0xdfe4ea, hi: 0xf4f7fa, lace: 0xb8c0ca, plate: 0xe6eaef, rivet: 0xcfd6de,
  cloth: 0xdfe4ea, pants: 0x3a4250, wrap: 0x3a4250, wrapD: 0x2c323e, boot: 0xf0f0f0,
  skin: 0xe0b28a, skinD: 0xb88a64, eye: 0x151515, brow: 0x1e1814,
  helm: 0xe6eaef, helmHi: 0xffffff, band: 0xe6eaef, tassel: 0x38e8ff, belt: 0x2c323e, buckle: 0x38e8ff, bracer: 0xcfd6de,
};
export const BLUEGUARD = { palette: WHITE_PAL, head: hoodHead(0x38e8ff), weapons: weapons(0x38e8ff, 0xe6eaef, 0x9aa4b0), flag: null };
