import { Agent, CodexAdapter, OpenAIAdapter, loadAgentConfigFromEnv } from '@band-ai/sdk';
import { renderSystemPrompt } from '@band-ai/sdk/runtime';
import { resolve } from 'node:path';

const guidance = `A game reporter sends structured run summaries. Analyze only the supplied fields. Give one specific tactical change for the player's next attempt and a short reason based on the numbers. If the data cannot support a diagnosis, say so. Never claim to have seen gameplay footage or hidden events. Reply to the reporter in the same Band room using band_send_message with the reporter's exact @handle from the participant list. Do not post thought or progress events. Keep the reply under 100 words.`;
const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map((level) => [level, (message, context) => {
  if (level !== 'debug' || process.env.BAND_DEBUG) {
    const safe = Object.fromEntries(['roomId', 'topic', 'messageId', 'status', 'reason'].filter((key) => context?.[key] != null).map((key) => [key, context[key]]));
    console[level](`BAND ${level}: ${message}`, safe);
  }
}]));
const adapter = process.env.OPENAI_API_KEY
  ? new OpenAIAdapter({
      openAIModel: process.env.BAND_MODEL || 'gpt-4.1-mini',
      apiKey: process.env.OPENAI_API_KEY,
      systemPrompt: renderSystemPrompt({
        agentName: 'Run Analyst',
        agentDescription: 'a game performance analyst for Band Kungfu',
        customSection: guidance,
      }),
    })
  : new CodexAdapter({
      logger,
      config: {
        cwd: resolve(import.meta.dirname, '..'),
        approvalPolicy: 'never', sandboxMode: 'read-only',
        reasoningEffort: 'low', reasoningSummary: 'none',
        networkAccessEnabled: false, webSearchMode: 'disabled',
        enableLocalCommands: false,
        customSection: guidance,
      },
    });

const agent = Agent.create({
  adapter,
  config: loadAgentConfigFromEnv({ prefix: 'ANALYST' }),
  agentConfig: { autoSubscribeExistingRooms: true },
  logger,
});

console.log('Starting Run Analyst on BAND…');
await agent.start();
console.log(`Run Analyst state: ${agent.state.status}`);
await agent.run();
