import { randomUUID } from 'node:crypto';
import { AI_TIMING } from '../ai/timing.js';
import { HttpError } from './http.js';

/** Owns visitor leases and erases session credentials when a lease ends. */
export class SessionStore {
  #sessions = new Map();
  #closed = false;
  #reaper;

  constructor({
    now = Date.now,
    maxSessions,
    endedMessage = 'Session ended',
    busyMessage,
    idleMs = AI_TIMING.sessionIdleMs,
  }) {
    Object.assign(this, { now, maxSessions, endedMessage, busyMessage, idleMs });
    this.#reaper = setInterval(() => this.expire(), 5_000);
    this.#reaper.unref();
  }

  create(data = {}) {
    this.expire();
    if (this.#closed) throw new HttpError(503, 'Server is shutting down');
    if (this.#sessions.size >= this.maxSessions) throw new HttpError(409, this.busyMessage);
    const session = { ...data, id: randomUUID(), seen: this.now() };
    this.#sessions.set(session.id, session);
    return session;
  }

  get(id) {
    this.expire();
    const session = this.#sessions.get(id);
    if (!session) throw new HttpError(404, this.endedMessage);
    return session;
  }

  owns(session) {
    this.expire();
    return this.#sessions.get(session.id) === session;
  }

  values() {
    this.expire();
    return this.#sessions.values();
  }

  expire() {
    for (const session of this.#sessions.values()) {
      if (this.now() - session.seen > this.idleMs) this.delete(session);
    }
  }

  delete(session) {
    session.abort?.abort();
    if ('credentials' in session) session.credentials = null;
    this.#sessions.delete(session.id);
  }

  close() {
    this.#closed = true;
    clearInterval(this.#reaper);
    for (const session of this.#sessions.values()) this.delete(session);
  }
}
