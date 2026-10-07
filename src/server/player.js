import { randomUUID } from 'node:crypto';
import { parseObservation, parseTactic } from '../ai/protocol.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function playerConfigured(env = process.env) {
  return Boolean(UUID.test(env.PLAYER_AGENT_ID || '') && env.PLAYER_API_KEY && UUID.test(env.PLAYER_ROOM_ID || ''));
}

// One local spectator session; expired tabs relinquish ownership and late model decisions are ignored.
export function createPlayerService({ env = process.env, now = Date.now, runtimeFactory = async () => {
  const { createPlayerRuntime } = await import('./player-runtime.js');
  return createPlayerRuntime(env);
} } = {}) {
  let session = null, runtime = null, connecting = null, deciding = false;
  const expire = () => { if (session && now() - session.seen > 30000) session = null; };
  const requireSession = (id) => {
    expire();
    if (!session || session.id !== id) throw Object.assign(Error('Session ended'), { status: 404 });
    return session;
  };
  return {
    status: () => ({ configured: playerConfigured(env) }),
    async start() {
      if (!playerConfigured(env)) throw Object.assign(Error('BAND player is not configured'), { status: 503 });
      expire();
      if (session) throw Object.assign(Error('Another tab is watching the AI. Take over there first.'), { status: 409 });
      const s = session = { id: randomUUID(), seen: now(), lastDecision: -Infinity, busy: false, sequence: 0, plan: null, state: 'waiting' };
      try {
        if (!runtime) { connecting ||= runtimeFactory().finally(() => { connecting = null; }); runtime = await connecting; }
        if (session !== s) throw Error('Session ended');
        s.seen = now();
        return { id: s.id, agent: 'BAND Player' };
      } catch { if (session === s) session = null; throw Object.assign(Error('Could not connect the BAND player'), { status: 502 }); }
    },
    observe(id, raw) {
      const o = parseObservation(raw), s = requireSession(id);
      if (s.observation && o.frame < s.observation.frame) throw Object.assign(Error('Stale observation'), { status: 409 });
      s.observation = o; s.seen = now();
      if (!deciding && !s.busy && now() - s.lastDecision >= 8000) {
        deciding = true; s.busy = true; s.state = 'thinking'; s.lastDecision = now(); const sequence = ++s.sequence;
        Promise.resolve().then(() => runtime.decide({ id: randomUUID(), observation: o })).then((rawPlan) => {
          const plan = parseTactic(rawPlan);
          expire();
          if (session === s && s.sequence === sequence) { s.plan = plan; s.planAt = now(); s.state = 'playing'; }
        }).catch(() => { if (session === s) { s.plan = null; s.state = 'error'; } }).finally(() => { s.busy = false; deciding = false; });
      }
      const remaining = s.plan ? Math.max(0, 20000 - (now() - s.planAt)) : 0;
      return { state: s.state, tactic: remaining ? s.plan : null, validForMs: remaining, sequence: s.sequence };
    },
    stop(id) { requireSession(id); session = null; return { stopped: true }; },
    async close() { session = null; if (runtime) await runtime.close(); },
  };
}
