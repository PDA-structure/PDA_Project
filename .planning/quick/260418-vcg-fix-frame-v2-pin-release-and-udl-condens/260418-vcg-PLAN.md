---
phase: quick-260418-vcg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py
  - tests/test_frame_v2.py
autonomous: true
requirements:
  - BUGFIX-FRAME-V2-PIN-RELEASE-UDL
must_haves:
  truths:
    - "A horizontal beam with `beamPinRight=[1]` under downward UDL `w` over length `L` reports `mbrMoments[0,0] == +wL²/8` (fixed-end) and `mbrMoments[0,1] == 0` (released end)."
    - "The same beam reports vertical reactions of `5wL/8` at the fixed end and `3wL/8` at the pinned/released end, summing to `wL`."
    - "With `beamPinLeft=[1]` instead, the solver reports a mirrored propped-cantilever bending moment pattern with zero moment at the released i-end."
    - "With BOTH `beamPinLeft=[1]` and `beamPinRight=[1]` under UDL, both end moments are zero and reactions are `wL/2` at each node (simply supported via releases)."
    - "All pre-existing frame_v2 tests (TRUST-01…TRUST-08) continue to pass — no regression from the static-condensation refactor."
  artifacts:
    - path: "solver_core/src/pda_analysis_software/solvers/frame_v2.py"
      provides: "Private helper `_condensed_ena_local(e, mi, mj, fyi, fyj)` that returns a 6-component local ENA vector with static condensation applied for pin releases, used consistently by `apply_equivalent_nodal_actions`, `remove_equivalent_nodal_actions_from_reactions`, and `remove_equivalent_nodal_actions_from_member_actions`."
      contains: "_condensed_ena_local"
    - path: "tests/test_frame_v2.py"
      provides: "Three new regression tests: TRUST-09 (pinRight + UDL), TRUST-10 (pinLeft + UDL), TRUST-11 (both-end release + UDL)."
      contains: "test_propped_cantilever_via_beam_pin_right_udl"
  key_links:
    - from: "apply_equivalent_nodal_actions"
      to: "_condensed_ena_local"
      via: "called before T.T @ ENA_local global rotation"
      pattern: "_condensed_ena_local"
    - from: "remove_equivalent_nodal_actions_from_reactions"
      to: "_condensed_ena_local"
      via: "same helper used so FG removal is consistent with what was applied"
      pattern: "_condensed_ena_local"
    - from: "remove_equivalent_nodal_actions_from_member_actions"
      to: "_condensed_ena_local"
      via: "subtracts condensed local ENA from member shears/moments"
      pattern: "_condensed_ena_local"
---

<objective>
Fix a pre-existing bug in `solver_core/src/pda_analysis_software/solvers/frame_v2.py`: when a beam member has `beamPinLeft` / `beamPinRight` AND a UDL (via ENForces/ENMoments), the solver zeroes only the far-end moment but does NOT apply static condensation to the equivalent nodal action (ENA) vector. The element stiffness IS condensed (via `_condense_release` at line 265), leaving the ENA inconsistent with the stiffness. Result: bending moment diagram is wrong in both magnitude and shape.

Purpose: propped-cantilever-via-pin-release is a common structural idealisation. Currently it produces numerical garbage. Fix the ENA condensation so stiffness and ENA are consistent.

Output:
- One private helper `_condensed_ena_local` on `BeamBarStructure_v2` applying `f_c = f_a − K_ab · K_bb⁻¹ · f_b` to the local 6-component ENA.
- Three call sites updated to use the helper (apply / remove-from-reactions / remove-from-member-actions).
- Three regression tests (TRUST-09, TRUST-10, TRUST-11) covering pinRight+UDL, pinLeft+UDL, both-ends-released+UDL.
- All existing tests still pass.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/todos/pending/2026-04-18-fix-frame-v2-pin-release-and-udl-condensation.md
@solver_core/src/pda_analysis_software/solvers/frame_v2.py
@tests/test_frame_v2.py

<interfaces>
<!-- Key methods on BeamBarStructure_v2 that Task 1 will extend. Extracted from solver_core/src/pda_analysis_software/solvers/frame_v2.py -->

Existing local 6x6 element stiffness (used to build K_aa / K_ab / K_bb for ENA condensation):
```python
@staticmethod
def _K_local_frame_6x6(E, A, I, L) -> np.ndarray  # 6x6 in local axes [Nx_i, Vy_i, M_i, Nx_j, Vy_j, M_j]
```

