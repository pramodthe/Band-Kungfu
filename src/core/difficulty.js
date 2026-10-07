// Difficulty: the four tiers and the player's pick (kept per browser). Picked on the title's difficulty panel after the
// mode; main.js startBattle copies the pick into game.diff (fixed for that battle). Every tier is open from the start.
// Design: a challenger goes down in one or two hits on Easy and takes a full string on Extremely Hard; the tiers also
// turn pressure, boss toughness and the cost of a mistake.
// Sim readers: crowd.js (hp, windup, strikers, gap, grace), combat.js (dmg, armor), crowd/view.js (windup),
// story/index.js (heal, rank).
//   gruntHp / officerHp  enemy hp multipliers (bosses and lieutenants too; your squad mates are untouched)
//   dmg        enemy blows on the hero (grunt 10 / boss 22 at ×1)
//   windup     sim frames from wind-up start to the blow (the telegraph)
//   strikers   enemies winding up at once        gap / grace  strike-start gap / feint window after a blow lands
//   armor      bosses shrug off non-heavy hits (no flinch: they keep swinging through a combo)
//   heal       round-clear heal multiplier (the stage's `heal` beats)
//   rankBonus / rankMax   rank: extra points / best rank reachable
//   bars       title card pips 1-5: [pressure, bosses, damage]
//   name       display name, tag: one-word label for tight spots, line: the card's description
export const DIFFS = [
  { id: 'easy', name: 'Easy', tag: 'EASY', line: 'Learn the combos and find your rhythm.', bars: [1, 1, 1],
    gruntHp: 1, officerHp: 0.65, dmg: 0.5, windup: 50, strikers: 1, gap: 1.4, grace: 1.6, armor: false, heal: 1.5, rankBonus: 0, rankMax: 'A' },
  { id: 'normal', name: 'Normal', tag: 'NORMAL', line: 'The championship as it was meant to be played.', bars: [2, 2, 2],
    gruntHp: 1.4, officerHp: 1, dmg: 1, windup: 40, strikers: 2, gap: 1, grace: 1, armor: false, heal: 1, rankBonus: 0, rankMax: 'S' },
  { id: 'hard', name: 'Hard', tag: 'HARD', line: 'Fierce bosses. Read the wind-up and dodge.', bars: [4, 3, 3],
    gruntHp: 1.8, officerHp: 1.4, dmg: 1.5, windup: 35, strikers: 2, gap: 0.8, grace: 0.6, armor: false, heal: 0.7, rankBonus: 1, rankMax: 'S' },
  { id: 'extreme', name: 'Extremely Hard', tag: 'EXTREME', line: 'One against a thousand. Every mistake matters.', bars: [5, 5, 5],
    gruntHp: 2.2, officerHp: 1.9, dmg: 1.9, windup: 30, strikers: 3, gap: 0.6, grace: 0.35, armor: true, heal: 0.6, rankBonus: 2, rankMax: 'S' },
];
const KEY = 'band-kungfu.diff';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

let cur = DIFFS.find((d) => d.id === get(KEY)) || DIFFS[1];

export const difficulty = () => cur;
export function setDifficulty(d) { cur = d; put(KEY, d.id); }
