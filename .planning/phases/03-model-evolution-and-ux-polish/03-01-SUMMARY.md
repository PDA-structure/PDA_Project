---
phase: 03-model-evolution-and-ux-polish
plan: 01
subsystem: api
tags: [numpy, fastapi, pydantic, fem, frame2d]

# Dependency graph
requires: []
provides:
  - Per-member E/I/A support through full frame2d solver pipeline
  - Standalone section_properties() utility (rectangle, circle, I-section)
  - Backward-compatible scalar E/I/A (all 10 existing tests unchanged)
affects: [03-02, frame2d-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Adapter owns scalar-to-list broadcast before solver call
    - Solver stores per-member arrays as self.Em / self.Im (ndarray)
    - Union[float, List[float]] in model and API; solver always receives list

key-files:
  created:
    - solver_core/src/pda_analysis_software/utils/section_properties.py
    - solver_core/src/pda_analysis_software/utils/__init__.py
    - tests/test_section_properties.py
  modified:
    - solver_core/src/pda_analysis_software/solvers/frame_v2.py
    - solver_core/src/pda_analysis_software/adapters/frame_adapters.py
    - api_server/app.py
    - tests/test_frame_v2.py

key-decisions:
  - "Adapter (not solver) owns broadcast: scalar E/I/A -> list of length n_members"
  - "Solver renamed self.E -> self.Em, self.I -> self.Im (no external references; safe rename)"
  - "Stress calc uses s.Am (solver's resolved per-member area) to avoid re-implementing A_beam/A_bar logic"
  - "section_properties() takes keyword dims and returns (I_cm4, A_cm2) tuple"

patterns-established:
  - "Per-member properties: always ndarray in solver, Union type in model/API, broadcast in adapter"
  - "section_properties(section_type, **dims) -> Tuple[float, float] — pure math, no I/O"

requirements-completed: [MODEL-01, MODEL-02, MODEL-03]

# Metrics
duration: ~12min
completed: 2026-04-12
---

# Plan 03-01: Per-member E/I/A solver pipeline + section property calculator

**Frame2d solver extended to accept per-member E/I/A lists; new section_properties() utility covers rectangle, circle, and I-section; all 20 tests pass**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-04-12
- **Tasks:** 2
- **Files modified:** 7 (4 modified, 3 created)

## Accomplishments
- `BeamBarStructure_v2` now stores `self.Em` and `self.Im` per-member numpy arrays; all 4 usage sites updated
- `FrameV2Adapter` broadcasts scalar → list before passing to solver; validates list lengths match n_members
- `FrameModel2D` and `Frame2DRequest` accept `Union[float, List[float]]` for E, I, A
- `section_properties()` utility returns analytically verified (I_cm4, A_cm2) for rectangle, circle, and I-section
- 20 tests pass: 10 original (unchanged) + 6 section property tests + 1 per-member E/I test + existing others

## Task Commits

1. **Task 1: Section property calculator utility with tests** — `b906c0f` (feat)
2. **Task 2: Per-member E/I/A through full pipeline** — `0c426d1` (feat)

## Files Created/Modified
- `solver_core/src/pda_analysis_software/utils/section_properties.py` — section_properties() function
- `solver_core/src/pda_analysis_software/utils/__init__.py` — re-exports section_properties
- `tests/test_section_properties.py` — 4 test cases (rectangle, circle, I-section, unknown type)
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — self.Em/Im arrays, 4 usage sites updated
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` — broadcast logic, per-member stress calc
- `api_server/app.py` — Union types in Frame2DRequest
- `tests/test_frame_v2.py` — test_per_member_EI_two_span added

## Decisions Made
- Adapter owns the scalar-to-list broadcast; solver always receives an ndarray
- Used `s.Am` from the solver's resolved area array for stress calc to avoid duplicating A_beam/A_bar logic

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
Bash tool permission was denied mid-execution; Task 2 changes were committed by the orchestrator after verifying 20/20 tests pass.

## Next Phase Readiness
- 03-02 (per-member UI) can now pass E/I lists from the frame2d frontend to the API
- 03-03 (UI polish) is independent and running in parallel

---
*Phase: 03-model-evolution-and-ux-polish*
*Completed: 2026-04-12*
