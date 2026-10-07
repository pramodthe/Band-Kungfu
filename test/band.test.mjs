import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { bandConfigured, parseRun, sendRunToBand } from '../src/server/band.js';

const reporterKey = 'test-reporter-key';
const roomId = '11111111-1111-4111-8111-111111111111';
const analystId = '22222222-2222-4222-8222-222222222222';
const env = { BAND_REPORTER_API_KEY: reporterKey, BAND_ROOM_ID: roomId, ANALYST_AGENT_ID: analystId };
const run = { win: true, char: 'saruabh', chapter: 'championship', diff: 'normal',
  stats: { kos: 1000, time: 900, hpMax: 100, maxChain: 57, dmg: 38.4, rank: 'A' } };

test('run parser keeps bounded game fields and rejects injected values', () => {
  assert.deepEqual(parseRun({ ...run, extra: 'ignored' }), { ...run, stats: { ...run.stats, dmg: 38 } });
  assert.throws(() => parseRun({ ...run, char: '@other-agent' }));
  assert.throws(() => parseRun({ ...run, stats: { ...run.stats, kos: 1e12 } }));
  assert.equal(bandConfigured(env), true);
  assert.equal(bandConfigured({ ...env, BAND_ROOM_ID: 'wrong' }), false);
});

test('relay mentions the actual active analyst and keeps the API key in headers', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: [
      { id: analystId, name: 'Run Analyst', handle: 'player/run-analyst', status: 'inactive' },
    ] }) };
  };
  const result = await sendRunToBand(parseRun(run), { env, fetchImpl });
  assert.match(result.runId, /^[0-9a-f-]{36}$/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers['X-API-Key'], reporterKey);
  assert.equal(calls[1].options.headers['X-API-Key'], reporterKey);
  assert.equal(calls[1].options.method, 'POST');
  const posted = JSON.parse(calls[1].options.body).message;
  assert.match(posted.content, /^@player\/run-analyst Analyze this Band Kungfu game run/);
  assert.match(posted.content, /"char":"Saruabh"/);
  assert.deepEqual(posted.mentions, [{ id: analystId, name: 'Run Analyst', handle: 'player/run-analyst' }]);
  assert.doesNotMatch(posted.content, /test-reporter-key/);
});

test('server hides credentials and disables submissions when unconfigured', async (t) => {
  const port = await new Promise((resolve, reject) => {
    const probe = createServer().once('error', reject).listen(0, '127.0.0.1', () => {
      const { port } = probe.address(); probe.close(() => resolve(port));
    });
  });
  const child = spawn(process.execPath, ['serve.mjs', String(port)], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, BAND_ROOM_ID: '', BAND_REPORTER_API_KEY: '', ANALYST_AGENT_ID: '' },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${base}/api/band/status`); ready = r.ok; if (ready) break; }
    catch { await new Promise((r) => setTimeout(r, 50)); }
  }
  assert.equal(ready, true);
  assert.deepEqual(await (await fetch(`${base}/api/band/status`)).json(), { configured: false });
  assert.equal((await fetch(`${base}/api/band/session`, { method: 'POST' })).status, 503);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/src/server/band.js`)).status, 404);
  assert.equal((await fetch(`${base}/index.html`)).status, 200);
  assert.equal((await fetch(`${base}/vendor/three/three.module.js`)).status, 200);
});
