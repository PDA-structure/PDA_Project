---
phase: quick-260413-t8l
plan: "01"
subsystem: frame2d
tags: [bugfix, ux, frame2d, udl, wind-load]
dependency_graph:
  requires: [260413-rlh]
  provides: [correct-wx-inclined-members, udl-floating-panel, horizontal-wx-arrows]
  affects: [api_server/app.py, ui/frame2d/script.js, ui/frame2d/index.html]
tech_stack:
  added: []
  patterns: [direction-cosine-decomposition, floating-panel-ui]
key_files:
  created: []
  modified:
    - api_server/app.py
    - ui/frame2d/script.js
    - ui/frame2d/index.html
decisions:
  - "Use Option B (project in app.py, solver unchanged): keeps solver pure FEM, all w_x logic in one place"
  - "Floating panel replaces both prompt() calls: single-click UX, Apply/Cancel/Escape, pre-populated"
  - "Global-X horizontal arrows regardless of member orientation: visually consistent with wind load convention"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-13"
  tasks_completed: 3
  files_modified: 3
---

# Quick Task 260413-t8l: Improve Horizontal UDL UX and Correctness

**One-liner:** Direction-cosine FEF decomposition for w_x on inclined members, floating UDL panel replacing double prompt(), and global-X horizontal arrow rendering.

## What Was Done

### Task 1: Fix w_x assembly in app.py for inclined members (commit: 2952ba0)

The prior implementation (260413-rlh) injected w_x directly into X-DOFs of the global force vector using `-wx*L/2` at each node. This is correct only for vertical columns (theta=90 deg) where the global-X load is fully transverse to the member. For all other orientations the fixed-end forces were wrong.

Fix: added `import math` and replaced the 4-line injection with a full 6-component local-frame FEF calculation followed by `T^T` rotation to global:
- Compute `theta = atan2(dy, dx)`, `c = cos(theta)`, `s = sin(theta)`
- Decompose w_x into local axial (`wx_a = wx*c`) and local transverse (`wx_t = -wx*s`)
- Compute 6 local fixed-end forces
- Rotate via `T^T`: `fx_g = c*fx_loc - s*fy_loc`, `fy_g = s*fx_loc + c*fy_loc`, moments unchanged
- Inject X and Y global force components into `fv`, moment components into `en_moments`

Special case verification:
- Horizontal beam (theta=0): pure axial, no transverse, no moments — correct
- Vertical column (theta=90 deg): correct global X forces matching beam-on-elastic-foundation convention
- 45 deg member: both axial and transverse components now correctly decomposed

### Task 2: Replace double-prompt UDL input with floating panel (commit: 0dcd8c3)

Replaced two sequential `prompt()` calls with a single floating panel div (`id="udlPanel"`) in index.html. The panel:
- Appears centered on screen when user clicks a member in UDL mode
- Pre-populates w_y and w_x from current member values
- Apply saves both values (0 clears to null), Cancel discards, Escape dismisses
- Zero calls to `prompt()` remain in the UDL path

### Task 3: Fix w_x arrow rendering to global-X direction (commit: 3241b02)

Replaced perpendicular-to-member arrow rendering (which used `perpX`/`perpY` unit vectors) with horizontal arrows drawn in the global X direction:
- Arrows always horizontal regardless of member orientation
- `baseOffsetX = arrowLen * sign` offsets the baseline horizontally
- Arrowhead is a filled triangle with vertical (±y) extent
- Visually consistent with wind load convention and server-side assembly

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- 20 tests pass (was 10 frame_v2 + 10 truss2d; 20 total including prior work)
- No `prompt()` calls in UDL path
- w_x arrows use `baseOffsetX`, no `perpX`/`perpY` in w_x rendering block
- Manual checkpoint (Task 4) required for visual/functional browser verification

## Known Stubs

None. All UDL paths are wired to real data.

## Threat Flags

None. No new network endpoints or auth paths introduced. Existing Pydantic float validation on `udl_x` unchanged.

## Self-Check

### Files exist:
- api_server/app.py: modified (import math + direction-cosine w_x assembly)
- ui/frame2d/index.html: modified (udlPanel div added)
- ui/frame2d/script.js: modified (_udlActiveMemberIdx, panel wiring, horizontal arrows)

### Commits:
- 2952ba0: fix(quick-260413-t8l-01): correct w_x assembly for inclined members via direction-cosine decomposition
- 0dcd8c3: feat(quick-260413-t8l-01): replace double-prompt UDL input with floating panel
- 3241b02: fix(quick-260413-t8l-01): render w_x arrows horizontally (global-X direction)

## Self-Check: PASSED
