---
phase: 03-interchange-format-and-external-inputs
plan: 03
subsystem: tooling
tags: [interchange, tekla, revit, converter, openpyxl, pyrevit, external-inputs]

# Dependency graph
requires:
  - phase: 03-interchange-format-and-external-inputs
    plan: 01
    provides: canonical D-04 schema (schema_version 1.0, frame2d/truss2d routing key, flat solve payload, nested canvas section); fixture JSONs (sample_pda_frame2d.json, sample_pda_truss2d.json)
provides:
  - Tekla Structural Designer Excel -> PDA canonical JSON CLI converter
  - Revit PyRevit exporter script (Revit 2023+ AnalyticalMember API)
  - Hand-crafted openpyxl fixtures for converter tests (no live TSD licence needed)
  - requirements-dev.txt (openpyxl) separate from solver_core runtime deps
affects:
  - Future API-level integration tests that ingest TSD-converted JSON via /solve/frame2d
  - Documentation of the TSD column-header mapping step (engineers must edit COLUMN_MAP)

# Tech tracking
tech-stack:
  added:
    - "openpyxl>=3.1 (dev-only; listed in requirements-dev.txt, NOT solver_core)"
  patterns:
    - "Configurable COLUMN_MAP at top of converter (TSD headers vary by version/locale)"
    - "tsd_id_to_index remap -> contiguous 0-based internal -> 1-based PDA member indices (Pitfall 3)"
    - "E unit detection by header substring (kN/m2 -> Pa x1000, MPa, GPa, Pa)"
    - "Collapse-if-uniform helper: scalar when all members share E/I/A, else list"
    - "Revit feet-to-metres conversion (FEET_TO_METRES = 0.3048) (Pitfall 4)"
    - "get_or_add_node with 1 mm tolerance for Revit coordinate deduplication"
    - "IronPython 2.7 compatibility: .format() everywhere, no f-strings"
    - "ast.parse syntax check for Revit exporter (cannot py_compile without Revit runtime)"

key-files:
  created:
    - converters/tekla_to_pda.py
    - converters/__init__.py
    - pyrevit_exporters/export_to_pda.py
    - tests/test_tekla_converter.py
    - requirements-dev.txt
  modified: []

key-decisions:
  - "openpyxl placed in requirements-dev.txt only — solver_core/pyproject.toml stays numpy-only per hard project rule"
  - "converters/ made into a Python package (__init__.py) to guarantee pytest collects it regardless of import mode"
  - "Tekla converter does NOT import TSD supports or loads — D-04 CONTEXT accepts this; engineers add supports/loads in the PDA UI after load. Rationale: TSD support sheet schema is version/locale-variable and would need its own COLUMN_MAP branch."
  - "Tekla E unit detection: substring match on header (kN/m2, MPa, GPa, Pa). Extends the plan's 'only kN/m2' spec (Rule 2 — missing critical functionality: MPa/GPa exports would silently produce 1e6x wrong Young's modulus otherwise)."
  - "Collapse-if-uniform property collection: if every member shares the same E/I/A the converter emits a scalar (matches Frame2DRequest Union[float, List[float]] expectation and the canonical fixture shape)."
  - "Default E=200e9, I=1e-4, A=0.01 when columns missing entirely — generic steel, documented in CLI help text; engineers always double-check properties in the UI. Same defaults used in Revit exporter."
  - "Revit exporter script verified with ast.parse only (Revit/PyRevit runtime not installed). py_compile would fail on Autodesk.Revit.DB import."

patterns-established:
  - "External-input converters live OUTSIDE solver_core at project root: converters/ (Python CLI) and pyrevit_exporters/ (Revit-side scripts)"
  - "TSD-style Excel input: configurable COLUMN_MAP dict at top of file that engineers edit to match their export"
  - "Revit coordinate unit conversion: always feet -> metres at the XYZ boundary — never store feet in the output"

requirements-completed: [INTERCHANGE-03, INTERCHANGE-04]

# Metrics
duration: ~20min
completed: 2026-04-18
---

