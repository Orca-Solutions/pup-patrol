# Working record

Current state of Pup Patrol, kept up to date in each PR. Times are Pacific.

## State (October 8, 2026)

- **Build:** the game, the local creek, tests and docs merged to `main` in PR #1 (090dee5, October 6). A playable preview of that build, replaying the recording, is a private claude.ai artifact.
- **In progress:** the polish PR after #1 (October 8, from the owner's playtest of the preview):
  - "Swim" becomes "move": the field is the riverbank, and pups that young can't swim yet.
  - Camping at the holt mouth no longer keeps the pups home: a pup that just came out is curious for 2 ticks and can't be pushed back in.
  - The header carries StreamOtter's branding (owner's ask, October 9): streamotter.dev's mark and the name, linking to streamotter.dev in a new tab.
- **Backend:** the den channel, the `GAME_ORIGIN` switch, the recording and the streamotter.dev explainer are in jfricano/lontra-creek#49, a draft held by the Lontra Creek main freeze.
- **Domain:** lontracreek.com (owner's choice, October 6). Nothing is deployed.
- **Scope and spec:** `PROJECT_BRIEF.md` and `docs/SPEC.md` are still empty. The approved plan is [docs/PLAN.md](docs/PLAN.md), and [docs/DESIGN.md](docs/DESIGN.md) describes what was built and where it differs from the plan.

## Before go-live (each needs the owner's go)

1. `streamotter@1.0.0`, with the hooks, is published to npm. Then pin `1.0.0` exactly, delete `vendor/`, and make `npm run check:release-pins` pass.
2. lontra-creek#49 merges once the freeze lifts and pins `1.0.0`.
3. Deploy the game to Cloudflare Pages at lontracreek.com, and set up DNS.
4. Set `GAME_ORIGIN=https://lontracreek.com` in the shared host's `lontra.env` and restart the field station and the gateway.

## Verification (head of the polish PR, #2)

- `npm run typecheck`: clean.
- `npm test`: 33 pass (merged main had 29). The new engine tests cover the camping exploit with an active herder, the same exploit after a pause and resync, the dash out of the holt, and a curious pup still going home when called.
- `npm run test:browser`: 7 pass, covering the build and the StrictMode dev server. The new test checks the header's StreamOtter link, and that the header fits a 320 px screen.
- CI runs the release-pin check only when started by hand. It fails by design until step 1 above.

## Review dispositions

- Independent review, October 6. The findings were fixed in f2f88d0 and a4ee655: the StrictMode dev fallback, a hidden tab pausing the round (including a round that starts hidden), stuck keys, weak e2e assertions, and doc mismatches. A fresh re-check verified the fixes.
- After that re-check, the only changes have been docs and the domain (6fb7dbb, then the lontracreek.com commit) and this scaffold fill-in. No code changed.
- Independent review of the polish PR, October 8. It found one major issue: a pause and resync (a quick tab switch) placed the pups at the holt mouth without being curious, which brought the exploit back. That is fixed, and resynced pups that are out are now curious. Two minor findings, a missing test for the dash and a mislabeled verification heading, and one doc nit are also fixed.
