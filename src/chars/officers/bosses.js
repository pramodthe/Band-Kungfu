// Boss behaviours (sim; driven by the stage script through the story director's script hook, src/story/index.js).
// Phases come from the boss's HP fraction. Deterministic: timers off the story clock, no randomness of its own.
// Phase floor: on the step a hit carries a boss across a threshold his HP is held at (threshold − 0.2 %) — one strong
// Overclock can't skip a phase, and every phase starts at its threshold.
// Every area attack is telegraphed: a red disc fills up on the floor (fx.warn) and the blow lands when it is full — walk
// out, dodge through it (i-frames) or, for the travelling shock waves, jump over them. Area attacks hurt the hero directly
// (hero.hurt: i-frames, dodge and the Overclock still protect him).
// fx (one object shared by every boss of the stage; render-only reader: the world builder): { now, dark,
//   warn: [{ x, z, r, t0, t1 }], rings: [{ x, z, r, r1?, t, life, kind }], drops: [{ x, z, t0, t }], phase: { key: n },
//   hits (area attacks that landed on the hero) }.
//   crane   CRANE    P1 100–50 % lure casts · P2 < 50 % triple cast · P3 < 25 % spam flood (a ring of casts)
//   ox  OX   P1 100–60 % shield charges · P2 < 60 % ground shock waves · P3 < 25 % triple slam, calls his squads
//   viper  VIPER   P1 100–50 % payload drops · P2 < 50 % lockdown (calls squads, more drops) · P3 < 25 % carpet drops
//   dragon  DRAGON  P1 100–75 % blade rushes · P2 < 75 % echoes ×3, shock waves · P3 < 50 % blackout, falling strikes ·
//                    P4 < 25 % mask off: enraged, leap slams
import { clampWalk } from '../../world/map.js';
import { ST } from '../../crowd/crowd.js';

export const BOSS_PHASES = { crane: [0.5, 0.25], ox: [0.6, 0.25], viper: [0.5, 0.25], dragon: [0.75, 0.5, 0.25] };

/** The stage's shared hazard state + resolver. step() once per story step, before the bosses. */
export function createHazards(game, api) {
  const fx = { now: 0, dark: false, warn: [], rings: [], drops: [], phase: {}, hits: 0 };   // hits: area attacks that landed (bench)
  const h = game.hero;
  const hurt = (dmg, x, z) => { if (h.hurt(Math.round(dmg * game.diff.dmg), x, z, true)) fx.hits++; };
  const hurtIn = (x, z, r, dmg) => { if (h.y < 0.6 && Math.hypot(h.x - x, h.z - z) < r) hurt(dmg, x, z); };
  const H = {
    fx,
    ring: (x, z, r, kind, life = 40, r1 = 0) => { fx.rings.push({ x, z, r, r1, t: api.t(), life, kind }); if (fx.rings.length > 16) fx.rings.shift(); },
    /** A telegraphed blow: the disc fills over `delay` frames, then everything inside takes dmg. */
    strike(x, z, r, delay, dmg, kind = 'slam', drop = false) {
      const t = api.t();
      fx.warn.push({ x, z, r, t0: t, t1: t + delay, dmg, kind });
      if (fx.warn.length > 14) fx.warn.shift();
      if (drop) { fx.drops.push({ x, z, t0: t, t: t + delay }); if (fx.drops.length > 14) fx.drops.shift(); }
    },
    /** A shock band travelling out from (x, z): r0 → r1 over `life` frames; jump over it. */
    wave(x, z, r0, r1, life, dmg) { fx.rings.push({ x, z, r: r0, r1, t: api.t(), life, kind: 'shock', dmg, hit: false }); if (fx.rings.length > 16) fx.rings.shift(); },
    hurtIn,
    step() {
      const t = fx.now = api.t();
      for (const w of fx.warn) if (t === w.t1) { hurtIn(w.x, w.z, w.r, w.dmg); H.ring(w.x, w.z, w.r, w.kind, 36); }
      fx.warn = fx.warn.filter((w) => t <= w.t1);
      fx.drops = fx.drops.filter((d) => t < d.t);
      for (const r of fx.rings) {
        if (!r.dmg || r.hit || t < r.t || t > r.t + r.life) continue;
        const R = r.r + (r.r1 - r.r) * (t - r.t) / r.life;
        if (h.y < 0.5 && Math.abs(Math.hypot(h.x - r.x, h.z - r.z) - R) < 0.7) { r.hit = true; hurt(r.dmg, r.x, r.z); }
      }
      fx.rings = fx.rings.filter((r) => t - r.t <= r.life);
    },
  };
  return H;
}

