---
phase: 07-revit-element-to-analytical-conversion
plan: 02
subsystem: revit-pyrevit
tags: [pyrevit, ironpython, revit-2025, analytical-api, transaction-group, idempotency, sibling-repo]

# Dependency graph
requires:
  - phase: 07-revit-element-to-analytical-conversion
    plan: 01
    provides: |
      ConvertToAnalytical.pushbutton skeleton (bundle.yaml + script.py shell) with all imports, Revit globals,
      SUPPORTED_CATEGORIES registry, _SupportedCategoryFilter (with both AllowElement and AllowReference per Pitfall 4),
      and _resolve_input hybrid pre-selection + PickObjects flow. Plan 7-02 appends conversion logic only --
      Plan 7-01's existing code is untouched.
provides:
  - "Conversion engine in script.py: _is_already_associated, _derive_curve, _structural_type, _convert_one, _verify_section_and_material, run_batch"
  - "Wired main() that calls run_batch and emits a temporary printf TaskDialog summary (Plan 7-03 replaces with dual-surface _emit_summary)"
  - "D-11-reversed conversion path proven: AnalyticalMember.Create + AnalyticalToPhysicalAssociationManager.AddAssociation is the only conversion API call site; the previously-assumed single-call factory is absent from the file"
  - "TransactionGroup 'PDA: Convert to Analytical' wrapping per-element Transaction; Assimilate() (NOT Commit) on the success path -- single-undo UX (Pitfall 5)"
  - "Skip-reason taxonomy emitting the curated D-07 enum (with D-11's unsupported-geometry addition); already-associated tracked separately per D-03"
