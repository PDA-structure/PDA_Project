---
title: "frame2d: resolve pure-bar joint instability in mixed beam/bar models"
status: pending
priority: P1
source: "promoted from /gsd-note"
created: 2026-04-22
updated: 2026-04-22
theme: solver
---

## Goal

Resolve the `frame_v2` singularity that occurs when every member meeting at a joint is a bar element. In the 3-DOF/node formulation, bars contribute stiffness only to Ux/Uy (`frame_v2.py:309-324`), so the θ DOF at a pure-bar joint has zero stiffness → singular `Ks` → 422 "Structure is unstable". The model is structurally valid; the failure is a formulation limitation.

## Context

Promoted from quick note captured on 2026-04-22.

Triggered by testing a Pratt/Warren-style hybrid in the frame2d UI (top chord beams with UDL, bottom chord + diagonals as bars, pinned at N1 and N6). Solver returned HTTP 422. Per-node θ audit identified N2 and N4 as pure-bar joints causing the singularity.

Test model: `/Users/catrinevans/Downloads/frame2d-model-2026-04-22T06-14-49.json`
Source note: `.planning/notes/2026-04-22-frame2d-pure-bar-joint-instability.md`
Backlog parking-lot: roadmap item 999.5 (commit dae8401).

Also spotted (secondary): `apply_equivalent_nodal_actions` skips bars entirely (`frame_v2.py:376`) — a UDL applied to a bar is silently dropped. Worth flagging in UI too.

## Workaround 1 Outcome — tested, FAILED (2026-04-22)

Added Kθ = 1e-3 N·m/rad spring supports at the pure-bar joints (N2, N4) and solved. The 422 went away, but the results were physically wrong:

- **Moment appeared at both pinned end supports.** Supports at N1 and N6 were pinned — they cannot carry moment. Non-zero reaction moments indicate the nominal spring is doing more than "just desingularising"; it's leaking rotational constraint back into the load path.
- **The 6 m horizontal beam carried both compression and tension axial force** within the same member under a single load case. Inconsistent — a single prismatic member under a static load set should show a single-sign axial at each cross-section (or at worst pass through zero once for a specific loading, not oscillate).
- **Pinned end supports developed horizontal reactions** not justified by the applied load pattern.

**Implication:** the spring trick isn't usable as a validation workaround — the numerics are "solvable" but the mechanics are corrupted. The proper fix (detect pure-bar joints and eliminate/restrain θ DOF structurally) is the only acceptable path. Workaround 2 (convert bottom chord to short beam) is also off the table for the same reason — you'd be masking the issue, not diagnosing it.

## Acceptance Criteria

- [x] ~~Validate workaround 1: add Kθ = 1e-3 spring supports at N2 and N4~~ — **tested; failed (see "Workaround 1 Outcome" above)**
- [x] ~~Verify results against hand-calculated reactions and top-chord moments~~ — **moot; workaround invalidated**
- [x] Decide on enhancement path — **pursue proper fix; promote from backlog 999.5 via `/gsd-insert-phase` when ready to schedule**
- [ ] Detect pure-bar joints during assembly in `frame_v2.assemble_primary_stiffness_matrix` and eliminate or implicitly restrain the θ DOF at those joints
- [ ] Add analytical verification test: hybrid beam+bar model (pinned ends, pure-bar interior joints) where hand-calc reactions/moments are known; confirm no phantom moment at pins and single-sign axial in beams under clean loading
- [ ] **Testing hygiene** — any test added here must assert correct solver behaviour WITHOUT relying on incidental DOF zeroing via `pinDoF`, `restrainedDoF`, or similar masks. Background: prior to commit 2dc028b (2026-04-19, TRUST-12), every single-member pin-release test had `pinDoF=[released θ]`, which zeroed that DOF in UG and accidentally masked a multi-member pin-release bug in `solve_member_actions` for weeks. See `.planning/debug/frame-v2-pin-release-multi.md` for the full investigation. The pure-bar case is in the same θ-DOF-provenance family — do not repeat the same testing trap.
- [ ] Cover the secondary finding: `apply_equivalent_nodal_actions` currently skips bars (`frame_v2.py:376`) — decide whether to raise at solve-time or silently drop with UI warning, then implement
- [ ] UI warning on canvas for joints with zero rotational stiffness before solve (pre-empt the 422)
- [ ] Replace generic "Structure is unstable" (422) with a descriptive message naming the offending node(s) and cause
