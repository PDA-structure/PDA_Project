---
phase: quick-260505-vxu
plan: 01
subsystem: ui
expected_base: b13797c
tags: [frame2d, css, layout, display, fix]
---

# Plan 260505-vxu-01 — Display checkbox-labels render inline (fix)

**Goal:** Halve the Display card's vertical height by reverting checkbox-label rendering from "checkbox stacked above text" (vertical, 2-line per item) back to "checkbox beside text" (inline, 1-line per item). User reported "Show supports" not visually in line with "Show diagram values" — root cause was each checkbox+text pair taking 2 lines.

## Root cause

The u2h-followup rule (commit `2c85ec5`) intended to stack the bare-label-with-input pairs (Deflection scale, BMD/SFD scale, etc.) vertically:

```css
details.card:has(#chkDeflected) .display-body > label,
details.card:has(#chkDeflected) .display-body > label.panel-label {
  display: flex;
  flex-direction: column;
  ...
}
```

But the selector `> label` matches **all** `<label>` direct children — including `<label class="checkbox-label">` since `.checkbox-label` IS a `<label>`. Combined with tke's `flex-direction: column !important` on `.checkbox-label`, every checkbox+text rendered with the input ABOVE the text instead of inline beside it.

Each row was ~30px tall instead of ~14px — Display panel double its needed height.

## Tasks

### Task 1 — Narrow the column-flex rule + simplify tke checkbox rule (CSS)

**File:** `ui/frame2d/style.css`

**Action:**
1. Narrow u2h-followup selector to exclude `.checkbox-label`:
   - `details.card:has(#chkDeflected) .display-body > label, details.card:has(#chkDeflected) .display-body > label.panel-label` → `details.card:has(#chkDeflected) .display-body > label:not(.checkbox-label)`
   - The `:not(.checkbox-label)` makes the column-flex apply only to bare `<label>` (input pairs) and `.panel-label`, not to checkbox-labels.
2. Simplify tke checkbox rule — remove inert flex properties (no `display: flex` was set anywhere on `.checkbox-label`, so `flex-direction`, `align-items`, `gap` were all ineffective):
   - Remove: `flex-direction: column !important;`, `align-items: flex-start;`, `gap: 2px !important;`
   - Keep: `font-size: 11px;`, `margin-bottom: 2px;`

After: `.checkbox-label` reverts to default `display: inline` (browser default for `<label>`), so the checkbox `<input>` and its text-node render inline next to each other on a single line.

### Task 2 — Browser UAT (checkpoint:human-verify)

**Action:** User refreshes (Cmd+Shift+R). Verifies:
1. Each Display checkbox renders on a single line: `☐ Show supports`, `☐ Show loads`, etc.
2. "Show supports" (col 1, row 1) and "Show diagram values" (col 2, row 1) visually aligned at the top
3. Display panel total height roughly halved — toolbar layout no longer wraps when Display is open
4. Bare `<label>` items (Deflection scale ×, BMD/SFD scale ×, Symbol size, Label size) still stack their inputs vertically below the label text (unchanged from u2h-followup)
5. All earlier baselines preserved

## Constraints (binding)

- One file only — `ui/frame2d/style.css`
- No HTML changes
- No JS changes
- No new design tokens
- All earlier baselines preserved