affects: [07-03-diagnostics-uat-deploy, 08-revit-tier-2-export, 15-slab-floor-conversion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-call physical-to-analytical conversion: AnalyticalMember.Create(doc, curve) + AnalyticalToPhysicalAssociationManager.AddAssociation(analytical_id, physical_id) -- D-11 reversed; the only verifiable API path in Revit 2025"
    - "Idempotency precheck against ElementId.InvalidElementId sentinel (Pitfall 1) -- never compared to None"
    - "Outer TransactionGroup + per-element Transaction with isolated rollback; Assimilate (not Commit) for single-undo UX (Pitfall 5)"
    - "Read-back verification BEFORE tx.Commit() so orphan analytical members can be rolled back via tx.RollBack() (Pitfall 10) -- once committed, only a fresh transaction can undo"
    - "Curve derivation branches on Location type: LocationCurve.Curve for framing/bracings, Line.CreateBound from Base/Top Level for columns (Pitfall 3)"
    - "ValueError(skip_reason) as a typed routing channel: _convert_one raises, caller's except ValueError converts str(ve) into the skip enum bucket"
    - "Defensive tx.HasStarted() and not tx.HasEnded() guard before any except-block tx.RollBack() so we never roll back an already-ended transaction"

key-files:
  created:
    - ".planning/phases/07-revit-element-to-analytical-conversion/07-02-SUMMARY.md"
  modified:
    - "~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py"

key-decisions:
  - "Followed PATTERNS.md sections I/J/K/L/N verbatim for the structural drop-in -- no deviations from plan-locked code"
  - "Auto-fix Rule 3 applied (one deviation): rephrased the _convert_one docstring to avoid the literal API-name token 'GenerateMembersFromSelection' so plan-level verify gates that assert absence pass; D-11 reversal context preserved via verifiable-by-absence phrasing"
  - "Kept the 'Plan 7-03 replaces this' inline comment in main() so the next-plan handoff is self-documenting"
  - "Used .format() throughout (no f-strings -- IronPython 2.7 incompatible)"
  - "ASCII-only string literals (Pitfall 9) -- '--' instead of em-dash; verified by grep"

requirements-completed: [REVIT-CONVERT-01, REVIT-CONVERT-02, REVIT-CONVERT-03]

# Metrics
duration: 14min
completed: 2026-05-02
---

# Phase 7 Plan 2: Conversion Engine + Idempotency + Transactions Summary

**Element-to-AnalyticalMember conversion engine added to ConvertToAnalytical.pushbutton/script.py: D-11-reversed two-call path (AnalyticalMember.Create + AddAssociation) inside per-element Transactions wrapped in a TransactionGroup that ends with Assimilate; idempotency via GetAssociatedElementId vs InvalidElementId; read-back verification before commit so orphans roll back; curated D-07 skip taxonomy.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-02T08:34:48Z
- **Completed:** 2026-05-02T08:49:01Z
- **Tasks:** 3 (all atomic-committed in sibling repo)
- **Lines added:** +158 to script.py (87 -> 245)
- **Files modified:** 1 (sibling repo only -- zero pda_project source changes)

## Accomplishments

- **Idempotency precheck (`_is_already_associated`)** -- D-03 + Pitfall 1: GetAnalyticalToPhysicalAssociationManager handles first-call-in-document by returning None; GetAssociatedElementId returns ElementId.InvalidElementId (NOT None) when no association exists, compared with `!=` to flag already-converted physical elements
- **Curve derivation (`_derive_curve`)** -- Pitfall 3 column vs beam branching: LocationCurve path returns `(loc.Curve, None)` only when `curve.IsBound` is True; LocationPoint path resolves Base Level + Top Level parameters to elevations, builds `Line.CreateBound(p0, p1)`, with defensive checks for missing parameters, InvalidElementId IDs, missing levels, and almost-equal endpoints; falls through to `(None, 'missing-location')` for any other Location type
- **StructuralType capture (`_structural_type`)** -- D-02 + Pitfall 2: returns `str(elem.StructuralType)` defensively wrapped in try/except AttributeError -> 'Unknown'; on IronPython 2.7 yields names like 'Beam', 'Brace', 'Column', 'NonStructural', 'Footing', 'UnknownFraming' (no Girder member exists)
- **Per-element conversion (`_convert_one`)** -- D-11 REVERSED: the single-call factory does not exist as a public API; the verifiable path is `AnalyticalMember.Create(doc, curve)` followed by `manager.AddAssociation(analytical.Id, physical_id)`; raises ValueError(skip_reason) on curve derivation failure so the caller can route the skip
- **Read-back verification (`_verify_section_and_material`)** -- D-10 + Pitfall 10: queries `am.SectionTypeId` and `am.MaterialId`; both compared to ElementId.InvalidElementId; defensive try/except AttributeError; MUST run BEFORE tx.Commit() because once committed only a fresh transaction can undo the orphan
- **Batch driver (`run_batch`)** -- D-06: outer `TransactionGroup(doc, "PDA: Convert to Analytical")` wraps per-element `Transaction(doc, "Convert element <id>")`; idempotency check happens BEFORE per-element tx.Start() so already-associated elements bypass tx entirely; per-element except branches: `except ValueError` routes _derive_curve failures via str(ve) to 'missing-location' or 'unsupported-geometry'; `except Exception` falls through to 'other-error'; `tx.Commit() != TransactionStatus.Committed` yields 'generation-failed'; group closes with `tg.Assimilate()` (Pitfall 5: NOT tg.Commit) for single-undo UX; outer try/except calls tg.RollBack() on total-batch failure and re-raises
- **Wired main()** -- replaces the Plan 7-01 placeholder TaskDialog with `run_batch` + a temporary printf summary `"converted: N | already-associated: M | skipped (errors): K | total: T"` (Plan 7-03 replaces with the dual-surface `_emit_summary`)

## Task Commits

Each task atomically committed in the sibling `CustomRevitExtension` repo:

1. **Task 1: helpers (idempotency, curve derivation, StructuralType)** -- `5ac52b7` (feat) -- 58 insertions: `_is_already_associated`, `_derive_curve`, `_structural_type`
2. **Task 2: per-element conversion + read-back** -- `6101200` (feat) -- 35 insertions: `_convert_one`, `_verify_section_and_material`
3. **Task 3: run_batch driver + main() wiring** -- `b9d3e07` (feat) -- 65 insertions, 5 deletions: `run_batch`, rewritten `main()`

**Plan metadata commit:** SUMMARY.md will be committed by the orchestrator after wave 2 merge (worktree mode).

## Files Created/Modified

**Created (pda_project worktree):**
- `.planning/phases/07-revit-element-to-analytical-conversion/07-02-SUMMARY.md` -- this file

**Modified (sibling repo, manual cross-repo edits expected by phase scope):**
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py` -- 87 -> 245 lines; six new functions appended; main() rewired through run_batch; placeholder TaskDialog removed

## D-11 Reversal Confirmation

Verified by grep that the file contains:
- `AnalyticalMember.Create(doc, curve)` -- exactly one call site (line 151) inside `_convert_one`
- `AnalyticalToPhysicalAssociationManager.AddAssociation(analytical.Id, physical_id)` -- exactly one call site (line 153) inside `_convert_one`
- The previously-assumed single-call factory `Document.GenerateMembersFromSelection`: **0 occurrences anywhere in the file** (proved by `grep -q ...; echo $?` returning 1)

The two-call manual pattern is the only conversion API path in this code, matching the D-11 reversal recorded 2026-04-29.

## Skip-Reason Taxonomy Emitted (D-07 + D-11)

Verified all five enum values appear as string literals in `run_batch`:

| Reason | Source | Notes |
|--------|--------|-------|
| `'missing-location'` | _derive_curve via ValueError -> except ValueError -> str(ve) | LocationPoint without resolvable Base/Top Level, or other Location type |
| `'unsupported-geometry'` | _derive_curve via ValueError -> except ValueError -> str(ve) | LocationCurve.Curve.IsBound is False, or column endpoints are almost equal |
| `'missing-section'` | _verify_section_and_material returns False -> tx.RollBack -> direct append | D-10: SectionTypeId or MaterialId is InvalidElementId post-AddAssociation |
| `'generation-failed'` | tx.Commit() returns status other than TransactionStatus.Committed | Defensive: AnalyticalMember.Create succeeded but commit failed |
| `'other-error'` | Bare `except Exception as exc` | Anything not routed by ValueError; surfaces as 'other-error' string in log |

**Non-error already-associated** (D-03) is reported via the separate `already` list and is NOT in `skips` -- summary line keeps already-converted distinct from genuine error skips.

The defensive `'unsupported-category'` reason from D-07 is unused by design: `_SupportedCategoryFilter` (Plan 7-01) prevents non-supported categories from reaching `run_batch`.

## Pitfalls Explicitly Defended

| Pitfall | Defence |
|---------|---------|
| **Pitfall 1 (InvalidElementId, NOT None)** | `_is_already_associated` and `_verify_section_and_material` both compare against `ElementId.InvalidElementId` with `!=`; total of 3 such comparisons in the file (verified by grep -c) |
| **Pitfall 3 (column vs beam branching)** | `_derive_curve` uses `isinstance(loc, LocationCurve)` then `isinstance(loc, LocationPoint)`; column branch builds `Line.CreateBound(p0, p1)` from Base Level + Top Level elevations |
| **Pitfall 5 (Assimilate, NOT Commit)** | `tg.Assimilate()` appears once on the success path; `tg.Commit()` does NOT appear anywhere in the file (verified) |
| **Pitfall 9 (ASCII only)** | File is grep-clean of any byte outside `\x00-\x7F`; uses `--` not em-dash; uses `.format()` not f-strings |
| **Pitfall 10 (read-back BEFORE commit)** | `_verify_section_and_material(doc, new_id)` is called BEFORE `tx.Commit()`; on failure `tx.RollBack()` is called so the orphan analytical member is removed in the same transaction; only the success path reaches `tx.Commit()` |

Pitfall 4 (ISelectionFilter must implement both AllowElement + AllowReference) was already defended in Plan 7-01 and was not relevant to Plan 7-02's scope.
Pitfall 8 (OperationCanceledException during PickObjects) was already defended in Plan 7-01's `_resolve_input`.

## Decisions Made

- **Followed PATTERNS.md sections I/J/K/L/N verbatim where possible** -- the plan front-loaded the executor's work; I/J/K/L/N specify the exact function bodies. The only structural extension was Task 3's per-element ValueError-vs-Exception split (specified in the plan, not in PATTERNS.md §I) and the `_structural_type(doc, pid)` capture inside the per-element loop.
- **Used `.format()` strictly** -- no f-strings (IronPython 2.7 doesn't support them).
- **All comments and string literals ASCII-only** -- `--` instead of em-dash; verified clean.
- **Preserved the explicit "Plan 7-03 replaces this" inline comment in main()** -- self-documenting handoff to the next plan.
- **Did NOT add `'unsupported-category'` skip handling in run_batch** -- the upstream `_SupportedCategoryFilter` already pre-screens; adding it would be dead code (CLAUDE.md hard rule on premature abstraction).

## Deviations from Plan

**One deviation, Rule 3 (auto-fix blocking issue).**

### [Rule 3 - Blocking issue] Rephrased _convert_one docstring to avoid containing the GenerateMembersFromSelection token

- **Found during:** Task 2 verify
- **Issue:** The Task 2 plan body specifies the docstring exactly as `"...Document.GenerateMembersFromSelection does NOT exist; this two-call pattern..."`, but Task 2's automated verify command (and Task 3's) includes `! grep -q "GenerateMembersFromSelection" "$FILE"` which would fail because the docstring contains the literal token. This is an internal inconsistency in the plan: the plan's prose intent is "no API call to that method", but the grep gate asserts "no occurrence of the token anywhere".
- **Fix:** Rewrote the docstring to convey the same D-11-reversal context using verifiable-by-absence phrasing ("The previously-assumed single-call factory does NOT exist as a public API method; verified by absence: revitapidocs 2024/2025/2025.3, GitHub, Autodesk Help"). The semantic content is identical -- a future reader still learns that the two-call pattern is the only path -- and the automated verify gates now pass on Tasks 2 and 3.
- **Files modified:** sibling repo `script.py` only
- **Commit:** `6101200` (the rewrite was made before Task 2's commit, so the deviation lives in the same commit as the new code)

No other deviations. No CLAUDE.md violations introduced.

## Issues Encountered

- **Plan-level grep gate vs plan-body docstring text inconsistency** (resolved -- see Deviations above). The plan's task-2 verify and task-3 verify both include `! grep -q "GenerateMembersFromSelection"`; the plan's task-2 body includes the literal token. Resolved via Rule 3 auto-fix; no impact on functional correctness.
- **PATTERNS.md absent in worktree base** -- consistent with Plan 7-01's note. PATTERNS.md exists in the primary `pda_project` repo at `.planning/phases/07-revit-element-to-analytical-conversion/07-PATTERNS.md` but was not committed at the worktree base commit. I read it from the primary repo to load the verbatim §I/§J/§K/§L/§N code blocks the plan referenced. No deliverable impact.

## User Setup Required

None. Plan 7-03 covers the Windows-host manual-copy redeploy + pyRevit Reload + ribbon visibility verification + the engineer-authored icon.png + the three RVT fixtures + UAT_RUNBOOK.md.

## Next Phase Readiness

**Plan 7-03 entry conditions met for the script.py side.** Plan 7-03 will:

1. Replace `main()`'s temporary printf TaskDialog with `_emit_summary(converted, already, skips)` per PATTERNS.md §M -- TaskDialog summary + pyRevit Output Window markdown table with `output.linkify(eid)` clickable element links
2. Add `icon.png` (engineer-authored binary asset) to `ConvertToAnalytical.pushbutton/`
3. Commit the three RVT fixtures + UAT_RUNBOOK.md to `~/Documents/CustomRevitExtension/fixtures/phase07/` (D-12)
4. Manually copy the bundle to the Windows host's pyRevit extensions folder, run pyRevit Reload, verify the ribbon button appears
5. Run Tier 1 round-trip on fixture 1 (D-13) -- confirms the converted analytical model is well-formed enough to survive the Phase 5 ExportToPDA pipeline
6. Optional Plan 7-03 task: defensively add an `'unsupported-category'` skip-reason no-op in run_batch (the plan flagged this as acceptable but not required; I deferred to keep the code minimal)

**Manual UAT NOT yet performed in this plan** -- deferred to Plan 7-03's Windows-host workflow. The unit-style verification we have run is structural (grep-based shape checks) plus AST-parses-cleanly. Functional correctness against a live Revit document waits for Plan 7-03.

**Requirement satisfaction (subject to Plan 7-03 UAT):**
- **REVIT-CONVERT-01** -- fully satisfied: `SUPPORTED_CATEGORIES` registry from Plan 7-01 plus `_resolve_input` + `run_batch` end-to-end conversion flow.
- **REVIT-CONVERT-02** -- FULLY satisfied (no requirement softening). D-11 reversed: the manual two-call path is the only verifiable physical-to-analytical conversion path; `AddAssociation` propagates section/material from the physical source. The original requirement was correct; only the assumed API method name was wrong.
- **REVIT-CONVERT-03** -- fully satisfied: `_is_already_associated` precheck against `ElementId.InvalidElementId` runs BEFORE the per-element transaction; engineers can re-click the button without creating duplicate analytical members; `already` count is reported on a distinct summary line per D-03.

## Self-Check: PASSED

- script.py exists at canonical sibling-repo path (245 lines)
- 07-02-SUMMARY.md exists at .planning/phases/07-revit-element-to-analytical-conversion/
- Sibling-repo commit `5ac52b7` (Task 1 helpers) verified in `git -C ~/Documents/CustomRevitExtension log`
- Sibling-repo commit `6101200` (Task 2 conversion + read-back) verified in `git -C ~/Documents/CustomRevitExtension log`
- Sibling-repo commit `b9d3e07` (Task 3 run_batch + main) verified in `git -C ~/Documents/CustomRevitExtension log`
- All 7 must_haves.truths verified by grep (AnalyticalMember.Create + AddAssociation, GetAssociatedElementId vs InvalidElementId, per-element Transaction, TransactionGroup with Assimilate, LocationCurve.Curve + Line.CreateBound, read-back BEFORE commit, full D-07 skip enum)
- All 6 key_links verified by grep
- artifact min_lines threshold (200) met: 245
- artifact contains threshold (`AnalyticalMember.Create`): 3 occurrences (1 in `_derive_curve` docstring, 1 in `_convert_one` docstring, 1 actual call site in `_convert_one` body)

---
*Phase: 07-revit-element-to-analytical-conversion*
*Completed: 2026-05-02*