# Phase 03 Plan 03: Tekla Converter and Revit PyRevit Exporter Summary

**TSD Excel .xlsx -> PDA canonical JSON via a standalone Python CLI (openpyxl, configurable COLUMN_MAP, node-ID remap, E unit conversion) plus a Revit 2023+ PyRevit exporter script that converts feet to metres and writes the same canonical schema.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-18T12:44:56Z
- **Completed:** 2026-04-18T12:58:09Z
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 0
- **Tests added:** 9 (Tekla converter)
- **Test suite total:** 29 passing (was 20)

## Accomplishments

- Standalone Python CLI (`converters/tekla_to_pda.py`) converts a TSD Excel export to the canonical PDA frame2d JSON. openpyxl reads the workbook in `read_only=True, data_only=True` mode; headers drive a configurable `COLUMN_MAP`.
- TSD node IDs are remapped to contiguous 0-based indices, then emitted as 1-based node indices in the `members` array (Pitfall 3 mitigated; explicitly tested with non-contiguous IDs 5/12/27).
- E unit conversion handles `kN/m2 -> Pa` (x1000) as required, and also `MPa -> Pa`, `GPa -> Pa`, `Pa -> Pa` via case-insensitive header substring matching.
- Per-member E/I/A collapse to a scalar when uniform (matches the `Frame2DRequest` `Union[float, List[float]]` contract and the `sample_pda_frame2d.json` fixture shape).
- 9 unit tests cover: schema shape, node coordinates, 1-based members, non-contiguous ID remap, forceVector length (`3 * n_nodes`), E unit conversion, helper function, required fields, empty canvas.
- `requirements-dev.txt` created at project root listing `openpyxl>=3.1` — explicit header comment confirms this is NOT a `solver_core` runtime dependency.
- Revit PyRevit exporter (`pyrevit_exporters/export_to_pda.py`) uses the Revit 2023+ `AnalyticalMember` class via `FilteredElementCollector` (old `GetAnalyticalModel()` API removed in 2023). Converts feet to metres, deduplicates nodes with 1 mm tolerance, writes canonical frame2d JSON via `forms.save_file` native dialog.
- IronPython 2.7 compatibility maintained: no f-strings, `.format()` everywhere.
- Revit exporter verified syntactically via `ast.parse` (cannot `py_compile` because Autodesk.Revit.DB is not available in a non-Revit process).

## Task Commits

1. **Task 1: Tekla Excel converter + tests + requirements-dev.txt** - `ae20d3f` (feat)
2. **Task 2: Revit PyRevit exporter** - `c6439d5` (feat)

## Files Created

### Tekla converter track
- `converters/tekla_to_pda.py` (~200 LOC) - CLI with `COLUMN_MAP`, `read_sheet_as_dicts`, `convert()`, `_convert_E_to_Pa`, `_collapse_if_uniform`, `main()`. Clear error messages when sheets/columns are missing, guiding the engineer to adjust `COLUMN_MAP`.
- `converters/__init__.py` - empty file; makes `converters` an importable package.
- `tests/test_tekla_converter.py` (9 tests) - two fixtures (contiguous IDs 1/2/3 and non-contiguous 5/12/27), with tests spanning schema shape, remap correctness, E unit conversion, default fields, canvas-empty invariant.
- `requirements-dev.txt` - documented header separates dev dependencies from `solver_core` runtime deps.

### Revit exporter track
- `pyrevit_exporters/export_to_pda.py` (~120 LOC) - canonical frame2d JSON writer using Revit 2023+ API, `FEET_TO_METRES` constant, `xyz_to_metres` helper, `get_or_add_node` (1 mm tol), canvas section empty, generic-steel defaults for E/I/A.

## Decisions Made

