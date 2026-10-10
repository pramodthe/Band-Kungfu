import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./fixtures/three-loader.mjs', import.meta.url);
const [
  { createHero },
  { createCrowd },
  { createCombat },
  { createCamSim },
  { CHARS },
  { difficulty },
  { collect, on },
  { spawnPoint },
] = await Promise.all([
  import('../src/hero/hero.js'),
  import('../src/crowd/crowd.js'),
  import('../src/combat/combat.js'),
  import('../src/camera/camera.js'),
  import('../src/chars/index.js'),
  import('../src/core/difficulty.js'),
  import('../src/core/events.js'),
  import('../src/world/map.js'),
]);

for (const char of Object.values(CHARS)) {
  test(`${char.name} can defeat an officer, use Overclock and execute its own jump charge`, () => {
    const attacks = [];
    const [game, dispose] = collect(() => {
      const g = { mode: 'free', frame: 0, hitstop: 0, freeze: 0, diff: difficulty() };
      g.cam = createCamSim();
      g.hero = createHero(g);
      g.hero.reset({ ...spawnPoint('free'), yaw: 0, char });
      g.crowd = createCrowd(g, 0);
      g.combat = createCombat(g);
      g.musou = char.kit.createMusou(g);
      g.crowd.reset();
      g.combat.reset();
      g.musou.reset();
      on('attack:start', (event) => attacks.push(event.move));
      return g;
    });
    const step = (pressed = {}) => {
      const input = { mx: 0, my: 0, orbit: 0, tilt: 0, pressed, held: {} };
      game.cam.step(game, input);
      game.hero.step(input);
      game.combat.step();
      game.crowd.step();
      game.musou.step();
      game.frame++;
    };
    try {
      const officer = game.crowd.spawnOfficer({
        x: game.hero.x,
        z: game.hero.z + 1.7,
        name: 'Challenger',
        hp: 1,
        engaged: true,
      });
      game.crowd.cd[officer] = 120;
      step({ attack: true });
      for (let i = 0; i < 120; i++) step();
      assert.equal(game.hero.kos, 1);
      game.hero.musou = game.hero.musouMax;
      step({ musou: true });
      assert.equal(game.musou.active, true);
      for (let i = 0; i < 320; i++) step();
      assert.equal(game.musou.active, false);
      step({ jump: true });
      step();
      step({ charge: true });
      for (let i = 0; i < 120; i++) step();
      assert.ok(attacks.includes('jc'));
      assert.ok(game.hero.hp >= 1 && game.hero.hp <= game.hero.hpMax);
      for (const value of [game.hero.x, game.hero.y, game.hero.z, game.hero.anim.t])
        assert.ok(Number.isFinite(value));
    } finally {
      dispose();
    }
  });
}
