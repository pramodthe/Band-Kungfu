// Saruabh's clips: attack clips per move id (./moves.js) through the shared clip kit (baked planted feet), the Overclock clip,
// and the engine's locomotion with her own carry (both held low at her sides). Dual wield: the phone's selfie stick is the
// weapon joint (spear channel), the laptop the second weapon joint (spearL channel) with dual = 1 (the left fist on its
// grip). A channel = [x, y, z (grip, root space), yaw (0 fwd, + left), elev (+ up), roll].
import { P, clip, STANCE } from '../../hero/rig.js';
import { createClipKit } from '../shared/clipkit.js';
import { carry } from '../shared/loco.js';
import { lungeAt } from '../../hero/moveset.js';
import { MOVES } from './moves.js';

// ready stance: both held low, tips down, either side of the hips
const HOLD = { spear: [-0.3, 0.95, 0.22, 0, -60, 90], spearL: [0.3, 0.95, 0.22, 0, -60, -90], dual: 1, gripR: 0, lfree: 1, armL: [-20, 0, 25, 60] };
export const AN = { ...STANCE, ...HOLD, hipsR: [0, -15, 0], chest: [6, 4, 0] };
const ENTRY = { n2: 'n1', n3: 'n2', n4: 'n3', n5: 'n4', n6: 'n5', c2: 'n1', c3: 'n2', c4: 'n3', c5: 'n4', c6: 'n5' };
const { clipF } = createClipKit(MOVES, ENTRY, AN);
const L = (id, f) => lungeAt(MOVES[id], f);
const lead = (id, f, z = 0.2, x = 0.2, yaw = 12) => [x, 0.08, 0.3 + z + L(id, f), 0, yaw];

// ---- the vocabulary: wind-ups and cuts of either hand, both crossed high, both thrust open, both out level
const lWind = (e) => ({ spearL: [0.38, 1.3, 0.0, 110, 20, -90], chest: [0, 30, 0], hipsR: [0, 10, 0], ...e });
const lCut = (e) => ({ spearL: [-0.05, 1.1, 0.45, -50, -8, -90], chest: [8, -25, 0], hipsR: [0, -20, 0], ...e });
const rWind = (e) => ({ spear: [-0.5, 1.3, 0.0, -110, 25, 90], chest: [0, -35, 0], ...e });
const rCut = (e) => ({ spear: [0.05, 1.1, 0.45, 70, -5, 90], chest: [8, 30, 0], ...e });
const cross = (e) => ({ spear: [-0.15, 1.55, 0.25, 30, 70, 90], spearL: [0.15, 1.55, 0.25, -30, 70, -90], chest: [-6, 0, 0],
  hips: [0, 0.92, 0], hipsR: [0, 0, 0], ...e });
const open = (e) => ({ spear: [-0.45, 0.95, 0.35, -80, -25, 90], spearL: [0.45, 0.95, 0.35, 80, -25, -90], chest: [16, 0, 0],
  hips: [0, 0.8, 0.08], hipsR: [0, 0, 0], ...e });
const wings = (e) => ({ spear: [-0.55, 1.3, 0, -90, 0, 0], spearL: [0.55, 1.3, 0, 90, 0, 0], chest: [0, 0, 0], hipsR: [0, 0, 0], ...e });
const B = {};

