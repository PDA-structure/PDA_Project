---
phase: 260423-a0q
plan: 01
subsystem: revit-exporter
status: incomplete
status_reason: "Task 1 (code) complete + committed in sibling repo. Task 2 (HUMAN-UAT round-trip in Revit) cannot be automated and is blocking — awaiting user verification."
tags: [revit, pyrevit, ironpython, truss2d, exporter, quick-task]
dependency_graph:
  requires:
    - "Phase 5 ExportToPDA.pushbutton (frame2d exporter — cloned as the template)"
    - "lib/Snippets/_units_conversion (feet→m conversion)"
    - "lib/Snippets/_selection_func (DetailLine selection helper)"
    - "ui/truss2d/script.js Load handler (consumes the emitted JSON)"
  provides:
    - "ExportToPDA_Truss.pushbutton/ — Revit→truss2d round-trip exporter"
  affects:
    - "Sibling repo: /Users/catrinevans/Documents/CustomRevitExtension/ (NEW button alongside existing frame2d button — no modifications to frame2d)"
tech_stack:
  added: []
  patterns:
    - "Clone-and-edit (verbatim copy of frame2d exporter, surgical edits to _build_json + constants + session key + dialog wording only)"
    - "Namespaced session env-var (PDA_EXPORT_TRUSS_WARNING_SHOWN) so each exporter independently tracks first-run warning"
    - "IronPython 2.7 compat (no f-strings; .format() / % everywhere; ensure_ascii=True; no encoding= kwarg on open())"
key_files:
  created:
    - "/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/bundle.yaml"
    - "/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/script.py"
    - "/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/icon.png"
  modified: []
decisions:
  - "Reused frame2d icon verbatim for v1 (visual parity is acceptable for MVP; custom icon can be added later as a polish quick task)"
  - "Title set to 'Export to\\nPDA Truss' (literal \\n) so pyRevit wraps cleanly to two lines, matching the existing 'Export to\\nPDA' button"
  - "TaskDialog title changed from 'PDA Export' to 'PDA Truss Export' (and 'PDA Export Complete' → 'PDA Truss Export Complete') so users can tell at-a-glance which exporter raised a dialog if both buttons are clicked in one session"
  - "Default save filename suffix '_pda_truss' (vs frame2d's '_pda') so a user exporting the same drafting view to both formats doesn't accidentally overwrite the first export"
  - "Session-warning env-var key namespaced as PDA_EXPORT_TRUSS_WARNING_SHOWN (separate from the frame2d PDA_EXPORT_WARNING_SHOWN) so the once-per-session banner fires once per tool, not once globally"
metrics:
  duration_seconds: 251
  duration_human: "~4 minutes"
  completed_date: "2026-04-23"
  task_count: 1
  task_count_total: 2
  task_count_pending_uat: 1
sibling_repo_commit:
  repo: "/Users/catrinevans/Documents/CustomRevitExtension"
  hash: "95d6748"
  branch: "main"
  message_subject: "feat(pushbutton): add ExportToPDA_Truss for truss2d JSON export"
---

# Quick Task 260423-a0q: ExportToPDA_Truss pyRevit Pushbutton Summary

Cloned the Phase 5 frame2d ExportToPDA pyRevit pushbutton and adapted the JSON payload for the truss2d solver. Geometry pipeline (detail-line collection, feet→m + 4dp quantize, 1mm Chebyshev merge, T-junction split, mid-span crossing warn, lex sort, save dialog, success TaskDialog) reused verbatim. Only `_build_json`, the constants block, the session-warning key, and user-visible dialog wording were edited.

## Status: INCOMPLETE — HUMAN-UAT PENDING

Task 1 (code + commit) is fully complete and statically verified. Task 2 is a `checkpoint:human-verify` that requires the user to:

1. Open Revit (2023–2025) with the CustomRevitExtension loaded
2. Reload pyRevit (or restart Revit) so the new bundle is picked up
3. Open a drafting view, draw 3 detail lines forming a triangle
4. Click the new `Export to PDA Truss` button
5. Save the JSON, then load it in `ui/truss2d/index.html`
6. Add a pinned + roller support and a downward node load, then Solve

