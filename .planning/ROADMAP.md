# Roadmap: PDA Analysis Software

## Milestones

- ✅ **v1.0 — 2D Solver Foundation** — Phases 1–2 (shipped 2026-04-18)
- ✅ **v1.1 — Interchange and Grillage (Partial)** — Phase 3 (shipped 2026-04-19; Phase 4 Grillage deferred)
- 🚧 **v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)** — Phases 4–6 (active)
- 📋 **v1.3 — Grillage + Revit Results-Import** — TBD phases (planned)
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

### 🚧 v1.2 — 2D Frame Hardening + Revit-as-UI (MVP) (Active)

**Milestone Goal:** Solidify the 2D frame solver and UI (multi-member test coverage, spring supports, bug sweep) and establish Revit as the primary data-input path with a geometry-exporter button and a hardened analytical-model exporter in the sibling `CustomRevitExtension` repo.

- [x] **Phase 4: 2D Frame Solver + UI Hardening** (3/3 plans) — completed 2026-04-20
- [x] **Phase 5: Revit Tier 1 — Geometry Exporter** (4/4 plans) — completed 2026-04-21
- [ ] **Phase 6: Revit Tier 2 — Analytical Exporter Hardening** — Hardened exporter with Revit 2025 compat, supports/loads/validation, production location; legacy exporter retired

### 📋 v1.3 — Grillage + Revit Results-Import (Planned)

- [ ] **Phase 7: Grillage Solver** — /solve/grillage endpoint, torsional stiffness, analytical tests (was original v1.1 Phase 4)
- [ ] **Phase 8: Revit Results-Import** — pyRevit button reads solver output JSON and annotates the Revit analytical model

### 📋 v1.4 — 3D Solvers (Planned)

- [ ] **Phase 9: 3D Truss Solver** — /solve/truss3d endpoint, direction-cosine transformation, 3 DOF/node, analytical tests
- [ ] **Phase 10: 3D Frame Solver** — /solve/frame3d endpoint, 6 DOF/node, Blender add-on UI

### 📋 v2.0+ — Advanced Solvers (Planned)

- [ ] **Phase 11: Structural Dynamics** — Modal analysis, natural frequencies, time-history response
- [ ] **Phase 12: Plate and Shell Structures** — 2D FEM plate/shell elements, membrane + bending
- [ ] **Phase 13: Continuum Structures (FEM)** — General 2D/3D continuum elements, stress fields
- [ ] **Phase 14: Non-linear Cablenet Structures** — Geometric non-linearity, tension-only members, iterative solver

## Phase Details

<details>
<summary>✅ Phase 1: Trust and Production Hardening — COMPLETE 2026-04-11</summary>

**Goal**: The 2D truss and frame solvers are trusted, production-hardened, and fully covered by analytical tests
**Depends on**: Nothing (first phase)
**Requirements**: TRUST-01..TRUST-08 (v1.0)
**Success Criteria** (what must be TRUE):
  1. Unstable structures return HTTP 422, not HTTP 500
  2. No print() or summarize_results() calls exist in solver_core computation path
  3. 15+ passing tests including equilibrium assertions on every test
  4. BMD and SFD render correctly on the frame2d canvas
  5. Member stress (F/A) appears in results
**Plans**: 3 plans — all complete

</details>

<details>
<summary>✅ Phase 2: Model Evolution and UX Polish — COMPLETE 2026-04-18</summary>

**Goal**: Engineers can set per-member properties, compute section geometry, export results, and use improved UI controls in the frame2d browser tool
**Depends on**: Phase 1
**Requirements**: UX-01..UX-07 (v1.0)
**Success Criteria** (what must be TRUE):
  1. Per-member E/I/A can be set on individual members without breaking existing scalar API
  2. Section property calculator (rectangle, circle, I-section) computes and populates E/I/A live
  3. JSON result export produces a timestamped download in both UIs
  4. Node label / DOF overlay toggles on and off in frame2d
  5. Horizontal UDL applies correct direction-cosine decomposition on inclined members
**Plans**: 3 plans — all complete

</details>

<details>
<summary>✅ Phase 3: Interchange Format and External Inputs — COMPLETE 2026-04-19</summary>

**Goal**: Engineers can save and load structures from the browser UI; external tools (Tekla Structural Designer, Revit) can export to the same canonical JSON schema; the interchange format enables 3D solver testing before any 3D UI is built
**Depends on**: Phase 2
**Requirements**: INTERCHANGE-01..05 (v1.1)
**Success Criteria** (what must be TRUE):
  1. Saving a structure from frame2d or truss2d produces a JSON file that reloads and solves without re-entering any data
  2. The saved JSON schema matches the solver API input format exactly
  3. A Tekla Structural Designer Excel export converts to canonical JSON and solves via the API
  4. A Revit PyRevit script exports the analytical model to canonical JSON
  5. FastAPI integration tests cover round-trip from file → API → verified results
**Plans**: 3 plans — all complete

</details>

### Phase 4: 2D Frame Solver + UI Hardening

