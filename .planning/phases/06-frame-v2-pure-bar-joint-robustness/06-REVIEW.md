---
phase: 06-frame-v2-pure-bar-joint-robustness
status: issues_found
depth: standard
files_reviewed: 11
findings:
  critical: 0
  warning: 4
  info: 7
  total: 11
date: 2026-04-26
reviewer: gsd-code-reviewer
---

# Phase 06 — Code Review

## Files Reviewed (11)

- `solver_core/src/pda_analysis_software/solvers/frame_v2.py`
- `solver_core/src/pda_analysis_software/errors.py`
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py`
- `api_server/app.py`
- `ui/frame2d/script.js`
- `tests/test_frame_v2.py`
- `tests/test_phase6_ui_contract.py`
- `conftest.py` (untracked at review time — promoted to main in commit `3e839f4` after review)
- `scripts/capture_solver_snapshots.py`
- `scripts/verify_solver_snapshots.py`
- `scripts/_snapshot_common.py`

## Summary

**0 Critical / 4 Warning / 7 Info.** The phase deliverables (PUREBAR-01..05) are correct and the user's hard "do not damage the solver" constraint is honoured: pytest passes 61/61 with no regressions in pre-existing tests. Findings cluster around the snapshot regression infrastructure (3 of 4 warnings) — these are tooling-robustness gaps, not behavioural defects.

One finding (missing `conftest.py`) was fixed during review (commit `3e839f4`).

---

## Warnings

### WR-01: Hardcoded absolute path in snapshot path-resolution logic

**File:** `scripts/_snapshot_common.py:42-43`

```python
_MAIN_SRC = "/Users/catrinevans/Documents/pda_project/solver_core/src"
sys.path[:] = [p for p in sys.path if p != _MAIN_SRC]
```

**Problem:** Tied to one developer's machine and one repo location. CI runners, other developers, and the same developer's machine if the repo is moved will silently fall through to whatever path is first in `sys.path` — defeating the deliberate purge that ensures the worktree's `solver_core` wins over an editable install.

**Verified impact:** Running `python3 scripts/verify_solver_snapshots.py` from the project root currently fails with `ModuleNotFoundError: No module named 'pda_analysis_software'`. The standalone verify script does not work on main. (The pytest plugin path via `python3 -m pytest tests/` works because pytest's own path resolution picks up the editable install.)

**Fix:** Replace the hardcoded path with a generic match:
```python
_main_src_candidates = [
    p for p in sys.path
    if p.endswith("solver_core/src") and Path(p).resolve() != _WORKTREE_SRC.resolve()
]
sys.path[:] = [p for p in sys.path if p not in _main_src_candidates]
```

**Severity:** Warning. Not blocking — the no-regression guarantee is held by pytest's existing assertions (61/61 still pass). The snapshot infrastructure is bonus protection.

### WR-02: UI pre-solve scan does not mirror server-side exclusion predicate

**File:** `ui/frame2d/script.js:525-535` (`validateBeforeSolve()`)

The server-side predicate (`frame_v2.py:450-470`) excludes a θ DOF from auto-restraint if it is already in `restrainedDoF`, `pinDoF`, or `springDoF`. The client-side scan flags every node whose incident members are all bars as "pure-bar" regardless of these. Result: false-positive informational red dot when a fully-fixed pure-bar joint exists.

**Severity:** Warning. Cosmetic — Solve still proceeds correctly because the server applies its own exclusions. The status text mildly misleads in edge cases.

**Fix:** Compute `excluded` client-side from the `supports` array (fixed support's θ DOF, spring with non-null `Ktheta`) and gate the `pureBar.push(nodeId)` branch on `!supports.some(s => s.nodeId === nodeId && (s.type === 'fixed' || (s.type === 'spring' && s.Ktheta != null)))`.

### WR-03: Module-level filesystem side-effect at import time

**File:** `scripts/_snapshot_common.py:48`

`SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)` runs at import time. Any tool that imports the module (directly or transitively) creates `tests/snapshots/baseline/` on disk as a side effect. Read-only environments (CI sandboxes, code-review containers) will raise `PermissionError` at import rather than at the actual mkdir use site.

**Severity:** Warning. Latent — won't fire today on the user's machine.

**Fix:** Move the `mkdir` into `write_snapshots()` (or `pytest_sessionstart` of `make_capture_plugin`).

### WR-04: Unused `Request` parameter and weakly-motivated `hasattr` fallback in API exception handler

**File:** `api_server/app.py:25-32`

The handler accepts `request: Request` but never uses it (lint smell). More importantly, the discriminator is `isinstance(exc, SolverDiagnosticError) or hasattr(exc, "cause")`. The `hasattr` branch is a defensive duck-type fallback — but any future `RuntimeError` subclass that happens to expose a `.cause` attribute (e.g., a wrapping retry exception, a third-party library) will be treated as a structured solver diagnostic and rendered with `offending_nodes` / `offending_members` defaulting to `[]`.

**Severity:** Warning. Information disclosure risk (low).

**Fix:** Drop the `hasattr` branch — `isinstance(exc, SolverDiagnosticError)` is sufficient. If forward-compat for future typed exceptions is desired, introduce a `StructuredSolverError` base class.

---

## Info

### IN-01: `SolverDiagnosticError` defensive list copy is correct

**File:** `solver_core/src/pda_analysis_software/errors.py:39-46`

`offending_nodes: list[int] | None = None` then `self.offending_nodes = list(offending_nodes or [])` is the safe pattern. Positive note — pattern is already correct.

### IN-02: Adapter ENA shape not defensively re-checked

**File:** `solver_core/src/pda_analysis_software/adapters/frame_adapters.py:47-50`

The bar-precondition reads `model.ENForces[e]` before solver constructor validates shape. If a malformed `FrameModel2D` is constructed by a non-Pydantic caller, `IndexError` may surface with a less informative message than the solver's own validation.

**Fix (low priority):** Move precondition AFTER solver construction, or add an explicit shape check.

### IN-03: `SolverDiagnosticError.__repr__` may leak long detail strings

**File:** `solver_core/src/pda_analysis_software/errors.py:48-54`

Repr includes full `detail` verbatim. Not a defect today (only the adapter constructs these errors with controlled string templates), but document the constraint or trim if `detail` ever interpolates input data.

### IN-04: `id(self)` deduplication fragile in concurrent test runs

**File:** `scripts/_snapshot_common.py:155-208`

`_truss_seen: set[int]` uses `id(self)` for dedup. Python reuses memory addresses; `pytest-xdist` or async fixtures can break the assumption.

**Fix (optional):** Use `weakref.WeakSet()` keyed on the instance, or per-test sequence counter.

### IN-05: Dead code path — `_record_truss_adapter`

**File:** `scripts/_snapshot_common.py:176-189`

`_record_truss_adapter` is defined but never installed; `_wrapped_adapter_solve` (line 256) replaces it. Two functions duplicate ~14 lines of recording logic.

**Fix:** Remove the unused function.

### IN-06: `_label_for_test` regex anchoring relies on filename heuristic

**File:** `scripts/_snapshot_common.py:122`

`nodeid.startswith("tests/test_uat_frame2d.py")` will silently miss future UAT files (e.g., `test_uat_truss2d.py`).

**Fix:** Use `re.match(r"tests/test_uat_[^/]+\.py", nodeid)` or move the label mapping into a side file.

### IN-07: Magic number `25` for snapshot count is undocumented

**File:** `scripts/capture_solver_snapshots.py:57-63`

The `25` literal duplicates the acceptance criterion threshold. If the test directory changes, the threshold is silently wrong.

**Fix:** Promote to named constant `MIN_SNAPSHOT_COUNT = 25` with a comment referencing Phase 6 D-05 / D-16 acceptance.

---

## Reassuring observations (no action needed)

1. **Pure-bar predicate correctness** — indexing convention (1-based members, 0-based incidence keys, 1-based emitted θ DOFs as `(n+1)*3`) is internally consistent and matches the public API. Edge cases handled: zero-incident-member nodes, all-bar models, exclusion via `restrainedDoF`/`pinDoF`/`springDoF`. The exclusion semantics defer correctly to user intent (D-04).

2. **Test hygiene D-15 lock-in** — TRUST-18 (test_frame_v2.py:890-984) explicitly sets `pinDoF=[]` and asserts `s._pure_bar_theta_dofs == [15, 18]`. This guards against regressions where auto-restraint is silently disabled and `pinDoF` is used to compensate. Excellent regression protection.

3. **Backward-compat in API exception handler** — TRUST-20c exercises the legacy flat-payload path with a genuinely under-restrained model and asserts `body.get("cause") != "udl_on_bar"` (tolerant of either present-but-null or absent). Right shape.

4. **UI structured-422 parsing** — `script.js:678-687` filters `err.offending_nodes` / `err.offending_members` through `Number.isInteger` AND a range check before indexing — mitigates a hostile-server canvas-overdraw vector. The 0-based / 1-based conversion is consistent.

5. **CORS** — `allow_origins=["*"]` is intentional per CLAUDE.md. Not a regression introduced by Phase 6.

6. **Snapshot regression infrastructure (post conftest.py promotion in commit `3e839f4`)** — pytest plugin pattern (monkey-patch `solve_structure` via `pytest_sessionstart`, restore in `pytest_sessionfinish`) is properly scoped. With conftest.py now tracked, the byte-identical reproduction asserted via `np.allclose(rtol=1e-9, atol=1e-12)` against 35+ committed baselines genuinely encodes the user's hard constraint.

7. **`SolverDiagnosticError` API stability** — subclasses `RuntimeError` (so existing handler catches it without re-registration), exposes documented attributes, defensively copies list inputs. Field names surfaced by both backend tests and UI-contract tests.

8. **Adapter UDL-on-bar precondition coverage** — scans `self.model.bars or []` against both `ENForces` and `ENMoments`. Catches both vertical (`udl`) and horizontal (`udl_x`) UI paths since both flow through `ENForces`/`ENMoments` in the API layer. Confirmed coverage.

---

## Resolution Status

| Finding | Status |
|---------|--------|
| WR-01 hardcoded path in `_snapshot_common.py` | Open — fix on follow-up `/gsd-code-review-fix 06` |
| WR-02 UI predicate parity gap | Open — cosmetic, fix on follow-up |
| WR-03 module-level mkdir side-effect | Open — latent, fix on follow-up |
| WR-04 unused `Request` + `hasattr` fallback | Open — fix on follow-up |
| Missing `conftest.py` on main | **Fixed** — commit `3e839f4` (in-review) |
| IN-01..IN-07 | Open — informational, address opportunistically |

## Next Steps

`/gsd-code-review-fix 06` — auto-fix the 4 warnings + 7 info findings in a single pass.
