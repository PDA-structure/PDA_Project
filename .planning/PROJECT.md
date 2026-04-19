# PDA Analysis Software

## What This Is

A structural engineering analysis platform providing 2D truss and 2D frame/beam FEM solvers exposed via a FastAPI web API and browser UIs. The system is designed as a layered pipeline (Model → Adapter → Solver → AnalysisResult) with clean separation between computation, API, and visualization. Long-term goal: cross-platform (Mac, Windows, Blender) SaaS tool for structural engineers.

## Current State

**Shipped:** v1.0 — 2D Solver Foundation (2026-04-18)

- 2D truss and 2D frame solvers — working, tested, trusted
- FastAPI server with /health, /solve/truss2d, /solve/frame2d
- Browser UIs for both solvers: node/member drawing, supports, loads, UDL (vertical + horizontal), per-member E/I/A, section calculator, BMD/SFD/deformed shape, result export

**Shipped Partial:** v1.1 — Interchange and Grillage (2026-04-19, Phase 3 only; Grillage deferred to v1.3+)

- Canonical JSON schema v1.0 for both solvers — save and reload from browser UI without re-entering data
- Tekla Structural Designer Excel CLI converter (`converters/tekla_to_pda.py`) with editable COLUMN_MAP
- Revit PyRevit exporter (`pyrevit_exporters/export_to_pda.py`) for Revit 2023+ analytical models
- 41/41 pytest tests passing (includes pin-release regressions TRUST-09/10/11/12)

## Current Milestone: v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)

**Goal:** Solidify the 2D frame solver and UI (multi-member test coverage, spring supports, bug sweep) and establish Revit as the primary data-input path by shipping a geometry-exporter button plus a hardened analytical-model exporter in the sibling `CustomRevitExtension` pyRevit repo.

**Target features:**
- Multi-member frame solver test coverage (portal frame, continuous beams, mixed pin-releases)
- Spring supports end-to-end (solver back-end exists; add to frame2d UI)
- User-directed bug sweep of the 2D frame solver/UI
- Revit Tier 1 — Geometry Exporter button (drafting-view detail lines → canonical JSON)
- Revit Tier 2 — Analytical Exporter hardened (fix for Revit 2025, supports/loads/validation, proper production home)

## Core Value

Engineers can define a structure, solve it, and get accurate displacement, reaction, and member force results through a clean API — reliably, without manual FEM setup.

## Requirements

### Validated

- ✓ 2D truss FEM solver (2 DOF/node, tension-positive) — existing baseline
- ✓ 2D frame/beam solver v2 (3 DOF/node: Ux, Uy, θ) — existing baseline
- ✓ AnalysisResult dataclass (UG, FG, member_forces, member_shears, member_moments, meta) — existing baseline
- ✓ AnalysisEngine registry (register/solve/available_solvers) — existing baseline
- ✓ Truss2DAdapter and FrameV2Adapter translating models → AnalysisResult — existing baseline
- ✓ FastAPI server with /health, /solve/truss2d, /solve/frame2d endpoints — existing baseline
- ✓ Browser UI for 2D truss (canvas drawing, supports, loads, solve, results) — existing baseline
- ✓ Browser UI for 2D frame (UDL, supports, node loads, member properties, pin releases, solve, results) — existing baseline
- ✓ 10 passing pytest tests (truss2d and frame_v2) — existing baseline
- ✓ Strict layered architecture enforced (no matplotlib in solver_core, no side-effects) — existing baseline
- ✓ HTTP 422 on unstable/under-restrained structures (was HTTP 500) — v1.0
- ✓ All print()/summarize_results() removed from solver_core — v1.0
- ✓ Test suite: 15 tests with 5 analytical cases and equilibrium assertions on all tests — v1.0
- ✓ BMD and SFD rendered on frame2d canvas (cubic Hermite + quartic UDL correction) — v1.0
- ✓ Member stress (σ = F/A) in AnalysisResult meta, displayed in UI — v1.0
- ✓ Per-member E/I/A in FrameModel2D — Union[float, List[float]], backward-compatible — v1.0
- ✓ Section property calculator (rectangle, circle, I-section) in frame2d sidebar — v1.0
- ✓ JSON result export (timestamped download link) in both UIs — v1.0
- ✓ Node label / DOF overlay toggle in frame2d UI — v1.0
- ✓ Horizontal UDL support with direction-cosine decomposition — v1.0

### Active (v1.2 — 2D Frame Hardening + Revit-as-UI)

