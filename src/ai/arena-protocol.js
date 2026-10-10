export const ARENA_ROLES = ['ally', 'boss'];
export const ARENA_GOALS = ['engage', 'flank', 'protect', 'retreat'];
const bounded = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
const fighter = (p) => p && bounded(p.x, -240, 240) && bounded(p.z, -240, 240) && bounded(p.hp, 0, 1);
const targetId = (n) => Number.isInteger(n) && n >= -1 && n <= 2045;
const facts = (p) => ({ x: p.x, z: p.z, hp: p.hp });

export function parseArenaObservation(o, role) {
  if (!ARENA_ROLES.includes(role) || o?.role !== role || !Number.isInteger(o.frame) || !bounded(o.frame, 0, 1e9) ||
      !fighter(o.self) || !fighter(o.player) || !Array.isArray(o.targets) || o.targets.length > 12 ||
      (o.teammate !== null && !fighter(o.teammate))) throw Error('Invalid arena observation');
  const ids = new Set();
  const targets = o.targets.map(t => {
    if (!fighter(t) || !targetId(t.id) || ids.has(t.id) || typeof t.attacking !== 'boolean' ||
        !['player', 'teammate', 'boss', 'challenger'].includes(t.kind) ||
        (role === 'ally' && !['boss', 'challenger'].includes(t.kind)) ||
        (role === 'boss' && !['player', 'teammate'].includes(t.kind)) ||
        (t.kind === 'player' ? t.id !== -1 : t.id < 0)) throw Error('Invalid arena target');
    ids.add(t.id);
    return { id: t.id, ...facts(t), kind: t.kind, attacking: t.attacking };
  });
  return { role, frame: o.frame, self: facts(o.self), player: facts(o.player),
    teammate: o.teammate === null ? null : facts(o.teammate), targets };
}

export function parseArenaTactic(t) {
  if (!t || !ARENA_GOALS.includes(t.goal) || !(t.targetId === null || targetId(t.targetId)) ||
      typeof t.reason !== 'string' || !t.reason.trim() || t.reason.length > 160) throw Error('Invalid arena tactic');
  return { goal: t.goal, targetId: t.targetId, reason: t.reason.trim() };
}
