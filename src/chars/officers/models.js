// Lieutenant + boss models (crowd view officer-model hook; ids used by the stage's OFF table, src/story/championship.js):
// lieutenants `sentinel`, bosses `crane` · `ox` · `viper` · `dragon` (+ `dragon_unmasked`, the final phase swap) · `echo`
// (DRAGON's copies). Scale: the crowd officer is 1.22 ≈ 1.06 × hero. Original designs. Beaten, not killed: they kneel.
import { shade } from '../../core/voxel.js';
import { humanHead, humanBody, roundShield, stick, keyboard, box } from './kit.js';

const SKIN = { skin: 0xd6a67e, skinD: 0xb48460, eye: 0x151515, brow: 0x241c18 };
const RED = 0xff3a3a, GREEN = 0x46ff8a, AMBER = 0xffb02e, MAGENTA = 0xff3ea8;

// ---------------------------------------------------------------- sentinel (lieutenant): grey hoodie, headset, a lit keyboard
const SYS = { ...SKIN, shirt: 0x2a2d35, pants: 0x23262e, boot: 0x141414, glove: 0x1a1a1a };
export const SENTINEL = {
  parts: { ...humanBody(SYS, { bulk: 1.05, hoodie: 0x3a3f4a, bands: RED }), head: humanHead(SYS, { hair: 0x141414, visor: RED, headset: 0x1a1c22 }) },
  weapon: keyboard(0x1a1c22, 0x3a3f4a, RED).map((q) => ({ ...q, s: q.s.map((v) => v * 1.5), p: q.p.map((v) => v * 1.5) })),
  offhand: roundShield(0x2a2e36, RED, 0.3),
  scale: 1.2, tip: 0.95, voxel: 0.03, kneel: true,
};

// ---------------------------------------------------------------- CRANE: green hoodie, fisherman's hat, a rod with a glowing lure
const PHI = { ...SKIN, shirt: 0x1e2a22, pants: 0x2a3028, boot: 0x3a2e1e, glove: 0x1a1a1a };
const ROD = [...stick(0x2e3a30, { butt: -0.35, tip: 1.7, w: 0.04, node: 0.45, nodeC: 0x8a9a6a }), box([0.1, 0.12, 0.12], [0, -0.07, 0.1], 0x8a9098),   // reel
  box([0.015, 0.015, 0.5], [0, -0.18, 1.62], 0xdfe6ea, [0.75, 0, 0])];                                                                     // line
const LURE = [box([0.14, 0.14, 0.14], [0, -0.38, 1.82], GREEN), box([0.05, 0.16, 0.05], [0, -0.5, 1.82], 0xdfe6ea), box([0.12, 0.04, 0.04], [0.04, -0.58, 1.82], 0xdfe6ea)];
export const CRANE = {
  parts: { ...humanBody(PHI, { bulk: 1.08, hoodie: 0x2f7a4a, pack: 0x1e2a22 }), head: humanHead(PHI, { cap: 0x3a5a3a, hair: 0x2a1c14, visor: GREEN }) },
  weapon: [...ROD, ...LURE],
  broken: { haft: [...ROD], head: [box([0.14, 0.14, 0.14], [0, 0, 0], shade(GREEN, 0.4)), box([0.05, 0.05, 0.16], [0.1, 0, 0.05], 0xdfe6ea)] },
  scale: 1.26, tip: 1.7, voxel: 0.028, kneel: true,
};

// ---------------------------------------------------------------- OX: heavy, bronze plate vest, crested helmet, a ram-headed maul
const TRO = { ...SKIN, shirt: 0x3a2e24, pants: 0x2e2620, boot: 0x1a1410, glove: 0x2a1e16 };
const BRONZE = 0xb07a3a;
const MAUL_HAFT = [box([0.06, 0.06, 1.4], [0, 0, 0.4], 0x4a3220), box([0.09, 0.09, 0.14], [0, 0, -0.32], BRONZE), box([0.08, 0.08, 0.05], [0, 0, 1.06], BRONZE)];
const maulHead = (z) => [box([0.3, 0.3, 0.44], [0, 0, z], 0x6a4a2a), box([0.34, 0.34, 0.08], [0, 0, z + 0.2], BRONZE), box([0.34, 0.34, 0.08], [0, 0, z - 0.2], BRONZE),
  box([0.12, 0.2, 0.2], [0, 0.22, z + 0.05], 0x8a5a2a), box([0.08, 0.1, 0.12], [0, 0.34, z + 0.16], 0x8a5a2a)];               // a horse-head profile on top
export const OX = {
  parts: { ...humanBody(TRO, { bulk: 1.3, vest: BRONZE, cape: 0x7a1c2a, pads: BRONZE }), head: humanHead(TRO, { helmet: { c: BRONZE, crest: 0xb3261e, cheek: true }, brows: true }) },
  weapon: [...MAUL_HAFT, ...maulHead(1.3)],
  cracked: [...MAUL_HAFT, ...maulHead(1.3), box([0.31, 0.012, 0.3], [0, 0.04, 1.3], 0x0a0a0a), box([0.012, 0.31, 0.2], [0.05, 0, 1.32], 0x0a0a0a),
    box([0.36, 0.36, 0.04], [0, 0, 1.53], 0xff5a2a)],                                  // cracks + the striking face glowing on rage
  crackAt: 0.25,
  broken: { haft: [...MAUL_HAFT], head: [box([0.16, 0.3, 0.4], [-0.1, 0, 0.15], 0x6a4a2a), box([0.15, 0.3, 0.38], [0.12, -0.02, 0.1], 0x5e422a)] },
  offhand: roundShield(BRONZE, 0x5a3a1a, 0.4),
  scale: 1.34, tip: 1.5, voxel: 0.028, kneel: true,
};

