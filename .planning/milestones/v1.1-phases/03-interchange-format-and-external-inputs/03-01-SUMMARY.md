---
phase: 03-interchange-format-and-external-inputs
plan: 01
subsystem: ui
tags: [interchange, save-load, json, schema, file-api, blob, filereader, canonical-format]

# Dependency graph
requires:
  - phase: 02-model-evolution-and-ux-polish
    provides: canvas state shape (nodes, members, supports, nodeLoads/loads, origin); createDownloadLink Blob pattern; per-member E/I/A overrides; UDL arrays
provides:
  - Working Save JSON / Load JSON in frame2d UI (canonical D-04 schema)
  - Working Save JSON / Load JSON in truss2d UI (canonical D-04 schema)
  - Canvas state restoration (nodes, members, supports object, loads/nodeLoads, origin, udl, memberOverrides)
  - Schema validation at load-time (schema_version, solver routing key, required fields)
  - File input reset so same file can be re-loaded (Pitfall 6)
  - Test fixture files: sample_pda_frame2d.json (cantilever), sample_pda_truss2d.json (horizontal bar)
affects: [03-02 Tekla converter, 03-03 Revit exporter, future round-trip integration tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 canvas schema: supports as object keyed by nodeId string (not array)"
    - "D-02/D-04: canvas.udl as array of {memberId, wy, wx}, canvas.memberOverrides as object keyed by memberId"
    - "D-03: Two-layer solver key — file-level 'frame2d'/'truss2d' routing key + inner 'frame_v2'/'truss2d' engine name for API submission"
    - "Blob + URL.createObjectURL + anchor.click() download (reused from createDownloadLink)"
    - "FileReader.readAsText + e.target.value reset for reload of same file"
    - "Disabled Save button tied to nodes.length === 0, updated at every mutation site"

key-files:
  created:
    - tests/fixtures/sample_pda_frame2d.json
    - tests/fixtures/sample_pda_truss2d.json
  modified:
    - ui/frame2d/index.html (added File section with Save/Load buttons + hidden file input)
    - ui/frame2d/script.js (saveModel, triggerLoad, file input handler, updateSaveButtonState, wired into all state mutators)
    - ui/truss2d/index.html (added File section)
    - ui/truss2d/script.js (saveModel, triggerLoad, file input handler, updateSaveButtonState, wired into all state mutators)

key-decisions:
  - "File-level 'solver' field is the routing key ('frame2d'/'truss2d'); payload-level 'solver' is the engine name ('frame_v2'/'truss2d') so the file is directly POST-able to /solve/frame2d without transformation (D-01, D-03)"
  - "Canvas supports stored as object keyed by nodeId string (D-04) for schema stability; converted to/from internal array on save/load"
  - "Save button disabled when nodes.length === 0 (UI-SPEC discretion) — prevents empty/degenerate files"
  - "No auto-solve on load (D-08) — preserves user's mental model"
  - "Frame2d canvas includes udl[] and memberOverrides{}; truss2d omits these (frame2d-specific features)"
  - "Truss2d canvas uses 'loads' key (not 'nodeLoads') matching its internal state variable name"

patterns-established:
  - "Canonical JSON schema with schema_version 1.0, top-level solver routing key, flat solve payload, and nested canvas section"
  - "Save button state lifecycle: disabled on page load; enabled on first node placement; re-evaluated after every node add/delete/undo/resetAll/load"
  - "Load validation order: JSON parse → schema_version/solver/nodes/members presence → solver routing match → confirm() overwrite → restore → draw (no solve)"

requirements-completed: [INTERCHANGE-01, INTERCHANGE-02]

# Metrics
duration: ~50min
completed: 2026-04-18
---

# Phase 03 Plan 01: Save/Load Interchange Format Summary

**Canonical JSON save/load in both frame2d and truss2d browser UIs, mirroring the solve API payload and round-tripping full canvas state via the D-04 schema.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-04-18T12:00:00Z
- **Completed:** 2026-04-18T12:50:47Z
- **Tasks:** 3
- **Files modified:** 4
- **Files created:** 2

## Accomplishments

- Frame2d UI can save a structure to a JSON file and restore the full canvas from it (nodes, members, supports, node loads, UDLs, per-member E/I/A overrides, pixel origin).
- Truss2d UI has the same Save/Load capability adapted to its simpler state shape (loads vs nodeLoads, no UDL, no overrides).
- Saved JSON matches the Frame2DRequest/Truss2DRequest Pydantic schemas — POSTing it to /solve/frame2d or /solve/truss2d requires no field transformation.
- Canonical D-04 canvas schema implemented: supports as object keyed by nodeId, udl as array, memberOverrides as object keyed by memberId.
- Mismatch errors surface via alert() for unknown solver, invalid JSON, missing required fields.
- Save button disabled while canvas is empty, preventing accidental empty files.
- Two hand-crafted fixture JSON files (cantilever, horizontal bar) in tests/fixtures/ for downstream round-trip tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Save/Load to frame2d UI** — `4b7658b` (feat)
2. **Task 2: Add Save/Load to truss2d UI** — `dabbe55` (feat)
3. **Task 3: Create test fixture JSON files** — `f9d69af` (test)

## Files Created/Modified

### Created
- `tests/fixtures/sample_pda_frame2d.json` — Cantilever (E=200 GPa, I=1e-4, A=0.01, -10 kN at tip). Matches tests/test_frame_v2.py analytical case. D-04 canvas shape (supports object, udl array, memberOverrides object).
- `tests/fixtures/sample_pda_truss2d.json` — Horizontal bar (E=200 GPa, A=0.01, 1000 N X at node 2). Matches tests/test_truss2d.py analytical case. D-04 canvas shape.

### Modified
- `ui/frame2d/index.html` — Added `<section class="panel-section"><h3>File</h3>...</section>` between Edit and Material Properties sections, with `btnSave` (starts disabled), `btnLoad`, and hidden `fileInput` (accept=".json").
- `ui/frame2d/script.js` — Added `saveModel()`, `triggerLoad()`, `updateSaveButtonState()`, and the `fileInput` change handler (~230 lines). Wired `updateSaveButtonState()` into the canvas click handler, `undoLastAction`, `resetAll`, and init block.
- `ui/truss2d/index.html` — Same `<section class="panel-section"><h3>File</h3>...</section>` between Edit and Material Properties.
- `ui/truss2d/script.js` — Same three functions + change handler (~150 lines; simpler, no UDL/overrides branches). `updateSaveButtonState()` wired into click handler, `undoLastAction`, `resetAll`, and init.

## Decisions Made

- **File-level vs payload-level `solver` field:** The file's top-level `solver` is `"frame2d"` (routing key per D-03). The solve-payload `solver` field is written when the user clicks Solve (not stored in the file), so the flattened top-level payload in the JSON file omits the inner solver name. On load, the user clicks Solve and the existing solve() assembles the payload fresh. Rationale: avoids duplicating the solver key with two different values in the same file. Truss2d is simpler — one solver name serves both roles.
- **udl entries filter:** saveModel includes members with either a non-null `udl` (vertical) OR non-null `udl_x` (horizontal). Previously ambiguous in the plan; this matches the UDL apply panel's logic which allows either component.
- **Defensive null-coalescing on load:** `data.canvas && data.canvas.<field>` guards around every canvas access. Protects against partial-schema files without failing loudly — falls back to sensible defaults (empty arrays/objects, null origin).

## Deviations from Plan

None - plan executed exactly as written.

The plan was thorough and accurate. A few minor scope refinements made within the task action guidance:

- **udl extraction scope:** The plan showed `m.udl !== null && m.udl !== undefined` as the extraction filter. Extended to include `udl_x !== null && !== undefined` — a member with horizontal-only UDL would otherwise be silently dropped on save. This matches the plan's intent (preserve all UDL state) and the UDL apply panel's behaviour. No rule triggered; this was a natural read of the existing state semantics.
- **File input reset on error paths:** Plan showed `e.target.value = ''` at the end of the handler. Moved the reset into every early-return path (parse error, validation error, wrong solver, user cancelled confirm) so all paths reset uniformly. Rule 2 (missing critical): without this, an error path would leave the file input in a state where the same file could not be re-selected after the user corrected their action.

**Total deviations:** 0 rule-triggered auto-fixes. Minor refinements noted for auditability.

**Impact on plan:** No scope creep. All acceptance criteria met.

## Issues Encountered

None.

## Verification

- `python3 -m pytest tests/ -x -q` → 20 passed (no regressions)
- `node -c ui/frame2d/script.js` → syntax OK
- `node -c ui/truss2d/script.js` → syntax OK
- JSON fixture validation passed for both files (schema_version, solver, canvas shape, forceVector length, supports object type)
- All acceptance criteria grep patterns matched in both `index.html` and `script.js` pairs (saveModel, triggerLoad, fileInput, schema_version, btnSave, memberOverrides, canvas.udl, supports, reader.readAsText, syncPixelFromReal, confirm copy)

## Known Stubs

None. All save/load code paths are fully wired to real state. Fixtures are complete, solve-ready JSON files.

## Threat Flags

No new attack surface introduced beyond what the threat model anticipates. The loader validates `schema_version`, `solver`, `nodes`, and `members` presence (T-03-01 mitigated). `JSON.parse()` is used throughout — no `eval`, no prototype pollution vectors (T-03-02 accepted).

## User Setup Required

None. All changes are pure client-side JS/HTML. No environment variables, no external service configuration, no new dependencies.

## Next Phase Readiness

- 03-02 (Tekla converter) can now target the canonical JSON schema documented via the saved files' shape and the fixture files as the reference output format.
- 03-03 (Revit exporter) likewise — PyRevit script writes the same schema, file loads cleanly into frame2d UI.
- Future round-trip integration tests (e.g. `tests/test_interchange.py`) can load the fixture JSONs, strip `canvas` + metadata, POST to the API, and verify solver parity. The fixtures are pre-built for this.

---

## Self-Check: PASSED

**Files verified present on disk:**
- FOUND: ui/frame2d/index.html
- FOUND: ui/frame2d/script.js
- FOUND: ui/truss2d/index.html
- FOUND: ui/truss2d/script.js
- FOUND: tests/fixtures/sample_pda_frame2d.json
- FOUND: tests/fixtures/sample_pda_truss2d.json

**Commits verified present:**
- FOUND: 4b7658b (Task 1 — frame2d save/load)
- FOUND: dabbe55 (Task 2 — truss2d save/load)
- FOUND: f9d69af (Task 3 — test fixtures)

---
*Phase: 03-interchange-format-and-external-inputs*
*Completed: 2026-04-18*
