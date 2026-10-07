// Touch controls (ui lane). Shown on coarse pointers (phones, tablets) during a battle while the pause menu is closed; a
// real key press hides them (a keyboard is in use) until the next touch.
//   left half   floating stick: the base lands where the thumb goes down, the knob follows (radius R px); the vector goes
//               to input.virt.stick (full deflection = unit length, like the keys)
//   right side  ATK (J) attack · CHG (K) charge · JMP (Space) jump · DDG (L) dodge · OVERCLOCK (I) (lit while the gauge
//               can pay for one), pause (Esc); each button writes input.virt.key(action, down) — the same held / latch
//               state a key does
//   right half  a drag above the buttons turns the camera (virt.look, rad)
// While the pad shows, body.pad moves the HUD pieces it would cover. Portrait on a coarse pointer: a card asks for
// landscape. Render / DOM only — the sim sees input frames.
// createTouch(virt, game) → { root }
import { on } from '../core/events.js';

const R = 56;                                                       // stick radius, px
const DEAD = 0.12;                                                  // stick deadzone (fraction of R)
const LOOK = { yaw: 0.0065, pitch: 0.0045 };                        // camera drag, rad per px
const BTNS = [                                                      // [action, label, class]
  ['attack', 'ATK', 'b-atk'], ['charge', 'CHG', 'b-chg'], ['jump', 'JMP', 'b-jmp'],
  ['dodge', 'DDG', 'b-ddg'], ['musou', 'OC', 'b-mu'],
];

export function createTouch(virt, game) {
  const coarse = matchMedia('(pointer: coarse)'), portrait = matchMedia('(orientation: portrait)');
  const root = document.createElement('div'); root.id = 'touch'; root.hidden = true;
  root.innerHTML = `<div class="t-stick"><i class="t-base"></i><i class="t-knob"></i></div>
    ${BTNS.map(([a, g, c]) => `<button class="t-btn ${c}" data-a="${a}" aria-label="${a}"><b>${g}</b></button>`).join('')}
    <button class="t-btn b-pause" data-a="pause" aria-label="pause"><b>II</b></button>`;
  const rot = document.createElement('div'); rot.id = 'touch-rot'; rot.hidden = true;
  rot.innerHTML = '<b>Rotate your phone</b><small>This game plays in landscape</small>';
  document.body.append(root, rot);
  const menu = document.getElementById('menu'), stick = root.querySelector('.t-stick');
  const base = root.querySelector('.t-base'), knob = root.querySelector('.t-knob'), muBtn = root.querySelector('.b-mu');
  let battle = false, kb = false;
  on('flow', (e) => { battle = e.state === 'battle'; if (!battle) release(); });
  addEventListener('keydown', (e) => { if (e.isTrusted) kb = true; }, true);
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') kb = false; }, true);

  // pointers: id → { kind: 'stick' | 'look' | action, x, y }
  const ptrs = new Map();
  const setStick = (dx, dy) => {
    const len = Math.hypot(dx, dy) / R;
    let x = 0, y = 0;
    if (len >= DEAD) { const k = len > 1 ? 1 / (len * R) : 1 / R; x = dx * k; y = -dy * k; }
    virt.stick[0] = x; virt.stick[1] = y;
    const c = Math.min(1, len) / Math.max(len, 1e-6);
    knob.style.transform = `translate(${(dx * c).toFixed(1)}px, ${(dy * c).toFixed(1)}px)`;
  };
  function release() {
    for (const [, p] of ptrs) if (p.kind !== 'stick' && p.kind !== 'look' && p.kind !== 'pause') virt.key(p.kind, false);
    ptrs.clear(); virt.stick[0] = virt.stick[1] = 0; stick.classList.remove('on');
  }
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();                        // the pad owns the touch (input.js would attack)
    const b = e.target.closest('.t-btn');
    try { root.setPointerCapture(e.pointerId); } catch { /* synthetic / already gone */ }
    if (b) {
      const a = b.dataset.a;
      b.classList.add('down');
      if (a === 'pause') { dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); return; }
      ptrs.set(e.pointerId, { kind: a, b }); virt.key(a, true);
    } else if (e.clientX < innerWidth * 0.45) {
      ptrs.set(e.pointerId, { kind: 'stick', x: e.clientX, y: e.clientY });
      base.style.left = knob.style.left = `${e.clientX}px`; base.style.top = knob.style.top = `${e.clientY}px`;
      stick.classList.add('on'); setStick(0, 0);
    } else ptrs.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY });
  });
  root.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    e.preventDefault(); e.stopPropagation();
    if (p.kind === 'stick') setStick(e.clientX - p.x, e.clientY - p.y);
    else if (p.kind === 'look') { virt.look(-(e.clientX - p.x) * LOOK.yaw, (e.clientY - p.y) * LOOK.pitch); p.x = e.clientX; p.y = e.clientY; }
  });
  const up = (e) => {
    const p = ptrs.get(e.pointerId);
    root.querySelectorAll('.t-btn.down').forEach((b) => { if (!p || b === p.b || b.dataset.a === 'pause') b.classList.remove('down'); });
    if (!p) return;
    e.stopPropagation(); ptrs.delete(e.pointerId);
    if (p.kind === 'stick') { setStick(0, 0); stick.classList.remove('on'); }
    else if (p.kind !== 'look') virt.key(p.kind, false);
  };
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // visibility + the lit Overclock button, once per animation frame (DOM writes only when something changed)
  let shown = null, lit = null, rotOn = null;
  const tick = () => {
    requestAnimationFrame(tick);
    const show = coarse.matches && battle && menu.hidden && !kb;
    if (show !== shown) { shown = show; root.hidden = !show; document.body.classList.toggle('pad', show); if (!show) release(); }
    const r = coarse.matches && portrait.matches;
    if (r !== rotOn) { rotOn = r; rot.hidden = !r; }
    if (!show) return;
    const l = !!(game.musou?.ready?.() && game.hero.state !== 'musou');
    if (l !== lit) { lit = l; muBtn.classList.toggle('lit', l); }
  };
  tick();
  return { root };
}
