# Working record

Current state of Pup Patrol, kept up to date in each PR. Times are Pacific.

## State (October 9, 2026)

- **Build:** the game, the local creek, tests and docs merged to `main` in PR #1 (090dee5, October 6). A playable preview of that build, replaying the recording, is a private claude.ai artifact.
- **In progress:** the polish PR after #1 (October 8, from the owner's playtest of the preview):
  - "Swim" becomes "move": the field is the riverbank, and pups that young can't swim yet.
  - Camping at the holt mouth no longer keeps the pups home: a pup that just came out is curious for 2 ticks and can't be pushed back in.
  - The header carries StreamOtter's branding (owner's ask, October 9), linking to streamotter.dev in a new tab.
  - The design team's pass, approved by the owner on October 9 with both optional items: streamotter.dev's fonts (Figtree, JetBrains Mono), StreamOtter's full lockup in a sticky translucent header, "live" in streamotter.dev's cyan, a "Recording" chip, a two-row phone header, and a field still and an eyebrow on the start card. The drawer is renamed "Live data", since "StreamOtter Under the Hood" is now the name of the docs series. See [docs/DESIGN.md](docs/DESIGN.md#look).
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
- `npm run test:browser`: 8 pass, covering the build and the StrictMode dev server. The header test checks the StreamOtter lockup and link, the sticky header, and that a 320 px screen keeps the lockup, puts the actions on a second row and doesn't scroll sideways. Another checks the start screen's still and eyebrow.
- Screenshots of the redesign (light, dark, 390 px and 320 px; the start screen live, recorded and while finding the creek; a live round with the drawer open) were checked by eye. They aren't automated.
- CI runs the release-pin check only when started by hand. It fails by design until step 1 above.

## Review dispositions

- Independent review, October 6. The findings were fixed in f2f88d0 and a4ee655: the StrictMode dev fallback, a hidden tab pausing the round (including a round that starts hidden), stuck keys, weak e2e assertions, and doc mismatches. A fresh re-check verified the fixes.
- After that re-check, the only changes have been docs and the domain (6fb7dbb, then the lontracreek.com commit) and this scaffold fill-in. No code changed.
- Independent review of the polish PR, October 8. It found one major issue: a pause and resync (a quick tab switch) placed the pups at the holt mouth without being curious, which brought the exploit back. That is fixed, and resynced pups that are out are now curious. Two minor findings, a missing test for the dash and a mislabeled verification heading, and one doc nit are also fixed.
- Independent review of the header commit, October 9. It found no blockers. Two small fixes followed: the DESIGN.md test list now names the header test (minor), and the StreamOtter link is at least 24 px tall, so the mark-only link on phones meets the 24 px target size (nit).
- Independent review of the redesign commit (5e46070), October 9. No blockers or major findings. One minor finding fixed: the browser tests now cover the two-row phone header, the field still and the eyebrow. Nits: the eyebrow now follows the round length (fixed). JetBrains Mono's Latin subset has ↑ and ↓ but not ← and →, so those two keys fall back to the system mono (kept). The still's labels are too small to read on phones (kept: it's decorative). The still was then rebuilt to the design thread's spec (above the card, the pups in the holt).
- Re-check of the rebuilt still (5ce98bc), October 9. No blockers or major findings. One minor finding fixed: the docs and a comment called the live still the round's first frame, but a live round's first frame already has the creek's daylight, weather and pups, so the live still is now described as a placeholder. Nits: the WORKING_RECORD entry (this one, fixed); the card covered the still's "Holt A" label at some widths (fixed by cropping lower in the frame); the test didn't cover the phone crop (fixed). The design thread then asked for a shorter desktop still so the title and Start round fit at 1280 × 800; that crop is in the same commit as these fixes.
- Re-check of the shorter still (5373793), October 9. No blockers or major findings. Two minor findings fixed: the docs now say the fold holds in live mode (the recorded-mode notice pushes it about 50 px lower), and the fold test waits for the fonts. Nits: landscape phones and 1366 × 768 missed the fold (fixed: a lower floor and a thin still on short, wide screens); about 1 px of the tiny "Holt A" label under the card at 320 px, and the still is wider than 21:9 when the height cap applies (kept, and the CSS comment now says "21:9 at most").
- Repair check of 196941a, October 9. The repairs hold. One new minor finding fixed: on screens 640 px tall or less, the thin still put "Holt A" under the card, so that rule now crops lower in the frame. That fix is one CSS line, checked by screenshots at 844 × 390, 641 × 600 and 1440 × 600 and by the browser tests, not by another review.
