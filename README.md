# Band Kungfu

**Band Kungfu** is a browser based voxel crowd brawler. Choose one of four fighters, battle through the Grand Arena, defeat 1,000 challengers and four masters, and claim the tournament title. Practice mode has endless waves.

The game uses Three.js and a fixed 60 Hz simulation. Its browser code is served as ES modules without a build step. Desktop keyboard, gamepad, and landscape touch controls are supported.

## Play locally

Requires Node.js 22.9 or newer and a WebGL2 browser.

```sh
npm ci
npm start
```

Open [http://localhost:8000](http://localhost:8000). The server listens on `127.0.0.1`. You can play without a BAND account; the result screen only offers the BAND button when the relay is configured.

## BAND AI run analyst

A completed run can be sent to a [BAND](https://band.ai/) room from the result screen. The **Game Reporter** agent posts the run summary and mentions the **Run Analyst** agent, which replies with one specific suggestion for the next attempt. Sending requires an explicit button press. The browser does not receive agent API keys.

1. In BAND, create private Game Reporter and Run Analyst agents, then add both and your user to one room. Save the API keys when they are issued.
2. Copy `.env.example` to `.env`. Set `BAND_ROOM_ID`, `BAND_REPORTER_API_KEY`, `ANALYST_AGENT_ID`, and `ANALYST_API_KEY` with values from your BAND account. `.env` is ignored by Git.
3. Run `npm run band:analyst` in a second terminal while `npm start` serves the game.
4. Finish a tournament run, press **Send run to BAND**, and check the room for the analyst response.

The analyst uses an authenticated local Codex CLI by default. Run `codex login status` to check it. To use an OpenAI Platform API key instead, set `OPENAI_API_KEY`; `BAND_MODEL` selects its model. The analyst worker needs to be running to answer new messages.

The local relay validates a small run summary, rate limits submissions, and serves only allowlisted game files. The summary includes outcome, fighter, difficulty, K.O.s, time, HP, chain, damage taken, and rank. This integration runs on the local Node server; static hosting serves the game but cannot run the relay. A public BAND deployment needs a secured backend and its own abuse controls.

## Tournament

| Round | Area | Goal | Master |
| --- | --- | --- | --- |
| 1 | Opening Court | 200 K.O.s | **Crane**: staff strikes and a floor storm |
| 2 | Inner Hall | 450 K.O.s | **Ox**: charges and shock waves |
| Semi-final | Dragon Ring | 700 K.O.s | **Viper**: falling attacks and reinforcements |
| Final | Dragon Ring | 1,000 K.O.s | **Dragon**: blade rushes, shadow copies, blackout, final form |

Red circles mark incoming area attacks. Leave the circle, dodge through the strike, or jump over travelling shock waves. Clearing a round heals you. Your team fights beside you.

| Fighter | Style | Overclock |
| --- | --- | --- |
| Arick | Long range microphone and drone attacks | Sonic Boom |
| Saruabh | Fast selfie stick and laptop combos | Viral Storm |
| Vlad | Heavy cart attacks and camera flashes | Rush Hour |
| Connector | Hops, spins, and copied moves | Giga Connect |

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Left stick |
| Attack | J / left click | X / □ | ATK |
| Charge | K / right click | Y / △ | CHG |
| Jump | Space | A / × | JMP |
| Dodge | L / Shift | R1 / R2 | DDG |
| Overclock | I | B / ○ | OC |
| Camera | Mouse / Q / E | Right stick | Drag right side |
| Recenter | R | L1 / L2 | — |
| Pause | Esc | Start | II |

Tap attack for a combo. Press charge during a combo for a finisher, or use charge alone for a signature move. Every hit fills the Overclock gauge.

## Project layout and checks

- `index.html` and `src/ui/`: page, screens, HUD, and controls.
- `src/main.js`, `src/core/`, `src/hero/`, `src/chars/`, and `src/combat/`: game loop, fighters, and combat.
- `src/story/`, `src/world/`, and `src/crowd/`: tournament script, arena, and challengers.
- `serve.mjs` and `src/server/band.js`: local server and opt-in BAND relay.
- `agents/analyst.mjs`: BAND Run Analyst worker.

Run `npm test` for the relay and server checks. A live BAND exchange also requires account credentials and the analyst worker. `?go=story&char=saruabh` starts a tournament run directly; `?go=free` starts practice.

## License

MIT; see [LICENSE](LICENSE). The original copyright notice is retained as required by that license. Bundled [Three.js](https://threejs.org/) is also MIT licensed.
