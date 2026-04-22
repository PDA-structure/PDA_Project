---
date: "2026-04-22 06:28"
promoted: true
---

# frame2d: "Structure is unstable" when bars meet at a pure-bar joint

## Context

Testing a mixed beam/bar model in the frame2d UI — a Pratt/Warren-style truss with a continuous top-chord beam carrying UDL, bottom chord + diagonals as bars. Pinned at both top-chord ends. Solver returns HTTP 422: "Structure is unstable or under-restrained" when Solve is clicked.

## Test model

- File: `/Users/catrinevans/Downloads/frame2d-model-2026-04-22T06-14-49.json`
- Schema: v1.0, solver `frame2d`
- 6 nodes, 8 members (5 bars + 3 beams), UDL 10 kN/m on top chord, pinned at N1 and N6
- Top chord (beams): members 6,7,8 (N1-N3, N3-N5, N5-N6) with UDL
- Bottom chord + diagonals (bars): members 1-5

## Diagnosis

Structurally valid model. FEM formulation limitation, not a solver bug.

`frame_v2` allocates 3 DOF per node everywhere (Ux, Uy, θ). Bar elements contribute stiffness only to Ux/Uy (`frame_v2.py:309-324`). At nodes where ALL connected members are bars, the θ DOF has zero stiffness → singular `Ks` → 422.

Per-node θ audit on this model:

| Node | θ DOF | Connections | θ stiffness |
|---|---|---|---|
| N1 | 3 | bar + beam | ✓ |
| **N2** | **6** | 3× bar | **✗** |
| N3 | 9 | bar + 2× beam | ✓ |
| **N4** | **12** | 3× bar | **✗** |
| N5 | 15 | bar + 2× beam | ✓ |
| N6 | 18 | bar + beam | ✓ |

N2 and N4 are the pure-bar joints causing the singularity.

Not a solver bug: behaviour is mathematically correct given the 3-DOF/node formulation.
Not a UI bug: save/load round-trip preserved `bars`, `restrainedDoF`, UDL, etc.
Is a real **tool limitation**: offering beam+bar mixing in one solver is only useful if pure-bar joints are handled natively.

`truss2d` does not substitute — the top chord needs bending + UDL which truss2d (2 DOF/node, axial only) cannot model.

## Workarounds to test (user to try next session)

1. **Kθ spring at N2 and N4** with a very small stiffness (e.g. `1e-3 N·m/rad`). Numerically removes singularity without materially affecting load path. Cleanest option.
2. **Convert member 1 (N2–N4 bottom chord) from bar to beam**. Introduces tiny unwanted bending but restores θ stiffness at N2, N4.

## Proposed solver enhancement (backlog-worthy)

Detect pure-bar joints during assembly in `frame_v2.assemble_primary_stiffness_matrix` and either:
- Eliminate the θ DOF from those nodes (cleanest), or
- Implicitly restrain θ there (simpler)

Plus UI cues:
- Warn user on the canvas when a joint loses all rotational stiffness (inline warning / coloured node).
- Improve error message: name the failing DOF(s) instead of the generic "Structure is unstable".

Also spotted (secondary): `apply_equivalent_nodal_actions` skips bars entirely (`frame_v2.py:376`) — a UDL applied to a bar is silently dropped. Worth flagging in UI too.

## Confidence snapshot

| Claim | Confidence | Basis |
|---|---|---|
| N2 and N4 cause the singularity in this specific model | 99% | Traced every member incidence in the JSON |
| Solver error is mathematically correct under current formulation | 99% | Read `frame_v2.py:309-324`, bar contributes Ux/Uy only |
| Model is structurally valid and should solve in a better formulation | 99% | Standard Pratt/Warren hybrid — textbook solvable |
| This is a genuine tool limitation worth an enhancement phase | 95% | Mixing beams + bars is the stated purpose of frame_v2 |
| Workaround 1 (Kθ spring 1e-3) will produce results matching hand calc | ~80% | Standard numerical trick; needs verification against hand calc |

## Next action on resume

1. Open the test JSON in frame2d UI
2. Add Kθ = 1e-3 spring supports at N2 and N4
3. Solve — confirm it now succeeds
4. Verify results against hand-calculated reactions / top-chord moments
5. If workaround validates the model, decide whether to:
   - `/gsd-add-backlog` the solver enhancement for a future milestone, or
   - `/gsd-insert-phase` near-term if this is blocking real work
