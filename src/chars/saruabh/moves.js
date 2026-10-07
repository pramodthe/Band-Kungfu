// Saruabh — phone + laptop moveset (data only; format: src/hero/moves.js header; `hand` = the striking hand, src/hero/moveset.js
// handAt — the trail follows it: R = the phone on its selfie stick, L = the laptop). Fast: a short-gap N-string alternating
// hands, dodge cancels right after the hit on N3 and N5, spinning open-laptop moves. The laptop swats closed; the moves
// listed in ./model.js OPEN show it open, screen blazing (render-only).
// N-string hit onsets 18 sf apart: n1 8 → n2 26 → n3 44 → n4 62 → n5 80 → n6 98.
// Charges: C1 Live Stream (a spinning advance, four hits) · C2 Swipe (both cross and cut out along the diagonals) · C3
// Hook (the selfie stick trips and launches) · C4 Firewall (the open laptop held out as a shield, a drive, then the shove)
// · C5 Speed Dial (three dashing jabs) · C6 Going Viral (a long spin that drags the ring in, then the burst).
import { prepMoves } from '../../hero/moveset.js';

const ONCE = 99;
export const MOVES = {
  n1: { frames: 24, next: 'n2', charge: 'c2', cancel: 18, branch: 12, dodgeCancel: 12, steer: 5, lunge: [[4, 10, 0.3]], hand: 'L',
    hits: [{ f: [8, 11], every: ONCE, shape: 'arc', range: 1.7, ang: 120, dir: 10, dmg: 8, kb: 'push', force: 3, hitstop: 2 }] },
  n2: { frames: 24, next: 'n3', charge: 'c3', cancel: 14, branch: 12, dodgeCancel: 12, steer: 5, lunge: [[3, 10, 0.3]], hand: 'R',
    hits: [{ f: [8, 11], every: ONCE, shape: 'arc', range: 1.8, ang: 120, dir: -10, dmg: 8, kb: 'push', force: 3, hitstop: 2 }] },
  n3: { frames: 30, next: 'n4', charge: 'c4', cancel: 22, branch: 16, dodgeCancel: 16, steer: 5, lunge: [[5, 14, 0.4]], hand: [[0, 'L'], [13, 'R']],
    hits: [{ f: [12, 15], every: ONCE, shape: 'arc', range: 2.0, ang: 150, dmg: 14, kb: 'blow', force: 6, lift: 2, hitstop: 3 }] },
  n4: { frames: 26, next: 'n5', charge: 'c5', cancel: 18, branch: 13, dodgeCancel: 13, steer: 5, lunge: [[3, 9, 0.35]], hand: 'L',
    hits: [{ f: [8, 11], sweep: -1, shape: 'arc', range: 1.9, ang: 160, dmg: 9, kb: 'flinch', force: 3, hitstop: 2 }] },
  // N5 camera flash: the phone thrust out at arm's length, the flash carries down a 3.4 m lane
  n5: { frames: 28, next: 'n6', charge: 'c6', cancel: 18, branch: 13, dodgeCancel: 12, steer: 5, lunge: [[4, 10, 0.5]], hand: 'R',
    hits: [{ f: [8, 11], every: ONCE, shape: 'line', len: 3.4, width: 1.2, dmg: 10, kb: 'push', force: 5, hitstop: 2 }] },
  n6: { frames: 44, next: 'n1', charge: 'c1', cancel: 34, dodgeCancel: 24, steer: 6, lunge: [[2, 12, 0.8]], armor: true, hand: [[0, 'R'], [16, 'L']],
    hits: [{ f: [8, 14], every: ONCE, shape: 'circle', range: 2.1, dmg: 10, kb: 'flinch', force: 3, hitstop: 2 },
      { f: [16, 22], every: ONCE, shape: 'circle', range: 2.3, dmg: 18, kb: 'blow', force: 10, lift: 5, hitstop: 5, heavy: true }] },

  // C1 Live Stream: spins forward with both out, four hits
  c1: { frames: 50, cancel: 44, dodgeCancel: 44, steer: 12, lunge: [[8, 44, 1.6]], armor: true, hand: [[0, 'R'], [20, 'L'], [30, 'R'], [40, 'L']],
    hits: [14, 24, 34, 43].map((f) => ({ f: [f, f + 1], every: ONCE, shape: 'circle', range: 1.9, dmg: 6, kb: 'spin', force: 4, lift: 2, hitstop: 1 })) },
  // C2 (N1 → C) Swipe: both cross in front and cut out along the diagonals
  c2: { frames: 40, cancel: 34, dodgeCancel: 26, steer: 10, lunge: [[6, 14, 0.6]], armor: true, hand: [[0, 'L'], [16, 'R']],
    hits: [{ f: [14, 18], every: ONCE, shape: 'arc', range: 2.2, ang: 120, dmg: 18, kb: 'blow', force: 9, lift: 4, hitstop: 5, heavy: true }] },
  // C3 (N2 → C) Hook: crouch, the selfie stick catches the ankles and rips up (launcher)
  c3: { frames: 44, cancel: 38, dodgeCancel: 30, steer: 10, lunge: [[4, 12, 0.5]], armor: true, hand: 'R',
    hits: [{ f: [12, 15], every: ONCE, shape: 'arc', range: 2.1, ang: 140, dmg: 14, kb: 'launch', force: 2, lift: 10, hitstop: 5, heavy: true }] },
  // C4 (N3 → C) Firewall: the open laptop held out in front, she drives through the front rank, then shoves
  c4: { frames: 56, cancel: 48, dodgeCancel: 38, steer: 12, lunge: [[10, 22, 1.8, 'lin'], [30, 36, 0.4]], armor: true, hand: 'L',
    hits: [{ f: [14, 22], every: 4, shape: 'arc', range: 1.9, ang: 120, dmg: 8, kb: 'push', force: 6, hitstop: 2 },
      { f: [32, 35], every: ONCE, shape: 'arc', range: 2.6, ang: 140, dmg: 18, kb: 'blow', force: 11, lift: 3, hitstop: 5, heavy: true }] },
  // C5 (N4 → C) Speed Dial: a chain of three dashing jabs through the front rank
  c5: { frames: 56, cancel: 50, dodgeCancel: 42, steer: 10, lunge: [[6, 12, 1.4, 'lin'], [18, 24, 1.4, 'lin'], [30, 36, 1.4, 'lin']], armor: true,
    hand: [[0, 'L'], [18, 'R'], [30, 'L']],
    hits: [10, 22, 34].map((f, k) => ({ f: [f, f + 2], every: ONCE, shape: 'line', len: 2.2, width: 1.4, dmg: k === 2 ? 14 : 10, kb: k === 2 ? 'blow' : 'flinch',
      force: k === 2 ? 9 : 3, lift: k === 2 ? 4 : 0, hitstop: k === 2 ? 4 : 2, heavy: k === 2 })) },
  // C6 (N5 → C) Going Viral: a long open-laptop spin that drags the ring in, then both snap out
  c6: { frames: 84, cancel: 76, dodgeCancel: 66, steer: 8, lunge: [[8, 56, 1.4]], armor: true, hand: [[0, 'R'], [56, 'L']],
    hits: [{ f: [10, 54], shape: 'circle', range: 2.4, dmg: 5, kb: 'flinch', force: 0.8, hitstop: 1, every: 8 },
      { f: [58, 62], every: ONCE, shape: 'circle', range: 3.6, dmg: 26, kb: 'launch', force: 5, lift: 9, hitstop: 7, heavy: true }] },

  // Dash attack: a running double jab
  dash: { frames: 40, cancel: 34, dodgeCancel: 20, steer: 3, lunge: [[0, 16, 3.6, 'lin'], [16, 22, 0.8]], hand: [[0, 'R'], [14, 'L']],
    hits: [{ f: [10, 13], every: ONCE, shape: 'arc', range: 2.2, ang: 160, dmg: 10, kb: 'flinch', force: 4, hitstop: 2 },
      { f: [16, 19], every: ONCE, shape: 'arc', range: 2.2, ang: 160, dmg: 14, kb: 'blow', force: 8, lift: 3, hitstop: 3 }] },
  // Jump attack: quick alternating jabs in the air
  jatk: { frames: 18, air: true, hover: 2.3, next: 'jatk', charge: 'jc', cancel: 10, dodgeCancel: 99, steer: 3, hand: [[0, 'L'], [9, 'R']],
    hits: [{ f: [4, 7], every: ONCE, shape: 'arc', range: 2.4, ang: 200, dmg: 8, kb: 'flinch', force: 3, hitstop: 1, yMax: 4.5 }] },
  // Jump charge: a tucked spin down onto the floor, both out
  jc: { frames: 50, air: true, hover: 3, landFrame: 32, hang: [6, 26], plunge: [26, -60], cancel: 44, dodgeCancel: 36, steer: 12, armor: true,
    hits: [{ f: [32, 35], every: ONCE, shape: 'circle', range: 3.6, dmg: 18, kb: 'launch', force: 5, lift: 8, hitstop: 6, heavy: true }] },
};

export const AIR_CHAIN_MAX = 12;
prepMoves(MOVES);