Existing static condensation helper used for stiffness (Task 1 mirrors this formula for ENA):
```python
@staticmethod
def _condense_release(K, release_dofs) -> (Kc, keep)
    # Kc = Kaa − Kab · Kbb⁻¹ · Kba
```

Call sites that currently zero only the far-end moment (lines 336-339, 481-484, 512-515):
```python
if m in self.beamPinLeft:  mi = 0.0
if m in self.beamPinRight: mj = 0.0
```

Local ENA vector shape (6×1 column, rotated to global via T.T):
```python
ENA_local = np.array([[0, fyi, mi, 0, fyj, mj]]).T   # [Nx_i, Vy_i, M_i, Nx_j, Vy_j, M_j]
```

Local-DOF indices for moment releases (same convention as `_condense_release` for Kg):
- release at i-end rotation → local DOF index 2 (M_i)
- release at j-end rotation → local DOF index 5 (M_j)
</interfaces>

<domain_notes>
<!-- Physics/FEM context the executor needs to verify correctness without re-deriving. -->

**Static condensation of ENA (same formula as stiffness):**
Partition the 6-component local ENA `f = [0, fy_i, m_i, 0, fy_j, m_j]` by kept DOFs `a` and released DOFs `b` (the same partition `_condense_release` uses on the 6×6 K). Condensed ENA on kept DOFs:

    f_c = f_a − K_ab · K_bb⁻¹ · f_b

Values at released DOFs vanish (consistent with zero moment there).

**Expected local ENA vectors for a horizontal beam with downward UDL `w`, length `L`:**

| Case                                | Applied local ENA `[Nx_i, Vy_i, M_i, Nx_j, Vy_j, M_j]`       |
|------------------------------------ |--------------------------------------------------------------|
| No release (fixed-fixed ENA)        | `[0, -wL/2,  +wL²/12, 0, -wL/2, -wL²/12]` (existing input)   |
| `beamPinRight` only (fixed i, pin j)| `[0, -5wL/8, +wL²/8,  0, -3wL/8,  0       ]`                 |
| `beamPinLeft` only (pin i, fixed j) | `[0, -3wL/8,  0,      0, -5wL/8, -wL²/8  ]`                  |
| Both ends released                  | `[0, -wL/2,   0,      0, -wL/2,   0       ]`                 |

Note the sign of `M_j` in the pinLeft case: the solver's UDL input convention has `M_j = -wL²/12` (negative) for fixed-fixed. After condensing out the released `M_i`, the resulting fixed j-end moment is `-wL²/8` in the solver's sign convention — trace through `_condense_release` mechanics to confirm rather than flipping a sign by hand.

**Why mbrMoments[0,0] for TRUST-09 is `+wL²/8` (positive):**
In the fixed-fixed UDL input, `ENMoments = [+wL²/12, -wL²/12]` → `M_i = +wL²/12`. For the propped cantilever (fixed at i, pinned at j), the fixed-end moment magnitude is `wL²/8` and carries the same sign as the applied `M_i` after condensation. After `solve_member_actions` computes `M_i = f_local[2,0]` from `Kl @ u_local` and `remove_equivalent_nodal_actions_from_member_actions` subtracts the condensed ENA moment, the final reported `mbrMoments[0,0]` must equal `+wL²/8` for TRUST-07's geometry replicated via pin-release instead of real roller.

**Hard rules (CLAUDE.md):**
- `solver_core` has NO matplotlib, NO printing in computation path.
- DOF numbering: 1-based in public API, 0-based internally.
- UDL sign convention unchanged: positive = downward → `ENForces = [-wL/2, -wL/2]`, `ENMoments = [+wL²/12, -wL²/12]` for fixed-fixed. Condensation happens INSIDE the solver; UI/API input format does NOT change.

