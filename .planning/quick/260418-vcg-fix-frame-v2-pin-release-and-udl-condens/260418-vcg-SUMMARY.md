---
phase: quick-260418-vcg
plan: 01
subsystem: solver_core
tags: [bugfix, frame_v2, pin-release, udl, static-condensation, regression-tests]
requires:
  - BeamBarStructure_v2._K_local_frame_6x6
  - BeamBarStructure_v2._condense_release
provides:
  - _condensed_ena_local helper on BeamBarStructure_v2
  - TRUST-09/10/11 regression coverage for pin-release + UDL
affects:
  - apply_equivalent_nodal_actions
  - remove_equivalent_nodal_actions_from_reactions
  - remove_equivalent_nodal_actions_from_member_actions
tech-stack:
  added: []
  patterns:
    - static condensation applied to ENA vector (mirroring stiffness-side condensation)
    - single-source-of-truth helper replaces three copy-pasted "zero far-end moment" blocks
key-files:
  created: []
  modified:
    - solver_core/src/pda_analysis_software/solvers/frame_v2.py
    - tests/test_frame_v2.py
decisions:
  - "Use the existing _K_local_frame_6x6 as the stiffness source for ENA condensation — guarantees ENA and element stiffness use the same partitioning as _condense_release"
  - "Preserve the defensive Mi=0/Mj=0 clamp in solve_member_actions (lines 500-503) — harmless now that ENA is condensed, and removing it would expose numerical noise in post-condensation readers"
  - "Skip tests/test_interchange.py in the Task 3 gate — pre-existing ImportError (api_server not on PYTHONPATH) is unrelated to this fix and out of scope"
metrics:
  duration: "343s"
  tasks_completed: 3
  tests_added: 3
  tests_total_passing: 32
  completed: "2026-04-18T21:43Z"
---

# Quick Task 260418-vcg: Fix frame_v2 pin-release + UDL condensation Summary

Condense the local equivalent-nodal-action (ENA) vector via `f_c = f_a − K_ab · K_bb⁻¹ · f_b` when a beam member has `beamPinLeft` / `beamPinRight`, so that ENA stays consistent with the already-condensed element stiffness — fixes wrong bending-moment diagrams on propped-cantilever-via-pin-release models under UDL.

## Root Cause

Before this fix, when a beam member had a pin release AND a UDL:

- The element **stiffness** was condensed correctly at line 265 via `_condense_release` (produces a 5×5 or 4×4 stiffness block with the released rotation removed).
- The equivalent-nodal-action **vector** was NOT condensed. The three ENA sites only zeroed the far-end moment (`mi = 0.0` if pinned at i, `mj = 0.0` if pinned at j) but did not redistribute the UDL's contribution from the released rotation DOF back onto the kept DOFs.

Physically: a UDL on a fixed-fixed beam contributes `[−wL/2, +wL²/12, −wL/2, −wL²/12]` (Vy_i, M_i, Vy_j, M_j). When the j-end rotation is released, the moment there really is zero — but the shear distribution shifts from `wL/2` + `wL/2` at each end to `5wL/8` + `3wL/8` (propped cantilever). Zeroing only `M_j` omits that shear shift, so the solver assembled an inconsistent equivalent force system: correct element stiffness, wrong ENA, wrong answer.

The stiffness and ENA must use the **same partitioning**, and the standard FEM trick for both is static condensation: `f_c = f_a − K_ab · K_bb⁻¹ · f_b`, using the same `K` as assembly.

## Fix

One private helper on `BeamBarStructure_v2`:

```python
def _condensed_ena_local(self, e, fyi, mi, fyj, mj) -> np.ndarray  # shape (6, 1)
```

- Returns the 6-component local ENA unchanged when the member has neither release.
- Partitions the local 6×6 stiffness `_K_local_frame_6x6` into `Kaa / Kab / Kbb` with the released rotation DOF(s) as the released partition (`2` for i-end, `5` for j-end, both for full release).
- Applies `f_a − Kab · Kbb⁻¹ · f_b` to the ENA vector and writes the result back into the kept DOF rows. Released-DOF rows stay zero by construction (`np.zeros((6,1))` initialised).
- Falls back to `np.linalg.pinv` on singular `Kbb` (mirrors the existing `_condense_release` guard).

Three call sites now call this helper and remove the inline "zero the far-end moment" blocks:

1. `apply_equivalent_nodal_actions` — builds `ENA_local` via the helper, then the existing `T.T @ ENA_local` global rotation and force-vector accumulation steps are unchanged.
2. `remove_equivalent_nodal_actions_from_reactions` — same helper for FG removal, so what is applied is exactly what is subtracted back out.
3. `remove_equivalent_nodal_actions_from_member_actions` — condensed local ENA is computed once via the helper, then components `[1, 4, 2, 5]` are subtracted from `mbrShears` / `mbrMoments` by index (replacing the previous scalar-by-scalar subtractions).

The defensive `Mi=0/Mj=0` clamp at the end of `solve_member_actions` was intentionally retained — it is harmless now that the ENA is condensed correctly, and removing it would expose numerical noise to callers that read `mbrMoments` between `solve_member_actions` and `remove_equivalent_nodal_actions_from_member_actions`.

## Test Coverage Added

Three new regression tests at the end of `tests/test_frame_v2.py`:

