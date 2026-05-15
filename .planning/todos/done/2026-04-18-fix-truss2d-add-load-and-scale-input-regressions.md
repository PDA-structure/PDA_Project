---
created: 2026-04-18T14:53:33.136Z
title: Fix truss2d Add Load and Scale input regressions
area: ui
status: resolved_phantom
resolved_date: 2026-05-15
resolved_via: ".planning/debug/truss2d-load-scale-regressions.md"
files:
  - ui/truss2d/script.js
  - ui/truss2d/index.html
---

## RESOLVED PHANTOM 2026-05-15

User browser UAT against current HEAD (~`2afd769`) confirmed **both regressions no longer reproduce**:

1. **Add Load** — prompt appears as expected when clicking a node after pressing Add Load.
2. **Scale factor input** — accepts changes after Solve, reactive `draw()` fires per keystroke.

The 8-month gap between original capture (2026-04-18) and verification (2026-05-15) saw many UI commits land that hardened the relevant code paths cumulatively. No single targeted fix — most plausible contributors:

- **260418-vxi** — try/catch wrapping + error banner machinery (same day as the original report). Any genuine exception now surfaces visibly instead of silently aborting the click handler.
- **317e69c** — zoom/pan view transform with `findNodeAt` hit radius in world coords. The original symptom may have been "click slightly off the node" — affected by view scale at the time.
- **71ede0f (260414-s3t)** — `resetAll` resets view + mode + clears panel state.
- **092fcb9 (260515-vhr-01)** — `setMode` visibility auto-enable + `draw()` at end of `setMode`. Ensures the canvas refreshes immediately after entering Load mode.

Static analysis (`.planning/debug/truss2d-load-scale-regressions.md` Evidence section) predicted this outcome — neither symptom had a code-level mechanism in current HEAD that could produce it. No fix code written. No tests added (no regression to lock down — the symptoms are not reproducible).

Moved to `done/` 2026-05-15 during the day's housekeeping run.

---

## Original problem statement (preserved for record)

## Problem

Two truss2d UI bugs surfaced during Phase 3 human verification (Save/Load JSON themselves work):

1. **Add Load silently fails.** Repro: Reset All → add nodes → add a member → click "Add Load" → click on a node. No direction prompt appears, no magnitude prompt, no error alert. Nothing happens at all.

2. **Scale factor input "gets stuck" after Solve.** Repro: Solve a structure successfully → change the "Scale factor" field (`inputScale`, default 100) → input appears frozen / unresponsive.

Both regressions are post-commit `dabbe55` (Phase 3 plan 03-01 Save/Load JSON). The plan's diff on `ui/truss2d/script.js` is surgical — only adds `updateSaveButtonState()` calls into existing mutators and a self-contained Save/Load block. It does **not** touch:
- The `canvas.click` handler's `mode === 'load'` branch
- `solve()`
- `drawDeflected()`
- The `inputScale` input listener (`input → draw()`)

So the bugs are either (a) a runtime exception from `draw()` after the new code path mutates state in an unexpected way, (b) a browser-cache issue where the old script is being served, or (c) a subtle interaction I haven't reproduced.

User could not open Safari DevTools to capture console errors. Troubleshooting session ended before we got console output.

## Solution

1. Start a local static file server (`python3 -m http.server 5500` from repo root) to serve `ui/truss2d/index.html`. API is at `http://localhost:8000` (uvicorn).
2. Open the page in Chrome with DevTools Console open from the start.
3. Reproduce both bugs. Capture the exact red error text — this almost certainly names the bad line.
4. Likely culprits to check first:
   - Does `drawDeflected()` throw on `results.UG` after the Save/Load round-trip? (Would cause scale-factor `input → draw()` to re-throw on every keystroke, looking "stuck".)
   - Is `updateSaveButtonState()` accidentally swallowing the click event or throwing silently? (Unlikely — it only reads a DOM node and sets `disabled`.)
   - Does the click handler see `mode === 'load'` when the user clicks, or has setMode not run? (Add a `console.log(mode)` at the top of the click handler to confirm.)
5. Patch the root cause in `ui/truss2d/script.js`. Mirror the same fix in `ui/frame2d/script.js` if applicable — user is reviewing frame2d independently and may report similar symptoms.
6. Add a regression test (playwright or a minimal headless check) so future UI plans don't re-break this.

**Phase link:** These are human-UAT gaps for Phase 3 (`.planning/phases/03-interchange-format-and-external-inputs/03-HUMAN-UAT.md`). Resolving this todo should close tests #1, #2, #4, and #5 in that UAT.
