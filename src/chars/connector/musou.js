// Connector's Overclock GIGA CONNECT (sim; interface of src/musou/musou.js). It blows itself up to a hundred times its
// size (the render side scales the rig 4.64×: ./model.js giantScale) and fights as a giant. Timeline (Overclock frames
// t, 230 = control returns; hitstop pauses it):
//   0   activation: the world holds still, it shudders and inflates (cut-in, 30 f); the ring round it is shoved clear
//   44 / 74 / 104  three giant hops, 3.2 m forward each (clamped to walkable ground), a 6 m slam under each landing
//   124–164 the giant spin: a 7 m circle, a tick every 8 f (spin reaction)
//   190 FINISHER: the belly flop — a ring blasts out to 10 m (launch tiers)
//   206 it lets the air out
import { emit } from '../../core/events.js';
import { setState, stickDir } from '../../hero/locomotion.js';
import { clampWalk } from '../../world/map.js';
import { offSun, smooth, endMusou, gauge, auraShove, auraMove } from '../../musou/musou.js';
import { MUSOU_FRAMES } from './anims.js';

export const CONNECTOR_MUSOU = {
  activation: 30, hops: [44, 74, 104], hopLen: 3.2, hopFrames: 13, hopR: 6, spin: [124, 164], spinEvery: 8, spinR: 7, finisher: 190, end: MUSOU_FRAMES, cost: 1 / 3,
  aura: { r0: 4.4, k: 0.35, frames: 12 },
  hopHit: { shape: 'circle', range: 6, dmg: 20, kb: 'blow', force: 9, lift: 6, hitstop: 4, heavy: true, yMax: 5 },
  spinHit: { shape: 'circle', range: 7, dmg: 8, kb: 'spin', force: 5, lift: 3, hitstop: 0, yMax: 6 },
  waveR: 10, waveFrames: 16,
  waveHit: { shape: 'circle', range: 0, dmg: 46, kb: 'launch', force: 7, lift: 10, hitstop: 0, heavy: true, yMax: 8 },
};

