# Requirements: PDA Analysis Software

**Defined:** 2026-04-05
**Core Value:** Engineers can define a structure, solve it, and get accurate displacement, reaction, and member force results through a clean API — reliably, without manual FEM setup.

## v1 Requirements

Requirements for the next milestone, grouped by phase.

### Trust and Production Hardening

- [ ] **TRUST-01**: Unstable structure returns HTTP 422 with a clear error message instead of HTTP 500 (`np.linalg.LinAlgError` caught at adapter level, message: "structure is unstable or under-restrained")
- [ ] **TRUST-02**: `summarize_results()` and all `print()` calls removed from `truss2d.py` in solver_core (enforced: grep check returns nothing in solver_core)
- [ ] **TRUST-03**: Frame solver test suite expanded with UDL simply-supported beam (analytical verification against wL⁴/384EI formula)
- [ ] **TRUST-04**: Frame solver test suite expanded with portal frame equilibrium (sum of reactions equals sum of applied loads)
- [ ] **TRUST-05**: Frame solver test suite expanded with bar member in mixed frame-bar structure
- [ ] **TRUST-06**: Frame solver test suite expanded with pin release (beamPinLeft / beamPinRight)
- [ ] **TRUST-07**: Frame solver test suite expanded with propped cantilever (statically indeterminate — analytical solution available)
- [ ] **TRUST-08**: Every test asserts reaction equilibrium: `sum(FG) + sum(applied loads) ≈ 0`
- [ ] **TRUST-09**: BMD (Bending Moment Diagram) rendered on frame2d UI canvas alongside deformed shape
- [ ] **TRUST-10**: SFD (Shear Force Diagram) rendered on frame2d UI canvas alongside deformed shape
- [ ] **TRUST-11**: Member stress output appended to AnalysisResult meta (`stress = F/A` per member for frame/truss)

### 3D Truss Solver

- [ ] **TRUSS3D-01**: `Truss3D` solver in `solver_core/src/pda_analysis_software/solvers/truss3d.py` — pure numpy, no side-effects, no printing, 3 DOF/node (Ux, Uy, Uz)
- [ ] **TRUSS3D-02**: `TrussModel3D` dataclass with `nodes: ndarray(n,3)`, `members: ndarray(m,2)`, `E: float`, `A: float`, `restrainedDoF: List[int]` (1-based), `forceVector: ndarray(3n,1)`
- [ ] **TRUSS3D-03**: `Truss3DAdapter` in `adapters/truss_adapters.py` implementing `solve() -> AnalysisResult` with solver="truss3d"
- [ ] **TRUSS3D-04**: `POST /solve/truss3d` endpoint registered via `engine.register("truss3d", ...)` in `api_server/app.py`
- [ ] **TRUSS3D-05**: 3D truss solver handles vertical members correctly (reference-vector fallback when member is parallel to reference — no NaN in results)
- [ ] **TRUSS3D-06**: `tests/test_truss3d.py` with minimum 5 analytical test cases: single inclined 3D bar (hand-verifiable), vertical member, horizontal plane truss (equilibrium check), 3D tetrahedron truss, multi-point load case
- [ ] **TRUSS3D-07**: Every `test_truss3d.py` test asserts stiffness matrix symmetry (`np.allclose(K, K.T)`) and global equilibrium

### Model Evolution and UX Polish

- [ ] **MODEL-01**: Per-member E/I/A properties supported in `FrameModel2D` via Pydantic union type (`E: Union[float, List[float]]`) with backward-compatible scalar broadcast to all members
- [ ] **MODEL-02**: API backward-compatible — existing frame2d browser UI and tests continue to work after per-member model change
- [ ] **MODEL-03**: Section property calculator as a standalone utility (given section type + dimensions → returns I, A) accessible from frame2d UI or as a helper function
- [ ] **MODEL-04**: Frame2d UI and truss2d UI can export solve results to JSON (download link in browser after solve)
- [ ] **MODEL-05**: Node numbers and DOF labels visible in frame2d UI (toggle-able overlay for debugging model setup)

