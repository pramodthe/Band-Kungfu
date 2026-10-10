import { GameServer } from './src/server/game-server.js';

const gameServer = new GameServer({ port: process.argv[2] });
try {
  const address = await gameServer.listen();
  console.log(`Band Kungfu listening on ${gameServer.host}:${address.port}`);
} catch (error) {
  await gameServer.close();
  console.error(`Could not start the game server: ${error.code || 'unknown error'}`);
  process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => gameServer.close().finally(() => process.exit(0)));
}
