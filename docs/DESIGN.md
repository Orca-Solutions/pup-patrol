# Pup Patrol design

How the game is built. [PLAN.md](PLAN.md) is the approved plan (what and why); this document is how, and it changes with the code. Written October 6, 2026 (Pacific), when the build started.

## Constraints

- **Hooks only.** The game learns about the creek only through StreamOtter's public React API (`streamotter/react`): `StreamOtterProvider`, `useSubscription`, `useConnectionState`, typed with `createStreamOtterHooks<AppChannels>()`. No direct `createClient`, no socket code.
- **Read-only.** Visitors send nothing to the broker. The only writes are to the browser's own storage (the best score).
- **The creek sets the pace.** The field station publishes one field tick every 2 seconds and that is not changed for the game. The channels set targets; the browser animates between them at the display's frame rate.
- **Stale is a game state.** When anything the round depends on isn't live, the round pauses on the last known creek and says so. When it's live again, the fresh snapshot wins: the game never guesses what happened in between.
- **Honest fallback.** When the demo backend can't be reached, rounds replay a recording of the creek, labeled "Recording · not live" everywhere it shows.

## Module layout

| Path | What it is | Depends on |
| --- | --- | --- |
| `src/game/engine.ts` | The game as plain state and functions: `createGame`, `fieldTick`, `setPups`, `trapFired`, `pause`, `resync`, `step`. No React, no DOM, deterministic. | nothing |
| `src/game/render.ts` | `draw(ctx, state, scene)`: one canvas frame. | engine |
| `src/streamotter.ts` | The typed hooks (`createStreamOtterHooks<AppChannels>()`) and the provider. One of two files that import StreamOtter. | `streamotter/react`, generated types |
| `src/creek.ts` | Where a round gets the creek: `useLiveCreek` (three `useSubscription` calls and `useConnectionState`, the other StreamOtter file) or `recordedCreek(recording)`, both returning a `CreekFeed`. | streamotter.ts, hood.ts |
| `src/backend.ts` | The field station's `/api/config` and `/api/badge`, and `getToken` for the provider. | fetch |
| `src/hood.ts` | A tiny store for the "Under the hood" drawer: mounted subscriptions, connection state, render count. | React |
| `src/components/Round.tsx` | One round: calls the feed hook, hands creek changes to the engine in effects, runs the animation loop, renders the HUD and overlays. | engine, render, creek |
| `src/components/SignalBar.tsx` | The connection state as signal bars. | streamotter.ts |
| `src/components/Drawer.tsx` | Under the hood. | hood.ts |
| `src/App.tsx` | Start, round and end screens; live or recorded mode; the `StreamOtterProvider` around the page in live mode. | everything above |
| `src/generated/` | `streamotter generate` output for `creek/streamotter.json`. Never edited. | — |
| `creek/streamotter.json` | The game's copy of the field station's public channel definitions (`den`, `reach`, `creekOverview`), as a fixture-mode project for the local creek. | — |
| `creek/pup-patrol.json` | Three minutes of those channels, recorded from the simulation by lontra-creek's `scripts/pup-patrol-fixture.ts`. | — |
| `dev/creek.ts` | The local creek: a development-mode gateway replaying the recording, and the three `/api` routes. | streamotter gateway |
| `scripts/sync-creek.mjs` | Refreshes both `creek/` files from a lontra-creek checkout. | — |
| `scripts/check-release-pins.mjs` | Refuses a deploy build that doesn't install StreamOtter from the npm registry at an exact version. | — |

The game never imports lontra-creek or StreamOtter's source. What it shares with them is copied (`creek/`) or published (`streamotter` from npm, a packed tarball in `vendor/` until 1.1.0 is published).

## How the hooks feed the canvas

