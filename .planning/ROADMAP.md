# Roadmap: PDA Analysis Software

## Milestones

- ✅ **v1.0 — 2D Solver Foundation** — Phases 1–2 (shipped 2026-04-18)
- 🚧 **v1.1 — Interchange and Grillage** — Phases 3–4 (in progress)
- 📋 **v2.0 — 3D Solvers** — Phases 5–6 (planned)
- 📋 **v3.0 — Advanced Solvers** — Phases 7–10 (planned)

## Phases

<details>
<summary>✅ v1.0 — 2D Solver Foundation (Phases 1–2) — SHIPPED 2026-04-18</summary>

- [x] **Phase 1: Trust and Production Hardening** (3/3 plans) — completed 2026-04-11
  - HTTP 422 on unstable structures, print removal, 15 analytical tests, BMD/SFD canvas rendering, member stress output
- [x] **Phase 2: Model Evolution and UX Polish** (3/3 plans) — completed 2026-04-18 *(directory: 03-model-evolution-and-ux-polish)*
  - Per-member E/I/A, section property calculator, JSON result export, node label overlay, symbol size scaler

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

### 🚧 v1.1 — Interchange and Grillage

- [ ] **Phase 3: Interchange Format and External Inputs** — Save/load JSON in browser UIs, Tekla Structural Designer Excel import, Revit PyRevit export, canonical solver JSON schema
- [ ] **Phase 4: Grillage Solver** — Add /solve/grillage endpoint with torsional stiffness and analytical tests

### 📋 v2.0 — 3D Solvers

- [ ] **Phase 5: 3D Truss Solver** — Add working /solve/truss3d endpoint with full analytical test coverage
- [ ] **Phase 6: 3D Frame Solver** — Add /solve/frame3d endpoint, 6 DOF/node, full 3D transformation matrices, Blender add-on UI

### 📋 v3.0 — Advanced Solvers

- [ ] **Phase 7: Structural Dynamics** — Modal analysis, natural frequencies, time-history response
- [ ] **Phase 8: Plate and Shell Structures** — 2D FEM plate/shell elements, membrane + bending
- [ ] **Phase 9: Continuum Structures (FEM)** — General 2D/3D continuum elements, stress fields
- [ ] **Phase 10: Non-linear Cablenet Structures** — Geometric non-linearity, tension-only members, iterative solver

## Phase Details

### Phase 3: Interchange Format and External Inputs
**Goal**: Engineers can save and load structures from the browser UI; external tools (Tekla Structural Designer, Revit) can export to the same canonical JSON schema; the interchange format enables 3D solver testing before any 3D UI is built
**Depends on**: Phase 2
**Requirements**: INTERCHANGE-01, INTERCHANGE-02, INTERCHANGE-03, INTERCHANGE-04, INTERCHANGE-05
**Success Criteria** (what must be TRUE):
  1. Saving a structure from frame2d or truss2d produces a JSON file that can be reloaded and solved without re-entering any data
  2. The saved JSON schema matches the solver API input format exactly (nodes, members, restrainedDoF, forceVector, member properties)
  3. A Tekla Structural Designer Excel export can be converted to the canonical JSON schema and solved via the API
  4. A Revit PyRevit script exports the analytical model to the canonical JSON schema
  5. The interchange format is documented and usable as a communication tool (paste JSON into conversation for debugging/verification)
**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — Save/Load JSON in frame2d and truss2d UIs + test fixtures
- [ ] 03-02-PLAN.md — Integration tests for interchange format round-trip
- [ ] 03-03-PLAN.md — Tekla Excel converter CLI + Revit PyRevit exporter

**UI hint**: yes

### Phase 4: Grillage Solver
**Goal**: Engineers can submit grillage (bridge deck / floor system) problems to a /solve/grillage endpoint and receive accurate results including torsional effects
**Depends on**: Phase 2
**Requirements**: GRILLAGE-01, GRILLAGE-02, GRILLAGE-03, GRILLAGE-04, GRILLAGE-05
**Success Criteria** (what must be TRUE):
  1. POST /solve/grillage returns correct results for a simple two-member grillage with a central point load (hand-verifiable equilibrium)
  2. GrillageModel2D accepts per-member E, I, A, J, and G — torsional stiffness GJ is applied per member
  3. test_grillage.py contains 3+ passing tests including equilibrium verification and a torsion check
**Plans**: TBD

