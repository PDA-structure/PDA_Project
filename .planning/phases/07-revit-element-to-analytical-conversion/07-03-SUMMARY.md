---
phase: 07-revit-element-to-analytical-conversion
plan: 03
subsystem: revit-pyrevit
tags: [pyrevit, ironpython, revit-2025, analytical-api, diagnostics, uat, sibling-repo, manual-fixtures, windows-deploy, scope-reframe]

# Dependency graph
requires:
  - phase: 07-revit-element-to-analytical-conversion
    plan: 02
    provides: |
      Conversion engine in script.py (run_batch + _convert_one + _verify_section_and_material + idempotency precheck +
      TransactionGroup with Assimilate on success path + curated skip taxonomy). main() wired through run_batch with a
      temporary printf TaskDialog. Plan 7-03 replaces the temporary summary with the dual-surface _emit_summary,
      authors the UAT fixtures + runbook, deploys the bundle, and runs the empirical UAT.
provides:
  - "Final dual-surface diagnostic in script.py: _emit_summary(converted, already, skips) -- TaskDialog (always shown, D-09) + pyRevit Output Window markdown table with output.linkify clickable element links (D-08), conditional on skips being non-empty"
  - "main() final form wired through _emit_summary; the Plan 7-02 temporary printf is gone"
  - "Three Revit 2025 binary RVT fixtures committed to sibling repo at PDA_customRevit.extension/fixtures/phase07/: phase07_minimal_frame.rvt (7 elements pre-conversion), phase07_multi_storey.rvt (18 elements pre-conversion), phase07_pre_converted.rvt (7 elements post-conversion)"
  - "UAT_RUNBOOK.md committed at the same path -- engineer-readable manual procedure for all three fixtures + the (now-deferred) Tier 1 round-trip + the configurable-filter walkthrough"
  - "icon.png for ConvertToAnalytical pushbutton: 64x64 RGBA PNG, portal-frame outline + dashed brace + orange-red filled-circle nodes; visually distinct from ExportToPDA's icon"
  - "Windows-host deploy verified: %APPDATA%\\\\pyRevit\\\\Extensions\\\\PDA_customRevit.extension\\\\PDA_Tools.tab\\\\Analytical.panel\\\\col1.stack\\\\ConvertToAnalytical.pushbutton\\\\ contains bundle.yaml + script.py + icon.png; pyRevit Reload completes; ribbon button visible; tooltip matches bundle.yaml"
  - "ROADMAP success criterion 4 reframed during execution: from 'Tier 1 round-trip' to 'analytical model is well-formed for Phase 8' -- evidenced by Fixture 1 SectionTypeId+MaterialId spot-check, Fixture 3 idempotent association (no duplicates), single-undo at scale (Pitfall 5 verified at 7 and 18 elements). Tier 1 round-trip via Phase 5 ExportToPDA cannot validate Phase 7 deliverables (Phase 5 reads detail lines + DEFAULT_E/I/A; AnalyticalMember metadata is invisible to it). Real round-trip is Phase 8 Tier 2 export."
  - "Three new memory entries: revit_ui_blocks_broken_structural_elements.md, revit_steel_analysis_info_inaccuracy.md, revit_phase5_export_uses_detail_lines_only.md"
