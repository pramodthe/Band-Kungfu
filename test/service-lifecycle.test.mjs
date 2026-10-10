import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { RuntimePool } from '../src/server/runtime-pool.js';
import { SessionStore } from '../src/server/session-store.js';
import { PrivateBandRoom } from '../src/server/private-band-room.js';
import { HttpError, readJsonObject, requireJsonRequest } from '../src/server/http.js';
import { AgentApiClient } from '../src/ui/agent-api-client.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('concurrent visitors share one runtime connection and failed connections can be retried', async () => {
  let starts = 0;
  const runtime = { close: async () => {} };
  const pool = new RuntimePool(async () => {
    if (++starts === 1) throw Error('Connection unavailable');
    return runtime;
  });
  await assert.rejects(pool.get('ally'));
  const [a, b] = await Promise.all([pool.get('ally'), pool.get('ally')]);
  assert.equal(a, b);
  assert.equal(starts, 2);
  await pool.close();
});

test('a runtime that finishes connecting during shutdown is closed instead of leaked', async () => {
  let connect;
  let closed = 0;
  const pool = new RuntimePool(
    () =>
      new Promise((resolve) => {
        connect = resolve;
      }),
  );
  const started = pool.get('boss');
  const rejected = assert.rejects(started, /closed/);
  await flush();
  const shutdown = pool.close();
  connect({
    close: async () => {
      closed++;
    },
  });
  await Promise.all([shutdown, rejected]);
  assert.equal(closed, 1);
  assert.equal(pool.ready('boss'), undefined);
  await assert.rejects(pool.get('boss'), /closed/);
});

test('expired leases release capacity, abort work, erase credentials and reject late results', () => {
  let now = 0;
  const store = new SessionStore({ now: () => now, maxSessions: 1, busyMessage: 'Busy' });
  const first = store.create({ credentials: { apiKey: 'session-secret' }, abort: new AbortController() });
  assert.throws(
    () => store.create(),
    (error) => error.status === 409,
  );
  now = 30_001;
  store.expire();
  assert.equal(first.credentials, null);
  assert.equal(first.abort.signal.aborted, true);
  assert.equal(store.owns(first), false);
  assert.throws(
    () => store.get(first.id),
    (error) => error.status === 404,
  );
  const second = store.create();
  store.close();
  assert.equal(store.owns(second), false);
  assert.throws(
    () => store.create(),
    (error) => error.status === 503,
  );
});

test('JSON transport preserves Unicode split across packets and enforces byte limits and origins', async () => {
  const bytes = Buffer.from(JSON.stringify({ message: '🙂' }));
  const offset = bytes.indexOf(Buffer.from('🙂'));
  const stream = Readable.from([
    bytes.subarray(0, offset + 1),
    bytes.subarray(offset + 1, offset + 3),
    bytes.subarray(offset + 3),
  ]);
  assert.deepEqual(await readJsonObject(stream), { message: '🙂' });
  await assert.rejects(
    readJsonObject(Readable.from([bytes]), bytes.length - 1),
    (error) => error instanceof HttpError && error.status === 400,
  );
  await assert.rejects(readJsonObject(Readable.from([Buffer.from('[]')])));
  assert.throws(
    () =>
      requireJsonRequest({
        headers: {
          host: 'game.example',
          origin: 'https://other.example',
          'content-type': 'application/json',
        },
      }),
    (error) => error.status === 403,
  );
  requireJsonRequest({
    headers: { host: 'game.example', origin: 'https://game.example', 'content-type': 'application/json' },
  });
});

test('private BAND rooms reject extra participants and keep agent keys out of game messages', async () => {
  const env = { ALLY_AGENT_ID: 'ally', ALLY_ROOM_ID: 'room', ALLY_API_KEY: 'band-secret' };
  let stopped = 0;
  let options;
  let request;
  let message;
  let participants = [
    { type: 'User', id: 'owner', handle: 'owner' },
    { type: 'Agent', id: 'other-agent' },
  ];
  const room = new PrivateBandRoom({
    env,
    prefix: 'ALLY',
    adapter: {},
    agentFactory: (config) => {
      options = config;
      return {
        start: async () => {},
        stop: async () => {
          stopped++;
        },
        bootstrapRoomMessage: async (_room, body) => {
          message = body;
        },
      };
    },
    fetchImpl: async (_url, init) => {
      request = init;
      return { ok: true, json: async () => ({ data: participants }) };
    },
  });
  await assert.rejects(room.start(), /private room/);
  assert.equal(stopped, 1);
  participants = [
    { type: 'User', id: 'owner', handle: 'owner' },
    { type: 'Agent', id: 'ally' },
  ];
  await room.start();
  await room.bootstrap('request', { observation: { hp: 1 } });
  assert.equal(request.headers['X-API-Key'], 'band-secret');
  assert.equal(options.roomFilter({ id: 'other-room' }), false);
  assert.equal(message.senderId, 'owner');
  assert.doesNotMatch(message.content, /secret/);
  assert.doesNotMatch(JSON.stringify(room), /band-secret/);
  await room.close();
});

test('both browser modes use bounded JSON requests, cleanup keepalive and consistent API errors', async () => {
  const calls = [];
  let response = { ok: true, json: async () => ({ id: 'session' }) };
  const client = new AgentApiClient('arena', {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response;
    },
  });
  await client.post('session', { model: { apiKey: 'visitor-secret' } });
  assert.equal(calls[0].url, '/api/arena/session');
  assert.equal(calls[0].options.signal instanceof AbortSignal, true);
  assert.doesNotMatch(JSON.stringify(client), /visitor-secret/);
  await client.post('stop', { id: 'session' }, { keepalive: true });
  assert.equal(calls[1].options.keepalive, true);
  assert.equal(calls[1].options.signal, undefined);
  response = { ok: false, status: 409, json: async () => ({ error: 'Arena is busy' }) };
  await assert.rejects(
    client.post('session', {}),
    (error) => error.status === 409 && error.message === 'Arena is busy',
  );
});

test('the browser API client preserves the global fetch receiver', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = function () {
    assert.equal(this, globalThis);
    return Promise.resolve({ ok: true, json: async () => ({ configured: true }) });
  };
  const client = new AgentApiClient('player');
  assert.deepEqual(await client.status(), { configured: true });
});
