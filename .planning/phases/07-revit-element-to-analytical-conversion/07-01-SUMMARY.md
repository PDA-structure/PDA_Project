---
phase: 07-revit-element-to-analytical-conversion
plan: 01
subsystem: revit-pyrevit
tags: [pyrevit, ironpython, revit-2025, analytical-api, iselectionfilter, sibling-repo]

# Dependency graph
requires:
  - phase: 05-revit-tier-1-geometry-exporter
    provides: pushbutton bundle layout convention (bundle.yaml + script.py + icon.png in col1.stack/) and IronPython 2.7 header / Revit-globals patterns reused by ConvertToAnalytical
provides:
  - ConvertToAnalytical.pushbutton bundle skeleton (bundle.yaml + script.py shell) at canonical sibling-repo path
  - SUPPORTED_CATEGORIES module-level dict registry (D-04) -- the v1.3 configuration surface for REVIT-CONVERT-01
  - _SupportedCategoryFilter(ISelectionFilter) inline class with both AllowElement and AllowReference (Pitfall 4)
  - _resolve_input(uidoc, doc) hybrid pre-selection + PickObjects flow (D-01) with OperationCanceledException handling (Pitfall 8)
  - Placeholder main() that exercises selection end-to-end without conversion (Plan 7-02 wires conversion)