| Test | Case | Key assertions |
|------|------|----------------|
| **TRUST-09** `test_propped_cantilever_via_beam_pin_right_udl` | `beamPinRight=[1]` + UDL, node 1 fixed, node 2 propped | `mbrMoments[0,0] ≈ −wL²/8`, `mbrMoments[0,1] ≈ 0`, reactions `5wL/8` / `3wL/8`, sum = `wL` |
| **TRUST-10** `test_propped_cantilever_via_beam_pin_left_udl` | `beamPinLeft=[1]` + UDL, mirror of TRUST-09 | `mbrMoments[0,0] ≈ 0`, `mbrMoments[0,1] ≈ +wL²/8`, reactions `3wL/8` / `5wL/8`, sum = `wL` |
| **TRUST-11** `test_simply_supported_via_both_end_pin_releases_udl` | `beamPinLeft=[1]` AND `beamPinRight=[1]` + UDL, pin at node 1, rollerY at node 2 | `mbrMoments[0,:] ≈ 0`, reactions `wL/2` each, sum = `wL` |

All three fail without the fix (pre-fix: wrong moment magnitudes and sometimes wrong shear splits). All three pass with the helper in place.

## Sign-convention Discovery (TRUST-09 / TRUST-10)

The plan predicted `mbrMoments[0, 0] = +wL²/8` for TRUST-09 (fixed i-end) based on the assumption that the condensed ENA's sign at the kept `M_i` row would propagate unchanged through `solve_member_actions` + `remove_equivalent_nodal_actions_from_member_actions`. The actual solver output is `−wL²/8`.

Crucially, **TRUST-07** (real-roller propped cantilever, no pin release) also reports `mbrMoments[0, 0] = −20000` for the identical geometry. So:

- The solver's internal sign convention for a hogging fixed-end moment at the **i-end** of a frame member is **negative**.
- At the **j-end** (TRUST-10) the same hogging sense comes out **positive** — the 3-DoF frame formulation flips rotation sign between ends.
- **TRUST-09 and TRUST-07 now produce identical `mbrMoments`** — the pin-release path correctly reproduces the real-roller behaviour, which is the strongest confirmation that the fix works.
- The analytical propped-cantilever magnitude (`wL²/8`) and the reaction split (`5wL/8` / `3wL/8`) are exactly right — only the plan's predicted sign for `M_i` was off.

Test assertions were set to the solver's actual convention. This is a plan-prediction correction, not a solver change.

## Deviations from Plan

### Rule 1 — Bug: Plan's predicted sign for TRUST-09 `mbrMoments[0, 0]` was wrong

- **Found during:** Task 2 (first run of TRUST-09)
- **Issue:** Plan asserted `mbrMoments[0, 0] == +wL²/8` for TRUST-09 and `mbrMoments[0, 1] == −wL²/8` for TRUST-10. Solver produces the opposite signs (`−wL²/8` at fixed i-end, `+wL²/8` at fixed j-end). TRUST-07's real-roller propped cantilever reports the same i-end sign as TRUST-09, confirming the solver is self-consistent and the plan's prediction was incorrect.
- **Fix:** Updated assertions to match the solver's established sign convention. Added a comment in each test citing TRUST-07 as the reference. Solver behaviour unchanged.
- **Files modified:** `tests/test_frame_v2.py`
- **Commit:** `1f8d3ae`

### Scope boundary — Deferred

**`tests/test_interchange.py` pre-existing import error:** `ModuleNotFoundError: No module named 'api_server'`. Verified this fails identically on the pre-task base commit (`a5d597e`), so it is not caused by this fix. Out of scope for quick-task 260418-vcg. The full suite gate (Task 3) was run with `--ignore=tests/test_interchange.py` and passed 32/32. Separate task recommended to add `conftest.py` or a `pyproject.toml` `pytest` config that puts the repo root on `sys.path`, so `from api_server.app import app` resolves.

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | fix | `f3ef99b` | condense local ENA for pin-released beam members |
| 2 | test | `1f8d3ae` | add TRUST-09/10/11 regression tests for pin-release + UDL |

## Verification

- `pytest tests/test_frame_v2.py -v` → **14 passed** (11 pre-existing + 3 new)
- `pytest tests/ --ignore=tests/test_interchange.py -v` → **32 passed, 0 failed**
- `grep -n "_condensed_ena_local" solver_core/src/pda_analysis_software/solvers/frame_v2.py` → **4 matches** (1 def + 3 call sites) ✓
- `grep -n "if m in self.beamPinLeft:\s*mi = 0.0"` in `frame_v2.py` → **0 matches** in the three ENA methods ✓
- `grep -n "import matplotlib\|^print\|\sprint("` in `frame_v2.py` → **0 matches** (CLAUDE.md hard rule satisfied) ✓

## Manual Follow-up Remaining

- Re-run the user's `~/Downloads/frame2d-model-2026-04-18T16-18-54.json` portal frame (the model that originally exposed this bug) through the fixed solver via the frame2d UI. Confirm the bending moment diagram now matches hand calculation. This is a visual / UI-level check and was not scripted in the automated suite.
- No action needed on any stub: scan of modified files found no TODOs, placeholders, or unwired data sources.

## Self-Check: PASSED

Verified files created/modified:
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — FOUND, `_condensed_ena_local` helper present at line 327, 3 call sites confirmed via grep
- `tests/test_frame_v2.py` — FOUND, 14 tests collected, 3 new TRUST-XX tests present

Verified commits exist:
- `f3ef99b` — FOUND in `git log --oneline`
- `1f8d3ae` — FOUND in `git log --oneline`