```
StreamOtterProvider (App, live mode)            one client per page; token from /api/badge
└─ Round                                        mounted for one round, unmounted by the end screen
   ├─ useLiveCreek() on every render
   │    useSubscription("den",           { channelVersion: 1, params: { holtId: "A" } })
   │    useSubscription("reach",         { channelVersion: 1, params: { reachId: "beaver-flats" } })
   │    useSubscription("creekOverview", { channelVersion: 1, params: { watershed: "lontra" } })
   │    useConnectionState()
   │    → CreekFeed { den, reach, overview, overviewRevision, live, ready, problems, canResync, resync }
   ├─ effects (run when the feed changes)
   │    overviewRevision changed → engine.fieldTick(revision)      one per field tick
   │    den.pups changed         → engine.setPups(pups)
   │    reach.lastFrame changed  → engine.trapFired(frame)
   │    live → false             → engine.pause()
   │    live → true after pause  → engine.resync(den.pups)          fresh snapshot resets the pups
   └─ requestAnimationFrame loop (started on mount, cancelled on unmount)
        engine.step(dt, input); render.draw(ctx, state, scene)    every frame, no React
        setHud(...) at most every 100 ms                          re-renders Round
```

- The engine state lives in a ref. React never re-renders per frame; the loop reads the ref, steps and draws.
- The HUD refresh re-renders `Round` up to ten times a second, which calls the three hooks again with brand-new params objects. The hooks key subscriptions by param values, so the subscriptions stay the same ones all round; the drawer's render count climbs while its revisions and states don't reset. That is the "params by value" demonstration.
- The creek overview is republished every field tick (its `observed` time changes), so its revision is the game's clock. The den and trap views change only when something happens.
- Subscriptions live exactly as long as `Round` is mounted. The end screen unmounts it, and the drawer shows zero mounted subscriptions. StrictMode is on, so development double-mounts `Round` and the hooks still end with one subscription each.
- The recorded mode swaps `useLiveCreek` for a hook made by `recordedCreek(recording)` that replays the recording on a timer and reports itself as always live and `recorded: true`. `Round` doesn't know the difference beyond the label. The feed hook is chosen once per mount (`useCreek` is fixed for a mounted `Round`; switching modes remounts it with a new key), so the rules of hooks hold.

## Game rules

The field is 960 × 540 logical pixels: Holt A on the left, the Beaver Flats camera trap (CT-2) on the right looking back toward the holt in a wedge. A round is 60 seconds of live time (`?round=10` to `?round=60` shortens it).

| Event | Comes from | What happens |
| --- | --- | --- |
| Field tick | each new `creekOverview` revision | Every pup gets its next target. Pups **out**: a pup outside wanders 50–95 px toward the trap; a pup at home leaves the holt mouth unless it is still settling. Pups **in-den** (or `none`): pups outside head home on their own, about 100 px a tick. Each pup at home scores 1. Target jitter is a hash of the revision, so the same creek always moves the pups the same way. |
| Den update | `den` (`pups`: `in-den`, `out`, `none`) | Sets the mode for the next tick. |
| Trap fires | a new `reach.lastFrame.frame` at Beaver Flats | Every pup outside the holt and inside the camera's wedge is caught on camera: −5 each. The frame's real id and species show in the log line. |
| Every frame | the animation loop | Pups ease toward their targets (about 95% of the way in one tick). Pebble swims from the keyboard (arrows or WASD) or toward a pointer or touch. A pup within 84 px of Pebble is pushed away from her, and the push moves its target too, so herding sticks. A pup pushed into the holt is home and settles for 2 ticks before it can wander again. |
| Bell | 60 s of live time | Each pup at home scores 10. |

### States