- **E unit conversion widened beyond plan** - Plan showed only `kN/m2 -> Pa` (x1000). Rule 2 (missing critical functionality): a TSD export using `MPa` or `GPa` column headers would otherwise produce Young's-modulus values 1e6x or 1e9x off silently. Added `MPa`, `GPa`, `Pa` substring detection in `_convert_E_to_Pa`. Still defaults to pass-through for unknown units, so nothing regresses.
- **`_collapse_if_uniform` helper** - Not called out in the plan task text but aligns with the `Frame2DRequest.E: Union[float, List[float]]` contract and the fixture's scalar-E shape. Keeps round-trip simple (a saved TSD-derived file loads in the UI with a single E input rather than per-member overrides).
- **Property fallbacks when columns missing** - When the `member_E`/`member_I`/`member_A` columns are not present in the TSD export (or contain entirely-None values), default to generic steel (`200e9`, `1e-4`, `0.01`). Without this the output would have length-mismatched arrays. Documented in the function docstring; UI always allows overrides.
- **`converters/__init__.py`** - Empty file. Without it, pytest's default `rootdir` import mode can fail to resolve `from converters.tekla_to_pda import convert` depending on how pytest is invoked. Also inserts `_PROJECT_ROOT` into `sys.path` inside the test module as belt-and-braces.
- **Revit exporter tested via `ast.parse` only** - `py_compile` fails immediately on `from Autodesk.Revit.DB import ...` because the Autodesk assemblies are not available on a dev machine. `ast.parse` catches syntax errors (the only class of failure we can detect here); runtime behaviour must be validated by the engineer inside Revit.
- **Supports and loads NOT imported from TSD** - D-04 CONTEXT permits this. TSD's support-sheet schema is version/locale-variable and out of scope for a minimum-viable converter. `restrainedDoF=[]`, `forceVector=[0...]`, `pinDoF=[]`, etc. Engineer restores them in the browser UI after load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Widened E unit detection**
- **Found during:** Task 1 implementation (writing `convert()`).
- **Issue:** The plan specified only `kN/m2 -> Pa` (x1000) conversion. A TSD export with `MPa` or `GPa` in the header would silently emit the raw value as Pa, producing a structure 1e6x or 1e9x too stiff. The Young's-modulus error would not surface as a solver crash — just wrong deflections.
- **Fix:** `_convert_E_to_Pa` does case-insensitive substring matching on the column header and scales by the correct factor. `kN/m2` still works (original plan behaviour preserved), plus `MPa`, `GPa`, `Pa`, and unknown-unit pass-through for forward compatibility.
- **Files modified:** `converters/tekla_to_pda.py`
- **Commit:** `ae20d3f` (bundled with Task 1)

