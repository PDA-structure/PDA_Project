---
phase: quick-260505-vhi
plan: 01
subsystem: ui
status: incomplete
tags: [frame2d, html, css, layout, display-card]

provides:
  - Display card body rendered as 2-column CSS grid
  - Column 1 = items 1-5 (Show supports/loads/deflected/BMD/SFD)
  - Column 2 = items 6-12 (Show diagram values/node labels + 4 inputs + theme toggle)
  - Compact Display card that fits within toolbar without pushing other cards down

affects: [frame2d-ui, display-card-layout]

key-files:
  modified:
    - "ui/frame2d/index.html — wrapped Display body items in <div class=\"display-body\">"
    - "ui/frame2d/style.css — migrated 5 tke selectors from `> label` to `.display-body > label`; added `.display-body { display: grid; grid-template-columns: 1fr 1fr }` + column-placement rules using `:has(#chkDiagLabels)` + general sibling combinator `~`"

key-decisions:
  - "CSS Grid + :has() + ~ for split point — declarative and concise (3 selectors); no JS, no per-item ordering attributes."
  - "Default column 1, opt-in column 2 — items 1-5 inherit `grid-column: 1`; chkDiagLabels and its general siblings opt into `grid-column: 2`. Browser places them in row order within their assigned column."
  - "Existing tke selectors migrated to use `.display-body >` (one extra level of nesting). The :has(#chkDeflected) Display-scoping continues to work transparently."

requirements-completed: [VHI-01, VHI-02, VHI-03]

duration: 3min
completed: 2026-05-05
---

# Quick Task 260505-vhi: Display 2-Column Split Summary

**Split Display card body into 2 columns at chkDiagLabels using CSS Grid + :has() selectors. Single commit `df9730f` building on v7c.**

## Performance

- **Duration:** ~3 min (HTML wrapper + CSS grid layout, inline execution)
- **Tasks:** 1 of 2 executor-completed; Task 2 = `checkpoint:human-verify` PENDING
- **Files modified:** 2 (`ui/frame2d/index.html`, `ui/frame2d/style.css`)

## Accomplishments

- **HTML wrapper added** — Display card body items (12 elements: 7 checkboxes + 4 inputs + theme toggle) wrapped in `<div class="display-body">` between `<summary>` and `</details>`.
- **CSS Grid layout** — `.display-body` is a 2-column grid. Items default to column 1; `chkDiagLabels` and all its general siblings (`~ *`) opt into column 2. Result: items 1-5 (visibility checkboxes for supports/loads/deflected/BMD/SFD) flow down column 1; items 6-12 (chkDiagLabels onwards, including the input rows + theme toggle) flow down column 2.
- **Tke selectors migrated** — 5 existing tke `>` direct-child selectors updated to `.display-body >` to remain valid after the wrapper insertion.

## Task Commits

1. **Task 1: Display 2-column grid (HTML + CSS)** — `df9730f` (feat) atop EXPECTED_BASE `403082d`
2. **Task 2: Browser UAT — Display 2-column visible + fits in toolbar** — **PENDING HUMAN UAT**

## Diffstat (against base `403082d`)

```
 ui/frame2d/index.html | 76 +++++++++++++++++++++++++-------------------------
 ui/frame2d/style.css  | 28 ++++++++++++++++----
 2 files changed, 62 insertions(+), 42 deletions(-)
```

Most index.html changes are indentation reflow from the new `<div class="display-body">` wrapper.

Scope contract held:
- No `solver_core/` change
- No `api_server/` change
- No `tests/` change
- No `ui/truss2d/` change
- No `ui/frame2d/script.js` change
- No new design tokens

## Verifier Gates (all 5 green)

1. `display-body` wrapper present in HTML ✓
2. `.display-body { display: grid; grid-template-columns: 1fr 1fr }` rule present ✓
3. `chkDiagLabels` split rule present at lines 342-343 ✓
4. 5 tke selectors migrated from `> label` to `.display-body > label`; 0 leftover `> label` direct-child selectors ✓
5. `pytest -q` → 61 passed ✓

## Pending Browser UAT (Task 2)

Refresh `http://127.0.0.1:8000/ui/frame2d/index.html` with hard-reload (Cmd+Shift+R), open Display card. Verify:

1. **2-column layout visible** — Display card body now has two parallel columns
2. **Column 1 contents** (top to bottom): Show supports, Show loads, Show deflected shape, Show bending moment diagram, Show shear force diagram
3. **Column 2 contents** (top to bottom): Show diagram values, Node labels, Deflection scale × input, BMD/SFD scale × input, Symbol size × input, Label size × range, Theme toggle button
4. **Toolbar stays single row** — Display card now fits within the toolbar width without pushing Reset View / SOLVE to a second row
5. **Medium-large frame test** — solve a structure with several members, open Display, results panel still on the right (v7c), canvas still occupies the left
6. **All earlier baselines preserved** — light/dark theme, sq0 panel styling, button density (u2h), cards-closed default (uzg), results sidebar (v7c)

## Tradeoffs

- **Display card is wider** (now 2 columns instead of 1) but **shorter** (5 rows tall instead of 12). Wider, shorter is the right tradeoff for a horizontal toolbar.
- **CSS Grid is well-supported** but requires `:has()` (Dec 2023+ in major browsers — no concern for Mac Safari + Windows laptop targets).

## Self-Check: PASSED

- Both files exist with expected diffs.
- Commit `df9730f` exists atop EXPECTED_BASE `403082d`.
- All earlier baselines (sq0, tke, u2h, uzg, v7c) byte-equivalent in their owned rules.
- pytest 61/61 green.

---
*Phase: quick-260505-vhi*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
