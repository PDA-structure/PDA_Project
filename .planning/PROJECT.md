# PDA Analysis Software

## What This Is

A structural engineering analysis platform providing 2D truss and 2D frame/beam FEM solvers exposed via a FastAPI web API and browser UIs. The system is designed as a layered pipeline (Model → Adapter → Solver → AnalysisResult) with clean separation between computation, API, and visualization. Long-term goal: cross-platform (Mac, Windows, Blender) SaaS tool for structural engineers.

## Core Value

Engineers can define a structure, solve it, and get accurate displacement, reaction, and member force results through a clean API — reliably, without manual FEM setup.

## Requirements

### Validated

- ✓ 2D truss FEM solver (2 DOF/node, tension-positive) — existing
- ✓ 2D frame/beam solver v2 (3 DOF/node: Ux, Uy, θ) — existing
- ✓ AnalysisResult dataclass (UG, FG, member_forces, member_shears, member_moments, meta) — existing
- ✓ AnalysisEngine registry (register/solve/available_solvers) — existing
- ✓ Truss2DAdapter and FrameV2Adapter translating models → AnalysisResult — existing
- ✓ FastAPI server with /health, /solve/truss2d, /solve/frame2d endpoints — existing
- ✓ Browser UI for 2D truss (canvas drawing, supports, loads, solve, results) — existing
- ✓ Browser UI for 2D frame (UDL, fixed/pinned/roller supports, node loads, member properties, pin releases, solve, results) — existing
- ✓ 10 passing pytest tests (truss2d and frame_v2) — existing
- ✓ Strict layered architecture enforced (no matplotlib in solver_core, no side-effects in solvers) — existing

### Active

- [ ] Additional solver test coverage (UDL case, portal frame, bar member, pin releases)
- [ ] UX improvements to frame2d UI after manual testing
- [ ] 3D truss solver (pure numpy, 3 DOF/node, following add-a-solver checklist)
- [ ] Grillage solver (future, after 3D truss)

### Out of Scope

- frame_v1_legacy.py enhancements — legacy reference only, superseded by frame_v2
- matplotlib in solver_core computation path — hard rule, visualization lives in visualization/
- Non-numpy dependencies in solver_core — keep computation layer dependency-light

## Context

- **Architecture:** Strict layered pipeline: Model dataclass → Adapter → Solver (pure FEM/numpy) → AnalysisResult → API/Notebook/Visualization. Visualization is always a leaf node.
- **DOF conventions:** Frame solver uses 3 DOF/node (Ux, Uy, θ), 1-based in public API. Truss uses 2 DOF/node.
- **UDL sign:** Positive = downward. ENForces = [-wL/2, -wL/2], ENMoments = [wL²/12, -wL²/12].
- **Frame UI canvas:** GRID=20px = 1m. First node placed sets origin. Scale correction for flex layout via scaleX.
- **API:** uvicorn api_server.app:app --reload from pda_project/. CORS allow_origins=["*"]. Unit conversions in UI (E: GPa→Pa ×1e9, A: cm²→m² ×1e-4, I: cm⁴→m⁴ ×1e-8).
- **Current state (2026-04-05):** Solvers working and tested, API running, both browser UIs complete. 10 tests passing.
- **Add-a-solver checklist:** Solver → Model → Adapter → Register in engine → API endpoint → Tests → UI (optional).

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
| Browser UIs as canvas-based vanilla JS | No framework dependency; matches simple SPA needs for tool prototype | — Pending |

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
*Last updated: 2026-04-05 after initialization*
