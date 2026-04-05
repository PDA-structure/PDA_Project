# Roadmap: PDA Analysis Software

## Overview

Starting from a working 2D truss and 2D frame baseline, this roadmap takes the platform from developer prototype to a tool structural engineers can trust and extend. Phase 1 resolves production blockers and expands test coverage. Phase 2 adds the 3D truss solver following the established add-a-solver checklist. Phase 3 evolves the model layer to support per-member properties and improves UX. Phase 4 delivers the grillage solver — only possible after per-member properties are in place.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Trust and Production Hardening** - Fix production blockers, expand test suite, add BMD/SFD rendering and member stress output
- [ ] **Phase 2: 3D Truss Solver** - Add working /solve/truss3d endpoint with full analytical test coverage
- [ ] **Phase 3: Model Evolution and UX Polish** - Per-member properties, section property calculator, result export, UI debugging tools
- [ ] **Phase 4: Grillage Solver** - Add /solve/grillage endpoint with torsional stiffness and analytical tests

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
**Plans**: TBD
**UI hint**: yes

### Phase 2: 3D Truss Solver
**Goal**: Engineers can submit 3D truss problems to a /solve/truss3d endpoint and receive accurate displacement, reaction, and member force results — including structures with vertical members
**Depends on**: Phase 1
**Requirements**: TRUSS3D-01, TRUSS3D-02, TRUSS3D-03, TRUSS3D-04, TRUSS3D-05, TRUSS3D-06, TRUSS3D-07
**Success Criteria** (what must be TRUE):
  1. POST /solve/truss3d returns correct displacements and member forces for a hand-verifiable single inclined 3D bar
  2. POST /solve/truss3d handles a structure containing a vertical member without producing NaN in results
  3. test_truss3d.py contains 5+ passing tests including a 3D tetrahedron truss and multi-point load case
  4. Every test_truss3d.py test asserts stiffness matrix symmetry (np.allclose(K, K.T)) and global equilibrium
**Plans**: TBD

### Phase 3: Model Evolution and UX Polish
**Goal**: The frame2d solver accepts non-uniform member properties, engineers have a section property calculator to get I and A from geometry, and solve results can be exported from the browser
**Depends on**: Phase 1
**Requirements**: MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05
**Success Criteria** (what must be TRUE):
  1. A FrameModel2D with per-member E/I/A (list values) solves correctly; existing scalar E/I/A inputs continue to work without change
  2. Existing frame2d browser UI and all current tests pass without modification after the per-member model change
  3. A section property calculator returns correct I and A given section type (rectangle, circle, I-section) and dimensions
  4. After solving in the frame2d or truss2d browser UI, a download link produces a valid JSON file containing all result fields
  5. Frame2d UI shows a toggle-able overlay displaying node numbers and DOF labels on the canvas
**Plans**: TBD
**UI hint**: yes

### Phase 4: Grillage Solver
**Goal**: Engineers can submit grillage (bridge deck / floor system) problems to a /solve/grillage endpoint and receive accurate results including torsional effects
**Depends on**: Phase 3
**Requirements**: GRILLAGE-01, GRILLAGE-02, GRILLAGE-03, GRILLAGE-04, GRILLAGE-05
**Success Criteria** (what must be TRUE):
  1. POST /solve/grillage returns correct results for a simple two-member grillage with a central point load (hand-verifiable equilibrium)
  2. GrillageModel2D accepts per-member E, I, A, J, and G — torsional stiffness GJ is applied per member
  3. test_grillage.py contains 3+ passing tests including equilibrium verification and a torsion check
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Trust and Production Hardening | 0/TBD | Not started | - |
| 2. 3D Truss Solver | 0/TBD | Not started | - |
| 3. Model Evolution and UX Polish | 0/TBD | Not started | - |
| 4. Grillage Solver | 0/TBD | Not started | - |
