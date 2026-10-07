// Locomotion for a kit with its own carry: the engine's locomotion clips (idle, air, land, hurt, dodge) and procedural
// run / dive roll were authored for a spear; carry(spec) returns copies that hold this kit's weapons the way `spec` says
// (the weapon channels of src/hero/rig.js: spear, spearL, dual, gripR, gripL, lfree, armL, rfree, armR), optionally
// different while running (`run`) — the body, feet and timing stay the engine's.
//   carry({ stance: { spear, spearL?, dual?, … }, run?: { … }, bob?: metres the weapon bobs with the stride })
//   → { clips, runPose(phase, k, out, lean), rollPose(u, out) }
import { P, CH, STANCE } from '../../hero/rig.js';
import { LOCO_CLIPS, runPose as baseRun, rollPose as baseRoll } from '../../hero/anims/locomotion.js';

const KEYS = ['spear', 'spearL', 'dual', 'gripR', 'gripL', 'lfree', 'armL', 'rfree', 'armR'];
const SPAN = { spear: [CH.spear, 6], spearL: [CH.spearL, 6], dual: [CH.dual, 1], gripR: [CH.gripR, 1], gripL: [CH.gripL, 1], lfree: [CH.lfree, 1],
  armL: [CH.armL, 4], rfree: [CH.rfree, 1], armR: [CH.armR, 4] };

export function carry({ stance, run = stance, bob = 0.03 }) {
  const has = KEYS.filter((k) => stance[k] !== undefined), hasR = KEYS.filter((k) => run[k] !== undefined);
  const S = P(stance, STANCE), R = P(run, STANCE);
  const put = (src, keys, out) => { for (const k of keys) { const [at, n] = SPAN[k]; for (let i = 0; i < n; i++) out[at + i] = src[at + i]; } };
  const clips = Object.fromEntries(Object.entries(LOCO_CLIPS).map(([id, c]) => [id, { ...c, keys: c.keys.map((key) => {
    const p = key.p.slice();
    put(S, has, p);
    return { ...key, p };
  }) }]));
  return {
    clips,
    runPose(phase, k, out, lean) {
      baseRun(phase, k, out, lean);
      put(R, hasR, out);
      out[CH.spear + 1] += Math.sin(phase * 2) * bob * k;
      if (run.spearL) out[CH.spearL + 1] -= Math.sin(phase * 2) * bob * k;
      return out;
    },
    rollPose(u, out) {
      baseRoll(u, out);
      put(S, has, out);
      return out;
    },
  };
}
