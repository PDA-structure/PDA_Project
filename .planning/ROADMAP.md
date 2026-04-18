# Roadmap: PDA Analysis Software

## Overview

Starting from a working 2D truss and 2D frame baseline, this roadmap takes the platform from developer prototype to a professional structural engineering SaaS tool. The roadmap is organised into three blocks:

- **2D Foundation (Phases 1–4):** Complete the 2D solver world — hardening, model evolution, interchange format, and grillage. Browser canvas UI (vanilla JS) throughout.
- **3D Transition (Phases 5–6):** 3D truss and 3D frame solvers. Blender add-on as primary UI (imports solver_core directly via bpy). Solver + API validated via interchange format JSON before any 3D UI is built.
- **Advanced Solvers (Phases 7–10):** Dynamics, plate/shell, continuum FEM, non-linear cablenet. Solver + API first; UI research and design as a sub-phase once each solver is validated.

**Phase Numbering:**
- Integer phases (1–10): Planned milestone work in execution order
- Decimal phases (e.g. 2.1): Urgent insertions (marked with INSERTED)
- Directory naming for in-progress phases is preserved (e.g. `03-model-evolution-and-ux-polish` stays as-is)

- [x] **Phase 1: Trust and Production Hardening** - Fix production blockers, expand test suite, add BMD/SFD rendering and member stress output
- [ ] **Phase 2: Model Evolution and UX Polish** - Per-member properties, section property calculator, result export, UI debugging tools *(directory: 03-model-evolution-and-ux-polish)*
- [ ] **Phase 3: Interchange Format and External Inputs** - Save/load JSON in browser UIs, Tekla Structural Designer Excel import, Revit PyRevit export, canonical solver JSON schema
- [ ] **Phase 4: Grillage Solver** - Add /solve/grillage endpoint with torsional stiffness and analytical tests
- [ ] **Phase 5: 3D Truss Solver** - Add working /solve/truss3d endpoint with full analytical test coverage *(directory: 02-3d-truss-solver when created)*
- [ ] **Phase 6: 3D Frame Solver** - Add /solve/frame3d endpoint, 6 DOF/node, full 3D transformation matrices, Blender add-on UI
- [ ] **Phase 7: Structural Dynamics** - Modal analysis, natural frequencies, time-history response; starts with 2D frame, extends to 3D
- [ ] **Phase 8: Plate and Shell Structures** - 2D FEM plate/shell elements, membrane + bending, stepping stone to continuum
- [ ] **Phase 9: Continuum Structures (FEM)** - General 2D/3D continuum elements, stress fields, builds on plate/shell patterns
- [ ] **Phase 10: Non-linear Cablenet Structures** - Geometric non-linearity, tension-only members, iterative solver (Newton-Raphson or dynamic relaxation)

## Phase Details

### Phase 1: Trust and Production Hardening
**Goal**: The existing solvers are reliable enough for structural engineers to trust — errors are handled gracefully, the codebase has no known violations, and analytical correctness is verified across representative structural cases
**Depends on**: Nothing (first phase)
**Requirements**: TRUST-01, TRUST-02, TRUST-03, TRUST-04, TRUST-05, TRUST-06, TRUST-07, TRUST-08, TRUST-09, TRUST-10, TRUST-11
**Success Criteria** (what must be TRUE):
  1. Submitting an under-restrained structure to /solve/frame2d or /solve/truss2d returns HTTP 422 with message "structure is unstable or under-restrained" — not HTTP 500
  2. grep for print( or summarize_results in solver_core returns no matches
  3. pytest runs 20+ tests covering UDL simply-supported beam, portal frame equilibrium, bar member, pin release, and propped cantilever — all passing with analytical verification
  4. Every test in the suite asserts global equilibrium: sum(FG) + sum(applied loads) approximately equals zero
  5. Frame2d UI renders a Bending Moment Diagram and Shear Force Diagram on the canvas after solving, alongside the deformed shape
  6. AnalysisResult meta includes member stress values (stress = F/A per member) for frame and truss solves
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Error handling, print removal, and member stress output
- [x] 01-02-PLAN.md — Test suite expansion with 5 analytical cases and equilibrium assertions
- [x] 01-03-PLAN.md — BMD/SFD canvas rendering and stress display in UI
**UI hint**: yes

### Phase 2: Model Evolution and UX Polish
**Goal**: The frame2d solver accepts non-uniform member properties, engineers have a section property calculator to get I and A from geometry, and solve results can be exported from the browser
**Depends on**: Phase 1
**Directory**: `03-model-evolution-and-ux-polish` (original numbering preserved)
**Requirements**: MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05
**Success Criteria** (what must be TRUE):
  1. A FrameModel2D with per-member E/I/A (list values) solves correctly; existing scalar E/I/A inputs continue to work without change
  2. Existing frame2d browser UI and all current tests pass without modification after the per-member model change
  3. A section property calculator returns correct I and A given section type (rectangle, circle, I-section) and dimensions
  4. After solving in the frame2d or truss2d browser UI, a download link produces a valid JSON file containing all result fields
  5. Frame2d UI shows a toggle-able overlay displaying node numbers and DOF labels on the canvas
**Plans**: 3 plans
Plans:
- [x] 03-01-PLAN.md — Per-member E/I/A model changes and adapter updates
- [x] 03-02-PLAN.md — Section property calculator
- [x] 03-03-PLAN.md — Result export and UI debugging overlay
**UI hint**: yes

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
**Plans**: TBD
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
  1. A dynamics solver returns correct natural frequencies for a hand-verifiable single-storey frame (compare against analytical formula)
  2. Mode shapes are normalised and can be visualised as animated deflected shapes in the Blender add-on
  3. test_dynamics.py contains 3+ passing tests with analytical verification
**Plans**: TBD

### Phase 8: Plate and Shell Structures
**Goal**: Engineers can model and solve plate/shell structures using 2D FEM elements with both membrane and bending behaviour
**Depends on**: Phase 6 (3D frame solver infrastructure)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. POST /solve/plate returns correct deflections for a simply-supported rectangular plate under uniform pressure (compare against Navier series solution)
  2. test_plate.py contains 3+ passing tests including equilibrium and symmetry checks
  3. Blender add-on supports plate/shell geometry input and result visualisation (stress contours, deflected surface)
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
  2. Iterative solver converges within a documented tolerance; non-convergence returns HTTP 422 with a meaningful message
  3. test_cablenet.py contains 3+ passing tests including a symmetry check and a load-step convergence test
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Trust and Production Hardening | 3/3 | Complete | 2026-04-11 |
| 2. Model Evolution and UX Polish | 3/3 | In progress | - |
| 3. Interchange Format and External Inputs | 0/TBD | Not started | - |
| 4. Grillage Solver | 0/TBD | Not started | - |
| 5. 3D Truss Solver | 0/TBD | Not started | - |
| 6. 3D Frame Solver | 0/TBD | Not started | - |
| 7. Structural Dynamics | 0/TBD | Not started | - |
| 8. Plate and Shell Structures | 0/TBD | Not started | - |
| 9. Continuum Structures (FEM) | 0/TBD | Not started | - |
| 10. Non-linear Cablenet Structures | 0/TBD | Not started | - |

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
