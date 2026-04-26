# Roadmap: PDA Analysis Software

## Milestones

- ✅ **v1.0 — 2D Solver Foundation** — Phases 1–2 (shipped 2026-04-18)
- ✅ **v1.1 — Interchange and Grillage (Partial)** — Phase 3 (shipped 2026-04-19; Phase 4 Grillage deferred)
- ✅ **v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)** — Phases 4–6 (shipped 2026-04-26)
- 📋 **v1.3 — Grillage + Revit Results-Import + Tier 2** — TBD phases (planned)
- 📋 **v1.4 — 3D Solvers** — TBD phases (planned)
- 📋 **v2.0+ — Advanced Solvers (Dynamics, Plate, Continuum, Cablenet)** — TBD phases (planned)

## Phases

<details>
<summary>✅ v1.0 — 2D Solver Foundation (Phases 1–2) — SHIPPED 2026-04-18</summary>

- [x] **Phase 1: Trust and Production Hardening** (3/3 plans) — completed 2026-04-11
  - HTTP 422 on unstable structures, print removal, 15 analytical tests, BMD/SFD canvas rendering, member stress output
- [x] **Phase 2: Model Evolution and UX Polish** (3/3 plans) — completed 2026-04-18
  - Per-member E/I/A, section property calculator, JSON result export, node label overlay, symbol size scaler

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 — Interchange and Grillage Partial (Phase 3) — SHIPPED 2026-04-19</summary>

- [x] **Phase 3: Interchange Format and External Inputs** (3/3 plans) — completed 2026-04-19
  - Canonical JSON schema, save/load in both browser UIs, Tekla Excel converter, Revit PyRevit exporter, FastAPI integration tests

Full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 — 2D Frame Hardening + Revit-as-UI (MVP) (Phases 4–6) — SHIPPED 2026-04-26</summary>

- [x] **Phase 4: 2D Frame Solver + UI Hardening** (3/3 plans) — completed 2026-04-20
  - Multi-member tests (TRUST-13..17), spring supports end-to-end in frame2d UI, 5-fixture UAT harness with hand-calc asserts
- [x] **Phase 5: Revit Tier 1 — Geometry Exporter** (4/4 plans) — completed 2026-04-21
  - pyRevit `ExportToPDA` pushbutton (sibling `CustomRevitExtension` repo): drafting-view detail lines → canonical PDA JSON, view-type guard, 1mm endpoint merge, T-junction split, ft→m conversion, live UAT 6 fixtures + round-trip
- [x] **Phase 6: frame_v2 — Pure-Bar Joint Robustness** (3/3 plans) — completed 2026-04-26
  - Pure-bar joint detection + θ-DOF auto-restraint, `SolverDiagnosticError` typed exception, structured 422 payload, frame2d UI pre-solve scan + canvas diagnostic overlays, 56-baseline snapshot regression gate

Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### 📋 v1.3 — Grillage + Revit Results-Import + Tier 2 (Planned)

- [ ] **Phase 7: Grillage Solver** — /solve/grillage endpoint, torsional stiffness, analytical tests (was original v1.1 Phase 4)
- [ ] **Phase 8: Revit Results-Import** — pyRevit button reads solver output JSON and annotates the Revit analytical model
- [ ] **Phase TBD: Revit Tier 2 — Analytical Exporter Hardening** — rescoped from v1.2 (REVIT-T2-01..07): Revit 2023/24/25 compat, supports/loads/section-property extraction from analytical model, view-plane-projection from active plan/elevation/section view, production-path migration to `Analytical.panel/StructuralAnalyticalModel.pushbutton/`, legacy retirement. Scope discussion captured 2026-04-26. Pending v1.3 prioritisation.

### 📋 v1.4 — 3D Solvers (Planned)

- [ ] **Phase 9: 3D Truss Solver** — /solve/truss3d endpoint, direction-cosine transformation, 3 DOF/node, analytical tests
- [ ] **Phase 10: 3D Frame Solver** — /solve/frame3d endpoint, 6 DOF/node, Blender add-on UI

### 📋 v2.0+ — Advanced Solvers (Planned)

