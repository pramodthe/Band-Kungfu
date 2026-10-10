import test from 'node:test';
import assert from 'node:assert/strict';
import { parseObservation, parseTactic } from '../src/ai/protocol.js';
import { createAiController, observation } from '../src/ai/controller.js';
import { createPlayerService } from '../src/server/player.js';

const tactic = {
  goal: 'engage',
  targetId: 0,
  finishAfter: 3,
  useOverclock: true,
  reason: 'Close on the nearest challenger and use a finisher.',
};
const facts = {
  mode: 'free',
  char: 'arick',
  frame: 1,
  kos: 0,
  hero: { x: 0, z: 0, hp: 1, gauge: 0 },
  enemies: [{ id: 0, x: 0, z: 10, hp: 1, officer: false, attacking: false }],
};
const env = {
  PLAYER_AGENT_ID: '11111111-1111-4111-8111-111111111111',
  PLAYER_ROOM_ID: '22222222-2222-4222-8222-222222222222',
  PLAYER_API_KEY: 'test-player-key',
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
function game() {
  return {
    mode: 'free',
    frame: 100,
    cam: { yaw: 0 },
    diff: { windup: 40 },
    musou: { ready: () => false },
    hero: {
      x: 0,
      z: 0,
      hp: 400,
      hpMax: 400,
      musou: 0,
      musouMax: 100,
      kos: 0,
      char: { id: 'arick' },
      state: 'idle',
      grounded: true,
      dead: false,
      move: null,
      kit: { moves: {} },
    },
    crowd: {
      N: 2,
      x: [0, 0],
      z: [10, 15],
      hp: [30, 30],
      hpMax: [30, 30],
      st: [2, 2],
      stT: [0, 0],
      type: [0, 0],
    },
  };
}

test('observation and tactic contracts bound data and discard extra fields', () => {
  assert.deepEqual(parseObservation({ ...facts, arbitraryCommand: 'ignored' }), facts);
  assert.deepEqual(parseTactic({ ...tactic, hp: 9999 }), tactic);
  assert.throws(() => parseObservation({ ...facts, mode: 'story' }));
  assert.throws(() => parseObservation({ ...facts, enemies: Array(13).fill(facts.enemies[0]) }));
  assert.throws(() => parseObservation({ ...facts, hero: { ...facts.hero, x: Infinity } }));
  assert.throws(() => parseTactic({ ...tactic, goal: 'teleport' }));
  assert.throws(() => parseTactic({ ...tactic, finishAfter: 100 }));
  assert.throws(() => parseTactic({ ...tactic, reason: 'x'.repeat(161) }));
});

test('AI generates camera-relative movement without changing game state', () => {
  const g = game(),
    before = JSON.stringify(g),
    controller = createAiController();
  assert.equal(controller.sample(g, tactic).my, 1);
  assert.equal(JSON.stringify(g), before);
  g.cam.yaw = Math.PI / 2;
  const frame = controller.sample(g, tactic);
  assert.ok(frame.mx > 0.99 && Math.abs(frame.my) < 1e-6);
  assert.deepEqual(controller.sample(g, null).pressed, {});
  assert.equal(controller.sample(g, null).my, 0);
});

test('AI uses normal combo and Overclock presses with cooldowns', () => {
  const g = game(),
    controller = createAiController();
  g.crowd.z[0] = 2;
  assert.equal(controller.sample(g, tactic).pressed.attack, true);
  assert.equal(controller.sample(g, tactic).pressed.attack, undefined);
  g.frame += 12;
  g.hero.move = 'n3';
  g.hero.moveT = 20;
  g.hero.kit.moves.n3 = { branch: 17, cancel: 24 };
  assert.equal(controller.sample(g, tactic).pressed.charge, true);
  g.frame += 12;
  g.hero.move = null;
  g.musou.ready = () => true;
  assert.equal(controller.sample(g, tactic).pressed.musou, true);
  assert.equal(g.hero.musou, 0); // Input does not manufacture or spend gauge.
});

test('reflex dodge moves away from a threat even while retreating', () => {
  const g = game(),
    controller = createAiController();
  g.crowd.z[0] = 2;
  g.crowd.st[0] = 4;
  g.crowd.stT[0] = 35;
  const frame = controller.sample(g, { ...tactic, goal: 'retreat' });
  assert.equal(frame.pressed.dodge, true);
  assert.ok(frame.my < -0.99);
});

test('controller picks an open movement direction around a blocking prop', () => {
  const g = game(),
    controller = createAiController({ walk: (x, z) => (Math.abs(x) < 0.2 ? [0, 0] : [x, z]) });
  const frame = controller.sample(g, tactic);
  assert.ok(Math.abs(frame.mx) > 0.2);
  assert.ok(Math.abs(Math.hypot(frame.mx, frame.my) - 1) < 1e-6);
});

test('observations exclude dead enemies and allies and are limited to 12 targets', () => {
  const g = game();
  g.crowd.st[0] = 10;
  assert.deepEqual(
    observation(g).enemies.map((e) => e.id),
    [1],
  );
  assert.deepEqual(parseObservation(observation(g)).hero, facts.hero);
});

test('player sessions require configuration and have one owner', async () => {
  const disabled = createPlayerService({ env: {} });
  assert.deepEqual(disabled.status(), { configured: false });
  await assert.rejects(disabled.start(), (e) => e.status === 503);
  const service = createPlayerService({
    env,
    runtimeFactory: async () => ({ decide: async () => tactic, close() {} }),
  });
  const session = await service.start();
  await assert.rejects(service.start(), (e) => e.status === 409);
  assert.throws(
    () => service.observe('wrong-owner', facts),
    (e) => e.status === 404,
  );
  service.stop(session.id);
  assert.throws(
    () => service.observe(session.id, facts),
    (e) => e.status === 404,
  );
  await service.close();
});

test('one decision runs at a time and tactics expire after 20 seconds', async () => {
  let now = 0,
    calls = 0,
    resolve;
  const service = createPlayerService({
    env,
    now: () => now,
    runtimeFactory: async () => ({
      decide: () => {
        calls++;
        return new Promise((r) => {
          resolve = r;
        });
      },
      close() {},
    }),
  });
  const { id } = await service.start();
  assert.equal(service.observe(id, facts).state, 'thinking');
  await flush();
  service.observe(id, { ...facts, frame: 2 });
  await flush();
  assert.equal(calls, 1);
  resolve(tactic);
  await flush();
  assert.equal(service.observe(id, { ...facts, frame: 3 }).tactic.goal, 'engage');
  now = 21000;
  assert.equal(service.observe(id, { ...facts, frame: 4 }).tactic, null);
  service.stop(id);
  await service.close();
});

test('takeover prevents a late model decision from controlling a new session', async () => {
  let finish,
    calls = 0;
  const service = createPlayerService({
    env,
    runtimeFactory: async () => ({
      decide: () => {
        calls++;
        return new Promise((r) => {
          finish = r;
        });
      },
      close() {},
    }),
  });
  const first = await service.start();
  service.observe(first.id, facts);
  await flush();
  service.stop(first.id);
  const second = await service.start();
  assert.equal(service.observe(second.id, facts).state, 'waiting');
  await flush();
  assert.equal(calls, 1); // Do not overlap provider turns across takeover/restart.
  finish(tactic);
  await flush();
  const result = service.observe(second.id, facts);
  assert.equal(result.tactic, null);
  assert.equal(result.state, 'thinking');
  service.stop(second.id);
  await service.close();
});

test('disconnected tabs expire and malformed or older observations are rejected', async () => {
  let now = 0;
  const service = createPlayerService({
    env,
    now: () => now,
    runtimeFactory: async () => ({ decide: async () => tactic, close() {} }),
  });
  const { id } = await service.start();
  service.observe(id, facts);
  assert.throws(
    () => service.observe(id, { ...facts, frame: 0 }),
    (e) => e.status === 409,
  );
  assert.throws(() => service.observe(id, { ...facts, mode: 'story' }));
  now = 31000;
  assert.throws(
    () => service.observe(id, facts),
    (e) => e.status === 404,
  );
  await service.start();
  await service.close();
});

test('model errors stop control and expose no provider or credential details', async () => {
  const service = createPlayerService({
    env,
    runtimeFactory: async () => ({
      decide: async () => {
        throw Error('secret-provider-detail');
      },
      close() {},
    }),
  });
  const { id } = await service.start();
  service.observe(id, facts);
  await flush();
  const result = service.observe(id, facts);
  assert.equal(result.state, 'error');
  assert.equal(result.tactic, null);
  assert.doesNotMatch(JSON.stringify(result), /secret-provider-detail|test-player-key/);
  await service.close();
});

test('public visitors have independent sessions and fairly share one model turn', async () => {
  const pending = [],
    called = [];
  const service = createPlayerService({
    env: { ...env, AI_MAX_SESSIONS: '3' },
    runtimeFactory: async () => ({
      decide: ({ observation }) => {
        called.push(observation.char);
        return new Promise((r) => pending.push(r));
      },
      close() {},
    }),
  });
  const first = await service.start(),
    second = await service.start(),
    third = await service.start();
  await assert.rejects(service.start(), (e) => e.status === 409);
  service.observe(first.id, facts);
  assert.equal(service.observe(second.id, { ...facts, char: 'vlad' }).state, 'queued');
  service.observe(third.id, { ...facts, char: 'connector' });
  await flush();
  assert.deepEqual(called, ['arick']);
  pending.shift()({ ...tactic, reason: 'First visitor tactic' });
  await flush();
  assert.deepEqual(called, ['arick', 'vlad']);
  assert.equal(service.observe(first.id, facts).tactic.reason, 'First visitor tactic');
  assert.equal(service.observe(second.id, facts).tactic, null);
  pending.shift()({ ...tactic, reason: 'Second visitor tactic' });
  await flush();
  assert.deepEqual(called, ['arick', 'vlad', 'connector']);
  assert.equal(service.observe(second.id, facts).tactic.reason, 'Second visitor tactic');
  service.stop(first.id);
  assert.throws(
    () => service.observe(first.id, facts),
    (e) => e.status === 404,
  );
  assert.ok(service.observe(second.id, facts).tactic);
  await service.close();
});

test('hourly allowance stops new turns, preserves the last tactic and resets on time', async () => {
  let now = 0,
    calls = 0;
  const service = createPlayerService({
    env: { ...env, AI_MAX_DECISIONS_PER_HOUR: '1' },
    now: () => now,
    runtimeFactory: async () => ({
      decide: async () => {
        calls++;
        return tactic;
      },
      close() {},
    }),
  });
  const { id } = await service.start();
  service.observe(id, facts);
  await flush();
  assert.equal(service.observe(id, facts).tactic.goal, 'engage');
  now = 21000;
  assert.equal(service.observe(id, facts).state, 'limited');
  assert.equal(calls, 1);
  now = 3599000;
  assert.throws(
    () => service.observe(id, facts),
    (e) => e.status === 404,
  );
  const next = await service.start();
  assert.equal(service.observe(next.id, facts).state, 'limited');
  now = 3600000;
  assert.equal(service.observe(next.id, facts).state, 'thinking');
  await flush();
  assert.equal(calls, 2);
  await service.close();
});

test('production requires an API model key and admits three public sessions', async () => {
  const unavailable = createPlayerService({ env: { ...env, NODE_ENV: 'production' } });
  assert.equal(unavailable.status().configured, false);
  const service = createPlayerService({
    env: { ...env, NODE_ENV: 'production', OPENAI_API_KEY: 'test-model-key' },
    runtimeFactory: async () => ({ decide: async () => tactic, close() {} }),
  });
  await service.start();
  await service.start();
  await service.start();
  await assert.rejects(service.start(), (e) => e.status === 409);
  await service.close();
});
