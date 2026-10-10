import { randomUUID } from 'node:crypto';
import { parseObservation, parseTactic } from '../ai/protocol.js';
import { AI_TIMING } from '../ai/timing.js';
import { bandAgentConfigured, positiveInteger } from './config.js';
import { DecisionBudget } from './decision-budget.js';
import { DecisionQueue } from './decision-queue.js';
import { HttpError } from './http.js';
import { RuntimePool } from './runtime-pool.js';
import { SessionStore } from './session-store.js';

export function playerConfigured(env = process.env) {
  return bandAgentConfigured(env, 'PLAYER') && (env.NODE_ENV !== 'production' || Boolean(env.OPENAI_API_KEY));
}

export class PlayerService {
  #env;
  constructor({ env = process.env, now = Date.now, budget, runtimeFactory } = {}) {
    this.#env = env;
    this.now = now;
    this.closed = false;
    this.maxSessions = positiveInteger(env.AI_MAX_SESSIONS, env.NODE_ENV === 'production' ? 3 : 1, 20);
    this.budget =
      budget || new DecisionBudget(positiveInteger(env.AI_MAX_DECISIONS_PER_HOUR, 120, 10_000), now);
    this.sessions = new SessionStore({
      now,
      maxSessions: this.maxSessions,
      busyMessage: 'The AI is serving other visitors. Try again shortly.',
    });
    this.runtimes = new RuntimePool(
      runtimeFactory ||
        (async () => {
          const { createPlayerRuntime } = await import('./player-runtime.js');
          return createPlayerRuntime(env);
        }),
    );
    this.queue = new DecisionQueue(() => this.#pump());
  }

  status() {
    return { configured: playerConfigured(this.#env) };
  }

  async start() {
    if (!playerConfigured(this.#env)) throw new HttpError(503, 'BAND player is not configured');
    const session = this.sessions.create({
      lastDecision: -Infinity,
      sequence: 0,
      plan: null,
      state: 'waiting',
    });
    try {
      await this.runtimes.get('player');
      if (!this.sessions.owns(session) || this.closed) throw Error('Session ended');
      session.seen = this.now();
      return { id: session.id, agent: 'BAND Player' };
    } catch {
      this.sessions.delete(session);
      throw new HttpError(502, 'Could not connect the BAND player');
    }
  }

  observe(id, raw) {
    const observation = parseObservation(raw);
    const session = this.sessions.get(id);
    if (session.observation && observation.frame < session.observation.frame)
      throw new HttpError(409, 'Stale observation');
    session.observation = observation;
    session.seen = this.now();
    this.#pump();
    const remaining = session.plan ? Math.max(0, AI_TIMING.tacticTtlMs - (this.now() - session.planAt)) : 0;
    if (!this.budget.has() && session.state !== 'thinking' && !remaining) {
      session.plan = null;
      session.state = 'limited';
    }
    const queued = this.maxSessions > 1 && !remaining && session.state === 'waiting' && this.queue.busy;
    return {
      state: queued ? 'queued' : session.state,
      tactic: remaining ? session.plan : null,
      validForMs: remaining,
      sequence: session.sequence,
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

  #pump() {
    const runtime = this.runtimes.ready('player');
    if (this.closed || this.queue.busy || !runtime || !this.budget.has()) return;
    const session = [...this.sessions.values()]
      .filter(
        (s) =>
          s.observation &&
          this.now() - s.seen < AI_TIMING.playerObservationFreshMs &&
          this.now() - s.lastDecision >= AI_TIMING.decisionIntervalMs,
      )
      .sort((a, b) => a.lastDecision - b.lastDecision)[0];
    if (!session || !this.budget.take()) return;
    session.state = 'thinking';
    session.lastDecision = this.now();
    const sequence = ++session.sequence;
    const observation = session.observation;
    this.queue.run(() => runtime.decide({ id: randomUUID(), observation }), {
      onSuccess: (raw) => {
        const plan = parseTactic(raw);
        if (this.sessions.owns(session) && session.sequence === sequence) {
          session.plan = plan;
          session.planAt = this.now();
          session.state = 'playing';
        }
      },
      onError: () => {
        if (this.sessions.owns(session)) {
          session.plan = null;
          session.state = 'error';
        }
      },
    });
  }
}

export function createPlayerService(options) {
  return new PlayerService(options);
}
