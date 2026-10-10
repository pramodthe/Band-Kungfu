import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPlayerRuntime, playerTools } from '../src/server/player-runtime.js';

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

test('the BAND Player adapter aborts its model request, suppresses cancelled replies, and plays the next turn', async () => {
  const sent = [],
    failures = [];
  let providerSignal, started;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  let calls = 0;
  const tactic = {
    goal: 'engage',
    targetId: null,
    finishAfter: 3,
    useOverclock: false,
    reason: 'Close the distance.',
  };
  const runtime = await createPlayerRuntime(
    { OPENAI_API_KEY: 'test-key' },
    {
      makeClient: () => ({
        chat: {
          completions: {
            create: (params, options) => {
              calls++;
              if (calls === 1) {
                providerSignal = options.signal;
                started();
                return new Promise((_resolve, reject) => {
                  providerSignal.addEventListener('abort', () => reject(providerSignal.reason), {
                    once: true,
                  });
                });
              }
              if (calls === 2) {
                const requestId = JSON.stringify(params.messages).match(
                  /requestId\\?"\s*:\s*\\?"([\w-]+)/,
                )?.[1];
                assert.ok(requestId);
                return {
                  choices: [
                    {
                      message: {
                        tool_calls: [
                          {
                            id: 'call-1',
                            type: 'function',
                            function: {
                              name: 'set_tactic',
                              arguments: JSON.stringify({ requestId, ...tactic }),
                            },
                          },
                        ],
                      },
                    },
                  ],
                };
              }
              return { choices: [{ message: { content: 'Close the distance.' } }] };
            },
          },
        },
      }),
      roomFactory: ({ adapter }) => ({
        id: 'room',
        start: () => adapter.onStarted('Player', 'Test player'),
        bootstrap: (id, content) =>
          adapter.onEvent({
            roomId: 'room',
            message: {
              id,
              content: JSON.stringify(content),
              senderId: 'owner',
              senderName: 'owner-handle',
              senderType: 'User',
              messageType: 'text',
            },
            tools: Object.freeze({
              getToolSchemas: () => [],
              executeToolCall() {},
              sendMessage: async (...args) => sent.push(args),
              sendFailure: async (failure) => failures.push(failure),
            }),
          }),
        close: () => adapter.onRuntimeStop(),
      }),
    },
  );
  const abort = new AbortController();
  const pending = runtime.decide({ id: randomUUID(), signal: abort.signal, observation: { enemies: [] } });
  await entered;
  abort.abort();
  await assert.rejects(pending, /abort/i);
  assert.equal(providerSignal.aborted, true);
  assert.deepEqual(sent, []);
  assert.deepEqual(failures, []);
  const plan = await runtime.decide({
    id: randomUUID(),
    signal: new AbortController().signal,
    observation: { enemies: [] },
  });
  assert.deepEqual(plan, tactic);
  assert.equal(calls, 3);
  assert.deepEqual(sent, [['Close the distance.', [{ id: 'owner', handle: 'owner-handle' }]]]);
  await runtime.close();
});
