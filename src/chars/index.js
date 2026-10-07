// Character registry: metadata for the title / select / HUD screens, plus each character's kit (what the generic hero,
// combat, Overclock, vfx and audio code reads from game.hero.kit instead of importing a character's modules).
//
// char = {
//   id
//   name, role (epithet), tag (short upper-case label for chips), motto (HUD intro subline)
//   weapon, bio: [2 lines], stats {atk, def, speed, range} 1-5, musou { name, desc } (the Overclock)
//   accent             CSS colour of the character (select screen / HUD highlights)
//   lines              voice lines the HUD shows: intro (battle start), musouEnd (shout after the Overclock);
//                      copy: [2 short lines] shown while the Overclock plays
//   portrait {face, pal} 20×20 pixel portrait: rows of palette keys ('.' = clear), shared by the HUD badge, dialogue and
//                      select screen (paintPortrait below)
//   kit                see below
// }
// Registry (seam): LIST below drives CHARS / CHAR_ORDER — a new fighter registers with one import + one LIST entry
// (its data lives in src/chars/<id>/).
//
// kit = {
//   moves              move table (format: src/hero/moves.js header), prepared with prepMoves (src/hero/moveset.js); every
//                      kit has n1 c1 dash jatk jc (combo.js starts these from neutral)
//   airChainMax        air-string length per jump
//   clips              clip registry sampled by heroPose (attack + locomotion + Overclock clips; ids = move ids / states:
//                      idle run dodge air airFall land hurt + whatever the Overclock sets in h.musouClip); a clip id that
//                      is a move id is an attack clip (short 5-frame blend in)
//   feet               { moveId: (u, pose) => void } baked feet applied over a borrowed clip (moves.js `anim`)
//   runPose(phase, k, out, lean), rollPose(u, out)   procedural run / dive roll poses
//   dashPlant          dash move frame where the lunge lands (footstep dust), or -1
//   model(rig) → { material, meshes }            voxel model on the shared rig (src/hero/rig.js)
//   secondary(scene, rig, material, hero?) → { update(dt), reset() }   render-only life: hair chains, companions, wobble
//                      (hero: the sim hero, only in the battle view)
//   trail              weapon ribbon {base, baseHeavy, tip} (m along the rig's weapon, vfx.js); moves: [ids] limits it
//   fx                 vfx.js palette of the heavy / charge layers
//   createMusou(game) → the Overclock's sim (interface: src/musou/musou.js header)
//   createMusouView(scene, game, camera) → { update(dt), dispose() }   render-only: the Overclock's and the moves' effects
// }
import { ARICK } from './arick/char.js';
import { SARUABH } from './saruabh/char.js';
import { VLAD } from './vlad/char.js';
import { CONNECTOR } from './connector/char.js';

const LIST = [ARICK, SARUABH, VLAD, CONNECTOR];
export const CHARS = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const CHAR_ORDER = LIST.map((c) => c.id);
export const DEFAULT_CHAR = CHAR_ORDER[0];

/** Paint a char's 20×20 portrait into a canvas (width/height 20; scale it with CSS, image-rendering: pixelated). */
export function paintPortrait(cv, char) {
  const g = cv.getContext('2d'), { face, pal } = char.portrait;
  g.clearRect(0, 0, cv.width, cv.height);
  face.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
}
