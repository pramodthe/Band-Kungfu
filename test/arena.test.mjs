import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaService, parseArenaSettings } from '../src/server/arena.js';
import { chooseArenaTactic, handleArenaJob, PROVIDERS } from '../src/server/arena-runtime.js';
import { parseArenaObservation } from '../src/ai/arena-protocol.js';
import { arenaObservation, executeArenaTactic } from '../src/ai/arena-controller.js';
import { createCrowd, ST, CROWD } from '../src/crowd/crowd.js';
import { createDecisionBudget } from '../src/server/decision-budget.js';

const env = {
  OPENAI_API_KEY: 'host-private-key',
  BAND_MODEL: 'gpt-6-luna',
  AI_MAX_SESSIONS: '3',
  ALLY_AGENT_ID: '11111111-1111-4111-8111-111111111111',
  ALLY_ROOM_ID: '22222222-2222-4222-8222-222222222222',
  ALLY_API_KEY: 'band-ally',
  BOSS_AGENT_ID: '33333333-3333-4333-8333-333333333333',
  BOSS_ROOM_ID: '44444444-4444-4444-8444-444444444444',
  BOSS_API_KEY: 'band-boss',
};
const settings = { roles: ['ally', 'boss'], model: { source: 'hosted' } };
const own = {
  roles: ['ally'],
  model: { source: 'byok', provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: 'visitor-private-key' },
};
const plan = { goal: 'engage', targetId: null, reason: 'Close on the opponent.' };
const body = { x: 0, z: 0, hp: 1 };
const facts = (role) => ({
  role,
  frame: 0,
  self: body,
  player: body,
  teammate: null,
  targets: [
    {
      ...body,
      x: 2,
      id: role === 'boss' ? -1 : 1,
      kind: role === 'boss' ? 'player' : 'challenger',
      attacking: false,
    },
  ],
});
const observation = { ally: facts('ally'), boss: facts('boss') };
const flush = () => new Promise((r) => setImmediate(r));

test('BYOK has a fixed provider destination, requires its own key and never falls back to host credentials', () => {
  const s = parseArenaSettings(own, env);
  assert.equal(s.credentials.apiKey, 'visitor-private-key');
  assert.equal(s.credentials.provider, 'groq');
  assert.equal(parseArenaSettings(settings, env).credentials.apiKey, env.OPENAI_API_KEY);
  assert.throws(() => parseArenaSettings({ ...own, model: { ...own.model, apiKey: '' } }, env));
  assert.throws(() =>
    parseArenaSettings({ ...own, model: { ...own.model, provider: 'http://internal/' } }, env),
  );
  assert.throws(() => parseArenaSettings({ ...own, roles: ['ally', 'ally'] }, env));
  assert.throws(
    () => parseArenaSettings(settings, {}),
    (e) => e.status === 503,
  );
});

test('role observation contracts reject friendly targets, duplicate IDs, nonfinite values and extra instructions', () => {
  assert.deepEqual(parseArenaObservation({ ...facts('ally'), command: 'teleport' }, 'ally'), facts('ally'));
  assert.throws(() => parseArenaObservation(facts('boss'), 'ally'));
  assert.throws(() => parseArenaObservation({ ...facts('ally'), targets: facts('boss').targets }, 'ally'));
  assert.throws(() => parseArenaObservation({ ...facts('boss'), targets: facts('ally').targets }, 'boss'));
  assert.throws(() => parseArenaObservation({ ...facts('ally'), self: { ...body, hp: Infinity } }, 'ally'));
  assert.throws(() =>
    parseArenaObservation({ ...facts('ally'), targets: Array(13).fill(facts('ally').targets[0]) }, 'ally'),
  );
});

