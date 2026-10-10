/** One connection per BAND identity, including when several visitors join at once. */
export class RuntimePool {
  #runtimes = new Map();
  #connecting = new Map();
  #closed = false;

  constructor(factory) {
    this.factory = factory;
  }

  ready(key) {
    return this.#runtimes.get(key);
  }

  async get(key) {
    if (this.#closed) throw Error('Runtime pool is closed');
    if (this.#runtimes.has(key)) return this.#runtimes.get(key);
    if (!this.#connecting.has(key)) {
      const pending = Promise.resolve()
        .then(() => this.factory(key))
        .then(async (runtime) => {
          if (this.#closed) {
            await runtime.close();
            throw Error('Runtime pool is closed');
          }
          this.#runtimes.set(key, runtime);
          return runtime;
        })
        .finally(() => this.#connecting.delete(key));
      this.#connecting.set(key, pending);
    }
    return this.#connecting.get(key);
  }

  async close() {
    this.#closed = true;
    await Promise.allSettled([...this.#connecting.values()]);
    await Promise.allSettled([...this.#runtimes.values()].map((runtime) => runtime.close()));
    this.#runtimes.clear();
  }
}
