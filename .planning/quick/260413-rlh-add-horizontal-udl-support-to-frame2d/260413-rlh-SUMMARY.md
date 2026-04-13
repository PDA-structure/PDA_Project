---
phase: quick
plan: 260413-rlh
subsystem: frame2d
tags: [udl, horizontal-load, frame2d, api, ui]
dependency_graph:
  requires: []
  provides: [horizontal-udl-w_x]
  affects: [api_server/app.py, ui/frame2d/script.js, ui/frame2d/index.html]
tech_stack:
  added: []
  patterns: [optional-api-field-backward-compat, equivalent-nodal-force-assembly]
key_files:
  created: []
  modified:
    - api_server/app.py
    - ui/frame2d/script.js
    - ui/frame2d/index.html
decisions:
  - "Horizontal UDL X-forces assembled server-side into forceVector (not via ENForces) — ENForces remains vertical-only to match solver's ENForces-to-Y-DOF convention"
  - "Fixed-end moments from w_x merged into ENMoments alongside any vertical UDL contributions"
  - "UI sends udl_x as plain array of floats (0 for no load); API field is Optional with None default for backward compat"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-13T18:57:05Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Quick Task 260413-rlh: Add Horizontal UDL Support to Frame2D Summary

**One-liner:** Horizontal UDL (w_x) added end-to-end — UI two-prompt input, blue perpendicular canvas arrows, and server-side equivalent nodal X-force plus fixed-end moment assembly into the existing solver pipeline.

## What Was Built

Per-member horizontal UDL support for wind-loaded columns and distributed lateral loads:

1. **API (app.py):** `Frame2DRequest` gains `udl_x: Optional[List[float]] = None`. Before building `FrameModel2D`, the server computes equivalent nodal X-forces (`-wx*L/2` at each end) added to `forceVector`, and fixed-end moments (`+wx*L^2/12` start, `-wx*L^2/12` end) added to `ENMoments`. `ENForces` remains vertical-only. Missing `udl_x` field is fully backward-compatible.

2. **UI script.js:** `members.push` initializes `udl_x: null`. Clicking a member in UDL mode now prompts for w_y then w_x (single `saveHistory()` call keeps undo atomic). `solve()` payload includes `udl_x` array. `drawUDLs()` renders blue (`#0288d1`) perpendicular arrows with kN/m label for members with `udl_x != null`.

3. **UI index.html:** UDL button tooltip updated to mention both axes.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | e9c4543 | feat(260413-rlh): add udl_x field to Frame2DRequest and assemble horizontal UDL forces server-side |
| 2    | 43bb4a1 | feat(260413-rlh): add horizontal UDL (w_x) to frame2d UI — prompt, storage, payload, and canvas rendering |

## Verification Results

- **API test (cantilever column, w_x = 1000 N/m, L = 3m, fixed base):** Status 200, Ux at free end = -8.4375e-4 m (nonzero — PASS)
- **Backward compat:** POST without `udl_x` field uses None default, no code path taken — existing behaviour unchanged
- **Static checks:** `udl_x: null` init, payload field, horizontal prompt text, `#0288d1` arrow colour — all present
- **Full test suite:** 20/20 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. The `udl_x` field is validated by Pydantic as `Optional[List[float]]` and the assembly loop is bounded by `len(req.members)` (no new attack surface beyond T-rlh-01 and T-rlh-02 in the plan's threat model, both accepted).

## Self-Check: PASSED

- api_server/app.py modified: FOUND
- ui/frame2d/script.js modified: FOUND
- ui/frame2d/index.html modified: FOUND
- Commit e9c4543: FOUND
- Commit 43bb4a1: FOUND