/** Behaviour of boss `kind` spawned under officer key `key` (OFF entry). H: the stage's hazards (createHazards). opts:
 *  echo: OFF key DRAGON's copies use, on: { phase: partial beat } (banner / say on entering it). → { step() } */
export function createBoss(kind, game, api, H, { key = kind, echo = 'echo', on = {} } = {}) {
  const TH = BOSS_PHASES[kind], h = game.hero, c = game.crowd, fx = H.fx;
  let phase = 0, t0 = 0, lunge = null, timers = {};
  /** Attack timer: true once `first` frames into the phase, then every `every` frames — the first step it's due while
   *  the boss is standing (a staggered boss attacks as soon as he recovers, never skips a beat). */
  const due = (name, k, first, every) => { const n = timers[name] ?? first; if (k < n) return false; timers[name] = n + every; return true; };
  const standing = (i) => c.st[i] !== ST.DEAD && c.st[i] !== ST.OFF && c.st[i] < ST.HURT;
  /** Move the boss toward (tx, tz) over n frames after `wait` frames (a lunge / leap), then run `hit`. */
  const go = (i, tx, tz, n, hit, wait = 0) => { lunge = { i, tx, tz, k: -wait, n, hit }; };
  const clampX = (x) => Math.max(-28, Math.min(28, x));

  function enter(p, i) {
    fx.phase[key] = p;
    if (kind === 'ox' && p === 3) for (const sx of [-1, 1]) api.squad({ at: [clampX(c.x[i] + sx * 9), c.z[i] + 4], n: 10 });
    if (kind === 'viper' && p === 2) for (const sx of [-1, 1]) api.squad({ at: [clampX(c.x[i] + sx * 10), c.z[i] + 2], n: 12 });
    if (kind === 'dragon') {
      if (p === 2) [[-2.8, 1], [2.8, 1], [0, -2.8]].forEach(([dx, dz], n) =>
        api.fire({ officers: { ['echo' + (n + 1)]: { like: echo, at: [c.x[i] + dx, c.z[i] + dz], engaged: true } } }));
      if (p >= 3) fx.dark = true;
      if (p === 4) api.model(key, 'dragon_unmasked');
    }
  }

  function run(p, k, i) {
    if (!standing(i) || lunge) return;
    const d = Math.hypot(h.x - c.x[i], h.z - c.z[i]), ang = Math.atan2(h.x - c.x[i], h.z - c.z[i]);
    const toward = (m) => { const s = Math.min(m, Math.max(0, d - 1.2)); return [c.x[i] + Math.sin(ang) * s, c.z[i] + Math.cos(ang) * s]; };
    const charge = (reach, r, dmg, tell = 30, n = 16) => {             // telegraph the landing spot, then rush there
      const [x, z] = clampWalk(...toward(reach), 0.3);
      H.strike(x, z, r, tell + n, dmg, 'bash');
      go(i, x, z, n, null, tell);
    };
    const around = (n, R, r, delay, dmg, gap, kind_, drop) => {        // n blows on a ring round the hero (+ one on him)
      H.strike(h.x, h.z, r, delay, dmg, kind_, drop);
      for (let q = 0; q < n; q++) { const a = q * Math.PI * 2 / n + k * 0.013; H.strike(h.x + Math.sin(a) * R, h.z + Math.cos(a) * R, r, delay + (q + 1) * gap, dmg, kind_, drop); }
    };
    if (kind === 'crane') {
      if (p === 1 && d < 16 && due('cast', k, 100, 200)) H.strike(h.x, h.z, 2.4, 50, 12, 'spam');
      if (p === 2 && d < 18 && due('cast', k, 60, 210)) {
        const fx_ = Math.sin(h.yaw), fz = Math.cos(h.yaw);
        for (let q = 0; q < 3; q++) H.strike(h.x + fx_ * q * 2.6, h.z + fz * q * 2.6, 2.3, 46 + q * 12, 12, 'spam');
      }
      if (p === 3) { if (c.cd[i] > 40) c.cd[i] = 40; if (due('flood', k, 50, 240)) around(5, 3.4, 2.0, 50, 12, 8, 'spam'); }
    } else if (kind === 'ox') {
      if (d < 12 && d > 2.5 && due('charge', k, 110, 230)) charge(6, 2.0, 16);
      if (p === 2 && due('shock', k, 70, 290)) { H.strike(c.x[i], c.z[i], 2.2, 40, 14, 'slam'); timers.waveAt = api.t() + 40; }
      if (p === 3) {
        if (c.cd[i] > 30) c.cd[i] = 30;
        if (due('slam', k, 30, 250)) for (let q = 0; q < 3; q++) H.strike(c.x[i], c.z[i], 3.2 + q * 0.6, 32 + q * 26, 16, 'slam');
      }
    } else if (kind === 'viper') {
      if (p === 1 && d < 20 && due('drop', k, 90, 230)) around(2, 3.2, 2.0, 60, 12, 14, 'payload', true);
      if (p === 2 && due('drop', k, 60, 210)) around(4, 3.6, 2.0, 56, 12, 10, 'payload', true);
      if (p === 3) {
        if (c.cd[i] > 34) c.cd[i] = 34;
        if (due('carpet', k, 40, 200)) for (let q = 0; q < 7; q++) {     // a carpet walking from him through the hero
          const u = (q + 1) / 5;
          H.strike(c.x[i] + (h.x - c.x[i]) * u + ((q % 2) - 0.5) * 2.4, c.z[i] + (h.z - c.z[i]) * u, 2.0, 40 + q * 9, 13, 'payload', true);
        }
      }
    } else if (kind === 'dragon') {
      if (p === 1) { if (c.cd[i] > 40) c.cd[i] = 40; if (d < 13 && d > 2.5 && due('rush', k, 90, 200)) charge(7, 2.0, 16, 26, 14); }
      if (p === 2 && due('shock', k, 80, 300)) { H.strike(c.x[i], c.z[i], 2.2, 40, 14, 'slam'); timers.waveAt = api.t() + 40; }
      if (p === 3) {
        if (due('drop', k, 60, 260)) around(3, 3.4, 2.0, 56, 13, 10, 'payload', true);
        if (due('shock', k, 190, 260)) { H.strike(c.x[i], c.z[i], 2.2, 40, 14, 'slam'); timers.waveAt = api.t() + 40; }
      }
      if (p === 4) {
        if (c.cd[i] > 24) c.cd[i] = 24;
        if (d < 14 && d > 2 && due('leap', k, 70, 190)) charge(9, 3.2, 22, 34, 18);
        if (due('drop', k, 160, 280)) around(5, 4, 1.9, 50, 13, 8, 'payload', true);
      }
    }
  }

  return {
    step() {
      const i = api.officer(key);
      if (i < 0 && !api.dead(key)) return;                         // not on the field yet
      if (api.dead(key)) { if (phase < 9) { phase = 9; fx.phase[key] = 9; lunge = null; if (kind === 'dragon') fx.dark = false; } return; }
      // phase floor + phase changes
      let f = c.hp[i] / c.hpMax[i];
      const p = 1 + TH.filter((x) => f < x).length;
      if (p > phase + 1 && phase > 0) {                           // one hit skipped a threshold: hold at the first one
        c.hp[i] = Math.max(c.hp[i], (TH[phase - 1] - 0.002) * c.hpMax[i]); f = c.hp[i] / c.hpMax[i];
      }
      const np = 1 + TH.filter((x) => f < x).length;
      if (np !== phase) {
        if (phase > 0) { const thr = TH[np - 2]; if (f < thr - 0.004) { c.hp[i] = (thr - 0.002) * c.hpMax[i]; f = c.hp[i] / c.hpMax[i]; } }
        phase = np; t0 = api.t(); timers = {}; enter(np, i);
        if (on[np]) api.fire(on[np]);
      }
      if (timers.waveAt && api.t() >= timers.waveAt) { timers.waveAt = 0; H.wave(c.x[i], c.z[i], 1.5, 9, 50, 12); }
      if (lunge) {                                                  // a scripted rush / leap in progress
        const L = lunge;
        if (++L.k > 0) {
          if (L.k === 1) { L.x0 = c.x[L.i]; L.z0 = c.z[L.i]; }
          const u = L.k / L.n, e = u * (2 - u);
          [c.x[L.i], c.z[L.i]] = clampWalk(L.x0 + (L.tx - L.x0) * e, L.z0 + (L.tz - L.z0) * e, 0.3); c.vx[L.i] = c.vz[L.i] = 0;
          if (L.k >= L.n) { lunge = null; L.hit?.(); }
        }
      }
      run(phase, api.t() - t0, i);
    },
  };
}
