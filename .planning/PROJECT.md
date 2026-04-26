# PDA Analysis Software

## What This Is

A structural engineering analysis platform providing 2D truss and 2D frame/beam FEM solvers exposed via a FastAPI web API and browser UIs. The system follows a strict layered pipeline (Model → Adapter → Solver → AnalysisResult) with clean separation between computation, API, and visualization. v1.2 added Revit-as-UI: engineers can draw a 2D layout in Revit drafting views and round-trip to the frame2d browser solver in a single click. Long-term goal: cross-platform (Mac, Windows, Blender) SaaS tool for structural engineers.

## Current State

**Shipped:** v1.2 — 2D Frame Hardening + Revit-as-UI (MVP) (2026-04-26)

- 2D truss + 2D frame solvers — production-hardened, pure-bar-joint-robust, 61/61 pytest tests passing
- 56-baseline snapshot regression gate enforces byte-identical FEM outputs across all changes (D-16)
- FastAPI server with `/health`, `/solve/truss2d`, `/solve/frame2d` — structured 422 payload (`detail`, `cause`, `offending_nodes`, `offending_members`) with backward-compat flat fallback
- Frame2D + Truss2D browser UIs: full geometry editing, supports (incl. springs), loads, UDL (vertical + horizontal), per-member E/I/A, section calculator, BMD/SFD/deformed shape, save/load JSON, structured-422-aware error display with canvas diagnostic overlays
- pyRevit `ExportToPDA` pushbutton (sibling `CustomRevitExtension` repo): drafting-view detail lines → canonical PDA JSON → frame2d UI round-trip, validated with 6 live UAT fixtures
- Bonus: pyRevit `ExportToPDA_Truss` pushbutton (truss2d round-trip), HUMAN-UAT passed

<details>
<summary>Earlier shipped milestones</summary>

**v1.0 — 2D Solver Foundation (2026-04-18)** — Phases 1–2: HTTP 422 error handling, print removal, 15 analytical tests, BMD/SFD canvas rendering, member stress, per-member E/I/A, section property calculator, JSON result export, horizontal UDL with direction-cosine decomposition.

**v1.1 — Interchange and Grillage Partial (2026-04-19)** — Phase 3: canonical JSON schema v1.0, save/load in both UIs, Tekla Excel converter, Revit 2023+ PyRevit exporter, FastAPI TestClient integration suite. Phase 4 Grillage deferred to v1.3+.

</details>

## Current Milestone: v1.3 — Revit Tier 2 + Results-Import

**Goal:** Close the Revit round-trip — harden the analytical-model exporter (Tier 2, rescoped from v1.2) and ship a Results-Import pyRevit button that annotates the Revit model with solver output. Tightly Revit-themed milestone (sibling repo only on the pyRevit side; an additive `revit_meta` Pydantic field on the FastAPI side).

**Target features (in priority order):**
1. **Revit Tier 2 — Analytical Exporter Hardening** (REVIT-T2-01..07) — Revit 2023/24/25 compat, supports/loads/section-property extraction from analytical model, view-plane projection from active plan/elevation/section view, production-path migration to `Analytical.panel/StructuralAnalyticalModel.pushbutton/`, legacy retirement
2. **Revit Results-Import** — pyRevit button reads solver output JSON and annotates the Revit analytical model

**Key context:**
- Both features are carry-overs from earlier milestones — no greenfield scope
- Revit work continues in sibling `CustomRevitExtension` repo (pyRevit, IronPython 2.7); Windows host uses manual-copy deployment
- Grillage explicitly deferred — user priority is 3D solvers next (v1.4), grillage at v1.5+ "the very end"
- The only `pda_project/`-side change is the additive `revit_meta` Pydantic passthrough field on `Frame2DRequest` (and on future request schemas); solver/adapter MUST NOT read it

## Core Value

Engineers can define a structure (in browser or via Revit pushbutton), solve it, and get accurate displacement, reaction, and member force results through a clean API — reliably, without manual FEM setup.

## Requirements

### Validated

**Existing baseline:**
- ✓ 2D truss FEM solver (2 DOF/node, tension-positive)
- ✓ 2D frame/beam solver v2 (3 DOF/node: Ux, Uy, θ)
- ✓ AnalysisResult dataclass (UG, FG, member_forces, member_shears, member_moments, meta)
- ✓ AnalysisEngine registry (register/solve/available_solvers)
- ✓ Truss2DAdapter and FrameV2Adapter translating models → AnalysisResult
- ✓ FastAPI server with /health, /solve/truss2d, /solve/frame2d endpoints
- ✓ Browser UIs for both solvers
- ✓ Strict layered architecture (no matplotlib in solver_core, no side-effects)

