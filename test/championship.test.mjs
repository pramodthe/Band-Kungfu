import test from 'node:test';
import assert from 'node:assert/strict';
import { BEATS, script } from '../src/story/championship.js';
import { ST } from '../src/crowd/crowd.js';

test('victory clears Dragon blackout and pending hazard visuals', () => {
  let frame = 0;
  const crowd = { hp: [2100], hpMax: [2100], st: [ST.GUARD], cd: [40], x: [0], z: [0], vx: [0], vz: [0] };
  const game = { crowd, hero: { x: 0, z: 4, y: 0, yaw: 0, hurt: () => false }, diff: { dmg: 1 } };
  const stage = script(game, {
    t: () => frame, officer: (key) => key === 'dragon' ? 0 : -1,
    dead: () => false, squad() {}, fire() {}, model() {},
  });
  stage.step();
  for (const hp of [0.74, 0.49]) { crowd.hp[0] = 2100 * hp; frame++; stage.step(); }
  frame += 60; stage.step();
  assert.equal(stage.fx.dark, true);
  assert.ok(stage.fx.warn.length > 0);
  assert.ok(stage.fx.drops.length > 0);

  const victory = BEATS.find((beat) => beat.win);
  stage.cue(victory.cue);
  assert.equal(stage.fx.dark, false);
  assert.deepEqual(stage.fx.warn, []);
  assert.deepEqual(stage.fx.drops, []);
  assert.deepEqual(stage.fx.rings, []);
});
