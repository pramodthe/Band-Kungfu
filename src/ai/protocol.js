// Small shared contract: observations are facts; tactics can only select normal controls.
const FIGHTERS = new Set(['arick', 'saruabh', 'vlad', 'connector']);
const GOALS = new Set(['engage', 'retreat', 'overclock']);
const number = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min, max) => Number.isInteger(n) && number(n, min, max);
const point = (p) => p && number(p.x, -240, 240) && number(p.z, -240, 240);

export function parseObservation(o) {
  if (
    !o ||
    o.mode !== 'free' ||
    !FIGHTERS.has(o.char) ||
    !integer(o.frame, 0, 1e9) ||
    !point(o.hero) ||
    !number(o.hero.hp, 0, 1) ||
    !number(o.hero.gauge, 0, 1) ||
    !integer(o.kos, 0, 1e7) ||
    !Array.isArray(o.enemies) ||
    o.enemies.length > 12
  )
    throw Error('Invalid observation');
  const enemies = o.enemies.map((e) => {
    if (
      !point(e) ||
      !integer(e.id, 0, 2005) ||
      !number(e.hp, 0, 1) ||
      typeof e.officer !== 'boolean' ||
      typeof e.attacking !== 'boolean'
    )
      throw Error('Invalid enemy');
    return { id: e.id, x: e.x, z: e.z, hp: e.hp, officer: e.officer, attacking: e.attacking };
  });
  return {
    mode: 'free',
    char: o.char,
    frame: o.frame,
    kos: o.kos,
    hero: { x: o.hero.x, z: o.hero.z, hp: o.hero.hp, gauge: o.hero.gauge },
    enemies,
  };
}

export function parseTactic(p) {
  if (
    !p ||
    !GOALS.has(p.goal) ||
    !(p.targetId === null || integer(p.targetId, 0, 2005)) ||
    !integer(p.finishAfter, 1, 5) ||
    typeof p.useOverclock !== 'boolean' ||
    typeof p.reason !== 'string' ||
    !p.reason.trim() ||
    p.reason.length > 160
  )
    throw Error('Invalid tactic');
  return {
    goal: p.goal,
    targetId: p.targetId,
    finishAfter: p.finishAfter,
    useOverclock: p.useOverclock,
    reason: p.reason.trim(),
  };
}