### Grillage Solver

- [ ] **GRILLAGE-01**: `GrillageModel2D` dataclass with per-member `E`, `I`, `A`, `J` (torsional constant), `G` (shear modulus) — separate from `FrameModel2D`
- [ ] **GRILLAGE-02**: Grillage solver in `solver_core/src/pda_analysis_software/solvers/grillage.py` — 3 DOF/node (Vy, θx, θz), GJ torsional stiffness, pure numpy
- [ ] **GRILLAGE-03**: `GrillageAdapter` implementing `solve() -> AnalysisResult`
- [ ] **GRILLAGE-04**: `POST /solve/grillage` endpoint registered in engine
- [ ] **GRILLAGE-05**: `tests/test_grillage.py` with minimum 3 analytical test cases including equilibrium verification and torsion check

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Load Cases and Persistence

- **LOAD-01**: Named load cases (dead, live, wind) — requires persistence layer
- **LOAD-02**: Load combinations per structural code (1.2DL + 1.6LL) — requires named load cases
- **LOAD-03**: Saved model persistence (save/load structure definition) — requires storage backend

### Advanced Solvers

- **SOLVER-01**: 3D frame solver (6 DOF/node: Ux, Uy, Uz, θx, θy, θz) — significantly more complex than 3D truss
- **SOLVER-02**: Non-linear geometry (P-delta effects) — requires iteration; defer until linear elastic fully validated
- **SOLVER-03**: Influence lines — high analytical value; requires parametric load display

### Integrations

- **INT-01**: Blender integration — solver_core as importable Python package in Blender; defer until API versioned and stable
- **INT-02**: Result export to CSV for report generation

## Out of Scope

| Feature | Reason |
|---------|--------|
| frame_v1_legacy.py enhancements | Legacy reference only; superseded by frame_v2 |
| scipy in solver_core | Hard project rule: solver_core must be dependency-light; numpy.linalg.solve is correct at current scale |
| matplotlib in solver_core | Hard project rule: visualization is a leaf node |
| Real-time collaboration | Not in product scope for v1 SaaS |
| Non-linear material (plasticity, creep) | Requires entirely different FEM formulation; defer indefinitely |
| Cloud deployment / authentication | Not needed until SaaS commercialization phase |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRUST-01 | Phase 1 | Pending |
| TRUST-02 | Phase 1 | Pending |
| TRUST-03 | Phase 1 | Pending |
| TRUST-04 | Phase 1 | Pending |
| TRUST-05 | Phase 1 | Pending |
| TRUST-06 | Phase 1 | Pending |
| TRUST-07 | Phase 1 | Pending |
| TRUST-08 | Phase 1 | Pending |
| TRUST-09 | Phase 1 | Pending |
| TRUST-10 | Phase 1 | Pending |
| TRUST-11 | Phase 1 | Pending |
| TRUSS3D-01 | Phase 2 | Pending |
| TRUSS3D-02 | Phase 2 | Pending |
| TRUSS3D-03 | Phase 2 | Pending |
| TRUSS3D-04 | Phase 2 | Pending |
| TRUSS3D-05 | Phase 2 | Pending |
| TRUSS3D-06 | Phase 2 | Pending |
| TRUSS3D-07 | Phase 2 | Pending |
| MODEL-01 | Phase 3 | Pending |
| MODEL-02 | Phase 3 | Pending |
| MODEL-03 | Phase 3 | Pending |
| MODEL-04 | Phase 3 | Pending |
| MODEL-05 | Phase 3 | Pending |
| GRILLAGE-01 | Phase 4 | Pending |
| GRILLAGE-02 | Phase 4 | Pending |
| GRILLAGE-03 | Phase 4 | Pending |
| GRILLAGE-04 | Phase 4 | Pending |
| GRILLAGE-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after roadmap creation — traceability confirmed 26/26*
