import { randomUUID } from 'node:crypto';
import { parseArenaObservation, parseArenaTactic, ARENA_ROLES } from '../ai/arena-protocol.js';
import { createDecisionBudget } from './decision-budget.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const positive = (n, fallback, max) =>
  Number.isInteger(Number(n)) && Number(n) > 0 && Number(n) <= max ? Number(n) : fallback;
const configured = (env, role) => {
  const p = role.toUpperCase();
  return Boolean(
    UUID.test(env[`${p}_AGENT_ID`] || '') && UUID.test(env[`${p}_ROOM_ID`] || '') && env[`${p}_API_KEY`],
  );
};

export function parseArenaSettings(raw, env) {
  if (
    !raw ||
    !Array.isArray(raw.roles) ||
    !raw.roles.length ||
    raw.roles.length > 2 ||
    new Set(raw.roles).size !== raw.roles.length ||
    raw.roles.some((r) => !ARENA_ROLES.includes(r))
  )
    throw Error('Choose a teammate, boss, or both');
  let credentials;
  if (raw.model?.source === 'byok') {
    const m = raw.model;
    if (
      !['openai', 'groq'].includes(m.provider) ||
      typeof m.model !== 'string' ||
      !/^[a-zA-Z0-9][\w./:-]{0,95}$/.test(m.model) ||
      typeof m.apiKey !== 'string' ||
      !/^[\x21-\x7e]{10,512}$/.test(m.apiKey)
    )
      throw Error('Enter a provider, model ID, and API key');
    credentials = { provider: m.provider, model: m.model, apiKey: m.apiKey };
  } else if (raw.model?.source === 'hosted') {
    if (!env.OPENAI_API_KEY)
      throw Object.assign(Error('Shared model is unavailable. Choose your own API key.'), { status: 503 });
    credentials = { provider: 'openai', model: env.BAND_MODEL || 'gpt-6-luna', apiKey: env.OPENAI_API_KEY };
  } else throw Error('Choose a model source');
  return { roles: [...raw.roles], credentials, byok: raw.model.source === 'byok' };
}

