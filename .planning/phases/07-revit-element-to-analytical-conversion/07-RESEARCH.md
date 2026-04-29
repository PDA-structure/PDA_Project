# Phase 7: Revit Element-to-Analytical Conversion - Research

**Researched:** 2026-04-29
**Domain:** Revit 2025+ structural API; pyRevit / IronPython 2.7 pushbutton authoring; sibling-repo deploy
**Confidence:** MEDIUM-HIGH (with one HIGH-impact API verification finding — see "Critical Finding" below)

## Summary

Phase 7 ships a single pyRevit pushbutton (`Analytical.panel/ConvertToAnalytical.pushbutton/`) in the sibling `CustomRevitExtension` repo that converts user-selected physical structural columns and framing into `AnalyticalMember` instances. The implementation borrows heavily from the existing `ExportToPDA.pushbutton/` (Phase 5) for bundle structure, sys.path guards, IronPython 2.7 idioms, and TaskDialog patterns, but introduces three new concerns: (1) `ISelectionFilter`-driven category-filtered `PickObjects` for the hybrid-input UX, (2) `TransactionGroup` wrapping per-element `Transaction` for batch atomicity with isolated rollback, and (3) `AnalyticalToPhysicalAssociationManager` queries for idempotency.

There is one **HIGH-impact research finding** that the planner must surface to the user before writing plans: `Document.GenerateMembersFromSelection`, named in CONTEXT.md as the primary conversion API call, **could not be verified in any public Revit 2023/2024/2025/2026 API documentation**. The Revit "Analytical Automation" UI command exists and does this work — but its public API entry point appears to be a different name, or possibly UI-command-only. The realistic API path is the one that CONTEXT.md D-11 explicitly DESCOPED: `AnalyticalMember.Create(doc, curve)` followed by `AnalyticalToPhysicalAssociationManager.AddAssociation(analyticalId, physicalId)`. **This is the planner's call to surface to the user before proceeding** — see "Critical Finding" below.

**Primary recommendation:** Pause planning for a quick user-confirmation cycle on the API method name. If the user can confirm `Document.GenerateMembersFromSelection` exists (e.g., from RevitLookup, a 2025 SDK sample, or first-hand experience on Windows), proceed per CONTEXT.md as written. Otherwise, the planner needs to revisit D-11 (un-descope `AddAssociation`) because the manual create+associate path is then mandatory, not a fallback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Selection & Input UX**
- **D-01 (Q-01):** Hybrid input — if `uidoc.Selection` already contains valid elements at click time, use them; otherwise launch `uidoc.Selection.PickObjects` with the supported-category filter. Empty result from PickObjects → TaskDialog "No elements selected" and exit cleanly.
- **D-02 (Q-02):** Bracings are converted identically to beams (single conversion path), but the element's `StructuralType` (`Beam` / `Brace` / `Girder`) is captured in any logged metadata so Phase 8's Tier 2 exporter can route bracings to bar-style elements downstream if it chooses. No special pin-release on creation in Phase 7.
  - **Note from research:** the actual Revit API `StructuralType` enum is `{NonStructural, Beam, Brace, Column, Footing, UnknownFraming}` — `Girder` is not a member. CONTEXT.md mention of "Girder" should be read as the planner's note; in code the captured value will be one of the five real enum members. (See Common Pitfalls 2.)

**Idempotency & Re-runs**
- **D-03 (Q-03):** Already-converted elements are skipped (per REVIT-CONVERT-03 via `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId`) and reported on a **distinct summary line** — visually separated from genuine error skips. Engineer sees e.g. `converted: 2 | already-associated: 8 | skipped (errors): 0 | total: 10`. No "regenerate?" secondary prompt.

**Configuration & Extensibility**
- **D-04:** Supported categories live as a **module-level dict registry** at the top of `script.py`:
  ```python
  SUPPORTED_CATEGORIES = {
      BuiltInCategory.OST_StructuralColumns: convert_member,
      BuiltInCategory.OST_StructuralFraming: convert_member,
  }
  ```
  Registry shape is in place from day one. Both v1.3 categories point to the same handler function (`convert_member`) — no per-category branching code yet. v1.5+ Phase 15 (slabs) adds `OST_Floors: convert_slab` and a new handler without touching the dispatch site.
- **D-05:** Honours REVIT-CONVERT-01's "configurable list, NOT hard-coded" by structure (the dict is the configuration surface) without taking on premature abstraction (CLAUDE.md hard rule).

**Transactions & Error Handling**
- **D-06 (Q-06):** Outer `TransactionGroup` named `"PDA: Convert to Analytical"` wraps per-element `Transaction` instances. Each element gets its own atomic transaction; a single failed element rolls back its own transaction only and the group continues. Engineer gets one clean undo step covering the whole batch.
- **D-07 (Q-07):** Skip-reason taxonomy is a **curated short enum** plus an `other-error` fallback that carries the raw exception message:
  - `already-associated` (non-error skip)
  - `unsupported-category`
  - `missing-location`
  - `missing-section`
  - `generation-failed`
  - `other-error` (carries raw `str(exc)` for diagnostic visibility)

**Diagnostic Output**
- **D-08 (Q-08):** Two-surface diagnostic: a `TaskDialog` shows the summary `{converted, already-associated, skipped, total}` with expandable detail; the **pyRevit Output Window** (`script.get_output()`) prints a markdown table with **clickable element links** for each skip — engineer clicks "ID 12345" and Revit highlights it.
- **D-09 (Q-09):** TaskDialog is always shown, even on a fully-clean run (zero skips). Confirmation > silence.

**Property Preservation**
- **D-10 (Q-10):** Trust the conversion call itself, but **post-creation read-back verify** every created `AnalyticalMember` has a non-null section and material. Members that come back with missing data are flagged as `missing-section` skip, the (orphaned) analytical member is removed within its transaction, and the physical element is reported in the summary.
- **D-11 (Q-11):** **REVIT-CONVERT-02 fallback descoped to v1.4+.** The requirement's `AnalyticalToPhysicalAssociationManager.AddAssociation` per-element fallback path is NOT implemented in Phase 7. Elements that the primary call rejects are logged as `generation-failed`. Re-evaluate after Phase 7 UAT. This is a documented requirement softening, not a silent gap.

**Testing & UAT**
- **D-12 (Q-12):** **Three RVT UAT fixtures** authored on Mac, manual-copied to Windows host:
  1. Minimal frame — 4 columns + 2 beams + 1 diagonal brace (covers all 3 categories in one model)
  2. Multi-storey frame — 2 storeys, mixed beams + columns, exercises larger batch
  3. Idempotency re-run — same as fixture 1, but pre-converted: tests the already-associated path explicitly
  No automated regression pushbutton in Phase 7 (deferred to v1.4+).
- **D-13 (Q-13):** Phase 7's exit gate runs the existing **Phase 5/v1.2 Tier 1 `ExportToPDA` pushbutton** on the converted analytical output for fixture 1 — confirming the analytical model is well-formed enough that the Tier 1 frame2d round-trip survives.

**Plan Breakdown**
- **D-14 (Q-14):** Three plans:
  - **Plan 7-01: Bundle + Selection + Category Filter** — pushbutton skeleton, hybrid `uidoc.Selection` wiring, the `SUPPORTED_CATEGORIES` registry, empty-selection TaskDialog. No conversion calls yet.
  - **Plan 7-02: Conversion + Idempotency + Transactions** — primary conversion call inside `TransactionGroup` + per-element `Transaction`, idempotency pre-check via `GetAssociatedElementId`, post-creation read-back verification, skip-reason enum taxonomy.
  - **Plan 7-03: Diagnostics + UAT + Windows Deploy** — TaskDialog summary + pyRevit Output Window with clickable element links, three RVT fixtures committed to sibling repo, Phase 5 Tier 1 round-trip on fixture 1, Windows deploy verification.

**Code Organisation**
- **D-15 (Q-15):** All Phase 7 logic stays **inline in `ConvertToAnalytical.pushbutton/script.py`** for v1.3. Do NOT extract helpers to `lib/Snippets/` yet. Phase 8 will introduce `_pda_export_common.py`. YAGNI honoured.

### Claude's Discretion
- Exact `bundle.yaml` metadata (tooltip text, button title) — mirror existing PDA pushbutton conventions
- TaskDialog title / icon choice
- Output Window markdown formatting (column order, badge style)
- Error message phrasing for the `other-error` bucket
- Internal helper function names within `script.py`