affects: [07-02-conversion-idempotency-transactions, 07-03-diagnostics-uat-deploy, 08-revit-tier-2-export, 15-slab-floor-conversion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pyRevit pushbutton bundle pattern reused at col1.stack/ConvertToAnalytical.pushbutton/"
    - "Module-level dict registry as configuration surface (D-04) -- enables Phase 15 slab handler additions without rewiring dispatch"
    - "Inline ISelectionFilter (AllowElement + AllowReference) per D-15 -- avoids extending lib/Snippets/_selection_func.py"
    - "Hybrid input flow: uidoc.Selection.GetElementIds() first; PickObjects fallback with category filter and OperationCanceledException handling"
    - "ASCII-only user-facing strings (Pitfall 9) -- '--' instead of em-dash"

key-files:
  created:
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/bundle.yaml"
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py"
  modified: []

key-decisions:
  - "Followed PATTERNS.md sections A, C, D, F, G, H verbatim -- no deviations"
  - "Omitted sys.path guard (D-15: no lib/Snippets imports in Phase 7)"
  - "Omitted session env-var '2D only' warning (D-09: summary always shown, no pre-warning)"
  - "Kept app = __revit__.Application even though unused -- pattern parity with ExportToPDA analog"

patterns-established:
  - "SUPPORTED_CATEGORIES dict registry as v1.3 configuration surface for REVIT-CONVERT-01 (D-04)"
  - "Inline ISelectionFilter class fix for missing AllowReference (Pitfall 4) -- not pushed back to lib/Snippets per D-15"
  - "PickObjects in try/except OperationCanceledException + empty-refs TaskDialog branch (Pitfall 8 + D-01)"

requirements-completed: []  # REVIT-CONVERT-01 partially satisfied (registry surface in place); full satisfaction completes after 7-02 + 7-03

# Metrics
duration: 7min
completed: 2026-05-02
---

# Phase 7 Plan 1: Bundle + Selection + Category Filter Skeleton

**ConvertToAnalytical.pushbutton skeleton in CustomRevitExtension sibling repo: bundle.yaml + script.py shell with SUPPORTED_CATEGORIES registry (D-04), inline _SupportedCategoryFilter (Pitfall 4), and hybrid _resolve_input (D-01) -- conversion deliberately deferred to Plan 7-02.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-02T08:14:13Z
- **Completed:** 2026-05-02T08:21:02Z
- **Tasks:** 2
- **Files created:** 2 (sibling repo only -- zero pda_project files)

## Accomplishments

- Created `ConvertToAnalytical.pushbutton/bundle.yaml` with the locked three-field shape (`title`, `tooltip`, `author`); ASCII-only tooltip mentions AnalyticalMember + Idempotent; no `min_revit_version`
- Created `ConvertToAnalytical.pushbutton/script.py` (92 lines) -- skeleton matches PATTERNS.md sections A/C/D/F/G/H verbatim
- Locked the REVIT-CONVERT-01 configuration surface from day one via `SUPPORTED_CATEGORIES = {OST_StructuralColumns: 'convert_member', OST_StructuralFraming: 'convert_member'}` -- Phase 15 (slabs) extends without rewiring the dispatch site
- Inlined `_SupportedCategoryFilter(ISelectionFilter)` with BOTH `AllowElement` AND `AllowReference` (the existing snippet at `lib/Snippets/_selection_func.py` is missing `AllowReference` -- fix is intentionally not pushed back per D-15)
- Hybrid `_resolve_input` honours D-01: pre-selection wins after category filter; otherwise launches `PickObjects` with the inline filter; `OperationCanceledException` returns `[]` silently (Pitfall 8); empty Finish raises a "No elements selected." TaskDialog
- Placeholder `main()` exercises selection end-to-end and emits a TaskDialog announcing the count + that conversion lands in Plan 7-02 -- gives the engineer something they can click during interim Windows deploys

## Task Commits

Each task committed atomically in the sibling `CustomRevitExtension` repo (cross-repo work; sibling commits flagged with phase tag):

1. **Task 1: bundle.yaml** - `1abc870` (feat) -- title/tooltip/author fields, ASCII-only, no min_revit_version
2. **Task 2: script.py skeleton** - `381ae53` (feat) -- 92-line skeleton: header + imports + Revit globals + SUPPORTED_CATEGORIES + _SupportedCategoryFilter + _resolve_input + placeholder main()

**Plan metadata:** SUMMARY.md committed by orchestrator after wave merge (worktree mode -- final metadata commit captures SUMMARY.md only; STATE.md/ROADMAP.md handled centrally).

## Files Created/Modified

Sibling repo only (zero pda_project file changes -- consistent with phase scope):

- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/bundle.yaml` -- pyRevit pushbutton metadata (title, tooltip, author)
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py` -- bundle skeleton; conversion body deliberately absent (Plan 7-02 appends `_is_already_associated`, `_derive_curve`, `_convert_one`, `_verify_section_and_material`, `run_batch` and replaces the placeholder body of `main()`)

`icon.png` is intentionally NOT yet present -- Plan 7-03's Windows deploy step adds the engineer-authored icon.

## Decisions Made

- **Followed PATTERNS.md sections A/C/D/F/G/H verbatim** -- no deviations from plan-locked code blocks. The plan front-loaded all decisions; Plan 7-01 was a faithful drop-in.
- **Omitted sys.path guard** (PATTERNS.md §B; D-15) -- Phase 7 does NOT import from `lib/Snippets/`, so the guard would be dead code.
- **Omitted session env-var "2D only" warning** (PATTERNS.md §E; D-09) -- summary TaskDialog is always shown post-run; no pre-run gate needed.
- **Kept `app = __revit__.Application`** even though Phase 7 doesn't reference it -- pattern parity with the `ExportToPDA` analog (PATTERNS.md §D note).
- **Used `--` (two ASCII hyphens) instead of em-dash** in all comments and string literals (Pitfall 9; CONTEXT.md Claude's Discretion). Verified by `grep -nP "[^\x00-\x7F]" "$FILE"` returning empty.

## Deviations from Plan

None - plan executed exactly as written.

The plan was research- and pattern-locked: Plan 7-01's task bodies contained verbatim code blocks. No bug fixes (Rule 1), missing critical functionality (Rule 2), blocking issues (Rule 3), or architectural concerns (Rule 4) surfaced.

## Issues Encountered

- **Verification command pre-req: PyYAML not in default Python.** The plan's automated verify command for Task 1 imports `yaml`; my system Python had no PyYAML installed. Resolved by `pip3 install pyyaml --quiet` before re-running the verify -- no impact on the deliverable, only on the local verification path. Not a deviation since the bundle.yaml content was unchanged.
- **PATTERNS.md not yet committed in worktree base.** PATTERNS.md was untracked in the parent repo at the worktree base commit (`0428a69`), so the worktree's `.planning/phases/07-revit-element-to-analytical-conversion/` directory did not contain it. I read PATTERNS.md from the primary repo (`/Users/catrinevans/Documents/pda_project/.planning/...`) directly to load the verbatim code blocks the plan referenced. No deliverable impact.

## User Setup Required

None - no external service configuration required. (Windows host re-deploy of the new bundle is a Plan 7-03 task, not Plan 7-01.)

## Next Phase Readiness

**Plan 7-02 entry conditions met.** Plan 7-02 extends `script.py` by:
1. Appending `_is_already_associated`, `_derive_curve`, `_convert_one`, `_verify_section_and_material`, `run_batch` (PATTERNS.md sections I, J, K, L)
2. Replacing the placeholder body of `main()` with `run_batch(doc, physical_ids)` + (Plan 7-03's) `_emit_summary` (PATTERNS.md section N)

The skeleton is structured so Plan 7-02 touches NO existing code -- imports, registry, filter class, and `_resolve_input` stay byte-identical. `Transaction`, `TransactionGroup`, `TransactionStatus` are pre-imported (forward-loaded for Plan 7-02; harmless here).

**Plan 7-03 entry conditions partial.** Plan 7-03 still needs the engineer-authored `icon.png` (binary, manual asset). Note for Plan 7-03 deploy: bundle is currently `bundle.yaml` + `script.py` only; `icon.png` must be added before Windows deploy + ribbon verification.

**REVIT-CONVERT-01 status:** Configuration surface (the dict registry) is in place from day one. Full requirement satisfaction (pushbutton runs end-to-end and creates AnalyticalMembers) lands after Plan 7-02 + 7-03.

## Self-Check: PASSED

- bundle.yaml exists at canonical sibling-repo path
- script.py exists at canonical sibling-repo path (92 lines)
- 07-01-SUMMARY.md exists at .planning/phases/07-revit-element-to-analytical-conversion/
- Sibling-repo commit `1abc870` (Task 1 bundle.yaml) verified in `git log`
- Sibling-repo commit `381ae53` (Task 2 script.py) verified in `git log`

---
*Phase: 07-revit-element-to-analytical-conversion*
*Completed: 2026-05-02*
