---
phase: quick-260622-rcm
plan: 01
status: complete
date: 2026-06-22
commits:
  - 9e7030b   # T1 frame2d — drag-threshold gate + off-canvas warning
  - 6071606   # T2 truss2d — mirror drag-threshold gate + off-canvas warning
  - 437b9b7   # T4 frame2d — pre-solve rogue-node scan (loose blocks, too-close warns)
  - 0698715   # T5 truss2d — add validateBeforeSolve() with rogue-node scan
files_modified:
  - ui/frame2d/script.js
  - ui/truss2d/script.js
---

# Quick Task 260622-rcm — frame2d + truss2d Add-Node misclick hardening + pre-solve rogue-node scan

## Goal

Kill the two recurring "accidental node" failure modes in both solver UIs:
1. Stray nodes created by sloppy clicks / click-drags in Add-Node mode.
2. The cryptic **"API error: structure is unstable / under-restrained"** that is actually caused by a rogue (disconnected) node, with no clue which node is at fault.

## What was built

### T1 / T2 — Misclick guards (both UIs)

- **Drag-threshold gate** — left-button down position recorded on `mousedown`; the `click` handler early-returns (places nothing) if the pointer moved more than `CLICK_DRAG_PX` (3 client px) between mousedown and click. Clean taps still place instantly (zero friction). Global gate — also hardens supports/loads modes; cannot break member mode (those clicks land on existing nodes, well under 3 px) or middle-mouse panning (never sets `clickDownX`).
- **Off-canvas place-but-warn** — after a node is placed in `'node'` mode, a screen-bounds test (`screenX = px*view.scale + view.tx` vs `[0, LOGICAL_W]`, same for Y) fires a red `setStatus('Node N placed OFF-SCREEN …', true)` when the node lands outside the visible viewport. Node is still placed (user may have panned away deliberately) but flagged loudly.
- Deviation auto-fixed (Rule 2): truss2d's click handler was missing the `if (isPanning) return;` guard that frame2d had — added.

### T4 / T5 — Pre-solve rogue-node scan (both UIs)

Runs inside `validateBeforeSolve()` (extended in frame2d, **newly added** in truss2d — it had no validation scaffolding):

- **Loose / rogue node → BLOCKS solve.** A node referenced by zero members contributes free DOFs with no stiffness → singular stiffness matrix → the opaque API "unstable / under-restrained" error. Now caught client-side first: offending node(s) highlighted red, actionable 1-based message *"Node N is not connected to any member — delete or connect before solving."*, `return false` so the API error is never reached. Reuses the existing incidence map (frame2d) / a freshly-built one (truss2d).
- **Too-close / coincident node → WARNS (does not block).** Any node pair within **50 mm** (`Math.hypot(dRealX, dRealY) < 0.05`) raises an informational `setStatus` naming the pair(s) and highlights them, but solve proceeds. O(n²) pairwise — negligible at structural scale.
- truss2d gained: an `offendingNodes` module var, the new `validateBeforeSolve()` (loose-block + too-close-warn only — deliberately NOT copying frame2d's pure-bar/UDL-on-bar logic), the `if (!validateBeforeSolve()) return;` hook in `solve()`, and a red-fill (`#e53935`) override for offending nodes in `drawNodes()`.

## Verification

- `node --check` clean on both files.
- `pytest -q` 70/70 green throughout (no Python / solver / API touched).
- Scope contract held: only `ui/frame2d/script.js` and `ui/truss2d/script.js` changed across all four commits.
- **Browser UAT (checkpoint T6): PASSED 2026-06-22.** User confirmed both UIs — frame2d (load frame + add loose node → Solve → red-highlighted node + actionable block message instead of the opaque API error) and truss2d. A stale cached `script.js` initially masked the fix; resolved by hard refresh, and permanently fixed by the `no-cache` headers follow-up (commit `ec3b948`).

## Notes / follow-ups

- The off-screen warning (T1/T2) is now largely *superseded* by the loose-node scan (T4/T5) for the original debug-session failure mode — a disconnected node is caught regardless of whether it is on-screen — but it was kept as a cheap, complementary guard.
- Originating todo: `.planning/todos/done/2026-05-23-frame2d-accidental-node-placement.md` (backed by 2 prior UAT incidents). Memory: `feedback_check_stray_offcanvas_node_first`.
