import { Agent } from '@band-ai/sdk';

/** Connects one game agent to a room shared only with its human owner. */
export class PrivateBandRoom {
  #agent;
  #apiKey;
  #owner;
  constructor({
    env,
    prefix,
    adapter,
    logger,
    maxContextMessages = 1,
    fetchImpl = globalThis.fetch,
    agentFactory = Agent.create,
  }) {
    this.id = env[`${prefix}_ROOM_ID`];
    this.agentId = env[`${prefix}_AGENT_ID`];
    this.#apiKey = env[`${prefix}_API_KEY`];
    this.fetch = fetchImpl;
    this.#agent = agentFactory({
      agentId: this.agentId,
      apiKey: this.#apiKey,
      adapter,
      logger,
      agentConfig: { autoSubscribeExistingRooms: true },
      roomFilter: (room) => room.id === this.id,
      sessionConfig: { maxContextMessages },
    });
  }

  async start() {
    try {
      await this.#agent.start();
      const response = await this.fetch(
        `https://app.band.ai/api/v1/agent/chats/${encodeURIComponent(this.id)}/participants`,
        {
          headers: { 'X-API-Key': this.#apiKey },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) throw Error('Private agent room is unavailable');
      const { data } = await response.json();
      if (
        !Array.isArray(data) ||
        data.filter((participant) => participant.type === 'User').length !== 1 ||
        data.some((participant) => participant.type === 'Agent' && participant.id !== this.agentId)
      ) {
        throw Error('Use a private room with only the game agent and its human owner');
      }
      this.#owner = data.find((participant) => participant.type === 'User');
      if (!this.#owner.id || !this.#owner.handle) throw Error('The private room needs its human owner');
    } catch (error) {
      await this.close().catch(() => {});
      throw error;
    }
  }

  async bootstrap(id, content) {
    await this.#agent.bootstrapRoomMessage(this.id, {
      id,
      roomId: this.id,
      senderId: this.#owner.id,
      senderType: 'User',
      senderName: this.#owner.handle,
      messageType: 'text',
      metadata: {},
      createdAt: new Date(),
      content: JSON.stringify(content),
    });
  }

  async close() {
    await this.#agent.stop(1_000);
  }
}
