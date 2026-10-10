import { AI_TIMING } from '../ai/timing.js';

export class AgentApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AgentApiError';
    this.status = status;
  }
}

/** Stateless transport: never retains a request body or a visitor's API key. */
export class AgentApiClient {
  constructor(
    mode,
    { fetchImpl = globalThis.fetch.bind(globalThis), timeoutMs = AI_TIMING.requestTimeoutMs } = {},
  ) {
    this.basePath = `/api/${mode}`;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async status() {
    return this.#read(await this.fetch(`${this.basePath}/status`));
  }

  async post(action, body, { keepalive = false } = {}) {
    const response = await this.fetch(`${this.basePath}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...(keepalive ? { keepalive: true } : { signal: AbortSignal.timeout(this.timeoutMs) }),
    });
    return this.#read(response);
  }

  async #read(response) {
    const body = await response.json();
    if (!response.ok) throw new AgentApiError(response.status, body.error || 'AI service is unavailable');
    return body;
  }
}
