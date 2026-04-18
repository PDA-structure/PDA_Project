---
created: 2026-04-18T15:26:15.842Z
title: Fix frame_v2 pin-release and UDL condensation
area: solver
files:
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py:336-339
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py:459-462
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py:481-484
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py:512-515
  - tests/test_frame_v2.py
---

## Problem

`beamPinLeft` / `beamPinRight` combined with a UDL produces incorrect bending moments. Pre-existing bug, predates Phase 3 (not a regression — reported during Phase 3 human UAT).

In `frame_v2.py` the pin-release handling zeroes only the far-end `ENMoment` but leaves the rest of the equivalent nodal actions at their fixed-fixed values:

```python
if m in self.beamPinLeft:  mi = 0.0
if m in self.beamPinRight: mj = 0.0
```

This appears in `apply_equivalent_nodal_actions` (lines 336-339), `remove_equivalent_nodal_actions_from_reactions` (481-484), and `remove_equivalent_nodal_actions_from_member_actions` (512-515). The element stiffness IS condensed correctly via `_condense_release` at line 265 — the inconsistency is that the ENA vector is NOT condensed the same way.

For a UDL `w` on a horizontal beam length `L` with `pinRight`, the applied equivalent nodal action vector is currently:

| Component | Applied (wrong)        | Correct propped cantilever |
| --------- | ---------------------- | -------------------------- |
| `fy_i`    | `-wL/2`                | `-5wL/8`                   |
| `fy_j`    | `-wL/2`                | `-3wL/8`                   |
| `m_i`     | `+wL²/12`              | `+wL²/8`                   |
| `m_j`     | `0` (correctly zeroed) | `0`                        |

The result is a hybrid that represents no real beam. Bending moment diagram is wrong in both magnitude and shape.

**Reproduced by user** on 2026-04-18 with a real portal-frame model: 6 nodes, 5 members, UDL `6000 N/m` on a 6 m horizontal beam, `beamPinRight` set on that member. Saved model in `~/Downloads/frame2d-model-2026-04-18T16-18-54.json`.

## Solution

1. Apply the same static condensation formula used for stiffness to the local ENA vector:

   ```
   f_c = f_a - K_ab · K_bb⁻¹ · f_b
   ```

   where `f_a` / `f_b` partition the 6-component local ENA `[0, fy_i, m_i, 0, fy_j, m_j]` by kept vs released DOFs. This must happen BEFORE the ENA is rotated to global and added to `force_vector`. Apply the same correction in the two ENA-removal functions so reaction and member-action post-processing stay consistent.

2. Factor out the condensation so the same logic runs in all four places (`apply_`, `remove_..._reactions`, `remove_..._member_actions`, and `_element_frame_global`). Currently the pattern is copy-pasted — that's how the inconsistency crept in.

3. Add regression tests covering the gap that existing tests miss:
   - Propped cantilever via `beamPinRight` + UDL: assert `M_i == wL²/8`, `M_j == 0`, reactions `5wL/8` (fixed end) and `3wL/8` (pinned end).
   - Symmetric: `beamPinLeft` + UDL.
   - Both-ends released (simply supported via pin releases) + UDL: ENA should degenerate to point loads `wL/2` at each node, `M_i = M_j = 0`.

4. Re-run the user's portal frame model through the fixed solver and confirm the bending moment diagram matches hand calculation.

**Why existing tests missed it:** `test_propped_cantilever_udl` (TRUST-07) uses a real roller support, not `beamPinRight`. `test_pin_release_beam_pin_right` (TRUST-06) uses a point load, not a UDL. The combination was never covered.

**Phase link:** Surfaced during Phase 3 human UAT. Not blocking Phase 3 completion (Phase 3 is about the interchange format, not the solver). Candidate for a decimal phase (`/gsd-insert-phase 3.1`) or a standalone bug-fix phase after v1.1.
