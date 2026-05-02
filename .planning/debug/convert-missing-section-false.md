---
slug: convert-missing-section-false
status: resolved
trigger: "Phase 7 ConvertToAnalytical pushbutton: every selected element is skipped with reason 'missing-section' despite having valid sections (tested with steel UB/UC and concrete rectangular sections). UAT screenshot shows 3/3 elements skipped (2 columns + 1 beam), all reason=missing-section. Bug located at sibling repo ~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py — function _verify_section_and_material (lines 156-171), called from run_batch line 204."
created: 2026-05-02
updated: 2026-05-02
---

# Debug: ConvertToAnalytical false-positive missing-section skip

## Symptoms

- **Expected:** Selecting structural columns/beams with assigned sections (steel UB/UC UK sizes or concrete rectangular) and clicking the `Convert to Analytical` ribbon button should produce `AnalyticalMember` instances per element, with `SectionTypeId` and `MaterialId` populated; TaskDialog should report `converted: N | already-associated: 0 | skipped: 0 | total: N`.
- **Actual:** 100% of selected elements are skipped with reason `missing-section`. UAT screenshot (Capture.JPG): `converted: 0 | already-associated: 0 | skipped (errors): 3 | total: 3`. Output window (Capture2.JPG) shows the markdown table with reason `missing-section` against 2 Column rows (435839, 435847) and 1 Beam row (435866). The orphan analytical members are correctly rolled back per D-10's pre-commit verification path.
- **Error:** No exception. The skip is induced deliberately by `_verify_section_and_material` returning False, then `tx.RollBack()` and `skips.append((pid, 'missing-section', role))` at `script.py:206-207`.
- **Timeline:** First-ever HUMAN-UAT attempt of the ConvertToAnalytical pushbutton (Phase 7 plan 07-03 Task 4 was deferred at session pause 2026-05-02 — user has now performed this test against ad-hoc fixtures, not the planned binary `.rvt` fixtures). No prior successful runs.
- **Reproduction:**
  1. Open Revit 2025 on Windows host (DESKTOP-K0OE1CG per Capture2.JPG, pyRevit 5.0.0.24345+0715-wip:2712:2025.3).
  2. In a model containing structural elements with assigned sections — user tested: steel UB (Universal Beam UK), UC (Universal Column UK), and concrete rectangular family/type — pre-select 1 or more columns/beams.
  3. Click the `Convert to Analytical` ribbon button (col1.stack, Analytical.panel, PDA_Tools.tab).
  4. Observe TaskDialog: `skipped (errors): N | total: N` for any N > 0 elements selected.

## Current Focus

- **hypothesis:** D-10's docstring claim (`script.py:160` — "AddAssociation propagates section/material from the physical element automatically") is FALSE for the Revit 2025 public API. `AnalyticalMember.Create(doc, curve)` produces an analytical member with default (unset) `SectionTypeId` / `MaterialId`. `AnalyticalToPhysicalAssociationManager.AddAssociation(analyticalId, physicalId)` only links the two element ids for round-trip identity; it does NOT copy the FamilySymbol id or structural material from the physical element onto the analytical member. The pre-commit read-back at `_verify_section_and_material` therefore always observes `InvalidElementId` for both fields, fails, rolls back, and logs `missing-section`. Universal failure across three different families (steel UB, UC, concrete rectangular) across both Column and Beam structural types is the empirical confirmation: the source data is fine — the read-back assumption is wrong.
- **test:** Bypass test on Windows host. Temporarily neutralise the rollback path so converted analyticals survive past commit, then RevitLookup (or properties panel) on a converted analytical to observe its `SectionTypeId` and `MaterialId` post-commit.
  ```python
  # script.py:204-208 — temporary diagnostic patch
  if not _verify_section_and_material(doc, new_id):
      # tx.RollBack()                                        # commented out
      # skips.append((pid, 'missing-section', role))         # commented out
      pass                                                   # let it commit anyway
  ```
  Then run the same selection and inspect one resulting `AnalyticalMember`.
