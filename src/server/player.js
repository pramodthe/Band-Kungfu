import { randomUUID } from 'node:crypto';
import { parseObservation, parseTactic } from '../ai/protocol.js';
import { createDecisionBudget } from './decision-budget.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function playerConfigured(env = process.env) {
  return Boolean(
    UUID.test(env.PLAYER_AGENT_ID || '') &&
    env.PLAYER_API_KEY &&
    UUID.test(env.PLAYER_ROOM_ID || '') &&
    (env.NODE_ENV !== 'production' || env.OPENAI_API_KEY),
  );
}

const setting = (value, fallback, max) =>
  value !== undefined && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= max
    ? Number(value)
    : fallback;

// Independent visitors share one fair, bounded model queue. Inactive tabs do not consume turns.
export function createPlayerService({
  env = process.env,
  now = Date.now,
  budget,
  runtimeFactory = async () => {
    const { createPlayerRuntime } = await import('./player-runtime.js');
    return createPlayerRuntime(env);
  },
} = {}) {
  const sessions = new Map();
  const maxSessions = setting(env.AI_MAX_SESSIONS, env.NODE_ENV === 'production' ? 3 : 1, 20);
  const maxDecisions = setting(env.AI_MAX_DECISIONS_PER_HOUR, 120, 10000);
  budget ||= createDecisionBudget(maxDecisions, now);
  let runtime = null,
    connecting = null,
    deciding = false,
    closed = false;
  const expire = () => {
    for (const [id, s] of sessions) if (now() - s.seen > 30000) sessions.delete(id);
  };
  const allowance = () => budget.has();
  const requireSession = (id) => {
    expire();
    const s = sessions.get(id);
    if (!s) throw Object.assign(Error('Session ended'), { status: 404 });
    return s;
  };
  function pump() {
    expire();
    if (closed || deciding || !runtime || !allowance()) return;
    const s = [...sessions.values()]
      .filter((s) => s.observation && now() - s.seen < 3500 && now() - s.lastDecision >= 8000)
      .sort((a, b) => a.lastDecision - b.lastDecision)[0];
    if (!s) return;
    if (!budget.take()) return;
    deciding = true;
    s.state = 'thinking';
    s.lastDecision = now();
    const sequence = ++s.sequence,
      o = s.observation;
    Promise.resolve()
      .then(() => runtime.decide({ id: randomUUID(), observation: o }))
      .then((rawPlan) => {
        const plan = parseTactic(rawPlan);
        expire();
        if (sessions.get(s.id) === s && s.sequence === sequence) {
          s.plan = plan;
          s.planAt = now();
          s.state = 'playing';
        }
      })
      .catch(() => {
        if (sessions.get(s.id) === s) {
          s.plan = null;
          s.state = 'error';
        }
      })
      .finally(() => {
        deciding = false;
        pump();
      });
  }
  return {
    status: () => ({ configured: playerConfigured(env) }),
    async start() {
      if (!playerConfigured(env))
        throw Object.assign(Error('BAND player is not configured'), { status: 503 });
      expire();
      if (closed) throw Object.assign(Error('Server is shutting down'), { status: 503 });
      if (sessions.size >= maxSessions)
        throw Object.assign(Error('The AI is serving other visitors. Try again shortly.'), { status: 409 });
      const s = {
        id: randomUUID(),
        seen: now(),
        lastDecision: -Infinity,
        sequence: 0,
        plan: null,
        state: 'waiting',
      };
      sessions.set(s.id, s);
      try {
        if (!runtime) {
          connecting ||= runtimeFactory().finally(() => {
            connecting = null;
          });
          runtime = await connecting;
        }
        if (sessions.get(s.id) !== s || closed) throw Error('Session ended');
        s.seen = now();
        return { id: s.id, agent: 'BAND Player' };
      } catch {
        sessions.delete(s.id);
        throw Object.assign(Error('Could not connect the BAND player'), { status: 502 });
      }
    },
    observe(id, raw) {
      const o = parseObservation(raw),
        s = requireSession(id);
      if (s.observation && o.frame < s.observation.frame)
        throw Object.assign(Error('Stale observation'), { status: 409 });
      s.observation = o;
      s.seen = now();
      pump();
      const remaining = s.plan ? Math.max(0, 20000 - (now() - s.planAt)) : 0;
      if (!allowance() && s.state !== 'thinking' && !remaining) {
        s.plan = null;
        s.state = 'limited';
      }
      const state = maxSessions > 1 && !remaining && s.state === 'waiting' && deciding ? 'queued' : s.state;
      return { state, tactic: remaining ? s.plan : null, validForMs: remaining, sequence: s.sequence };
    },
    stop(id) {
      requireSession(id);
      sessions.delete(id);
      return { stopped: true };
    },
    async close() {
      closed = true;
      sessions.clear();
      if (runtime) await runtime.close();
    },
  };
}
