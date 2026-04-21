---
phase: 05-revit-tier-1-geometry-exporter
plan: 01
subsystem: revit-extension
tags: [pyrevit, ironpython, revit-api, detail-line, taskdialog, scaffold]

# Dependency graph
requires:
  - phase: 03-interchange-format-and-external-inputs
    provides: "Canonical PDA JSON schema v1.0 (solver=frame2d) consumed by frame2d UI"
provides:
  - "ExportToPDA.pushbutton/ bundle (icon + yaml + script scaffold) in sibling CustomRevitExtension repo"
  - "ViewDrafting guard (aborts with TaskDialog if active view is not a drafting view)"
  - "Once-per-session 2D-only warning TaskDialog with VerificationText checkbox, persisted on __revit__.Application attribute"
  - "Detail-line collector with D-03 selection override (delegates to lib/Snippets/_selection_func.get_selected_elements([DetailLine]))"
  - "sys.path guard that resolves lib/Snippets/ dynamically from __file__ (resolves RESEARCH Open Question 4)"
  - "Module-level constants: TOLERANCE_M, GRID_PX, ORIGIN_PX, DEFAULT_E/I/A (all match frame2d UI prefill per D-09)"
  - "TODO(05-02) and TODO(05-03) insertion points for geometry pipeline and JSON emit"
affects:
  - 05-02-PLAN.md  # geometry pipeline extends the same script.py at TODO(05-02)
  - 05-03-PLAN.md  # JSON emit extends the same script.py at TODO(05-03)
  - 05-04-PLAN.md  # live UAT in Revit — validates button install, session flag, view guard

# Tech tracking
tech-stack:
  added: []          # no new runtime dependencies (IronPython 2.7 stdlib + Revit API only)
  patterns:
    - "Session-scoped state via getattr/setattr on __revit__.Application (survives pyRevit script re-imports)"
    - "Dynamic sys.path.insert from os.path.dirname(__file__) — removes dependency on pyRevit auto-path behaviour"
    - "Reuse lib/Snippets/ helpers (get_selected_elements, convert_internal_units) instead of hand-rolling"
    - "IronPython 2.7 compatibility: no f-strings, no walrus, .format() only"

key-files:
  created:
    - /Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py
    - /Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/icon.png
    - /Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/bundle.yaml
  modified: []

key-decisions:
  - "D-16 2D-only warning implemented via raw TaskDialog.VerificationText (forms.alert cannot expose the checkbox)"
  - "Session flag attached to __revit__.Application as `_pda_export_warning_shown` (pyRevit re-runs script.py each click, so module globals don't persist)"
  - "Detail-line collector uses OfCategory(OST_Lines) + isinstance(DetailLine) + isinstance(GeometryCurve, Line) belt-and-braces filter (narrower OfClass(DetailLine) is unreliable per RESEARCH)"
  - "Icon copied verbatim from Loads.pushbutton (569-byte PNG placeholder) — panel visual style stays consistent; custom icon deferred per CONTEXT Claude's Discretion"

patterns-established:
  - "Pushbutton bundle layout: script.py + icon.png + bundle.yaml, matching existing Analytical.panel buttons"
  - "Cross-repo commit discipline: sibling-repo code commits in CustomRevitExtension/ (own git history), pda_project only holds planning artifacts"
  - "Plan-to-plan insertion points signalled by TODO(NN-NN) markers in scaffold script — downstream plans splice in at exact markers"

requirements-completed:
  - REVIT-T1-02

# Metrics
duration: 2min
completed: 2026-04-21
---

# Phase 5 Plan 1: Revit ExportToPDA Scaffold Summary

**New pyRevit pushbutton scaffold — ViewDrafting guard, once-per-session 2D-only TaskDialog with VerificationText, and detail-line collector with D-03 selection override wired to lib/Snippets helpers.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-21T16:36:54Z
- **Completed:** 2026-04-21T16:39:02Z
- **Tasks:** 2
- **Files modified:** 3 (all in sibling repo CustomRevitExtension)

## Accomplishments

- Created the `ExportToPDA.pushbutton/` bundle alongside the existing Loads/Supports/StructuralAnalyticalModel buttons — installs cleanly on next pyRevit reload.
- Delivered REVIT-T1-02 in full: active view guard (`isinstance(view, ViewDrafting)`), "2D TRUSSES AND 2D FRAMES ONLY" warning dialog, once-per-session persistence via `__revit__.Application._pda_export_warning_shown`.
- Wired the detail-line data source for the geometry pipeline in 05-02: selection-override branch delegates to `get_selected_elements([DetailLine])`, no-selection branch runs a view-scoped `FilteredElementCollector(doc, view.Id).OfCategory(OST_Lines)` + type filter that silently rejects arcs/splines (D-01).
- Resolved RESEARCH Open Question 4 via explicit `sys.path.insert` guard computed dynamically from `__file__` — makes `_units_conversion` and `_selection_func` imports robust across pyRevit versions.

## Task Commits

Each task committed atomically in the sibling repo (`/Users/catrinevans/Documents/CustomRevitExtension/`):