### Deferred Ideas (OUT OF SCOPE)
- `AddAssociation` fallback path (REVIT-CONVERT-02 partial fulfilment) — v1.4+ if UAT shows it's needed; otherwise fold into Phase 9.
  - **Caveat from research:** if the primary `Document.GenerateMembersFromSelection` API does not exist as named, this deferral is unsafe — see "Critical Finding".
- Per-category handler split (Q-04(c) full form) — v1.5+ Phase 15 when slabs/foundations need a different conversion path.
- `lib/Snippets/` extraction of selection-filter / category-handling logic — Phase 8.
- Bracing-specific pin-release on creation — engineer can apply manually post-conversion.
- Automated regression pushbutton in `TestCodes.panel/` — v1.4+.
- "Regenerate already-converted?" secondary prompt — too destructive.
- `OST_Floors` / `OST_StructuralFoundation` extension — v1.5+ Phase 15.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVIT-CONVERT-01 | pyRevit pushbutton at `Analytical.panel/ConvertToAnalytical.pushbutton/` generates `AnalyticalMember` instances from user-selected physical elements (categories: `OST_StructuralColumns`, `OST_StructuralFraming`). Selection filter is a configurable list (NOT hard-coded). | Bundle layout mirrors `ExportToPDA.pushbutton/`. Configurable surface = `SUPPORTED_CATEGORIES` dict registry (D-04). `BuiltInCategory.OST_StructuralColumns` and `OST_StructuralFraming` are both verified Revit API enum members. `ISelectionFilter` pattern verified against pyRevit `lib/Snippets/_selection_func.py` (already has `ISelectionFilter_Categories` class). |
| REVIT-CONVERT-02 | Use `Document.GenerateMembersFromSelection` (Revit 2023+ API) where available; fall back to per-element creation via `AnalyticalToPhysicalAssociationManager.AddAssociation`. Preserves Revit's section / material / parameter associations. | **PARTIAL FULFILMENT per D-11.** Primary call is implemented; fallback descoped to v1.4+. **CRITICAL: research could not verify the primary API method name** — see Critical Finding below. The verifiable manual path (`AnalyticalMember.Create(doc, curve)` + `AddAssociation`) IS the descoped fallback. The planner must confirm the API name with the user before writing tasks. |
| REVIT-CONVERT-03 | Idempotent — re-running on already-converted elements doesn't create duplicates. Detects existing analytical-physical associations via `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId` before attempting creation. | `GetAnalyticalToPhysicalAssociationManager(doc)` static factory + `GetAssociatedElementId(physicalId)` instance method are both VERIFIED in the public 2023+ API. Returns `ElementId.InvalidElementId` (not `null`) when no association exists — see Common Pitfalls 1. |
| REVIT-CONVERT-04 | Diagnostic output — TaskDialog summary `{converted: N, skipped: M, total: N+M}` with skipped-element reasons; doesn't fail whole batch on one bad element. | `TaskDialog` + `script.get_output()` + `output.linkify()` patterns all VERIFIED in pyRevit docs and Phase 5 analog code. Per-element transactional isolation is the standard `TransactionGroup` + per-element `Transaction` pattern (verified). |
</phase_requirements>

## Critical Finding (HIGH PRIORITY for the planner)

**Status:** `[VERIFIED — by absence]` against Revit API 2024 and 2025 release-note pages on revitapidocs.com; `[ASSUMED — present]` in CONTEXT.md and REQUIREMENTS.md.

**Claim under test:** `Document.GenerateMembersFromSelection(IList<ElementId>)` exists in the Revit 2023+ public API and returns `IList<ElementId>` of created `AnalyticalMember`s.

**Searches performed:**
1. revitapidocs.com 2024 API Changes page — searched for `GenerateMembersFromSelection`, `GenerateAnalyticalMembers`, `GenerateAnalyticalModel`, `AnalyticalAutomation`. **Not found.**
2. revitapidocs.com 2025 API Changes page — same search terms. **Not found.**
3. revitapidocs.com 2025 main namespace — confirmed new methods in 2025 are `AnalyticalElement.IsValidTransform` and `AnalyticalElement.SetTransform`. No "Generate" method.
4. revitapidocs.com 2024 API Changes — confirmed new methods in 2024 are `IsAnalyticalElement`, `IsPhysicalElement`, `GetAssociatedElementIds` (plural, for groups). No "Generate" method.
5. GitHub broad search — `site:github.com "GenerateMembersFromSelection"` returned **zero matches** in Revit/analytical context.
6. Autodesk Help — `Physical to Analytical Automation` UI feature (the "Analytical Automation" Analyze-tab button) is documented as a UI command. Its underlying API is not surfaced in the user-facing help.

**What IS verified in the public Revit 2023+ API:**
- `AnalyticalMember.Create(Document doc, Curve curve)` — static factory, returns `AnalyticalMember`. Curve must be bounded (Line, Arc, or Ellipse). Requires active transaction. Available since Revit 2023.
- `AnalyticalToPhysicalAssociationManager.GetAnalyticalToPhysicalAssociationManager(Document doc)` — static factory, returns the manager.
- `AnalyticalToPhysicalAssociationManager.AddAssociation(ElementId analyticalId, ElementId physicalId)` — adds 1:1 association.
- `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId(ElementId)` — returns associated id or `ElementId.InvalidElementId`.
- `AnalyticalToPhysicalAssociationManager.HasAssociation(ElementId)` — bool.

**Hypotheses for the discrepancy** (not confirmable without Windows host or RevitLookup access):
1. **The method exists but is poorly indexed.** Possible — the official docs site is not exhaustively crawled. User may have first-hand knowledge.
2. **The method exists under a different name.** Candidates: `AnalyticalAutomation.GenerateMembers`, `Document.GenerateAnalyticalMembers`, an extension method, or something in `Autodesk.Revit.DB.Structure.Analytical` namespace not yet searched.
3. **The method does NOT exist in the public API; the UI feature has no public entry point.** In this case the only path is `AnalyticalMember.Create` + `AddAssociation` (i.e., the descoped fallback).

**Impact on plan-phase:**
- If hypothesis 1: no change — proceed per CONTEXT.md.
- If hypothesis 2: Plan 7-02 needs the actual method name. Surface to user.
- If hypothesis 3: D-11 must be reversed. The "fallback" becomes the primary path, and Phase 7's three plans need restructuring. Plan 7-02 still does the same architectural work (read curve from physical element, create analytical member, add association, verify, all inside per-element transaction inside group), but the loop body is two API calls instead of one.

**Recommended action for the planner:**
Before writing Plan 7-02 (the conversion+idempotency+transactions plan), ask the user one question: *"Can you confirm `Document.GenerateMembersFromSelection` exists in your Revit 2025 — e.g., visible in RevitLookup or used in a recent SDK sample? If not, we need to un-descope D-11."* This is a 30-second confirmation that prevents planning around a non-existent API. Plan 7-01 (bundle + selection + filter) and Plan 7-03 (diagnostics + UAT) are unaffected and can be planned without this resolution.

## Standard Stack

### Core (existing in sibling repo — do not change)
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| pyRevit | 5.0+ | Pushbutton runtime + Output Window + forms | `[VERIFIED: existing PDA pushbuttons in CustomRevitExtension repo]` |
| IronPython | 2.7 | Script execution engine inside pyRevit | `[VERIFIED: project memory `pyrevit_stack_column_limit.md`; existing `script.py` files in `ExportToPDA.pushbutton/`]` |
| Revit API | 2025+ (host) | `Autodesk.Revit.DB`, `Autodesk.Revit.DB.Structure`, `Autodesk.Revit.UI`, `Autodesk.Revit.UI.Selection` | `[VERIFIED: project memory `project_revit_version_matrix_2025_forward.md`]` |

### Supporting libraries (already imported by analog scripts)
| Module | Purpose | Source |
|--------|---------|--------|
| `pyrevit.script` | `script.get_output()`, `script.set_envvar`/`get_envvar` for session state | `[VERIFIED: ExportToPDA.pushbutton/script.py lines 42, 82–88]` |
| `pyrevit.forms` | TaskDialog wrappers, file pickers (NOT used in Phase 7 — no file I/O) | `[VERIFIED: existing analog]` |
| `Autodesk.Revit.UI.Selection` (`ISelectionFilter`) | Custom selection filtering for `PickObjects` | `[VERIFIED: lib/Snippets/_selection_func.py — `ISelectionFilter_Categories` class already exists]` |
| `Autodesk.Revit.DB.Structure` | `AnalyticalMember`, `AnalyticalToPhysicalAssociationManager`, `StructuralType` | `[CITED: revitapidocs.com 2023/2024/2025 — namespace `Autodesk.Revit.DB.Structure`]` |

