// Connector's clips: its own locomotion (a jelly has no spear to carry: idle bob, a bouncing run, a ball roll, air, land,
// hurt), attack clips per move id (./moves.js) through the shared clip kit (baked planted feet), and the Overclock clip.
// The body is one blob on the hips joint, so the hips channels (position + rotation) are the whole body; the two hands
// float free (they ride the two weapon joints, not the arms): the spear channel is the right hand, spearL the left.
// A hand channel = [x, y, z (root space, +x = its left), yaw, elev, roll] — only the position shows.
import { P, clip, sampleClip, STANCE, CH } from '../../hero/rig.js';
import { runPose as baseRun } from '../../hero/anims/locomotion.js';
import { createClipKit } from '../shared/clipkit.js';
import { lungeAt } from '../../hero/moveset.js';
import { MOVES } from './moves.js';

const D2R = Math.PI / 180;
const hand = (x, y, z) => [x, y, z, 0, 0, 0];
const RH = hand(-0.64, 0.92, 0.12), LH = hand(0.64, 0.92, 0.12);
export const CN = { ...STANCE, hips: [0, 0.82, 0], hipsR: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0],
  footL: [0.2, 0.08, 0.06, 0, 12], footR: [-0.2, 0.08, -0.04, 0, -12], spear: RH, spearL: LH, dual: 1, gripR: 0, gripL: 0 };
const ENTRY = { n2: 'n1', n3: 'n2', n4: 'n3', n5: 'n4', n6: 'n5', c2: 'n1', c3: 'n2', c4: 'n3', c5: 'n4', c6: 'n5' };
const { clipF } = createClipKit(MOVES, ENTRY, CN);
const L = (id, f) => lungeAt(MOVES[id], f);
const lead = (id, f, z = 0.2, x = 0.2, yaw = 12) => [x, 0.08, 0.1 + z + L(id, f), 0, yaw];

// ---- vocabulary
/** Both hands: r / l = [x, y, z]. */
const hands = (r, l) => ({ spear: hand(...r), spearL: hand(...l) });
/** Body: height, lean° (+ = forward), twist° (+ = to its left), roll°, forward shift. */
const body = (y, lean = 0, tw = 0, roll = 0, z = 0) => ({ hips: [0, y, z], hipsR: [lean, tw, roll] });
const rJab = (z = 1.05) => ({ ...hands([-0.18, 1.02, z], [0.62, 0.95, -0.1]), ...body(0.8, 10, 20, 0, 0.06) });
const lJab = (z = 1.05) => ({ ...hands([-0.62, 0.95, -0.1], [0.18, 1.02, z]), ...body(0.8, 10, -20, 0, 0.06) });
const rBack = { ...hands([-0.6, 1.05, -0.5], [0.5, 0.98, 0.3]), ...body(0.82, -4, -25) };
const lBack = { ...hands([-0.5, 0.98, 0.3], [0.6, 1.05, -0.5]), ...body(0.82, -4, 25) };
const wide = (y = 1.0) => hands([-0.95, y, 0], [0.95, y, 0]);
const up = (y = 1.75) => hands([-0.4, y, 0.05], [0.4, y, 0.05]);
const clap = (z = 0.95) => ({ ...hands([-0.12, 1.0, z], [0.12, 1.0, z]), ...body(0.78, 14, 0, 0, 0.08) });
const flat = (y = 0.56) => ({ ...wide(0.5), ...body(y, 20, 0, 0, 0.1) });
/** A visual hop: the body and both feet `h` m off the floor. In a plain clip the feet are the pose's own (footL / footR);
 *  in a clip-kit clip (clipF) they are keyed in move-start coordinates (fL / fR), `fz` m along the move's lunge. */
const hop = (h, fz = 0, e) => ({ ...body(0.84 + h, -6), ...up(1.3 + h), footL: [0.2, 0.08 + h * 0.9, 0.06, 20, 12], footR: [-0.2, 0.08 + h * 0.9, -0.04, 20, -12],
  fL: [0.2, 0.08 + h * 0.9, 0.06 + fz, 20, 12], fR: [-0.2, 0.08 + h * 0.9, -0.04 + fz, 20, -12], ...e });
