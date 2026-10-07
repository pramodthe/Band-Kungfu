// Overclock helpers shared by every fighter's Overclock (the sim side lives in src/chars/<id>/musou.js, interface below):
// easing, a camera yaw that never looks straight into the key light, the activation shove, the end of an Overclock and
// the gauge. ("musou" is the engine's internal name for the Overclock: game.musou, hero.musou = the gauge, musou:* events.)
// Interface of a kit's createMusou(game) → mu: { active, t, reset(), start(inp), stepHero(inp), shot() → camera shot |
// null, ready(), step() }; emits musou:ready / start / hit / burst / end; hits go through game.combat.strike(..., 'musou').
import * as THREE from 'three';
import { emit } from '../core/events.js';
import { setState } from '../hero/locomotion.js';
import { ST, wrap } from '../crowd/crowd.js';
import { SUN_AZ } from '../world/sky.js';

export const easeOut = (u) => 1 - (1 - u) * (1 - u);
export const smooth = (u) => THREE.MathUtils.smoothstep(u, 0, 1);
// Overclock cameras never look straight into the key light (a backlit crowd is an unreadable payoff): the view yaw keeps
// at least SUN_AVOID from its azimuth.
const SUN_AVOID = 1.05;
export const offSun = (y) => { const d = wrap(y - SUN_AZ); return Math.abs(d) >= SUN_AVOID ? y : SUN_AZ + (d < 0 ? -1 : 1) * SUN_AVOID; };

/** Activation aura: grounded soldiers within r0 / (1 − k) of the hero recoil (frozen mid-stagger until contact); fills
 *  push with [i, fromX, fromZ, toX, toZ] (to = r0 + d·k out), eased by auraMove. */
export function auraShove(c, h, { r0, k }, push) {
  const R1 = r0 / (1 - k);
  push.length = 0;
  for (let i = 0; i < c.N; i++) {
    const s = c.st[i];
    if (s === ST.OFF || s === ST.DEAD || c.y[i] > 0.3) continue;
    const dx = c.x[i] - h.x, dz = c.z[i] - h.z, d = Math.hypot(dx, dz);
    if (d >= R1 || d < 1e-3) continue;
    const f = (r0 + d * k) / d;
    push.push([i, c.x[i], c.z[i], h.x + dx * f, h.z + dz * f]);
    c.releaseToken(i);
    c.st[i] = ST.KNOCK; c.stT[i] = 0; c.vx[i] = c.vz[i] = 0;
  }
}
/** The shove at u (0..1 of its frames), eased; bodies no longer knocked back (hit meanwhile) are left alone. */
export function auraMove(c, push, u) {
  u = easeOut(u);
  for (const [i, fx, fz, tx, tz] of push) if (c.st[i] === ST.KNOCK) { c.x[i] = fx + (tx - fx) * u; c.z[i] = fz + (tz - fz) * u; }
}
/** Control returns: the spent segment settles, a short grace, back to idle. */
export function endMusou(mu, h, startMusou, cost) {
  mu.active = false;
  h.musou = Math.max(0, startMusou - h.musouMax * cost);
  h.iframes = 30;
  setState(h, 'idle');
  emit('musou:end', {});
}
/** mu.ready (at least one full gauge segment: hero.js asks before starting an Overclock) and mu.step: the gauge-ready
 *  notification (edge-triggered), then `also` (the kit's own per-frame sim). */
export function gauge(mu, game, cost, also) {
  mu.ready = () => game.hero.musou >= game.hero.musouMax * cost - 1e-6;
  mu.step = () => {
    const ready = mu.ready() && game.hero.state !== 'musou';
    if (ready && !mu.wasReady) emit('musou:ready', {});
    mu.wasReady = ready;
    also?.();
  };
}