| State | When | Shown |
| --- | --- | --- |
| Tuning | `Round` is mounted but not every subscription has data and is live yet | "Tuning the receiver…" with what's missing; after 8 s, a button to play the recording instead. The clock hasn't started. |
| Playing | every subscription `live` and the client `connected` | The field, HUD and log. |
| Paused (stale) | any subscription not `live` (`stale`, `synchronizing`, `resync-required`, …) or the connection not `connected` | The field frozen and greyed where it was last known; "Lost the receiver" with each problem (`Holt A den: stale`, `connection: reconnecting`). The clock stops. |
| Resync required | a subscription is `resync-required` | The paused overlay adds a **Re-tune** button that calls that subscription's `resync()`. |
| Resumed | everything live again | `resync`: the pups are placed where the fresh den snapshot says (home, or just outside the holt), Pebble stays put, and any trap frame taken while paused is skipped, not scored. |
| Over | the bell, or "End round" | The end screen; the round unmounts and its subscriptions close. Best score is kept in `localStorage` (a blocked store just means no best score). |

## The backend contract

The game is a client of the Lontra Creek demo backend (the lontra-creek repository), on another origin:

| What | Where | Notes |
| --- | --- | --- |
| Gateway address | `GET {API}/api/config` → `{ gatewayOrigin, gatewayPath, mode, tickMs }` | `API` is `https://demo.streamotter.dev` in production, `VITE_FIELD_STATION_ORIGIN` to override. |
| Token | `POST {API}/api/badge` → `{ token }` | Always a new volunteer badge for a request from the game's origin; no cookie is sent or set. The provider's `getToken` asks for a fresh one on every connection, as the site does. |
| Channels | `den` `{ holtId: "A" }`, `reach` `{ reachId: "beaver-flats" }`, `creekOverview` `{ watershed: "lontra" }` | All public: any volunteer badge may read them. The restricted `holt` channel (with the grid reference) is never used. |
| Origin | `https://lontracreek.dev` | Allowed by the gateway (`allowedOrigins`) and by the field station for `GET /api/config`, `GET /api/status` and `POST /api/badge` only (`GAME_ORIGIN`); never for the Lab, the sandbox or notebooks. |

## Where the build differs from the plan

- **The den view carries only `pups`.** The plan sketched `{ holtId, reachId, occupied, pupsAtDen, lastEntry, lastExit }`. The build publishes `{ holtId, name, reachId, pups: "in-den" | "out" | "none" }`. `occupied` and the entry and exit times would say when an adult is in the den, which the public otter view deliberately withholds; the game needs only the pups. `none` covers Holt B, which has no litter. It has its own topic, `field.dens`, and is kept off Failure Lab benches like `holt`.
- **The token route is `POST /api/badge`, the field station's existing route**, not a new `/api/session`. The plan's recommended session handling (token in memory, no cross-site cookie) is what the build does.
- **The second origin is narrower than a `SITE_ORIGINS` list.** `SITE_ORIGIN` stays one exact origin (the Lab, sandbox, notebooks and Caddy's Lab and sandbox matchers keep using it). A separate optional `GAME_ORIGIN` opens three read routes, without credentials. Caddy needs no change: only the Lab and sandbox paths match `Origin` there, and the gateway checks its own `allowedOrigins`.
- **The third subscription is `creekOverview`.** It is the field tick clock (it changes every tick), and gives the scene its daylight and weather.
- **The recording is playable.** When the backend is down, the page replays the recorded creek through the same round, labeled as a recording, rather than showing a video.
- **The explainer route is `/pup-patrol`** on streamotter.dev (plan open decision 4).

## Testing

- `test/engine.test.ts`: the rules above, on the engine alone.
- `test/creek.test.ts`: the recording validates against the copied schemas, and every game state shows up in it.
- `scripts/test/release-pins.test.mjs`: the release-pin guard.
- `e2e/round.spec.ts` (Playwright, against the production build and the local creek): load, a round, the drawer's three live subscriptions and zero after the round, a forced stale state (the local creek's `POST /api/dev/pause-source`) and the resume, and the recording fallback when the backend is down.

## Open items

- Pin `streamotter@1.1.0` from npm once published and delete `vendor/` (the release-pin guard fails until then, by design).
- Hosted acceptance on the real deployment, including a real connection drop.
- A Cloudflare Pages project and DNS for lontracreek.dev (jason's go).
