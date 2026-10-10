import test from 'node:test';
import assert from 'node:assert/strict';
import { verticalScale, jumpChargeAuraActive } from '../src/hero/animation-effects.js';
import { MOVES as arick } from '../src/chars/arick/moves.js';
import { MOVES as saruabh } from '../src/chars/saruabh/moves.js';
import { MOVES as vlad } from '../src/chars/vlad/moves.js';
import { MOVES as connector } from '../src/chars/connector/moves.js';

test('each fighter compresses on its own jump-charge landing frame', () => {
  for (const moves of [arick, saruabh, vlad, connector]) {
    const move = moves.jc;
    assert.ok(Math.abs(verticalScale({ id: 'jc', t: move.landFrame / move.frames }, move) - 0.78) < 1e-9);
    assert.equal(verticalScale({ id: 'jc', t: (move.landFrame - 1) / move.frames }, move), 1);
    assert.equal(verticalScale({ id: 'jc', t: (move.landFrame + 10) / move.frames }, move), 1);
  }
  assert.equal(verticalScale({ id: 'jc', t: 0.64 }, arick.jc), 1);
  assert.equal(verticalScale({ id: 'jc', t: 0.64 }, saruabh.jc), 0.78);
});

test('jump-charge auras end at the active fighter plunge, not the removed spear fighter timing', () => {
  for (const moves of [arick, saruabh, vlad, connector]) {
    const hero = { kit: { moves }, move: 'jc', moveT: moves.jc.plunge[0] + 1 };
    assert.equal(jumpChargeAuraActive(hero), true);
    hero.moveT++;
    assert.equal(jumpChargeAuraActive(hero), false);
    hero.move = 'n1';
    assert.equal(jumpChargeAuraActive(hero), false);
  }
});