**Out of scope:**
- UI / Pydantic / adapter changes — the fix is internal to `BeamBarStructure_v2`.
- Manual verification of the user's `~/Downloads/frame2d-model-2026-04-18T16-18-54.json` portal frame — separate follow-up.
</domain_notes>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add `_condensed_ena_local` helper and use it in all three ENA sites</name>
  <files>solver_core/src/pda_analysis_software/solvers/frame_v2.py</files>
  <behavior>
    Add a private method `_condensed_ena_local(self, e, fyi, mi, fyj, mj) -> np.ndarray` that returns a 6-component column vector (shape `(6,1)`) representing the local ENA for member index `e` with pin releases applied via static condensation, in the same partitioning used by `_condense_release`.

    Behaviour contract:
    - No release (neither `m in beamPinLeft` nor `m in beamPinRight`): returns `[[0, fyi, mi, 0, fyj, mj]].T` unchanged.
    - `beamPinRight` only: partitions local DOFs with `release = [5]` (M_j), computes `Kl` via `_K_local_frame_6x6(E[e], A[e], I[e], L[e])`, and returns
        `[[0, fyi + Δfyi, mi + Δmi, 0, fyj + Δfyj, 0]].T`
      where `Δf_a = - K_ab · K_bb⁻¹ · f_b` with `f_b = [mj]` (1-element) and `f_a = [0, fyi, mi, 0, fyj]` (5-element). The released-DOF component (M_j) is set to 0 in the returned vector.
    - `beamPinLeft` only: same pattern with `release = [2]` (M_i), released component M_i set to 0.
    - Both releases: `release = [2, 5]`, both M_i and M_j set to 0, other four components condensed.

    Unit-level expectations (for a horizontal beam, E=200e9, I=1e-4, A=0.01, L=1.0, w=10000 N/m → fyi=fyj=-5000, mi=+10000/12, mj=-10000/12):
    - `_condensed_ena_local(e, fyi=-wL/2, mi=+wL²/12, fyj=-wL/2, mj=-wL²/12)` with `beamPinRight=[1]` must return components approximately:
        - row 0: `0.0`
        - row 1 (Vy_i): `-5*w*L/8`
        - row 2 (M_i):  `+w*L**2/8`
        - row 3: `0.0`
        - row 4 (Vy_j): `-3*w*L/8`
        - row 5 (M_j):  `0.0`
    - For `beamPinLeft=[1]` with the same inputs:
        - row 1 (Vy_i): `-3*w*L/8`
        - row 2 (M_i):  `0.0`
        - row 4 (Vy_j): `-5*w*L/8`
        - row 5 (M_j):  `-w*L**2/8`
    - For both releases: rows 1 and 4 both equal `-w*L/2`, rows 2 and 5 both equal `0.0`.

    Then replace the copy-pasted blocks at:
    - `apply_equivalent_nodal_actions` (lines 336-339 + construction of `ENA_local` at line 345):
        BEFORE:
          ```python
          if m in self.beamPinLeft:  mi = 0.0
          if m in self.beamPinRight: mj = 0.0
          ...
          ENA_local = np.array([[0, fyi, mi, 0, fyj, mj]]).T
          ```
        AFTER:
          ```python
          ENA_local = self._condensed_ena_local(e, fyi, mi, fyj, mj)
          ```
    - `remove_equivalent_nodal_actions_from_reactions` (lines 481-484 + ENA_local construction at 490): same replacement.
    - `remove_equivalent_nodal_actions_from_member_actions` (lines 512-515 + shear/moment subtraction at 517-520):
        The existing code operates on scalars (`mbrShears[e, 0] -= fyi`, etc.). Build the condensed local ENA once via the helper, then subtract components by index:
          ```python
          ena = self._condensed_ena_local(e, fyi, mi, fyj, mj).reshape(-1)
          self.mbrShears[e, 0]  -= ena[1]   # Vy_i
          self.mbrShears[e, 1]  -= ena[4]   # Vy_j
          self.mbrMoments[e, 0] -= ena[2]   # M_i
          self.mbrMoments[e, 1] -= ena[5]   # M_j
          ```

    Implementation notes:
    - Use `_condense_release` shape-wise if convenient for partitioning, but note it returns `(Kc, keep)` for the stiffness matrix. The ENA condensation needs the SAME `keep` / `release` partition but applied to a vector. Simplest: build `Kl` via `_K_local_frame_6x6`, pick `release_dofs = ([2] if rel_i else []) + ([5] if rel_j else [])`, compute `keep = [i for i in range(6) if i not in release_dofs]`, extract `Kab = Kl[np.ix_(keep, release_dofs)]`, `Kbb = Kl[np.ix_(release_dofs, release_dofs)]`, and compute `f_a_c = f_a − Kab @ np.linalg.inv(Kbb) @ f_b`. Fall back to `np.linalg.pinv` on `LinAlgError` (mirror `_condense_release`).
    - Return a `(6,1)` column vector with zeros written back into the released-DOF slots so callers can keep their existing rotation-to-global step unchanged (`T.T @ ENA_local` still produces correct 6×1).
    - Do NOT print, do NOT import matplotlib, do NOT change any public signature or API. Purely internal refactor + numerical fix.
    - Write a short docstring on `_condensed_ena_local` stating: "Apply static condensation `f_c = f_a − K_ab · K_bb⁻¹ · f_b` to the local ENA for member `e`, zeroing released-DOF components. Uses the same `_K_local_frame_6x6` as assembly for stiffness consistency."
  </behavior>
  <action>
    Open `solver_core/src/pda_analysis_software/solvers/frame_v2.py`.

    1. Add private method `_condensed_ena_local(self, e, fyi, mi, fyj, mj)` under the "loads (equivalent nodal actions)" section comment (near line 326, immediately before `apply_equivalent_nodal_actions`). Implement per the behaviour contract above.

    2. In `apply_equivalent_nodal_actions` (lines 327-354):
       - Remove the `if m in self.beamPinLeft: mi = 0.0` / `beamPinRight` block.
       - Replace `ENA_local = np.array([[0, fyi, mi, 0, fyj, mj]]).T` with `ENA_local = self._condensed_ena_local(e, fyi, mi, fyj, mj)`.
       - Keep everything else (theta, T, global rotation, force_vector accumulation) identical.

    3. In `remove_equivalent_nodal_actions_from_reactions` (lines 470-499): same replacement.

    4. In `remove_equivalent_nodal_actions_from_member_actions` (lines 501-520): replace the zero-moment block AND the four subtraction lines with a single condensed-ENA call and indexed subtraction (see behaviour notes).

    5. Confirm no new imports are needed (numpy, math already imported).

    6. Do NOT touch `_condense_release`, `_element_frame_global`, `solve_member_actions`'s final `Mi=0/Mj=0` clamp at lines 459-462 (keeping it is harmless and defensive; removing it would change what member-action readers see before ENA removal).

    7. Run existing tests to confirm no regression:
       ```bash
       pytest tests/test_frame_v2.py -x -v
       ```
       All 9 existing tests must pass. If TRUST-06 (pin_release + point load) or TRUST-07 (propped cantilever via real roller) breaks, the condensation partitioning is wrong — do not patch the test; fix the helper.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project &amp;&amp; pytest tests/test_frame_v2.py -x -v</automated>
  </verify>
  <done>
    - `_condensed_ena_local` exists as a method on `BeamBarStructure_v2` with a docstring.
    - All three ENA sites (`apply_equivalent_nodal_actions`, `remove_equivalent_nodal_actions_from_reactions`, `remove_equivalent_nodal_actions_from_member_actions`) call the helper — no remaining `if m in self.beamPinLeft: mi = 0.0` pattern in those three methods.
    - All 9 pre-existing tests in `tests/test_frame_v2.py` pass.
    - `grep -n "_condensed_ena_local" solver_core/src/pda_analysis_software/solvers/frame_v2.py` shows 1 definition + 3 call sites = 4 matches.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add TRUST-09, TRUST-10, TRUST-11 regression tests</name>
  <files>tests/test_frame_v2.py</files>
  <behavior>
    Three new tests at end of `tests/test_frame_v2.py`, following the TRUST-XX naming and analytical-assertion style used by existing tests. All three use the solver's standard fixed-fixed UDL input (`ENForces = [-wL/2, -wL/2]`, `ENMoments = [+wL²/12, -wL²/12]`) and delegate the release handling to the solver via `beamPinLeft` / `beamPinRight`.

    **TRUST-09 `test_propped_cantilever_via_beam_pin_right_udl`:**
    - Nodes: `1(0,0)`, `2(L_pc, 0)` with `L_pc = 4.0`; horizontal beam.
    - Member `[1, 2]` with `beamPinRight=[1]`.
    - `restrainedDoF = [1, 2, 3]` (fix Ux, Uy, theta at node 1 — true fixed end).
    - `pinDoF = [6]` (released theta at node 2 must be excluded from reduced system — same reason as TRUST-06).
    - Node 2 must have Uy restrained so it acts as the prop. Since Uy at node 2 is DoF 5, add `5` to `restrainedDoF`: `restrainedDoF = [1, 2, 3, 5]`.
    - `w = 10000.0`, UDL input as fixed-fixed ENA.
    - Assertions:
      - `s.mbrMoments[0, 0] == pytest.approx(w * L_pc**2 / 8, rel=1e-6)` — fixed-end moment.
      - `s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-6)` — released j-end.
      - `s.FG[1, 0] == pytest.approx(5 * w * L_pc / 8, rel=1e-6)` — fixed-end vertical reaction = 25000 N.
      - `s.FG[4, 0] == pytest.approx(3 * w * L_pc / 8, rel=1e-6)` — prop vertical reaction = 15000 N.
      - Equilibrium: `np.isclose(s.FG[1, 0] + s.FG[4, 0] - w * L_pc, 0, atol=1e-6)`.

    **TRUST-10 `test_propped_cantilever_via_beam_pin_left_udl`:**
    - Mirror of TRUST-09: released end at node 1 (i-end), fixed at node 2 (j-end).
    - Nodes identical. Member `[1, 2]` with `beamPinLeft=[1]`.
    - `restrainedDoF = [2, 4, 5, 6]` — fix Uy at node 1 (DoF 2, provides vertical support), fix Ux/Uy/theta at node 2 (DoFs 4, 5, 6).
    - `pinDoF = [3]` — released theta at node 1.
    - Ux at node 1 (DoF 1) must also be restrained for stability — use `restrainedDoF = [1, 2, 4, 5, 6]`.
    - Same `w`, same UDL input.
    - Assertions:
      - `s.mbrMoments[0, 0] == pytest.approx(0.0, abs=1e-6)` — released i-end.
      - `s.mbrMoments[0, 1] == pytest.approx(-w * L_pc**2 / 8, rel=1e-6)` — fixed j-end moment (negative in solver convention, matching the sign of input `mj = -wL²/12`).
      - `s.FG[1, 0] == pytest.approx(3 * w * L_pc / 8, rel=1e-6)` — prop reaction at node 1 = 15000 N.
      - `s.FG[4, 0] == pytest.approx(5 * w * L_pc / 8, rel=1e-6)` — fixed reaction at node 2 = 25000 N.
      - Equilibrium: sum = `w * L_pc`.

    **TRUST-11 `test_simply_supported_via_both_end_pin_releases_udl`:**
    - Both ends released: `beamPinLeft=[1]` AND `beamPinRight=[1]`.
    - Needs a real Ux restraint somewhere (otherwise horizontal rigid-body mode). Pin at node 1 (Ux1, Uy1), rollerY at node 2 (Uy2). `restrainedDoF = [1, 2, 5]`.
    - Both end rotations released → `pinDoF = [3, 6]`.
    - Assertions:
      - `s.mbrMoments[0, 0] == pytest.approx(0.0, abs=1e-6)` — released i-end.
      - `s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-6)` — released j-end.
      - `s.FG[1, 0] == pytest.approx(w * L_pc / 2, rel=1e-6)` — reaction at node 1 = 20000 N.
      - `s.FG[4, 0] == pytest.approx(w * L_pc / 2, rel=1e-6)` — reaction at node 2 = 20000 N.
      - Equilibrium: `np.isclose(s.FG[1, 0] + s.FG[4, 0] - w * L_pc, 0, atol=1e-6)`.

    Docstring / comment header for each test should reference the failure mode the test guards against ("pin-release + UDL was not condensing local ENA — fixed in 260418-vcg").
  </behavior>
  <action>
    Append three tests to `tests/test_frame_v2.py` following the format of TRUST-06 and TRUST-07. Use the existing module-level constants `E`, `I`, `A` where applicable. Use `L_pc = 4.0`, `w = 10000.0` as local test constants to match TRUST-07's numerical scale.

    Each test:
    1. Build `BeamBarStructure_v2` with the geometry/restraints/releases described in the behaviour contract.
    2. Call `s.solve_structure()`.
    3. Assert moments, reactions, and vertical equilibrium per the analytical values above.

    For TRUST-10 specifically: if the sign of `mbrMoments[0, 1]` is unclear from the condensation math, run the test once with a `pytest.approx` on the magnitude and print the actual sign to stdout of the test (via `assert False, f"actual M_j = {s.mbrMoments[0,1]}"`) during development only — then set the assertion to match the solver's sign convention (expected: `-w * L_pc**2 / 8`, because the fixed-fixed input has `m_j = -wL²/12` negative, and condensation preserves that sign). Remove the print before committing.

    Do NOT modify any existing test. Do NOT add new fixtures — these tests are self-contained like TRUST-03 through TRUST-07.

    After writing the tests, run:
    ```bash
    pytest tests/test_frame_v2.py -x -v
    ```
    Expect 12 tests passing (9 existing + 3 new).
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project &amp;&amp; pytest tests/test_frame_v2.py -x -v -k "propped_cantilever_via_beam_pin_right_udl or propped_cantilever_via_beam_pin_left_udl or simply_supported_via_both_end_pin_releases_udl"</automated>
  </verify>
  <done>
    - `tests/test_frame_v2.py` contains three new `def test_...` functions named exactly: `test_propped_cantilever_via_beam_pin_right_udl`, `test_propped_cantilever_via_beam_pin_left_udl`, `test_simply_supported_via_both_end_pin_releases_udl`.
    - All three pass with the Task 1 fix in place.
    - Each test asserts both member moments AND reactions AND vertical equilibrium (three checks minimum).
  </done>
