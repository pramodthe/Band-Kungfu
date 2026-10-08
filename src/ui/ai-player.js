import { on, emit } from '../core/events.js';
import { clampWalk } from '../world/map.js';
import { createAiController, observation } from '../ai/controller.js';
import { parseTactic } from '../ai/protocol.js';

export function createAiPlayer(game) {
  const controller = createAiController({ walk: clampWalk });
  const root = document.createElement('section'); root.id = 'ai-player'; root.hidden = true;
  root.setAttribute('aria-label', 'AI player controls');
  root.innerHTML = `<div class="ai-heading"><b>BAND Player</b><span class="ai-state" role="status" aria-live="polite"></span></div>
    <p class="ai-tactic"></p><div class="ai-actions"><button class="ai-toggle">Take over</button><small><kbd>T</kbd> Take over · <kbd>Esc</kbd> Pause</small></div>`;
  document.body.append(root);
  const label = root.querySelector('.ai-state'), reason = root.querySelector('.ai-tactic'), toggle = root.querySelector('.ai-toggle');
  let enabled = false, active = false, battle = false, paused = false, session = null, generation = 0;
  let tactic = null, expires = 0, state = 'waiting', message = '', busy = false, timer = 0;
  let stopping = Promise.resolve();
  const request = async (path, data, keepalive = false) => {
    const response = await fetch(`./api/player/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data), ...(keepalive ? { keepalive } : { signal: AbortSignal.timeout(35000) }) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result.error || 'BAND player is unavailable'), { status: response.status });
    return result;
  };
  function draw() {
    root.hidden = !enabled || !battle;
    document.body.classList.toggle('ai-watch', enabled && battle);
    const status = !active ? 'You control' : paused ? 'Paused' : tactic && performance.now() < expires ? state === 'thinking' ? 'AI playing · thinking' : 'AI playing'
      : state === 'limited' ? 'AI allowance paused' : state === 'queued' ? 'Waiting in queue'
      : state === 'error' ? 'Needs attention' : state === 'connecting' ? 'Connecting' : 'Thinking';
    label.textContent = status;
    reason.textContent = !active ? message || 'Use your normal controls. Let the AI play again whenever you choose.'
      : paused ? 'The fight is paused. Resume to continue watching.'
      : tactic && performance.now() < expires ? tactic.reason.replace(/\b(enemy|target)\s+(?:id\s*)?#?\d+\b/gi, 'the challenger')
      : state === 'limited' ? 'The shared AI allowance is used up for this hour. You can keep playing manually.'
      : state === 'queued' ? 'The agent is choosing another visitor’s tactic. Your turn is queued; you can take over at any time.'
      : message || 'Waiting for the agent to choose a tactic. You can take over at any time.';
    toggle.textContent = active ? 'Take over' : 'Let AI play';
  }
  function stop() {
    generation++; active = false; tactic = null; busy = false; clearTimeout(timer);
    const old = session; session = null;
    if (old) stopping = request('stop', { id: old.id }, true).catch(() => {});
    draw();
  }
  async function begin() {
    if (active || !battle || !enabled) return;
    const current = ++generation; active = true; state = 'connecting'; message = ''; tactic = null; draw();
    try {
      await stopping;
      if (current !== generation || !active) return;
      const started = await request('session', {});
      if (current !== generation || !active) { request('stop', { id: started.id }, true).catch(() => {}); return; }
      session = started; state = 'waiting'; poll(current);
    } catch (error) {
      if (current !== generation) return;
      active = false; state = 'error'; message = error.status === 503
        ? 'BAND Player is not set up on this game server. You can play manually.'
        : error.status === 409 ? 'The AI is serving other visitors. Play manually or try again shortly.'
        : 'Could not connect to BAND Player. You can play manually or retry.';
      draw();
    }
  }
  async function poll(current) {
    if (current !== generation || !active || !session) return;
    if (paused || !battle) { timer = setTimeout(() => poll(current), 1000); return; }
    if (busy) return;
    busy = true;
    try {
      const result = await request('observe', { id: session.id, observation: observation(game) });
      if (current !== generation || !active) return;
      state = result.state;
      tactic = result.tactic ? parseTactic(result.tactic) : null;
      expires = performance.now() + Math.min(20000, Math.max(0, result.validForMs || 0));
      message = state === 'error' ? 'The agent could not choose a tactic. You can take over while it retries.' : '';
    } catch (error) {
      if (current !== generation) return;
      tactic = null;
      if (error.status === 404) { stop(); message = ''; begin(); return; }
      state = 'error'; message = 'BAND connection interrupted. You can take over while it retries.';
    } finally {
      if (current === generation) { busy = false; draw(); timer = setTimeout(() => poll(current), 1000); }
    }
  }
  const takeOver = () => { stop(); emit('ai:takeover'); message = 'You have control. Move, attack, or dodge using your normal controls.'; draw(); };
  toggle.addEventListener('click', () => active ? takeOver() : begin());
  addEventListener('keydown', (e) => { if (battle && enabled && e.code === 'KeyT' && !e.repeat && !e.ctrlKey && !e.metaKey) takeOver(); });
  addEventListener('pagehide', stop);
  on('flow', (e) => {
    battle = e.state === 'battle';
    if (!battle) stop(); else if (enabled) begin();
    draw();
  });
  return {
    reset(watch) { stop(); enabled = watch; message = ''; controller.reset(); draw(); },
    pause(value) { paused = value; draw(); },
    sample(human) {
      if (!active) return human;
      if (tactic && performance.now() >= expires) {
        tactic = null; state = 'waiting'; message = 'Waiting for a fresh tactic. You can take over.'; draw();
      }
      const action = ['attack', 'charge', 'jump', 'dodge', 'musou'].some((key) => human.pressed[key]);
      if (Math.hypot(human.mx, human.my) > 0.15 || action) { takeOver(); return human; }
      const output = controller.sample(game, performance.now() < expires ? tactic : null);
      output.orbit = human.orbit; output.tilt = human.tilt;
      output.pressed.pause = human.pressed.pause; output.pressed.target = human.pressed.target;
      return output;
    },
  };
}
