# Band Kungfu

**Band Kungfu** is a browser based voxel crowd brawler. Choose one of four fighters, battle through the Grand Arena, defeat 1,000 challengers and four masters, and claim the tournament title. Practice mode has endless waves.

The game uses Three.js and a fixed 60 Hz simulation. Its browser code is served as ES modules without a build step. Desktop keyboard, gamepad, and landscape touch controls are supported.

## Play locally

Requires Node.js 22.13 or newer in the 22.x line and a WebGL2 browser.

```sh
npm ci
npm start
```

Open [http://localhost:8000](http://localhost:8000). The server listens on `127.0.0.1`. You can play without a BAND account; the result screen only offers the BAND button when the relay is configured.

## BAND AI run analyst

![screenshot](https://raw.githubusercontent.com/pramodthe/Band-Kungfu/master/band.png)

A completed run can be sent to a [BAND](https://band.ai/) room from the result screen. The **Game Reporter** agent posts the run summary and mentions the **Run Analyst** agent, which replies with one specific suggestion for the next attempt. Sending requires an explicit button press. The browser does not receive agent API keys.

1. In BAND, create private Game Reporter and Run Analyst agents, then add both and your user to one room. Save the API keys when they are issued.
2. Copy `.env.example` to `.env`. Set `BAND_ROOM_ID`, `BAND_REPORTER_API_KEY`, `ANALYST_AGENT_ID`, and `ANALYST_API_KEY` with values from your BAND account. `.env` is ignored by Git.
3. Run `npm run band:analyst` in a second terminal while `npm start` serves the game.
4. Finish a tournament run, press **Send run to BAND**, and check the room for the analyst response.

The analyst uses an authenticated local Codex CLI by default. Run `codex login status` to check it. To use an OpenAI Platform API key instead, set `OPENAI_API_KEY`; `BAND_MODEL` selects its model. The analyst worker needs to be running to answer new messages.

The local relay validates a small run summary, rate limits submissions, and serves only allowlisted game files. The summary includes outcome, fighter, difficulty, K.O.s, time, HP, chain, damage taken, and rank. This integration runs on the local Node server; static hosting serves the game but cannot run the relay. A public BAND deployment needs a secured backend and its own abuse controls.

## Watch AI Play

Choose **Watch AI Play**, pick a difficulty and fighter, and watch a BAND-connected model choose tactics in practice mode. The current tactic appears above the arena. Click **Take over**, press **T**, or use movement/attack controls to take control immediately. **Let AI play** hands the fighter back. Esc, gamepad Start, and touch pause still pause the fight.

Create a separate **BAND Player** agent and a private BAND room containing only you and that agent. Add these values to your ignored `.env`:

```dotenv
PLAYER_AGENT_ID=
PLAYER_API_KEY=
PLAYER_ROOM_ID=
# Optional: otherwise uses BAND_MODEL with OPENAI_API_KEY, or the signed-in Codex CLI.
PLAYER_MODEL=
```

Run `npm ci` and `npm start`; the game server starts the player runtime on demand. There is no separate player worker to launch. Existing reporter/analyst settings are independent. Tactic summaries appear in your private player room; watching sends small game observations to the configured model provider and uses its normal model allowance or API billing.

The model chooses a target, engage/retreat/Overclock, and when to use a charge finisher. A local controller executes normal movement, combos and reflex dodges at 60 Hz. It never changes health, damage, position or score directly. While playing, decisions are requested at most once every eight seconds with one turn in flight. Tactics expire after 20 seconds; disconnected sessions expire after 30 seconds. Paused tabs send heartbeats without starting model turns. Pausing and takeover cancel pending model requests; resuming requests a fresh tactic. Rotating a phone to portrait pauses the fight and releases held touch controls; return to landscape and select Resume to continue. Without a valid model tactic, the AI waits.

This first version plays practice with a model planner and local reflex controller. Local development defaults to one AI visitor; public hosting defaults to three visitors sharing a fair model queue. Each visitor has its own session and facts, and takeover ends only that visitor's session. `?go=ai&char=saruabh` starts directly in this mode. BAND and model keys remain on the server. Static hosting cannot run this feature.

## Agent Arena

Choose **Agent Arena**, a difficulty and your fighter, then select **Wingmate** (BAND teammate), **Nemesis** (BAND villain), or both. You keep normal keyboard, gamepad and touch control of your fighter. Wingmate uses the green Crane model; Nemesis uses the magenta Dragon model. They fight in the practice arena, where your fighter cannot be knocked out. Each agent can be defeated; it stays down for that match.

Each role requires a distinct BAND agent and its own private room containing only that agent and your BAND user. Save the six `ALLY_*` and `BOSS_*` values from `.env.example` in your local `.env` or hosting environment. The server starts their SDK runtimes on demand; messages from other rooms cannot control the game. BAND receives small bounded combat snapshots and tactic summaries. These are visible to the game host; API keys are never included in BAND messages.

The model chooses **engage**, **flank**, **protect**, or **retreat**, with a valid opponent as its target. The 60 Hz executor handles legal movement, normal melee wind-ups, facing, reach, hit reactions and recovery. The teammate can strike enemies and the boss; the boss can strike you or your teammate. The agent cards show HP, connection state and the latest tactic reason. Without a valid tactic, the agent waits. **Dismiss agents**, leaving the battle, or closing the tab ends the model session. Rejoin from the title to configure a new session.

**Bring my own key** supports OpenAI and Groq with a configurable tool-calling model ID. The provider URLs are fixed: [OpenAI](https://api.openai.com/v1) and [Groq](https://console.groq.com/docs/openai). Defaults are `gpt-6-luna` and `openai/gpt-oss-20b`; model access depends on your provider account. Your key is sent over HTTPS to this game server, then only to the selected provider, and held in memory for the session. It is never persisted in browser storage, source files, logs, BAND rooms, or server environment. The key field is cleared after setup; the browser clears its request copy after the connection attempt. Local loopback development is allowed over HTTP. Failed BYOK requests never fall back to the host's key; dismiss and rejoin to correct the settings. Your provider's normal billing applies.

Agent Arena admits up to `AI_MAX_SESSIONS` visitors, each with up to two roles. Those roles fairly share one arena decision queue, with each role deciding at most every eight seconds. Tactics expire after 20 seconds. Paused tabs send heartbeats without starting model turns; disconnected sessions expire after 30 seconds and pending provider requests are aborted. Shared-model decisions use the same `AI_MAX_DECISIONS_PER_HOUR` allowance as Watch AI Play. BYOK sessions use their own key and a separate 120-decision hourly allowance per session. All limits reset on a server restart; BYOK allowances also reset when starting a new session. These are concurrency/usage bounds, not monetary billing caps.

## Public hosting

`render.yaml` configures a Free Node web service in Singapore. The build installs development tools, runs `npm run check`, then removes development dependencies before starting with `npm start`. Render checks `/healthz`. Deploy the `codex/public-hosting` branch of your fork. The server uses the hosting provider's `PORT`, and production binds to `0.0.0.0`; local development stays on loopback.

Set `NODE_ENV=production` and provide `OPENAI_API_KEY`, `PLAYER_AGENT_ID`, `PLAYER_API_KEY`, and `PLAYER_ROOM_ID` as server environment secrets. Production requires the API model key; it does not use a desktop CLI login. Set `BAND_MODEL` or `PLAYER_MODEL` to the desired API model. Visitors receive only game observations and tactics, never credentials. Tactic summaries are visible to the game host in the private BAND player room.

Anyone can play and request AI control. Up to `AI_MAX_SESSIONS` visitors (default 3 in production) share one model turn at a time, prioritizing visitors who have waited longest. `AI_MAX_DECISIONS_PER_HOUR` defaults to 120 model decisions per running server instance. When the allowance is exhausted, AI waits and manual play stays available. This is an application usage limit, not a monetary billing cap; limits and in-memory sessions reset on a server restart. Set appropriate provider-side limits for the model account.

The Free hosting plan can sleep after inactivity, so the first load may take longer. Use one server instance for this initial deployment; distributed sessions and autoscaling require persistent shared state.

## Tournament

| Round      | Area          | Goal        | Master                                                        |
| ---------- | ------------- | ----------- | ------------------------------------------------------------- |
| 1          | Opening Court | 200 K.O.s   | **Crane**: staff strikes and a floor storm                    |
| 2          | Inner Hall    | 450 K.O.s   | **Ox**: charges and shock waves                               |
| Semi-final | Dragon Ring   | 700 K.O.s   | **Viper**: falling attacks and reinforcements                 |
| Final      | Dragon Ring   | 1,000 K.O.s | **Dragon**: blade rushes, shadow copies, blackout, final form |

Red circles mark incoming area attacks. Leave the circle, dodge through the strike, or jump over travelling shock waves. Clearing a round heals you. Your team fights beside you.

| Fighter   | Style                                   | Overclock    |
| --------- | --------------------------------------- | ------------ |
| Arick     | Long range microphone and drone attacks | Sonic Boom   |
| Saruabh   | Fast selfie stick and laptop combos     | Viral Storm  |
| Vlad      | Heavy cart attacks and camera flashes   | Rush Hour    |
| Connector | Hops, spins, and copied moves           | Giga Connect |

## Controls

| Action    | Keyboard / mouse | Gamepad     | Touch           |
| --------- | ---------------- | ----------- | --------------- |
| Move      | WASD / arrows    | Left stick  | Left stick      |
| Attack    | J / left click   | X / □       | ATK             |
| Charge    | K / right click  | Y / △       | CHG             |
| Jump      | Space            | A / ×       | JMP             |
| Dodge     | L / Shift        | R1 / R2     | DDG             |
| Overclock | I                | B / ○       | OC              |
| Camera    | Mouse / Q / E    | Right stick | Drag right side |
| Recenter  | R                | L1 / L2     | —               |
| Pause     | Esc              | Start       | II              |

Tap attack for a combo. Press charge during a combo for a finisher, or use charge alone for a signature move. Every hit fills the Overclock gauge.

## Project layout and checks

- `index.html` and `src/ui/`: page shell, stylesheet, screens, HUD, and controls.
- `src/main.js`, `src/core/`, `src/hero/`, `src/chars/`, and `src/combat/`: game loop, fighters, and combat.
- `src/story/`, `src/world/`, and `src/crowd/`: tournament script, arena, and challengers.
- `serve.mjs` and `src/server/`: HTTP server, BAND relay, shared sessions, runtime lifecycle, and AI services.
- `agents/analyst.mjs`: BAND Run Analyst worker.
- `src/ai/`, `src/ui/ai-player.js`, and `src/server/player*.js`: AI observation, normal-input controller, takeover UI, sessions, and the on-demand BAND player runtime.

Run `npm run check` for lint, formatting, controller input, AI tactics/session ownership, runtime shutdown, per-fighter animation timing, tournament victory cleanup, relay, and server checks. Use `npm run format` to apply formatting. GitHub Actions runs the same checks on pushes and pull requests. See [the architecture guide](docs/architecture.md) for module boundaries and [move tables](docs/movesets.md) for combat data.

A live analyst exchange requires account credentials and the analyst worker. `?go=story&char=saruabh` starts a tournament run directly; `?go=free` starts practice.

## License

MIT; see [LICENSE](LICENSE). The original copyright notice is retained as required by that license. Bundled [Three.js](https://threejs.org/) is also MIT licensed.
