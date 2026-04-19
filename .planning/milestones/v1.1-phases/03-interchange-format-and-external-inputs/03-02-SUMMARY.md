---
phase: 03-interchange-format-and-external-inputs
plan: 02
subsystem: testing
tags: [pytest, fastapi-testclient, interchange, json-schema, analytical-verification, integration-tests]

# Dependency graph
requires:
  - phase: 03-interchange-format-and-external-inputs
    provides: "Plan 01 fixture JSON files (sample_pda_frame2d.json, sample_pda_truss2d.json) matching the canonical D-04 schema — cantilever and horizontal-bar reference cases"
provides:
  - "tests/test_interchange.py — 8 integration tests proving the interchange format is solve-ready"
  - "Schema validation tests for both solver fixtures (schema_version, routing key, required fields)"
  - "Analytical round-trip tests: fixture JSON POSTed to /solve/frame2d and /solve/truss2d returns correct displacements (rel=1e-6)"
  - "Canvas-state presence checks (origin non-null, per-solver load key: nodeLoads vs loads)"
  - "forceVector length parity checks (3*n_nodes frame, 2*n_nodes truss)"
affects: [03-03 Tekla/Revit converters, future Phase 4 grillage API, any future saved-file schema change]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FastAPI TestClient pattern for integration-level API tests via in-process HTTP"
    - "File-level solver routing key vs payload-level engine name disambiguation in tests"
    - "Analytical verification pattern extended to integration tier: round-trip POST asserts solver correctness, not just status 200"
    - "Fixture-driven schema validation: test file reads canonical JSON fixtures from disk and cross-checks shape, not hard-coded Python dicts"

key-files:
  created:
    - tests/test_interchange.py
  modified: []

key-decisions:
  - "POST payload.solver is overridden to the engine name (frame_v2 / truss2d) after stripping schema_version and canvas — mirrors what the UI does before POST, so the test is a faithful round-trip of the save->load->solve flow"
  - "Use pytest.approx(rel=1e-6) not rel=1e-9 — integration path goes through Pydantic JSON round-trip + list->ndarray conversion; the slightly looser tolerance matches the RESEARCH.md plan and still catches any structural error while tolerating JSON-float noise"
  - "canvas['origin'] asserted not None (not just present) — per Pitfall 1 in RESEARCH.md, a null origin leaves the canvas blank on load even when solve payload is valid; the assertion enforces this invariant on the fixtures"
  - "Truss canvas uses 'loads' key, frame canvas uses 'nodeLoads' — different by design per ui/truss2d/script.js vs ui/frame2d/script.js; tests encode this difference so a schema drift between the two UIs is caught"

patterns-established:
  - "Integration test tier: fastapi.testclient.TestClient loads the FastAPI app and POSTs fixture JSON to /solve/<name>, verifying full request-parse-adapter-solver-response pipeline"
  - "Analytical + schema combined in one test file: schema-shape tests and correctness tests share the same pytest fixtures (frame2d_model / truss2d_model), keeping fixture loading DRY"
  - "Fixture stripping idiom: `{k: v for k, v in model.items() if k not in (\"schema_version\", \"canvas\")}` isolates the solve-payload subset from the canonical file"

requirements-completed: [INTERCHANGE-01, INTERCHANGE-02, INTERCHANGE-05]

# Metrics
duration: ~2min
completed: 2026-04-18
---

# Phase 03 Plan 02: Interchange Format Round-Trip Tests Summary

**FastAPI TestClient integration tests that POST the canonical D-04 fixture JSON files to `/solve/frame2d` and `/solve/truss2d` and assert analytical cantilever and axial displacements (8 tests, all passing).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-18T12:54:36Z
- **Completed:** 2026-04-18T12:55:45Z
- **Tasks:** 1 (with 8 sub-tests)
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- 8 new pytest tests covering the three D-04 interchange concerns: schema validity, solve-readiness, and canvas state completeness — all green.
- Round-trip tests prove the interchange format's core guarantee (D-01 / INTERCHANGE-02): a fixture JSON on disk POSTs cleanly to the real API without field transformation and the analytical displacement matches `Uy = -FL^3/(3EI)` (frame2d) and `Ux = FL/(EA)` (truss2d) to rel=1e-6.
- File-level vs payload-level `solver` routing semantics (D-03) is encoded in the test: `payload["solver"] = "frame_v2"` override mirrors the UI save->load->solve flow exactly.
- forceVector length parity tests (Pitfall 5) give a cheap early-warning for converter outputs (Plan 03-03 Tekla, 03-04 Revit) that would fail the solver.
- Canvas-state tests catch regressions that would leave the UI blank after a load even when the solve still works (Pitfall 1 — null origin).
- Full suite grew from 20 to 28 tests, all passing, zero regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create interchange integration tests** — `4bd58d6` (test)