test('the BAND role executor uses normal wind-up/recovery and damages only a valid opponent', () => {
  const hits = [],
    g = {
      hero: { ...body, hp: 400, hpMax: 400, kos: 0, state: 'idle' },
      cam: { yaw: 0 },
      frame: 0,
      diff: { windup: 40, officerHp: 1 },
      combat: {
        clash: (a, v, damage) => {
          hits.push([a, v, damage]);
          return false;
        },
        enemyStrike: (i) => hits.push(['hero', i]),
      },
    };
  g.crowd = createCrowd(g, 0);
  g.crowd.reset();
  const c = g.crowd,
    slots = { ally: c.spawnAgent('ally'), boss: c.spawnAgent('boss') };
  c.x[slots.ally] = 0;
  c.z[slots.ally] = 0;
  c.x[slots.boss] = 0;
  c.z[slots.boss] = 2;
  const before = c.hp[slots.boss];
  c.cd[slots.ally] = 0;
  assert.deepEqual(
    arenaObservation(g, 'ally', slots).targets.map((t) => t.id),
    [slots.boss],
  );
  executeArenaTactic(g, slots.ally, 'ally', plan, slots);
  assert.equal(c.st[slots.ally], ST.ATTACK);
  assert.deepEqual(hits, []);
  c.stT[slots.ally] = 39;
  executeArenaTactic(g, slots.ally, 'ally', plan, slots);
  assert.deepEqual(hits, []);
  c.stT[slots.ally] = 40;
  c.yaw[slots.ally] = 0;
  executeArenaTactic(g, slots.ally, 'ally', plan, slots);
  assert.deepEqual(hits[0], [slots.ally, slots.boss, 28]);
  assert.equal(c.hp[slots.boss], before);
  c.stT[slots.ally] = 40 + CROWD.recover;
  executeArenaTactic(g, slots.ally, 'ally', plan, slots);
  assert.ok(c.cd[slots.ally] > 0);
  assert.deepEqual(executeArenaTactic(g, slots.ally, 'ally', null, slots), [0, 0]);
  c.cd[slots.boss] = 0;
  c.st[slots.boss] = ST.GUARD;
  c.z[slots.boss] = 1.5;
  c.yaw[slots.boss] = Math.PI;
  executeArenaTactic(g, slots.boss, 'boss', { ...plan, targetId: -1 }, slots);
  c.stT[slots.boss] = 40;
  executeArenaTactic(g, slots.boss, 'boss', { ...plan, targetId: -1 }, slots);
  assert.deepEqual(hits[1], ['hero', slots.boss]);
});

test('both agents share a fair serialized queue, with isolated visitor keys and no credentials in responses', async () => {
  const jobs = [],
    service = createArenaService({
      env,
      runtimeFactory: async (role) => ({
        decide: async (job) => {
          jobs.push({ role, observation: job.observation, key: job.credentials.apiKey });
          return plan;
        },
        close() {},
      }),
    });
  const a = await service.start(settings),
    b = await service.start(own);
  service.observe(a.id, observation);
  service.observe(b.id, { ally: facts('ally') });
  await flush();
  await flush();
  await flush();
  assert.deepEqual(
    jobs.map((j) => j.role),
    ['ally', 'boss', 'ally'],
  );
  assert.equal(jobs[2].key, 'visitor-private-key');
  assert.equal(jobs[0].key, env.OPENAI_API_KEY);
  assert.equal(JSON.stringify(service.observe(b.id, { ally: facts('ally') })).includes('private-key'), false);
  assert.equal(service.observe(a.id, observation).agents.boss.tactic.goal, 'engage');
  service.stop(a.id);
  assert.throws(
    () => service.observe(a.id, observation),
    (e) => e.status === 404,
  );
  await service.close();
});

test('stop/expiry abort a provider call and discard its late decision', async () => {
  let now = 0,
    job,
    complete;
  const service = createArenaService({
    env,
    now: () => now,
    runtimeFactory: async () => ({
      decide: (j) => {
        job = j;
        return new Promise((r) => {
          complete = r;
        });
      },
      close() {},
    }),
  });
  const a = await service.start(own);
  service.observe(a.id, { ally: facts('ally') });
  await flush();
  service.stop(a.id);
  assert.equal(job.signal.aborted, true);
  complete(plan);
  await flush();
  assert.equal(job.credentials, null);
  const b = await service.start(own);
  now = 31001;
  assert.throws(
    () => service.observe(b.id, { ally: facts('ally') }),
    (e) => e.status === 404,
  );
  await service.close();
});

