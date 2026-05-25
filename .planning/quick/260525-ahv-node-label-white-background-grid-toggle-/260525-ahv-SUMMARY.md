---
phase: quick-260525-ahv
plan: 01
subsystem: ui
tags: [canvas, node-labels, grid-toggle, truss2d, frame2d]
dependency_graph:
  requires: []
  provides: [node-label-bg, grid-toggle]
  affects: [ui/truss2d/script.js, ui/frame2d/script.js, ui/truss2d/index.html, ui/frame2d/index.html]
tech_stack:
  added: []
  patterns: [ctx.measureText for text width, cssVar() for theme-aware canvas colors]
key_files:
  created: []
  modified:
    - ui/truss2d/script.js
    - ui/frame2d/script.js
    - ui/truss2d/index.html
    - ui/frame2d/index.html
decisions:
  - truss2d node label bg uses literal rgba(255,255,255,0.85) (no design tokens in truss2d CSS)
  - frame2d node label bg uses cssVar('--canvas-label-bg') — token already existed in style.css at line 90/642
  - chkGrid in truss2d uses inline onchange="draw()" matching existing checkbox pattern in that UI
  - chkGrid in frame2d uses addEventListener matching existing pattern in that UI
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25T06:40:33Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 4
---

# Phase quick-260525-ahv Plan 01: Node Label White Background + Grid Toggle Summary

**One-liner:** White background rect behind canvas node labels (measureText width, theme-aware) plus Show grid checkbox in Display panel of both solver UIs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add white background behind node labels | 26315bd | ui/truss2d/script.js, ui/frame2d/script.js |
| 2 | Add Show grid checkbox toggle to both UIs | 481fe63 | ui/truss2d/index.html, ui/frame2d/index.html, ui/truss2d/script.js, ui/frame2d/script.js |
| 3 | Browser UAT | — | checkpoint:human-verify (skipped per plan instructions) |

## What Was Built

**Task 1 — Node label white backgrounds:**

Both `drawNodeLabels()` functions now draw a filled background rectangle behind each label before rendering the text. Implementation:
- Extracts `fontSize` as a variable (before the loop in frame2d; inside the branch in truss2d)
- Uses `ctx.measureText(label).width` for accurate text width
- Draws `fillRect(n.x + 8 - pad, n.y - 8 - th, tw + 2*pad, th + pad)` where `pad=2`, `th = fontSize * 1.3`
- truss2d: literal `rgba(255,255,255,0.85)` (no design-token system in truss2d CSS)
- frame2d: `cssVar('--canvas-label-bg')` — token was already defined at `:root` (rgba 255,255,255,0.88) and `[data-theme="dark"]` (rgba 22,26,32,0.88), so dark-mode backing rect works automatically

**Task 2 — Show grid checkbox:**

- truss2d: `<input type="checkbox" id="chkGrid" checked onchange="draw()">` added as first item in Display section (before Show deflected shape)
- truss2d `draw()`: `if (!exportMode) drawGrid()` → `if (!exportMode && document.getElementById('chkGrid')?.checked) drawGrid()` — exportMode still suppresses grid regardless
- frame2d: `<input type="checkbox" id="chkGrid" checked>` added as first item in left `display-col`
- frame2d `draw()`: `drawGrid()` → `if (document.getElementById('chkGrid')?.checked) drawGrid()`
- frame2d: `document.getElementById('chkGrid').addEventListener('change', draw)` appended after `chkNodeLabels` listener

## Decisions Made

1. **truss2d uses literal rgba, not cssVar** — truss2d/style.css has no design token system (all hardcoded hex). Using `cssVar()` would require adding it to truss2d/script.js or style.css, which is out of scope. The literal white matches the light background truss2d always uses.
2. **frame2d --canvas-label-bg already existed** — the token was introduced in a prior session for `labelText()` helper. No CSS changes needed.
3. **chkGrid checked by default** — both UIs: grid visible on load, matching prior behaviour before this change.

## Deviations from Plan

None — plan executed exactly as written. The `--canvas-label-bg` CSS token for frame2d was already present from a previous session (no new CSS needed), which is a simpler outcome than the plan anticipated.

## Verification

```
grep -c 'measureText' ui/truss2d/script.js   → 2 (drawNodeLabels + drawLegend)
grep -c 'measureText' ui/frame2d/script.js   → 3 (drawNodeLabels + drawLegend + labelText)
grep -c 'chkGrid' ui/truss2d/index.html      → 1
grep -c 'chkGrid' ui/frame2d/index.html      → 1
pytest 66/66 green
```

## Known Stubs

None.

## Threat Flags

None — all changes are client-side canvas rendering and HTML checkbox toggles. No API calls, no user input processing, no data persistence affected.

## Self-Check: PASSED

- ui/truss2d/script.js modified: FOUND (commit 26315bd + 481fe63)
- ui/frame2d/script.js modified: FOUND (commit 26315bd + 481fe63)
- ui/truss2d/index.html modified: FOUND (commit 481fe63)
- ui/frame2d/index.html modified: FOUND (commit 481fe63)
- chkGrid in all 4 target locations: FOUND (verified via grep)
- measureText + fillRect in both drawNodeLabels: FOUND (verified via grep)
- pytest 66/66: PASSED
