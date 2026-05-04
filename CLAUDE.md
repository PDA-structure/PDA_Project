# PDA Analysis Software — Claude Code Guide

## Project goal
Long-term: cross-platform (Mac, Windows, Blender) structural engineering SaaS tool.
Current focus: 2D truss and 2D frame/beam solvers with web API and browser UIs.

## Repository layout
```
pda_project/
  solver_core/          # editable Python package: pip install -e solver_core
    src/pda_analysis_software/
      solvers/
        truss2d.py          # Truss class, 2D FEM (2 DOF/node)
        frame_v2.py         # BeamBarStructure_v2, primary active solver (3 DOF/node)
        frame_v1_legacy.py  # old solver, kept for reference only
      models/               # TrussModel2D, FrameModel2D dataclasses
      adapters/             # Truss2DAdapter, FrameV2Adapter → AnalysisResult
        __init__.py
        frame_adapters.py   # FrameV2Adapter
        truss_adapters.py   # Truss2DAdapter
      engine/
        analysis_engine.py  # AnalysisEngine registry (register/solve/available_solvers)
      results/results.py    # AnalysisResult dataclass
  api_server/app.py     # FastAPI: /health, /solve/truss2d, /solve/frame2d
  visualization/        # matplotlib plotting (lazy imports, NOT imported by solver_core)
    truss2d_plots.py
  tests/                # pytest: test_truss2d.py, test_frame_v2.py (10 tests, all passing)
  ui/
    truss2d/            # Browser UI: index.html, style.css, script.js
    frame2d/            # Browser UI: index.html, style.css, script.js
  notebooks/
```

## Architecture & data-flow

The project follows a strict layered pipeline:

```
[Model dataclass]
      │  (passed to adapter factory registered in engine)
      ▼
[Adapter]  (translates Model → raw solver args, calls solver, wraps output)
      │
      ▼
[Solver]   (pure FEM computation, numpy only, no I/O)
      │
      ▼
[AnalysisResult]  (solver, UG, FG, member_forces, member_shears, member_moments, meta)
      │
      ▼
[API / Notebook / Visualization]
```

Key design principles:
- **Models** are plain dataclasses — no logic, no imports from solvers.
- **Adapters** own the translation layer. Each adapter's `solve()` must return `AnalysisResult`.
- **Solvers** are self-contained FEM engines — no side-effects, no printing, no matplotlib.
- **AnalysisEngine** is a registry: `engine.register(name, factory)` where `factory(model) → adapter instance`.
- **Visualization** is always a leaf — it may import from solver_core but solver_core never imports it.

### AnalysisResult fields
| Field | Type | Description |
|---|---|---|
| `solver` | `str` | Registered solver name |
| `UG` | `ndarray` | Global displacements, column vector |
| `FG` | `ndarray` | Global reaction forces, column vector |
| `member_forces` | `ndarray \| None` | Axial forces per member |
| `member_shears` | `ndarray \| None` | Shear per member (frame only) |
| `member_moments` | `ndarray \| None` | Moments per member, shape `(n_mbr, 2)` (frame only) |
| `meta` | `dict \| None` | Solver metadata (e.g. `n_nodes`, `n_members`) |

## Hard rules — read before touching anything
- `solver_core` must have **NO matplotlib, NO printing** in the computation path.
  Plotting lives in `visualization/` with lazy `import matplotlib` inside each function.
- DOF numbering: **1-based in the public API** (models, restrainedDoF lists); solvers convert to 0-based internally.
- `BeamBarStructure_v2.solve_structure()` resets the force vector each call — this is intentional.
- Never import from `visualization/` inside `solver_core/` or `api_server/`.
- All new solvers must be registered via `engine.register()` in `api_server/app.py`; the engine is the single point of dispatch.

