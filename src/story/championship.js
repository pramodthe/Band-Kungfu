// Band Kungfu tournament: one arena, four rounds, no cutscenes.
//   Round 1  Opening Court   200 K.O.  → CRANE   → Gate A opens
//   Round 2  Inner Hall      450 K.O.  → OX      → Gate B opens
//   Semi     Dragon Ring     700 K.O.  → VIPER
//   Final    Dragon Ring    1000 K.O.  → DRAGON, the reigning champion
// Reinforcement waves run while a round's count is open and stop while its boss is on the floor.
// A round's boss comes out once the running total reaches the round's mark AND the round itself has seen its share of
// knock-outs (ROUND_KOS since the round began): challengers knocked out during a boss fight count toward the thousand, but
// they never skip a round.
// Data for the story director (src/story/index.js): SPK (speakers), OFF (lieutenants and bosses), BEATS (the script, run
// strictly in order), the result screen's texts, and script() — the bosses' behaviours (src/chars/officers/bosses.js).
//   beat = { when: trigger | [any of], …effects }
//     triggers: wait (frames since the last beat), kos (K.O.s since the last beat), total (K.O.s this battle), zone (the
//       hero reached the zone), down (officer key defeated), flag
//     effects: squads [{ at, n, cols?, charge? }], officers { key: { like?, at, engaged? } }, waves, limit { z, nag },
//       gate, heal, morale, retire, hush, banner { html, sub, big?, dur? }, obj { text, go?, total? }, say [lines], win
//   line = { who: 'hero' | 'ally' | SPK key, text: string | { <char id>: string } , intro?: true (the hero's own intro line) }
//   position = [zone id, fx, fz] (fractions of the zone's half extents) or [x, z]
import { createHazards, createBoss } from '../chars/officers/bosses.js';

export const GOAL = 1000;
const ROUND_KOS = 160;

export const SPK = {
  mc: { name: 'Arena Announcer', tag: 'MC', side: 'us' },
  crane: { name: 'Crane', tag: 'CR', side: 'them' },
  ox: { name: 'Ox', tag: 'OX', side: 'them' },
  viper: { name: 'Viper', tag: 'VP', side: 'them' },
  dragon: { name: 'Dragon', tag: 'DG', side: 'them' },
};
export const freeNames = ['SENTINEL', 'GUARD', 'SCOUT', 'VANGUARD'];
export const OFF = {
  sentinel: { name: 'SENTINEL', hp: 380, model: 'sentinel' },
  crane: { name: 'CRANE', hp: 1100, boss: true, model: 'crane' },
  ox: { name: 'OX', hp: 1400, boss: true, model: 'ox' },
  viper: { name: 'VIPER', hp: 1500, boss: true, model: 'viper' },
  dragon: { name: 'DRAGON', hp: 2100, boss: true, model: 'dragon' },
  echo: { name: 'ECHO', hp: 240, model: 'echo' },
};

const NAG_A = { who: 'mc', text: 'Gate A opens when Crane leaves the ring!' };
const NAG_B = { who: 'mc', text: 'Gate B opens when Ox leaves the ring!' };

