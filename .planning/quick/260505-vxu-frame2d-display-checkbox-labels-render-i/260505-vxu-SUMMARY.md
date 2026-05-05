---
phase: quick-260505-vxu
plan: 01
subsystem: ui
status: incomplete
tags: [frame2d, css, layout, display, fix]

provides:
  - Display checkbox-labels render inline (checkbox beside text, single line)
  - Display panel vertical height ~halved
  - "Show supports" and "Show diagram values" visually aligned at the top of the 2-column grid

key-files:
  modified:
    - "ui/frame2d/style.css — simplified tke checkbox-label rule (removed inert flex properties); narrowed u2h-followup column-flex rule with `:not(.checkbox-label)` so it only applies to bare-label/panel-label items"

duration: 1min
completed: 2026-05-05
---

# Quick Task 260505-vxu: Display Checkbox-Labels Inline Fix

**Halve Display panel vertical height by removing the inadvertent column-flex layout from checkbox-labels. They now render inline (checkbox beside text, single line) instead of stacked (checkbox above text, two lines). Single CSS-only commit `906badc` building on b13797c.**

## Performance

- **Duration:** ~1 min (4-line CSS edit, inline execution)
- **Tasks:** 1 of 2 executor-completed; Task 2 = `checkpoint:human-verify` PENDING
- **Files modified:** 1 (`ui/frame2d/style.css`)

## Accomplishments

- **Checkbox-labels back to inline rendering** — each `<label class="checkbox-label">` now uses default `display: inline`. Browser renders checkbox + text node on one line: `☐ Show supports`. No more double-tall rows.
- **Bare labels (input pairs) still stack** — Deflection scale ×, BMD/SFD scale ×, Symbol size, Label size still render with the label text on top of the input below (column-flex preserved by the `:not(.checkbox-label)` selector).
- **Net 4 lines removed** from style.css (inert properties + redundant duplicate selector simplified).

## Task Commits

1. **Task 1: Narrow column-flex selector + simplify tke checkbox rule** — `906badc` (fix) atop EXPECTED_BASE `b13797c`
2. **Task 2: Browser UAT** — **PENDING HUMAN UAT**

## Diffstat (against base `b13797c`)

```
 ui/frame2d/style.css | 6 +-----
 1 file changed, 1 insertion(+), 5 deletions(-)
```

Scope contract held:
- No HTML, JS, or solver changes
- No new design tokens
- All earlier baselines preserved (sq0, tke, u2h, uzg, v7c, vhi)

## Verifier Gates (all 4 green)

1. tke `.checkbox-label` rule simplified to `font-size: 11px; margin-bottom: 2px` only ✓
2. u2h-followup rule selector now `> label:not(.checkbox-label)` (excludes checkbox-labels) ✓
3. No `flex-direction: column` applied to `.checkbox-label` anywhere ✓
4. `pytest -q` → 61 passed ✓

## Pending Browser UAT (Task 2)

Refresh `http://127.0.0.1:8000/ui/frame2d/index.html` (Cmd+Shift+R). Verify:
1. Open Display card → each checkbox renders as `☐ <label text>` on a SINGLE line
2. Display panel total height is roughly half what it was before
3. Both columns now visually aligned at the top — "Show supports" and "Show diagram values" on the same row baseline
4. Bare-label inputs (Deflection scale ×, BMD/SFD scale ×, Symbol size, Label size) still have their input below the label text
5. Theme toggle still renders correctly
6. All earlier baselines preserved

## Self-Check: PASSED

- File `ui/frame2d/style.css` has both expected diffs.
- Commit `906badc` exists atop EXPECTED_BASE `b13797c`.
- pytest 61/61 green.

---
*Phase: quick-260505-vxu*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
