// Character select (#select, ui lane). Over the live arena: the focused fighter's actual voxel model (kit.model on
// its own rig, idle clip, its secondary life running) stands on the dock's centre lane on the right of the frame, a cool
// key light on its front, the hall behind in deep bokeh (post.js DoF focused on it), slow turntable, a spin-in on every
// focus change and data motes drifting through the light. Left: the roster (pixel portraits), the info panel (name, role,
// weapons, bio, attack / defence / speed / reach bars, the Overclock) and the fighter's intro line.
// All data comes from CHARS / CHAR_ORDER (src/chars/index.js), nothing per fighter.
// Input: hover only highlights a card; a click (tap) on a card focuses that fighter (spin-in, info panel swaps), ↑/↓ /
// d-pad too. Deploy = the TO BATTLE button, Enter / A, or a double-click on the card that was already focused.
// ctx in: { mode }. Deploy → wipe → flow.go('loading', { mode, char, chapter }) (loading.js); back → title.
// 3D is render-only: view(scene, camera, focus, dt) runs after the gameplay camera rig while this screen is up.
import * as THREE from 'three';
import { CHARS, CHAR_ORDER, paintPortrait } from '../chars/index.js';
import { sampleClip, POSE_SIZE } from '../hero/rig.js';
import { createNav, sfx, inkWipe, wiping, afterWipe, stamp, clearStamp, replay } from './menu.js';
import { STAGE as TITLE } from './title.js';
import { MODE } from './loading.js';
import { difficulty } from '../core/difficulty.js';
import { chaptersFor } from '../story/chapters.js';
import { dotTex, scatter, passPoint, standOfficer, poseOfficer } from './stage.js';

const STATS = [['atk', 'Attack'], ['def', 'Defence'], ['speed', 'Speed'], ['range', 'Reach']];
// stage framing: fighter ≈ 6.6 m from the lens, 30° vFOV (full body + headroom), aim shifted so it stands right of the
// info column
const STAGE = { dist: 6.6, eye: 1.2, aim: 1.05, fov: 30, screenX: 0.5, face: Math.PI - 0.38, sway: 0.28, spin: 1.35, motes: 110 };
// key-art frame (snapshot for the loading card / result, main.js snapArt): closer, knees up, the title's held pose
const KEYART = { dist: 4.6, eye: 1.35, aim: 1.25, screenX: 0.42 };