export const BEATS = [
  // ---- Round 1: the opening court
  {
    when: { wait: 30 },
    obj: { text: 'Round 1 · Knock out 200 challengers', go: ['dock', 0, 0.1], total: 200 },
    squads: [{ at: ['dock', -0.45, -0.2], n: 18 }, { at: ['dock', 0.45, -0.15], n: 18 }, { at: ['dock', 0, 0.25], n: 24 },
      { at: ['dock', -0.5, 0.6], n: 16 }, { at: ['dock', 0.5, 0.6], n: 16 }],
    limit: { z: ['dock', 0, 0.95], nag: NAG_A },
    morale: 0, waves: true,
    say: [{ who: 'mc', text: 'Welcome to Band Kungfu! One thousand challengers, four masters, one title.' }, { who: 'hero', intro: true }],
  },
  {
    when: { total: 200 },
    waves: false,
    officers: { crane: { at: ['dock', 0, 0.75], engaged: true } },
    squads: [{ at: ['dock', -0.5, 0.8], n: 12, charge: true }, { at: ['dock', 0.5, 0.8], n: 12, charge: true }],
    banner: { html: 'Master <em>CRANE</em>', sub: 'Round 1 · watch the red circles', big: true, dur: 200 },
    obj: { text: 'Defeat CRANE', go: 'crane' },
    say: [{ who: 'crane', text: 'Your first lesson: watch where the staff lands.' }],
  },
  {
    when: { down: 'crane' },
    gate: 'shutterA',
    banner: { html: 'Round 1 <em>cleared</em>', sub: 'Gate A is open', dur: 180, big: true },
    heal: 0.3, morale: 0.1, hush: true, retire: true,
    limit: { z: ['aisles', 0, 0.96], nag: NAG_B },
    obj: { text: 'Go through Gate A', go: ['aisles', 0, -0.8] },
    say: [{ who: 'crane', text: 'A clean strike… well fought.' }, { who: 'ally', text: 'One down. Keep moving, we\'ve got your back!' }],
  },
  // ---- Round 2: the inner hall
  {
    when: [{ zone: 'aisles' }, { wait: 25 * 60 }],
    squads: [{ at: ['aisles', 0, -0.5], n: 20, cols: 8 }, { at: ['aisles', -0.6, -0.1], n: 16 }, { at: ['aisles', 0.6, -0.1], n: 16 },
      { at: ['aisles', 0, 0.4], n: 22, cols: 8, charge: true }],
    officers: { sentinel1: { like: 'sentinel', at: ['aisles', -0.3, -0.3], engaged: true }, sentinel2: { like: 'sentinel', at: ['aisles', 0.3, -0.3], engaged: true } },
    waves: true,
    obj: { text: 'Round 2 · Reach 450 knock-outs', go: ['aisles', 0, 0], total: 450 },
    say: [{ who: 'mc', text: 'Round two! The sentinels are holding the inner hall.' }],
  },
  {
    when: { total: 450, kos: ROUND_KOS },
    waves: false,
    officers: { ox: { at: ['aisles', 0, 0.7], engaged: true } },
    squads: [{ at: ['aisles', -0.5, 0.75], n: 12, charge: true }, { at: ['aisles', 0.5, 0.75], n: 12, charge: true }],
    banner: { html: 'Master <em>OX</em>', sub: 'Round 2 · jump over his shock waves', big: true, dur: 200 },
    obj: { text: 'Defeat OX', go: 'ox' },
    say: [{ who: 'ox', text: 'Stand your ground. I dare you.' }],
  },
  {
    when: { down: 'ox' },
    gate: 'shutterB',
    banner: { html: 'Round 2 <em>cleared</em>', sub: 'Gate B is open', dur: 180, big: true },
    heal: 0.3, morale: 0.1, hush: true, retire: true, limit: { z: null },
    obj: { text: 'Go through Gate B', go: ['core', 0, -0.75] },
    say: [{ who: 'ox', text: 'You hit harder than you look…' }],
  },
  // ---- Semi-final and final: the Dragon Ring
  {
    when: [{ zone: 'core' }, { wait: 25 * 60 }],
    squads: [{ at: ['core', -0.5, -0.4], n: 20 }, { at: ['core', 0.5, -0.4], n: 20 }, { at: ['core', 0, 0.1], n: 26, cols: 9 },
      { at: ['core', -0.6, 0.4], n: 14, charge: true }, { at: ['core', 0.6, 0.4], n: 14, charge: true }],
    officers: { sentinel3: { like: 'sentinel', at: ['core', -0.3, -0.2], engaged: true }, sentinel4: { like: 'sentinel', at: ['core', 0.3, -0.2], engaged: true } },
    waves: true,
    obj: { text: 'Semi-final · Reach 700 knock-outs', go: ['core', 0, -0.1], total: 700 },
    say: [{ who: 'mc', text: 'The Dragon Ring! Semi-final — the floor is yours.' }],
  },
  {
    when: { total: 700, kos: ROUND_KOS },
    waves: false,
    officers: { viper: { at: ['core', 0, 0.35], engaged: true } },
    banner: { html: 'Master <em>VIPER</em>', sub: 'Semi-final · move away from the red circles', big: true, dur: 200 },
    obj: { text: 'Defeat VIPER', go: 'viper' },
    say: [{ who: 'viper', text: 'The ring is mine. Find a safe place if you can.' }],
  },
  {
    when: { down: 'viper' },
    banner: { html: 'Semi-final <em>cleared</em>', sub: 'One round to go', dur: 180, big: true },
    heal: 0.35, morale: 0.12, hush: true, waves: true,
    squads: [{ at: ['core', -0.5, 0.2], n: 18, charge: true }, { at: ['core', 0.5, 0.2], n: 18, charge: true }],
    obj: { text: 'Final · Reach 1000 knock-outs', go: ['core', 0, 0], total: GOAL },
    say: [{ who: 'viper', text: 'That was… unexpected.' }, { who: 'mc', text: 'The final! One thousand knock-outs calls out the champion.' }],
  },
  {
    when: { total: GOAL, kos: ROUND_KOS },
    waves: false,
    officers: { dragon: { at: ['core', 0, 0.5], engaged: true } },
    banner: { html: 'The champion <em>DRAGON</em>', sub: 'Final boss · four phases', big: true, dur: 220 },
    obj: { text: 'Defeat DRAGON, the champion', go: 'dragon' },
    morale: 0.05, hush: true,
    say: [{ who: 'dragon', text: 'You crossed the whole arena. Now show me your best form.' }],
  },
  {
    when: { down: 'dragon' },
    win: true, waves: false, morale: 1,
    banner: { html: '<em>Champion!</em>', sub: 'The title is yours', dur: 260, big: true },
    say: [{ who: 'dragon', text: 'The title is yours…' }, { who: 'mc', text: 'Band Kungfu has a new champion!' }],
  },
];