const B = {};                                     // = CN (a key with no overrides)

// ---------------------------------------------------------------- locomotion
const LOCO = {
  idle: clip([
    [0, P({}, CN)],
    [0.5, P({ hips: [0, 0.78, 0], ...hands([-0.66, 0.88, 0.12], [0.66, 0.88, 0.12]) }, CN)],
    [1, P({}, CN)],
  ], true),
  // the roll (the whole-body pitch is applied to the rig root by the engine): tucked into a ball
  dodge: clip([
    [0, P({ ...body(0.74, 20), ...hands([-0.5, 0.8, 0.2], [0.5, 0.8, 0.2]) }, CN)],
    [0.2, P({ ...body(0.56, 30), ...hands([-0.46, 0.6, 0.1], [0.46, 0.6, 0.1]), footL: [0.16, 0.2, 0.1, 40, 0], footR: [-0.16, 0.2, 0.0, 40, 0] }, CN), 'out'],
    [0.5, P({ ...body(0.54, 30), ...hands([-0.46, 0.56, 0.1], [0.46, 0.56, 0.1]), footL: [0.16, 0.16, 0.1, 40, 0], footR: [-0.16, 0.16, 0.0, 40, 0] }, CN)],
    [0.76, P({ ...body(0.66, 14), ...hands([-0.6, 0.8, 0.1], [0.6, 0.8, 0.1]) }, CN), 'out'],
    [1, P({}, CN)],
  ]),
  // air: t = 0 take-off, 0.5 apex, 1 falling
  air: clip([
    [0, P({ ...body(0.9, -8), ...up(1.5), footL: [0.18, 0.0, 0.04, 40, 10], footR: [-0.18, 0.02, -0.06, 40, -10] }, CN)],
    [0.3, P({ ...body(0.9, 4), ...wide(1.2), footL: [0.2, 0.4, 0.1, 10, 10], footR: [-0.2, 0.36, 0.0, 10, -10] }, CN), 'out'],
    [1, P({ ...body(0.9, 8), ...up(1.6), footL: [0.2, 0.14, 0.12, -5, 10], footR: [-0.2, 0.16, -0.06, -5, -10] }, CN)],
  ]),
  airFall: clip([
    [0.5, P({ ...body(0.92, -10), ...wide(1.4), footL: [0.2, 0.36, 0.1, 10, 10], footR: [-0.2, 0.3, 0.0, 10, -10] }, CN)],
    [1, P({ ...body(0.92, 6), ...up(1.7), footL: [0.2, 0.14, 0.12, 0, 10], footR: [-0.2, 0.16, -0.06, 0, -10] }, CN)],
  ]),
  land: clip([
    [0, P({ ...body(0.6, 10), ...wide(0.62), footL: [0.26, 0.08, 0.08, 0, 20], footR: [-0.26, 0.08, -0.04, 0, -20] }, CN)],
    [0.4, P({ ...body(0.64, 8), ...wide(0.7), footL: [0.26, 0.08, 0.08, 0, 20], footR: [-0.26, 0.08, -0.04, 0, -20] }, CN), 'out'],
    [1, P({}, CN)],
  ]),
  hurt: clip([
    [0, P({}, CN)],
    [0.25, P({ ...body(0.8, -20, 10, 6, -0.12), ...hands([-0.7, 1.4, -0.2], [0.7, 1.3, -0.2]) }, CN), 'out'],
    [1, P({}, CN)],
  ]),
};
const _R = P({}, CN);
/** The bouncing run: the engine's stride for the feet, the blob bobbing over it, the hands pumping against the legs. */
export function runPose(phase, k, out, lean = 0) {
  baseRun(phase, k, out, lean);
  const s = Math.sin(phase), b = Math.abs(Math.sin(phase)) ;
  out[CH.hips] = lean * 0.12; out[CH.hips + 1] = 0.78 + 0.1 * b * k; out[CH.hips + 2] = 0.04 * k;
  out[CH.hipsR] = (8 + 8 * k) * D2R; out[CH.hipsR + 1] = 0; out[CH.hipsR + 2] = -lean * 0.8;
  for (const c of [CH.spine, CH.chest, CH.head]) out[c] = out[c + 1] = out[c + 2] = 0;
  for (let i = 0; i < 6; i++) { out[CH.spear + i] = _R[CH.spear + i]; out[CH.spearL + i] = _R[CH.spearL + i]; }
  out[CH.spear + 2] += s * 0.34 * k; out[CH.spearL + 2] -= s * 0.34 * k;
  out[CH.spear + 1] += 0.08 * b * k; out[CH.spearL + 1] += 0.08 * b * k;
  out[CH.dual] = 1; out[CH.gripR] = 0; out[CH.gripL] = 0; out[CH.lfree] = 0; out[CH.rfree] = 0;
  return out;
}
export function rollPose(u, out) { return sampleClip(LOCO.dodge, u, out); }