- **expecting:**
  - **If hypothesis correct:** Post-commit, the analytical member's `SectionTypeId` and `MaterialId` are still `InvalidElementId` (or some non-zero default that is NOT the physical's `Symbol.Id`). Confirms propagation never happens, regardless of commit timing. Fix path: after `AddAssociation`, explicitly assign `analytical.SectionTypeId = doc.GetElement(physical_id).Symbol.Id` and look up the structural material (via `STRUCTURAL_MATERIAL_PARAM` BuiltInParameter on the physical's type) and assign `analytical.MaterialId`.
  - **If hypothesis wrong (race-with-commit variant):** Post-commit values DO become the physical's symbol id and material id, only the pre-commit read-back races them. Fix path: drop or relax the pre-commit verification; either commit-first-then-verify (with second tx for cleanup), or call `doc.Regenerate()` before the read-back inside the same transaction.
- **next_action:** Read the full Phase 7 RESEARCH.md and PLAN.md sections that establish D-10 to ensure no source actually verified propagation behaviour. Read CONTEXT.md to confirm the original Q-10 wording. Then surface the proposed bypass test to the user; await Windows-host result before code change.
- **reasoning_checkpoint:**
- **tdd_checkpoint:**

## Evidence

- timestamp: 2026-05-02 — UAT screenshots provided by user (`/Users/catrinevans/Downloads/OneDrive_2_02-05-2026/Capture.JPG`, `Capture2.JPG`). Capture.JPG: TaskDialog `converted: 0 | already-associated: 0 | skipped (errors): 3 | total: 3` with body "3 element(s) were skipped." Capture2.JPG: Output window markdown table titled "Conversion Skips" with three rows — Element 435839 / missing-section / Column; Element 435847 / missing-section / Column; Element 435866 / missing-section / Beam. Host: DESKTOP-K0OE1CG (Windows); pyRevit version 5.0.0.24345+0715-wip:2712:2025.3.
- timestamp: 2026-05-02 — User confirmed test coverage: "I have used the steel universal beams, universal columns UK sizes and i also tried concrete and rectangular sections and the same problem occur." Three different physical families (steel UB, steel UC, concrete rectangular) across both Column and Beam structural types — all skipped identically. Rules out a section-family-specific bug.
- timestamp: 2026-05-02 — Read `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py` lines 1-279 (full file). Confirmed:
  - Line 156-171: `_verify_section_and_material` checks `am.SectionTypeId != ElementId.InvalidElementId` AND `am.MaterialId != ElementId.InvalidElementId`. Returns False if either is missing.
  - Line 200-208 in `run_batch`: per-element `Transaction.Start()` → `_convert_one()` → `if not _verify_section_and_material(...): tx.RollBack(); skips.append((pid, 'missing-section', role)); continue`. Read-back happens BEFORE `tx.Commit()`.
  - Line 139-154: `_convert_one` does `AnalyticalMember.Create(doc, curve)` then `manager.AddAssociation(analytical.Id, physical_id)` — only two API calls; nothing explicitly copies SectionTypeId or MaterialId.
  - Line 160 (docstring): "AddAssociation propagates section/material from the physical element automatically; a null result here means the source element had nothing to propagate." — this is the assumption under test.
- timestamp: 2026-05-02 — Read `.planning/phases/07-revit-element-to-analytical-conversion/07-RESEARCH.md`. Key findings:
  - Line 53-54: D-10 stated as a CONTEXT.md decision. Wording: "Trust the conversion call itself, but post-creation read-back verify every created AnalyticalMember has a non-null section and material."
  - Line 640 (Assumptions table A6): "Section + material read-back uses `MaterialId != ElementId.InvalidElementId` and `SectionTypeId != ElementId.InvalidElementId` as the missing-data predicate (D-10) — Confidence: MEDIUM — this is the standard predicate but Revit may also allow null Material in some cases; UAT fixture 1 should include at least one element with deliberately stripped section to test the negative path."
  - Line 700 (REVIT-CONVERT-02 verification): "Converted count matches selection size minus already-associated; section + material visible in Revit properties panel." — implies expectation that post-conversion the analytical has these populated, but research never cited a Revit API source confirming `AddAssociation` is the propagation mechanism.
  - Line 117-122 (Standard Stack): documents `AnalyticalMember.Create(Document, Curve)` and `AnalyticalToPhysicalAssociationManager.AddAssociation(analyticalId, physicalId)` as "adds 1:1 association" — no claim about property propagation.
  - Conclusion: the propagation premise was never verified by research. It was an inferred assumption ("AddAssociation links them, so Revit must propagate properties") that no source confirms.
- timestamp: 2026-05-02 — Memory hook `revit_physical_to_analytical_api.md` confirms the canonical conversion path is `AnalyticalMember.Create + AddAssociation`. No claim about property propagation in the memory either — only that this two-call sequence creates+associates.

## Eliminated

- hypothesis: User's elements actually lack section/material assignments
  reason: User explicitly tested three different families (steel UB UK sizes, steel UC UK sizes, concrete rectangular) across both Column and Beam structural types; all 3/3 elements were skipped identically with `missing-section`. Universal failure across families with assignments visible in Revit's properties panel rules out the source-data hypothesis.

- hypothesis: A specific Revit family/section combination is incompatible with `AnalyticalMember.Create`
  reason: Same as above — three different families fail identically. Family-specific bugs would produce mixed pass/fail behaviour, not 100% skip.

- hypothesis: The pushbutton bundle on the Windows host is stale (running an older / wrong script.py)
  reason: Less likely given the screenshots show the correct ConvertToAnalytical bundle is wired up (TaskDialog title, output table format, both match the committed `script.py` exactly). User has been through manual-copy deploy ritual recently per Plan 07-03 Task 3. Worth verifying as a cheap sanity check (compare committed sibling-repo `script.py` byte-for-byte against the deployed copy) but not the primary suspect.

## Resolution

- root_cause: `AnalyticalToPhysicalAssociationManager.AddAssociation(analyticalId, physicalId)` only links the two ElementIds for round-trip identity; it does NOT propagate `SectionTypeId` or `MaterialId` from the physical FamilyInstance onto the new `AnalyticalMember`. The original docstring at `script.py:160` ("AddAssociation propagates section/material from the physical element automatically") was an unsourced inference made during research — no Revit API doc, sample, or community post asserts this propagation, and revitapidocs describes `AddAssociation` only as "adds a 1:1 association". Empirical confirmation via bypass test 2026-05-02: with rollback path neutralised, three converted analyticals committed cleanly with `Section = <None>` in the Revit properties panel. The pre-commit `_verify_section_and_material` was reading these correctly-empty fields and routing every element to the `missing-section` skip path.
- fix: In `_convert_one` (`script.py:139-154`), after `AddAssociation`, explicitly assign `analytical.SectionTypeId = elem.Symbol.Id` and `analytical.MaterialId = elem.StructuralMaterialId`, guarding each with an `!= ElementId.InvalidElementId` check so that physicals genuinely missing a section or material still route to the `missing-section` skip via the unchanged downstream `_verify_section_and_material` safety net. Both `SectionTypeId` and `MaterialId` are public get/set properties on `AnalyticalMember` in Revit 2025+, so direct property assignment in IronPython is the correct surface. Docstrings on `_convert_one` and `_verify_section_and_material` rewritten to reflect the actual API contract — `_verify_section_and_material` is now correctly described as a safety net for missing-source-data and silent setter failure, not as a propagation read-back. Rollback path on verification failure is preserved unchanged.
- verification: HUMAN-UAT pass on Windows host 2026-05-02. Manual-copy deploy + pyRevit Reload + re-run the same 3-element selection (steel UB column + UC column + concrete rectangular beam). TaskDialog: `converted: 3 | already-associated: 0 | skipped (errors): 0 | total: 3` as expected. Properties panel on each converted `AnalyticalMember` shows Section and Structural Material populated from the source physical (engineer-confirmed). Negative-path verification (a deliberately-stripped element should still skip with `missing-section` and rollback cleanly) deferred until the planned binary `.rvt` fixtures land per Plan 07-03 Task 2 — the safety net code path is unchanged so it should continue to work.
- files_changed:
  - `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py` — `_convert_one` adds explicit SectionTypeId + MaterialId propagation; both function docstrings rewritten.
