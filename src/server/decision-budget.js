export class DecisionBudget {
  #startedAt;
  #used = 0;

  constructor(max = 120, now = Date.now) {
    this.max = max;
    this.now = now;
    this.#startedAt = now();
  }

  has() {
    if (this.now() - this.#startedAt >= 3_600_000) {
      this.#startedAt = this.now();
      this.#used = 0;
    }
    return this.#used < this.max;
  }

  take() {
    if (!this.has()) return false;
    this.#used++;
    return true;
  }
}

export function createDecisionBudget(max, now) {
  return new DecisionBudget(max, now);
}
