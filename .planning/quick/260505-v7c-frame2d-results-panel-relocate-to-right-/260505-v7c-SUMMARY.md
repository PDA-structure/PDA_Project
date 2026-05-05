---
phase: quick-260505-v7c
plan: 01
subsystem: ui
status: incomplete
tags: [frame2d, html, css, layout, results-panel, sidebar]

provides:
  - Results panel as 320px right sidebar next to canvas
  - Tables stack vertically inside sidebar
  - Wide tables scroll horizontally inside their container
  - Canvas no longer pushed down by results, even with Display card open

affects: [frame2d-ui, layout, results-panel-position]

key-files:
  modified:
    - "ui/frame2d/index.html — wrapped canvas-area + results-panel in new <div class=\"canvas-row\">; canvas-area now first (left), results-panel second (right)"
    - "ui/frame2d/style.css — added .canvas-row flex-row container; rewrote .results-panel for sidebar (border-left + flex 0 0 320px + max-height 100% + overflow-y auto); .results-grid changed from flex-wrap to flex-direction:column; added .results-table-wrap overflow-x:auto"

duration: 3min
completed: 2026-05-05
---

# Quick Task 260505-v7c: Results Sidebar Summary

**Move results panel from above canvas (uzg layout) to a 320px right sidebar next to canvas, growing vertically. Single commit `f6c086a` building on uzg.**

## Performance

- **Duration:** ~3 min (HTML restructure + CSS layout, inline execution)
- **Tasks:** 1 of 2 executor-completed; Task 2 = `checkpoint:human-verify` PENDING
- **Files modified:** 2 (`ui/frame2d/index.html`, `ui/frame2d/style.css`)

## Accomplishments

- **Workspace layout reshaped** — canvas-area + results-panel now wrapped in `<div class="canvas-row">` (flex-row). Workspace structure: toolbar (top) → canvas-row [canvas (left, flex:1) + results-panel (right, 320px)].
- **Results sidebar styling** — `.results-panel` rewritten: border-left accent strip (separator from canvas), fixed 320px width, max-height 100% (fills canvas-row vertically), overflow-y auto for internal scroll.
- **Tables stack vertically** — `.results-grid` changed from `flex-wrap: wrap` to `flex-direction: column`; the 4 result tables (Member Actions, Reactions, Nodal Displacements, Summary) now stack vertically inside the sidebar.
- **Wide tables get horizontal scroll** — `.results-table-wrap { overflow-x: auto }` ensures Member Actions (9 columns) doesn't break the sidebar; user scrolls horizontally inside that one table.

## Task Commits

1. **Task 1: Sidebar layout (HTML + CSS)** — `f6c086a` (feat) atop EXPECTED_BASE `349f4eb`
2. **Task 2: Browser UAT — sidebar position + canvas not pushed down** — **PENDING HUMAN UAT**

## Diffstat (against base `349f4eb`)

```
 ui/frame2d/index.html | 98 +++++++++++++++++++++++++++++-----------------
 ui/frame2d/style.css  | 21 +++++++----
 2 files changed, 66 insertions(+), 53 deletions(-)
```

Most index.html changes are indentation reflow from the new `<div class="canvas-row">` wrapper.

Scope contract held:
- No `solver_core/` change
- No `api_server/` change
- No `tests/` change
- No `ui/truss2d/` change
- No `ui/frame2d/script.js` change
- No new design tokens

## Verifier Gates (all 6 green)

1. `.canvas-row` rule exists with `flex-direction: row; flex: 1; min-height: 0` ✓
2. `.results-panel` has `border-left`, `flex: 0 0 320px`, `max-height: 100%`, `overflow-y: auto` ✓
3. `.results-grid { flex-direction: column }` ✓
4. `.results-table-wrap { overflow-x: auto }` ✓
5. HTML: canvas-row contains canvas-area then results-panel (correct visual order) ✓
6. `pytest -q` → 61 passed ✓

## Pending Browser UAT (Task 2)

Refresh `http://127.0.0.1:8000/ui/frame2d/index.html` with hard-reload (Cmd+Shift+R). Verify:

1. **Layout:** toolbar at top, canvas takes left portion of viewport, results sidebar (when shown) takes 320px on right
2. **Cards still closed by default** (uzg preserved) — chevron-right ▸
3. **SOLVE flow** — build a small frame, click SOLVE → results appears as a column on the right of canvas
4. **Vertical stacking** — Reactions, Displacements, Summary stack vertically inside the sidebar
5. **Wide table scroll** — Member Actions (9 cols) scrolls horizontally inside its container, doesn't break the sidebar
6. **Medium-large frame test** — open Display card AND solve a structure with many members; canvas should NOT be pushed down (results are now on the side, not on top)
7. **All baselines preserved** — light/dark theme works (sq0+j8m); UDL/Spring panels still token-driven (sq0); button/card density still tight (tke+u2h); cards default closed (uzg)

## Tradeoffs

- **Canvas shrinks horizontally by 320px when results visible.** Acceptable for typical laptop+ widths.
- **320px sidebar is a starting point.** If too narrow (Member Actions scrolls a lot) or too wide (canvas feels cramped), adjust `flex: 0 0 320px` value in a follow-up.
- **Wide tables need horizontal scroll** — alternative would be reformatting Member Actions table (vertical key-value layout, or hiding less-critical columns) — defer until UAT signals real friction.

## Self-Check: PASSED

- Both files exist with expected diffs.
- Commit `f6c086a` exists atop EXPECTED_BASE `349f4eb`.
- All earlier baselines (sq0, tke, u2h, uzg) byte-equivalent in their owned rules — verified by inspection.
- pytest 61/61 green.

---
*Phase: quick-260505-v7c*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