export function createMusou(game) {
  const M = CONNECTOR_MUSOU;
  const mu = { active: false, t: 0, wasReady: false, seq: 0, ax: 0, az: 0, yaw0: 0, waveR: 0, hx: 0, hz: 0 };
  const shot = { id: 0, yaw: 0, dist: 0, pitch: 0, fov: 50, height: 1.2, side: 0, shake: 1 };
  const push = [];
  let startMusou = 0;

  mu.reset = () => { mu.active = false; mu.t = 0; mu.wasReady = false; mu.waveR = 0; push.length = 0; };

  mu.start = (inp) => {
    const h = game.hero;
    const [sx, sz, smag] = stickDir(inp, game.cam.yaw);
    if (smag) h.yaw = Math.atan2(sx, sz);
    mu.active = true; mu.t = 0; mu.waveR = 0; mu.seq++;
    mu.yaw0 = h.yaw; mu.ax = h.x; mu.az = h.z; mu.hx = h.x; mu.hz = h.z;
    startMusou = h.musou;
    h.move = null; h.vx = h.vz = 0;
    setState(h, 'musou');
    h.musouClip = 'mu_connector'; h.musouT = 0;
    h.iframes = M.end + 30;
    game.freeze = 2;
    auraShove(game.crowd, h, M.aura, push);                          // room to grow
    emit('musou:start', { x: h.x, z: h.z, activation: M.activation, burstAt: M.finisher, contact: M.hops[0] });
  };

  const hitAt = (hit, x, z, yaw, key, rehit) => game.combat.strike(hit, x, z, yaw, key - (mu.seq % 1000) * 100000, rehit, 'musou');

  mu.stepHero = () => {
    const h = game.hero, t = ++mu.t;
    h.iframes = Math.max(h.iframes, 2);
    h.vx = h.vz = 0;
    h.musouClip = 'mu_connector'; h.musouT = t / M.end;
    h.musou = Math.max(0, startMusou - h.musouMax * M.cost * Math.min(1, t / M.hops[0]));
    if (t <= M.aura.frames) auraMove(game.crowd, push, t / M.aura.frames);
    if (t < M.activation) { game.freeze = Math.max(game.freeze, 2); return; }
    M.hops.forEach((f, j) => {                                       // three giant hops forward
      const f0 = f - M.hopFrames;
      if (t === f0) { mu.hx = h.x; mu.hz = h.z; }
      if (t > f0 && t <= f) {
        const u = (t - f0) / M.hopFrames;
        [h.x, h.z] = clampWalk(mu.hx + Math.sin(h.yaw) * M.hopLen * u, mu.hz + Math.cos(h.yaw) * M.hopLen * u, 0.3);
      }
      if (t !== f) return;
      const n = hitAt(M.hopHit, h.x, h.z, h.yaw, -2100 - j, false);
      emit('musou:hit', { x: h.x, y: 0.6, z: h.z, stage: j ? 'rush' : 'contact', yaw: h.yaw, n });
    });
    const [s0, s1] = M.spin;                                         // the giant spin
    if (t >= s0 && t <= s1 && (t - s0) % M.spinEvery === 0) {
      const k = (t - s0) / M.spinEvery, n = hitAt(M.spinHit, h.x, h.z, h.yaw, -2500 - k, false);
      if (n) { const a = k * 1.3; emit('musou:hit', { x: h.x + Math.sin(a) * 4, y: 1.2, z: h.z + Math.cos(a) * 4, stage: 'rush', yaw: a, n: k }); }
    }
    const w = t - M.finisher;
    if (w >= 0 && w <= M.waveFrames) {                               // the belly flop's ring
      const u = w / M.waveFrames;
      mu.waveR = M.waveR * (1 - (1 - u) * (1 - u) * (1 - u)) + 1.5;
      const n = hitAt({ ...M.waveHit, range: mu.waveR, lift: M.waveHit.lift - 3 * u, hitstop: w === 0 ? 6 : 0, heavy: w < 2 }, h.x, h.z, h.yaw, -3000, false);
      if (w === 0) emit('musou:burst', { count: n, x: h.x, z: h.z });
      else if (n) { const a = w * 2.4, R = mu.waveR * 0.9; emit('musou:hit', { x: h.x + Math.sin(a) * R, y: 0.4, z: h.z + Math.cos(a) * R, stage: 'wave', yaw: a, n: w }); }
    }
    if (t >= M.end) endMusou(mu, h, startMusou, M.cost);
  };

  // the cameras stand well back: it is eight metres tall
  mu.shot = () => {
    if (!mu.active) return null;
    const t = mu.t, o = shot;
    o.shake = 0.5; o.side = 0;
    if (t < M.activation) {                                          // low, in front of it, pulling back as it grows
      const u = smooth(t / M.activation);
      Object.assign(o, { id: 1, yaw: offSun(mu.yaw0 + Math.PI * 0.85), dist: 4.5 + 9 * u, pitch: 0.18 - 0.1 * u, fov: 50, height: 1.2 + 2.2 * u, side: 0.1 });
    } else if (t < M.spin[0] - 6) {                                  // behind and to the side: the hops
      Object.assign(o, { id: 2, yaw: offSun(mu.yaw0 + 0.5), dist: 15, pitch: 0.2, fov: 58, height: 3.6, shake: 0.9 });
    } else if (t < M.finisher - 8) {                                 // high and wide: the spin
      Object.assign(o, { id: 3, yaw: offSun(mu.yaw0 - 0.4), dist: 17, pitch: 0.34, fov: 58, height: 4.5, shake: 0.6 });
    } else {                                                          // the belly flop: low and wide, then back in as it shrinks
      const u = smooth((t - M.finisher + 8) / (M.end - M.finisher + 8));
      Object.assign(o, { id: 4, yaw: offSun(mu.yaw0 - 0.6), dist: 17 - 7 * u, pitch: 0.1 + 0.06 * u, fov: 58, height: 3.2 - 1.4 * u, shake: 1 });
    }
    return o;
  };

  gauge(mu, game, M.cost);
  return mu;
}
