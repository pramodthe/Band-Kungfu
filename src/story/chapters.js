// Stage registry (seam). A stage = its data module (format: ./championship.js — SPK, OFF, BEATS, EPILOGUE, DEFEAT,
// script) + the fields below. The story director, the result and loading screens, the HUD and main.js read the active
// stage from here. This demo has one; a new stage registers with one import + one entry in LIST.
//   id                 CHAPTERS key (flow ctx.chapter, ?ch= dev param)
//   map                map id (src/world/map.js MAPS) the battle is fought on
//   cast               playable fighters (CHARS ids); the first of them the player didn't pick speaks the `who: 'ally'` lines
//   title {small, name, sub}   stage band (small: STAGE 1, name: the place, sub: the event)
//   sides {us, them, names {us, them}}   short tags for the HUD's control bar, and who its reinforcement banners name
//   allies [{ x, z, n, cols, hold }]   battle start: your squad's ranks (crowd.spawnAllies)
//   skin { foe, ally }  crowd skins (src/chars/officers/index.js SKINS)
import * as championship from './championship.js';
import { CHAR_ORDER } from '../chars/index.js';

const LIST = [
  {
    ...championship, id: 'championship', map: 'arena', cast: [...CHAR_ORDER],
    title: { small: 'STAGE 1', name: 'The Grand Arena', sub: 'Band Kungfu Tournament' },
    sides: { us: 'TEAM', them: 'GUARD', names: { us: 'Your team', them: 'Red Guard' } },
    skin: { foe: 'redguard', ally: 'blueguard' },
    // Your team, drawn up on both sides of the centre lane.
    allies: [-1, 1].map((sx) => ({ x: sx * 6, z: -166, n: 10, cols: 5, hold: true })),
  },
];

export const CHAPTERS = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const CHAPTER_ORDER = LIST.map((c) => c.id);
export const DEFAULT_CHAPTER = CHAPTER_ORDER[0];

/** Stages a fighter can play (in order). */
export const chaptersFor = (charId) => CHAPTER_ORDER.filter((id) => CHAPTERS[id].cast.includes(charId));

/** Resolve a stage for (stage id?, char id): the named one, else the fighter's first, else the default. */
export function resolveChapter(id, charId) {
  return CHAPTERS[id] || CHAPTERS[chaptersFor(charId)[0]] || CHAPTERS[DEFAULT_CHAPTER];
}
