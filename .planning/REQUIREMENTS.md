# Milestone v1.2 Requirements

**Milestone:** v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)
**Status:** Active
**Created:** 2026-04-19

## v1.2 Requirements

### Solver Hardening (HARDEN)

- [ ] **HARDEN-01**: Frame solver test suite covers multi-member topologies — portal frame, two-span continuous beam with shared interior node, and mixed pinLeft/pinRight with UDL — all with equilibrium assertions at shared nodes and released ends
- [ ] **HARDEN-02**: User can place translational (Kx, Ky) and rotational (Kθ) spring supports at nodes in the frame2d UI and solve structures using them (solver already consumes `springDoF` / `springStiffness`)
- [x] **HARDEN-03**: Interactive UAT pass covering cantilever, simple beam, portal frame, continuous beam with pin release, and spring-support cases produces expected results in the frame2d UI

### Revit Tier 1 — Geometry Exporter (REVIT-T1)

- [ ] **REVIT-T1-01**: A pyRevit button in `CustomRevitExtension` `Analytical.panel` exports detail lines from the active drafting view as canonical PDA JSON (nodes, members, default E/I/A; supports/loads empty)
- [ ] **REVIT-T1-02**: Button shows a "2D TRUSSES AND 2D FRAMES ONLY" warning before running and refuses to run unless the active view is a drafting view
- [ ] **REVIT-T1-03**: Endpoint coordinates within 1mm tolerance are merged into a single node (structural connectivity preserved)
- [ ] **REVIT-T1-04**: Coordinates are converted Revit-feet → metres (×0.3048), rounded to 4 decimals; Z is dropped (XY plane only)
- [ ] **REVIT-T1-05**: The exported JSON loads in the PDA frame2d browser UI and solves after the user adds supports/loads

### Revit Tier 2 — Analytical Exporter Hardening (REVIT-T2)

- [ ] **REVIT-T2-01**: Analytical-model exporter runs successfully in Revit 2023, 2024, and 2025 (handles API differences between versions)
- [ ] **REVIT-T2-02**: Button lives at production path `Analytical.panel/StructuralAnalyticalModel.pushbutton/` (retired from TestCodes panel)
- [ ] **REVIT-T2-03**: Exporter extracts support restraints (fixed, pinned, roller) from the analytical model → canonical `restrainedDoF`
- [ ] **REVIT-T2-04**: Exporter extracts point loads and UDLs from the analytical model → canonical `forceVector`, `ENForces`, `ENMoments`
- [ ] **REVIT-T2-05**: Exporter extracts per-member material and section properties (E, I, A) from Revit member types → canonical per-member lists
- [ ] **REVIT-T2-06**: Exporter performs pre-export validation: warns on duplicate nodes, disconnected members, and non-planar geometry
- [ ] **REVIT-T2-07**: Original `pda_project/pyrevit_exporters/export_to_pda.py` retired with a README pointer to the new location in `CustomRevitExtension`

## Deferred to v1.3+

- **Grillage Solver** (GRILLAGE-01..05) — was original v1.1 Phase 4, pushed forward after pivot
- **Revit results-import button** — read solver output JSON, annotate Revit model
- **3D truss / 3D frame solvers**

## Out of Scope (for v1.2)

- Revit *model-element* exporter (beams, columns, braces with 3D location curves) — Tier 1 is drafting-view detail lines only; model-element support is a Tier 3 candidate for later milestones
- Revit results-import (feed solver results back into Revit) — deferred to v1.3+
- Full analytical-model round-trip (export → solve → import results into Revit) — deferred
- Non-planar / 3D frame export from Revit — blocked on 3D solver (v1.4+)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HARDEN-01 | Phase 4 | Active |
| HARDEN-02 | Phase 4 | Active |
| HARDEN-03 | Phase 4 | Active |
| REVIT-T1-01 | Phase 5 | Active |
| REVIT-T1-02 | Phase 5 | Active |
| REVIT-T1-03 | Phase 5 | Active |
| REVIT-T1-04 | Phase 5 | Active |
| REVIT-T1-05 | Phase 5 | Active |
| REVIT-T2-01 | Phase 6 | Active |
| REVIT-T2-02 | Phase 6 | Active |
| REVIT-T2-03 | Phase 6 | Active |
| REVIT-T2-04 | Phase 6 | Active |
| REVIT-T2-05 | Phase 6 | Active |
| REVIT-T2-06 | Phase 6 | Active |
| REVIT-T2-07 | Phase 6 | Active |

_Phase mapping filled in 2026-04-19 after roadmap creation._