### Phase 5: 3D Truss Solver
**Goal**: Engineers can submit 3D truss problems to a /solve/truss3d endpoint and receive accurate displacement, reaction, and member force results — including structures with vertical members
**Depends on**: Phase 3 (interchange format enables file-based testing before 3D UI exists)
**Requirements**: TRUSS3D-01, TRUSS3D-02, TRUSS3D-03, TRUSS3D-04, TRUSS3D-05, TRUSS3D-06, TRUSS3D-07
**Success Criteria** (what must be TRUE):
  1. POST /solve/truss3d returns correct displacements and member forces for a hand-verifiable single inclined 3D bar
  2. POST /solve/truss3d handles a structure containing a vertical member without producing NaN in results
  3. test_truss3d.py contains 5+ passing tests including a 3D tetrahedron truss and multi-point load case
  4. Every test_truss3d.py test asserts stiffness matrix symmetry (np.allclose(K, K.T)) and global equilibrium
**Plans**: TBD
**UI note**: Blender add-on (Phase 6 onwards); no browser canvas UI planned for 3D

### Phase 6: 3D Frame Solver
**Goal**: Engineers can submit 3D frame problems to a /solve/frame3d endpoint with full 6-DOF-per-node behaviour; Blender add-on provides the primary UI for modelling and visualising results
**Depends on**: Phase 5
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. POST /solve/frame3d returns correct displacements and member forces for a hand-verifiable 3D portal frame
  2. test_frame3d.py contains 5+ passing tests including equilibrium verification
  3. A Blender add-on panel allows modelling nodes/members, setting supports/loads, calling solver_core directly, and viewing deflected shape and force diagrams in the 3D viewport
**Plans**: TBD
**UI note**: Blender add-on — imports solver_core directly via bpy, no HTTP needed for desktop use

### Phase 7: Structural Dynamics
**Goal**: Engineers can compute natural frequencies, mode shapes, and time-history responses for 2D frame structures; framework extends to 3D once validated
**Depends on**: Phase 2 (2D frame solver), Phase 6 for 3D extension
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. A dynamics solver returns correct natural frequencies for a hand-verifiable single-storey frame
  2. Mode shapes are normalised and can be visualised as animated deflected shapes in the Blender add-on
  3. test_dynamics.py contains 3+ passing tests with analytical verification
**Plans**: TBD

### Phase 8: Plate and Shell Structures
**Goal**: Engineers can model and solve plate/shell structures using 2D FEM elements with both membrane and bending behaviour
**Depends on**: Phase 6
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. POST /solve/plate returns correct deflections for a simply-supported rectangular plate under uniform pressure (Navier series solution)
  2. test_plate.py contains 3+ passing tests including equilibrium and symmetry checks
  3. Blender add-on supports plate/shell geometry input and result visualisation
**Plans**: TBD

### Phase 9: Continuum Structures (FEM)
**Goal**: Engineers can model and solve general 2D/3D continuum structures using standard FEM elements; stress and strain fields are available in results
**Depends on**: Phase 8
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. POST /solve/continuum2d returns correct stress fields for a plane-stress patch test
  2. test_continuum.py contains 3+ passing tests including the patch test and equilibrium verification
  3. Blender add-on supports mesh input and stress/strain contour visualisation
**Plans**: TBD

### Phase 10: Non-linear Cablenet Structures
**Goal**: Engineers can model and solve tension-only cablenet structures with geometric non-linearity using an iterative solver
**Depends on**: Phase 5 (3D truss patterns), largely standalone
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. POST /solve/cablenet returns correct equilibrium geometry for a hand-verifiable two-cable problem
  2. Iterative solver converges within a documented tolerance; non-convergence returns HTTP 422
  3. test_cablenet.py contains 3+ passing tests including a symmetry check and a load-step convergence test
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Trust and Production Hardening | v1.0 | 3/3 | Complete | 2026-04-11 |
| 2. Model Evolution and UX Polish | v1.0 | 3/3 | Complete | 2026-04-18 |
| 3. Interchange Format and External Inputs | v1.1 | 0/3 | Planning | - |
| 4. Grillage Solver | v1.1 | 0/TBD | Not started | - |
| 5. 3D Truss Solver | v2.0 | 0/TBD | Not started | - |
| 6. 3D Frame Solver | v2.0 | 0/TBD | Not started | - |
| 7. Structural Dynamics | v3.0 | 0/TBD | Not started | - |
| 8. Plate and Shell Structures | v3.0 | 0/TBD | Not started | - |
| 9. Continuum Structures (FEM) | v3.0 | 0/TBD | Not started | - |
| 10. Non-linear Cablenet Structures | v3.0 | 0/TBD | Not started | - |

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
