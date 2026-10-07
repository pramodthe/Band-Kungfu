// Connector's kit (contract: src/chars/index.js): the jelly's moveset (moves.js), its own locomotion and attack clips
// (anims.js), the voxel blob with its wobble, face, copies and the giant (model.js), GIGA CONNECT (musou.js) and the
// effects view (view.js).
import { MOVES, AIR_CHAIN_MAX } from './moves.js';
import { CONNECTOR_CLIPS, runPose, rollPose } from './anims.js';
import { createConnectorModel, createConnectorSecondary } from './model.js';
import { createMusou } from './musou.js';
import { createMusouView } from './view.js';

export const CONNECTOR_KIT = {
  moves: MOVES, airChainMax: AIR_CHAIN_MAX,
  clips: CONNECTOR_CLIPS, feet: {},
  runPose, rollPose,
  dashPlant: MOVES.dash.lunge[1][0] + 3,
  model: createConnectorModel, secondary: createConnectorSecondary,
  // the ribbon trails the striking hand on the moves it punches or slaps with (its body moves leave none)
  trail: { base: -0.12, baseHeavy: -0.16, tip: 0.2, moves: ['n1', 'n2', 'n3', 'n5', 'c2', 'c3', 'jatk'] },
  // vfx.js heavy / charge palette: aqua with an orange edge (linear HDR)
  fx: {
    needle: [[0.6, 2.6, 3.0], [3.0, 1.4, 0.4], [1.6, 2.9, 3.0]],
    hot: [[0.08, 0.46, 0.56], [0.1, 0.52, 0.62], [0.16, 0.58, 0.68], [0.8, 2.4, 2.7]],
    burst: [0.1, 0.46, 0.56], flash: [1.4, 2.6, 2.8], slash: [0.9, 2.5, 3.0], pulse: [0.3, 1.3, 1.9],
    light: [0.5, 0.95, 1], crack: [0.6, 2.0, 2.8], wall: [0.3, 1.0, 1.4], ring: [0.7, 2.0, 2.4], shard: [3.0, 1.5, 0.5],
    glint: [1.1, 2.5, 2.8], glitter: [1.3, 2.5, 2.9],
    glow: [0x0a6a8a, 0x3fcfe8, 0.3],
    trail: { white: [0.8, 1.1, 1.15], fringe: [1.0, 0.45, 0.05], hot: [1.0, 1.6, 1.7], glow: [0.25, 1.1, 1.5] },
  },
  createMusou, createMusouView,
};