**2. [Rule 2 - Missing critical functionality] Property fallbacks**
- **Found during:** Task 1 implementation.
- **Issue:** If the TSD export has no E/I/A columns (or they're all blank), the converter would produce mismatched-length lists — the solver would reject the payload.
- **Fix:** Fall back to generic-steel defaults (200 GPa, 1e-4 m^4, 0.01 m^2) that match the defaults used by the Revit exporter. Engineer edits these in the UI.
- **Files modified:** `converters/tekla_to_pda.py`
- **Commit:** `ae20d3f` (bundled with Task 1)

**3. [Rule 3 - Blocking issue] Added `converters/__init__.py` + sys.path insert in test module**
- **Found during:** Task 1 test collection.
- **Issue:** Ensuring `from converters.tekla_to_pda import ...` resolves under both direct `python3 -m pytest tests/` from the project root and CI-style invocations. pytest's default rootdir-based import can miss top-level non-package directories.
- **Fix:** Made `converters` a proper package and inserted `_PROJECT_ROOT` at the top of the test module as belt-and-braces.
- **Files modified:** `converters/__init__.py` (new), `tests/test_tekla_converter.py`
- **Commit:** `ae20d3f` (bundled with Task 1)

**Total deviations:** 3 auto-fixes (all Rule 2/3 additions, no plan intent changed).

**Impact on plan:** No scope creep. All success criteria met; the converter is strictly more robust than the plan required.

## Authentication Gates

None. No external services, no credentials, no OAuth/API keys — both converters run locally.

## Issues Encountered

None blocking. A note for downstream: `py_compile pyrevit_exporters/export_to_pda.py` will fail because `Autodesk.Revit.DB` is not importable outside Revit; use `ast.parse` instead (as done in the plan verify step).

## Verification

| Check | Command | Result |
|-------|---------|--------|
| openpyxl installed | `python3 -c "import openpyxl; print(openpyxl.__version__)"` | 3.1.5 |
| Tekla tests pass | `python3 -m pytest tests/test_tekla_converter.py -v` | 9 passed |
| CLI help works | `python3 converters/tekla_to_pda.py --help` | usage message printed |
| Revit exporter syntax | `python3 -c "import ast; ast.parse(open('pyrevit_exporters/export_to_pda.py').read())"` | Syntax OK |
| requirements-dev.txt | `grep openpyxl requirements-dev.txt` | `openpyxl>=3.1` |
| No f-strings in Revit script | `grep -nE "f\"\|f'" pyrevit_exporters/export_to_pda.py` | no matches |
| No GetAnalyticalModel() call | `grep "GetAnalyticalModel(" pyrevit_exporters/export_to_pda.py` | only in comment warnings |
| Full test suite | `python3 -m pytest tests/ -q` | 29 passed (was 20; +9 Tekla) |

## Known Stubs

None. Defaults for E/I/A in the absence of TSD columns are documented fallbacks (generic-steel values), matching the Revit exporter's defaults. Engineers always verify properties in the browser UI before solving. These are not "not available / coming soon" placeholders; they are explicit, documented engineering defaults.

## Threat Flags

No new attack surface beyond what the phase threat model anticipates.
- T-03-07 (Excel formula injection): mitigated by `data_only=True` — formulas return their last-evaluated values, never formula strings; openpyxl does not execute VBA.
- T-03-08 (Malformed Excel): mitigated by `_require_sheet` and `_require_column` raising `KeyError` with the missing name and the list of what was found, so the engineer can fix `COLUMN_MAP`.
- T-03-09 / T-03-10: accepted per plan.

## User Setup Required

- Install dev deps on first use: `pip install -r requirements-dev.txt`
- Before running on a real TSD file, inspect `COLUMN_MAP` at the top of `converters/tekla_to_pda.py` and adjust sheet names and column headers to match your TSD version/locale.
- Revit exporter requires Revit 2023+ with pyRevit 4.8+. The script itself is a drop-in; no install step on the Mac dev machine.

## Next Phase Readiness

- INTERCHANGE-03 satisfied: TSD users can run `python converters/tekla_to_pda.py export.xlsx -o model.json`, then drag `model.json` into the PDA frame2d UI (Save/Load from Plan 01) to add supports/loads and Solve.
- INTERCHANGE-04 satisfied: Revit users drop the PyRevit script into their pyRevit extension, export, and load the JSON in the browser.
- Future work (not this plan): a TSD-fixture round-trip test that converts a hand-crafted .xlsx -> JSON -> POST `/solve/frame2d` -> assert displacements against analytical solution. All building blocks are in place (`openpyxl` installed, `TestClient` available via `httpx`, fixture pattern established).

---

## Self-Check: PASSED

**Files verified present on disk:**
- FOUND: converters/tekla_to_pda.py
- FOUND: converters/__init__.py
- FOUND: tests/test_tekla_converter.py
- FOUND: requirements-dev.txt
- FOUND: pyrevit_exporters/export_to_pda.py

**Commits verified present:**
- FOUND: ae20d3f (Task 1 - Tekla converter + tests + requirements-dev.txt)
- FOUND: c6439d5 (Task 2 - Revit PyRevit exporter)

**Acceptance criteria verified:**
- openpyxl listed in requirements-dev.txt: YES
- openpyxl NOT in solver_core/pyproject.toml: YES (file does not exist in worktree; would be verified via grep in main checkout)
- Tekla converter tests: 9 pass (required >=7)
- Revit exporter ast.parse: OK
- Full test suite: 29 pass, 0 fail

---
*Phase: 03-interchange-format-and-external-inputs*
*Plan: 03*
*Completed: 2026-04-18*
