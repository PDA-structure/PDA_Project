# Phase 6: frame_v2 — Pure-Bar Joint Robustness — Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 7 files in scope (5 modify, 2 create)
**Analogs found:** 7 / 7 (all in-tree)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `solver_core/src/pda_analysis_software/solvers/frame_v2.py` | solver | transform (FEM matrix assembly) | self (modify in place) | self-pattern |
| `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` | adapter | transform / validation | self + `Truss2DAdapter` | self-pattern |
| `api_server/app.py` | api / exception-handler | request-response | self (extend existing handler) | self-pattern |
| `ui/frame2d/script.js` | ui-controller | request-response + canvas-render | self (extend `solve()` + add highlight fn) | self-pattern |
| `ui/frame2d/style.css` | ui-style | static | self (`#solveStatus.error`) | self-pattern |
| `tests/test_frame_v2.py` | test | analytical-verification | TRUST-13 (`test_trust_13_portal_frame_udl`) + TRUST-05 (`test_bar_member_in_mixed_structure`) | exact (same file, same pattern) |
| `tests/fixtures/uat/pure_bar_pratt_captured.json` | fixture | static | `tests/fixtures/uat/portal_frame.json` | exact (same dir, same schema) |

---

## Pattern Assignments

### `solver_core/src/pda_analysis_software/solvers/frame_v2.py` (solver, FEM transform)

**Analog:** self — extend existing `assemble_primary_stiffness_matrix` (line 398) and `extract_structure_stiffness_matrix` (line 420).

**Existing assembly loop to instrument** (lines 398–409):
```python
def assemble_primary_stiffness_matrix(self):
    self.Kp[:, :] = 0.0
    for e in range(self.n_members):
        m = e + 1
        if m in self.bars:
            Ke, dof = self._element_bar_global(e)
        else:
            rel_i = m in self.beamPinLeft
            rel_j = m in self.beamPinRight
            Ke, dof = self._element_frame_global(e, rel_i=rel_i, rel_j=rel_j)
        self.Kp[np.ix_(dof, dof)] += Ke
```

**Existing reduction step to extend** (lines 420–426):
```python
def extract_structure_stiffness_matrix(self):
    removed_dof = self.restrainedDoF + self.pinDoF
    removed_index = sorted({d - 1 for d in removed_dof})
    Ks = np.delete(self.Kp, removed_index, axis=0)
    Ks = np.delete(Ks, removed_index, axis=1)
    self.Ks = Ks
    self._removed_index = removed_index
```

**Bar-skip pattern in `__init__` and other methods** (line 69, 376, 497, 573, 600):
```python
self.bars = set(bars or [])      # __init__ stores bars as a set of 1-based ints

# Bar-skip iteration pattern (use this same pattern for the new pure-bar
# detection — iterate self.members, build per-node incidence, classify):
for e, (ni, nj) in enumerate(self.members):
    m = e + 1
    if m in self.bars:
        continue
    # ... beam-only logic
```

**1-based DOF convention for restraint lists** (CLAUDE.md hard rule, observed in tests):
```python
# θ DOF for node n (0-based index n) in 1-based public API:
#   theta_dof_1based = 3 * n + 3   (== (n + 1) * 3)
# self._pure_bar_theta_dofs follows self.restrainedDoF / self.pinDoF format:
# a list of 1-based ints, deduplicated by the existing set comprehension
# at line 422: `removed_index = sorted({d - 1 for d in removed_dof})`
```

**Spring-DoF lookup pattern (used as the predicate-exclusion source for D-04)** (lines 411–418):
```python
def add_spring_stiffnesses(self):
    if not self.springDoF:
        return
    if len(self.springDoF) != len(self.springStiffness):
        raise ValueError("springDoF and springStiffness must have the same length.")
    for dof1, k in zip(self.springDoF, self.springStiffness):
        idx = dof1 - 1
        self.Kp[idx, idx] += float(k)
```
Use `set(self.springDoF)` for the pure-bar predicate exclusion check.

