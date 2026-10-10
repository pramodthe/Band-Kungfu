/** Serializes provider turns; shutting down disables follow-up work without waiting on an uncooperative provider. */
export class DecisionQueue {
  #busy = false;
  #closed = false;

  constructor(onIdle) {
    this.onIdle = onIdle;
  }

  get busy() {
    return this.#busy;
  }

  run(task, { onSuccess, onError, onSettled = () => {} }) {
    if (this.#busy || this.#closed) return false;
    this.#busy = true;
    Promise.resolve()
      .then(task)
      .then(onSuccess)
      .catch(onError)
      .finally(() => {
        this.#busy = false;
        onSettled();
        if (!this.#closed) this.onIdle();
      });
    return true;
  }

  close() {
    this.#closed = true;
  }
}