## Frame solver conventions
- 3 DOF per node: Ux, Uy, θ (in that order)
- DOF base for node i (0-indexed): `base = i * 3 + 1` (1-based)
- Support → restrained DOFs: fixed → [base, base+1, base+2]; pinned → [base, base+1]; rollerX → [base]; rollerY → [base+1]
- UDL sign: positive = downward → ENForces = [-wL/2, -wL/2], ENMoments = [wL²/12, -wL²/12]
- Moment at fixed end of cantilever with downward load is **negative** (`mbrMoments[e,0] < 0`)

### FrameModel2D fields reference
| Field | Type | Notes |
|---|---|---|
| `nodes` | `ndarray (n,2)` | Node coordinates [x, y] in metres |
| `members` | `ndarray (m,2)` | Node index pairs (0-based internally) |
| `ENForces` | `ndarray (m,2)` | Equivalent nodal forces per member [start, end] |
| `ENMoments` | `ndarray (m,2)` | Equivalent nodal moments per member [start, end] |
| `forceVector` | `ndarray (3n,1)` | Global force vector (1-based DOFs mapped to rows) |
| `E` | `float` | Young's modulus (Pa) |
| `I` | `float` | Second moment of area (m⁴) |
| `A` | `float \| None` | Cross-sectional area (m²), uniform |
| `A_beam` / `A_bar` | `float \| None` | Per-type area when mixing beams and bars |
| `bars` | `List[int]` | Member indices that are bar elements (axial-only) |
| `beamPinLeft` | `List[int]` | Member indices with moment release at start node |
| `beamPinRight` | `List[int]` | Member indices with moment release at end node |
| `pins` | `ndarray \| None` | Legacy pin array — prefer beamPinLeft/Right |
| `restrainedDoF` | `List[int]` | 1-based DOF indices that are fixed |
| `pinDoF` | `List[int]` | 1-based DOF indices with pin (moment release at support) |
| `springDoF` | `List[int]` | 1-based DOF indices with spring support |
| `springStiffness` | `List[float]` | Spring stiffness values (N/m or N·m/rad) paired with springDoF |

## Truss solver conventions
- 2 DOF per node: Ux, Uy
- Tension positive in member forces

## API server
- Run: `uvicorn api_server.app:app --reload` from `pda_project/`
- CORS: allow_origins=["*"]
- Unit conversions in the UI: E GPa→Pa (×1e9), A cm²→m² (×1e-4), I cm⁴→m⁴ (×1e-8)
- Endpoints: `GET /health`, `POST /solve/truss2d`, `POST /solve/frame2d`
- `/health` returns `{"status": "ok", "solvers": [...]}` — useful for verifying solver registration
- Tailnet access (tailscale serve, persistent across reboots): with uvicorn running on `127.0.0.1:8000`, the API and UIs are reachable from any device on the same tailnet via `https://<mac-name>.<tailnet>.ts.net/...` (current host: `https://catrins-imac.tail568b7e.ts.net/`). Endpoints: `/health`, `/ui/truss2d/index.html`, `/ui/frame2d/index.html`, `POST /solve/{truss2d,frame2d}`.
- Tailscale runbook:
  - Register proxy (one-time, persists): `tailscale serve --bg 8000`
  - Inspect: `tailscale serve status`
  - Tear down: `tailscale serve reset`
  - `tailscale funnel` (public internet exposure) is intentionally NOT used — tailnet-only.

## UI conventions (both truss2d and frame2d)
- Canvas grid: GRID=20 px, UNIT=1 m → 1 grid square = 1 m
- First node placed sets `origin`; real coords: realX = (px - origin.x)/GRID, realY = (origin.y - py)/GRID
- Scale correction for flex layout: `scaleX = canvas.width / rect.width`
- Active button highlighting: `data-mode` attribute on buttons, toggled in `setMode()`
- Member hit detection: point-to-line distance, tolerance 8 px
- Mode entry auto-enables the matching visibility layer: support modes (fixed/pinned/rollerX/rollerY/spring) tick `chkSupports`, load modes (loadX/loadY/loadMoment/udl) tick `chkLoads`, and `draw()` is called so previously-added invisible glyphs become visible immediately. Implemented in `setMode()`. Closes the long-standing "click does nothing visible" foot-gun (debug session `.planning/debug/frame2d-load-then-add-support.md`). frame2d done 2026-05-04 (quick 260504-ene); truss2d follow-up pending.