test('paused heartbeats keep the session alive without spending turns; failed models wait for a new session', async () => {
  let now = 0,
    calls = 0;
  const service = createArenaService({
    env,
    now: () => now,
    runtimeFactory: async () => ({
      decide: async () => {
        calls++;
        throw Error('provider reveals secret');
      },
      close() {},
    }),
  });
  const a = await service.start(own);
  for (now = 10000; now <= 60000; now += 10000) service.observe(a.id, { ally: facts('ally') }, false);
  await flush();
  assert.equal(calls, 0);
  service.observe(a.id, { ally: facts('ally') }, true);
  await flush();
  now += 9000;
  const result = service.observe(a.id, { ally: facts('ally') }, true);
  await flush();
  assert.equal(calls, 1);
  assert.equal(result.agents.ally.state, 'error');
  assert.equal(JSON.stringify(result).includes('secret'), false);
  await service.close();
});

test('host quota is shared, while BYOK spends only its own allowance', async () => {
  let calls = 0;
  const budget = createDecisionBudget(1);
  const service = createArenaService({
    env,
    budget,
    runtimeFactory: async () => ({
      decide: async () => {
        calls++;
        return plan;
      },
      close() {},
    }),
  });
  const a = await service.start(settings);
  service.observe(a.id, observation);
  await flush();
  await flush();
  assert.equal(calls, 1);
  assert.equal(service.observe(a.id, observation).agents.boss.state, 'limited');
  const b = await service.start(own);
  service.observe(b.id, { ally: facts('ally') });
  await flush();
  assert.equal(calls, 2);
  await service.close();
});

test('pausing an in-flight turn cancels it and allows a fresh decision after resume', async () => {
  let job,
    complete,
    calls = 0;
  const service = createArenaService({
    env,
    runtimeFactory: async () => ({
      decide: (j) => {
        calls++;
        job = j;
        return new Promise((r) => {
          complete = r;
        });
      },
      close() {},
    }),
  });
  const a = await service.start(own);
  service.observe(a.id, { ally: facts('ally') });
  await flush();
  service.observe(a.id, { ally: facts('ally') }, false);
  assert.equal(job.signal.aborted, true);
  complete(plan);
  await flush();
  assert.equal(service.observe(a.id, { ally: facts('ally') }, true).agents.ally.state, 'thinking');
  await flush();
  assert.equal(calls, 2);
  complete(plan);
  await flush();
  await service.close();
});

test('provider transport receives the selected key, cancellation and only factual gameplay; tool output is validated', async () => {
  let options, sent, request;
  const key = 'visitor-private-key',
    signal = new AbortController().signal;
  const clientFactory = (o) => {
    options = o;
    return {
      chat: {
        completions: {
          create: async (p, r) => {
            sent = p;
            request = r;
            return {
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        function: { name: 'set_tactic', arguments: JSON.stringify({ ...plan, reason: key }) },
                      },
                    ],
                  },
                },
              ],
            };
          },
        },
      },
    };
  };
  const result = await chooseArenaTactic(
    {
      signal,
      credentials: { provider: 'groq', model: 'openai/gpt-oss-20b', apiKey: key },
      observation: facts('ally'),
    },
    clientFactory,
  );
  assert.equal(options.baseURL, PROVIDERS.groq);
  assert.equal(options.apiKey, key);
  assert.equal(request.signal, signal);
  assert.equal(JSON.stringify(sent.messages).includes(key), false);
  assert.equal(result.reason, '[redacted]');
  await chooseArenaTactic(
    {
      signal,
      credentials: { provider: 'openai', model: 'gpt-6-luna', apiKey: key },
      observation: facts('boss'),
    },
    clientFactory,
  );
  assert.equal(sent.reasoning_effort, 'none');
  assert.equal(sent.tools[0].function.strict, true);
});

test('provider failures cannot reach GenericAdapter error reporting or leak key fragments into BAND', async () => {
  const sent = [],
    job = { signal: new AbortController().signal };
  await handleArenaJob(job, { sendMessage: async (text) => sent.push(text) }, async () => {
    throw Error('Incorrect API key: visitor-private-key');
  });
  assert.equal(job.plan, null);
  assert.deepEqual(sent, []);
  const abort = new AbortController();
  abort.abort();
  await handleArenaJob(
    { signal: abort.signal },
    { sendMessage: async (text) => sent.push(text) },
    async () => plan,
  );
  assert.deepEqual(sent, []);
  await handleArenaJob(
    job,
    {
      sendMessage: async () => {
        throw Error('BAND delivery interrupted');
      },
    },
    async () => plan,
  );
  assert.equal(job.plan.goal, 'engage');
});
