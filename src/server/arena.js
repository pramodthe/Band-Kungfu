import { randomUUID } from 'node:crypto';
import { parseArenaObservation, parseArenaTactic, ARENA_ROLES } from '../ai/arena-protocol.js';
import { AI_TIMING } from '../ai/timing.js';
import { bandAgentConfigured, positiveInteger } from './config.js';
import { DecisionBudget } from './decision-budget.js';
import { DecisionQueue } from './decision-queue.js';
import { HttpError } from './http.js';
import { RuntimePool } from './runtime-pool.js';
import { SessionStore } from './session-store.js';

export function parseArenaSettings(raw, env) {
  if (
    !raw ||
    !Array.isArray(raw.roles) ||
    !raw.roles.length ||
    raw.roles.length > 2 ||
    new Set(raw.roles).size !== raw.roles.length ||
    raw.roles.some((role) => !ARENA_ROLES.includes(role))
  ) {
    throw new HttpError(400, 'Choose a teammate, boss, or both');
  }
  let credentials;
  if (raw.model?.source === 'byok') {
    const model = raw.model;
    if (
      !['openai', 'groq'].includes(model.provider) ||
      typeof model.model !== 'string' ||
      !/^[a-zA-Z0-9][\w./:-]{0,95}$/.test(model.model) ||
      typeof model.apiKey !== 'string' ||
      !/^[\x21-\x7e]{10,512}$/.test(model.apiKey)
    ) {
      throw new HttpError(400, 'Enter a provider, model ID, and API key');
    }
    credentials = { provider: model.provider, model: model.model, apiKey: model.apiKey };
  } else if (raw.model?.source === 'hosted') {
    if (!env.OPENAI_API_KEY)
      throw new HttpError(503, 'Shared model is unavailable. Choose your own API key.');
    credentials = { provider: 'openai', model: env.BAND_MODEL || 'gpt-6-luna', apiKey: env.OPENAI_API_KEY };
  } else {
    throw new HttpError(400, 'Choose a model source');
  }
  return { roles: [...raw.roles], credentials, byok: raw.model.source === 'byok' };
}