// ---------------------------------------------------------------- VIPER: long dark coat with amber trim, a masked face, a padlock flail
const RAN = { ...SKIN, shirt: 0x1a1a20, pants: 0x1a1a20, boot: 0x0e0e12, glove: 0x14141a };
const LOCK_HAFT = [box([0.05, 0.05, 1.1], [0, 0, 0.3], 0x2a2a30), box([0.07, 0.07, 0.06], [0, 0, -0.26], AMBER), box([0.03, 0.03, 0.4], [0, -0.1, 1.0], 0x8a9098, [0.5, 0, 0])];
const LOCK = [box([0.3, 0.26, 0.14], [0, -0.3, 1.2], AMBER), box([0.06, 0.2, 0.06], [-0.09, -0.1, 1.2], 0x8a9098), box([0.06, 0.2, 0.06], [0.09, -0.1, 1.2], 0x8a9098),
  box([0.24, 0.06, 0.06], [0, 0.0, 1.2], 0x8a9098), box([0.06, 0.1, 0.15], [0, -0.3, 1.2], 0x1a1a20)];
export const VIPER = {
  parts: { ...humanBody(RAN, { bulk: 1.12, coat: 0x23232b, trim: AMBER }), head: humanHead(RAN, { hood: 0x23232b, mask: 0xe8e0d0, maskTrim: AMBER }) },
  weapon: [...LOCK_HAFT, ...LOCK],
  broken: { haft: [...LOCK_HAFT], head: [box([0.3, 0.14, 0.26], [0, 0, 0], shade(AMBER, 0.6)), box([0.24, 0.06, 0.06], [0.2, 0, 0.1], 0x8a9098)] },
  scale: 1.3, tip: 1.4, voxel: 0.028, kneel: true,
};

// ---------------------------------------------------------------- DRAGON (the champion): black coat, magenta circuitry, a crown of
// antennae, a chrome mask; a long data-blade. Final phase: the mask comes off (dragon_unmasked).
const ROO = { ...SKIN, skin: 0xd8b090, shirt: 0x14141a, pants: 0x14141a, boot: 0x0a0a0e, glove: 0x101016 };
const BLADE_HAFT = [box([0.05, 0.05, 0.6], [0, 0, 0.1], 0x1a1a20), box([0.07, 0.07, 0.05], [0, 0, -0.22], MAGENTA), box([0.2, 0.06, 0.05], [0, 0, 0.42], MAGENTA)];
const blade = (c) => [box([0.025, 0.11, 1.25], [0, 0, 1.08], 0xc8ced6), box([0.03, 0.03, 1.2], [0, 0, 1.08], c), box([0.025, 0.06, 0.12], [0, 0, 1.76], 0xeef3f8)];
const dragonBody = humanBody(ROO, { bulk: 1.18, coat: 0x1b1b22, trim: MAGENTA, bands: MAGENTA, cape: 0x2a0f22 });
export const DRAGON = {
  parts: { ...dragonBody, head: humanHead(ROO, { hair: 0x0e0e10, mask: 0xc8ced6, maskTrim: MAGENTA, horns: MAGENTA }) },
  weapon: [...BLADE_HAFT, ...blade(MAGENTA)],
  broken: { haft: [...BLADE_HAFT], head: [box([0.1, 0.03, 0.12], [-0.08, 0, 0], 0xc8ced6), box([0.09, 0.03, 0.11], [0.09, 0, 0.05], 0xb8bec6),
    box([0.04, 0.012, 0.04], [-0.07, 0.016, 0.02], 0x0a0a0c)] },                        // the mask, split in two
  scale: 1.4, tip: 1.8, voxel: 0.026, kneel: true,
};
export const DRAGON_UNMASKED = { ...DRAGON, parts: { ...dragonBody, head: humanHead({ ...ROO, brow: 0x141014 }, { hair: 0x0e0e10, brows: true, visor: MAGENTA, horns: MAGENTA }) } };

// ---------------------------------------------------------------- echo: a dim violet copy of DRAGON
const FRK = { ...ROO, skin: 0x3a3058, skinD: 0x2a2244, shirt: 0x2a2244, pants: 0x2a2244, glove: 0x2a2244, boot: 0x1e1834 };
export const ECHO = {
  parts: { ...humanBody(FRK, { coat: 0x2e2650, trim: 0x6a54b0 }), head: humanHead(FRK, { hair: 0x16122a, mask: 0x4a4070, maskTrim: 0x6a54b0, horns: 0x6a54b0 }) },
  weapon: [box([0.05, 0.05, 0.6], [0, 0, 0.1], 0x201a3a), ...blade(0x8a6bff).map((q) => ({ ...q, c: q.c === 0xc8ced6 ? 0x6a6490 : q.c }))],
  scale: 1.06, tip: 1.8, voxel: 0.03, kneel: false,
};