**Concrete integration (per CONTEXT D-01..D-05):**
1. In `__init__`, initialise `self._pure_bar_theta_dofs: list[int] = []` near the existing `self.bars = set(...)` (line 69).
2. In `assemble_primary_stiffness_matrix`, after the loop (after line 409), build a per-node incidence count over `self.members`, classify nodes where every incident member's `(e+1) in self.bars`, compute `theta_1based = (n + 1) * 3`, and exclude any θ already in `set(self.restrainedDoF) | set(self.pinDoF) | set(self.springDoF)`. Store the result on `self._pure_bar_theta_dofs`.
3. In `extract_structure_stiffness_matrix`, change line 421 from `removed_dof = self.restrainedDoF + self.pinDoF` to `removed_dof = self.restrainedDoF + self.pinDoF + self._pure_bar_theta_dofs`. The `set(...)` deduplication at line 422 handles overlap automatically.
4. Add a docstring paragraph to `assemble_primary_stiffness_matrix` (and class docstring at lines 5–34) explaining the pure-bar predicate is a structural-engineering invariant, not regularisation (per `<specifics>` final bullet).

---

### `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` (adapter, validation transform)

**Analog:** self — `FrameV2Adapter` (lines 10–75). Validation precondition pattern from existing `if len(...) != n: raise ValueError(...)` block (lines 30–33).

**Imports pattern** (lines 1–5):
```python
import numpy as np
from pda_analysis_software.results.results import AnalysisResult
from pda_analysis_software.models.frame2d_model import FrameModel2D

from pda_analysis_software.solvers.frame_v2 import BeamBarStructure_v2
```

**Existing precondition / shape-validation pattern** (lines 30–33):
```python
if len(E_list) != n or len(I_list) != n:
    raise ValueError(f"E/I list length must equal n_members={n}")
if A_list is not None and len(A_list) != n:
    raise ValueError(f"A list length must equal n_members={n}")
```

**Existing solve() entry / exit shape** (lines 14–75 condensed):
```python
def solve(self) -> AnalysisResult:
    n = len(self.model.members)
    # ... build E_list/I_list/A_list ...
    # ... shape preconditions (raise ValueError on bad shapes) ...
    s = BeamBarStructure_v2(...)
    s.solve_structure()
    return AnalysisResult(solver="frame_v2", UG=..., FG=..., ...)
```

**Concrete integration (per CONTEXT D-06..D-08):**

Add a precondition block immediately after the existing length-check (line 33) and before the `BeamBarStructure_v2(...)` instantiation (line 35). Iterate `self.model.bars` (1-based member indices). For each bar member `m`, check `self.model.ENForces[m-1]` and `self.model.ENMoments[m-1]` for any non-zero entry; collect offending member indices.

If offending list is non-empty, raise the typed exception (D-09). Suggested location for the typed exception class: a new sibling module so both adapter and `app.py` can import it without circular imports — e.g. `solver_core/src/pda_analysis_software/errors.py` exporting:

```python
class SolverDiagnosticError(RuntimeError):
    """Structured solver/adapter failure carrying machine-readable cause + locus.

    Subclasses RuntimeError so the existing api_server exception handler
    (`@app.exception_handler(RuntimeError)`) catches it without changes;
    the handler reads `cause`, `offending_nodes`, `offending_members`,
    `detail` to upgrade the 422 payload (additive, backward-compatible).
    """
    def __init__(
        self,
        detail: str,
        cause: str,
        offending_nodes: list[int] | None = None,
        offending_members: list[int] | None = None,
    ):
        super().__init__(detail)
        self.detail = detail
        self.cause = cause
        self.offending_nodes = list(offending_nodes or [])
        self.offending_members = list(offending_members or [])
```