// ---- result screen
export const EPILOGUE = {
  arick: ['Arick signs off the broadcast with the champion\'s belt over his shoulder and the drone circling the scoreboard.',
    'The whole arena heard it: the kid with the microphone is the new Band Kungfu champion.'],
  saruabh: ['Saruabh posts one photo — the scoreboard, the belt, a peace sign — and the feed melts.',
    'A thousand challengers, four masters, one fighter in a sailor outfit. The victory spreads before the doors open.'],
  vlad: ['Vlad loads the champion\'s belt into the cart with the rest of the gear, takes one last picture and pushes off.',
    'Nobody stands in the way of the cart on the way out.'],
  connector: ['Connector swallows the champion\'s belt, thinks about it, and hands it back slightly sticky.',
    'Nobody knows what it is. Everybody knows who won.'],
};
export const DEFEAT = '{name} is knocked out of the bracket… the champion keeps the title.';

// ---- script: the four bosses, one shared set of hazards
export function script(game, api) {
  const H = createHazards(game, api);
  const bosses = [
    createBoss('crane', game, api, H, { on: { 2: { say: [{ who: 'crane', text: 'Can you dodge all three strikes?' }] },
      3: { banner: { html: 'CRANE fills the floor', sub: 'Staff storm', dur: 140 } } } }),
    createBoss('ox', game, api, H, { on: { 2: { say: [{ who: 'ox', text: 'Feel the force of this strike!' }] },
      3: { banner: { html: 'OX calls reinforcements', sub: 'Berserk', dur: 140 }, say: [{ who: 'ox', text: 'Come on! Everybody in!' }] } } }),
    createBoss('viper', game, api, H, { on: { 2: { banner: { html: '<em>Encircled</em>', sub: 'VIPER calls reinforcements', dur: 140 } },
      3: { say: [{ who: 'viper', text: 'Let\'s see you escape this.' }] } } }),
    createBoss('dragon', game, api, H, { on: { 2: { banner: { html: 'DRAGON splits his shadow', sub: 'Three copies join the fight', dur: 150 }, say: [{ who: 'dragon', text: 'Face every side of me.' }] },
      3: { banner: { html: '<em>Blackout</em>', sub: 'DRAGON kills the lights', dur: 150 }, say: [{ who: 'dragon', text: 'Lights out.' }] },
      4: { banner: { html: 'The mask comes off', sub: 'DRAGON is enraged', dur: 150, big: true }, say: [{ who: 'dragon', text: 'Enough. This ends now!' }] } } }),
  ];
  return {
    fx: H.fx,
    step() { H.step(); for (const b of bosses) b.step(); },
  };
}