export function createSelect(el, flow) {
  el.innerHTML = `
    <div class="s-veil"></div>
    <header class="s-head"><h2>Choose your fighter</h2><span class="s-mode"></span></header>
    <aside class="s-roster">${CHAR_ORDER.map((id, i) => { const c = CHARS[id];
      return `<button class="s-card" data-i="${i}" style="--acc:${c.accent}" title="${c.name} — double-click to deploy">
        <canvas width="20" height="20"></canvas><b>${c.name}</b><small>${c.role}</small></button>`; }).join('')}</aside>
    <article class="s-info">
      <div class="s-name"><h1></h1><i class="s-chip"></i></div>
      <p class="s-wpn"><span>Weapons</span><b></b></p>
      <p class="s-bio"></p>
      <ul class="s-stats">${STATS.map(([k, n]) => `<li data-k="${k}"><b>${n}</b><span>${[0, 1, 2, 3, 4].map((j) => `<i style="--i:${j}"></i>`).join('')}</span></li>`).join('')}</ul>
      <div class="s-musou"><span>Overclock</span><b></b><small></small></div>
    </article>
    <div class="s-line"><p></p></div>
    <div class="s-act"><button class="s-back"><b>Back</b></button><button class="s-go"><b>To battle</b></button></div>
    <footer class="ui-foot"><span><kbd>↑</kbd><kbd>↓</kbd>Fighter</span><span><kbd>Click</kbd>Select</span>
      <span><kbd>Enter</kbd><kbd class="pad">A</kbd>Deploy</span><span><kbd>Esc</kbd><kbd class="pad">B</kbd>Back</span>
      <span><kbd>Drag</kbd>Turn</span></footer>`;
  const $ = (s) => el.querySelector(s), cards = [...el.querySelectorAll('.s-card')].sort((a, b) => a.dataset.i - b.dataset.i);
  cards.forEach((b, i) => paintPortrait(b.querySelector('canvas'), CHARS[CHAR_ORDER[i]]));
  let ctx = {}, cur = 0, busy = false, spinT = 0;

  // ---- 2D: info panel
  function show(i, quiet) {
    i = (i + cards.length) % cards.length;
    if (i === cur && !quiet) return;
    cards[cur].classList.remove('on'); cur = i; cards[cur].classList.add('on');
    // DOM focus follows the selection (a clicked card kept focus and its ring after ↑/↓: two cards looked lit)
    if (document.activeElement?.classList.contains('s-card')) cards[cur].focus({ preventScroll: true });
    replay(cards[cur], 'pick');                           // the chosen card flashes in
    const c = CHARS[CHAR_ORDER[i]];
    el.style.setProperty('--acc', c.accent);
    $('.s-name h1').textContent = c.name; $('.s-name').style.setProperty('--n', c.name.length);
    $('.s-chip').textContent = c.role;
    $('.s-wpn b').textContent = c.weapon;
    $('.s-bio').innerHTML = c.bio.map((l) => `<span>${l}</span>`).join('');
    for (const li of el.querySelectorAll('.s-stats li')) {
      const n = c.stats[li.dataset.k];
      li.querySelectorAll('i').forEach((q, k) => q.classList.toggle('f', k < n));
    }
    $('.s-musou b').textContent = c.musou.name; $('.s-musou small').textContent = c.musou.desc;
    $('.s-line p').textContent = `“${c.lines.intro}”`;
    replay(el, 'swap');                                    // name in, stat bars refill, the line types in
    spinT = 0;
    if (!quiet) sfx('move');
  }

  const go = () => {
    if (busy) return;
    if (wiping()) return afterWipe(go);             // pressed while this screen is still being uncovered: queued
    busy = true;
    stamp($('.s-act'), 'GO!');
    const id = CHAR_ORDER[cur], chapter = chaptersFor(id)[0];
    setTimeout(() => inkWipe(() => flow.go('loading', { mode: ctx.mode, char: id, chapter })), 520);
  };
  const back = () => {
    if (busy) return;
    if (wiping()) return afterWipe(back);
    busy = true; sfx('back');
    inkWipe(() => flow.go('title'));
  };
  const nav = createNav({ move: (d) => { if (!busy) show(cur + d); }, ok: go, back });

  // click a card = focus it; a double-click deploys only if the first click landed on the already-focused card
  let armed = false;
  el.addEventListener('click', (e) => {
    const card = e.target.closest('.s-card');
    if (card) {
      if (busy) return;
      const i = +card.dataset.i;
      if (i !== cur) { show(i); armed = false; }
      else if (e.detail >= 2 && armed) go();
      else armed = true;
    } else if (e.target.closest('.s-go')) go();
    else if (e.target.closest('.s-back')) back();
  });
  // drag anywhere off the panels turns the fighter (eased back to the pose when let go)
  let drag = null, userYaw = 0;
  el.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) drag = e.clientX; });
  addEventListener('pointermove', (e) => { if (drag !== null) { userYaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  addEventListener('pointerup', () => { drag = null; });

  // ---- 3D: fighter stage (render-only; every fighter meshed on the first view, kept for the session)
  let group = null, motes = null, t = 0, keyart = false, key = null, keyHome = null;
  const models = {}, pose = new Float32Array(POSE_SIZE), P = new THREE.Vector3(), tmp = new THREE.Vector3();
  const model = (id) => models[id] || (models[id] = standOfficer(id, group));
  function build(scene) {
    group = new THREE.Group(); scene.add(group);
    const n = STAGE.motes, pos = new Float32Array(n * 3), seed = scatter(n * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: dotTex(0.4, 0.35), size: 0.035, color: new THREE.Color(0.9, 2.2, 2.0),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    motes.userData.seed = seed; motes.frustumCulled = false;
    group.add(motes);
    for (const id of CHAR_ORDER) model(id).root.visible = false;   // mesh every fighter now, under the wipe (no hitch on focus)
    // key light: one of the world's lights ('stage-key') moved to the fighter's front-left while this screen is up
    key = scene.getObjectByName('stage-key');
    keyHome = key && key.position.clone();
  }

  function view(scene, camera, focus, dt) {
    if (!group) build(scene);
    group.visible = true;
    dt = Math.min(dt || 1 / 60, 0.1); t += dt; spinT += dt;
    const S = STAGE, p = passPoint(P, 0.5, 0), id = CHAR_ORDER[cur];
    for (const k in models) models[k].root.visible = k === id;
    const M = model(id);
    if (key) key.position.set(p.x + 1.6, p.y + 2.3, p.z - 2.4);
    // idle clip, turntable sway + spin-in (easeOutCubic) + the player's drag, eased home when let go
    if (drag === null) userYaw *= Math.exp(-2.5 * dt);
    const u = Math.min(1, spinT / 0.75), spin = S.spin * (1 - u) ** 3;
    const ka = keyart && TITLE.cast.find((c) => c.id === id), F = ka ? KEYART : S;
    if (ka && M.K.clips[ka.clip]) sampleClip(M.K.clips[ka.clip], ka.u, pose);
    else sampleClip(M.K.clips.idle, (t % 2.5) / 2.5, pose);
    poseOfficer(M, pose, p, ka ? Math.PI - 0.3 : S.face + Math.sin(t * 0.35) * S.sway + spin + userYaw, dt);
    // motes: a 5 × 3 × 4 m box round the fighter, rising slowly with a lazy sideways drift, wrapping at the top
    const a = motes.geometry.attributes.position, sd = motes.userData.seed;
    for (let i = 0; i < S.motes; i++) {
      const sx = sd[i * 3], sy = Math.abs(sd[i * 3 + 1]), sz = sd[i * 3 + 2];
      const y = (sy * 3.2 + t * (0.05 + sy * 0.08)) % 3.2;
      a.setXYZ(i, p.x + sx * 2.6 + Math.sin(t * 0.4 + i) * 0.25, p.y + y, p.z + sz * 2 + Math.cos(t * 0.3 + i * 1.7) * 0.2);
    }
    a.needsUpdate = true;
    // camera: in front of the fighter (toward -Z, looking up the hall), aim shifted to screen-left so it stands right
    // of the info column; DoF focus on its chest
    const aspect = camera.aspect, side = F.screenX * F.dist * Math.tan(S.fov * Math.PI / 360) * aspect;
    camera.fov = S.fov; camera.updateProjectionMatrix();
    camera.position.set(p.x + side * 0.3, p.y + F.eye, p.z - F.dist);
    tmp.set(p.x + side, p.y + F.aim, p.z);
    camera.lookAt(tmp);
    camera.updateMatrixWorld();
    focus.set(p.x, p.y + 1.1, p.z);
  }

  return {
    view,
    /** main.js snapArt: true for one render = the key-art frame of the focused fighter. */
    keyart(v) { keyart = v; },
    enter(c) {
      ctx = c; busy = false; armed = false; clearStamp($('.s-act'));
      const d = difficulty();
      $('.s-mode').innerHTML = `<b>${(MODE[c.mode] || MODE.free)[0]}</b><i>${d.name}</i>`;
      show(cur, true); replay(el, 'in');                   // header, roster and actions slide in as the wipe uncovers
      nav.start();
    },
    exit() { nav.stop(); drag = null; if (group) group.visible = false; if (key) key.position.copy(keyHome); },
  };
}