</task>

<task type="auto">
  <name>Task 3: Full test suite green check</name>
  <files>tests/</files>
  <action>
    Run the full project test suite from the repo root to confirm no cross-file regression:
    ```bash
    cd /Users/catrinevans/Documents/pda_project &amp;&amp; pytest tests/ -v
    ```

    Confirm:
    - All pre-existing tests pass (truss2d tests + frame_v2 tests TRUST-01 through TRUST-08).
    - All three new tests (TRUST-09, TRUST-10, TRUST-11) pass.
    - Total test count increased by exactly 3.

    If any test fails, do NOT modify the failing test. Diagnose via the test output, return to Task 1 if the failure is in `frame_v2.py` (helper partitioning wrong) or Task 2 if the failure is in the new tests (sign convention or restraint setup wrong).

    On green: no file changes are required in this task. It exists purely to gate on the full suite before committing.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project &amp;&amp; pytest tests/ -v</automated>
  </verify>
  <done>
    - `pytest tests/ -v` reports all tests passing (previous count + 3).
    - No test was skipped or marked xfail.
    - Output shows the three new test names passing.
  </done>
</task>

</tasks>

<verification>
- `pytest tests/test_frame_v2.py -v` shows 12+ passing tests (9 original + 3 new).
- `pytest tests/ -v` shows full project suite green.
- `grep -n "_condensed_ena_local" solver_core/src/pda_analysis_software/solvers/frame_v2.py` shows the helper defined once and referenced in exactly three call sites (4 matches total).
- No remaining `if m in self.beamPinLeft: mi = 0.0` / `beamPinRight: mj = 0.0` pattern inside `apply_equivalent_nodal_actions`, `remove_equivalent_nodal_actions_from_reactions`, or `remove_equivalent_nodal_actions_from_member_actions`.
- Solver still has NO matplotlib import and NO print statements (CLAUDE.md hard rule).
- UDL sign convention unchanged in public API (UI/adapter send fixed-fixed ENA exactly as before).
</verification>

<success_criteria>
- Propped cantilever via `beamPinRight=[1]` + fixed-fixed UDL input produces `mbrMoments[0,0] = +wL²/8`, `mbrMoments[0,1] = 0`, reactions `5wL/8` and `3wL/8` — matches analytical propped cantilever exactly.
- Symmetric case via `beamPinLeft=[1]` produces mirrored analytical result.
- Both-end release + UDL produces zero end moments and `wL/2` reactions at each node.
- All pre-existing frame_v2 tests continue to pass without modification.
- ENA condensation logic lives in ONE place (`_condensed_ena_local`) — future regressions from drift are prevented.
</success_criteria>

<output>
After completion, create `.planning/quick/260418-vcg-fix-frame-v2-pin-release-and-udl-condens/260418-vcg-SUMMARY.md` summarising:
- Root cause (ENA not condensed, stiffness was)
- Fix (shared helper applying `f_c = f_a − K_ab · K_bb⁻¹ · f_b`)
- Test coverage added (TRUST-09/10/11)
- Any sign-convention discovery for TRUST-10
- Manual follow-up remaining: re-run the user's `frame2d-model-2026-04-18T16-18-54.json` portal frame through the fixed solver and confirm the bending moment diagram matches hand calculation.
</output>
