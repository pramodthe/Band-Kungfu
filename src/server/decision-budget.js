export function createDecisionBudget(max = 120, now = Date.now) {
  let start = now(), used = 0;
  const has = () => { if (now() - start >= 3600000) { start = now(); used = 0; } return used < max; };
  return { has, take() { if (!has()) return false; used++; return true; } };
}