**v1.0:**
- ✓ HTTP 422 on unstable/under-restrained structures (was HTTP 500)
- ✓ All print()/summarize_results() removed from solver_core
- ✓ 15 tests with 5 analytical cases and equilibrium assertions on all
- ✓ BMD and SFD on frame2d canvas (cubic Hermite + quartic UDL correction)
- ✓ Member stress (σ = F/A) in AnalysisResult meta and UI
- ✓ Per-member E/I/A in FrameModel2D — Union[float, List[float]], backward-compatible
- ✓ Section property calculator (rectangle, circle, I-section)
- ✓ JSON result export in both UIs
- ✓ Node label / DOF overlay toggle in frame2d
- ✓ Horizontal UDL with direction-cosine decomposition

**v1.1:**
- ✓ Canonical JSON schema v1.0 — same shape for save/load and solver API
- ✓ Save/Load JSON buttons in both UIs with full canvas state round-trip
- ✓ Tekla Structural Designer Excel → canonical JSON converter
- ✓ Revit 2023+ PyRevit exporter (analytical model based)
- ✓ Frame_v2 pin-release bug fixes (TRUST-09/10/11/12)
- ✓ Diagnostic JS error banner in both UIs (Safari-visible without DevTools)

**v1.2:**
- ✓ Multi-member frame test coverage — TRUST-13..17 (HARDEN-01)
- ✓ Spring supports end-to-end in frame2d UI (HARDEN-02)
- ✓ Canonical UAT harness — 5 fixtures + pytest TestClient + hand-calc asserts (HARDEN-03)
- ✓ pyRevit `ExportToPDA` pushbutton — drafting-view → canonical JSON (REVIT-T1-01)
- ✓ View-type guard + 2D-only warning (REVIT-T1-02)
- ✓ 1mm Chebyshev endpoint merge (REVIT-T1-03)
- ✓ Feet → metres × 0.3048, 4dp rounding, Z dropped (REVIT-T1-04)
- ✓ Exported JSON loads + solves in frame2d UI round-trip (REVIT-T1-05)
- ✓ Pure-bar joint detection in `assemble_primary_stiffness_matrix` (PUREBAR-01)
- ✓ Hybrid beam+bar models solve correctly via θ-DOF auto-restraint (PUREBAR-02)
- ✓ UDL-on-bar rejected at adapter with typed error — no silent drop (PUREBAR-03)
- ✓ frame2d UI replaces "Structure is unstable" with cause-aware diagnostics + canvas highlights (PUREBAR-04)
- ✓ Regression test using captured failing fixture (PUREBAR-05)

### Active (v1.3 — Revit Tier 2 + Results-Import)

Requirements being defined this milestone. See `.planning/REQUIREMENTS.md` once defined.

### Deferred to v1.4+

- [ ] 3D truss / 3D frame solvers — v1.4 (user priority: 3D before grillage)
- [ ] Grillage solver (/solve/grillage, torsional stiffness, analytical tests) — original v1.1 Phase 4. Deferred to v1.5+ at user request 2026-04-26 (3D solvers prioritised first)

### Out of Scope

- frame_v1_legacy.py enhancements — legacy reference only, superseded by frame_v2
- matplotlib in solver_core computation path — hard rule, visualization is a leaf node
- Non-numpy dependencies in solver_core — keep computation layer dependency-light
- scipy in solver_core — numpy.linalg.solve is correct at current DOF scale
- Non-linear material (plasticity, creep) — requires entirely different FEM formulation; defer indefinitely
- Cloud deployment / authentication — not needed until SaaS commercialization phase

## Context

- **Architecture:** Strict layered pipeline: Model dataclass → Adapter → Solver (pure FEM/numpy) → AnalysisResult → API/Notebook/Visualization. Visualization is always a leaf.
- **DOF conventions:** Frame solver 3 DOF/node (Ux, Uy, θ), 1-based in public API; truss 2 DOF/node.
- **UDL sign:** Positive = downward. ENForces = [-wL/2, -wL/2], ENMoments = [wL²/12, -wL²/12]. Horizontal UDL via direction-cosine decomposition.
- **Frame UI canvas:** GRID=20px = 1m. First node placed sets origin. Scale correction for flex layout via scaleX.
- **API:** uvicorn api_server.app:app --reload from pda_project/. CORS allow_origins=["*"]. Unit conversions in UI (E: GPa→Pa ×1e9, A: cm²→m² ×1e-4, I: cm⁴→m⁴ ×1e-8). Structured 422 payload includes `cause`, `offending_nodes`, `offending_members` (additive; flat-payload fallback preserved).
- **Tests:** 61 passing. All assert global equilibrium. Snapshot regression gate (56 baseline JSONs + pytest plugin) enforces byte-identical FEM outputs across changes.
- **Pure-bar joint handling:** `BeamBarStructure_v2.assemble_primary_stiffness_matrix` populates `_pure_bar_theta_dofs` for joints where every incident member is a bar; `extract_structure_stiffness_matrix` unions these into the existing `restrainedDoF + pinDoF` removal set. User-supplied DOFs (restrainedDoF/pinDoF/springDoF) always win — auto-restraint only fires when no user intent is recorded.
- **Revit data path:** sibling `CustomRevitExtension` repo (pyRevit, IronPython 2.7); `ExportToPDA.pushbutton` exports drafting-view detail lines → canonical PDA JSON; Windows host uses manual-copy deployment, not git clone.
- **Add-a-solver checklist:** Solver → Model → Adapter → Register in engine → API endpoint → Tests → UI (optional).
- **Hermite theta sign:** Solver theta is positive clockwise; standard Hermite slope requires `dy/dx = -solver_theta`.
- **Equilibrium assertion pattern:** Check reaction-DOF sum, not sum(FG) which is always zero by construction.

