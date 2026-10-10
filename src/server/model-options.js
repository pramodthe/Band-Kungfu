import OpenAI from 'openai';

// The BAND adapter uses Chat Completions; GPT-6 Luna requires no reasoning for function calls on this endpoint.
export function apiModelOptions(model, apiKey, makeClient = (key) => new OpenAI({ apiKey: key }), getSignal) {
  const options = { openAIModel: model, apiKey };
  const luna = model === 'gpt-6-luna' || model.startsWith('gpt-6-luna-');
  if (luna || getSignal)
    options.clientFactory = async () => {
      const client = makeClient(apiKey);
      return {
        chat: {
          completions: {
            create: (params, requestOptions) => {
              const signal = getSignal?.();
              signal?.throwIfAborted();
              return client.chat.completions.create(
                luna ? { ...params, reasoning_effort: 'none' } : params,
                signal
                  ? {
                      ...requestOptions,
                      signal: AbortSignal.any([
                        signal,
                        ...(requestOptions?.signal ? [requestOptions.signal] : []),
                      ]),
                    }
                  : requestOptions,
              );
            },
          },
        },
      };
    };
  return options;
}
