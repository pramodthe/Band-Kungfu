import test from 'node:test';
import assert from 'node:assert/strict';
import { apiModelOptions } from '../src/server/model-options.js';

test('Luna Chat Completions tool calls use supported reasoning and preserve cancellation', async () => {
  let received;
  const options = apiModelOptions('gpt-6-luna', 'test-key', () => ({
    chat: {
      completions: {
        create: (params, requestOptions) => {
          received = { params, requestOptions };
          return { choices: [] };
        },
      },
    },
  }));
  const client = await options.clientFactory(),
    request = { model: 'gpt-6-luna', tools: [{ type: 'function' }] };
  const signal = new AbortController().signal;
  await client.chat.completions.create(request, { signal });
  assert.equal(received.params.reasoning_effort, 'none');
  assert.equal(received.requestOptions.signal, signal);
  assert.equal(request.reasoning_effort, undefined);
  assert.deepEqual(received.params.tools, request.tools);
});

test('other configured models retain their original adapter options', () => {
  assert.deepEqual(apiModelOptions('gpt-4.1-mini', 'test-key'), {
    openAIModel: 'gpt-4.1-mini',
    apiKey: 'test-key',
  });
});

test('player cancellation and the SDK deadline both reach every model request', async () => {
  for (const model of ['gpt-6-luna', 'gpt-4.1-mini']) {
    for (const cancelJob of [true, false]) {
      const job = new AbortController(),
        deadline = new AbortController();
      let received;
      const options = apiModelOptions(
        model,
        'test-key',
        () => ({
          chat: {
            completions: {
              create: (_params, request) => {
                received = request;
              },
            },
          },
        }),
        () => job.signal,
      );
      const client = await options.clientFactory();
      await client.chat.completions.create({ model }, { signal: deadline.signal, timeout: 25000 });
      assert.equal(received.timeout, 25000);
      assert.equal(received.signal.aborted, false);
      (cancelJob ? job : deadline).abort();
      assert.equal(received.signal.aborted, true);
      job.abort();
      assert.throws(() => client.chat.completions.create({ model }), /abort/i);
    }
  }
});
