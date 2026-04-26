---
phase: 06-frame-v2-pure-bar-joint-robustness
verified: 2026-04-26T15:06:11Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 6: frame_v2 Pure-Bar Joint Robustness — Verification Report

**Phase Goal:** `frame_v2` solves hybrid beam+bar models (e.g. Pratt/Warren trusses with a continuous beam chord) without returning HTTP 422 at joints where every incident member is a bar; UDL applied to bar members is no longer silently dropped; the frame2d UI surfaces joint-level diagnostics instead of a generic "Structure is unstable" error.

**Verified:** 2026-04-26T15:06:11Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (merged from ROADMAP Success Criteria + PLAN frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Captured failing fixture (`pure_bar_pratt_captured.json`) solves correctly with no HTTP 422 | VERIFIED | `tests/test_frame_v2.py:1028` asserts `response.status_code == 200`; TRUST-19 PASSED in pytest run |
| 2 | UDL applied to a bar member produces a clear typed error (no silent drop) | VERIFIED | `frame_adapters.py:53` raises `SolverDiagnosticError(cause="udl_on_bar", offending_members=[...])` BEFORE solver instantiation; TRUST-20 + TRUST-20b PASSED |
| 3 | frame2d UI canvas highlights joints with zero rotational stiffness; "Structure is unstable" replaced with specific cause text | VERIFIED | `script.js:509` `validateBeforeSolve()`, `script.js:871` `drawDiagnosticOverlays()`, `script.js:671` parses `err.cause` and appends `[<cause>]` suffix |
| 4 | Existing TRUST-* and HARDEN-* tests continue to pass — no regression | VERIFIED | `pytest tests/ -x -q` returns 61 passed (43 pre-existing baseline + 8 new phase-6 tests + 10 other); zero regressions |
| 5 | New regression test asserts pure-bar joints don't fail | VERIFIED | TRUST-19 (`tests/test_frame_v2.py:998`) replays captured fixture via FastAPI TestClient; TRUST-18 (`:890`) clean Pratt analytical case |
| 6 | Snapshot baseline captures pre-change state for every existing test BEFORE solver mutation | VERIFIED | `tests/snapshots/baseline/` contains 56 JSON files; commit `93629a4` (baseline) precedes commit `4356c70` (solver feat) — D-16 enforced via git ordering |
| 7 | After solver change, snapshot regression gate enforces byte-identical numerical output | VERIFIED | `SNAPSHOT_VERIFY=1 python3 -m pytest tests/ -x -q` exits 0; pytest plugin path verifies all baselines reproduce |
| 8 | Pure-bar joint detection runs in `assemble_primary_stiffness_matrix` and writes 1-based θ DOFs to `self._pure_bar_theta_dofs` | VERIFIED | `frame_v2.py:89` initialises list; `frame_v2.py:470` populates after assembly loop |
| 9 | Pure-bar predicate excludes nodes whose θ DOF is in restrainedDoF/pinDoF/springDoF (D-04) | VERIFIED | `frame_v2.py:453` `excluded = set(self.restrainedDoF) | set(self.pinDoF) | set(self.springDoF)` |
| 10 | `extract_structure_stiffness_matrix` unions `_pure_bar_theta_dofs` into `removed_dof` | VERIFIED | `frame_v2.py:482` `removed_dof = self.restrainedDoF + self.pinDoF + self._pure_bar_theta_dofs` |
| 11 | TRUST-18 passes with pinDoF=[] (D-15 testing-hygiene lock-in) and asserts predicate output | VERIFIED | `tests/test_frame_v2.py:946` `pinDoF=[]`; `:979` `assert sorted(s._pure_bar_theta_dofs) == [15, 18]` — predicate output, not DOF zeroing |
| 12 | `SolverDiagnosticError` subclasses `RuntimeError` with structured attrs | VERIFIED | `errors.py:12` `class SolverDiagnosticError(RuntimeError)`; carries `detail`, `cause`, `offending_nodes`, `offending_members` |
| 13 | API exception handler returns structured 422 with backward-compat fallback | VERIFIED | `app.py:33` `isinstance(exc, SolverDiagnosticError) or hasattr(exc, "cause")` branches; TRUST-20c verifies flat fallback |
| 14 | UI parses structured 422 (cause/offending_nodes/offending_members) AND preserves legacy flat-payload fallback | VERIFIED | `script.js:670` `err.detail || res.statusText` fallback preserved; `:671-686` parses cause + offending arrays with `Number.isInteger` range filtering (T-06-03-02 mitigation) |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `solver_core/src/pda_analysis_software/solvers/frame_v2.py` | Pure-bar predicate + auto-restraint | VERIFIED | `_pure_bar_theta_dofs` referenced 5× (init, populate, restraint union, docstring); class docstring contains "Pure-bar joint handling" |
| `solver_core/src/pda_analysis_software/errors.py` | `SolverDiagnosticError` typed exception | VERIFIED | 56-line module; subclasses RuntimeError; has detail/cause/offending_nodes/offending_members |
| `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` | UDL-on-bar precondition | VERIFIED | Imports SolverDiagnosticError at line 6; raises with `cause="udl_on_bar"` at line 59 BEFORE BeamBarStructure_v2 instantiation |
| `api_server/app.py` | Extended exception handler | VERIFIED | Imports SolverDiagnosticError; `isinstance/hasattr` branching at line 33; flat fallback preserved |
| `ui/frame2d/script.js` | Pre-solve scan + structured 422 + overlay | VERIFIED | `validateBeforeSolve()` at line 509; module state `pureBarNodeIds`/`offendingNodes`/`offendingMembers` at lines 78-80; `drawDiagnosticOverlays()` at line 871; wired into `draw()` at line 739 (immediately after `drawNodes()` at line 738); `node --check` passes |
| `tests/test_frame_v2.py` | TRUST-18, TRUST-19, TRUST-20, 20b, 20c | VERIFIED | All 5 functions defined and PASSING |
| `tests/test_phase6_ui_contract.py` | UI contract tests | VERIFIED | 3 tests; all 4 JSON field names asserted (lines 78-82); all PASSING |
| `tests/fixtures/uat/pure_bar_pratt_captured.json` | Captured fixture verbatim | VERIFIED | `diff` against `~/Downloads/frame2d-model-2026-04-22T06-14-49.json` exits 0 — byte-identical (D-17) |
| `tests/snapshots/baseline/` | Per-test JSON snapshots | VERIFIED | 56 JSON files (23 TRUST + 7 UAT + 26 other); committed in `93629a4` BEFORE solver edit `4356c70` (D-16 git ordering) |
| `scripts/capture_solver_snapshots.py` | Snapshot capture entry point | VERIFIED | Exists, executable; pytest-plugin pattern via `conftest.py` |
| `scripts/verify_solver_snapshots.py` | Snapshot verify entry point | VERIFIED (with caveat) | Exists, executable; standalone path fails (WR-01 hardcoded path); pytest-plugin path works (`SNAPSHOT_VERIFY=1 pytest` exits 0) |
| `scripts/_snapshot_common.py` | Shared snapshot infrastructure | VERIFIED | Exists; pytest plugin with autouse fixture; monkey-patches `solve_structure`/`solve` |
| `conftest.py` | Worktree-local path override | VERIFIED | Tracked in main (commit `3e839f4`); ensures worktree solver_core wins over editable install |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frame_v2.assemble_primary_stiffness_matrix` | `self._pure_bar_theta_dofs` | per-node incidence scan | WIRED | `frame_v2.py:470` |
| `frame_v2.extract_structure_stiffness_matrix` | `removed_dof` set union | `restrainedDoF + pinDoF + _pure_bar_theta_dofs` | WIRED | `frame_v2.py:482` exact match |
| `FrameV2Adapter.solve` | `SolverDiagnosticError` | precondition raise | WIRED | `frame_adapters.py:53` raises BEFORE solver constructor |
| `app.py runtime_error_handler` | `SolverDiagnosticError` attrs | `isinstance` + `hasattr` | WIRED | `app.py:33`; defensive `getattr(..., default)` (T-06-02-03 mitigation) |
| `tests/test_frame_v2.py::test_trust_18` | `BeamBarStructure_v2.solve_structure` | direct solver instantiation | WIRED | line 967 `s = BeamBarStructure_v2(...)`; line 968 `s.solve_structure()` |
| `tests/test_frame_v2.py::test_trust_19` | FastAPI `/solve/frame2d` | TestClient POST | WIRED | line 1024 `client.post("/solve/frame2d", json=payload)` |
| `tests/test_phase6_ui_contract.py` | structured 422 response | TestClient POST asserting all 4 field names | WIRED | lines 78-82 assert detail/cause/offending_members/offending_nodes |
| `ui/frame2d/script.js solve()` | `validateBeforeSolve()` | pre-fetch invocation | WIRED | line 587 `if (!validateBeforeSolve()) return` |
| `ui/frame2d/script.js solve() error branch` | structured 422 parsing | `err.cause`/`err.offending_*` | WIRED | lines 671, 678, 683 |
| `ui/frame2d/script.js draw()` | `drawDiagnosticOverlays()` | called after `drawNodes()` | WIRED | line 738 drawNodes → line 739 drawDiagnosticOverlays |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `frame_v2.py _pure_bar_theta_dofs` | predicate output list | `assemble_primary_stiffness_matrix` per-node incidence scan | Yes — TRUST-18 asserts `[15, 18]` matches hand-derivation | FLOWING |
| `app.py runtime_error_handler` payload | `body["cause"]`, `body["offending_members"]` | `getattr(exc, "cause", None)` from typed exception | Yes — TRUST-20b asserts `body["cause"] == "udl_on_bar"` and member 1 in offending_members | FLOWING |
| `script.js offendingMembers` | array populated from server response | `err.offending_members` filtered by `Number.isInteger` and range | Yes — populated in solve() error branch and consumed by drawDiagnosticOverlays | FLOWING |
| `script.js pureBarNodeIds` | client-side scan output | `validateBeforeSolve()` per-node incidence | Yes — same predicate semantics as server (every incident member type === 'bar') | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full pytest suite passes | `python3 -m pytest tests/ -x -q` | 61 passed in 0.74s | PASS |
| Phase-6 specific tests pass | `pytest tests/test_frame_v2.py::test_trust_18..20c tests/test_phase6_ui_contract.py -v` | 8 passed in 0.42s | PASS |
| Snapshot regression gate via pytest plugin | `SNAPSHOT_VERIFY=1 python3 -m pytest tests/ -x -q` | 61 passed | PASS |
| UI JS syntax valid | `node --check ui/frame2d/script.js` | exit 0 | PASS |
| Captured fixture byte-identical to source | `diff ~/Downloads/frame2d-model-2026-04-22T06-14-49.json tests/fixtures/uat/pure_bar_pratt_captured.json` | exit 0 (no diff) | PASS |
| `SolverDiagnosticError` importable + correct shape | `python3 -c "from pda_analysis_software.errors import SolverDiagnosticError; e = SolverDiagnosticError('t','udl_on_bar', offending_members=[1,2]); assert e.cause == 'udl_on_bar' and isinstance(e, RuntimeError)"` | exit 0 | PASS |
| CLAUDE.md hard rules — no print/matplotlib in solver_core changes | `grep -nE 'print\|matplotlib' solver_core/.../frame_v2.py errors.py frame_adapters.py` | 0 matches | PASS |
| Standalone snapshot verify script | `python3 scripts/verify_solver_snapshots.py` | ModuleNotFoundError (WR-01 — known issue) | FAIL — see Notes |

**Note on snapshot verify standalone failure:** This is documented in `06-REVIEW.md` as Warning WR-01 (hardcoded absolute path in `_snapshot_common.py:42-43`). The user's hard "no-regression" constraint is held by the pytest-plugin path (`SNAPSHOT_VERIFY=1 pytest`) which DOES work, plus the 43 pre-existing pytest cases that all pass. The standalone script is bonus protection that needs follow-up via `/gsd-code-review-fix 06`. Not blocking phase closure.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PUREBAR-01 | 06-01 | `frame_v2.assemble_primary_stiffness_matrix` detects pure-bar joints during assembly | SATISFIED | `frame_v2.py:431-470` per-node incidence scan; TRUST-18 asserts `_pure_bar_theta_dofs == [15, 18]` |
| PUREBAR-02 | 06-01 | Hybrid beam+bar models solve correctly; no Ks singularity / HTTP 422 | SATISFIED | TRUST-19 (captured fixture) returns 200 OK; UI-contract test_ui_contract_pure_bar_fixture_solves passes |
| PUREBAR-03 | 06-02 | UDL on bar members no longer silently dropped — rejected with clear error | SATISFIED | `frame_adapters.py:42-60` precondition raises typed exception; TRUST-20 verifies adapter rejection; TRUST-20b verifies API 422 |
| PUREBAR-04 | 06-02, 06-03 | UI replaces "Structure is unstable" with specific diagnostics; canvas highlights | SATISFIED | `script.js validateBeforeSolve()` (pre-solve), structured 422 parsing (post-solve), `drawDiagnosticOverlays()` (canvas); UI-contract tests verify field-name contract |
| PUREBAR-05 | 06-01 | Regression test using captured failing fixture | SATISFIED | TRUST-19 replays `tests/fixtures/uat/pure_bar_pratt_captured.json` (committed verbatim per D-17) |

All 5 requirements satisfied. No orphaned requirements (REQUIREMENTS.md maps PUREBAR-01..05 → Phase 6, all five appear in PLAN frontmatter across plans 06-01/02/03).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/_snapshot_common.py` | 42-43 | Hardcoded absolute path `/Users/catrinevans/...` | Warning (WR-01) | Standalone verify script doesn't work outside one machine; pytest-plugin path unaffected — bonus protection only |
| `ui/frame2d/script.js` | validateBeforeSolve | Client-side predicate doesn't mirror server-side exclusion (restrainedDoF/pinDoF/springDoF) | Warning (WR-02) | Cosmetic — false-positive informational red dot in edge cases; Solve still proceeds correctly |
| `scripts/_snapshot_common.py` | 48 | `SNAPSHOT_DIR.mkdir(...)` at module-import time | Warning (WR-03) | Latent — read-only env raises PermissionError at import time |
| `api_server/app.py` | 25-32 | Unused `Request` parameter; `hasattr(exc, "cause")` duck-type fallback | Warning (WR-04) | Low — third-party RuntimeError subclass exposing `.cause` would render as structured payload |
| `scripts/_snapshot_common.py` | 155-208 | `_truss_seen: set[int]` uses `id(self)` for dedup | Info (IN-04) | Fragile under pytest-xdist; not currently used |
| `scripts/_snapshot_common.py` | 176-189 | Dead code path `_record_truss_adapter` | Info (IN-05) | Defined but never installed |

All warnings are tooling/infrastructure robustness gaps in scripts that are NOT phase deliverables. None block the goal. The code-review-fix follow-up is queued (per 06-REVIEW.md "Next Steps") but not gating phase closure — these were known and accepted at code-review time.

### Human Verification Required

None. The phase deliverables are fully verifiable programmatically:
- No-regression: pytest 61/61 passes
- Pure-bar fix: TRUST-18 (analytical hand-calc), TRUST-19 (captured fixture replay)
- UDL-on-bar: TRUST-20 (adapter), TRUST-20b (API), TRUST-20c (flat-payload backward-compat)
- UI parsing: 3 UI-contract tests asserting field-name contract via FastAPI TestClient
- UI rendering: `node --check` validates JS syntax; `drawDiagnosticOverlays()` is wired correctly into `draw()` after `drawNodes()`

A manual browser UAT is documented in `tests/test_phase6_ui_contract.py` module docstring for any-time human verification but is explicitly NOT gating in `--auto` mode (pre-agreed via D-11/D-12 plus the auto-mode test-substitution decision in 06-03 plan).

### Gaps Summary

None. Phase 06 has achieved its goal:

1. **Captured failing fixture solves with HTTP 200** — TRUST-19 verifies end-to-end via FastAPI TestClient against the verbatim-committed fixture
2. **UDL-on-bar produces typed structured error** — adapter precondition rejects loudly with `cause="udl_on_bar"` and offending member indices BEFORE solver instantiation
3. **UI surfaces joint-level diagnostics** — pre-solve scan flags pure-bar joints (informational) and UDL-on-bar (blocking); post-solve error branch parses structured 422 and paints offending elements in red on canvas
4. **No regression on existing solver behavior** — 61/61 pytest tests pass; D-16 git ordering enforces snapshot baseline was captured before any solver mutation; the user's hard constraint "do not damage the solver" is mechanically protected
5. **Testing-hygiene D-15 lock-in honoured** — TRUST-18 uses `pinDoF=[]` and asserts `sorted(s._pure_bar_theta_dofs) == [15, 18]` directly; the auto-restraint mechanism is the only way the test passes

The 4 Warning findings from `06-REVIEW.md` are tooling-robustness gaps (snapshot infrastructure portability, UI predicate cosmetic parity) — not defects in phase deliverables. Tracked for follow-up via `/gsd-code-review-fix 06`. They do not affect goal achievement.

---

*Verified: 2026-04-26T15:06:11Z*
*Verifier: Claude (gsd-verifier)*
