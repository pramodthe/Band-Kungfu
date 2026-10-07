// Saruabh's kit (contract: src/chars/index.js): the phone + laptop moveset (moves.js, anims.js) on the dual-wield rig, the
// voxel girl in her sailor dress (model.js, with the open / closed laptop swap), VIRAL STORM (musou.js) and the effects
// view (view.js). The trail follows the striking hand (moves `hand`).
import { MOVES, AIR_CHAIN_MAX } from './moves.js';
import { SARUABH_CLIPS, runPose, rollPose } from './anims.js';
import { createAnaModel, createAnaSecondary, PHONE } from './model.js';
import { createMusou } from './musou.js';
import { createMusouView } from './view.js';

export const SARUABH_KIT = {
  moves: MOVES, airChainMax: AIR_CHAIN_MAX,
  clips: SARUABH_CLIPS, feet: {},
  runPose, rollPose,
  dashPlant: MOVES.dash.lunge[1][0] + 3,
  model: createAnaModel, secondary: createAnaSecondary,
  trail: { base: 0.15, baseHeavy: 0.08, tip: PHONE.tip },
  // vfx.js heavy / charge palette: pink with a cyan edge (linear HDR)
  fx: {
    needle: [[2.9, 1.0, 1.8], [0.8, 2.3, 2.8], [3.0, 1.6, 2.2]],
    hot: [[0.6, 0.2, 0.4], [0.62, 0.3, 0.46], [0.66, 0.4, 0.52], [2.5, 1.7, 2.1]],
    burst: [0.6, 0.2, 0.4], flash: [2.8, 1.9, 2.3], slash: [3.0, 1.7, 2.3], pulse: [1.9, 0.6, 1.1],
    light: [1, 0.6, 0.8], crack: [2.8, 1.0, 1.6], wall: [1.4, 0.5, 0.9], ring: [2.4, 1.3, 1.7], shard: [1.0, 2.3, 2.8],
    glint: [2.8, 2.2, 2.5], glitter: [2.8, 1.8, 2.2],
    glow: [0x8a2058, 0xff7eb6, 0.3],
    trail: { white: [1.15, 1.0, 1.08], fringe: [1.0, 0.3, 0.6], hot: [1.7, 1.35, 1.5], glow: [1.5, 0.45, 0.9] },
  },
  createMusou, createMusouView,
};
