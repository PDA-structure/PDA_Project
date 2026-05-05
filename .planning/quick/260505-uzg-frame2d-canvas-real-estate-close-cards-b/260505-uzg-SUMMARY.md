---
phase: quick-260505-uzg
plan: 01
subsystem: ui
status: incomplete
tags: [frame2d, html, css, layout, canvas-real-estate]

requires:
  - phase: quick-260505-u2h
    provides: smaller buttons + tighter card min-width

provides:
  - All 10 toolbar cards default closed (chevron right ▸)
  - Results panel relocated to between toolbar and canvas
  - Results panel capped at 30vh max-height with internal overflow scroll
  - Canvas area is now the bottom-most element — nothing rendered below it

affects: [frame2d-ui, layout, results-panel-position]

key-files:
  modified:
    - "ui/frame2d/index.html — removed `open` from 10 `<details class=\"card\">` elements; moved `<div class=\"results-panel\">` block from outside workspace to inside (between </aside> and <main class=\"canvas-area\">)"
    - "ui/frame2d/style.css — added `border-bottom`, `max-height: 30vh`, `overflow-y: auto`, `flex: 0 0 auto` to `.results-panel`"

key-decisions:
  - "Cards closed by default — accepts the one-extra-click cost in exchange for collapsed-by-default toolbar density. Native <details> behavior preserved; user can leave cards open after first click for rest of session."
  - "Results panel max-height 30vh — caps vertical impact on canvas. If too tall in practice, drop to 25vh or 20vh."
  - "Border-top 2px accent kept (visual separator from toolbar); border-bottom 1px subtle added (visual separator from canvas)."
  - "flex: 0 0 auto on results-panel — content-sized; canvas-area still flex: 1 to fill remaining space."
  - "No JS change required — `solve()` toggles `style.display = 'block'` on the same `#resultsPanel` element, just at a new DOM location."

requirements-completed: [UZG-01, UZG-02, UZG-03, UZG-04]

duration: 3min
completed: 2026-05-05
---

# Quick Task 260505-uzg: Canvas Real-Estate Summary

**Free up canvas vertical real-estate via two paired changes: (1) all 10 toolbar cards default to closed state (chevron-right ▸) instead of open; (2) results table relocated from below the canvas to between the toolbar and canvas, capped at 30vh with internal scroll. Single commit `6c60da8` building on u2h.**

## Performance

- **Duration:** ~3 min (HTML + CSS structural change, inline execution)
- **Tasks:** 1 of 2 executor-completed; Task 3 = `checkpoint:human-verify` PENDING
- **Files modified:** 2 (`ui/frame2d/index.html`, `ui/frame2d/style.css`)

## Accomplishments

- **All cards default closed** — removed `open` attribute from all 10 `<details class="card">` elements. Toolbar now shows only card titles (with chevron-right ▸) at page load. User clicks to expand; chevron rotates to ▾ per existing `nwi` styling.
- **Results panel relocated** — moved from below `<div class="workspace">` to between `</aside>` (toolbar close) and `<main class="canvas-area">` (canvas open). Same element ID (`#resultsPanel`), same JS show/hide trigger — no `script.js` change needed.
- **Results panel sized for canvas friendliness** — added `max-height: 30vh` + `overflow-y: auto` so even with all 4 result tables populated, results take at most 30% of viewport; canvas-area's `flex: 1` continues to fill the remainder.
- **Visual hierarchy refined** — kept `border-top: 2px solid var(--color-accent)` (existing accent separator from toolbar above); added `border-bottom: 1px solid var(--color-border-subtle)` (subtle separator from canvas below).

## Task Commits

1. **Task 1+2 bundled: Close cards + relocate results panel** — `6c60da8` (feat) atop EXPECTED_BASE `2c85ec5`
2. **Task 3: Browser UAT — chevron-right + results-above-canvas + nothing-below-canvas** — **PENDING HUMAN UAT** (checkpoint:human-verify gate)

## Diffstat (against base `2c85ec5`)

```
 ui/frame2d/index.html | 114 ++++++++++++++++++++++++--------------------------
 ui/frame2d/style.css  |   4 ++
 2 files changed, 61 insertions(+), 57 deletions(-)
```

Most of the index.html line count is whitespace re-flow from the relocated block (results-panel is now inside `<div class="workspace">` and gets one extra level of indentation). 10 `open` removed, 1 block moved. Net: +4 lines.

Scope contract held:
- No `solver_core/` change
- No `api_server/` change
- No `tests/` change
- No `ui/truss2d/` change
- No `ui/frame2d/script.js` change (results show/hide JS path unchanged)
- No new design tokens

## Verifier Gates (all 5 green)

1. `grep -c 'details class="card" open' ui/frame2d/index.html` = 0 ✓
2. `grep -c 'details class="card"' ui/frame2d/index.html` = 10 ✓ (all closed)
3. Results-panel sits between `</aside>` (line 190) and `<main class="canvas-area">` (line 240) inside workspace ✓
4. `.results-panel` rule has `max-height: 30vh; overflow-y: auto; flex: 0 0 auto` ✓
5. `pytest -q` → 61 passed ✓

## Pending Browser UAT (Task 3)

Refresh `http://127.0.0.1:8000/ui/frame2d/index.html` with hard-reload (Cmd+Shift+R). Verify:

1. **Cards closed by default** — toolbar shows just card titles with chevron-right (▸); no buttons visible until you click to expand
2. **Click to expand** — chevron rotates to down (▾), buttons appear inside the card; click again to collapse back
3. **SOLVE flow** — build a small frame, click SOLVE — results tables appear **between** the toolbar and the canvas; canvas/grid stays as the bottom-most element (nothing below canvas)
4. **Results overflow** — when result tables are tall (e.g., a structure with many members), results panel scrolls internally; canvas does not get pushed off-screen
5. **Earlier baselines preserved** — light/dark theme still works (sq0+j8m); Display card still vertical-stacked when opened (tke+u2h-followup); buttons still 11px small (u2h); UDL/Spring panels still token-driven (sq0)

## Tradeoffs / Open Questions

- **One extra click to access frequent buttons** (e.g., Add Node — used most often). User accepted this tradeoff for canvas real estate. If it becomes friction, options:
  - Re-open just the most-used cards (Geometry, Solve panel)
  - Add localStorage to persist user's open/closed preferences
  - Ribbon migration (Phase 999.5) replaces this entire pattern with tab-switching anyway
- **30vh results cap** — chosen as a sensible default. If users find it too tall (canvas too cramped) drop to 25vh or 20vh in a follow-up.

## Self-Check: PASSED

- Both files exist with expected diffs.
- Commit `6c60da8` exists atop EXPECTED_BASE `2c85ec5`.
- All earlier baselines (sq0, tke, u2h) byte-equivalent in the rules they own — verified by inspection of the diff (no token, no panel CSS, no contrast color overlap).
- pytest 61/61 green.

---
*Phase: quick-260505-uzg*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