function attacks() {
  const C = {};
  C.n1 = clipF('n1', [[0, B], [6, lWind()], [10, lCut({ fL: lead('n1', 10, 0.2) }), 'snap'], [15, lCut()], [24, B]]);
  C.n2 = clipF('n2', [[0, B], [5, rWind()], [10, rCut({ fR: [-0.18, 0.08, 0.05 + L('n2', 10), 0, -20] }), 'snap'], [15, rCut()], [24, B]]);
  C.n3 = clipF('n3', [[0, B], [8, cross()], [14, open({ fL: lead('n3', 14, 0.3) }), 'snap'], [20, open()], [30, B]]);
  C.n4 = clipF('n4', [[0, B], [5, { spearL: [-0.2, 1.15, 0.2, -100, 5, -90], chest: [4, -30, 0], hipsR: [0, -25, 0] }],
    [10, { spearL: [0.45, 1.1, 0.25, 110, -5, -90], chest: [6, 35, 0], hipsR: [0, 25, 0], fL: lead('n4', 10, 0.2) }, 'snap'],
    [16, { spearL: [0.48, 1.1, 0.2, 115, -5, -90], chest: [6, 38, 0], hipsR: [0, 26, 0] }], [26, B]]);
  // N5 camera flash: the phone chambered at the ear, thrust out at arm's length
  C.n5 = clipF('n5', [[0, B], [5, { spear: [-0.25, 1.3, -0.15, 0, 8, 90], chest: [0, -20, 0], hipsR: [0, -30, 0] }],
    [10, { spear: [-0.1, 1.3, 0.62, 0, 4, 90], chest: [12, 5, 0], hips: [0, 0.84, 0.1], hipsR: [0, -5, 0], fL: lead('n5', 10, 0.3) }, 'snap'],
    [16, { spear: [-0.1, 1.3, 0.58, 0, 4, 90], chest: [10, 5, 0], hips: [0, 0.85, 0.08] }], [28, B]]);
  C.n6 = clipF('n6', [[0, B], [6, wings({ hips: [0, 0.86, 0] })], [16, wings({ spin: -360, hips: [0, 0.84, 0.04] }), 'lin'],
    [22, open({ spin: -360 }), 'snap'], [34, open({ spin: -360, hips: [0, 0.8, 0.08] })], [44, { spin: -360 }]]);
  // C1 Live Stream: three turns forward, both out
  C.c1 = clipF('c1', [[0, B], [8, wings()], [44, wings({ spin: -1080 }), 'lin'], [50, { spin: -1080 }]]);
  // C2 Swipe
  C.c2 = clipF('c2', [[0, B], [10, cross({ hips: [0, 0.94, 0] })], [16, open({ fL: lead('c2', 16, 0.3) }), 'snap'], [28, open()], [40, B]]);
  // C3 Hook: crouch low, rip both up
  const low = { spear: [-0.15, 0.7, 0.45, -10, -30, 90], spearL: [0.15, 0.7, 0.45, 10, -30, -90], hips: [0, 0.72, 0.06], chest: [20, 0, 0], hipsR: [0, 0, 0] };
  const up = { spear: [-0.15, 1.6, 0.3, -5, 70, 90], spearL: [0.15, 1.6, 0.3, 5, 70, -90], hips: [0, 0.96, 0.04], chest: [-12, 0, 0], head: [-10, 0, 0], hipsR: [0, 0, 0] };
  C.c3 = clipF('c3', [[0, B], [8, low], [14, { ...up, fL: lead('c3', 14, 0.25) }, 'snap'], [26, up], [44, B]]);
  // C4 Firewall: the laptop held broadside in front of her like a shield (shaft to her left, flat face forward), the
  // phone cocked back; drive in, then the shove
  const shield = (z, e) => ({ spear: [-0.32, 1.2, z - 0.35, -20, 40, 90], spearL: [-0.17, 1.12, z, 90, 0, 90], chest: [14, 0, 0], hips: [0, 0.82, 0.08], hipsR: [0, 0, 0], ...e });
  C.c4 = clipF('c4', [[0, B], [8, shield(0.3, { chest: [8, 0, 0] })], [14, shield(0.45, { fL: lead('c4', 14, 0.3) }), 'snap'], [24, shield(0.48)],
    [30, shield(0.3, { chest: [4, 0, 0] })], [33, shield(0.7, { chest: [20, 0, 0], hips: [0, 0.8, 0.14], fL: lead('c4', 33, 0.35) }), 'snap'], [44, shield(0.65)], [56, B]]);
  // C5 Speed Dial: three dashing cuts, alternating
  C.c5 = clipF('c5', [[0, B], [6, lWind()], [11, lCut(), 'snap'], [18, rWind()], [23, rCut(), 'snap'], [30, cross()], [35, open(), 'snap'], [46, open()], [56, B]]);
  // C6 Going Viral: four turns, then both snap out
  C.c6 = clipF('c6', [[0, B], [8, wings()], [54, wings({ spin: -1440 }), 'lin'], [58, cross({ spin: -1440 })],
    [62, open({ spin: -1440 }), 'snap'], [72, open({ spin: -1440 })], [84, { spin: -1440 }]]);
  C.dash = clipF('dash', [[0, { spear: [-0.35, 1.0, -0.2, -150, -20, 90], spearL: [0.35, 1.0, -0.2, 150, -20, -90], chest: [14, 0, 0], hips: [0, 0.84, 0.06] }],
    [10, rCut(), 'snap'], [16, lCut(), 'snap'], [26, lCut()], [40, B]]);
  const AIR = { footL: [0.16, 0.36, 0.2, -20, 10], footR: [-0.18, 0.3, -0.12, 20, -20], hips: [0, 0.95, 0] };
  C.jatk = clip([[0, P({ ...AIR }, AN)], [4 / 18, P({ ...AIR, ...lCut() }, AN), 'snap'], [9 / 18, P({ ...AIR, ...rCut() }, AN), 'snap'], [1, P({ ...AIR, ...rCut() }, AN)]]);
  const Lj = MOVES.jc.landFrame, Fj = MOVES.jc.frames, Dj = MOVES.jc.plunge[0];
  const hang = { ...cross(), hips: [0, 1.0, 0.04], footL: [0.16, 0.5, 0.14, -30, 10], footR: [-0.18, 0.42, -0.12, 20, -20] };
  const land = { ...wings({ hips: [0, 0.66, 0.1], chest: [16, 0, 0] }), footL: [0.3, 0.08, 0.4, 0, 25], footR: [-0.3, 0.08, -0.3, 0, -50] };
  C.jc = clip([[0, P(AIR, AN)], [5 / Fj, P(hang, AN), 'out'], [(Dj - 1) / Fj, P(hang, AN)], [(Lj - 1) / Fj, P({ ...hang, spin: -360 }, AN), 'in'],
    [Lj / Fj, P({ ...land, spin: -360 }, AN), 'snap'], [(Lj + 8) / Fj, P({ ...land, spin: -360 }, AN)], [1, P({ spin: -360 }, AN)]], false, true);
  return C;
}