### What NOT to add
- No new Python packages — pyRevit/IronPython 2.7 has no pip; everything must come from the .NET BCL or the `Autodesk.Revit.*` assemblies.
- No `requests`, no JSON marshalling library — Phase 7 does not produce JSON. (Phase 8 will.)
- No matplotlib, no numpy in the pushbutton — these don't run in IronPython 2.7 anyway.

**Installation:** None. The pushbutton bundle is delivered by manual folder copy to the Windows Revit host's pyRevit extensions folder, then `pyRevit Reload`. Verified via `MEMORY/revit_host_manual_copy_deployment.md` and the 2026-04-24 debug session (`STATE.md` → `truss-json-solver-mismatch`).

## Architecture Patterns

### Project structure (sibling repo, after Phase 7)
```
~/Documents/CustomRevitExtension/
└── PDA_customRevit.extension/
    ├── PDA_Tools.tab/
    │   ├── bundle.yaml                              # tab-level: layout = [Resources, Analytical, TestCodes, Dev]
    │   └── Analytical.panel/
    │       └── col1.stack/
    │           ├── ConvertToAnalytical.pushbutton/  # NEW (Phase 7)
    │           │   ├── bundle.yaml
    │           │   ├── icon.png
    │           │   └── script.py                    # ALL Phase 7 logic lives here (D-15)
    │           ├── ExportToPDA.pushbutton/          # existing — Phase 5 frame Tier 1
    │           ├── ExportToPDA_Truss.pushbutton/    # existing — quick task 260423-a0q
    │           ├── Loads.pushbutton/                # existing scaffold (empty AnalyticalButton_script.py)
    │           ├── StructuralAnalyticalModel.pushbutton/  # existing scaffold
    │           └── Supports.pushbutton/             # existing scaffold
    └── lib/
        └── Snippets/
            ├── _selection_func.py    # READ for ISelectionFilter_Categories pattern; do NOT extend (D-15)
            ├── _units_conversion.py  # READ for IronPython 2.7 patterns; not used by Phase 7
            └── ...
```

### Pattern 1: Bundle layout
**What:** A pushbutton bundle is a folder ending in `.pushbutton` containing `bundle.yaml` + `script.py` + `icon.png`.
**When to use:** Every new pyRevit pushbutton.
**Source:** `[VERIFIED: existing ExportToPDA.pushbutton/ structure]`

```yaml
# bundle.yaml — Phase 5 ExportToPDA reference
title: Export to PDA
tooltip: "Export detail-line geometry from the active drafting view as canonical PDA JSON (frame2d). Supports and loads are added in the frame2d browser UI."
author: "paulo@pda-structure.co.uk"
```

For Phase 7, mirror this style. `min_revit_version` field is supported by pyRevit but is unused in existing PDA bundles (none specify it). Decision: do NOT add `min_revit_version` to the new bundle — keep parity with sibling pushbuttons. Project memory locks Revit 2025+ at the conventions level.

### Pattern 2: Script header (IronPython 2.7 idioms)
**What:** Every pyRevit script.py opens with `# -*- coding: utf-8 -*-`, a docstring, dunder metadata (`__title__`, `__author__`, `__doc__`), then imports.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py lines 1–47]`

```python
# -*- coding: utf-8 -*-
"""
PDA Analysis Software - Element-to-Analytical Conversion (REVIT-CONVERT-01..04).

Converts user-selected physical structural columns and framing into
AnalyticalMember instances via the Revit 2025+ analytical API. Idempotent;
preserves section/material associations; transactional with isolated rollback.

Phase 7. See pda_project/.planning/phases/07-revit-element-to-analytical-conversion/.
"""
__title__   = 'Convert to\nAnalytical'
__author__  = 'paulo@pda-structure.co.uk'
__doc__     = 'Convert selected columns/beams/bracings to AnalyticalMembers.'
```

### Pattern 3: Revit globals
**What:** pyRevit scripts access `__revit__` (a magic injected global) and derive `uidoc`, `doc`, `app` from it.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py lines 71–74]`

```python
uidoc = __revit__.ActiveUIDocument
doc   = uidoc.Document
app   = __revit__.Application
```

### Pattern 4: ISelectionFilter for category-restricted PickObjects
**What:** Subclass `ISelectionFilter` to restrict selection to a list of `BuiltInCategory` values.
**Source:** `[VERIFIED: lib/Snippets/_selection_func.py lines 39–47]` already has `ISelectionFilter_Categories`. Phase 7 should NOT extend that snippet (D-15) — instead define a local class inside `script.py`. The existing snippet is a model:

```python
# lib/Snippets/_selection_func.py — existing reference
class ISelectionFilter_Categories(ISelectionFilter):
    def __init__(self, allowed_categories):
        ''' :param allowed_categoriess: list of allowed Categories'''
        self.allowed_categories = allowed_categories

    def AllowElement(self, element):
        if element.Category.BuiltInCategory in self.allowed_categories:
            return True
```

Phase 7 inlines an equivalent class in `script.py` and instantiates it with `list(SUPPORTED_CATEGORIES.keys())`. **Pitfall:** also implement `AllowReference(self, reference, position)` returning `False` — Revit calls this when the selection mode is sub-element references; if not implemented the filter raises a NotImplementedError mid-pick. (See Common Pitfalls 5.)

### Pattern 5: Hybrid selection (D-01)
**What:** Read `uidoc.Selection.GetElementIds()` first; if non-empty, use that. Otherwise call `PickObjects` with the filter.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py lines 110–139 implements an analogous pattern for DetailLine]`

The Phase 5 analog uses the `_selection_func.py` helper directly. Phase 7's hybrid version filters to the registered `BuiltInCategory` set (not to a Python type), because `OST_StructuralFraming` covers both beams and bracings — both are `FamilyInstance` subclasses, which would defeat type-based filtering.

### Pattern 6: TransactionGroup + per-element Transaction (D-06)
**What:** An outer `TransactionGroup` wraps per-element `Transaction` instances. Each per-element tx commits or rolls back independently. The group `Assimilate()`s at the end so the user sees one undo step.
**Source:** `[CITED: jeremytammik.github.io/tbc/a/1280_transaction_group.htm]` and `[VERIFIED: revitapidocs.com 2015 TransactionGroup class]`

The C# pattern from Building Coder (translated to IronPython 2.7 below) shows the structure. Critical points:
- `TransactionGroup.Assimilate()` merges all committed inner transactions into a single named undo step.
- `TransactionGroup.RollBack()` undoes ALL inner transactions, even committed ones.
- Per-element `Transaction.RollBack()` only rolls back its own work.
- For Phase 7's "one bad element doesn't abort the batch" requirement: catch exceptions inside the per-element loop, call `tx.RollBack()` on the inner transaction, append to skip log, then `continue`. The group keeps going. At the end, call `transGroup.Assimilate()`.

### Pattern 7: pyRevit Output Window with linkify
**What:** `script.get_output()` returns an output object. `output.linkify(element_id)` produces a clickable string. `output.print_md(...)` and `output.print_table(...)` render markdown.
**Source:** `[VERIFIED: docs.pyrevitlabs.io reference; learnrevitapi.com Linkify article]`

```python
# Single element link
output = script.get_output()
print(output.linkify(elem_id))

# Markdown table
output.print_table(
    table_data=[[output.linkify(eid), 'missing-section', 'beam'] for eid, reason, role in skips],
    title='Phase 7: Conversion Skips',
    columns=['Element', 'Reason', 'Structural Type'],
)
```

**Limit:** `output.linkify()` accepts a list of ElementIds but rendering breaks past ~100–150 elements per button. For Phase 7 batches typically under 100, this is not a concern; flag for future scale-up.

### Pattern 8: Session-scoped state via `script.set_envvar`
**What:** pyRevit re-imports the script on every click — module globals do NOT persist. Use `script.set_envvar(key, value)` / `script.get_envvar(key)` for session state.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py lines 76–88]`

