---
phase: quick-260505-vhi
plan: 01
subsystem: ui
expected_base: 403082d
tags: [frame2d, html, css, layout, display-card]
---

# Plan 260505-vhi-01 — Display card 2-column split

**Goal:** Split the Display card body into 2 columns at `#chkDiagLabels` so a medium-large frame's open Display card occupies less vertical space inside the toolbar.

## Tasks

### Task 1 — Wrap Display body + apply CSS Grid (HTML + CSS)

**Files:** `ui/frame2d/index.html`, `ui/frame2d/style.css`

**HTML:** Wrap all Display card body items (7 checkboxes + 4 number/range inputs + theme toggle button) in `<div class="display-body">`. Insertion point: after `<summary>Display</summary>`, close `</div>` before `</details>`.

**CSS:**
- Migrate existing tke `>` direct-child selectors to use `.display-body >` (since labels are now grandchildren of `<details>`):
  - `details.card:has(#chkDeflected) > label` → `details.card:has(#chkDeflected) .display-body > label`
  - `details.card:has(#chkDeflected) > label.panel-label` → `details.card:has(#chkDeflected) .display-body > label.panel-label`
  - `details.card:has(#chkDeflected) > label input[type="number"]` → `details.card:has(#chkDeflected) .display-body > label input[type="number"]`
  - (5 selectors total)
- Add new `.display-body` grid rule:
  - `display: grid; grid-template-columns: 1fr 1fr; column-gap: var(--space-3); row-gap: 2px; align-items: start`
- Add column-placement rules:
  - All children default to `grid-column: 1`
  - `.checkbox-label:has(#chkDiagLabels)` and its general siblings (`~ *`) get `grid-column: 2` — moves chkDiagLabels and everything after it (chkNodeLabels, all 4 input rows, theme toggle) into column 2

### Task 2 — Browser UAT (checkpoint:human-verify)

**Action:** User refreshes (Cmd+Shift+R). Verifies:
1. Display card opens to a 2-column layout
2. Column 1 contains items 1-5: Show supports, Show loads, Show deflected shape, Show BMD, Show SFD
3. Column 2 contains items 6-12: Show diagram values, Node labels, Deflection scale, BMD/SFD scale, Symbol size, Label size, Theme toggle
4. Display card width fits within toolbar; no longer pushes other cards to a second row when open
5. All earlier baselines preserved

## Constraints (binding)

- Two files only — `ui/frame2d/index.html` + `ui/frame2d/style.css`
- No JS changes (interactive elements keep their IDs and event handlers)
- No new design tokens
- All earlier baselines preserved (sq0 contrast, tke vertical-stack, u2h density, uzg cards-closed, v7c results sidebar)
- Existing tke `:has(#chkDeflected)` Display-scoping pattern continues to work
