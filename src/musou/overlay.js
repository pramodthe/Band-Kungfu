// Overclock screen overlay shared by the kits' Overclock views (src/chars/<id>/view.js): the grade's DOM layers (display
// space, above the canvas, below the HUD — a multiply dim and a screen-blended wash; each view paints its own gradients)
// and the frame-driven cut-in: OVERCLOCK slammed in, the move's name under it, the fighter's tag chip.
import * as THREE from 'three';

const { clamp, inverseLerp } = THREE.MathUtils;
/** 0 before a, 1 after b, linear between. */
export const ramp = (t, a, b) => clamp(inverseLerp(a, b, t), 0, 1);

/** sub: the move's name, seal: the tag chip text, css: { big, sub, seal } = the kit's colour / glow of the three. */
export function createOverlay({ sub, seal, css }) {
  const layer = (blend) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;inset:0;pointer-events:none;opacity:0;display:none;mix-blend-mode:${blend}`; return d; };
  const dim = layer('multiply'), wash = layer('screen');
  (document.getElementById('c') || document.body.firstChild).after(dim, wash);
  const style = document.createElement('style');
  style.textContent = `
    .mu-cut { position: fixed; inset: 0; pointer-events: none; z-index: 5; opacity: 0; display: none; font-family: var(--disp, "Arial Black", Impact, sans-serif); }
    .mu-cut .big { position: absolute; right: 5%; top: 40%; font-size: 11vh; line-height: 1; font-weight: 900; font-style: italic; letter-spacing: .2vh;
      transform-origin: 100% 50%; text-transform: uppercase; white-space: nowrap; ${css.big} }
    .mu-cut .sub { position: absolute; right: 5.4%; top: calc(40% + 12.5vh); font: 700 4vh/1 var(--mono, "Courier New", monospace); letter-spacing: .6vh;
      text-transform: uppercase; white-space: nowrap; ${css.sub} }
    .mu-cut .seal { position: absolute; right: 5.4%; top: calc(40% - 5.5vh); padding: .6vh 1.4vh; background: #ff3ea8; color: #0a0c10; border-radius: .4vh;
      font: 700 2.4vh/1 var(--mono, "Courier New", monospace); letter-spacing: .4vh; transform-origin: 100% 50%;
      box-shadow: 0 0 2vh rgba(255,62,168,.6); ${css.seal || ''} }`;
  document.head.appendChild(style);
  const cutEl = document.createElement('div');
  cutEl.className = 'mu-cut';
  cutEl.innerHTML = `<div class="seal">${seal}</div><div class="big">Overclock</div><div class="sub">${sub}</div>`;
  document.body.appendChild(cutEl);
  const [cutSeal, cutBig, cutSub] = cutEl.children;
  const setStyle = (el, k, v) => { if (el.style[k] !== v) el.style[k] = v; };
  const show = (el, v) => { setStyle(el, 'display', v > 0 ? 'block' : 'none'); setStyle(el, 'opacity', v.toFixed(3)); };   // unused layers leave the compositor
  return {
    dim, wash, setStyle, show,
    /** Cut-in at Overclock frame t (t0 = its first frame): k = opacity, st = the slam-in 0..1; the chip stamps at
     *  t0 + 8..12, the move name fades in over t0 + 10..20. */
    cut(t, t0, k, st) {
      show(cutEl, k);
      if (k <= 0) return;
      const se = ramp(t, t0 + 8, t0 + 12);
      setStyle(cutBig, 'transform', `scale(${(1.6 - 0.6 * st * st).toFixed(3)}) translateX(${((t - t0) * -0.08).toFixed(2)}vh) skewX(-6deg)`);
      setStyle(cutSeal, 'transform', `scale(${(2.2 - 1.2 * se).toFixed(3)})`);
      setStyle(cutSeal, 'opacity', se.toFixed(3));
      setStyle(cutSub, 'opacity', ramp(t, t0 + 10, t0 + 20).toFixed(3));
    },
    hide() { show(dim, 0); show(wash, 0); show(cutEl, 0); },
    dispose() { for (const el of [dim, wash, style, cutEl]) el.remove(); },
  };
}