// ---------------------------------------------------------------- attacks
function attacks() {
  const C = {};
  C.n1 = clipF('n1', [[0, B], [5, rBack], [9, { ...rJab(), fL: lead('n1', 9, 0.2) }, 'snap'], [15, rJab(1.0)], [24, B]]);
  C.n2 = clipF('n2', [[0, B], [5, lBack], [9, { ...lJab(), fR: [-0.2, 0.08, 0.1 + L('n2', 9), 0, -12] }, 'snap'], [15, lJab(1.0)], [24, B]]);
  C.n3 = clipF('n3', [[0, B], [7, { ...wide(1.1), ...body(0.84, -6) }], [11, { ...clap(), fL: lead('n3', 11, 0.25) }, 'snap'], [18, clap(0.9)], [30, B]]);
  C.n4 = clipF('n4', [[0, B], [6, { ...body(0.78, -14, 0, 0, -0.1), ...hands([-0.6, 0.9, -0.3], [0.6, 0.9, -0.3]) }],
    [11, { ...body(0.84, 22, 0, 0, 0.3), ...hands([-0.7, 1.0, -0.2], [0.7, 1.0, -0.2]), fL: lead('n4', 11, 0.3) }, 'snap'],
    [18, { ...body(0.82, 16, 0, 0, 0.24), ...hands([-0.7, 1.0, -0.1], [0.7, 1.0, -0.1]) }], [30, B]]);
  C.n5 = clipF('n5', [[0, B], [5, { ...wide(1.05), ...body(0.8, 4, 30) }], [14, { ...wide(1.05), ...body(0.8, 4, 0), spin: -360 }, 'lin'],
    [20, { ...wide(0.95), spin: -360 }], [30, { spin: -360 }]]);
  // N6 hop slam: crouch (4), up (6–20), flat on the ring (24)
  C.n6 = clipF('n6', [[0, B], [5, { ...body(0.66, 10), ...wide(0.7) }], [14, { ...body(0.9, -10), ...up(1.8) }, 'out'],
    [23, { ...body(0.86, 10), ...up(1.7) }], [24, flat(0.56), 'snap'], [34, flat(0.6)], [50, B]]);
  // C1 Copy: Scream — hands cupped round the mouth, leaning into it, the last note thrown forward
  const shout = (lean, z = 0.5) => ({ ...hands([-0.34, 0.98, z], [0.34, 0.98, z]), ...body(0.84, lean, 0, 0, lean > 0 ? 0.06 : -0.04) });
  C.c1 = clipF('c1', [[0, B], [10, { ...up(1.6), ...body(0.9, -14) }], [18, shout(-8), 'snap'], [28, shout(-12)], [38, shout(-6)],
    [42, shout(20, 0.7), 'snap'], [50, shout(16, 0.66)], [60, B]]);
  // C2 Uppercut
  C.c2 = clipF('c2', [[0, B], [8, { ...body(0.62, 16, -20), ...hands([-0.5, 0.5, 0.3], [0.6, 0.9, 0]) }],
    [15, { ...body(0.94, -12, 20), ...hands([-0.2, 1.9, 0.5], [0.6, 0.8, -0.2]), fL: lead('c2', 15, 0.25) }, 'snap'],
    [30, { ...body(0.92, -10, 18), ...hands([-0.2, 1.92, 0.46], [0.6, 0.8, -0.2]) }], [52, B]]);
  // C3 Spin Attack: six turns, hands flung wide, the last turn throws them out
  C.c3 = clipF('c3', [[0, B], [8, { ...wide(1.0), ...body(0.78, 6) }], [52, { ...wide(1.0), ...body(0.78, 6), spin: -2160 }, 'lin'],
    [57, { ...wide(1.2), ...body(0.86, -6), spin: -2520 }, 'out'], [64, { ...wide(1.0), spin: -2520 }], [72, { spin: -2520 }]]);
  // C4 Copy: Flash — hands framing its eyes like a camera, panning, the big one
  const frame = (tw, z = 0.5) => ({ ...hands([-0.42, 1.1, z], [0.42, 1.1, z]), ...body(0.84, 6, tw) });
  C.c4 = clipF('c4', [[0, B], [10, { ...frame(-20), fL: lead('c4', 10, 0.15) }], [24, frame(20), 'lin'], [34, frame(-8), 'lin'],
    [38, { ...frame(0, 0.7), ...body(0.8, 16, 0, 0, 0.1) }, 'snap'], [48, frame(0, 0.64)], [58, B]]);
  // C5 Triple Hop: three visual hops (the sim stays on the floor), flat under each landing
  const H = (f0, f1, n) => [[f0 + 1, { ...body(0.68, 8), ...wide(0.7) }], [Math.round((f0 + f1) / 2), hop(0.7 + n * 0.15, L('c5', Math.round((f0 + f1) / 2))), 'out'],
    [f1 - 1, hop(0.2, L('c5', f1 - 1))], [f1, { ...flat(0.58), fL: [0.24, 0.08, 0.08 + L('c5', f1), 0, 15], fR: [-0.24, 0.08, -0.04 + L('c5', f1), 0, -15] }, 'snap']];
  C.c5 = clipF('c5', [[0, B], ...H(5, 22, 0), ...H(25, 42, 1), ...H(45, 60, 2), [70, flat(0.62)], [80, B]]);
  // C6 Clone Burst: shudder and split (12), spin with the copies (16–36), gather (40), slam (44)
  C.c6 = clipF('c6', [[0, B], [6, { ...body(0.7, 0), ...hands([-0.4, 0.8, 0], [0.4, 0.8, 0]) }], [12, { ...wide(1.2), ...body(0.88, -6) }, 'snap'],
    [16, { ...wide(1.0), ...body(0.8, 4) }], [36, { ...wide(1.0), ...body(0.8, 4), spin: -720 }, 'lin'], [42, { ...up(1.9), ...body(0.96, -12), spin: -720 }, 'out'],
    [44, { ...flat(0.54), spin: -720 }, 'snap'], [60, { ...flat(0.58), spin: -720 }], [84, { spin: -720 }]]);
  // dash: a rolling tackle (two forward turns of the whole blob round its middle: hips pitch)
  C.dash = clipF('dash', [[0, { ...body(0.74, 20), ...hands([-0.5, 0.8, 0.2], [0.5, 0.8, 0.2]) }],
    [8, { ...body(0.6, 120), ...hands([-0.46, 0.6, 0.1], [0.46, 0.6, 0.1]), fL: [0.18, 0.3, 0.2 + L('dash', 8), 30, 0], fR: [-0.18, 0.3, 0.1 + L('dash', 8), 30, 0] }, 'lin'],
    [22, { ...body(0.6, 700), ...hands([-0.46, 0.6, 0.1], [0.46, 0.6, 0.1]), fL: [0.18, 0.3, 0.2 + L('dash', 22), 30, 0], fR: [-0.18, 0.3, 0.1 + L('dash', 22), 30, 0] }, 'lin'],
    [30, { ...body(0.7, 730), ...wide(0.9) }, 'out'], [46, { ...body(0.82, 720) }]]);
  const AIR = { footL: [0.2, 0.36, 0.1, 10, 10], footR: [-0.2, 0.3, 0.0, 10, -10] };
  C.jatk = clip([[0, P({ ...body(0.92, 0), ...AIR }, CN)], [5 / 20, P({ ...rJab(0.95), ...body(0.92, 10, 20), ...AIR }, CN), 'snap'],
    [10 / 20, P({ ...lJab(0.95), ...body(0.92, 10, -20), ...AIR }, CN), 'snap'], [1, P({ ...lJab(0.9), ...body(0.92, 8, -16), ...AIR }, CN)]]);
  const Lj = MOVES.jc.landFrame, Fj = MOVES.jc.frames, Dj = MOVES.jc.plunge[0];
  const hang = { ...body(0.95, -10), ...up(1.9), footL: [0.2, 0.5, 0.1, 10, 10], footR: [-0.2, 0.44, 0.0, 10, -10] };
  const drop = { ...flat(0.5), footL: [0.28, 0.08, 0.1, 0, 20], footR: [-0.28, 0.08, -0.04, 0, -20] };
  C.jc = clip([[0, P({ ...body(0.92, 0), ...AIR }, CN)], [5 / Fj, P(hang, CN), 'out'], [(Dj - 1) / Fj, P(hang, CN)],
    [(Lj - 1) / Fj, P({ ...hang, ...body(0.9, 20) }, CN), 'in'], [Lj / Fj, P(drop, CN), 'snap'], [(Lj + 8) / Fj, P(drop, CN)],
    [MOVES.jc.cancel / Fj, P({ ...drop, hips: [0, 0.66, 0.06] }, CN), 'io'], [1, P({}, CN)]], false, true);
  return C;
}