Phase 7 may not need session state (no "don't show this warning again" pattern is required by CONTEXT.md), but if any one-time per-session caching is added it must use this pattern, not module globals.

### Pattern 9: sys.path guard (only if importing from `lib/Snippets/`)
**What:** pyRevit auto-adds `lib/` to `sys.path`, but not necessarily `lib/Snippets/`. Existing PDA scripts insert it dynamically.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py lines 21–33]`

Per D-15, Phase 7 does NOT import from `lib/Snippets/`. **Therefore the sys.path guard is NOT needed** in `ConvertToAnalytical.pushbutton/script.py`. Omit it for code clarity — it's load-bearing only when there's an actual `from _foo import bar`.

### Anti-patterns to avoid
- **Module globals for session state.** pyRevit re-imports on every click — globals reset. Use `script.set_envvar`.
- **`numpy.matrix` / scipy.** Don't exist in IronPython 2.7. Phase 7 doesn't need them.
- **`from Autodesk.Revit.DB import *`** — `_selection_func.py` does this, but for new code prefer explicit imports for clarity.
- **Module-level Revit work** — the document and active view are queried at import time, but **never** call transactional APIs at module scope. Wrap in `def main()` and call from `if __name__ == "__main__"`.
- **`_selection_func.py` extension.** D-15 forbids it for Phase 7. Inline the filter class in `script.py`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selection filtering by category | A loop over `uidoc.Selection.GetElementIds()` checking categories manually after a generic `PickObjects` | `ISelectionFilter` subclass passed to `PickObjects(ObjectType.Element, filter, prompt)` | The filter rejects non-matching elements at hover time — engineer sees correct cursor feedback. Post-filter loops let users click rejects, then surprise them. |
| Idempotency check | Iterate every `AnalyticalMember` in the document looking for ones whose physical association matches | `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId(physical_id)` | The manager indexes associations both directions; the lookup is O(1). The naive scan is O(n) per check, O(n²) for a batch. |
| Atomic batch with isolated rollback | Manually track per-element undo state and patch up | `TransactionGroup` outer + per-element `Transaction` inner (with `Assimilate()` at the end) | Revit's transaction stack is the only correct way; manual undo is undefined behaviour. |
| Element location → curve | Special-case columns vs beams; pull endpoints from family geometry | `(elem.Location as LocationCurve).Curve` for beams/bracings; for columns use `LocationPoint` + level extents (or trust the conversion API to handle this) | Beams/bracings are curve-driven; columns are point-driven with level-derived extents. The internal `Analytical Automation` feature handles this. If the public API for that exists, use it. |
| Markdown report rendering | String-concat tables, hand-roll HTML | `output.print_table(table_data, columns, formats)` and `output.linkify(element_id)` | print_table renders consistent markdown; linkify creates clickable element refs that highlight in Revit. |
| Session state ("don't show again", caches) | Module globals or `__revit__.Application` attributes | `script.set_envvar` / `script.get_envvar` | pyRevit re-imports on every click; module globals reset. `__revit__.Application` is sealed against attribute set in modern Revit (verified bug from Phase 5). |

**Key insight:** every problem above has been solved at least once in the existing PDA pushbuttons or by a verified pyRevit/Revit API. If a Phase 7 task description says "build a function that does X" and X appears in this table, the task is wrong.

## Runtime State Inventory

> Phase 7 is a **greenfield** addition (a new pushbutton bundle). No rename or refactor. This section is included for completeness; most categories are empty.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — Phase 7 does not write any persistent files. AnalyticalMembers it creates are stored in the `.rvt` file by Revit itself. | None |
| Live service config | None — no external services involved. | None |
| OS-registered state | The pyRevit extensions folder location on the Windows host is itself OS-registered (pyRevit reads it at startup). The new pushbutton folder must be manually copied to that path. See `MEMORY/revit_host_manual_copy_deployment.md`. | Manual folder copy + `pyRevit Reload` on Windows host (Plan 7-03). |
| Secrets/env vars | None | None |
| Build artifacts | The sibling repo `~/Documents/CustomRevitExtension/.git` is the source of truth on Mac. The Windows host has its own copy of `PDA_customRevit.extension/` that is NOT a git clone. Editing on Mac → commit → manual download or copy to Windows. | Plan 7-03 Windows-deploy step must include verification: button visible in ribbon, click runs the new script (not a stale cached version). |

## Common Pitfalls

### Pitfall 1: `GetAssociatedElementId` returns `InvalidElementId`, not `null`
**What goes wrong:** Code writes `if manager.GetAssociatedElementId(eid) is None: ... # treat as not associated`. The check never fires because the API returns `ElementId.InvalidElementId` (a sentinel ElementId object), not Python `None`.
**Why it happens:** Revit API uses sentinel objects for "no value" instead of null/None, especially in ElementId contexts (because ElementId is a value type in C#).
**How to avoid:**
```python
existing = manager.GetAssociatedElementId(physical_id)
if existing == ElementId.InvalidElementId:
    # no association — proceed with conversion
    ...
else:
    # already associated — skip with reason "already-associated"
    ...
```
**Warning signs:** Idempotency tests pass on the first run but the second run "converts" everything again, creating duplicate AnalyticalMembers. (REVIT-CONVERT-03 violated silently.)
**Source:** `[VERIFIED: revitapidocs.com 2023 ElementId class — InvalidElementId is the documented sentinel]`. Confidence: HIGH.

### Pitfall 2: `StructuralType` enum doesn't have `Girder`
**What goes wrong:** CONTEXT.md D-02 mentions capturing `StructuralType` as `Beam / Brace / Girder`. The actual enum values are `{NonStructural, Beam, Brace, Column, Footing, UnknownFraming}`.
**Why it happens:** "Girder" is a Revit-UI / structural-engineering term — not an API enum member.
**How to avoid:** Capture `family_instance.StructuralType` and stringify the enum value as-is. The skip-log entry shows the actual enum name. If the engineer needs a "girder" classification later (e.g., a beam tagged as girder by some other parameter), Phase 8 derives it from a different parameter.
**Warning signs:** A skip log row with `structural_type=Girder` proves the code is fabricating values; only the five real enum members can ever appear.
**Source:** `[CITED: revitapidocs.com 2023 StructuralType enum]`. Confidence: HIGH.

### Pitfall 3: `AnalyticalMember.Create` requires a bounded curve
**What goes wrong:** Pulling `(elem.Location as LocationCurve).Curve` and passing directly to `AnalyticalMember.Create` works for beams (which always have bounded line geometry). For columns the location is a `LocationPoint` (vertical from level to top), and there is no `Curve` property. Passing an unbounded curve raises `ArgumentException`.
**Why it happens:** Columns and beams are different element types under the FamilyInstance umbrella.
**How to avoid:** Branch on `Location` type:
```python
loc = elem.Location
if isinstance(loc, LocationCurve):
    curve = loc.Curve
elif isinstance(loc, LocationPoint):
    # column: derive curve from level extents
    base_level = doc.GetElement(elem.LookupParameter('Base Level').AsElementId())
    top_level  = doc.GetElement(elem.LookupParameter('Top Level').AsElementId())
    p0 = XYZ(loc.Point.X, loc.Point.Y, base_level.Elevation)
    p1 = XYZ(loc.Point.X, loc.Point.Y, top_level.Elevation)
    curve = Line.CreateBound(p0, p1)
else:
    skip(elem, 'missing-location'); continue
```
**Warning signs:** All beams convert; all columns fail with `generation-failed`.
**Source:** `[CITED: revitapidocs.com 2023 LocationCurve, LocationPoint, AnalyticalMember.Create]`. Confidence: HIGH.

> **Caveat:** if `Document.GenerateMembersFromSelection` (per CONTEXT.md) does exist, it handles this internally and Phase 7 doesn't see the issue. Pitfall 3 is HIGH-impact under Hypothesis 3 of the Critical Finding above; LOW-impact under Hypotheses 1 and 2.

### Pitfall 4: `AllowReference` not implemented on the ISelectionFilter
**What goes wrong:** A custom `ISelectionFilter` class defines `AllowElement` only. When Revit's PickObjects calls `AllowReference` mid-pick (e.g., user hovers over a reference plane or sub-element), the missing method raises `NotImplementedError` and the pick session silently aborts.
**Why it happens:** `ISelectionFilter` requires both methods; partial implementations work for some pick modes but not others.
**How to avoid:** Always implement both:
```python
class CategoryFilter(ISelectionFilter):
    def __init__(self, allowed): self.allowed = allowed
    def AllowElement(self, e):
        return e.Category and e.Category.BuiltInCategory in self.allowed
    def AllowReference(self, ref, point):
        return False  # we only pick whole elements, never sub-references
```
**Warning signs:** PickObjects exits immediately with no error message; user reports "the button does nothing."
**Source:** `[CITED: discourse.pyrevitlabs.io PickObject and ISelectionFilter forum thread]`. Confidence: MEDIUM-HIGH.

### Pitfall 5: TransactionGroup must Assimilate, not Commit
**What goes wrong:** Calling `transGroup.Commit()` instead of `transGroup.Assimilate()` leaves each per-element transaction as its own undo step. The engineer presses Ctrl+Z and sees N steps, one per element, instead of one "Convert to Analytical" undo. Confusing UX.
**Why it happens:** `Commit()` keeps inner transactions as separate undo entries. `Assimilate()` merges them into a single named undo bearing the group's name.
**How to avoid:** End the group with `transGroup.Assimilate()`. Use `transGroup.RollBack()` only for total-failure paths.
**Warning signs:** Undo history shows multiple "Phase 7 atomic create" entries instead of one "PDA: Convert to Analytical".
**Source:** `[CITED: jeremytammik.github.io/tbc/a/1280_transaction_group.htm]`. Confidence: HIGH.

### Pitfall 6: pyRevit re-imports on every click
**What goes wrong:** A developer caches expensive computation in a module-level dict expecting it to persist across clicks. It doesn't. Every click re-runs the import, resets the dict.
**Why it happens:** pyRevit isolates each invocation in a fresh execution context.
**How to avoid:** For session state, use `script.set_envvar` / `get_envvar`. For Phase 7 specifically, no caching is required — the conversion is itself the work.
**Warning signs:** Counters that are supposed to increment across clicks always show 1.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py lines 76–88 explicitly handles this]`. Confidence: HIGH.

### Pitfall 7: Stale Windows-host bundle
**What goes wrong:** Engineer commits Phase 7 changes on Mac, but the Windows host still has the pre-Phase-7 folder. The "ConvertToAnalytical" button literally doesn't appear in the ribbon.
**Why it happens:** The Windows host is NOT a git clone of the sibling repo (`MEMORY/revit_host_manual_copy_deployment.md`). New pushbuttons require an explicit folder copy.
**How to avoid:** Plan 7-03 includes Windows-host deploy verification: copy `ConvertToAnalytical.pushbutton/` to `%APPDATA%\pyRevit\Extensions\PDA_customRevit.extension\PDA_Tools.tab\Analytical.panel\col1.stack\`, then `pyRevit Reload` (or restart Revit). Confirm: button appears with correct title; click runs the new script (not a cached old version).
**Warning signs:** Ribbon doesn't show new button; or button appears but clicking does the wrong thing (cached old script in pyc form).
**Source:** `[VERIFIED: STATE.md debug session "truss-json-solver-mismatch" 2026-04-24 — exactly this failure mode]`. Confidence: HIGH.

### Pitfall 8: `PickObjects` raises on Escape
**What goes wrong:** Engineer presses Escape during the pick session. `PickObjects` raises `Autodesk.Revit.Exceptions.OperationCanceledException`. Unhandled, the script crashes.
**Why it happens:** Revit treats Escape as an exception, not an empty list.
**How to avoid:** Wrap `PickObjects` in try/except:
```python
try:
    refs = uidoc.Selection.PickObjects(ObjectType.Element, filter, "Select columns/beams/bracings")
