export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

export function requireJsonRequest(request) {
  let sameOrigin = true;
  try {
    if (request.headers.origin) sameOrigin = new URL(request.headers.origin).host === request.headers.host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin || request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new HttpError(403, 'Request rejected');
  }
}

export async function readJsonObject(request, maxBytes = 10_000) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new HttpError(400, 'Request is too large');
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid request');
  return body;
}