_Note: This was a tdd="true" task but since the "implementation" is the test file itself and the fixtures/API exist already from earlier work, the RED/GREEN/REFACTOR compressed to a single write-run-verify-commit cycle. All 8 tests passed first run against the existing fixtures and API, confirming Plan 01's fixtures are genuinely solve-ready._

## Files Created/Modified

### Created
- `tests/test_interchange.py` — 174 lines. 8 tests organised into four sections: schema validation (2), solve-readiness via TestClient (2), canvas state (2), forceVector length (2). Imports `fastapi.testclient.TestClient`, `api_server.app.app`, `json`, `pathlib.Path`, `pytest`. Shared `@pytest.fixture` for loading each JSON file.

### Modified
- None.

## Decisions Made

- **payload["solver"] = "frame_v2" override:** The saved file's top-level `solver` is `"frame2d"` (routing key). The API engine is registered as `"frame_v2"`. Mirroring the UI's actual save->load->solve flow means overriding this one field; the test documents this as a line comment so the semantics stay visible.
- **rel=1e-6 tolerance:** Plan spec recommended rel=1e-6. Kept it — tighter than needed for equilibrium-level checks but loose enough to absorb JSON float round-trip without masking structural errors.
- **Assert `canvas["origin"] is not None` rather than just `"origin" in canvas`:** A null origin is the exact Pitfall-1 scenario where load looks successful but the canvas is blank. The non-None assertion enforces the invariant.
- **Test 7 / Test 8 naming:** Used descriptive names `test_force_vector_length_matches_nodes_<solver>` rather than plan's plain `test_force_vector_length_*` so pytest discovery is self-documenting.

## Deviations from Plan

None — plan executed exactly as written.

All 8 tests implemented with the behaviour and acceptance-criteria patterns specified. Minor stylistic choices (docstrings citing analytical formulas; one shared import block at the top rather than per-test) made within the plan's `<action>` guidance. No rule-triggered auto-fixes.

**Total deviations:** 0
**Impact on plan:** None. Every acceptance criterion grep pattern matched (`from fastapi.testclient import TestClient`, `def test_frame2d_fixture_is_solve_ready`, `def test_truss2d_fixture_is_solve_ready`, `pytest.approx`, `payload["solver"] = "frame_v2"`, `def test_frame2d_fixture_has_canvas_state`, `def test_truss2d_fixture_has_canvas_state`).

## Issues Encountered

None.

## Verification

- `python3 -m pytest tests/test_interchange.py -v` → 8 passed in 0.41s
- `python3 -m pytest tests/ -v` → 28 passed in 0.41s (20 pre-existing + 8 new, no regressions)
- Analytical round-trip values match exactly:
  - Frame2D cantilever tip Uy = `-10000 * 1³ / (3 * 200e9 * 1e-4)` = `-1.6667e-4` m
  - Truss2D axial Ux = `1000 * 1 / (200e9 * 0.01)` = `5e-7` m
- File-level grep confirms every plan acceptance pattern is present in `tests/test_interchange.py`.
- httpx (0.28.1) and fastapi TestClient both verified importable before test creation — no new dependency install needed.

## Known Stubs

None. Every test asserts real behaviour against the real `api_server.app` FastAPI app in-process via TestClient. No mocked responses, no placeholder assertions, no TODO markers.

## Threat Flags

No new attack surface. Tests are pure read-only loaders of hand-crafted fixture JSON shipped in-repo (T-03-05: accept — reviewed at commit time). TestClient is in-process; no network boundary crossed.

## User Setup Required

None. httpx was already installed (0.28.1) from earlier work; no new dependencies added to `solver_core/pyproject.toml` or any dev requirements file.

## Next Phase Readiness

- The round-trip test scaffolding (TestClient + FIXTURES path + fixture-stripping idiom) is ready for extension to Tekla and Revit converter outputs in later plans: point a new test at `converters/tekla_to_pda.py` output and run the same solve-ready assertion.
- Future `tests/test_tekla_converter.py` (Phase 03 Wave 3) can import the same `FIXTURES` constant and compare converter output shape against the canonical samples.
- Plan 03-03 (Tekla) and 03-04 (Revit, if planned) have a concrete acceptance target: their emitted JSON must satisfy `test_*_fixture_is_solve_ready` equivalents when fed through the same stripping idiom.
- No blockers. Phase 03 Wave 2 complete; orchestrator can proceed to merge this wave.

---

## Self-Check: PASSED

**Files verified present on disk:**
- FOUND: tests/test_interchange.py
- FOUND: tests/fixtures/sample_pda_frame2d.json (pre-existing)
- FOUND: tests/fixtures/sample_pda_truss2d.json (pre-existing)

**Commits verified present:**
- FOUND: 4bd58d6 (Task 1 — interchange integration tests)

---
*Phase: 03-interchange-format-and-external-inputs*
*Completed: 2026-04-18*