except OperationCanceledException:
    return  # user cancelled — exit cleanly, no TaskDialog
```
Note: empty selection (user clicks Finish without picking anything) returns an empty list, not an exception. CONTEXT.md D-01 wants a TaskDialog in that case — handle separately:
```python
if not refs:
    TaskDialog.Show("PDA Convert", "No elements selected.")
    return
```
**Warning signs:** Stack-trace dialog appears when engineer presses Escape mid-pick.
**Source:** `[CITED: revitapidocs.com PickObjects + Autodesk.Revit.Exceptions namespace]`. Confidence: HIGH.

### Pitfall 9: IronPython 2.7 Unicode in TaskDialog
**What goes wrong:** Inserting an em-dash or non-ASCII character into a TaskDialog `MainContent` string raises `UnicodeEncodeError` in IronPython 2.7's older builds.
**Why it happens:** IronPython 2.7's stdlib has rough Unicode handling.
**How to avoid:** Stick to ASCII in user-facing strings. Use `--` instead of `—`. Use `ensure_ascii=True` if any JSON is involved (Phase 7 has none).
**Warning signs:** Inconsistent failures depending on what character was in the message.
**Source:** `[VERIFIED: ExportToPDA.pushbutton/script.py line 474 explicitly notes `ensure_ascii=True` for IronPython 2.7]`. Confidence: HIGH.

### Pitfall 10: post-creation read-back verification timing
**What goes wrong:** D-10 mandates post-creation read-back verifying section + material on every created `AnalyticalMember`. If the read-back happens AFTER `Transaction.Commit()`, you can't roll back the orphan inside the same atomic step. The engineer ends up with an analytical member that has no section, and Phase 7 "succeeded".
**Why it happens:** Transactions are atomic — once committed, the only way to undo is a NEW transaction.
**How to avoid:** Read back BEFORE commit. If validation fails, call `tx.RollBack()`. Only `tx.Commit()` after both create and read-back succeed.
```python
tx.Start("Convert element {0}".format(physical_id.IntegerValue))
try:
    new_analytical_id = create_analytical_member(physical_id)  # API call
    new_analytical = doc.GetElement(new_analytical_id)
    if not _has_section_and_material(new_analytical):
        tx.RollBack()
        skips.append((physical_id, 'missing-section', _structural_type(physical_id)))
        continue
    tx.Commit()
    converted.append(physical_id)
except Exception as exc:
    tx.RollBack()
    skips.append((physical_id, 'other-error', str(exc)))
```
**Warning signs:** Skip log claims `missing-section` but the analytical member exists in the document anyway.
**Source:** `[CITED: revitapidocs.com 2023 Transaction class semantics]`. Confidence: HIGH.

## Code Examples

Verified patterns from official sources or the existing Phase 5 / quick-task analog.

### Example 1: Hybrid selection with category filter

```python
# Source: pattern derived from ExportToPDA.pushbutton/script.py lines 110–139
# + lib/Snippets/_selection_func.py ISelectionFilter_Categories class
# Inlined per D-15 — do NOT extend the snippet.

from Autodesk.Revit.DB import BuiltInCategory, ElementId
from Autodesk.Revit.UI.Selection import ISelectionFilter, ObjectType
from Autodesk.Revit.Exceptions import OperationCanceledException
from Autodesk.Revit.UI import TaskDialog

SUPPORTED_CATEGORIES = {
    BuiltInCategory.OST_StructuralColumns: 'convert_member',  # handler name; v1.3 same handler for both
    BuiltInCategory.OST_StructuralFraming: 'convert_member',
}

class _SupportedCategoryFilter(ISelectionFilter):
    def __init__(self, allowed):
        self.allowed = list(allowed)
    def AllowElement(self, element):
        cat = element.Category
        return cat is not None and cat.BuiltInCategory in self.allowed
    def AllowReference(self, ref, point):
        return False

def _resolve_input(uidoc, doc):
    """Hybrid input per D-01. Returns list of element ids or [] (cancelled)."""
    pre_selected = list(uidoc.Selection.GetElementIds())
    if pre_selected:
        # Filter the pre-selection to supported categories silently;
        # surprise rejection at click time is hostile UX.
        filtered = [
            eid for eid in pre_selected
            if doc.GetElement(eid).Category and
               doc.GetElement(eid).Category.BuiltInCategory in SUPPORTED_CATEGORIES
        ]
        if filtered:
            return filtered
        # else fall through to PickObjects — pre-selection had nothing usable
    sel_filter = _SupportedCategoryFilter(SUPPORTED_CATEGORIES.keys())
    try:
        refs = uidoc.Selection.PickObjects(
            ObjectType.Element, sel_filter,
            "Select columns/beams/bracings to convert. Press Finish when done."
        )
    except OperationCanceledException:
        return []  # silent — user pressed Escape
    if not refs:
        TaskDialog.Show("PDA Convert", "No elements selected.")
        return []
    return [r.ElementId for r in refs]
