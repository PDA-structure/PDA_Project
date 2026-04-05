# Architecture Research

**Domain:** Structural Engineering FEM Solver — Extension to 3D Elements
**Researched:** 2026-04-05
**Confidence:** HIGH (based on direct codebase analysis)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (FastAPI)                      │
│   POST /solve/truss2d   POST /solve/frame2d   POST /solve/*  │
├─────────────────────────────────────────────────────────────┤
│                   AnalysisEngine (registry)                   │
│   engine.register(name, factory)  →  engine.solve(model)     │
├──────────────┬──────────────────────┬───────────────────────┤
│  Adapter     │       Adapter        │        Adapter         │
│ Truss2D      │     FrameV2          │      Truss3D (new)     │
│  Adapter     │     Adapter          │       Adapter          │
├──────────────┼──────────────────────┼───────────────────────┤
│  Solver      │       Solver         │        Solver          │
│ truss2d.py   │   frame_v2.py        │    truss3d.py (new)    │
│  (2 DOF)     │    (3 DOF)           │      (3 DOF/node)      │
├──────────────┴──────────────────────┴───────────────────────┤
│                     AnalysisResult                            │
│   solver, UG, FG, member_forces, member_shears,              │
│   member_moments, meta                                        │
└─────────────────────────────────────────────────────────────┘
         ↓                                   ↓
  visualization/ (leaf)             notebooks/ (leaf)
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| Model dataclass | Declarative structure description, no logic | TrussModel2D, FrameModel2D, TrussModel3D (new) |
| Adapter | Translate Model → solver args, call solver, wrap in AnalysisResult | One adapter per solver |
| Solver | Pure FEM computation, numpy only, no I/O, no side-effects | Stateless; inputs → outputs |
| AnalysisEngine | Registry and dispatch | `register(name, factory)` → `solve(name, model)` |
| AnalysisResult | Typed container for all solver outputs | UG, FG, member_forces, shears, moments, meta |
| API endpoints | Validate Pydantic models, dispatch to engine, return JSON | Never calls solvers directly |
| Visualization | Matplotlib plotting, lazy imports | Leaf — imports solver_core, never imported by it |

## Recommended Project Structure (Extension)

```
solver_core/src/pda_analysis_software/
├── solvers/
│   ├── truss2d.py          # existing
│   ├── frame_v2.py         # existing (primary)
│   ├── frame_v1_legacy.py  # existing (reference only)
│   └── truss3d.py          # NEW — 3 DOF/node, 3D coordinate transform
├── models/
│   ├── truss2d_model.py    # existing
│   ├── frame2d_model.py    # existing
│   └── truss3d_model.py    # NEW — nodes (n,3), same member/restraint pattern
├── adapters/
│   ├── truss_adapters.py   # existing — add Truss3DAdapter here
│   ├── frame_adapters.py   # existing
│   └── __init__.py
├── engine/
│   └── analysis_engine.py  # existing — no changes needed
└── results/
    └── results.py          # existing — no changes needed for 3D truss
```

### Structure Rationale

- **truss3d.py:** Add as sibling to truss2d.py, same pure-FEM contract. ~100 lines.
- **truss3d_model.py:** Separate dataclass from TrussModel2D — shared model with optional `z` creates ambiguity throughout adapter and solver code.
- **Truss3DAdapter in truss_adapters.py:** Consistent with existing pattern (both truss adapters in one file).
- **AnalysisResult unchanged:** UG, FG, member_forces are unsized arrays — 3D results fit without new fields.

## Architectural Patterns

### Pattern 1: Registry + Factory (existing, extend cleanly)

**What:** `engine.register(name, lambda model: Adapter(model))` — the engine maps string names to adapter factories.
**When to use:** Every new solver. Zero changes to engine or existing code.
**Trade-offs:** Lookup by string name means typos fail at runtime, not compile time. Acceptable for this scale.

**Extension:**
```python
# api_server/app.py — add these two lines for 3D truss
from pda_analysis_software.adapters.truss_adapters import Truss3DAdapter
engine.register("truss3d", lambda model: Truss3DAdapter(model))
```

### Pattern 2: 3D Truss Stiffness Assembly

**What:** 6×6 member stiffness via direction cosines `l, m, n`; scatter-assembled with `np.ix_`.
**When to use:** Every 3D bar/truss element. Extends 2D pattern directly.
**Trade-offs:** Direction cosine computation must handle degenerate cases (vertical members, zero-length). Test thoroughly.

**Core math:**
```python
# Direction cosines for 3D member
dx, dy, dz = x2-x1, y2-y1, z2-z1
L = np.sqrt(dx**2 + dy**2 + dz**2)
l, m, n = dx/L, dy/L, dz/L
lmn = np.array([l, m, n])
# 6x6 member stiffness (local → global already via direction cosines)
k_e = (EA/L) * np.block([[np.outer(lmn,lmn), -np.outer(lmn,lmn)],
                           [-np.outer(lmn,lmn), np.outer(lmn,lmn)]])
```

### Pattern 3: Separate Model per Solver (do not share)

**What:** Each solver has its own Model dataclass. No shared base class with optional fields.
**When to use:** Always. Even if 2D and 3D trusses look similar.
**Trade-offs:** Some duplication, but avoids optional-field ambiguity that propagates through adapters and test fixtures.

## Data Flow

### 3D Truss Request Flow

```
POST /solve/truss3d (JSON)
    ↓
Pydantic TrussRequest3D (validation)
    ↓
TrussModel3D dataclass (nodes: ndarray(n,3), members: ndarray(m,2), ...)
    ↓
engine.solve("truss3d", model)
    ↓
Truss3DAdapter.solve()
    ↓
truss3d.Truss3D.solve_structure() → (UG, FG, member_forces)
    ↓
AnalysisResult(solver="truss3d", UG=..., FG=..., member_forces=...)
    ↓
JSON response
```

### DOF Numbering (3D truss extension of existing convention)

```
Node i (0-indexed) → DOFs [3i+1, 3i+2, 3i+3]  (1-based, matching existing convention)
Total DOFs = 3 * n_nodes
Restrained DOFs → np.ix_ to reduce K, F → solve for free DOFs
```

### Key Data Flows

1. **Grillage (future):** Requires new fields `J` (torsional constant) and `G` (shear modulus) — not in any current model. Add to GrillageModel2D, do not retrofit FrameModel2D.
2. **AnalysisResult.meta:** Use `meta` dict for solver-specific extras (e.g., `n_nodes`, `n_members`, `member_lengths` for 3D). No schema changes needed.

## Build Order

| Priority | Component | Risk | Dependencies |
|----------|-----------|------|--------------|
| 1 | `truss3d.py` solver | LOW | None — pure numpy extension of truss2d pattern |
| 2 | `TrussModel3D` dataclass | LOW | None |
| 3 | `Truss3DAdapter` | LOW | truss3d.py, TrussModel3D |
| 4 | `/solve/truss3d` endpoint | LOW | Adapter registered |
| 5 | `tests/test_truss3d.py` | LOW | Endpoint live |
| 6 | Grillage solver | MEDIUM-HIGH | Per-member E/I/A/J/G (breaking model change) |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (prototype) | Monolith is correct — solver_core + single API process |
| 10-100 concurrent users | Add uvicorn workers (`--workers N`); solvers are stateless, scales linearly |
| Heavy computation (large meshes) | Offload to background tasks via FastAPI BackgroundTasks or Celery; return job ID |
| SaaS multi-tenant | Add auth middleware, per-user quotas; solver_core unchanged |

### Scaling Priorities

1. **First bottleneck:** API worker saturation (numpy blocks GIL). Fix: multiple uvicorn workers.
2. **Second bottleneck:** Very large models (1000+ nodes). Fix: background task queue; not needed for structural-scale problems.

## Anti-Patterns

### Anti-Pattern 1: Shared Model with Optional 3D Fields

**What people do:** Add `z: Optional[float] = None` to TrussModel2D to support both 2D and 3D.
**Why it's wrong:** Ambiguity propagates everywhere — adapters must check, tests become confusing, type safety degrades.
**Do this instead:** Create a separate `TrussModel3D` with `nodes: ndarray(n,3)`. Parallel, clean, unambiguous.

### Anti-Pattern 2: Geometry in the Adapter

**What people do:** Compute direction cosines, member lengths in the adapter before calling the solver.
**Why it's wrong:** Adapter's job is translation, not FEM math. Geometry belongs in the solver where it can be unit-tested directly.
**Do this instead:** Pass raw coordinates to the solver. Solver computes geometry internally.

### Anti-Pattern 3: Printing/Logging in Solvers

**What people do:** Add `print(f"Assembling K for member {e}...")` during debugging and leave it in.
**Why it's wrong:** Hard rule — solver_core must have no printing in the computation path. Breaks API response integrity.
**Do this instead:** Use `meta` dict to return debug info as structured data; log at API layer only.

### Anti-Pattern 4: Importing visualization/ from solver_core

**What people do:** Add a convenience `plot()` method on the solver or adapter.
**Why it's wrong:** Creates a matplotlib dependency in solver_core, breaking the leaf-node contract.
**Do this instead:** Visualization reads AnalysisResult. Never the reverse.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API ↔ Engine | `engine.solve(name, model)` | Engine is the single dispatch point |
| Engine ↔ Adapter | `factory(model)` → `adapter.solve()` | Factory registered at startup |
| Adapter ↔ Solver | Direct Python call, pure args | No shared state |
| Solver ↔ AnalysisResult | Constructor call | Solver returns raw arrays; adapter wraps |
| visualization/ ↔ solver_core | Import only (one direction) | visualization reads results, never writes |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Blender (future) | Import solver_core as Python package directly | Avoids HTTP overhead; same AnalysisResult contract |
| Browser UI | HTTP POST to /solve/* | JSON in, JSON out; unit conversions in UI layer |

## Sources

- Direct codebase analysis: `solver_core/src/pda_analysis_software/` (April 2026)
- Standard FEM textbook: 3D truss stiffness derivation (McGuire, Gallagher & Ziemian)
- Existing pattern: truss2d.py assembly pattern replicated for 3D

---
*Architecture research for: PDA Analysis Software — 3D solver extension*
*Researched: 2026-04-05*
