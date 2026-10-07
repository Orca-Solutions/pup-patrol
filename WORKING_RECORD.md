# Working record

Current state of Pup Patrol, kept up to date in each PR. Times are Pacific.

## State (October 6, 2026)

- **Build:** the game, the local creek, tests and docs are on `feat/pup-patrol-92ggxb`, PR #1. It has had independent review and a re-check, and CI is green. It waits for the owner's merge.
- **Backend:** the den channel, the `GAME_ORIGIN` switch, the recording and the streamotter.dev explainer are in jfricano/lontra-creek#49, a draft held by the Lontra Creek main freeze.
- **Domain:** lontracreek.com (owner's choice, October 6). Nothing is deployed.
- **Scope and spec:** `PROJECT_BRIEF.md` and `docs/SPEC.md` are still empty. The approved plan is [docs/PLAN.md](docs/PLAN.md), and [docs/DESIGN.md](docs/DESIGN.md) describes what was built and where it differs from the plan.

## Before go-live (each needs the owner's go)

1. `streamotter@1.0.0`, with the hooks, is published to npm. Then pin `1.0.0` exactly, delete `vendor/`, and make `npm run check:release-pins` pass.
2. lontra-creek#49 merges once the freeze lifts and pins `1.0.0`.
3. Deploy the game to Cloudflare Pages at lontracreek.com, and set up DNS.
4. Set `GAME_ORIGIN=https://lontracreek.com` in the shared host's `lontra.env` and restart the field station and the gateway.

## Verification (head of PR #1)

- `npm run typecheck`: clean.
- `npm test`: 29 pass.
- `npm run test:browser`: 6 pass, covering the build and the StrictMode dev server.
- CI runs the release-pin check only when started by hand. It fails by design until step 1 above.

## Review dispositions

- Independent review, October 6. The findings were fixed in f2f88d0 and a4ee655: the StrictMode dev fallback, a hidden tab pausing the round (including a round that starts hidden), stuck keys, weak e2e assertions, and doc mismatches. A fresh re-check verified the fixes.
- After that re-check, the only changes have been docs and the domain (6fb7dbb, then the lontracreek.com commit) and this scaffold fill-in. No code changed.