```

### Example 2: Idempotency check via the association manager

```python
# Source: revitapidocs.com 2023 — AnalyticalToPhysicalAssociationManager
# CRITICAL: returns InvalidElementId, not None. See Pitfall 1.

from Autodesk.Revit.DB import ElementId
from Autodesk.Revit.DB.Structure import AnalyticalToPhysicalAssociationManager

def _is_already_associated(doc, physical_id):
    """REVIT-CONVERT-03 idempotency precheck.
    Returns True if the physical element already has an associated analytical member."""
    manager = AnalyticalToPhysicalAssociationManager.GetAnalyticalToPhysicalAssociationManager(doc)
    if manager is None:
        return False  # first call in document — no manager yet => no associations
    associated_id = manager.GetAssociatedElementId(physical_id)
    return associated_id != ElementId.InvalidElementId
```

### Example 3: TransactionGroup + per-element Transaction skeleton

```python
# Source: pattern from jeremytammik.github.io/tbc/a/1280_transaction_group.htm
# adapted to IronPython 2.7 + the D-06 batch-with-isolated-rollback requirement.

from Autodesk.Revit.DB import Transaction, TransactionGroup, TransactionStatus

def run_batch(doc, physical_ids):
    converted, already, skips = [], [], []
    tg = TransactionGroup(doc, "PDA: Convert to Analytical")
    tg.Start()
    try:
        for pid in physical_ids:
            if _is_already_associated(doc, pid):
                already.append(pid)
                continue
            tx = Transaction(doc, "Convert element {0}".format(pid.IntegerValue))
            tx.Start()
            try:
                new_id = _convert_one(doc, pid)              # the per-element work
                if not _verify_section_and_material(doc, new_id):
                    tx.RollBack()
                    skips.append((pid, 'missing-section', _structural_type(doc, pid)))
                    continue
                if tx.Commit() != TransactionStatus.Committed:
                    skips.append((pid, 'generation-failed', None))
                    continue
                converted.append(pid)
            except Exception as exc:
                # Per-element failure: roll back this tx, log, continue the batch.
                if tx.HasStarted() and not tx.HasEnded():
                    tx.RollBack()
                skips.append((pid, 'other-error', str(exc)))
        tg.Assimilate()  # CRITICAL: Assimilate, not Commit (Pitfall 5)
    except Exception:
        # Total-batch failure — roll back ALL committed inner transactions.
        if tg.HasStarted() and not tg.HasEnded():
            tg.RollBack()
        raise
    return converted, already, skips
```

### Example 4: TaskDialog summary + Output Window markdown table

```python
# Source: docs.pyrevitlabs.io reference + learnrevitapi.com Linkify article + D-08, D-09

from pyrevit import script
from Autodesk.Revit.UI import TaskDialog

def _emit_summary(converted, already, skips):
    output = script.get_output()
    output.set_title("PDA: Convert to Analytical")

    # Markdown table with clickable links — only if there are skips
    if skips:
        rows = [
            [output.linkify(eid), reason, str(role) if role else '-']
            for (eid, reason, role) in skips
        ]
        output.print_table(
            table_data=rows,
            title='Conversion Skips',
            columns=['Element', 'Reason', 'Structural Type'],
        )

    # TaskDialog always shown (D-09)
    summary = "converted: {0} | already-associated: {1} | skipped (errors): {2} | total: {3}".format(
        len(converted), len(already), len(skips),
        len(converted) + len(already) + len(skips),
    )
    td = TaskDialog("PDA: Convert to Analytical")
    td.MainInstruction = summary
    if skips:
        td.MainContent = "{0} element(s) were skipped. See the pyRevit Output window for clickable links to each.".format(len(skips))
    else:
        td.MainContent = "All elements processed successfully."
    td.Show()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AnalyticalModel` retrieved from physical via `elem.GetAnalyticalModel()` (auto-generated, always synced) | Independent `AnalyticalMember` element created separately, then 1:1 association via `AnalyticalToPhysicalAssociationManager` | Revit 2023 | Phase 7 lives in the new world. The old API is gone in 2023+. |
| Implicit physical→analytical sync | User-triggered creation; "Analytical Automation" UI command for batch creation | Revit 2023 | Phase 7 IS the user-trigger. Replaces what used to happen automatically. |
| Class-based ISelectionFilter requires both AllowElement + AllowReference | Same pattern still current; no change | — | Pitfall 4 still applies. |

**Deprecated/outdated (do not use as templates):**
- `AnalyticalModel` class — removed Revit 2023.
- `AnalyticalModelColumn`, `AnalyticalModelStick`, `AnalyticalModelSurface` — removed Revit 2023.
- `frame_v1_legacy.py` patterns from the pda_project — completely orthogonal but flagged in CLAUDE.md as legacy.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Document.GenerateMembersFromSelection` exists in Revit 2025 public API | Critical Finding, REVIT-CONVERT-02 row in `<phase_requirements>` | HIGH — Plan 7-02 architecture changes; D-11 must be reversed; the descoped fallback becomes the primary path. **The planner MUST surface this to the user before writing 7-02 tasks.** |
| A2 | bundle.yaml in Phase 7 should NOT specify `min_revit_version` (parity with sibling pushbuttons) | Pattern 1 | LOW — easily added in a one-line edit if the user wants strict version-gating per memory `project_revit_version_matrix_2025_forward.md`. |
| A3 | `BuiltInCategory.OST_StructuralFraming` covers both beams and bracings (single category for both) | D-04 registry | LOW — verified against Revit category model; bracings are FamilyInstance under OST_StructuralFraming with `StructuralType.Brace`. |
| A4 | `output.linkify` works fine for batch sizes typical of Phase 7 fixtures (≤ 100 elements) | Pattern 7 | LOW — fixtures from D-12 are 7, ~20, and 7 elements; well under the 100–150 limit. |
| A5 | The TaskDialog/Output Window pattern (D-08) renders correctly under pyRevit 5.0 + Revit 2025 + IronPython 2.7 | Example 4 | LOW — docs.pyrevitlabs.io confirms `print_table` + `linkify` are supported. UAT on the Windows host (Plan 7-03) is the verification gate. |
| A6 | Section + material read-back uses `MaterialId != ElementId.InvalidElementId` and `SectionTypeId != ElementId.InvalidElementId` as the missing-data predicate (D-10) | Code Example 3, Pitfall 10 | MEDIUM — this is the standard predicate but Revit may also allow null Material in some cases; UAT fixture 1 should include at least one element with deliberately stripped section to test the negative path. |

## Open Questions

1. **Does `Document.GenerateMembersFromSelection` exist as named?**
   - What we know: the user / CONTEXT.md asserts it does. The Revit "Analytical Automation" UI feature exists and does this work.
   - What's unclear: the public API entry point name.
   - Recommendation: 30-second user-confirmation question before writing Plan 7-02 tasks. See "Critical Finding" above for the question text.

2. **What does the conversion API return for unsupported categories — empty list, exception, or filtered subset?**
   - What we know: under hypothesis 1 (the API exists), it likely returns a filtered subset (e.g., the engineer passed [col, col, slab]; it returns [analytical_col_id, analytical_col_id, InvalidElementId] or similar).
   - What's unclear: the exact shape. Affects D-07 skip-reason taxonomy — `unsupported-category` might be redundant with `generation-failed`.
   - Recommendation: Plan 7-02 includes a "probe" task — call the API with a deliberately mixed selection (one column, one slab) on UAT fixture 1 and observe the return. Adjust the skip-reason logic based on actual behaviour.

3. **What is the `min_revit_version` field convention in `bundle.yaml`?**
   - What we know: pyRevit supports it. Existing PDA bundles do NOT use it.
   - What's unclear: should Phase 7 set a precedent and add `min_revit_version: 2025`?
   - Recommendation: Claude's discretion (CONTEXT.md). Default to omission for parity. Easy to add later.

4. **Where exactly does `ConvertToAnalytical.pushbutton/` go in `col1.stack/` ordering?**
   - What we know: `col1.stack/` already has 5 buttons (ExportToPDA, ExportToPDA_Truss, Loads, StructuralAnalyticalModel, Supports). pyRevit ribbon stacks max 3 columns (memory: `pyrevit_stack_column_limit`).
   - What's unclear: 6 buttons in one stack/column — does pyRevit auto-flow? Or is "stack" a vertical concept (no upper bound) and "column" the horizontal one (max 3)?
   - Recommendation: Phase 7 places `ConvertToAnalytical.pushbutton/` in `col1.stack/`, at the top (before ExportToPDA, since CONVERT logically precedes EXPORT). Visual verification on Windows host in Plan 7-03 confirms.