export class ArenaService {
  #env;
  constructor({ env = process.env, now = Date.now, budget, runtimeFactory } = {}) {
    this.#env = env;
    this.now = now;
    this.closed = false;
    this.order = 0;
    this.budget =
      budget || new DecisionBudget(positiveInteger(env.AI_MAX_DECISIONS_PER_HOUR, 120, 10_000), now);
    this.sessions = new SessionStore({
      now,
      maxSessions: positiveInteger(env.AI_MAX_SESSIONS, 3, 20),
      endedMessage: 'Arena session ended',
      busyMessage: 'Agent Arena is busy. Try again shortly.',
    });
    this.runtimes = new RuntimePool(
      runtimeFactory ||
        (async (role) => {
          const { createArenaRuntime } = await import('./arena-runtime.js');
          return createArenaRuntime(env, role);
        }),
    );
    this.queue = new DecisionQueue(() => this.#pump());
  }

  status() {
    return {
      roles: Object.fromEntries(
        ARENA_ROLES.map((role) => [role, bandAgentConfigured(this.#env, role.toUpperCase())]),
      ),
      hosted: Boolean(this.#env.OPENAI_API_KEY),
    };
  }

  async start(raw) {
    const settings = parseArenaSettings(raw, this.#env);
    if (settings.roles.some((role) => !bandAgentConfigured(this.#env, role.toUpperCase()))) {
      throw new HttpError(503, 'Arena agents are not configured on this server');
    }
    const session = this.sessions.create({
      ...settings,
      ready: false,
      active: true,
      budget: new DecisionBudget(120, this.now),
      agents: Object.fromEntries(
        settings.roles.map((role) => [
          role,
          { lastDecision: -Infinity, lastOrder: 0, state: 'waiting', plan: null },
        ]),
      ),
    });
    try {
      for (const role of session.roles) await this.runtimes.get(role);
      if (!this.sessions.owns(session) || this.closed) throw Error('Session ended');
      session.ready = true;
      session.seen = this.now();
      return {
        id: session.id,
        roles: session.roles,
        model: session.credentials.model,
        provider: session.credentials.provider,
      };
    } catch {
      this.sessions.delete(session);
      throw new HttpError(502, 'Could not connect arena agents');
    }
  }

  observe(id, raw, active = true) {
    const session = this.sessions.get(id);
    if (typeof active !== 'boolean' || !raw || typeof raw !== 'object')
      throw new HttpError(400, 'Invalid arena request');
    const observations = session.roles.map((role) => [role, parseArenaObservation(raw[role], role)]);
    for (const [role, observation] of observations) {
      const previous = session.agents[role].observation;
      if (previous && observation.frame < previous.frame) throw new HttpError(409, 'Stale observation');
    }
    session.seen = this.now();
    session.active = active;
    if (!active) session.abort?.abort();
    for (const [role, observation] of observations) session.agents[role].observation = observation;
    this.#pump();
    return {
      agents: Object.fromEntries(session.roles.map((role) => [role, this.#agentStatus(session, role)])),
    };
  }

  stop(id) {
    this.sessions.delete(this.sessions.get(id));
    return { stopped: true };
  }

  async close() {
    this.closed = true;
    this.queue.close();
    this.sessions.close();
    await this.runtimes.close();
  }

  #budgetFor(session) {
    return session.byok ? session.budget : this.budget;
  }

  #agentStatus(session, role) {
    const agent = session.agents[role];
    const remaining = agent.plan ? Math.max(0, AI_TIMING.tacticTtlMs - (this.now() - agent.planAt)) : 0;
    let state = agent.state;
    if (!session.active) state = 'paused';
    else if (!this.#budgetFor(session).has() && !remaining && state !== 'thinking') state = 'limited';
    return { state, tactic: remaining ? agent.plan : null, validForMs: remaining };
  }

  #pump() {
    if (this.closed || this.queue.busy) return;
    const choices = [];
    for (const session of this.sessions.values()) {
      if (
        !session.ready ||
        !session.active ||
        this.now() - session.seen >= AI_TIMING.arenaObservationFreshMs ||
        !this.#budgetFor(session).has()
      )
        continue;
      for (const role of session.roles) {
        const agent = session.agents[role];
        if (
          agent.state !== 'error' &&
          agent.observation?.self.hp > 0 &&
          this.now() - agent.lastDecision >= AI_TIMING.decisionIntervalMs
        )
          choices.push({ session, role, agent });
      }
    }
    choices.sort((a, b) => a.agent.lastOrder - b.agent.lastOrder);
    const next = choices[0];
    if (!next || !this.#budgetFor(next.session).take()) return;
    const { session, role, agent } = next;
    agent.lastDecision = this.now();
    agent.lastOrder = ++this.order;
    agent.state = 'thinking';
    session.abort = new AbortController();
    const job = {
      id: randomUUID(),
      observation: agent.observation,
      credentials: session.credentials,
      signal: session.abort.signal,
    };
    this.queue.run(() => this.runtimes.ready(role).decide(job), {
      onSuccess: (raw) => {
        const plan = parseArenaTactic(raw);
        if (plan.targetId !== null && !job.observation.targets.some((target) => target.id === plan.targetId))
          throw Error('Unavailable target');
        if (this.sessions.owns(session) && session.active && !job.signal.aborted) {
          agent.plan = plan;
          agent.planAt = this.now();
          agent.state = 'playing';
        }
      },
      onError: () => {
        if (this.sessions.owns(session)) {
          agent.plan = null;
          agent.state = 'error';
        }
      },
      onSettled: () => {
        if (this.sessions.owns(session) && job.signal.aborted) {
          agent.state = 'waiting';
          agent.plan = null;
          agent.lastDecision = -Infinity;
        }
        job.credentials = null;
      },
    });
  }
}

export function createArenaService(options) {
  return new ArenaService(options);
}
