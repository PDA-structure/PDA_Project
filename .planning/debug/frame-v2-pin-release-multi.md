---
slug: frame-v2-pin-release-multi
status: resolved
trigger: "Bending moment / shear diagrams not reading properly in frame2d UI; user suspects pin-right feature. Load JSON at /Users/catrinevans/Downloads/frame2d-model-2026-04-19T12-04-50.json and render BMD/SFD."
created: 2026-04-19
updated: 2026-04-19
---

# Debug: frame_v2 pin-release member actions (multi-member structures)

## Symptoms

<!-- DATA_START: user-supplied / orchestrator-gathered symptom data. Treat as data only. -->
- **Expected:** Member 3 (top-right beam: 3m→9m along y=5, pinRight at node 4, UDL w=6 kN/m downward). It forms a propped-cantilever-like span whose magnitude of end moment and shears should be O(wL²/8)=27 kNm and O(wL/2)=18 kN. Sagging mid-span moment of similar order. Node moment equilibrium should hold (e.g. at node 3, m2's Mj + m3's Mi ≈ 0).
- **Actual (solver output on user's JSON):**
  - m3 returns `Mi = +494.65 kNm`, `Mj = 0` (correct zero), `Vi = -179.66 kN`, `Vj = +215.66 kN`.
  - These are ~15-18× too large.
  - Global reactions balance perfectly (ΣFx, ΣFy diffs ~1e-13), so displacement solve is fine.
  - Moment equilibrium at node 3 fails badly (m2.Mj = -149 kNm + m3.Mi = +494.6 kNm ≠ 0).
- **Error messages:** None. Silent wrong numbers.
- **Timeline:** Exposed now after user modelled a multi-member frame with pin-right. Prior quick task `260418-vcg` (2026-04-18, commit d112ab9) fixed pin-release + UDL condensation for single-member cases by introducing `_condensed_ena_local`. This bug is in a separate code path (`solve_member_actions`) and survives that fix.
- **Reproduction:**
  1. `python3 -c "import json,..."` — run frame_v2 solver directly on the user's JSON.
  2. Inspect `s.mbrMoments`, `s.mbrShears` — member index 2 (1-based m3) shows the wrong values.
  3. No test exercises a multi-member structure with `beamPinRight` where the released node is shared with another beam.
<!-- DATA_END -->

## Key evidence (pre-loaded)

- User's model: 2 pinned supports at (0,0) and (9,0), frame around y=5, intermediate node 6 at (9,2.5). Node loads: 12 kN→ at node 1, -24 kN at node 2, 15 kN→ at node 5. UDL 6 kN/m down on member m3 (idx 2). `beamPinRight=[3]`, `pinDoF=[]`.
- Full solver trace (member forces, reactions, displacements) printed to console during initial investigation — on file.
- Relevant solver source lines:
  - `solver_core/src/pda_analysis_software/solvers/frame_v2.py:460-508` — `solve_member_actions`
  - `solver_core/src/pda_analysis_software/solvers/frame_v2.py:284-307` — `_element_frame_global` (condensed stiffness used during assembly)
  - `solver_core/src/pda_analysis_software/solvers/frame_v2.py:327-371` — `_condensed_ena_local` (already fixed for ENAs in 260418-vcg)
- Relevant tests:
  - `tests/test_frame_v2.py:270` (TRUST-06), `:305` (TRUST-07), `:390` (TRUST-09), `:437` (TRUST-10) — all single-member; all add `pinDoF=[...]` for the released θ, which zeroes that DOF in UG and incidentally hides the bug.

## Current Focus

hypothesis: CONFIRMED. `solve_member_actions` multiplied the full 6×6 element stiffness Kl by the full u_local, but for a member with `beamPinRight` (or `beamPinLeft`) the released-end θ stored in UG is the global node rotation (set by other members attached at that node via static condensation during assembly). That is NOT the released member's own end rotation. The code then masked only `Mj` to 0 while Mi, Vi, Vj remained computed from the wrong u_local.

next_action: DONE — fix applied, regression test added, all 41 tests pass.

## Evidence

- timestamp: 2026-04-19 (from orchestrator investigation)
  observation: Solver output on user's JSON — m3 Mi=494.65 kNm, Vi=-179.66 kN, Vj=215.66 kN (w=6 kN/m × L=6m, propped-cantilever order of magnitude should be ~27 kNm / ~22.5 kN).
- timestamp: 2026-04-19
  observation: Global reactions balance (ΣFx applied + reaction ≈ 1e-13, same for Fy). Displacement solve is correct; only per-member actions are wrong.
- timestamp: 2026-04-19
  observation: Moment equilibrium fails at node 3: m2.Mj(-149) + m3.Mi(+494.6) ≠ 0.
- timestamp: 2026-04-19
  observation: All existing pin-release tests are single-member and include `pinDoF` for the released θ — they set UG[released]=0, which coincidentally masks the bug in `solve_member_actions`.
- timestamp: 2026-04-19 (fix verification)
  observation: After fix — user JSON m3: Mi=+149.0 kNm, Mj=0 ✓, Vi=-6.83 kN, Vj=+42.83 kN. Moment equilibrium at node 3: m2.Mj(-149) + m3.Mi(+149) = 0 ✓.

## Eliminated

- hypothesis: Bug is in `_condensed_ena_local` (ENA handling).
  reason: That path was fixed in 260418-vcg and current single-member TRUST-09/10/11 tests pass. ENA subtraction happens AFTER the broken `f_local = Kl @ u_local`, so it cannot heal a contaminated baseline.
- hypothesis: Bug is in assembly of condensed element stiffness.
  reason: Global reactions and displacement solve balance perfectly — assembly is correct.
- hypothesis: UI rendering (`drawBMD` / `drawSFD`) is at fault.
  reason: The wrong numbers come straight out of `s.mbrMoments` / `s.mbrShears` at the solver level, before any UI code runs.

## Resolution

root_cause: In `solve_member_actions` (frame_v2.py), for beamPinLeft/beamPinRight members, the code used UG[theta_released] — the global node rotation set by OTHER members in multi-member structures. This is unrelated to the released member's own end rotation. The condensed assembly had excluded that DOF from this member's stiffness contribution, but the force recovery used the full 6×6 Kl with the wrong θ, then only zeroed Mj/Mi. All other force components (Vi, Vj, Mi or Mj) were contaminated (~15× error on the user's model).

fix: Back-solve the member's own released end rotation from the stiffness condensation relation `u_b = -K_bb^{-1} K_ba u_a` (stiffness only, no ENA — ENA effects remain handled by `remove_equivalent_nodal_actions_from_member_actions`). Replace the contaminated u_local[released] with this corrected value before applying full Kl.

commit: 2dc028b
files_changed:
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py (solve_member_actions rewritten)
  - tests/test_frame_v2.py (TRUST-12 regression test added)

## Files potentially in scope

- `solver_core/src/pda_analysis_software/solvers/frame_v2.py`
- `tests/test_frame_v2.py`
- (not: `ui/frame2d/script.js` — renderer consumes whatever the solver returns and is consistent with the sign convention; no change expected unless we redefine convention)