- [ ] **Phase 11: Structural Dynamics** — Modal analysis, natural frequencies, time-history response
- [ ] **Phase 12: Plate and Shell Structures** — 2D FEM plate/shell elements, membrane + bending
- [ ] **Phase 13: Continuum Structures (FEM)** — General 2D/3D continuum elements, stress fields
- [ ] **Phase 14: Non-linear Cablenet Structures** — Geometric non-linearity, tension-only members, iterative solver

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Trust and Production Hardening | v1.0 | 3/3 | Complete | 2026-04-11 |
| 2. Model Evolution and UX Polish | v1.0 | 3/3 | Complete | 2026-04-18 |
| 3. Interchange Format and External Inputs | v1.1 | 3/3 | Complete | 2026-04-19 |
| 4. 2D Frame Solver + UI Hardening | v1.2 | 3/3 | Complete | 2026-04-20 |
| 5. Revit Tier 1 — Geometry Exporter | v1.2 | 4/4 | Complete | 2026-04-21 |
| 6. frame_v2 — Pure-Bar Joint Robustness | v1.2 | 3/3 | Complete | 2026-04-26 |
| 7. Grillage Solver | v1.3 | 0/TBD | Not started | - |
| 8. Revit Results-Import | v1.3 | 0/TBD | Not started | - |
| 9. 3D Truss Solver | v1.4 | 0/TBD | Not started | - |
| 10. 3D Frame Solver | v1.4 | 0/TBD | Not started | - |
| 11. Structural Dynamics | v2.0+ | 0/TBD | Not started | - |
| 12. Plate and Shell Structures | v2.0+ | 0/TBD | Not started | - |
| 13. Continuum Structures (FEM) | v2.0+ | 0/TBD | Not started | - |
| 14. Non-linear Cablenet Structures | v2.0+ | 0/TBD | Not started | - |

## Backlog

### Phase 999.1: Section Shape Drawing UI (BACKLOG)

**Goal:** Engineer can draw an arbitrary polygon cross-section in a browser UI and receive computed section properties — cross-sectional area, second moment of area (Ixx, Iyy), elastic section modulus (Zxx, Zyy), and torsional properties (J, Cw). Computation uses the shoelace formula and parallel axis theorem. Extends and supersedes the basic section property calculator introduced in Phase 2.
**Context:** Identified 2026-04-18. Natural extension of Phase 2 Plan 2 (section property calculator). Small focused phase — UI for drawing + solver for properties. Should be sequenced after Phase 2 completes.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.2: Load Combination Generator — Eurocode and British Standard (BACKLOG)

**Goal:** Engineers can define actions (permanent, variable, wind, etc.) and generate ULS/SLS load combinations per EN 1990 and BS EN national annex. Combination generator produces load vectors that feed directly into the existing analysis solvers. Includes a UI for defining actions and selecting combination type, and a solver module that applies the correct ψ factors, partial factors, and combination expressions.
**Context:** Identified 2026-04-18. Fits naturally between analysis and design — upstream of any future design solver. Well-scoped: combination logic is deterministic and fully specified by the codes. Should be sequenced after interchange format (Phase 3) so combination outputs can be saved/loaded as part of a model file.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.3: Design Solver — Code Checking Against Eurocode / BS (BACKLOG)

**Goal:** A separate design module checks analysis results against structural design codes (EC3 for steel, EC2 for concrete, BS 5950 etc.), reporting pass/fail for each member across bending, shear, axial, combined loading, buckling, and lateral-torsional buckling checks. Interacts with the analysis engine via AnalysisResult — consumes displacements, reactions, and member forces.
**Context:** Identified 2026-04-18. Effectively a separate product stream — design code checking is a large, long-running effort (Tekla/SCIA/Robot spend years on this). Not a single phase; will need to be broken into sub-phases per material type and code. Captured here to preserve intent. Prerequisite: stable analysis engine (Phases 1–4 at minimum), load combination generator (999.2), and section property tool (999.1).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.4: Word Add-in for Calculation Sheets (BACKLOG)

**Goal:** A Microsoft Word add-in (Office JS API) consumes analysis and design results and formats them into structured calculation sheets in the style of Tekla Tedds for Word — section headings, input tables, result summaries, diagrams. Engineers can produce submission-ready calculations directly from the tool.
**Context:** Identified 2026-04-18. Completely separate technology stack from the current Python/FastAPI/JS platform — requires Microsoft Office JS API or VSTO. Commercially high-value but a large investment. Near-term alternative: an HTML/PDF calculation report generator within the current stack that produces Tedds-style output. Captured here to preserve intent. Prerequisite: stable analysis + design solver (999.3).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
