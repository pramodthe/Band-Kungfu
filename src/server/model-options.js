import OpenAI from 'openai';

// The BAND adapter uses Chat Completions; GPT-6 Luna requires no reasoning for function calls on this endpoint.
export function apiModelOptions(model, apiKey, makeClient = (key) => new OpenAI({ apiKey: key })) {
  const options = { openAIModel: model, apiKey };
  if (model === 'gpt-6-luna' || model.startsWith('gpt-6-luna-')) options.clientFactory = async () => {
    const client = makeClient(apiKey);
    return { chat: { completions: { create: (params, requestOptions) =>
      client.chat.completions.create({ ...params, reasoning_effort: 'none' }, requestOptions) } } };
  };
  return options;
}