**Goal**: The 2D frame solver and UI are reliable across the full range of common structural topologies — multi-member frames, spring supports, pin releases, and UDL combinations — verified by test coverage and direct UAT
**Depends on**: Phase 3
**Repo**: `pda_project`
**Requirements**: HARDEN-01, HARDEN-02, HARDEN-03
**Success Criteria** (what must be TRUE):
  1. Portal frame, two-span continuous beam, and mixed pin-release + UDL cases all solve with correct equilibrium at shared nodes and released ends, verified by pytest assertions
  2. Engineer can place a spring support (Kx, Ky, or Kθ) at any node in the frame2d UI, and the solver uses it correctly — spring reaction appears in results
  3. Running the frame2d UI through five canonical cases (cantilever, simple beam, portal frame, continuous beam with pin release, spring-support beam) produces results that match hand-calculation or established reference values
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Multi-member frame tests TRUST-13..17 (HARDEN-01)
- [x] 04-02-PLAN.md — frame2d UI spring support tool (HARDEN-02)
- [x] 04-03-PLAN.md — UAT fixtures + harness (HARDEN-03)

### Phase 5: Revit Tier 1 — Geometry Exporter

**Goal**: An engineer with any 2D structural layout drawn as detail lines in a Revit drafting view can export it as canonical PDA JSON with one button click, then open the JSON in the frame2d browser UI, add supports and loads, and solve
**Depends on**: Phase 4
**Repo**: `CustomRevitExtension` (sibling repo at `/Users/catrinevans/Documents/CustomRevitExtension/`)
**Requirements**: REVIT-T1-01, REVIT-T1-02, REVIT-T1-03, REVIT-T1-04, REVIT-T1-05
**Success Criteria** (what must be TRUE):
  1. A pyRevit button in the Analytical panel exports the active drafting view's detail lines as canonical PDA JSON in a single click
  2. The button refuses to run (with a clear "2D TRUSSES AND 2D FRAMES ONLY" warning) if the active view is not a drafting view
  3. Coincident endpoints within 1 mm tolerance are merged into a single node; the resulting connectivity is correct for a simple portal frame test case
  4. Exported coordinates are in metres rounded to 4 decimal places (Revit feet converted at ×0.3048), with Z dropped
  5. The exported JSON file opens in the frame2d browser UI and solves successfully after the engineer adds supports and a load
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Pushbutton bundle scaffold + view-type guard + 2D-only session warning + detail-line collector (REVIT-T1-02)
- [x] 05-02-PLAN.md — Geometry pipeline: feet→metres + 4dp rounding + 1mm endpoint merge + T-junction split + mid-span crossing detection + lexicographic sort (REVIT-T1-03, REVIT-T1-04)
- [x] 05-03-PLAN.md — JSON emit (canvas round-trip contract) + save dialog + success TaskDialog (REVIT-T1-01, REVIT-T1-04)
- [x] 05-04-PLAN.md — Human UAT: 6 fixtures in live Revit + frame2d UI round-trip verification (REVIT-T1-01, REVIT-T1-02, REVIT-T1-03, REVIT-T1-05)
**UI hint**: yes

### Phase 6: Revit Tier 2 — Analytical Exporter Hardening

**Goal**: The analytical-model exporter works across Revit 2023, 2024, and 2025 and produces a complete canonical JSON including supports, loads, and section properties — living at its permanent production location in CustomRevitExtension — while the legacy exporter in pda_project is retired
**Depends on**: Phase 5
**Repo**: `CustomRevitExtension` (primary); `pda_project` (retire legacy file)
**Requirements**: REVIT-T2-01, REVIT-T2-02, REVIT-T2-03, REVIT-T2-04, REVIT-T2-05, REVIT-T2-06, REVIT-T2-07
**Success Criteria** (what must be TRUE):
  1. The exporter runs without error in Revit 2023, 2024, and 2025 — tested against each version's API surface
  2. The exported JSON contains correct restrainedDoF derived from the analytical model's support restraints (fixed, pinned, roller)
  3. Point loads and UDLs from the analytical model appear as correct forceVector, ENForces, and ENMoments in the exported JSON
  4. Per-member E, I, and A values are populated from Revit member types in the exported JSON
  5. The button lives at `Analytical.panel/StructuralAnalyticalModel.pushbutton/` and the legacy `pda_project/pyrevit_exporters/export_to_pda.py` is replaced by a README pointer to its new location
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Trust and Production Hardening | v1.0 | 3/3 | Complete | 2026-04-11 |
| 2. Model Evolution and UX Polish | v1.0 | 3/3 | Complete | 2026-04-18 |
| 3. Interchange Format and External Inputs | v1.1 | 3/3 | Complete | 2026-04-19 |
| 4. 2D Frame Solver + UI Hardening | v1.2 | 0/3 | Not started | - |
| 5. Revit Tier 1 — Geometry Exporter | v1.2 | 0/4 | Not started | - |
| 6. Revit Tier 2 — Analytical Exporter Hardening | v1.2 | 0/TBD | Not started | - |
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