Adapter raise site:
```python
# After line 33, before line 35 (BeamBarStructure_v2 instantiation):
udl_on_bar = []
for m in self.model.bars:                 # m is 1-based
    e = m - 1
    if (np.any(self.model.ENForces[e] != 0.0) or
        np.any(self.model.ENMoments[e] != 0.0)):
        udl_on_bar.append(int(m))
if udl_on_bar:
    raise SolverDiagnosticError(
        detail=f"UDL applied to bar member(s) {udl_on_bar} — bars are axial-only.",
        cause="udl_on_bar",
        offending_members=udl_on_bar,
    )
```

---

### `api_server/app.py` (api, exception-handler extension)

**Analog:** self — extend the existing `runtime_error_handler` at lines 25–30.

**Existing handler** (lines 25–30):
```python
@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    return JSONResponse(
        status_code=422,
        content={"detail": "structure is unstable or under-restrained"},
    )
```

**Existing imports already in place** (line 1–13):
```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
# ... add:
from pda_analysis_software.errors import SolverDiagnosticError   # new import
```

**Concrete integration (per CONTEXT D-09, D-13):**
```python
@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    # If the typed exception (or any RuntimeError subclass with these attrs)
    # is raised, surface the structured payload. Otherwise fall back to the
    # current flat payload (backward compatible — existing UI readers that
    # only inspect `detail` continue to work).
    if isinstance(exc, SolverDiagnosticError) or hasattr(exc, "cause"):
        return JSONResponse(
            status_code=422,
            content={
                "detail": getattr(exc, "detail", str(exc)),
                "cause": getattr(exc, "cause", None),
                "offending_nodes": list(getattr(exc, "offending_nodes", []) or []),
                "offending_members": list(getattr(exc, "offending_members", []) or []),
            },
        )
    return JSONResponse(
        status_code=422,
        content={"detail": "structure is unstable or under-restrained"},
    )
```

No other endpoint, Pydantic model, or registration line in `app.py` changes.

---

### `ui/frame2d/script.js` (ui-controller, pre-solve scan + post-solve highlight)

**Analog:** self — extend `solve()` (line 483) and reuse `drawSupports()` style (line 732), `drawNodes()` (line 710), `highlightNode()` (line 723), `setStatus()` (line 579), and the `errorBanner` element used by the global `showError(...)` helper (lines 2–17).

**Existing payload + fetch pattern** (lines 545–576):
```javascript
const payload = {
    solver: 'frame_v2',
    nodes:   nodes.map(n => [n.realX, n.realY]),
    members: members.map(m => [m.start + 1, m.end + 1]),
    ENForces, ENMoments, forceVector,
    E, I, A,
    bars, beamPinLeft, beamPinRight,
    restrainedDoF,
    pinDoF: [], springDoF, springStiffness,
    udl_x: members.map(m => m.udl_x !== null ? m.udl_x : 0),
};

setStatus('Solving…');
try {
    const res = await fetch(`${API_URL}/solve/frame2d`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json();
        return setStatus('API error: ' + (err.detail || res.statusText), true);
    }
    results = await res.json();
    setStatus('Solved ✓', false);
    // ...
} catch {
    setStatus('Cannot reach API. Is the server running?', true);
}
```

**Existing `bars` flattening** (line 538) — reuse for predicate input:
```javascript
const bars = members.map((m,i) => m.type === 'bar' ? i+1 : null).filter(Boolean);
```

**Canvas highlight primitive** — `highlightNode(n, color)` already exists (lines 723–729):
```javascript
function highlightNode(n, color) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 8, 0, Math.PI*2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
}
```

**Node rendering reference for "small red dot" style** (lines 710–721 — `drawNodes()` uses `#e53935` fill):
```javascript
function drawNodes() {
    const r = 5 * getSymbolScale();
    nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI*2);
        ctx.fillStyle = '#e53935';
        ctx.fill();
        // ...
    });
}
```
Use a **smaller dot offset from the node centre** (e.g. radius `3 * sc`, offset `+10 * sc` to NE) to avoid overlapping the existing node dot. Same `#e53935` red.

**Status / error display primitive** (line 579–583):
```javascript
function setStatus(msg, isError = false) {
    const el = document.getElementById('solveStatus');
    el.textContent = msg;
    el.className = isError ? 'error' : (msg ? 'ok' : '');
}
```

