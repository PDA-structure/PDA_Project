> **RESOLVED 2026-05-04** (quick task 260504-ene)
>
> Actual root cause: chkSupports / chkLoads visibility checkboxes unchecked at click time. Supports/loads were correctly being added to the data arrays but `drawSupports()` / `drawNodeLoads()` were skipped because of the visibility gate in `draw()` (ui/frame2d/script.js:740-741). The UI was never frozen — rendering was suppressed.
>
> Fix: setMode() in ui/frame2d/script.js now auto-enables the matching visibility checkbox and calls draw(). Sibling truss2d UI has the same anti-pattern; tracked as a follow-up todo.
>
> Debug session: `.planning/debug/frame2d-load-then-add-support.md` (status: resolved).

---
created: 2026-05-02T20:49:59.432Z
title: Frame2D UI freezes when adding supports after loading JSON
area: ui
priority: P2
status: pending
files:
  - ui/frame2d/script.js
  - ui/frame2d/index.html
related:
  - .planning/todos/pending/2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md
promote_when: "Next dedicated frame2d UI session, OR before any Frame2D demo to a customer/stakeholder. Should be cleared before the v1.4 Three.js 3D viewer work (2026-04-29-threejs-frame2d-3d-viewer.md) since that work will likely re-touch the same state-management surface."
---

## Problem

User-reported in conversation 2026-05-02. Sequence to reproduce on the Frame2D browser UI:

1. Open `ui/frame2d/index.html` in a browser (dev server: `uvicorn api_server.app:app --reload` from project root)
2. Use the **Load JSON** control to load an existing frame model
3. Switch to support mode and click on a node to attempt adding a support

**Symptoms:**
- UI freezes — clicks no longer register, no support glyph is drawn on canvas
- The **Reset All** button does NOT recover the page state — clicking it produces no observable effect
- User must hard-close the browser tab AND restart the dev server (`uvicorn ...`) from the terminal before the UI is usable again
- Building a fresh model from scratch (Reset All → place nodes → add members → add supports) works correctly — this is the path exercised by existing UAT, which is why the bug went unnoticed

**Scope:** Only the load-JSON → add-support sequence. Save-JSON and Load-JSON in isolation appear to work (model is parsed and rendered).

**Reporter notes:** The need to "reboot from terminal" is suspicious — if Reset All only fails to recover client state, restarting the FastAPI server should not be required (the UI is a static SPA hitting `/solve/frame2d` only on submit). Either:
- (a) the user is restarting from terminal as a safety habit, not because the server is genuinely hung, or
- (b) the freeze is bad enough to also wedge an open WebSocket / fetch / EventSource (worth confirming during repro)

No browser devtools console capture yet — first action when investigating: run the repro with the **Console** tab open and capture any thrown errors, infinite-loop warnings, or stuck Promise traces.

## Solution

TBD — needs investigation. Initial hypotheses (in rough priority order):

1. **Stale state from Load JSON path.** The load-JSON handler probably overwrites `nodes`, `members`, `loads`, `supports` arrays but may not reset the **mode state machine** (e.g., `mode = 'support'` flag, partial-click state, the `selectedNodeIndex` for "click a node to add support to it" interactions). When the user then clicks support mode, the click handler dispatches into a code path that expects a state shape Reset All sets up but Load JSON doesn't. If that code path enters an infinite loop or throws synchronously inside the canvas mousedown handler, the UI freezes.

2. **Coordinate origin mismatch.** Per CLAUDE.md UI conventions, the first node placed sets `origin`, and real coords are computed as `realX = (px - origin.x) / GRID`. If Load JSON sets `nodes[]` from the JSON without setting `origin` (or sets a stale `origin`), the support-add click-to-node hit-detection (point-to-line distance, tolerance 8 px) may compute coordinates that never match any node — silently ignoring the click — but then a subsequent state mutation lands in an inconsistent shape.

3. **Reset All not clearing everything.** If Reset All does NOT reset whatever Load JSON sets, the user is stuck — confirms hypothesis 1's "Load JSON sets state Reset All doesn't know about." Audit: enumerate every variable Reset All touches vs. every variable Load JSON touches; gaps are suspects.

4. **Truss2D sibling is suspicious — check for shared root cause.** `.planning/todos/pending/2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md` describes a structurally similar post-Save/Load regression in `ui/truss2d/script.js` (Add Load silently fails, Scale input freezes). The frame2d UI was forked from truss2d patterns per CLAUDE.md. If the truss2d Save/Load PR introduced a state-management anti-pattern that was copied into frame2d, both bugs may share a root cause and be fixable together.

**Investigation steps when picked up:**
1. Reproduce with browser devtools Console open; capture all errors and warnings
2. Add `console.log('mode:', mode, 'state:', {...})` at the top of the canvas mousedown handler to confirm what state shape arrives after Load JSON vs. after Reset All
3. Compare Reset All and Load JSON state-mutation surfaces in `ui/frame2d/script.js`; find variables one touches that the other doesn't
4. Cross-check against truss2d's Save/Load implementation for the same anti-pattern
5. Add a regression test: a Playwright/Puppeteer flow that loads a JSON, clicks support mode, clicks a node, and asserts a support glyph is rendered (currently UAT skips this path)

**Why P2, not P1:**
- Workaround exists (build models from scratch instead of loading)
- Doesn't block Phase 7 / Phase 8 (Revit-side work)
- BUT must be cleared before any Frame2D demo to a third party — the load-then-edit flow is the natural user motion for "I have an existing model, let me modify it"
