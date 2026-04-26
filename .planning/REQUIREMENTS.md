# Milestone v1.2 Requirements

**Milestone:** v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)
**Status:** Active
**Created:** 2026-04-19

## v1.2 Requirements

### Solver Hardening (HARDEN)

- [x] **HARDEN-01**: Frame solver test suite covers multi-member topologies — portal frame, two-span continuous beam with shared interior node, and mixed pinLeft/pinRight with UDL — all with equilibrium assertions at shared nodes and released ends
- [x] **HARDEN-02**: User can place translational (Kx, Ky) and rotational (Kθ) spring supports at nodes in the frame2d UI and solve structures using them (solver already consumes `springDoF` / `springStiffness`)
- [x] **HARDEN-03**: Interactive UAT pass covering cantilever, simple beam, portal frame, continuous beam with pin release, and spring-support cases produces expected results in the frame2d UI

### Revit Tier 1 — Geometry Exporter (REVIT-T1)

- [x] **REVIT-T1-01**: A pyRevit button in `CustomRevitExtension` `Analytical.panel` exports detail lines from the active drafting view as canonical PDA JSON (nodes, members, default E/I/A; supports/loads empty)
- [x] **REVIT-T1-02**: Button shows a "2D TRUSSES AND 2D FRAMES ONLY" warning before running and refuses to run unless the active view is a drafting view
- [x] **REVIT-T1-03**: Endpoint coordinates within 1mm tolerance are merged into a single node (structural connectivity preserved)
- [x] **REVIT-T1-04**: Coordinates are converted Revit-feet → metres (×0.3048), rounded to 4 decimals; Z is dropped (XY plane only)
- [x] **REVIT-T1-05**: The exported JSON loads in the PDA frame2d browser UI and solves after the user adds supports/loads

### Solver Robustness — Pure-Bar Joints (PUREBAR)

- [ ] **PUREBAR-01**: `frame_v2.assemble_primary_stiffness_matrix` detects pure-bar joints (every incident member is a bar) during assembly
- [ ] **PUREBAR-02**: Hybrid beam+bar models (e.g. Pratt/Warren trusses with continuous beam chords) solve correctly; pure-bar joints no longer cause `Ks` singularity / HTTP 422
- [ ] **PUREBAR-03**: `frame_v2.apply_equivalent_nodal_actions` no longer silently drops UDL applied to bar members — either applied correctly as nodal forces, or rejected with a clear error
- [ ] **PUREBAR-04**: `frame2d` UI replaces generic "Structure is unstable" with specific diagnostics; canvas highlights joints with zero rotational stiffness; flag dropped UDL on bar members
- [ ] **PUREBAR-05**: Regression test added using the captured failing fixture (`~/Downloads/frame2d-model-2026-04-22T06-14-49.json`)

## Deferred to v1.3+

- **Grillage Solver** (GRILLAGE-01..05) — was original v1.1 Phase 4, pushed forward after pivot
- **Revit results-import button** — read solver output JSON, annotate Revit model
- **3D truss / 3D frame solvers**
- **Revit Tier 2 — Analytical Exporter Hardening** (REVIT-T2-01..07) — rescoped from v1.2 after 2026-04-26 discussion. Drafting-view exporter (Phase 5) covers MVP engineer workflow; Tier 2 analytical-model extraction reconsidered for v1.3 with full risk picture (Revit 2023/24/25 API drift, family-parameter variability for E/I/A extraction)

## Out of Scope (for v1.2)

- Revit *model-element* exporter (beams, columns, braces with 3D location curves) — Tier 1 is drafting-view detail lines only; model-element support is a Tier 3 candidate for later milestones
- Revit results-import (feed solver results back into Revit) — deferred to v1.3+
- Full analytical-model round-trip (export → solve → import results into Revit) — deferred
- Non-planar / 3D frame export from Revit — blocked on 3D solver (v1.4+)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HARDEN-01 | Phase 4 | Complete |
| HARDEN-02 | Phase 4 | Complete |
| HARDEN-03 | Phase 4 | Complete |
| REVIT-T1-01 | Phase 5 | Active |
| REVIT-T1-02 | Phase 5 | Active |
| REVIT-T1-03 | Phase 5 | Active |
| REVIT-T1-04 | Phase 5 | Active |
| REVIT-T1-05 | Phase 5 | Active |
| PUREBAR-01 | Phase 6 | Active |
| PUREBAR-02 | Phase 6 | Active |
| PUREBAR-03 | Phase 6 | Active |
| PUREBAR-04 | Phase 6 | Active |
| PUREBAR-05 | Phase 6 | Active |
| REVIT-T2-01..07 | Deferred to v1.3 | — |

_Phase mapping filled in 2026-04-19 after roadmap creation. Phase 6 rescoped 2026-04-26: Revit Tier 2 deferred to v1.3, pure-bar joint robustness promoted from backlog._
