import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createArenaService } from './arena.js';
import { bandConfigured, parseRun, sendRunToBand } from './band.js';
import { positiveInteger } from './config.js';
import { DecisionBudget } from './decision-budget.js';
import { HttpError, readJsonObject, requireJsonRequest, sendJson } from './http.js';
import { createPlayerService } from './player.js';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/** Owns HTTP routes, the shared hosted budget, and shutdown of all game services. */
export class GameServer {
  #env;
  constructor({
    env = process.env,
    root = resolve(import.meta.dirname, '../..'),
    port,
    host,
    now = Date.now,
  } = {}) {
    this.#env = env;
    this.root = resolve(root);
    this.port = port === 0 ? 0 : positiveInteger(port ?? env.PORT, 8000, 65535);
    this.host = host || env.HOST || (env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
    this.now = now;
    this.lastSend = new Map();
    const budget = new DecisionBudget(positiveInteger(env.AI_MAX_DECISIONS_PER_HOUR, 120, 10_000), now);
    this.services = {
      player: createPlayerService({ env, now, budget }),
      arena: createArenaService({ env, now, budget }),
    };
    this.server = createServer((request, response) => this.#handleRequest(request, response));
  }

  listen() {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, () => {
        this.server.removeListener('error', reject);
        resolve(this.server.address());
      });
    });
  }

  async close() {
    const stopped = new Promise((resolve) => this.server.close(resolve));
    await Promise.allSettled(Object.values(this.services).map((service) => service.close()));
    await stopped;
  }

  async #handleRequest(request, response) {
    let path;
    try {
      path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400);
      response.end();
      return;
    }
    if (path === '/healthz' && request.method === 'GET') return sendJson(response, 200, { ok: true });
    const aiRoute = /^\/api\/(player|arena)\/(status|session|observe|stop)$/.exec(path);
    if (aiRoute) {
      const [, mode, action] = aiRoute;
      if (action === 'status' && request.method === 'GET')
        return sendJson(response, 200, this.services[mode].status());
      if (action !== 'status' && request.method === 'POST')
        return this.#handleAgentRequest(request, response, mode, action);
    }
    if (path === '/api/band/status' && request.method === 'GET')
      return sendJson(response, 200, { configured: bandConfigured(this.#env) });
    if (path === '/api/band/session' && request.method === 'POST')
      return this.#handleRunRequest(request, response);
    if (path.startsWith('/api/')) return sendJson(response, 404, { error: 'Not found' });
    return this.#serveFile(request, response, path);
  }

  async #handleAgentRequest(request, response, mode, action) {
    try {
      requireJsonRequest(request);
      const input = await readJsonObject(request);
      const service = this.services[mode];
      let result;
      if (action === 'session') result = await service.start(input);
      else if (action === 'observe') result = service.observe(input.id, input.observation, input.active);
      else result = service.stop(input.id);
      sendJson(response, 200, result);
    } catch (error) {
      const known = error instanceof HttpError;
      sendJson(response, known ? error.status : 400, {
        error: known ? error.message : 'Invalid player request',
      });
    }
  }

  async #handleRunRequest(request, response) {
    if (!bandConfigured(this.#env)) return sendJson(response, 503, { error: 'Band is not configured' });
    let run;
    try {
      requireJsonRequest(request);
      run = parseRun(await readJsonObject(request, 2048));
    } catch (error) {
      return sendJson(response, error.status === 403 ? 403 : 400, {
        error: error.status === 403 ? error.message : 'Invalid run summary',
      });
    }
    const from = request.socket.remoteAddress || 'unknown';
    const now = this.now();
    for (const [address, sentAt] of this.lastSend) if (now - sentAt >= 10_000) this.lastSend.delete(address);
    if (this.lastSend.has(from))
      return sendJson(response, 429, { error: 'Wait a few seconds before sending another run' });
    this.lastSend.set(from, now);
    try {
      sendJson(response, 202, await sendRunToBand(run, { env: this.#env }));
    } catch {
      this.lastSend.delete(from);
      console.error('BAND run relay failed. Check server configuration.');
      sendJson(response, 502, { error: 'Could not send to Band; check server configuration and try again' });
    }
  }

  async #serveFile(request, response, path) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    if (path.endsWith('/')) path += 'index.html';
    const browserPath = path.toLowerCase();
    const browserFile =
      /^\/src\/(?!server\/)[\w./-]+\.(js|css)$/.test(browserPath) ||
      /^\/vendor\/three\/[\w./-]+\.js$/.test(browserPath);
    if (
      path.split('/').some((part) => part === '..' || part.startsWith('.')) ||
      (path !== '/index.html' && !browserFile)
    ) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const file = resolve(this.root, '.' + path);
    if (!file.startsWith(this.root + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)], 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  }
}