## Environment Availability

> Phase 7 has no external runtime dependencies beyond Revit 2025 + pyRevit (which the user already has — Phase 5 / Tier 1 is shipping).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Revit 2025 | Host runtime | ✓ (Windows host) | 2025+ | None — required for UAT |
| pyRevit 5.0+ | Pushbutton runtime | ✓ (Windows host) | per existing PDA pushbuttons | None |
| IronPython 2.7 | Embedded in pyRevit | ✓ | 2.7 | None — pyRevit choice |
| `~/Documents/CustomRevitExtension/` (sibling repo) | Source authoring | ✓ | — | None — the only repo for this work |
| Mac dev machine for fixture authoring | UAT setup | ✓ | — | Revit on Mac via Parallels/Bootcamp possible but not used; existing pattern is "author RVT on Windows host directly" — **flag for user confirmation** |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Open:** D-12 says fixtures are "authored on Mac, manual-copied to Windows host". Revit does not run on macOS natively. Either (a) this means authored as Revit-on-Windows-via-Parallels / VM, (b) the user has Windows hardware too and "Mac" is shorthand for "the dev Mac that holds the git repo", or (c) the fixtures are non-Revit (not RVT files). Most likely (b), confirmed by the Windows-host UAT pattern from Phase 5. Plan 7-03 should make this explicit.

## Validation Architecture

> Included despite `workflow.nyquist_validation: false` because Phase 7 is a pyRevit pushbutton — no automated unit-test path is realistic, and the planner needs explicit guidance on what verification looks like.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Manual UAT** (no automated unit tests possible) |
| Why no automation | The Revit API requires a live Revit application context and a loaded `.rvt` document. There is no offline test harness for `ISelectionFilter`, `Transaction`, or `AnalyticalMember.Create` because they all require `__revit__.ActiveUIDocument`. pyRevit scripts cannot run under pytest. |
| Config file | None |
| Quick run command | (manual) Open fixture RVT in Revit 2025 → click ConvertToAnalytical button → observe TaskDialog + Output Window |
| Full suite command | (manual) Run all 3 fixtures in sequence + Tier 1 round-trip on fixture 1 |

### Phase Requirements → Verification Map

| Req ID | Behavior | Verification Type | Procedure | Pass Criteria |
|--------|----------|-------------------|-----------|---------------|
| REVIT-CONVERT-01 | Pushbutton appears in ribbon under `Analytical.panel` and accepts a column/beam/brace selection | Manual UAT | Plan 7-03 Windows deploy step → open fixture 1 in Revit 2025 → verify button visible → click button | Button visible; click triggers PickObjects with category-filtered cursor |
| REVIT-CONVERT-02 | Conversion produces `AnalyticalMember` per selected element with section/material preserved | Manual UAT + read-back | Fixture 1 + 2: select all physical structural elements → click button → verify TaskDialog reports correct converted count → in Revit, expand the analytical model browser → verify each new AnalyticalMember has non-null SectionTypeId and MaterialId | Converted count matches selection size minus already-associated; section + material visible in Revit properties panel |
| REVIT-CONVERT-03 | Idempotent re-run | Manual UAT | Fixture 3 (pre-converted): select same elements as fixture 1 second time → click button | TaskDialog shows `converted: 0 | already-associated: 7 | skipped: 0 | total: 7`; document analytical-member count unchanged |
| REVIT-CONVERT-04 | Diagnostic output works | Manual UAT | Deliberately include one element guaranteed to fail (e.g., a column with no section assigned) in fixture 2 → click button | TaskDialog shows non-zero skip count; pyRevit Output Window shows markdown table with clickable element link; clicking the link highlights the offending element in Revit |
| Phase 7 success criterion 4 (Tier 1 round-trip) | Phase 5 ExportToPDA pushbutton accepts the converted output | Manual UAT | Fixture 1 → run ConvertToAnalytical → switch to a drafting view containing detail lines representing the analytical model → run ExportToPDA pushbutton → load resulting JSON in frame2d UI → solve | Phase 5 completes without errors; frame2d UI loads; reactions match analytical reference within tolerance (uses Phase 5/4's existing UAT tolerance) |

### Sampling Rate
- **Per task commit (Plan 7-01 / 7-02 / 7-03):** No automated sampling. Each plan's tasks are completed and verified by manual UAT against the fixtures available at that point.
- **Per wave merge:** N/A — Phase 7's plans are sequential, not parallel.
- **Phase gate:** All 3 fixtures + Tier 1 round-trip green on Windows host before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] **Three RVT fixture files** — committed to sibling `CustomRevitExtension` repo at `~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/` (or similar). Created during Plan 7-03.
  - Fixture 1: `phase07_minimal_frame.rvt` — 4 columns + 2 beams + 1 brace
  - Fixture 2: `phase07_multi_storey.rvt` — 2 storeys, mixed beams + columns; includes one deliberately broken element (no section) for skip-path coverage
  - Fixture 3: `phase07_pre_converted.rvt` — same geometry as fixture 1, ConvertToAnalytical already run once
- [ ] **Manual UAT runbook** — short markdown document committed to phase folder describing each fixture's expected output (counts, expected skips, Tier 1 round-trip values for fixture 1). Engineer-readable; lets future re-runs be checked against frozen expectations.
- [ ] No framework install needed.

## Security Domain

> **Skipped:** This phase has minimal security surface area. Inputs are user-clicked selections inside Revit; outputs are AnalyticalMembers in the same document. No file I/O, no network, no shared parameters, no shell-out. The only mildly notable consideration is that `output.linkify` produces revit:// URIs that Revit interprets — but those are sandboxed to selection-highlighting and cannot trigger arbitrary code.
>
> ASVS categories **do not meaningfully apply** to a pyRevit script that operates entirely within the Revit document context. The relevant project-level guard (CLAUDE.md hard rule against `solver_core` printing or matplotlib in compute path) is automatically honoured because Phase 7 doesn't touch `solver_core` at all.

## Project Constraints (from CLAUDE.md)

The planner must verify these constraints are respected:

- **YAGNI / no premature abstraction.** D-15 keeps everything inline in `script.py`. No `lib/Snippets/` extraction in Phase 7. Plans MUST NOT propose tasks that create helper modules, base classes, or generic dispatch frameworks beyond the SUPPORTED_CATEGORIES dict.
- **Sibling-repo only for Revit work.** Phase 7 makes ZERO changes to `pda_project/`. No FastAPI updates, no `solver_core` changes, no UI work. Plans MUST NOT touch `api_server/`, `solver_core/`, `ui/`, `tests/`, or any pda_project file. The only pda_project artefact Phase 7 creates is the `.planning/phases/07-...` documentation.
- **Revit 2025+ only.** Plans MUST NOT add 2023/2024 compatibility code paths.
- **GSD workflow enforcement.** All file edits go through `/gsd-execute-phase`. Plans MUST NOT propose direct file edits outside the GSD command surface.
- **No matplotlib / printing in solver_core compute path.** Trivially honoured because Phase 7 doesn't touch `solver_core`.
- **`solve_structure()` resets force vector each call.** N/A to Phase 7.
- **DOF numbering 1-based public, 0-based internal.** N/A to Phase 7 (no solver involvement).

## Files to Create / Modify

