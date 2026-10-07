import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIGHTERS = new Set(['arick', 'saruabh', 'vlad', 'connector']);
const FIGHTER_NAMES = { arick: 'Arick', saruabh: 'Saruabh', vlad: 'Vlad', connector: 'Connector' };
const DIFFICULTIES = new Set(['easy', 'normal', 'hard', 'extreme']);
const RANKS = new Set(['S', 'A', 'B', 'C']);
const API = 'https://app.band.ai/api/v1/agent';

export function bandConfigured(env = process.env) {
  return Boolean(env.BAND_REPORTER_API_KEY && UUID.test(env.BAND_ROOM_ID || '') && UUID.test(env.ANALYST_AGENT_ID || ''));
}

function integer(value, max) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}

export function parseRun(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid run');
  const { win, char, chapter, diff, stats } = input;
  if (typeof win !== 'boolean' || !FIGHTERS.has(char) || !DIFFICULTIES.has(diff) ||
      typeof chapter !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(chapter) ||
      !stats || typeof stats !== 'object' || Array.isArray(stats)) throw new Error('Invalid run');
  const { kos, time, hpMax, maxChain, dmg, rank } = stats;
  if (!integer(kos, 100000) || !integer(time, 86400) || !integer(maxChain, 100000) ||
      !Number.isFinite(hpMax) || hpMax <= 0 || hpMax > 100000 ||
      !Number.isFinite(dmg) || dmg < 0 || dmg > 1000000 ||
      (rank != null && !RANKS.has(rank))) throw new Error('Invalid run');
  return { win, char, chapter, diff, stats: { kos, time, hpMax, maxChain, dmg: Math.round(dmg), ...(rank ? { rank } : {}) } };
}

export async function sendRunToBand(run, { env = process.env, fetchImpl = fetch } = {}) {
  if (!bandConfigured(env)) throw new Error('Band is not configured');
  const room = encodeURIComponent(env.BAND_ROOM_ID);
  const headers = { 'X-API-Key': env.BAND_REPORTER_API_KEY, accept: 'application/json' };
  const participantsResponse = await fetchImpl(`${API}/chats/${room}/participants`, {
    headers, signal: AbortSignal.timeout(10000),
  });
  if (!participantsResponse.ok) throw new Error(`Band participant lookup failed (${participantsResponse.status})`);
  const { data } = await participantsResponse.json();
  const analyst = Array.isArray(data) && data.find((p) => p.id === env.ANALYST_AGENT_ID);
  if (!analyst || !analyst.handle || !analyst.name) throw new Error('Analyst is not a room participant');

  const runId = randomUUID();
  const publicRun = { ...run, char: FIGHTER_NAMES[run.char] };
  const content = `@${analyst.handle} Analyze this Band Kungfu game run. Give one specific, useful change for the next attempt. Use only these facts; do not invent gameplay events. Run ID: ${runId}\n${JSON.stringify(publicRun)}`;
  const sent = await fetchImpl(`${API}/chats/${room}/messages`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { content, mentions: [{ id: analyst.id, name: analyst.name, handle: analyst.handle }] } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!sent.ok) throw new Error(`Band message failed (${sent.status})`);
  return { runId };
}
