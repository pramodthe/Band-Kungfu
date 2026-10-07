// Saruabh's effects view (render-only; reads game.musou = ./musou.js and the hero's move, never writes sim state).
//  · N5 camera flash: a white-pink cone down the lane; C4 Firewall: a wall of cyan tiles in front of the laptop
//  · Overclock VIRAL STORM: a pink vignette and the cut-in; a pink streak along every dash leg; a cyan swirl ring round
//    the storm with notification tiles rising; the burst — a pink ring and a cyan ring to 6 m, sparks, a flash
import * as THREE from 'three';
import { on } from '../../core/events.js';
import { createOverlay, ramp } from '../../musou/overlay.js';
import { ground } from '../../world/map.js';
import { createFx } from '../shared/fx.js';
import { SARUABH_MUSOU as M } from './musou.js';

const PINK = [3.0, 0.8, 1.6], CYAN = [0.6, 2.4, 2.9], WHITE = [2.6, 2.4, 2.6];

export function createMusouView(scene, game) {
  const mu = game.musou, hero = game.hero;
  const fx = createFx(scene);
  const ov = createOverlay({ sub: 'Viral Storm', seal: 'SARUABH',
    css: { big: 'color:#fff0f6; text-shadow: 0 0 2vh rgba(255,126,182,.9), 0 0 5vh rgba(56,232,255,.5);', sub: 'color:#ffd0e6; text-shadow: 0 0 1vh rgba(0,0,0,.6);',
      seal: 'background:#ff7eb6; box-shadow: 0 0 2vh rgba(255,126,182,.6);' } });
  ov.dim.style.background = 'radial-gradient(ellipse at 50% 55%, rgba(255,235,244,1) 30%, rgba(90,20,70,1) 100%)';
  ov.wash.style.background = 'radial-gradient(circle at 50% 60%, rgba(255,230,240,0.9), rgba(56,232,255,0.25) 70%)';
  const mat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const streaks = [0, 1, 2, 3, 4, 5].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.14), mat(PINK)); m.visible = false; fx.root.add(m); return m; });
  const swirl = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64, 1), mat(CYAN)); swirl.rotation.x = -Math.PI / 2; swirl.visible = false; fx.root.add(swirl);
  let flash = 0, key = -1;
  const subs = [on('musou:burst', (e) => {
    if (game.musou !== mu) return;
    fx.ring({ x: e.x, z: e.z, r0: 0.8, r1: 6, life: 0.45, color: PINK, a: 1.3 });
    fx.ring({ x: e.x, z: e.z, r0: 0.5, r1: 5, life: 0.65, color: CYAN, a: 1.1 });
    fx.sparks({ x: e.x, y: ground(e.x, e.z) + 0.6, z: e.z, n: 70, speed: 9, up: 7, life: 1.1, color: PINK });
    fx.tiles({ x: e.x, z: e.z, r: 5, n: 40, life: 1.3, color: CYAN });
    flash = 1;
  })];
  return {
    update(dt) {
      const t = mu.active ? mu.t : 0, gy = ground(hero.x, hero.z), fwdX = Math.sin(hero.yaw), fwdZ = Math.cos(hero.yaw);
      ov.show(ov.dim, mu.active ? 0.55 * ramp(t, 0, 8) * (1 - ramp(t, M.activation, M.activation + 10)) : 0);
      ov.cut(t, 4, mu.active ? ramp(t, 4, 8) * (1 - ramp(t, M.activation + 2, M.activation + 12)) : 0, ramp(t, 4, 10));
      flash = Math.max(0, flash - dt * 2.4); ov.show(ov.wash, flash * 0.5);
      const k = hero.state === 'attack' ? hero.moveSeq * 1000 + hero.moveT : mu.active ? -t : -1e9;
      if (k !== key) {
        key = k;
        if (hero.state === 'attack') {
          const f = hero.moveT, x = hero.x + fwdX * 0.7, z = hero.z + fwdZ * 0.7;
          if (hero.move === 'n5' && f === 8) fx.cone({ x, z, y: gy + 1.3, yaw: hero.yaw, range: 3.6, ang: 40, life: 0.22, color: WHITE, a: 0.9, grow: 0.4 });
          if (hero.move === 'c4' && f >= 14 && f <= 34 && f % 4 === 2) fx.tiles({ x: hero.x + fwdX * 1.2, z: hero.z + fwdZ * 1.2, r: 0.9, n: 8, life: 0.5, color: CYAN, y: gy + 0.4, rise: 3 });
          if (hero.move === 'c4' && f === 32) fx.cone({ x, z, y: gy + 1.0, yaw: hero.yaw, range: 2.8, ang: 140, life: 0.3, color: CYAN, a: 0.8, grow: 0.4 });
          if (hero.move === 'c6' && f === 58) { fx.ring({ x: hero.x, z: hero.z, y: gy + 0.12, r0: 0.6, r1: 3.8, life: 0.4, color: PINK, a: 1.2 });
            fx.tiles({ x: hero.x, z: hero.z, r: 3, n: 24, life: 1, color: PINK }); }
        }
        if (mu.active && M.storm.includes(t)) fx.tiles({ x: hero.x, z: hero.z, r: 2.4, n: 14, life: 0.9, color: t % 20 ? CYAN : PINK });
      }
      // dash streaks: one per finished leg, a flat band along it at chest height, fading over 40 f
      streaks.forEach((m, n) => {
        const L = mu.active && mu.legs[n];
        m.visible = !!L && t - L[4] < 40;
        if (!m.visible) return;
        const [x0, z0, x1, z1] = L, len = Math.hypot(x1 - x0, z1 - z0) || 0.1;
        m.position.set((x0 + x1) / 2, ground((x0 + x1) / 2, (z0 + z1) / 2) + 1.0, (z0 + z1) / 2);
        m.rotation.set(0, Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2, 0.12 * (n % 2 ? 1 : -1));
        m.scale.set(len, 1, 1);
        m.material.opacity = 1.1 * (1 - (t - L[4]) / 40);
      });
      const tw = mu.active && t >= M.storm[0] - 8 && t < M.storm[3] + 14;
      swirl.visible = tw;
      if (tw) { swirl.position.set(hero.x, gy + 0.3, hero.z); swirl.scale.setScalar(2.6 * (0.7 + 0.3 * Math.sin(t * 0.5))); swirl.rotation.z = t * 0.4;
        swirl.material.opacity = 0.8 * (1 - ramp(t, M.storm[3], M.storm[3] + 14)); }
      fx.update(dt);
    },
    dispose() { fx.dispose(); ov.dispose(); void subs; },
  };
}