**Concrete integration (per CONTEXT D-11, D-12):**

1. **Pre-solve scan**: insert a helper `validateBeforeSolve()` immediately before line 484 (top of `solve()`), running after the basic count/E/I/A checks. It returns `{ pureBarNodeIds: number[], udlOnBarIdx: number[] }`. Compute per-node incidence over `members`; flag nodes where every incident member has `m.type === 'bar'`. Flag bar members with `m.udl != null && m.udl !== 0`.
   - If `udlOnBarIdx.length > 0`: call `setStatus('UDL on bar member(s) ' + udlOnBarIdx + ': bars are axial-only. Change member type to beam or remove UDL.', true)` and `return` — blocks the solve. This is **blocking** per D-11.
   - If `pureBarNodeIds.length > 0`: call `setStatus('Note: pure-bar joints at nodes ' + ids + ' — θ will be auto-restrained on solve.', false)` (informational). Store the list on a module-level variable so `draw()` can paint dots. Continue to fetch.

2. **Post-solve structured-422 parsing**: replace lines 564–567 with:
```javascript
if (!res.ok) {
    const err = await res.json();
    let msg = 'API error: ' + (err.detail || res.statusText);
    if (err.cause) msg += ' [' + err.cause + ']';
    if (err.offending_nodes && err.offending_nodes.length) {
        // store for draw()
        offendingNodes = err.offending_nodes.map(n => n - 1);  // 1-based → 0-based id
    }
    if (err.offending_members && err.offending_members.length) {
        offendingMembers = err.offending_members.map(m => m - 1);
    }
    draw();   // re-render with highlights
    return setStatus(msg, true);
}
```

3. **Canvas highlight** — add `drawDiagnosticOverlays()` invoked from `draw()` (after `drawNodes()` at line 608). Iterate `pureBarNodeIds` and `offendingNodes`: for each, draw a small red filled circle near the node (re-use the `drawNodes` arc primitive). For `offendingMembers`: stroke the member line in red, lineWidth 3, on top of `drawMembers()`.

---

### `ui/frame2d/style.css` (ui-style)

