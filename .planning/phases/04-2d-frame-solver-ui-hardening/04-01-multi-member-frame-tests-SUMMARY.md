---
phase: 04-2d-frame-solver-ui-hardening
plan: 01
subsystem: testing
tags: [pytest, frame_v2, fem, multi-member, pin-release, spring-support, regression]

requires:
  - phase: 03-interchange-format-and-external-inputs
    provides: FrameV2Adapter pipeline used end-to-end by TRUST-16
provides:
  - 5 new analytical pytest cases (TRUST-13..TRUST-17) covering multi-member frame topologies, pin-release combinations, spring supports, and series cantilever / propped-cantilever
affects: [04-02, 04-03, future frame solver work]

tech-stack:
  added: []
  patterns:
    - "Multi-member analytical FEM verification via portal frame, two-span continuous beam with pin release + UDL, mixed bilateral pin release at shared node, spring-supported simple beam, cantilever + propped-cantilever in series"

key-files:
  created: []
  modified:
    - tests/test_frame_v2.py

key-decisions:
  - "TRUST-16 uses FrameV2Adapter end-to-end (not direct solver call) to lock in the spring pipeline through the adapter layer"
  - "TRUST-17 hand-derives propped-cantilever reactions from compatibility (slope-deflection) so analytical reference values are exact, not snapshots"

patterns-established:
  - "Each multi-member test asserts moment equilibrium at every internal joint (ΣM=0) in addition to reaction and displacement checks"
  - "Pin-release tests assert M=0 at the released end of the affected member (proves condensation and member-action recovery are consistent)"

requirements-completed: [HARDEN-01]

duration: ~14m
completed: 2026-04-19
---

# Phase 04 Plan 01: Multi-Member Frame Tests Summary

**5 new analytical pytest cases (TRUST-13..17) covering portal frame, two-span continuous beam with pin release + UDL, mixed bilateral pin release at shared node, spring-supported simple beam, and cantilever + propped-cantilever in series — all 20 frame_v2 tests green.**

## Performance

- **Duration:** ~14 min (executor agent runtime to first/second commit; orchestrator cherry-picked onto main after a base-mismatch in the worktree)
- **Started:** 2026-04-19T15:13Z
- **Completed:** 2026-04-19T16:22Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- TRUST-13: portal frame with UDL on beam, pinned column bases — symmetric reactions, joint moment equilibrium at beam-column corners
- TRUST-14: two-span continuous beam with `beamPinRight` on span 1 + UDL on span 1 only — M=0 at released end, correct span 1 / span 2 reactions
- TRUST-15: mixed `beamPinLeft` on span 2 + `beamPinRight` on span 1 at shared interior node — M=0 on both released ends at the shared node
- TRUST-16: simply-supported beam with Ky spring at one end, end-to-end via FrameV2Adapter — verifies reaction = K·δ
- TRUST-17: cantilever + propped cantilever in series with interior moment release — hand-derived reactions and rotations match
- All prior TRUST-01..TRUST-12 still pass (no regression)

## Task Commits

1. **Task 1: TRUST-13/14/15 multi-member frame tests** — `38e56a1` (test) [cherry-picked from worktree commit `83c8948`]
2. **Task 2: TRUST-16/17 spring + propped-cantilever tests** — `e1d9ad7` (test) [cherry-picked from worktree commit `b400f7a`]

**Plan metadata:** SUMMARY.md committed by orchestrator (worktree-base recovery — see "Issues Encountered")

## Files Created/Modified
- `tests/test_frame_v2.py` — adds 5 functions `test_trust_13_*` through `test_trust_17_*` (268 net new lines)

## Decisions Made
- TRUST-16 deliberately routes through `FrameV2Adapter` rather than calling `frame_v2.add_spring_stiffnesses` directly — the goal is to lock in the entire `FrameModel2D → adapter → solver` pipeline for spring DOFs (key-link `FrameV2Adapter\(.*springDoF` per plan frontmatter).
- TRUST-17 derives propped-cantilever reactions analytically from compatibility (Δ=0 at the prop), so the reference values are exact closed-form expressions, not snapshots — preserves the project's "analytical verification, not regression snapshot" testing convention.

## Deviations from Plan

None substantive in the test code itself. All test commits modify only `tests/test_frame_v2.py` as the plan's `files_modified` field specified.

## Issues Encountered

**Worktree base mismatch (orchestrator-side recovery, not a plan deviation).** The git worktree spawned for this plan was created from commit `2dc028b` (the most recent ancestor common with main) instead of from the orchestrator's expected base `6202da4`. The agent's `worktree_branch_check` did not reset to the correct base, and the agent then timed out (`Stream idle timeout`) before writing SUMMARY.md. The two test commits themselves (`83c8948`, `b400f7a`) only modified `tests/test_frame_v2.py` and applied cleanly when cherry-picked onto main as `38e56a1` and `e1d9ad7`. Pytest in main confirms all 20 frame_v2 tests pass after the cherry-pick. The original worktree branch `worktree-agent-a5777503` is no longer needed and was removed.

## User Setup Required

None — pure test additions, no external services or env vars.

## Next Phase Readiness
- TRUST-16's FrameV2Adapter spring pipeline is now under analytical regression — Plan 04-02's UI spring support work and Plan 04-03's UAT spring fixture both depend on this guarantee.
- All 20 frame_v2 tests pass after cherry-pick — clean baseline for Plan 04-02 merge and Plan 04-03 fixture authoring.

---
*Phase: 04-2d-frame-solver-ui-hardening*
*Completed: 2026-04-19*