This cannot be automated — it requires a live Revit session. Until the user reports back, this plan stays in `incomplete` state. See `260423-a0q-PLAN.md` Task 2 for full step-by-step UAT instructions.

## What Was Built

A second pushbutton bundle `ExportToPDA_Truss.pushbutton/` sitting alongside the existing `ExportToPDA.pushbutton/` (Phase 5 frame2d exporter) in the sibling CustomRevitExtension repo. Visible in Revit at `PDA_Tools` tab → `Analytical` panel → `col1.stack` column.

### Files created (sibling repo)

| File | Size | Purpose |
|------|------|---------|
| `ExportToPDA_Truss.pushbutton/bundle.yaml` | 3 lines | pyRevit metadata (title, tooltip, author) |
| `ExportToPDA_Truss.pushbutton/script.py` | 469 lines | IronPython 2.7 exporter — geometry pipeline + truss2d JSON emit |
| `ExportToPDA_Truss.pushbutton/icon.png` | 569 bytes | Copied verbatim from sibling frame2d button (visual parity for v1) |

### What was copied verbatim from the frame2d template

Pure geometry / pyRevit plumbing — solver-agnostic:

- `sys.path` guard for `lib/Snippets/` (4 hops up — same depth as the sibling bundle)
- Imports (`Autodesk.Revit.DB`, `Autodesk.Revit.UI`, `pyrevit.forms/script`, `_units_conversion`, `_selection_func`)
- `_q4(x)` — IronPython-2.7 JSON float-noise fix via `float("%.4f" % x)`
- Session-warning helpers `_warning_already_shown_this_session` / `_mark_warning_shown_this_session` (only the env-var KEY changed)
- `_collect_detail_lines(view)` — selection override + view-scoped collector + DetailLine+Line filter
- `_extract_segments(detail_lines)` — feet→m via `convert_internal_units`, 4dp `_q4`, drop Z
- `_get_or_add_node`, `_point_on_segment_interior`, `_segments_cross_interior` — pure geometry helpers
- `_merge_and_split` — endpoint dedup + T-split + mid-span crossing detection
- `_sort_nodes_lexicographic` — D-08 (x, y) ascending sort
- `_sanitise_filename` — D-13 path-traversal mitigation
- `main()` flow — view-type guard, once-per-session warning, segment extraction, merge-and-split, sort, build JSON, save dialog, success TaskDialog

### What was surgically edited

| Location | Change |
|----------|--------|
| Module docstring + `__title__` + `__doc__` | `frame2d` → `truss2d`; title set to `'Export to\nPDA Truss'` |
| Constants block | Dropped `DEFAULT_I` (truss has no flexural stiffness); kept `DEFAULT_E = 200e9`, `DEFAULT_A = 0.01` |
| `_SESSION_KEY_WARNING` | `'PDA_EXPORT_WARNING_SHOWN'` → `'PDA_EXPORT_TRUSS_WARNING_SHOWN'` (namespaced per tool) |
| `_show_2d_only_warning` MainContent | `"frame2d browser UI"` → `"truss2d browser UI"`; TaskDialog title `'PDA Export'` → `'PDA Truss Export'` |
| `_build_json` | **Full rewrite of the function body** for truss2d schema (see "What was dropped" below) |
| `main()` save filename suffix | `'_pda'` → `'_pda_truss'` |
| `main()` crossings-warning text | `"frame2d UI"` → `"truss2d UI"` |
| `main()` TaskDialog titles | `'PDA Export'` / `'PDA Export Complete'` → `'PDA Truss Export'` / `'PDA Truss Export Complete'` |

### What was dropped from the frame2d schema

These keys exist in the frame2d JSON but **must not** appear in the truss2d JSON (the UI parser will accept them silently but they are confusing noise and indicate schema confusion):