To be populated via REQUIREMENTS.md for v1.2. Covers solver hardening (multi-member tests, spring supports, bug sweep) and Revit-as-UI (Tier 1 geometry exporter + Tier 2 analytical exporter hardening).

### Deferred to v1.3+

- [ ] Grillage solver (/solve/grillage, torsional stiffness, analytical tests) — original v1.1 Phase 4, deferred after pivot
- [ ] Revit results-import button (read solver JSON, annotate model)
- [ ] 3D truss / 3D frame solvers

### Out of Scope

- frame_v1_legacy.py enhancements — legacy reference only, superseded by frame_v2
- matplotlib in solver_core computation path — hard rule, visualization is a leaf node
- Non-numpy dependencies in solver_core — keep computation layer dependency-light
- scipy in solver_core — numpy.linalg.solve is correct at current DOF scale
- Non-linear material (plasticity, creep) — requires entirely different FEM formulation; defer indefinitely
- Cloud deployment / authentication — not needed until SaaS commercialization phase

## Context

- **Architecture:** Strict layered pipeline: Model dataclass → Adapter → Solver (pure FEM/numpy) → AnalysisResult → API/Notebook/Visualization. Visualization is always a leaf node.
- **DOF conventions:** Frame solver uses 3 DOF/node (Ux, Uy, θ), 1-based in public API. Truss uses 2 DOF/node.
- **UDL sign:** Positive = downward. ENForces = [-wL/2, -wL/2], ENMoments = [wL²/12, -wL²/12]. Horizontal UDL uses direction-cosine decomposition.
- **Frame UI canvas:** GRID=20px = 1m. First node placed sets origin. Scale correction for flex layout via scaleX.
- **API:** uvicorn api_server.app:app --reload from pda_project/. CORS allow_origins=["*"]. Unit conversions in UI (E: GPa→Pa ×1e9, A: cm²→m² ×1e-4, I: cm⁴→m⁴ ×1e-8).
- **Tests:** 15 passing. All assert global equilibrium. Analytical cases: UDL beam (wL⁴/384EI), portal frame, bar member, pin release, propped cantilever (3wL/8).
- **Add-a-solver checklist:** Solver → Model → Adapter → Register in engine → API endpoint → Tests → UI (optional).
- **Hermite theta sign:** Solver theta is positive clockwise; standard Hermite slope requires dy/dx = -solver_theta.
- **Equilibrium assertion pattern:** Check reaction-DOF sum, not sum(FG) which is always zero by construction.

## Constraints

- **Tech stack:** Python/numpy for all solvers; FastAPI for API; vanilla JS for browser UIs; pytest for tests
- **Architecture:** solver_core must have NO matplotlib, NO printing in computation path
- **DOF numbering:** 1-based in public API (models, restrainedDoF), solvers convert to 0-based internally
- **Visualization:** visualization/ is always a leaf — may import from solver_core but never the reverse
- **New solvers:** Must be registered via engine.register() in api_server/app.py

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Layered pipeline (Model→Adapter→Solver→AnalysisResult) | Clean separation of concerns; adapters own translation, solvers stay pure FEM | ✓ Good |
| AnalysisEngine registry pattern | Single dispatch point; all new solvers plug in without touching existing code | ✓ Good |
| frame_v2 as primary active solver (v1 kept for reference) | v2 is cleaner, more capable; v1 kept for diffing/reference without removal risk | ✓ Good |
| 1-based DOF numbering in public API | Matches structural engineering convention; solvers convert internally | ✓ Good |
| Browser UIs as canvas-based vanilla JS | No framework dependency; matches simple SPA needs for tool prototype | ✓ Good — confirmed through v1.0 |
| HTTP 422 at exception handler level (not adapter) | Single catch point; adapters don't need try/except boilerplate | ✓ Good |
| Equilibrium checks target reaction DOFs only | sum(FG) is always 0 by construction; reaction-specific check is meaningful | ✓ Good |
| Per-member E/I/A as Union[float, List[float]] | Backward-compatible; no API versioning needed for this change | ✓ Good |
| Horizontal UDL via direction-cosine decomposition | Correct mechanics for inclined members; handles arbitrary angles | ✓ Good |
| Hermite quartic correction for UDL BMD | Cubic alone underestimates midspan by ~20%; quartic correction eliminates error | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-19 — v1.1 closed partial, v1.2 started (2D Frame Hardening + Revit-as-UI)*