1. **Task 1: Create ExportToPDA.pushbutton bundle (dir, icon, bundle.yaml)** — `94a2c8f` (feat)
2. **Task 2: Write script.py scaffolding — guards, session warning, collector** — `58c059d` (feat)

**pda_project planning-artifact commit:** recorded separately after this SUMMARY lands.

## Files Created/Modified

All three paths are in the sibling repo `CustomRevitExtension/`:

- `PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py` — 156-line IronPython 2.7 scaffold (guards + collector + TODO markers for 05-02/05-03)
- `PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/icon.png` — 569-byte PNG copy of `Loads.pushbutton/icon.png`
- `PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/bundle.yaml` — title/tooltip/author metadata; title is exactly `Export to PDA` per `contains` acceptance

## Grep-Verifiable Markers Confirmed

All `must_haves.artifacts[0].contains_all` strings present in `script.py`:

| Marker | Present |
|---|---|
| `ViewDrafting` (import + guard call `isinstance(view, ViewDrafting)`) | yes |
| `VerificationText` + `WasVerificationChecked()` (method with parens) | yes |
| `_pda_export_warning_shown` (session-scoped attribute) | yes |
| `BuiltInCategory.OST_Lines` | yes |
| `isinstance(e, DetailLine)` | yes |
| `GeometryCurve` + `isinstance(e.GeometryCurve, Line)` | yes |
| `2D TRUSSES AND 2D FRAMES ONLY` (uppercase banner per D-16) | yes |
| `sys.path.insert` (with dynamically-computed `lib/Snippets` path) | yes |
| `from _selection_func import get_selected_elements` | yes |
| `get_selected_elements([DetailLine])` (called in selection-override branch) | yes |

`bundle.yaml` contains `title: Export to PDA` exactly. `icon.png` is a 32x32 (569-byte) PNG placeholder copied verbatim from `Loads.pushbutton/icon.png`.

Full `<verify><automated>` compound from the plan passed in a single invocation (no partial).

## Decisions Made

None beyond what was pre-decided in CONTEXT (D-01..D-16). Plan executed exactly as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

These stubs are **intentional scaffolding**, called out explicitly in the plan (not verifier-visible defects):

| Marker | File | Resolved in |
|---|---|---|
| `TODO(05-02): run geometry pipeline on detail_lines` | `ExportToPDA.pushbutton/script.py:137` | Plan 05-02 |
| `TODO(05-03): build JSON, save via forms.save_file, show success TaskDialog` | `ExportToPDA.pushbutton/script.py:138` | Plan 05-03 |

The current `main()` ends with a placeholder TaskDialog announcing "Scaffold only — collected N detail line(s)". This is expected — 05-01 is explicitly the guards-and-data-pull skeleton; JSON emit is not in scope until 05-03.

The `icon.png` is a 569-byte PNG placeholder (copy of Loads.pushbutton). Custom-designed 32x32 icon deferred per CONTEXT Claude's Discretion; panel visual style stays consistent because every existing Analytical.panel button uses the same placeholder.

The `convert_internal_units` import is present but unused in 05-01 — kept deliberately to validate the `sys.path` guard works before 05-02 adds the callers (metres conversion + 4-dp rounding).

## User Setup Required

None — no external service configuration required for this plan. Live Revit UAT is deferred to plan 05-04 (pyRevit reload → click button in a drafting view → verify TaskDialog wording + session-flag persistence across clicks).

## Next Phase Readiness

- **Plan 05-02 can start immediately** — the scaffold has `TODO(05-02)` at the exact insertion point, `detail_lines` is already in scope as a list of straight-Line `DetailLine` elements, and `convert_internal_units` is already imported.
- **Plan 05-03 likewise** — `TODO(05-03)` is the marker for JSON emit and save dialog; `os`/`re`/`json` are already imported.
- **Plan 05-04 (HUMAN-UAT)** inherits the live-verification items:
  - Button appears in Revit UI after pyRevit reload at `PDA Tools → Analytical → col1 stack`.
  - First click in a Revit session shows the 2D-only TaskDialog; ticking "Don't show again this session" skips on subsequent clicks in the same session.
  - Clicking from a non-drafting view (e.g. a plan view) shows "Active view must be a drafting view (found: ViewPlan)." and aborts.
  - Empty drafting view shows "No detail lines found in active drafting view — draw some first." and aborts.
  - Selection override (pre-select 2 of 5 detail lines, click button) collects only the 2.
- **No blockers** for the rest of Phase 5.

## Self-Check: PASSED

All claimed artefacts and commits verified:

- `script.py`, `icon.png`, `bundle.yaml` all exist in the sibling-repo pushbutton dir.
- `05-01-SUMMARY.md` exists at `.planning/phases/05-revit-tier-1-geometry-exporter/05-01-SUMMARY.md`.
- Sibling-repo commits `94a2c8f` (Task 1) and `58c059d` (Task 2) resolvable via `git log` in `CustomRevitExtension/`.

---
*Phase: 05-revit-tier-1-geometry-exporter*
*Completed: 2026-04-21*
