# Architecture and maintenance

Band Kungfu is a browser game served by a small Node.js application. Browser code uses native ES modules and bundled Three.js; there is no frontend build step. Node.js 22.13 or newer in the 22.x line is required for the development tools.

## Simulation and rendering

`src/main.js` coordinates screens and a fixed 60 Hz simulation. Hero, combat, crowd, Overclock and story modules advance only during simulation steps. Views read simulation state; they own visual animation, geometry and materials. Keep this boundary when adding gameplay.

Crowd state uses typed arrays, which keep thousands of soldiers inexpensive to update. Pure helpers and module factories are appropriate here. Stateful classes own backend resources and request lifecycles; avoid allocating objects or creating inheritance trees inside the frame loop.

`src/chars/index.js` registers the four fighters. Each kit supplies moves, clips, geometry, secondary motion, effects and Overclock factories. Shared geometry and spring chains live in `src/chars/shared/`; the [move-table contract](movesets.md) describes combat timing. Shared jump-charge effects read the selected kit rather than a legacy character's move table.

`index.html` contains the page shell and import map. `src/ui/styles.css` owns application styles; `src/ui/boot.js` shows startup failures. Screens retain the existing factory contract so the main flow can enter, exit and render them consistently.

## AI boundary

Observation parsers accept bounded facts and discard unrelated fields. Models return validated tactics; local executors apply normal controls or crowd movement and attack states. Models cannot directly set health, damage, score or position. Keep provider credentials outside observations and BAND messages.

Both AI UIs use `AgentApiClient` for JSON requests, timeout handling, consistent API errors and keepalive cleanup. Shared timings live in `src/ai/timing.js` so browser tactic expiry and server leases agree.

## Backend ownership

`serve.mjs` is the startup entry point. `GameServer` owns HTTP routing, static-file allowlisting, the shared hosted decision budget and service shutdown. JSON parsing, origin validation and public errors live in `src/server/http.js`.

- `PlayerService` owns spectator sessions and their normal-input tactics.
- `ArenaService` owns role-specific teammate and boss decisions and session-only BYOK credentials.
- `SessionStore` owns visitor leases, capacity, cancellation and credential erasure.
- `RuntimePool` shares one connection per BAND identity, handles concurrent starts and closes late connections during shutdown.
- `DecisionQueue` serializes model turns and stops follow-up work when its owner shuts down.
- `DecisionBudget` applies hourly usage limits. Hosted modes share one budget; BYOK uses a session budget.
- `PrivateBandRoom` centralizes SDK setup, private-room participant checks and owner-authored bootstrap messages.

Factory exports such as `createPlayerService` remain convenient entry points. These classes use composition; neither game mode depends on a broad service inheritance hierarchy. Inject clocks, factories and transports in tests to exercise cancellation and isolation without credentials or network access.

## Quality checks

Run `npm run check` before proposing changes. It runs ESLint, Prettier's format check and Node's test suite. Use `npm run format` to apply the agreed style. The GitHub Actions workflow runs the same checks for pushes and pull requests.

Keep vendor code, credentials, generated images, browser traces and local diagnostics out of cleanup commits. The bundled Three.js files keep their upstream formatting and license. Add behavioral regression tests for changes to combat, sessions or request handling; verify affected screens in a browser. A passing unit test suite alone cannot prove WebGL rendering.