**Analog:** self — `#solveStatus.error` (line 128) is the existing red-text class. Likely no CSS change needed if all highlights are canvas-drawn (per D-04 Claude's Discretion: "match existing support-symbol style in `drawSupports()`" — i.e. canvas drawing, not DOM elements).

**Existing red colour token**:
```css
#solveStatus.error { color: #c62828; }
```
Plus the canvas `#e53935` red used by `drawNodes()`. Re-use either in canvas; no new CSS class strictly required. Add one only if banner copy changes warrant a new severity colour.

---

### `tests/test_frame_v2.py` (tests, analytical verification)

**Analog:** TRUST-13 (`test_trust_13_portal_frame_udl`, lines 611–643) for symmetric-reactions + UDL pattern; TRUST-05 (`test_bar_member_in_mixed_structure`, lines 237–260) for bar-member assertions; TRUST-12 (lines 546–598 area) for shared-interior-node assertions.

**Imports already in file** (lines 1–14):
```python
import numpy as np
import pytest

from pda_analysis_software.solvers.frame_v2 import BeamBarStructure_v2
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter
from pda_analysis_software.models.frame2d_model import FrameModel2D
```

**For TRUST-20 (adapter rejection) — add `from pda_analysis_software.errors import SolverDiagnosticError`** plus the FastAPI TestClient pattern from `tests/test_uat_frame2d.py` (lines 36–53):
```python
from fastapi.testclient import TestClient
from api_server.app import app

@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)
```

**Closest analog test body (TRUST-13)** as the structural pattern for TRUST-18 (lines 611–643 above).

Note the assertion vocabulary — every TRUST-XX uses:
- `pytest.approx(value, rel=1e-5)` or `abs=1e-4` / `1e-6` for floating point
- `np.isclose(...)` for equilibrium sums
- Direct `s.FG[row, 0]` / `s.mbrMoments[e, 0]` indexing (0-based row → 1-based DOF/node mapping in the comments)

**TRUST-19 fixture-replay pattern** (analog: `tests/test_uat_frame2d.py:_load_and_solve`, lines 56–77):
```python
import json
from pathlib import Path

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "uat"

def _load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / f"{name}.json"
    with path.open() as fh:
        payload = json.load(fh)
    if payload.get("solver") == "frame2d":
        payload["solver"] = "frame_v2"
    payload.pop("schema_version", None)
    payload.pop("canvas", None)
    return payload

# Use TestClient.post('/solve/frame2d', json=payload) for the full-stack
# replay. assert response.status_code == 200 (post-fix) and inspect the
# JSON body keys: 'UG', 'FG', 'member_forces', 'member_shears',
# 'member_moments', 'meta'.
```

**TRUST-20 adapter-level rejection assertion**:
```python
def test_trust_20_udl_on_bar_adapter_rejection():
    """TRUST-20: UDL on bar member raises SolverDiagnosticError at adapter."""
    model = FrameModel2D(
        nodes=np.array([[0.0, 0.0], [1.0, 0.0]], float),
        members=np.array([[1, 2]], int),
        ENForces=np.array([[-5000.0, -5000.0]], float),  # UDL-like
        ENMoments=np.array([[0.0, 0.0]], float),
        forceVector=np.zeros((6, 1), float),
        E=200e9, I=1e-4, A=0.01,
        bars=[1],                                        # member 1 is a bar
        restrainedDoF=[1, 2, 3, 4, 5, 6],
    )
    adapter = FrameV2Adapter(model)
    with pytest.raises(SolverDiagnosticError) as excinfo:
        adapter.solve()
    assert excinfo.value.cause == "udl_on_bar"
    assert 1 in excinfo.value.offending_members

def test_trust_20_udl_on_bar_api_422(client):
    """TRUST-20b: API surfaces structured 422 payload."""
    response = client.post("/solve/frame2d", json={
        "solver": "frame_v2",
        "nodes": [[0.0, 0.0], [1.0, 0.0]],
        "members": [[1, 2]],
        "ENForces": [[-5000.0, -5000.0]],
        "ENMoments": [[0.0, 0.0]],
        "forceVector": [0, 0, 0, 0, 0, 0],
        "E": 200e9, "I": 1e-4, "A": 0.01,
        "bars": [1],
        "restrainedDoF": [1, 2, 3, 4, 5, 6],
    })
    assert response.status_code == 422
    body = response.json()
    assert body["cause"] == "udl_on_bar"
    assert 1 in body["offending_members"]
```

**Testing-hygiene lock-in (D-15)**: TRUST-18 / TRUST-19 must NOT include the auto-restrained θ DOFs in `pinDoF` or `restrainedDoF`. The test docstring should explicitly note: *"Pure-bar interior joint θ DOFs are NOT in pinDoF/restrainedDoF — only the auto-restraint mechanism in `assemble_primary_stiffness_matrix` brings them to zero."* Then assert `s.UG[3*n + 2, 0] == pytest.approx(0.0, abs=1e-12)` for each pure-bar interior node `n`.

---

### `tests/fixtures/uat/pure_bar_pratt_captured.json` (fixture, static)

**Analog:** `tests/fixtures/uat/portal_frame.json` (closest hybrid-structure example), `tests/fixtures/uat/cantilever.json` (canonical schema reference).

**Existing fixture schema** (excerpt from `cantilever.json`):
```json
{
    "schema_version": "1.0",
    "solver": "frame2d",
    "nodes": [[0, 0], [1, 0]],
    "members": [[1, 2]],
    "ENForces": [[0, 0]],
    "ENMoments": [[0, 0]],
    ...
}
```

**Concrete action**: copy `~/Downloads/frame2d-model-2026-04-22T06-14-49.json` verbatim into `tests/fixtures/uat/pure_bar_pratt_captured.json`. The Phase 4 D-12 convention is "saved-by-UI files committed verbatim — no schema editing"; the test loader normalises `solver: "frame2d"` → `"frame_v2"` and strips `schema_version` / `canvas` (per `_load_and_solve` lines 67–70).

---

## Shared Patterns

### 1-based DOF in public API (CLAUDE.md hard rule)

**Source:** CLAUDE.md §"Hard rules"; `frame_v2.py:421-422`; `tests/test_frame_v2.py:283`
**Apply to:** solver predicate output `_pure_bar_theta_dofs`, adapter offending-member lists, exception attributes, all UI payload integers, all fixtures.

```python
# Solver internal — 0-based row index built from 1-based public list:
removed_index = sorted({d - 1 for d in removed_dof})

# Test layer — 1-based DOF in restrainedDoF / pinDoF:
restrainedDoF=[1, 2, 3]      # node 1 fully fixed (Ux, Uy, θ)
pinDoF=[6]                   # node 2 θ released
```

θ DOF for node `n` (0-based id): `(n + 1) * 3` (1-based). Member numbers in `bars`, `beamPinLeft`, `beamPinRight`, `offending_members` are all 1-based.

### Layered validation placement (CLAUDE.md + D-18)

**Source:** CLAUDE.md §"Architecture & data-flow"; existing `frame_v2.py:79-98` (shape validation in solver) + `frame_adapters.py:30-33` (length validation in adapter).

| Layer | Validation responsibility |
|-------|--------------------------|
| Solver (`frame_v2.py`) | Pure-bar joint detection + auto-restrain (no error raised; resolves the case). |
| Adapter (`frame_adapters.py`) | Translation-layer semantic validation. Raises `SolverDiagnosticError` for UDL-on-bar (D-06). |
| API (`app.py`) | Pydantic schema validation (already in place); exception handler converts typed exceptions to structured 422 (D-09). |
| UI (`script.js`) | Pre-flight scan (informational + blocking) + post-flight highlight (D-11, D-12). |

### Backward-compatible additive extension

**Source:** Phase 4 D-08 (spring schema) + Phase 4 D-14 (solver alias `app.py:42`).
**Apply to:** D-09 (structured 422 fields), D-11 (UI overlays).

The 422 payload's `cause`, `offending_nodes`, `offending_members` are additive. Existing readers that only inspect `detail` continue to work. The exception handler falls back to the flat payload when the typed attributes are missing.

### Test pattern: equilibrium + analytical assertion

**Source:** `tests/test_frame_v2.py:611-643` (TRUST-13 prototype) — every frame test asserts:
1. Reaction values vs analytical closed-form (`pytest.approx(..., rel=1e-5)`)
2. ΣFx / ΣFy global equilibrium (`np.isclose(..., atol=1e-4)`)
3. ΣM at shared joints (`s.mbrMoments[e_left, 1] == pytest.approx(-s.mbrMoments[e_right, 0])`)

Apply this triad to TRUST-18 (Pratt) and TRUST-19 (captured fixture replay).

### FastAPI TestClient pattern

**Source:** `tests/test_uat_frame2d.py:36-53`.
**Apply to:** TRUST-20b (API-level structured 422 assertion).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `solver_core/src/pda_analysis_software/errors.py` (new, optional per D-09) | error-class module | n/a | No existing top-level errors module. CONTEXT D-09 leaves this as Claude's Discretion: inline in `app.py`, new `errors.py`, or attribute attachment to plain `RuntimeError` are all acceptable. Recommend new `errors.py` for clean import boundaries — adapter and `app.py` both need to import the symbol; an `errors.py` module avoids circular-import risk that inlining in `app.py` would create. |

---

## Metadata

**Analog search scope:** `solver_core/src/pda_analysis_software/{solvers,adapters,models,engine,results}/`, `api_server/`, `ui/frame2d/`, `tests/`, `tests/fixtures/uat/`
**Files scanned:** ~30 (full primary code paths)
**Pattern extraction date:** 2026-04-26
**Phase:** 06-frame-v2-pure-bar-joint-robustness