## How to add a new solver
Follow this checklist to extend the system cleanly:

1. **Solver** — add `solver_core/src/pda_analysis_software/solvers/<name>.py`
   - Pure numpy FEM; no printing, no matplotlib, no side-effects
2. **Model** — add `models/<name>_model.py` as a `@dataclass`
   - All arrays as `np.ndarray`; DOF lists as `List[int]` (1-based)
3. **Adapter** — add `adapters/<name>_adapters.py` with a class `<Name>Adapter`
   - `__init__(self, model: <Model>)` and `solve(self) -> AnalysisResult`
4. **Register** — in `api_server/app.py`:
   ```python
   engine.register("<name>", lambda model: <Name>Adapter(model))
   ```
5. **API endpoint** — add `POST /solve/<name>` with a Pydantic request model
6. **Tests** — add `tests/test_<name>.py` with at least one analytical verification case
7. **UI** (optional) — add `ui/<name>/` following the existing canvas conventions

## Current status (2026-04-05)
- Solvers: working and tested
- API: running, both endpoints verified
- Truss UI: complete with supports, loads, solve, results, coordinate display
- Frame UI: complete with UDL, fixed/pinned/roller supports, node loads, member properties (beam/bar, pin releases), solve, results, coordinate display
- Tests: 10 passing

## Next tasks (in rough priority)
1. Further UX testing of frame UI — try cantilever, simple beam, portal frame
2. Additional solver tests — UDL case, portal frame, bar member, pin releases
3. UX improvements as needed after testing
4. Future solvers: 3D truss, grillage, etc.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**PDA Analysis Software**

A structural engineering analysis platform providing 2D truss and 2D frame/beam FEM solvers exposed via a FastAPI web API and browser UIs. The system is designed as a layered pipeline (Model → Adapter → Solver → AnalysisResult) with clean separation between computation, API, and visualization. Long-term goal: cross-platform (Mac, Windows, Blender) SaaS tool for structural engineers.

**Core Value:** Engineers can define a structure, solve it, and get accurate displacement, reaction, and member force results through a clean API — reliably, without manual FEM setup.

### Constraints

