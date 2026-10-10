import { ST, CROWD, wrap } from '../crowd/crowd.js';
import { clampWalk } from '../world/map.js';

const alive = (c, i) => c.hp[i] > 0 && c.st[i] !== ST.OFF && c.st[i] !== ST.DEAD;
const hp = (n, max) => Math.max(0, Math.min(1, n / max));

export function arenaObservation(game, role, slots) {
  const c = game.crowd,
    i = slots[role],
    h = game.hero;
  const body = (j) => ({ x: c.x[j], z: c.z[j], hp: hp(c.hp[j], c.hpMax[j]) });
  const targets = [];
  if (role === 'boss') {
    if (!h.dead)
      targets.push({
        id: -1,
        x: h.x,
        z: h.z,
        hp: hp(h.hp, h.hpMax),
        kind: 'player',
        attacking: h.state === 'attack',
      });
    if (slots.ally >= 0 && alive(c, slots.ally))
      targets.push({
        id: slots.ally,
        ...body(slots.ally),
        kind: 'teammate',
        attacking: c.st[slots.ally] === ST.ATTACK,
      });
  } else
    for (let j = 0; j < c.N; j++)
      if (alive(c, j))
        targets.push({
          id: j,
          ...body(j),
          kind: j === slots.boss ? 'boss' : 'challenger',
          attacking: c.st[j] === ST.ATTACK,
        });
  targets.sort((a, b) => Math.hypot(a.x - c.x[i], a.z - c.z[i]) - Math.hypot(b.x - c.x[i], b.z - c.z[i]));
  return {
    role,
    frame: game.frame,
    self: body(i),
    player: { x: h.x, z: h.z, hp: hp(h.hp, h.hpMax) },
    teammate: role === 'boss' && slots.ally >= 0 && alive(c, slots.ally) ? body(slots.ally) : null,
    targets: targets.slice(0, 12),
  };
}

// This executor owns normal crowd movement / wind-up states. It cannot manufacture HP, teleport or skip recovery.
export function executeArenaTactic(game, i, role, plan, slots) {
  const c = game.crowd,
    h = game.hero,
    o = arenaObservation(game, role, slots);
  let target = o.targets.find((t) => t.id === plan?.targetId) || o.targets[0];
  const idle = () => {
    if (c.st[i] !== ST.GUARD) {
      c.st[i] = ST.GUARD;
      c.stT[i] = 0;
    }
    c.wind[i] = 0;
    return [0, 0];
  };
  if (!plan || !target || !alive(c, i)) return idle();
  // A committed attack retains its victim until recovery, so a new model turn cannot redirect a landed blow.
  if (c.st[i] === ST.ATTACK) target = o.targets.find((t) => t.id === c.agentTarget[i]);
  if (!target) return idle();
  const dx = target.x - c.x[i],
    dz = target.z - c.z[i],
    d = Math.hypot(dx, dz) || 1e-6;
  const turn = Math.max(-CROWD.turn / 60, Math.min(CROWD.turn / 60, wrap(Math.atan2(dx, dz) - c.yaw[i])));
  const W = game.diff.windup;
  if (c.st[i] !== ST.ATTACK || c.stT[i] < W - 8) c.yaw[i] += turn;
  if (c.st[i] === ST.ATTACK) {
    if (c.stT[i] === W) {
      c.wind[i] = 0;
      if (target.id === -1) game.combat.enemyStrike(i);
      else if (d < 2.6 && c.y[target.id] < 1.2 && Math.abs(wrap(Math.atan2(dx, dz) - c.yaw[i])) < 1.1) {
        if (game.combat.clash(i, target.id, role === 'ally' ? 28 : 22)) c.allyKos += role === 'ally' ? 1 : 0;
      }
    }
    if (c.stT[i] >= W + CROWD.recover) {
      c.st[i] = ST.GUARD;
      c.stT[i] = 0;
      c.cd[i] = role === 'boss' ? 85 : 55;
    }
    return [0, 0];
  }
  let vx = dx / d,
    vz = dz / d,
    speed = CROWD.run;
  if (plan.goal === 'retreat') {
    vx *= -1;
    vz *= -1;
    if (d > 9) return idle();
  } else if (plan.goal === 'protect' && role === 'ally' && Math.hypot(h.x - c.x[i], h.z - c.z[i]) > 5) {
    const gap = Math.hypot(h.x - c.x[i], h.z - c.z[i]);
    vx = (h.x - c.x[i]) / gap;
    vz = (h.z - c.z[i]) / gap;
  } else if (d <= 2.3) {
    if (!c.cd[i]) {
      c.st[i] = ST.ATTACK;
      c.stT[i] = 0;
      c.wind[i] = 1;
      c.feint[i] = 0;
      c.agentTarget[i] = target.id;
    } else return idle();
    return [0, 0];
  } else if (plan.goal === 'flank' && d < 7) {
    const side = role === 'boss' ? -0.8 : 0.8;
    [vx, vz] = [(vx - vz * side) / Math.hypot(1, side), (vz + vx * side) / Math.hypot(1, side)];
  }
  c.st[i] = ST.ADVANCE;
  // Look ahead and choose an open direction; final integration and crowd separation still clamp to the map.
  for (const a of [0, 0.8, -0.8, 1.4, -1.4]) {
    const x = vx * Math.cos(a) - vz * Math.sin(a),
      z = vz * Math.cos(a) + vx * Math.sin(a);
    const q = clampWalk(c.x[i] + x * 0.8, c.z[i] + z * 0.8, -1);
    if (Math.hypot(q[0] - c.x[i] - x * 0.8, q[1] - c.z[i] - z * 0.8) < 0.15) return [x * speed, z * speed];
  }
  return [0, 0];
}
