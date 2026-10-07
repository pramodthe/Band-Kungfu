import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/core/input.js';
import { collect } from '../src/core/events.js';

function setup(t) {
  const window = new EventTarget(), document = new EventTarget();
  const canvas = {}, menu = { hidden: true };
  document.getElementById = (id) => ({ c: canvas, menu })[id];
  let pads = [];
  for (const [name, value] of Object.entries({
    addEventListener: window.addEventListener.bind(window),
    dispatchEvent: window.dispatchEvent.bind(window),
    document, navigator: { getGamepads: () => pads },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
  }
  const [input, off] = collect(createInput);
  t.after(off);
  return { input, pads: (value) => { pads = value; } };
}

const pad = (pressed = []) => ({ connected: true, axes: [0.5, -0.5, 0, 0],
  buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i) })) });

test('a controller in a nonzero slot can move and attack', (t) => {
  const { input, pads } = setup(t);
  pads([null, pad([2])]);
  const frame = input.sample();
  assert.equal(frame.mx, 0.5);
  assert.equal(frame.my, 0.5);
  assert.equal(frame.pressed.attack, true);
});

test('Start produces one pause press until it is released', (t) => {
  const { input, pads } = setup(t);
  pads([pad([9])]);
  assert.equal(input.sample().pressed.pause, true);
  assert.equal(input.sample().pressed.pause, false);
  pads([pad()]); input.sample();
  pads([pad([9])]);
  assert.equal(input.sample().pressed.pause, true);
});

test('disconnecting a controller clears its previous button state', (t) => {
  const { input, pads } = setup(t);
  pads([pad([2])]);
  assert.equal(input.sample().pressed.attack, true);
  pads([]); input.sample();
  pads([pad([2])]);
  assert.equal(input.sample().pressed.attack, true);
});