| Dropped key | Why |
|-------------|-----|
| `I`, `DEFAULT_I` | Truss elements have no flexural stiffness |
| `ENForces`, `ENMoments` | Truss has no equivalent nodal forces (no UDL → no fixed-end forces) |
| `bars`, `A_beam`, `A_bar` | Truss has no beam/bar split — every member is axial-only |
| `beamPinLeft`, `beamPinRight` | Truss has no moment continuity to release |
| `pinDoF` | Truss supports are pinned/roller, no rotational DOF to release |
| `springDoF`, `springStiffness` | Out of scope for truss2d v1 |
| `udl_x` | Truss carries no distributed loads |
| `canvas.nodeLoads` | Truss UI uses `canvas.loads` (different array name; checked at script.js:850) |
| `canvas.udl`, `canvas.memberOverrides` | No UDL or per-member overrides in truss2d |
| `canvas.nodes[*].type/pinLeft/pinRight/udl` | Truss canvas node shape is `{id, x, y, realX, realY}` only |
| `canvas.members[*].id/type/pinLeft/pinRight/udl/E_override/I_override/A_override` | Truss canvas member shape is `{start, end}` only |

### Truss-specific invariants enforced

- `solver: "truss2d"` (UI rejects anything else at script.js:827)
- `forceVector` length = `n_nodes * 2` (2 DOF/node — Ux, Uy — versus frame2d's 3)
- `members` (top-level) is 1-based; `canvas.members[*].start/end` is 0-based
- `canvas.origin` is `{x: 100, y: 400}` (non-null; null would render all nodes at 0,0)
- `canvas.supports = {}`, `canvas.loads = []` (geometry-only Tier 1)

## Verification

### Static (Task 1 verify block) — PASSED

All assertions in the plan's `<automated>` verify block passed:

- `ast.parse` succeeds (Python syntax valid)
- `"truss2d"` literal present (solver field)
- Zero occurrences of: `ENForces`, `ENMoments`, `beamPinLeft`, `beamPinRight`, `pinDoF`, `springDoF`, `springStiffness`, `udl_x`, `A_beam`, `A_bar`, `memberOverrides`, `nodeLoads`, `bars` JSON key
- `n_nodes * 2` present, `n_nodes * 3` absent (correct DOF count)
- `PDA_EXPORT_TRUSS_WARNING_SHOWN` present (namespaced session key)
- `DEFAULT_I` absent (no second-moment-of-area constant)
- No f-strings (IronPython 2.7 compat)

### Functional smoke test (extra) — PASSED

Extracted `_q4` + `_build_json` and ran on a 3-node triangle truss:

- `forceVector` length = 6 (= 3 nodes × 2 DOF) ✓
- `members` 1-based: `[[1,2], [2,3], [3,1]]` ✓
- `canvas.nodes[0]` keys = `{id, x, y, realX, realY}` (no extras) ✓
- `canvas.members[0]` keys = `{start, end}` (no extras) ✓
- Top-level keys = `{schema_version, solver, nodes, members, E, A, forceVector, restrainedDoF, canvas}` (zero frame-only fields) ✓
- `canvas` keys = `{origin, nodes, members, supports, loads}` (uses `loads`, not `nodeLoads`) ✓

### bundle.yaml — PASSED

Manual inspection (PyYAML not available in env):
```
title: Export to PDA Truss
tooltip: "..."
author: "paulo@pda-structure.co.uk"
```
All three required keys present.

### Untouched-frame2d check — PASSED

`git show --stat HEAD` in sibling repo shows only `ExportToPDA_Truss.pushbutton/` paths. The original `ExportToPDA.pushbutton/` (frame2d) was not modified.

### pda_project isolation — PASSED

`git diff --stat HEAD` in pda_project shows zero changes. The only addition is the planning quick-task directory `.planning/quick/260423-a0q-.../`, which the orchestrator commits separately as part of the standard quick-task flow.

### HUMAN-UAT (Task 2) — PENDING

Cannot be automated. Awaiting user verification per Task 2 of the plan. Acceptance criteria:

1. Button appears in `PDA_Tools > Analytical > col1.stack` after pyRevit reload
2. Drafting-view round-trip succeeds (triangle of 3 detail lines → exported JSON)
3. JSON has correct top-level keys, `solver: "truss2d"`, `forceVector` length = 2×n_nodes, no frame-only fields
4. JSON loads in `ui/truss2d/index.html` with no alert
5. User can add supports + load and Solve successfully

## Cross-Repo Commit

Code lives in the sibling repo (separate git repository from pda_project):

| Field | Value |
|-------|-------|
| Repo | `/Users/catrinevans/Documents/CustomRevitExtension/` |
| Branch | `main` |
| Commit | `95d6748` |
| Subject | `feat(pushbutton): add ExportToPDA_Truss for truss2d JSON export` |
| Files | 3 added (`bundle.yaml`, `script.py`, `icon.png`); 472 insertions |
| Pushed | No (local commit only — user can push when ready) |

Reference this hash if rolling back or cherry-picking. The pda_project repo has no code changes from this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Comment containing literal `DEFAULT_I` token broke the static check**

- **Found during:** Task 1 static validation
- **Issue:** The plan's Step 3b suggested a comment `# NB: no DEFAULT_I — truss2d has no flexural stiffness` to document the intentional drop. But the plan's own static-check assertion `assert 'DEFAULT_I' not in src` matches that substring inside the comment, causing a false positive failure.
- **Fix:** Rephrased the comment to avoid the literal token: `# NB: truss2d has no flexural stiffness, so no second-moment-of-area default is emitted.` Same intent, no token collision.
- **Files modified:** `script.py` (line 54)
- **Commit:** Folded into the single Task 1 commit `95d6748` (no extra commit needed; the comment was edited before staging)

**2. [Discretionary edit per plan Step 3f] TaskDialog titles renamed for clarity**

- **Plan said:** "Dialog title strings 'PDA Export' / 'PDA Export Complete' — keep as-is OR change to 'PDA Truss Export' / 'PDA Truss Export Complete' for clarity. Executor's discretion."
- **Decision:** Renamed to `'PDA Truss Export'` and `'PDA Truss Export Complete'`. With both buttons in the same Revit session, identical dialog titles would be confusing — the title is the only at-a-glance signal of which exporter raised the dialog.

No bug fixes, no missing critical functionality, no architectural changes.

## Authentication Gates

None.

## Known Stubs

None. The exporter emits geometry-only Tier 1 JSON by design (matches Phase 5 contract: supports + loads added in the browser UI). This is documented behaviour, not a stub.

## Threat Flags

None. The exporter writes to the user's chosen Save-As path only (filename pre-sanitised via `_sanitise_filename` to mitigate T-05-11 path traversal — same mitigation as the Phase 5 frame2d exporter). No new network endpoints, no auth paths, no file access patterns at trust boundaries.

## Follow-up Items

Logged for backlog (none blocking):

- **Custom truss icon** — currently reuses the frame2d icon for visual parity. Could be customised (e.g. triangle-truss glyph) in a future polish quick task.
- **Bar/beam upgrade for the existing frame2d ExportToPDA button** — out of scope for this task. The plan's critical_constraints explicitly call this out as a separate future slice.
- **Tier 2 truss exporter** — analytical-model-based truss extraction (vs detail-line drafting) is in the v1.2 Phase 6 scope, separate from this Tier 1 quick task.
- **Confirm session-key independence in live Revit** (Task 2 step 6, soft check) — verifies the namespaced env-var design works as intended (clicking truss button shows banner once; clicking frame button afterward also shows banner once because they have separate keys).

## Self-Check: PASSED

**File existence:**
- FOUND: `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/bundle.yaml`
- FOUND: `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/script.py`
- FOUND: `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/icon.png`

**Commit existence (sibling repo):**
- FOUND: `95d6748` — `git -C /Users/catrinevans/Documents/CustomRevitExtension log --oneline -1` confirms

**pda_project isolation:**
- VERIFIED: `git -C /Users/catrinevans/Documents/pda_project diff --stat HEAD` returns empty (zero modifications to tracked files)

**Static validation:**
- ALL ASSERTIONS PASSED (see Verification section)
