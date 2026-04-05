# Stack Research

**Domain:** Structural engineering FEM solver SaaS — Python/numpy solver core, FastAPI backend, vanilla JS browser UI
**Researched:** 2026-04-05
**Confidence:** HIGH (core stack verified against installed packages); MEDIUM (scipy version — not installed)

## Context: What Is Already in Place

This is a subsequent-milestone research. The core stack is fixed and working:

- Python 3.10.11 — installed, active
- numpy 2.2.6 — installed, sole solver dependency
- FastAPI 0.135.0 — installed, API server
- Pydantic 2.12.5 — installed, request validation
- uvicorn 0.41.0 — installed, ASGI server
- pytest 9.0.2 — installed, test runner
- starlette 0.52.1 — installed (FastAPI dependency)

The research question is: what should be *added or used* when extending to 3D truss, grillage, and future solvers?

---

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

The 3D truss extension is a pure numpy exercise: 3 DOF/node, 3×3 direction cosine rotation matrix, same `k = EA/L` scalar element stiffness, same `np.linalg.solve` on reduced dense system. The hard rule "no non-numpy dependencies in solver_core" holds cleanly.

### For Large Models (future — not now)

| Library | Version | Purpose | When |
|---------|---------|---------|------|
| scipy | ~1.14 | Sparse solver (spsolve on CSR matrix) | Only if DOF count routinely exceeds ~5000. Not needed for 3D truss or grillage at structural engineering scale. |

---

## Installation

```bash
# Add to dev environment (not to solver_core dependencies):
pip install httpx pytest-cov

# Optional for complex analytical test verification:
pip install sympy

# If/when adding scipy for sparse solver performance path (future, NOT now):
pip install scipy
```

**Do not add scipy to `solver_core/pyproject.toml` dependencies.** The constraint "no non-numpy dependencies in solver_core" is a hard project rule. If scipy is ever needed, add it as an optional dependency or import it only inside an adapter, never inside a solver.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| numpy.linalg.solve (dense) | scipy.sparse.linalg.spsolve | Only if DOF count routinely exceeds ~5000. Dense solve is fine for the 3D truss and grillage milestones. |
| fastapi.testclient.TestClient | pytest-asyncio + AsyncClient | Use AsyncClient only if endpoints are genuinely async. Current endpoints are sync; TestClient is correct and simpler. |
| pytest.approx with analytical cases | Regression snapshots / golden files | Use snapshots only for complex geometries with no closed-form solution. Prefer analytical verification — it proves correctness, not just consistency. |
| np.linalg.solve | np.linalg.lstsq | lstsq handles near-singular systems but masks structural modeling errors. Keep solve + singular matrix error handling — it surfaces genuine modeling problems. |
| Vanilla JS canvas UI | React/Vue frontend | React only if the UI grows to multiple pages with shared state. The canvas-based SPA pattern is correct for single-solver tools. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| scipy in solver_core | Violates hard project rule; increases install complexity for Blender target | numpy.linalg.solve for dense FEM; scipy import inside adapter only if needed |
| matplotlib in solver_core | Hard project rule: no matplotlib in computation path | visualization/ module with lazy imports |
| numpy.matrix (deprecated) | Deprecated since numpy 1.15, will be removed | np.ndarray everywhere; `@` operator for matrix multiplication |
| np.linalg.inv to solve systems | Numerically inferior and ~3x slower than np.linalg.solve | np.linalg.solve(Ks, f_red) |
| frame_v1_legacy.py as template | Legacy reference only | frame_v2.py patterns |

---

## 3D Truss: Specific Stack Notes

The 3D truss extension follows directly from truss2d.py patterns with these changes:

- **DOF per node:** 3 (Ux, Uy, Uz) instead of 2
- **Local stiffness:** same scalar `k = EA/L`; same tension-positive sign convention
- **Transformation:** direction cosines `(lx, ly, lz)` where `lx = (xj-xi)/L` etc.
- **Element stiffness in global frame:** `k * outer(lmn, lmn)` assembled into 6×6 block matrix

This is pure numpy. No new dependencies. Follow the add-a-solver checklist in CLAUDE.md exactly.

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| numpy 2.2.6 | FastAPI 0.135.0 | No direct interaction — numpy arrays serialised to lists in API responses |
| Pydantic 2.12.5 | FastAPI 0.135.0 | Pydantic v2 required for FastAPI 0.100+; correct |
| httpx ≥0.27 | starlette 0.52.1 | FastAPI TestClient requires httpx; starlette 0.52.1 is compatible |
| Python 3.10 | numpy 2.2.6 | numpy 2.x requires Python 3.10+; this is met |

---

## Sources

- numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2 — verified against installed environment
- FastAPI TestClient / httpx requirement: official FastAPI docs (testing tutorial)
- 3D truss FEM formulation: standard structural FEM (direction cosine transformation, 3 DOF/node truss element)
- scipy version (~1.14): MEDIUM confidence — not installed in environment

---

*Stack research for: PDA Analysis Software — 3D truss / grillage extension*
*Researched: 2026-04-05*
