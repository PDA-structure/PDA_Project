---
created: 2026-04-19T12:04:58.827Z
title: Multi-member frame solver test coverage
area: testing
priority: high
files:
  - tests/test_frame_v2.py
  - solver_core/src/pda_analysis_software/solvers/frame_v2.py
---

## Problem

Existing frame_v2 tests (TRUST-01 through TRUST-12) are mostly single-member cases. All pin-release tests (TRUST-06, 07, 09, 10) use `pinDoF=[...]` to explicitly remove the released θ DOF from the reduced system. This coincidentally forced `UG[released]=0`, which masked a real multi-member force-recovery bug: `solve_member_actions` was using the global θ from UG (set by *other* members at a shared node) instead of the released member's own end rotation. The bug surfaced only when a user loaded a realistic frame (6 nodes, mixed pin-release + UDL, shared interior node) — Mi was ~18× too large.

The bug is now fixed (commit 2dc028b, TRUST-12 regression added), but the root test gap remains: there is almost no multi-member coverage for cases involving released rotations, mixed UDLs, and shared interior nodes. The same force-recovery logic will be inherited by the 3D frame solver (Phase 6). Hardening it here before it gets copy-pasted into 3D is cheap insurance.

## Solution

Add multi-member regression tests exercising:

1. **Portal frame with pinned column bases + beam-column joints.** Check moment distribution at joints; assert ΣM = 0 at each shared node.
2. **Continuous two-span beam, interior node shared, one member `beamPinRight` at the shared node.** UDL on one span. Verify member-end moments, shears, and that the sum at the shared node equals the external nodal moment (zero if none applied).
3. **Mixed pinLeft + pinRight on adjacent members sharing a node.** Edge case for the back-solve in `solve_member_actions` when both members at a node have the released θ.
4. **UDL on a bar element's neighbour where the bar connects at a released node.** Guard against any bar/beam interaction issues.
5. **Cantilever + propped cantilever combination** (two members in series with one pinned support and one roller, interior moment-release). Analytical hand-calc available.

All tests should:
- Assert global equilibrium (ΣFx, ΣFy, ΣM at supports)
- Assert node-level moment equilibrium at every shared interior node
- Assert M=0 at every released end
- Where possible, compare to closed-form analytical solutions (sympy or hand-derived)

Target: 5–8 new tests. Run time budget: <2s total added to the suite.
