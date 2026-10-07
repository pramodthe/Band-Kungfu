// Fast execution of the model's tactic. Returns the same input frames as a human controller.
// Never changes HP, position, enemies, damage, gauge or score.
const OFF = 0, ATTACK = 4, DEAD = 10;
const live = (c, i) => i >= 0 && i < c.N && c.st[i] !== OFF && c.st[i] !== DEAD && c.hp[i] > 0;
const empty = () => ({ mx: 0, my: 0, orbit: 0, tilt: 0, pressed: {}, held: {} });

export function observation(game) {
  const h = game.hero, c = game.crowd, enemies = [];
  for (let i = 0; i < c.N; i++) if (live(c, i)) enemies.push({ id: i, x: c.x[i], z: c.z[i],
    hp: Math.max(0, c.hp[i] / c.hpMax[i]), officer: c.type[i] === 1, attacking: c.st[i] === ATTACK });
  enemies.sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z));
  return { mode: game.mode, char: h.char.id, frame: game.frame, kos: h.kos,
    hero: { x: h.x, z: h.z, hp: h.hp / h.hpMax, gauge: h.musou / h.musouMax }, enemies: enemies.slice(0, 12) };
}

export function createAiController({ walk = (x, z) => [x, z] } = {}) {
  let lastAttack = -1000, lastDodge = -1000, lastMu = -1000;
  return {
    reset() { lastAttack = lastDodge = lastMu = -1000; },
    sample(game, tactic) {
      const inp = empty();
      if (!tactic || game.mode !== 'free' || game.hero.dead) return inp;
      const h = game.hero, c = game.crowd, f = game.frame;
      let target = live(c, tactic.targetId ?? -1) ? tactic.targetId : -1, nearest = Infinity, danger = -1;
      for (let i = 0; i < c.N; i++) if (live(c, i)) {
        const d = Math.hypot(c.x[i] - h.x, c.z[i] - h.z);
        if (target < 0 && d < nearest) nearest = d;
        if (c.st[i] === ATTACK && d < 3.2 && c.stT[i] >= game.diff.windup - 14 && c.stT[i] <= game.diff.windup) danger = i;
      }
      if (target < 0) for (let i = 0; i < c.N; i++) if (live(c, i) && Math.hypot(c.x[i] - h.x, c.z[i] - h.z) === nearest) { target = i; break; }
      if (target < 0) return inp;
      let dx = c.x[target] - h.x, dz = c.z[target] - h.z, distance = Math.hypot(dx, dz) || 1;
      dx /= distance; dz /= distance;
      if (danger >= 0 && h.grounded && f - lastDodge >= 35 && h.state !== 'musou') {
        dx = h.x - c.x[danger]; dz = h.z - c.z[danger]; const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len; inp.pressed.dodge = true; lastDodge = f;
      } else if (h.state !== 'musou' && h.state !== 'hurt') {
        if ((tactic.useOverclock || tactic.goal === 'overclock') && game.musou.ready() && distance < 5 && f - lastMu >= 240) {
          inp.pressed.musou = true; lastMu = f;
        } else if (tactic.goal !== 'retreat' && distance < 3.0 && f - lastAttack >= 12) {
          const m = h.move && h.kit.moves[h.move], normal = /^n[1-6]$/.test(h.move || '');
          if (!m || (normal && h.moveT >= (m.branch || m.cancel) - 3)) {
            inp.pressed[normal && Number(h.move[1]) >= tactic.finishAfter ? 'charge' : 'attack'] = true;
            lastAttack = f;
          }
        }
      }
      const retreat = tactic.goal === 'retreat';
      if (retreat && !inp.pressed.dodge) { dx = -dx; dz = -dz; }
      if (inp.pressed.dodge || (retreat ? distance < 8 : distance > 2.1)) {
        // Choose an open step around props instead of pushing indefinitely into an obstacle.
        let best = -Infinity, bx = dx, bz = dz;
        for (const angle of [0, -0.7, 0.7, -1.3, 1.3]) {
          const x = dx * Math.cos(angle) - dz * Math.sin(angle), z = dx * Math.sin(angle) + dz * Math.cos(angle);
          const [wx, wz] = walk(h.x + x * 1.2, h.z + z * 1.2);
          const deviation = Math.hypot(wx - h.x - x * 1.2, wz - h.z - z * 1.2);
          const score = x * dx + z * dz - deviation * 5;
          if (score > best) { best = score; bx = x; bz = z; }
        }
        const sn = Math.sin(game.cam.yaw), cs = Math.cos(game.cam.yaw);
        inp.mx = -bx * cs + bz * sn; inp.my = bx * sn + bz * cs;
      }
      return inp;
    },
  };
}
