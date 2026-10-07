// Local game server and opt-in Band relay. Credentials stay on this server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { bandConfigured, parseRun, sendRunToBand } from './src/server/band.js';

const ROOT = import.meta.dirname, PORT = Number(process.argv[2]) || 8000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const lastSend = new Map();
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };

async function readRun(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2048) throw new Error('Too large');
  }
  return parseRun(JSON.parse(body));
}

createServer(async (req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (p === '/api/band/status' && req.method === 'GET') {
    json(res, 200, { configured: bandConfigured() });
    return;
  }
  if (p === '/api/band/session' && req.method === 'POST') {
    if (!bandConfigured()) { json(res, 503, { error: 'Band is not configured' }); return; }
    let sameOrigin = true;
    try { if (req.headers.origin) sameOrigin = new URL(req.headers.origin).host === req.headers.host; }
    catch { sameOrigin = false; }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json' ||
        !sameOrigin) {
      json(res, 403, { error: 'Request rejected' }); return;
    }
    let run;
    try { run = await readRun(req); }
    catch { json(res, 400, { error: 'Invalid run summary' }); return; }
    const from = req.socket.remoteAddress || 'unknown', now = Date.now();
    if (now - (lastSend.get(from) || 0) < 10000) { json(res, 429, { error: 'Wait a few seconds before sending another run' }); return; }
    lastSend.set(from, now);
    try { json(res, 202, await sendRunToBand(run)); }
    catch (error) { lastSend.delete(from); console.error('Band send failed:', error); json(res, 502, { error: 'Could not send to Band; check server configuration and try again' }); }
    return;
  }
  if (p.startsWith('/api/')) { json(res, 404, { error: 'Not found' }); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if (p.endsWith('/')) p += 'index.html';
  // Only publish files required by the browser. Never expose .env, SDKs, or server code.
  if (p.split('/').some((part) => part === '..' || part.startsWith('.')) ||
      (p !== '/index.html' &&
      !(/^\/(src\/(?!server\/)|vendor\/three\/)[\w./-]+\.js$/.test(p)))) {
    res.writeHead(404); res.end('Not found'); return;
  }
  const file = resolve(ROOT, '.' + p);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Band Kungfu: http://localhost:${PORT}`));