- **Tech stack:** Python/numpy for all solvers; FastAPI for API; vanilla JS for browser UIs; pytest for tests
- **Architecture:** solver_core must have NO matplotlib, NO printing in computation path
- **DOF numbering:** 1-based in public API (models, restrainedDoF), solvers convert to 0-based internally
- **Visualization:** visualization/ is always a leaf — may import from solver_core but never the reverse
- **New solvers:** Must be registered via engine.register() in api_server/app.py
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Context: What Is Already in Place
- Python 3.10.11 — installed, active
- numpy 2.2.6 — installed, sole solver dependency
- FastAPI 0.135.0 — installed, API server
- Pydantic 2.12.5 — installed, request validation
- uvicorn 0.41.0 — installed, ASGI server
- pytest 9.0.2 — installed, test runner
- starlette 0.52.1 — installed (FastAPI dependency)
## Recommended Stack
### Core Technologies (existing — do not change)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.10.11 | Runtime | Already installed; ≥3.10 required by pyproject.toml |
| numpy | 2.2.6 | All FEM computation | Sole solver_core dependency; `np.linalg.solve` is correct for dense systems at structural engineering scale (hundreds of DOF); no reason to add scipy just for linalg |
| FastAPI | 0.135.0 | HTTP API | Already installed; current version |
| Pydantic | 2.12.5 | Request validation | Already installed; v2 is current |
| uvicorn | 0.41.0 | ASGI server | Already installed |
| pytest | 9.0.2 | Test runner | Already installed; analytical verification pattern established |
### Supporting Libraries (add these)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | ≥0.27 | FastAPI TestClient backend | Required for `from fastapi.testclient import TestClient`. Add to dev dependencies now — needed for API-level integration tests on new solver endpoints. |
| pytest-cov | ≥5.0 | Test coverage reporting | Add to dev dependencies when suite grows beyond 10 tests. Surfaces untested code paths in adapters and solvers. |
| sympy | ≥1.12 | Analytical verification in tests | Optional. Symbolically derive closed-form solutions to compare against solver output. Useful for complex test cases where hand-computation is error-prone. |
### For 3D Truss Solver (no new runtime dependencies needed)
### For Large Models (future — not now)
| Library | Version | Purpose | When |
|---------|---------|---------|------|
| scipy | ~1.14 | Sparse solver (spsolve on CSR matrix) | Only if DOF count routinely exceeds ~5000. Not needed for 3D truss or grillage at structural engineering scale. |
## Installation
# Add to dev environment (not to solver_core dependencies):
# Optional for complex analytical test verification:
# If/when adding scipy for sparse solver performance path (future, NOT now):
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| numpy.linalg.solve (dense) | scipy.sparse.linalg.spsolve | Only if DOF count routinely exceeds ~5000. Dense solve is fine for the 3D truss and grillage milestones. |
| fastapi.testclient.TestClient | pytest-asyncio + AsyncClient | Use AsyncClient only if endpoints are genuinely async. Current endpoints are sync; TestClient is correct and simpler. |
| pytest.approx with analytical cases | Regression snapshots / golden files | Use snapshots only for complex geometries with no closed-form solution. Prefer analytical verification — it proves correctness, not just consistency. |
| np.linalg.solve | np.linalg.lstsq | lstsq handles near-singular systems but masks structural modeling errors. Keep solve + singular matrix error handling — it surfaces genuine modeling problems. |
| Vanilla JS canvas UI | React/Vue frontend | React only if the UI grows to multiple pages with shared state. The canvas-based SPA pattern is correct for single-solver tools. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| scipy in solver_core | Violates hard project rule; increases install complexity for Blender target | numpy.linalg.solve for dense FEM; scipy import inside adapter only if needed |
| matplotlib in solver_core | Hard project rule: no matplotlib in computation path | visualization/ module with lazy imports |
| numpy.matrix (deprecated) | Deprecated since numpy 1.15, will be removed | np.ndarray everywhere; `@` operator for matrix multiplication |
| np.linalg.inv to solve systems | Numerically inferior and ~3x slower than np.linalg.solve | np.linalg.solve(Ks, f_red) |
| frame_v1_legacy.py as template | Legacy reference only | frame_v2.py patterns |
## 3D Truss: Specific Stack Notes
- **DOF per node:** 3 (Ux, Uy, Uz) instead of 2
- **Local stiffness:** same scalar `k = EA/L`; same tension-positive sign convention
- **Transformation:** direction cosines `(lx, ly, lz)` where `lx = (xj-xi)/L` etc.
- **Element stiffness in global frame:** `k * outer(lmn, lmn)` assembled into 6×6 block matrix
## Version Compatibility
| Package | Version | Notes |
|---------|---------|-------|
| numpy 2.2.6 | FastAPI 0.135.0 | No direct interaction — numpy arrays serialised to lists in API responses |
| Pydantic 2.12.5 | FastAPI 0.135.0 | Pydantic v2 required for FastAPI 0.100+; correct |
| httpx ≥0.27 | starlette 0.52.1 | FastAPI TestClient requires httpx; starlette 0.52.1 is compatible |
| Python 3.10 | numpy 2.2.6 | numpy 2.x requires Python 3.10+; this is met |
## Sources
- numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2 — verified against installed environment
- FastAPI TestClient / httpx requirement: official FastAPI docs (testing tutorial)
- 3D truss FEM formulation: standard structural FEM (direction cosine transformation, 3 DOF/node truss element)
- scipy version (~1.14): MEDIUM confidence — not installed in environment
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