## Constraints

- **Tech stack:** Python/numpy for all solvers; FastAPI for API; vanilla JS for browser UIs; pytest for tests
- **Architecture:** solver_core must have NO matplotlib, NO printing in computation path
- **DOF numbering:** 1-based in public API (models, restrainedDoF), solvers convert to 0-based internally
- **Visualization:** visualization/ is always a leaf — may import from solver_core but never the reverse
- **New solvers:** Must be registered via engine.register() in api_server/app.py
- **No-regression gate (D-16):** snapshot baselines must be captured BEFORE solver mutation; pytest plugin enforces byte-identity on every existing test

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Layered pipeline (Model→Adapter→Solver→AnalysisResult) | Clean separation; adapters own translation, solvers stay pure FEM | ✓ Good |
| AnalysisEngine registry pattern | Single dispatch point; new solvers plug in without touching existing code | ✓ Good |
| frame_v2 as primary active solver (v1 kept for reference) | v2 is cleaner, more capable; v1 kept for diffing/reference | ✓ Good |
| 1-based DOF numbering in public API | Matches structural engineering convention; solvers convert internally | ✓ Good |
| Browser UIs as canvas-based vanilla JS | No framework dependency; matches simple SPA needs | ✓ Good — confirmed v1.0..v1.2 |
| HTTP 422 at exception handler level (not adapter) | Single catch point; adapters don't need try/except boilerplate | ✓ Good |
| Equilibrium checks target reaction DOFs only | sum(FG) is always 0 by construction; reaction-specific check is meaningful | ✓ Good |
| Per-member E/I/A as Union[float, List[float]] | Backward-compatible; no API versioning needed | ✓ Good |
| Horizontal UDL via direction-cosine decomposition | Correct mechanics for inclined members; arbitrary angles | ✓ Good |
| Hermite quartic correction for UDL BMD | Cubic alone underestimates midspan ~20%; quartic eliminates error | ✓ Good |
| Canonical JSON schema = solver API input shape | Save/load round-trip is the same as the solver request | ✓ Good — proven by Tekla and Revit converters fitting the same shape |
| Spring supports as type-discriminated JSON object | Backward-compatible with Phase 3 string-valued supports | ✓ Good |
| Validation at adapter layer (CLAUDE.md, D-18) | Semantic checks (UDL on bar, length mismatches) live in adapter; solver remains pure FEM | ✓ Good |
| `SolverDiagnosticError(RuntimeError)` for typed structured 422 | Existing FastAPI handler catches RuntimeError; subclass adds structured attrs without registering a new handler | ✓ Good — forward-compatible cause taxonomy |
| Pure-bar θ-DOF auto-restraint as structural invariant (D-02 reject regularisation) | Joint with no rotational DOF cannot have rotational equilibrium violated; restraining θ is mechanically correct, not a numerical hack | ✓ Good |
| Snapshot baseline BEFORE solver mutation (D-16 git ordering) | Mechanically enforces "don't damage the solver" — any drift surfaces immediately | ✓ Good |
| Drafting-view detail lines as MVP Revit data path (Tier 1 vs analytical-model Tier 2) | Simpler API surface; covers most engineer workflow; analytical-model extraction (Tier 2) deferred until Revit 2023/24/25 risk picture is fuller | ✓ Good — Tier 2 cleanly rescoped to v1.3 mid-v1.2 |
| Bonus pyRevit truss pushbutton (260423-a0q) recorded as bonus scope | Built opportunistically; honest scope tracking — formal v1.2 scope was frame exporter only | ✓ Good |

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
*Last updated: 2026-04-26 — v1.3 milestone started (Revit Tier 2 + Results-Import + Grillage). v1.2 shipped.*