// ---------------------------------------------------------------- Overclock: VIRAL STORM (200 frames)
// 1 the zig-zag: six kick-and-jab cuts, one per dash leg (musou.js PATH) · 2 stops dead in the centre, the laptop snaps
// open: a spinning storm · 3 both thrust up: the burst ring
const MF = 200, mk = (f, spec, e) => [f / MF, P(spec, AN), e];
export const MUSOU_FRAMES = MF;
function musouClip() {
  const k = [mk(0, {}), mk(16, { hips: [0, 0.8, 0], chest: [16, 0, 0], spear: [-0.45, 1, 0.1, -100, 10, 90], spearL: [0.45, 1, 0.1, 100, 10, -90] })];
  for (let t = 0; t < 6; t++) {
    const e = 20 + t * 15;
    k.push(mk(e + 2, t % 2 ? rWind({ hips: [0, 0.84, 0] }) : lWind({ hips: [0, 0.84, 0] })));
    k.push(mk(e + 10, t % 2 ? rCut({ hips: [0, 0.82, 0.05] }) : lCut({ hips: [0, 0.82, 0.05] }), 'snap'));
  }
  k.push(mk(112, wings()), mk(158, wings({ spin: -1440 }), 'lin'), mk(170, open({ spin: -1440 })), mk(180, cross({ spin: -1440, hips: [0, 0.98, 0] }), 'snap'),
    mk(192, cross({ spin: -1440 })), mk(200, { spin: -1440 }));
  return clip(k, false, true);
}
export const MUSOU_CLIPS = { mu_saruabh: musouClip() };

const LOCO = carry({ stance: HOLD, run: { ...HOLD, spear: [-0.34, 0.98, 0.1, -10, -50, 90], spearL: [0.34, 0.98, 0.1, 10, -50, -90] } });
export const SARUABH_CLIPS = { ...LOCO.clips, ...attacks(), ...MUSOU_CLIPS };
export const runPose = LOCO.runPose, rollPose = LOCO.rollPose;
