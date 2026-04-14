---
phase: quick-260414-roe
plan: 01
subsystem: ui/truss2d
tags: [zoom, pan, view-transform, display-toggles, node-labels, stress-column, ux]
dependency_graph:
  requires: []
  provides: [truss2d-zoom-pan, truss2d-view-reset, truss2d-node-labels, truss2d-display-toggles, truss2d-stress-column]
  affects: [ui/truss2d/script.js, ui/truss2d/index.html]
tech_stack:
  added: []
  patterns: [canvas-setTransform-view-state, toWorld-coordinate-helper, middle-mouse-pan, wheel-zoom-cursor-anchored]
key_files:
  created: []
  modified:
    - ui/truss2d/script.js
    - ui/truss2d/index.html
decisions:
  - Grid and all canvas drawing occurs after setTransform so zoom/pan applies uniformly to grid and structure
  - chkSupports and chkLoads default to checked to preserve existing behavior on page load
  - Node label font not scaled by getSymbolScale() to keep DOF labels readable at all zoom levels (plan spec uses fixed '600 11px Arial'); node dot size and node number font ARE scaled
  - sigma column header uses HTML entity &sigma; for correct rendering without special encoding
metrics:
  duration: ~15 minutes
  completed: 2026-04-14
---

# Quick Task 260414-roe: Truss2d UI — Zoom/Pan, Display Toggles, Node Labels, Stress Column

**One-liner:** Cursor-anchored scroll-wheel zoom + middle-mouse pan with toWorld() coordinate mapping, independent supports/loads/node-label toggles, symbol-scaled fonts, and a sigma (MPa) column in the Member Forces table.

## What Was Built

### Task 1 — script.js

1. **View transform state** — `let view = { scale, tx, ty }` + pan state variables added after `_lastBlobUrl`.
2. **`toWorld(clientX, clientY)`** — converts screen client coords to canvas world coords accounting for view transform and flex-layout scale correction.
3. **`resetView()`** — resets view to scale=1, tx=ty=0 and redraws; accessible globally via `onclick`.
4. **`draw()` rewritten** — opens with `ctx.setTransform(1,0,0,1,0,0)` + `clearRect` + `ctx.setTransform(view.scale,0,0,view.scale,view.tx,view.ty)`. Grid draws after transform so it zooms/pans with the structure.
5. **Click handler** — replaced raw `(e.clientX - rect.left) * scaleX` math with `toWorld(e.clientX, e.clientY)`.
6. **Mousemove handler** — pan logic runs first (early return if isPanning); coordinate display uses `toWorld()` result.
7. **Wheel zoom** — cursor-anchored with factor 1.15; uses `{ passive: false }` to allow `preventDefault()`.
8. **Middle-mouse pan** — `mousedown` (button===1), `mouseup`, `mouseleave` listeners.
9. **`drawNodeLabels()`** — renders `N{i} [{2i+1},{2i+2}]` labels (2 DOF/node); called from `draw()` when `chkNodeLabels` is checked.
10. **Supports/loads toggles** — `drawSupports()` and `drawLoads()` wrapped in `chkSupports`/`chkLoads` guards.
11. **Font scaling** — `drawMemberLabel()` and `drawNodes()` now use `Math.round(Npx * getSymbolScale())`.
12. **Stress column** — `renderResults()` reads `res.meta?.member_stresses?.[idx]`, divides by 1e6, appends as fifth `<td>` per member row.

### Task 2 — index.html

- Reset View button added to Edit section (`onclick="resetView()"`).
- Three new checkboxes in Display section: `chkSupports` (checked), `chkLoads` (checked), `chkNodeLabels` (unchecked); all use `onchange="draw()"`.
- Member Forces table header updated to include `&sigma; (MPa)` column.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All features are wired end-to-end. The stress column shows `—` when `res.meta.member_stresses` is absent (which is the current API behavior since `Truss2DAdapter` does not yet populate `member_stresses`). This is correct graceful degradation, not a stub — the column is present and will display values once the adapter is updated.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check

Files exist:
- ui/truss2d/script.js: modified
- ui/truss2d/index.html: modified

Commits:
- 317e69c: feat(quick-260414-roe-01) — script.js
- 3877eca: feat(quick-260414-roe-02) — index.html

## Self-Check: PASSED