affects: [08-revit-tier-2-export, 15-slab-floor-conversion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-surface diagnostic pattern: TaskDialog (always shown, blocking) + pyRevit Output Window markdown table with output.linkify (clickable element-link routing) -- engineer clicks the link, Revit highlights the element"
    - "Skip-row markdown table rendering: output.print_table(table_data=rows, title='Conversion Skips', columns=['Element', 'Reason', 'Structural Type'])"
    - "Bonus _convert_one fix committed during execution (sibling-repo 9342288): explicit analytical.SectionTypeId = elem.Symbol.Id and analytical.MaterialId = elem.StructuralMaterialId post-AddAssociation; AddAssociation does NOT propagate section/material despite being called the 'association manager' -- empirically confirmed via debug session convert-missing-section-false (2026-05-02). The Plan 7-02 docstring claim that 'AddAssociation propagates section/material from the physical element automatically' was incorrect; corrected this plan."
    - "ASCII-only diagnostic strings (Pitfall 9) -- '--' instead of em-dash, '|' as the summary delimiter; verified by grep -nP '[^\\\\x00-\\\\x7F]'"
    - "Manual fixture authoring constraint: Revit's UI blocks deliberately-broken structural elements (cannot set Material to <None>; closest workaround is Material = Air which is a valid material that converts cleanly). Original plan-level Fixture 2 'broken element triggers missing-section skip' is not authorable through UI -- skip taxonomy verified by code review of run_batch try/except ladder instead."
    - "Phase 5 architectural finding: ExportToPDA reads detail lines from active drafting view and emits JSON with hardcoded DEFAULT_E/I/A; it does NOT consume AnalyticalMember section/material data. Tier 1 round-trip cannot validate Phase 7 metadata -- deferred to Phase 8 Tier 2 export, which will read AnalyticalMember directly."

key-files:
  created:
    - ".planning/phases/07-revit-element-to-analytical-conversion/07-03-SUMMARY.md"
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/phase07_minimal_frame.rvt"
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/phase07_multi_storey.rvt"
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/phase07_pre_converted.rvt"
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/icon.png"
  modified:
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py"
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/UAT_RUNBOOK.md"
    - ".planning/ROADMAP.md (success criterion 4 reframed; plan 07-03 marked complete; Phase 7 row marked complete in milestone summary)"

key-decisions:
  - "Reframed ROADMAP success criterion 4 from 'Tier 1 round-trip via Phase 5 ExportToPDA' to 'analytical model well-formedness for downstream Tier 2'. Reason: code inspection of ExportToPDA.pushbutton/script.py during Plan 07-03 Task 4 confirmed Phase 5 reads OST_Lines DetailLines (not AnalyticalMember) and writes hardcoded DEFAULT_E/I/A. Phase 5 cannot see Phase 7's section/material work, so re-running Phase 5 on a Phase-7-converted document proves nothing about Phase 7 deliverables. Real round-trip exercising section + material is Phase 8 Tier 2."
  - "Dropped the empirical 'broken element' from Fixture 2. Reason: Revit UI does not allow authoring a structural element that triggers missing-section / missing-location skip taxonomy (cannot set Material to <None>; cannot create zero-length structural members; Symbol.Id is always valid for family instances). Material = Air was the engineer's closest reachable degenerate state and it converts cleanly. Skip taxonomy verified by code review of run_batch try/except ladder."
  - "Fixture 2 redefined as 18-element multi-storey positive path (8 columns + 8 beams + 2 bracings, 2 storeys at levels 0/3m/6m). Net effect: scale + multi-storey + mixed-role coverage instead of empirical negative-path."
  - "Committed Plan 07-02 fix mid-Plan-07-03 (sibling-repo 9342288): explicit SectionTypeId/MaterialId assignment in _convert_one. Reason: surfaced during 2026-05-02 debug session convert-missing-section-false; uncommitted in working tree; needed in git before Task 3 deploy push to prevent overwriting the working Windows-host script with a regression."
  - "icon.png generated programmatically (Python + PIL) as a 64x64 RGBA PNG: portal-frame outline + dashed brace + orange-red filled-circle nodes. Functions as a placeholder; engineer can swap with a hand-authored icon at any time."
  - "Tier 1 round-trip section in UAT_RUNBOOK.md replaced with a deferred-to-Phase-8 explanation rather than removed -- preserves the rationale + the discovery path for future-self."

# Empirical UAT outcomes (Task 4)
uat:
  fixture-1:
    status: pass
    observed:
      taskdialog: "converted: 7 | already-associated: 0 | skipped (errors): 0 | total: 7. All elements processed successfully."
      analytical-browser: "7 AnalyticalMembers, all with non-null SectionTypeId and MaterialId (D-10 verified empirically)"
      single-undo: "single Ctrl+Z reverts all 7 AMs in one step (Pitfall 5: TransactionGroup.Assimilate working)"
      single-redo: "Ctrl+Y restores all 7 AMs"
  fixture-2:
    status: pass
    observed:
      taskdialog: "converted: 18 | already-associated: 0 | skipped (errors): 0 | total: 18. All elements processed successfully."
      single-undo-at-scale: "single Ctrl+Z reverts all 18 AMs in one step -- Pitfall 5 holds at the larger scale"
      negative-path: "deferred to code review (Revit UI prevents authoring deliberately-broken structural elements; engineer attempted Material = <None> -- rejected; closest reach was Material = Air which is a valid material that converts cleanly)"
  fixture-3:
    status: pass
    observed:
      taskdialog: "converted: 0 | already-associated: 7 | skipped (errors): 0 | total: 7. All elements processed successfully."
      no-duplicates: "AnalyticalMember count unchanged at 7 post re-run; D-03 already-associated reported on its own distinct line"
  tier-1-round-trip:
    status: deferred
    reason: "Phase 5 ExportToPDA reads DetailLines + DEFAULT_E/I/A, not AnalyticalMember metadata. Cannot validate Phase 7 deliverables. Real round-trip is Phase 8 Tier 2 export."
  configurable-filter:
    status: pass
    observed: "SUPPORTED_CATEGORIES dict literal at top of script.py; dispatch reads from this dict; adding a new category requires touching only the dict + a new handler"

requirements-completed: [REVIT-CONVERT-04]

sibling-repo:
  remote: https://github.com/PDA-structure/CustomRevitExtension
  commits-this-plan:
    - "9342288 fix(07-02): explicit SectionTypeId/MaterialId on AnalyticalMember after AddAssociation"
    - "22aef2a feat(07-03): add Phase 7 UAT fixtures (Task 2)"
    - "75b7634 feat(07-03): add ConvertToAnalytical icon.png (Task 3 part A)"
  head-at-completion: "75b7634 (pushed to origin/main 2026-05-06)"

# Metrics
duration: ~3h (actively engaged; spans 2026-05-02 pause through 2026-05-06 resume)
completed: 2026-05-06
---

# Phase 7 Plan 3: Diagnostics + UAT + Windows Deploy Summary

**Closes Phase 7 with the dual-surface diagnostic (TaskDialog + Output Window with linkify), three Revit 2025 UAT fixtures, an engineer-readable runbook, the icon, and verified Windows-host deploy. Two scope reframings during execution: Fixture 2 dropped the empirical broken-element test (Revit UI blocks authoring it); ROADMAP success criterion 4 deferred Tier 1 round-trip to Phase 8 (Phase 5 ExportToPDA cannot consume AnalyticalMember metadata). All three fixtures empirically pass; single-undo at 7 and 18 elements both verified; SectionTypeId + MaterialId non-null on every AnalyticalMember post-conversion. Phase 7 closes; Phase 8 Tier 2 is the next entry point.**

## Plan structure

Four tasks, only the first autonomous:

- **Task 1 (autonomous):** Add `_emit_summary` after `run_batch`; rewire `main()` to call it. Done first session; committed as sibling-repo `6aa4156`.
- **Task 2 (engineer-manual):** Author 3 RVT fixtures + UAT_RUNBOOK.md. Resumed 2026-05-06 with engineer + Revit on Windows; redefined Fixture 2 mid-flight; committed as sibling-repo `22aef2a`.
- **Task 3 (engineer-manual):** Author icon.png + Windows-host deploy. icon.png generated programmatically (PIL placeholder); deploy verified live; committed as sibling-repo `75b7634`.
- **Task 4 (engineer-manual UAT):** Run all 3 fixtures + Tier 1 round-trip + configurable-filter walkthrough. Fixtures 1/2/3 + filter all pass empirically; Tier 1 round-trip reframed-and-deferred during the task itself.

## Two execution-time scope reframings

### Fixture 2: empirical broken-element test dropped

The plan called for a Fixture 2 with one deliberately-broken element to trigger the `missing-section` skip path empirically. **This is not authorable through Revit's UI:** the engineer attempted `Structural Material = <None>` (rejected by Revit) and `Structural Material = Air` (valid material, converts cleanly with no skip). Revit enforces valid `StructuralMaterialId` and `Symbol.Id` on every structural family instance.

The curated skip taxonomy in `run_batch` (`missing-location`, `unsupported-geometry`, `missing-section`, `generation-failed`, `other-error`) is therefore verified by code review of the `try/except` ladder rather than by empirical fixture trigger. Fixture 2 was redefined as a multi-storey positive-path test (18 elements: 8 columns + 8 beams + 2 bracings, 2 storeys) — exercises selection scaling, level-spanning column geometry, and mixed structural roles.

Memory: `revit_ui_blocks_broken_structural_elements.md`.

### ROADMAP success criterion 4: Tier 1 round-trip deferred to Phase 8

Code inspection during Task 4 of `ExportToPDA.pushbutton/script.py` (the Phase 5 / v1.2 Tier 1 frame exporter):
- `_collect_detail_lines(view)` filters `OST_Lines` category — AnalyticalMembers are not in this category.
- `_build_json(...)` writes `"E": DEFAULT_E`, `"I": DEFAULT_I`, `"A": DEFAULT_A` regardless of any document state.
- `"forceVector": [0] * (n_nodes * 3)` is always zero.

Phase 5 reads detail lines, not analytical members. Section + material data assigned in Phase 7's `_convert_one` is invisible to Phase 5. Running Phase 5 on a Phase-7-converted document produces JSON identical to running it on a vanilla document — proves nothing about Phase 7 deliverables.

Reframed criterion 4 to: "analytical model is well-formed for downstream Tier 2 export (Phase 8)" — empirically validated by:
1. Fixture 1 analytical-browser spot-check: `SectionTypeId` and `MaterialId` non-null on every AnalyticalMember (the explicit-assignment fix from sibling-repo `9342288`).
2. Fixture 3: 1:1 physical↔analytical association intact post-conversion; idempotent re-run produces no duplicates.
3. Single-undo at 7 and 18 elements: TransactionGroup.Assimilate (Pitfall 5) holds at scale.

The empirical round-trip exercising section + material is Phase 8 Tier 2 export, which will read `AnalyticalMember.SectionTypeId` and `MaterialId` directly.

Memory: `revit_phase5_export_uses_detail_lines_only.md`.

## Bonus: Plan 07-02 fix landed during execution

Sibling-repo commit `9342288` (`fix(07-02): explicit SectionTypeId/MaterialId on AnalyticalMember after AddAssociation`) committed mid-plan. Origin: 2026-05-02 debug session `convert-missing-section-false` discovered that `AddAssociation` does NOT propagate section/material despite being called the "association manager". The fix added explicit `analytical.SectionTypeId = elem.Symbol.Id` and `analytical.MaterialId = elem.StructuralMaterialId` post-AddAssociation, inside the same transaction. The fix was working on the deployed Windows-host script.py (proven by Fixture 1 conversion succeeding with materials + sections) but uncommitted in the Mac sibling-repo working tree. Committed before Task 3 deploy push to prevent regressing the Windows-host script.

The Plan 07-02 docstring claim that "AddAssociation propagates section/material from the physical element automatically" was incorrect; corrected by this fix's docstring rewrite.

Memory: `revit_addassociation_no_propagation.md` (pre-existing, confirmed empirically here).

## File transfer pattern

Three RVT fixtures + the icon were authored on the Windows host (Revit 2025 only runs on Windows). Mac sibling-repo is the canonical commit location. Transfer pattern used:
- Engineer saves on Windows
- Drops into Windows OneDrive folder (auto-syncs to cloud)
- Mac browser opens onedrive.live.com → downloads to `~/Downloads/`
- Orchestrator moves files to canonical sibling-repo path with proper names + commits

This pattern is now a known pre-condition for any future Revit-fixture-authoring phase. Memory: `revit_host_manual_copy_deployment.md` (pre-existing) covers the script.py side; this plan generalizes the file-transfer pattern for binary fixtures too.

## Phase 7 closure status

Five ROADMAP success criteria for Phase 7:

1. ✓ Engineer-clickable conversion (Fixture 1: 7 converted in one click)
2. ✓ Idempotent re-run (Fixture 3: `already-associated: 7`, no duplicates)
3. ✓ TaskDialog summary + per-element error isolation (Fixture 1 `_emit_summary` empirically; skip taxonomy by code review of `run_batch` since Revit UI prevents authoring broken elements)
4. ✓ Analytical model well-formed for Phase 8 (SectionTypeId+MaterialId non-null per Fixture 1 spot-check; 1:1 association per Fixture 3; single-undo at 7 and 18 elements per Pitfall 5). Reframed from "Tier 1 round-trip" to "well-formed for Tier 2"; real round-trip is Phase 8.
5. ✓ Configurable category filter (`SUPPORTED_CATEGORIES` dict at top of script.py; dispatch reads from it)

REVIT-CONVERT-01, REVIT-CONVERT-02, REVIT-CONVERT-03, REVIT-CONVERT-04 — all closed.

Phase 7 complete. Next entry point: Phase 8 Tier 2 ExportToPDA — read AnalyticalMembers directly + emit real section/material into the JSON.