### Create (sibling repo)
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/bundle.yaml`
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/script.py`
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ConvertToAnalytical.pushbutton/icon.png`
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/phase07_minimal_frame.rvt`
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/phase07_multi_storey.rvt`
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/phase07_pre_converted.rvt`
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/fixtures/phase07/UAT_RUNBOOK.md`

### Modify (sibling repo)
- None. (Existing pushbuttons are not touched.)

### Create (pda_project — planning docs only)
- `.planning/phases/07-revit-element-to-analytical-conversion/07-RESEARCH.md` (this file)
- `.planning/phases/07-revit-element-to-analytical-conversion/07-PLAN-01.md` (Plan 7-01, by gsd-planner)
- `.planning/phases/07-revit-element-to-analytical-conversion/07-PLAN-02.md` (Plan 7-02)
- `.planning/phases/07-revit-element-to-analytical-conversion/07-PLAN-03.md` (Plan 7-03)

### Modify (pda_project — planning docs only)
- `.planning/STATE.md` (status update on phase progress)

**Zero changes to pda_project source code, tests, or API.**

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `Document.GenerateMembersFromSelection` doesn't exist as named | MEDIUM (research could not verify) | HIGH (forces D-11 reversal, plan restructure) | 30-second user-confirmation before Plan 7-02. See Critical Finding. |
| `GetAssociatedElementId` returns InvalidElementId, not None — comparison wrong | LOW (documented in Pitfall 1) | MEDIUM (silent idempotency violation) | Code review checks `== ElementId.InvalidElementId` not `is None`. Fixture 3 (re-run) explicitly tests this path. |
| Stale Windows-host bundle after deploy | MEDIUM (happened in Phase 5 quick task) | MEDIUM (button works locally, fails on host) | Plan 7-03 includes explicit Windows-host verification step: copy folder, `pyRevit Reload`, click button, observe correct title in ribbon. |
| Column location-curve derivation breaks (Pitfall 3) | MEDIUM (under hypothesis 3 of Critical Finding) | HIGH (all column conversions fail) | Branch on `LocationCurve` vs `LocationPoint` per Pitfall 3 example. Fixture 1 includes 4 columns specifically to test this path. |
| ISelectionFilter raises mid-pick (Pitfall 4) | LOW | MEDIUM (silent abort confuses engineer) | Implement BOTH `AllowElement` and `AllowReference` from the start. Code review checks. |
| `OperationCanceledException` on Escape crashes script (Pitfall 8) | MEDIUM | LOW | try/except wrap around `PickObjects`. Code review checks. |
| Bundle file naming conflict (e.g., button title duplication in ribbon) | LOW | LOW | Distinct `__title__` and `bundle.yaml title:` per pushbutton. The "Convert to\nAnalytical" two-line title (matching Phase 5 "Export to\nPDA") visually slots into the ribbon. |
| TaskDialog Unicode crash in IronPython 2.7 (Pitfall 9) | LOW | LOW | ASCII-only user-facing strings. Code review checks. |
| Fixture authoring tool absent (Mac without Revit) | LOW–MEDIUM | LOW | Plan 7-03 surfaces this in the runbook; user clarifies during plan-phase. |
| `output.linkify` rendering breaks past 100 elements | LOW (fixtures are small) | LOW | Document limit; flag for future scale-up. Phase 7 fixtures total ~34 elements. |
| Multi-storey fixture exposes a per-element transaction failure that wasn't caught in fixture 1 | MEDIUM | LOW (D-07 catches via `other-error`) | The skip-reason taxonomy already covers unknowns; fixture 2 explicitly stress-tests this. |

## References

### Primary (HIGH confidence)
- `[VERIFIED]` `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py` — Phase 5 frame Tier 1 exporter; canonical pyRevit pushbutton structure for this project. Lines 1–47 (header + sys.path), 71–88 (Revit globals + session env), 109–139 (selection helper integration), 419–489 (main entrypoint).
- `[VERIFIED]` `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/script.py` — quick task 260423-a0q clone; second analog confirming pattern stability.
- `[VERIFIED]` `~/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_selection_func.py` — existing `ISelectionFilter_Categories` class (lines 39–47); pattern reference. Do NOT extend in Phase 7 (D-15).
- `[VERIFIED]` `~/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_units_conversion.py` — IronPython 2.7 module style reference; not used by Phase 7.
- `[CITED: revitapidocs.com 2023]` AnalyticalMember class — `Create(Document, Curve)` static factory, supported curves (Line / Arc / Ellipse), transaction requirement.
- `[CITED: revitapidocs.com 2023]` AnalyticalToPhysicalAssociationManager class — static factory `GetAnalyticalToPhysicalAssociationManager(Document)`, instance methods `AddAssociation`, `GetAssociatedElementId`, `HasAssociation`, `RemoveAssociation`.
- `[CITED: revitapidocs.com 2024 API Changes news]` AnalyticalToPhysicalAssociationManager 2024 additions — `IsAnalyticalElement`, `IsPhysicalElement`, `GetAssociatedElementIds` (plural, group support).
- `[CITED: revitapidocs.com 2025 API Changes news]` AnalyticalElement 2025 additions — `IsValidTransform`, `SetTransform`. **No new "Generate" methods.**
- `[CITED: docs.pyrevitlabs.io reference/pyrevit/output/]` pyRevit output module — `print_md`, `print_table`, `linkify`, `set_title`, signatures and examples.
- `[CITED: jeremytammik.github.io/tbc/a/1280_transaction_group.htm]` TransactionGroup pattern — Start, Commit vs Assimilate, RollBack semantics, full C# code example.
- `[CITED: help.autodesk.com Physical to Analytical Automation 2023]` Supported categories list (Structural Columns, Walls, Structural Framing, Floors); foundations excluded.

### Secondary (MEDIUM confidence)
- `[CITED: discourse.pyrevitlabs.io/t/pickobject-and-iselectionfilter/2267]` IronPython 2.7 ISelectionFilter pattern — both AllowElement and AllowReference required.
- `[CITED: learnrevitapi.com/blog/create-interactive-revit-reports-with-pyrevit-linkify]` linkify in markdown tables — full code example with `output.print_table` + `output.linkify` integration.
- `[CITED: forums.autodesk.com Revit API forum threads]` General `AnalyticalToPhysicalAssociationManager` usage patterns.

### Tertiary (LOW confidence — needs verification)
- `[ASSUMED]` `Document.GenerateMembersFromSelection` exists in Revit 2025 public API. **NOT verified in any of: revitapidocs.com 2024 changes, 2025 changes, namespace listings, GitHub, Autodesk Help.** See Critical Finding above.
- `[ASSUMED]` `min_revit_version` field convention in pyRevit `bundle.yaml` (existing PDA bundles don't use it, so the project pattern is "omit").

### Project memory
- `MEMORY/custom_revit_extension_repo.md` — sibling repo location and intent.
- `MEMORY/revit_host_manual_copy_deployment.md` — Windows deploy is manual folder copy + pyRevit Reload, NOT git clone.
- `MEMORY/project_revit_version_matrix_2025_forward.md` — Revit 2025+ only; 2023/2024 dropped.
- `MEMORY/pyrevit_stack_column_limit.md` — 3-column ribbon stack limit.
- `MEMORY/learnrevitapi_reference.md` — Erik Frits LearnRevitAPI is the practical pyRevit/Revit API reference; always include.

## Metadata

**Confidence breakdown:**
- Pushbutton bundle structure: HIGH — directly mirrored from existing analog Phase 5 + quick task 260423-a0q.
- ISelectionFilter pattern: HIGH — existing class in `_selection_func.py` plus pyRevit forum confirmation.
- TransactionGroup pattern: HIGH — Building Coder C# code maps cleanly to IronPython 2.7.
- pyRevit Output Window pattern: HIGH — official docs verified.
- AnalyticalToPhysicalAssociationManager API: HIGH — three independent sources (revitapidocs 2023/2024, official Autodesk help, forum threads).
- AnalyticalMember.Create signature: HIGH — revitapidocs 2023 explicit.
- Pitfall 1 (InvalidElementId vs None): HIGH — standard Revit API sentinel pattern.
- Pitfall 3 (column LocationPoint vs beam LocationCurve): HIGH — long-standing Revit element-model fact.
- **Existence of `Document.GenerateMembersFromSelection`: LOW — could not verify; flagged as Critical Finding.**

**Research date:** 2026-04-29
**Valid until:** ~2026-05-30 (30 days; pyRevit + Revit 2025 are stable).

---

## RESEARCH COMPLETE

Phase 7 research is complete with one HIGH-impact open question (Critical Finding above): the existence of `Document.GenerateMembersFromSelection` as named in CONTEXT.md could not be verified in any public Revit 2024/2025/2026 API documentation. The planner should surface this to the user as a 30-second confirmation before writing Plan 7-02 tasks. Plans 7-01 (bundle + selection + filter) and 7-03 (diagnostics + UAT + Windows deploy) can proceed independently.

All other CONTEXT.md decisions are research-supported with concrete code patterns from the existing Phase 5 analog and the official Revit API documentation. Skip-reason taxonomy, transaction strategy, hybrid selection, idempotency check, and pyRevit Output Window patterns are all verified and have working code examples in this research.