export function createArenaService({
  env = process.env,
  now = Date.now,
  budget = createDecisionBudget(positive(env.AI_MAX_DECISIONS_PER_HOUR, 120, 10000), now),
  runtimeFactory = async (role) => (await import('./arena-runtime.js')).createArenaRuntime(env, role),
} = {}) {
  const sessions = new Map(),
    runtimes = new Map(),
    connecting = new Map();
  const maxSessions = positive(env.AI_MAX_SESSIONS, 3, 20);
  let deciding = false,
    closed = false,
    order = 0;
  const end = (s) => {
    s.abort?.abort();
    s.credentials = null;
    sessions.delete(s.id);
  };
  const expire = () => {
    for (const s of sessions.values()) if (now() - s.seen > 30000) end(s);
  };
  const reaper = setInterval(expire, 5000);
  reaper.unref();
  const requireSession = (id) => {
    expire();
    const s = sessions.get(id);
    if (!s) throw Object.assign(Error('Arena session ended'), { status: 404 });
    return s;
  };
  const allowed = (s) => (s.byok ? s.budget : budget).has();
  function pump() {
    expire();
    if (closed || deciding) return;
    const choices = [];
    for (const s of sessions.values())
      if (s.ready && s.active && now() - s.seen < 4500 && allowed(s))
        for (const role of s.roles) {
          const r = s.agents[role];
          if (r.state !== 'error' && r.observation?.self.hp > 0 && now() - r.lastDecision >= 8000)
            choices.push({ s, role, r });
        }
    choices.sort((a, b) => a.r.lastOrder - b.r.lastOrder);
    const next = choices[0];
    if (!next) return;
    const { s, role, r } = next;
    if (!(s.byok ? s.budget : budget).take()) return;
    deciding = true;
    r.lastDecision = now();
    r.lastOrder = ++order;
    r.state = 'thinking';
    s.abort = new AbortController();
    const job = {
      id: randomUUID(),
      observation: r.observation,
      credentials: s.credentials,
      signal: s.abort.signal,
    };
    Promise.resolve()
      .then(() => runtimes.get(role).decide(job))
      .then((raw) => {
        const plan = parseArenaTactic(raw);
        if (plan.targetId !== null && !job.observation.targets.some((t) => t.id === plan.targetId))
          throw Error('Unavailable target');
        expire();
        if (sessions.get(s.id) === s && s.active && !job.signal.aborted) {
          r.plan = plan;
          r.planAt = now();
          r.state = 'playing';
        }
      })
      .catch(() => {
        if (sessions.get(s.id) === s) {
          r.plan = null;
          r.state = 'error';
        }
      })
      .finally(() => {
        if (sessions.get(s.id) === s && job.signal.aborted) {
          r.state = 'waiting';
          r.plan = null;
          r.lastDecision = -Infinity;
        }
        job.credentials = null;
        deciding = false;
        pump();
      });
  }
  return {
    status: () => ({
      roles: Object.fromEntries(ARENA_ROLES.map((r) => [r, configured(env, r)])),
      hosted: Boolean(env.OPENAI_API_KEY),
    }),
    async start(raw) {
      const settings = parseArenaSettings(raw, env);
      expire();
      if (closed || settings.roles.some((r) => !configured(env, r)))
        throw Object.assign(Error('Arena agents are not configured on this server'), { status: 503 });
      if (sessions.size >= maxSessions)
        throw Object.assign(Error('Agent Arena is busy. Try again shortly.'), { status: 409 });
      const s = {
        id: randomUUID(),
        ...settings,
        seen: now(),
        ready: false,
        active: true,
        budget: createDecisionBudget(120, now),
        agents: Object.fromEntries(
          settings.roles.map((r) => [
            r,
            { lastDecision: -Infinity, lastOrder: 0, state: 'waiting', plan: null },
          ]),
        ),
      };
      sessions.set(s.id, s);
      try {
        for (const role of s.roles)
          if (!runtimes.has(role)) {
            if (!connecting.has(role))
              connecting.set(
                role,
                Promise.resolve()
                  .then(() => runtimeFactory(role))
                  .finally(() => connecting.delete(role)),
              );
            const runtime = await connecting.get(role);
            runtimes.set(role, runtime);
          }
        if (sessions.get(s.id) !== s || closed) throw Error('Session ended');
        s.ready = true;
        s.seen = now();
        return { id: s.id, roles: s.roles, model: s.credentials.model, provider: s.credentials.provider };
      } catch {
        end(s);
        throw Object.assign(Error('Could not connect arena agents'), { status: 502 });
      }
    },
    observe(id, raw, active = true) {
      const s = requireSession(id);
      if (typeof active !== 'boolean' || !raw || typeof raw !== 'object')
        throw Error('Invalid arena request');
      const observations = s.roles.map((role) => [role, parseArenaObservation(raw[role], role)]);
      for (const [role, o] of observations)
        if (s.agents[role].observation && o.frame < s.agents[role].observation.frame)
          throw Object.assign(Error('Stale observation'), { status: 409 });
      s.seen = now();
      s.active = active;
      if (!active) s.abort?.abort();
      for (const [role, o] of observations) s.agents[role].observation = o;
      pump();
      return {
        agents: Object.fromEntries(
          s.roles.map((role) => {
            const r = s.agents[role],
              remaining = r.plan ? Math.max(0, 20000 - (now() - r.planAt)) : 0;
            return [
              role,
              {
                state: !active
                  ? 'paused'
                  : !allowed(s) && !remaining && r.state !== 'thinking'
                    ? 'limited'
                    : r.state,
                tactic: remaining ? r.plan : null,
                validForMs: remaining,
              },
            ];
          }),
        ),
      };
    },
    stop(id) {
      end(requireSession(id));
      return { stopped: true };
    },
    async close() {
      closed = true;
      clearInterval(reaper);
      for (const s of sessions.values()) end(s);
      await Promise.allSettled([...connecting.values()]);
      await Promise.allSettled([...runtimes.values()].map((r) => r.close()));
    },
  };
}
