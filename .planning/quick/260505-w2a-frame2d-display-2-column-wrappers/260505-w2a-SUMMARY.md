---
phase: quick-260505-w2a
plan: 01
subsystem: ui
status: incomplete
tags: [frame2d, html, css, layout, display, fix]

provides:
  - Display 2-column layout via explicit wrapper divs (deterministic row alignment)
  - Show diagram values now top-aligned with Show supports (was previously misaligned next to Show shear force diagram)
  - CSS Grid replaced with simpler flex-row + 2x flex-column

key-files:
  modified:
    - "ui/frame2d/index.html — wrapped Display body items 1-5 and 6-12 in two <div class=\"display-col\"> wrappers inside <div class=\"display-body\">"
    - "ui/frame2d/style.css — replaced grid layout with flex-row on .display-body + flex-column on .display-col; removed grid-column placement rules; updated label selectors from .display-body > label to .display-col > label"

duration: 2min
completed: 2026-05-05
---

# Quick Task 260505-w2a: Display 2-Column via Explicit Wrappers

**Replace the CSS Grid auto-placement (vhi) with two explicit wrapper divs so "Show diagram values" appears on the same row as "Show supports" (top-aligned), not next to "Show shear force diagram" (row 5). Single commit `7984e97` building on vxu.**

## Performance

- **Duration:** ~2 min (HTML restructure + CSS layout swap, inline execution)
- **Tasks:** 1 of 2 executor-completed; Task 2 = `checkpoint:human-verify` PENDING
- **Files modified:** 2 (`ui/frame2d/index.html`, `ui/frame2d/style.css`)

## Accomplishments

- **Two explicit column wrappers in HTML** — `<div class="display-col">` × 2 inside `.display-body`. Items 1-5 (5 visibility checkboxes) in col 1; items 6-12 (2 visibility checkboxes + 4 input pairs + theme toggle) in col 2.
- **Flex-row container, flex-column children** — `.display-body { display: flex; flex-direction: row }` + `.display-col { display: flex; flex-direction: column; flex: 1 }`. Standard 2-column layout, no grid auto-placement edge cases.
- **Removed grid-column placement rules** — the 4 lines that explicitly assigned `grid-column: 1` and `grid-column: 2` to children are gone. Layout determinism comes from the wrapper divs, not from CSS auto-flow.
- **Label selectors migrated** — `details.card:has(#chkDeflected) .display-body > label` → `.display-col > label` (4 occurrences); labels are now grandchildren of `.display-body` so `>` from there breaks.

## Task Commits

1. **Task 1: Wrap + flex layout (HTML + CSS)** — `7984e97` (fix) atop EXPECTED_BASE `135652f`
2. **Task 2: Browser UAT** — **PENDING HUMAN UAT**

## Diffstat (against base `135652f`)

```
 ui/frame2d/index.html | 78 +++++++++++++++++++++++++++------------------------
 ui/frame2d/style.css  | 38 ++++++++++++-------------
 2 files changed, 60 insertions(+), 56 deletions(-)
```

Most index.html line count is indentation reflow from the new wrapper divs.

Scope contract held:
- No `solver_core/` / `api_server/` / `tests/` / `truss2d/` / `script.js` change
- No new design tokens
- All earlier baselines preserved

## Verifier Gates (all 6 green)

1. `display-col` appears 2× in HTML (one per col wrapper) ✓
2. `.display-body { display: flex; flex-direction: row }` ✓
3. `.display-col { display: flex; flex-direction: column; flex: 1 }` ✓
4. `grid-column` / `grid-template-columns` count in style.css = 0 ✓
5. `.display-col > label` selectors count = 4 (matches the 4 child-selector rules updated) ✓
6. `pytest -q` → 61 passed ✓

## Pending Browser UAT (Task 2)

Refresh (Cmd+Shift+R). Verify:
1. Display card opens to a 2-column layout, both columns starting at the top (TOP-ALIGNED)
2. Col 1: Show supports, Show loads, Show deflected shape, Show BMD, Show SFD (5 checkboxes, top-to-bottom)
3. Col 2: Show diagram values, Node labels, Deflection scale ×, BMD/SFD scale ×, Symbol size, Label size, Theme toggle (7 items, top-to-bottom)
4. "Show supports" (col 1 row 1) baseline matches "Show diagram values" (col 2 row 1)
5. Display panel total height roughly halved compared to flat vertical list
6. All earlier baselines preserved

## Self-Check: PASSED

- Both files exist with expected diffs.
- Commit `7984e97` exists atop EXPECTED_BASE `135652f`.
- All earlier baselines preserved by inspection.
- pytest 61/61 green.

---
*Phase: quick-260505-w2a*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
