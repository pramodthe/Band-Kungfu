import test from 'node:test';
import assert from 'node:assert/strict';
import { playerTools } from '../src/server/player-runtime.js';

test('player tool wrapper preserves frozen SDK methods and filters platform tools', () => {
  const sdk = Object.freeze({
    name: 'SDK',
    sendMessage() {
      return this.name;
    },
    getToolSchemas() {
      return [{ function: { name: 'band_send_message' } }, { function: { name: 'band_no_reply' } }];
    },
    executeToolCall(name) {
      return name;
    },
  });
  const scoped = playerTools(sdk);
  assert.equal(scoped.sendMessage(), 'SDK'); // No frozen-Proxy invariant error or unbound method.
  assert.deepEqual(scoped.getToolSchemas('openai'), [{ function: { name: 'band_no_reply' } }]);
  assert.equal(scoped.executeToolCall('band_no_reply', {}), 'band_no_reply');
  assert.throws(() => scoped.executeToolCall('band_add_participant', {}), /Only game tactics/);
  assert.throws(() => scoped.executeToolCall('band_send_message', {}), /Only game tactics/);
});