// ---------------------------------------------------------------- Overclock: GIGA CONNECT (230 frames)
// 0 it shudders and blows up to a hundred times its size (cut-in) · 44 / 74 / 104 three giant hops forward · 124–164 the
// giant spin · 190 the belly flop · 206 it lets the air out
const MF = 230;
const mk = (f, spec, e) => [f / MF, P(spec, CN), e];
export const MUSOU_FRAMES = MF;
const giantHop = (f) => [mk(f - 14, { ...body(0.66, 8), ...wide(0.7) }), mk(f - 7, hop(0.34), 'out'), mk(f - 1, hop(0.1)), mk(f, flat(0.6), 'snap'), mk(f + 8, flat(0.64))];
export const MUSOU_CLIPS = {
  mu_connector: clip([
    mk(0, {}),
    mk(10, { ...body(0.7, 0), ...hands([-0.4, 0.8, 0], [0.4, 0.8, 0]) }),
    mk(26, { ...up(1.9), ...body(0.92, -10) }, 'out'),
    ...giantHop(44), ...giantHop(74), ...giantHop(104),
    mk(124, { ...wide(1.0), ...body(0.8, 4) }),
    mk(164, { ...wide(1.0), ...body(0.8, 4), spin: -1440 }, 'lin'),
    mk(176, { ...up(1.9), ...body(0.94, -14), spin: -1440 }, 'out'),
    mk(189, hop(0.3, 0, { spin: -1440 })),
    mk(190, { ...flat(0.5), spin: -1440 }, 'snap'),
    mk(210, { ...flat(0.56), spin: -1440 }),
    mk(230, { spin: -1440 }),
  ], false, true),
};

export const CONNECTOR_CLIPS = { ...LOCO, ...attacks(), ...MUSOU_CLIPS };
