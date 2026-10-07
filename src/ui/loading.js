// Loading card (#loading, ui lane). TO BATTLE on the select screen wipes into this card (so does RETRY on the result),
// then main.js deploy() sets the battle up for the chosen fighter under it — kit views built, every material compiled, a
// few frames rendered — and wipes on into the battle. So the field is never seen with the wrong fighter and the first
// battle frames don't stall on shader compiles.
// Layout: the fighter's key art full-bleed (ctx.art: the select stage's key-art still, main.js snapArt) with a slow
// push-in, a dark band on the left with the stage band, the name + role chip, the intro line; a tip and a progress bar
// with the current set-up stage along the bottom. No art (dev entry): the plain background.
// ctx in: { mode, char, chapter?, art? }. main.js drives progress(p, label?) and ready(); nothing here touches the sim.
import { CHARS, DEFAULT_CHAR } from '../chars/index.js';
import { replay } from './menu.js';
import { difficulty } from '../core/difficulty.js';
import { resolveChapter } from '../story/chapters.js';

export const MODE = { story: ['Tournament', '1000 challengers · four masters · one title'], free: ['Practice', 'Endless waves · no knock-out'] };
// keep in step with the controls table (title.js CONTROLS)
const TIPS = [
  'Tap J for the full combo; press K mid-combo for a charge finisher — a different one after every hit of the string.',
  'Every hit fills the gauge. When a segment is full, press I to unleash your Overclock.',
  'L or Shift dodges; the roll slips straight through a blow — and through a boss\'s red circle.',
  'A red disc on the floor is a boss attack on its way: it lands when the disc is full. Walk out of it or roll through.',
  'Travelling shock rings can be jumped: press Space as the ring reaches you.',
  'R recenters the camera behind you, or onto the nearest boss.',
  'Click the field to steer the camera with the mouse; Q / E turn it too.',
  'Clearing a round heals you. The scoreboard over the Dragon Ring shows the live K.O. count.',
  'Run for a moment, then attack: every fighter has a dash attack that ploughs through a rank.',
];

export function createLoading(el) {
  el.innerHTML = `
    <div class="l-art"></div><div class="l-veil"></div>
    <section class="l-main">
      <p class="l-ch"><b></b><small></small></p>
      <div class="l-name"><h1></h1><i class="l-chip"></i></div>
      <p class="l-wpn"></p>
      <p class="l-line"></p>
    </section>
    <footer class="l-foot">
      <p class="l-tip"><span>Tip</span><b></b></p>
      <div class="l-prog"><p class="l-state"></p><div class="l-bar"><i></i></div></div>
    </footer>`;
  const $ = (s) => el.querySelector(s), bar = $('.l-bar i');
  const state = (label) => { $('.l-state').textContent = label; };
  return {
    enter(c) {
      const ch = CHARS[c.char] || CHARS[DEFAULT_CHAR], C = resolveChapter(c.chapter, ch.id), d = difficulty();
      el.style.setProperty('--acc', ch.accent);
      $('.l-art').style.backgroundImage = c.art ? `url("${c.art}")` : 'none';
      el.classList.remove('ready'); replay(el, 'in');
      $('.l-ch b').textContent = c.mode === 'story' ? `${C.title.small} · ${C.title.name}` : `${MODE.free[0]} · ${C.title.name}`;
      $('.l-ch small').textContent = `${c.mode === 'story' ? C.title.sub : MODE.free[1]} · ${d.name}`;
      $('.l-name h1').textContent = ch.name; $('.l-chip').textContent = ch.role;
      $('.l-wpn').textContent = ch.weapon;
      $('.l-line').textContent = `“${ch.lines.intro}”`;
      $('.l-tip b').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];   // UI only, not the sim
      state('Booting');                                    // first label; deploy() then climbs through its stages
      this.progress(0.06);
    },
    exit() {},
    /** p 0..1 plus the stage's label: real set-up stages (main.js deploy). */
    progress(p, label) { bar.style.transform = `scaleX(${p})`; if (label) state(label); },
    ready() { el.classList.add('ready'); state('Ready'); },
  };
}
