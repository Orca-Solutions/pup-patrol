# Pup Patrol

Herd Sprout and Skipper home before the Beaver Flats camera trap fires.

Pup Patrol is a sixty-second arcade game on [Lontra Creek](https://streamotter.dev), the fictional river-otter study that runs on real Kafka as StreamOtter's live demo. You are Pebble (LO-07). Her pups wander out of Holt A toward a camera trap; you nudge them home. The pups come out when the creek's field station says they're out, and the trap fires when its camera does: the game reads three live channels through [StreamOtter](https://github.com/jfricano/StreamOtter)'s React hooks, and pauses on the last known creek whenever it can't hear it.

It is the demo for `streamotter/react` (StreamOtter V1.3, npm `1.1.0`). It will live at **lontracreek.dev**, linked from streamotter.dev/pup-patrol.

> Status: in development. It builds against a packed prerelease of the hooks in `vendor/`; nothing is deployed. See [docs/PLAN.md](docs/PLAN.md) for the plan and [docs/DESIGN.md](docs/DESIGN.md) for how it's built.

## How it demos the hooks

| StreamOtter | In the game |
| --- | --- |
| `StreamOtterProvider` | One client for the page, with a fresh volunteer token from the field station for every connection. |
| `useSubscription` | Holt A's den (pups home or out), the Beaver Flats camera trap, and the creek overview (the 2-second field tick, daylight, weather). |
| `useConnectionState` | The signal bars in the header. |
| `stale` | The round pauses, greyed, on the last known creek: "Lost the receiver". |
| Reconnect and resync | The fresh snapshot resets the pups; the game doesn't guess what happened meanwhile. `resync-required` shows a Re-tune button that calls `resync()`. |
| Mount and unmount | A round mounts its three subscriptions; the end screen unmounts them. Open **Under the hood** to watch. |
| Params by value | The round re-renders several times a second with new params objects; the subscriptions stay the same ones. |
| Audience rules | The den view says only whether the pups are home. The den's location stays on the researchers-only channel. |

The two files that touch StreamOtter are [`src/streamotter.ts`](src/streamotter.ts) and [`src/creek.ts`](src/creek.ts).

## Run it locally

Needs Node 24.15 or later.

```sh
npm install
npm run dev
```

`npm run dev` starts the local creek (`dev/creek.ts`: a StreamOtter gateway in development mode replaying three recorded minutes of the creek, no Kafka) and Vite at <http://127.0.0.1:5173>. Add `?round=20` for a 20-second round.

Other ways to run:

- `npm run dev:creek` and `npm run dev:web` separately.
- Against a Lontra Creek stack on your machine: `VITE_FIELD_STATION_ORIGIN=http://127.0.0.1:7402 npm run dev:web` (that field station allows the Vite origins in development).
- With no backend at all, the page says so and replays the recording, labeled "Recording · not live".

To pause the creek's source and watch the round go stale: `curl -X POST http://127.0.0.1:7502/api/dev/pause-source`, then `.../api/dev/resume-source`.

## Check it

```sh
npm run typecheck
npm test               # game rules, the recording against the channel schemas, the release-pin guard
npm run build          # production bundle in dist/
npm run test:browser   # Playwright: a round, the stale state, the recording fallback
```

For the browser tests, Playwright needs Chromium (`npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`).

## The creek files

`creek/streamotter.json` (the field station's public `den`, `reach` and `creekOverview` channels) and `creek/pup-patrol.json` (the recording) are copied from lontra-creek, never imported:

```sh
node scripts/sync-creek.mjs ../lontra-creek
npm run generate       # src/generated/ from creek/streamotter.json
npm test               # the recording must still fit the schemas
```

## StreamOtter versions

Until `streamotter@1.1.0` is on npm, `package.json` installs the hooks from packed tarballs in `vendor/` (built from StreamOtter's hooks branch). Before anything goes live, `streamotter` is pinned to the published `1.1.0` exactly, `vendor/` and the `overrides` are removed, and `npm run check:release-pins` passes. The deploy workflow runs that check first, so a vendored build can be tested but never deployed.

## Deploy

Not set up yet; nothing deploys without the owner's go. The plan: a static build (`VITE_FIELD_STATION_ORIGIN` unset, so it reads `https://demo.streamotter.dev`) to a Cloudflare Pages project for lontracreek.dev, the domain on Cloudflare DNS. The demo backend must allow the origin: lontra-creek's gateway lists `https://lontracreek.dev` in `allowedOrigins`, and its field station reads `GAME_ORIGIN` (default `https://lontracreek.dev`) for the three API routes the game calls.

## License

MIT. Lontra Creek, its otters and its study are fictional.
