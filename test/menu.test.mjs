import test from 'node:test';
import assert from 'node:assert/strict';

async function setup(t, options) {
  let pad = {
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  };
  const frames = new Map(),
    calls = { move: 0, ok: 0, back: 0 };
  let next = 0;
  const window = new EventTarget();
  const restore = [];
  for (const [name, value] of Object.entries({
    document: { body: {}, getElementById: () => ({ style: {} }) },
    addEventListener: window.addEventListener.bind(window),
    navigator: { getGamepads: () => [null, pad] },
    requestAnimationFrame: (fn) => {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    restore.push(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  const { createNav } = await import('../src/ui/menu.js');
  const nav = createNav(
    { move: () => calls.move++, ok: () => calls.ok++, back: () => calls.back++ },
    options,
  );
  t.after(() => {
    nav.stop();
    restore.forEach((fn) => fn());
  });
  const tick = () => {
    const [id, fn] = frames.entries().next().value;
    frames.delete(id);
    fn(0);
  };
  return {
    nav,
    pad,
    calls,
    tick,
    disconnect: () => {
      pad = null;
    },
  };
}

test('menu navigation uses a controller outside slot zero and suppresses held confirm', async (t) => {
  const { nav, pad, calls, tick } = await setup(t);
  pad.buttons[0].pressed = true;
  nav.start();
  tick();
  assert.equal(calls.ok, 0);
  pad.buttons[0].pressed = false;
  tick();
  pad.buttons[0].pressed = true;
  pad.buttons[13].pressed = true;
  tick();
  assert.equal(calls.ok, 1);
  assert.equal(calls.move, 1);
});

test('simultaneous A and Start do not confirm twice while held', async (t) => {
  const { nav, pad, calls, tick } = await setup(t);
  nav.start();
  pad.buttons[0].pressed = pad.buttons[9].pressed = true;
  tick();
  tick();
  assert.equal(calls.ok, 1);
});

test('pause menu leaves Start to the gameplay pause toggle', async (t) => {
  const { nav, pad, calls, tick } = await setup(t, { startConfirms: false });
  nav.start();
  pad.buttons[9].pressed = true;
  tick();
  assert.equal(calls.ok, 0);
  pad.buttons[0].pressed = true;
  tick();
  assert.equal(calls.ok, 1);
});
