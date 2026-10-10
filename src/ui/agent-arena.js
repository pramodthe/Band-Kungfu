import { on } from '../core/events.js';
import { arenaObservation, executeArenaTactic } from '../ai/arena-controller.js';
import { parseArenaTactic } from '../ai/arena-protocol.js';

export function createAgentArena(game) {
  const dialog = document.createElement('dialog');
  dialog.id = 'agent-setup';
  dialog.setAttribute('aria-labelledby', 'agent-setup-title');
  dialog.innerHTML = `<form><h2 id="agent-setup-title">Agent Arena</h2><p>You fight. BAND agents choose their own tactics.</p>
    <fieldset><legend>Who joins you?</legend>
      <label><input name="ally" type="checkbox" checked> Wingmate · your AI teammate</label>
      <label><input name="boss" type="checkbox" checked> Nemesis · the AI villain</label></fieldset>
    <label>Model access<select name="source"><option value="hosted">Shared game model</option><option value="byok">Bring my own key</option></select></label>
    <fieldset class="own-model" hidden><legend>Your model</legend>
      <label>Provider<select name="provider"><option value="openai">OpenAI</option><option value="groq">Groq</option></select></label>
      <label>Model ID<input name="model" value="gpt-6-luna" maxlength="96" autocomplete="off" spellcheck="false" list="arena-models"></label>
      <datalist id="arena-models"><option value="gpt-6-luna"></option></datalist>
      <label>API key<input name="apiKey" type="password" maxlength="512" autocomplete="off" spellcheck="false"></label>
      <small>Your key goes to this game server and your selected provider over HTTPS. It is held in memory until you leave or the session expires. Provider billing applies.</small></fieldset>
    <p class="privacy">Small combat snapshots and tactic summaries are visible to the game host in private BAND rooms. Practice arena: your fighter cannot be knocked out.</p>
    <p class="setup-state" role="status"></p><div class="setup-actions"><button type="button" class="cancel">Back</button><button type="submit">Join arena</button></div></form>`;
  const panel = document.createElement('section');
  panel.id = 'agent-arena';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Agent Arena tactics');
  panel.innerHTML = `<div class="arena-head"><b>Agent Arena</b><span class="arena-model"></span><button type="button">Dismiss agents</button></div>
    <div class="arena-agents">${['ally', 'boss'].map((role) => `<article data-role="${role}"><b>${role === 'ally' ? 'Wingmate · teammate' : 'Nemesis · villain'}</b><span class="agent-hp"></span><p class="agent-state"></p><small class="agent-reason"></small></article>`).join('')}</div>`;
  document.body.append(dialog, panel);
  const form = dialog.querySelector('form'),
    field = (name) => form.elements.namedItem(name);
  let enabled = false,
    battle = false,
    paused = false,
    generation = 0,
    session = null,
    timer,
    settings = null,
    resolveSetup;
  let roles = [],
    slots = { ally: -1, boss: -1 },
    plans = {},
    expires = {},
    states = {},
    reasons = {},
    modelLabel = '';
  const setupState = dialog.querySelector('.setup-state');
  const request = async (action, body, keepalive = false) => {
    const response = await fetch(`/api/arena/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: keepalive ? undefined : AbortSignal.timeout(35000),
      keepalive,
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(Error(data.error || 'Arena is unavailable'), { status: response.status });
    return data;
  };
  const updateFields = () => {
    const own = field('source').value === 'byok';
    dialog.querySelector('.own-model').hidden = !own;
    for (const name of ['provider', 'model', 'apiKey']) {
      field(name).disabled = !own;
      field(name).required = own;
    }
  };
  field('source').addEventListener('change', updateFields);
  field('provider').addEventListener('change', () => {
    const model = field('provider').value === 'groq' ? 'openai/gpt-oss-20b' : 'gpt-6-luna';
    field('model').value = model;
    const option = document.createElement('option');
    option.value = model;
    dialog.querySelector('datalist').replaceChildren(option);
  });
  // Typing a model/key must not activate the underlying character-select keyboard navigation.
  dialog.addEventListener('keydown', (e) => e.stopPropagation());
  const finishSetup = (value) => {
    field('apiKey').value = '';
    dialog.close();
    const done = resolveSetup;
    resolveSetup = null;
    done?.(value);
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    finishSetup(false);
  });
  dialog.querySelector('.cancel').onclick = () => finishSetup(false);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    roles = ['ally', 'boss'].filter((role) => field(role).checked);
    if (!roles.length) {
      setupState.textContent = 'Choose a teammate, villain, or both.';
      return;
    }
    const own = field('source').value === 'byok';
    if (
      own &&
      location.protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ) {
      setupState.textContent = 'Use an HTTPS game address before entering your key.';
      return;
    }
    settings = {
      roles,
      model: own
        ? {
            source: 'byok',
            provider: field('provider').value,
            model: field('model').value.trim(),
            apiKey: field('apiKey').value.trim(),
          }
        : { source: 'hosted' },
    };
    finishSetup(true);
  });
  async function stop() {
    generation++;
    clearTimeout(timer);
    plans = {};
    expires = {};
    settings = null;
    const id = session;
    session = null;
    if (id) await request('stop', { id }, true).catch(() => {});
  }
  function draw() {
    panel.hidden = !enabled || !battle;
    panel.querySelector('.arena-model').textContent = modelLabel;
    for (const role of ['ally', 'boss']) {
      const article = panel.querySelector(`[data-role="${role}"]`),
        i = slots[role];
      article.hidden = !roles.includes(role);
      if (i < 0) continue;
      const hp = Math.max(0, Math.ceil(game.crowd.hp[i]));
      article.querySelector('.agent-hp').textContent = `${hp} HP`;
      article.querySelector('.agent-state').textContent =
        hp <= 0
          ? role === 'boss'
            ? 'Nemesis defeated'
            : 'Wingmate knocked out'
          : paused
            ? 'Paused'
            : states[role] || 'Connecting to BAND…';
      article.querySelector('.agent-reason').textContent = reasons[role] || 'Waiting for a model decision.';
    }
  }
  const descriptions = {
    thinking: 'Choosing a tactic…',
    playing: 'Executing tactic',
    waiting: 'Waiting for a turn',
    paused: 'Paused',
    limited: 'Hourly AI allowance reached',
    error: 'Model failed. Dismiss and rejoin with model access.',
  };
  async function poll(token) {
    if (token !== generation || !session || !battle) return;
    try {
      const observation = Object.fromEntries(
        roles.map((role) => [role, arenaObservation(game, role, slots)]),
      );
      const result = await request('observe', { id: session, observation, active: !paused });
      if (token !== generation) return;
      for (const role of roles) {
        const r = result.agents[role];
        states[role] = descriptions[r.state] || 'Waiting for a turn';
        plans[role] = r.tactic ? parseArenaTactic(r.tactic) : null;
        expires[role] = performance.now() + Math.min(20000, Math.max(0, r.validForMs));
        if (plans[role]) reasons[role] = plans[role].reason;
      }
    } catch (error) {
      if (token !== generation) return;
      plans = {};
      for (const role of roles)
        states[role] =
          error.status === 404
            ? 'Session ended. Dismiss and rejoin.'
            : 'Connection interrupted · agents waiting';
      if (error.status === 404) {
        session = null;
        draw();
        return;
      }
    }
    draw();
    timer = setTimeout(() => poll(token), 1500);
  }
  async function start() {
    const token = ++generation,
      payload = settings;
    settings = null;
    if (!payload) {
      for (const role of roles) states[role] = 'Rejoin Agent Arena to start a new session.';
      draw();
      return;
    }
    try {
      const result = await request('session', payload);
      payload.model.apiKey = '';
      if (token !== generation || !battle) {
        await request('stop', { id: result.id }, true).catch(() => {});
        return;
      }
      session = result.id;
      modelLabel = `${result.provider} · ${result.model}`;
      poll(token);
    } catch (error) {
      payload.model.apiKey = '';
      if (token !== generation) return;
      for (const role of roles) states[role] = error.message;
      draw();
    }
  }
  panel.querySelector('button').onclick = () => {
    stop();
    enabled = false;
    document.body.classList.remove('ai-arena');
    for (const role of roles) {
      const i = slots[role];
      if (i < 0) continue;
      game.crowd.st[i] = 0;
      game.crowd.agentRole[i] = game.crowd.agentModel[i] = null;
      if (role === 'boss') game.crowd.offName[i - game.crowd.grunts] = null;
    }
    game.crowd.agentStep = null;
    draw();
  };
  addEventListener('pagehide', stop);
  on('flow', ({ state }) => {
    battle = state === 'battle';
    if (battle && enabled) start();
    else if (state !== 'loading') stop();
    draw();
  });
  return {
    async setup() {
      setupState.textContent = '';
      updateFields();
      dialog.showModal();
      fetch('/api/arena/status')
        .then((r) => r.json())
        .then((status) => {
          if (!dialog.open) return;
          setupState.textContent = ['ally', 'boss'].some((role) => !status.roles[role])
            ? 'Some agents are unavailable on this server.'
            : 'BAND agents ready';
          if (!status.hosted) {
            field('source').value = 'byok';
            updateFields();
          }
        })
        .catch(() => {
          setupState.textContent = 'Could not check agent availability.';
        });
      return new Promise((resolve) => {
        resolveSetup = resolve;
      });
    },
    reset(active) {
      document.body.classList.toggle('ai-arena', active);
      enabled = active;
      plans = {};
      expires = {};
      states = {};
      reasons = {};
      slots = { ally: -1, boss: -1 };
      modelLabel = '';
      if (!active) {
        stop();
        return;
      }
      for (const role of roles) slots[role] = game.crowd.spawnAgent(role);
      if (roles.some((role) => slots[role] < 0)) {
        for (const role of roles) states[role] = 'No free fighter slot';
        settings = null;
      }
      game.crowd.agentStep = (i, role) =>
        executeArenaTactic(game, i, role, performance.now() < expires[role] ? plans[role] : null, slots);
    },
    pause(value) {
      paused = value;
      draw();
    },
    update: draw,
  };
}
