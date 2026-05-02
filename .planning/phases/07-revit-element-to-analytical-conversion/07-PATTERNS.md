# Phase 7: Revit Element-to-Analytical Conversion - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 7 new files in sibling repo (3 pushbutton bundle files + 3 RVT fixtures + 1 UAT runbook)
**Analogs found:** 3/3 for code files; 0/3 for RVT binary fixtures (no precedent — Phase 7 establishes the convention)
**Repo target:** `~/Documents/CustomRevitExtension/PDA_customRevit.extension/` (sibling repo, NOT pda_project)

## Scope Note

Phase 7 modifies **zero `pda_project/` files**. All file creation lives in the sibling repo `CustomRevitExtension`. Per D-15, all Phase 7 logic stays inline in `ConvertToAnalytical.pushbutton/script.py` — no extraction to `lib/Snippets/`.

Per D-11 reversal (2026-04-29 — see RESEARCH.md Critical Finding): `Document.GenerateMembersFromSelection` does NOT exist in the public Revit API. Phase 7's primary conversion path is the manual two-call pattern: `AnalyticalMember.Create(doc, curve)` + `AnalyticalToPhysicalAssociationManager.AddAssociation(analytical_id, physical_id)`. There is no JSON output — Phase 7 creates Revit-native analytical elements only.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `ConvertToAnalytical.pushbutton/bundle.yaml` | config (pushbutton metadata) | static config | `ExportToPDA.pushbutton/bundle.yaml` | exact |
| `ConvertToAnalytical.pushbutton/script.py` | controller (pyRevit pushbutton entry) | event-driven (button click) → batch transform | `ExportToPDA.pushbutton/script.py` (structure) + `ExportToPDA_Truss.pushbutton/script.py` (clone confirmation) | role-match (selection/transaction/TaskDialog patterns transfer; conversion body diverges — analog writes JSON, Phase 7 mutates Revit doc) |
| `ConvertToAnalytical.pushbutton/icon.png` | asset (binary) | static asset | `ExportToPDA.pushbutton/icon.png` | exact (mirror sibling — engineer authors new icon) |
| `fixtures/phase07/phase07_minimal_frame.rvt` | test fixture (binary) | manual UAT input | none — no prior RVT fixtures in sibling repo | no analog |
| `fixtures/phase07/phase07_multi_storey.rvt` | test fixture (binary) | manual UAT input | none | no analog |
| `fixtures/phase07/phase07_pre_converted.rvt` | test fixture (binary) | manual UAT input | none | no analog |
| `fixtures/phase07/UAT_RUNBOOK.md` | docs (manual test procedure) | static docs | none | no analog (Phase 7 establishes runbook convention) |

## Pattern Assignments

### `ConvertToAnalytical.pushbutton/bundle.yaml` (config, static)

**Analog:** `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/bundle.yaml`

**Copy verbatim — entire field shape (lines 1-3):**
```yaml
title: Export to PDA
tooltip: "Export detail-line geometry from the active drafting view as canonical PDA JSON (frame2d). Supports and loads are added in the frame2d browser UI."
author: "paulo@pda-structure.co.uk"
```

**Must change for Phase 7:**
- `title:` → `Convert to Analytical` (mirrors Phase 5's two-line ribbon convention; the `__title__` dunder in script.py uses `'Convert to\nAnalytical'` for the explicit line break)
- `tooltip:` → describe element-to-analytical conversion (e.g., `"Convert selected physical structural columns, beams, and bracings into AnalyticalMember instances. Idempotent — already-converted elements are skipped."`)
- `author:` → keep `"paulo@pda-structure.co.uk"` verbatim

**Must NOT add (per Assumption A2 + Open Question 3 in RESEARCH.md):**
- `min_revit_version` field — existing PDA bundles do not specify this; maintain parity. Project memory `project_revit_version_matrix_2025_forward.md` locks the 2025+ assumption at the conventions level, not in bundle.yaml.

---

### `ConvertToAnalytical.pushbutton/script.py` (controller, event-driven batch transform)

**Primary analog:** `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py`
**Secondary analog (clone confirmation):** `ExportToPDA_Truss.pushbutton/script.py`
**Selection-filter reference (read-only, do NOT extend per D-15):** `lib/Snippets/_selection_func.py` lines 39-47

#### Sections to copy verbatim (with adaptations)

##### A. File header + dunder metadata (analog lines 1-13 → adapt body, keep shape)

Copy the shape of these 13 lines from `ExportToPDA.pushbutton/script.py`:
```python
# -*- coding: utf-8 -*-
"""
PDA Analysis Software - Tier 1 Geometry Exporter (REVIT-T1-01..05).

Exports straight DetailLine elements from the active drafting view as canonical
PDA JSON (schema_version 1.0, solver "frame2d"). Merges coincident endpoints
within 1mm, splits at T-junctions, warns on mid-span crossings.

Phase 5. See pda_project/.planning/phases/05-revit-tier-1-geometry-exporter/.
"""
__title__   = 'Export to\nPDA'
__author__  = 'paulo@pda-structure.co.uk'
__doc__     = 'Export detail-line geometry to canonical PDA JSON (frame2d).'
```

**Phase 7 version (RESEARCH.md Pattern 2, lines 205-219, adapted):**
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

##### B. sys.path guard (analog lines 21-33) — OMIT per D-15

The Phase 5 analog inserts `lib/Snippets/` into `sys.path` because it imports `_units_conversion` and `_selection_func`. **Phase 7 does NOT import from `lib/Snippets/` (D-15)** — therefore the sys.path guard block is unnecessary. RESEARCH.md Pattern 9 (line 290-294) explicitly confirms: *"Per D-15, Phase 7 does NOT import from `lib/Snippets/`. Therefore the sys.path guard is NOT needed."*

##### C. Imports block (adapt analog lines 35-46)

Analog imports (Phase 5):
```python
from Autodesk.Revit.DB import (
    FilteredElementCollector, BuiltInCategory,
    DetailLine, Line, ViewDrafting, XYZ,
)
from Autodesk.Revit.UI import (
    TaskDialog, TaskDialogCommonButtons, TaskDialogResult,
)
from pyrevit import forms, script

# Reuse from the extension lib (sys.path guard above ensures these work)
from _units_conversion import convert_internal_units  # noqa: E402
from _selection_func import get_selected_elements     # noqa: E402
```

**Phase 7 imports (DIFFERENT — analytical API, no lib/Snippets reuse, no forms.save_file):**
```python
from Autodesk.Revit.DB import (
    BuiltInCategory, ElementId, XYZ,
    Line, LocationCurve, LocationPoint,
    Transaction, TransactionGroup, TransactionStatus,
)
from Autodesk.Revit.DB.Structure import (
    AnalyticalMember,
    AnalyticalToPhysicalAssociationManager,
    StructuralType,
)
from Autodesk.Revit.UI import TaskDialog
from Autodesk.Revit.UI.Selection import ISelectionFilter, ObjectType
from Autodesk.Revit.Exceptions import OperationCanceledException
from pyrevit import script
```

Notes:
- Drop `forms` (Phase 7 has no Save-As dialog).
- Drop `_units_conversion` and `_selection_func` (D-15 — inline what's needed).
- Drop `FilteredElementCollector`, `DetailLine`, `ViewDrafting` (no detail-line collection).
- Add the analytical-API trio: `AnalyticalMember`, `AnalyticalToPhysicalAssociationManager`, `StructuralType`.
- Add `Transaction`, `TransactionGroup`, `TransactionStatus` (D-06 transaction strategy).
- Add `OperationCanceledException` (Pitfall 8 — Escape during PickObjects).
- Add `LocationCurve`, `LocationPoint` (Pitfall 3 — column vs beam location branching).

##### D. Revit globals (copy verbatim, analog lines 71-74)

```python
# -- Revit globals -----------------------------------------------------------
uidoc = __revit__.ActiveUIDocument
doc   = uidoc.Document
app   = __revit__.Application
```

Phase 7 may omit `app` (no `__revit__.Application` use), but keeping it costs nothing and matches the analog pattern. Do NOT call any transactional API at module scope (Pattern 2 anti-pattern in RESEARCH.md line 300).

##### E. Session-state pattern (analog lines 76-107) — OMIT for Phase 7

The analog has a once-per-session "2D only" warning using `script.set_envvar` / `script.get_envvar`. CONTEXT.md D-09 specifies the TaskDialog summary is **always shown** (no "don't show again" toggle). Phase 7 therefore does NOT need session-scoped state. Do not copy this block.

If a future requirement needs session caching, RESEARCH.md Pattern 8 (lines 284-288) is the canonical reference — and project memory documents that `__revit__.Application` is sealed against attribute set in modern Revit (Phase 5 verified bug); always use `script.set_envvar`/`get_envvar`.

##### F. Selection helper integration (analog lines 110-139) — REPLACE with hybrid + ISelectionFilter

The analog's `_collect_detail_lines` uses `get_selected_elements` from `lib/Snippets/_selection_func.py`. Phase 7 does NOT extend that snippet (D-15) and instead inlines an `ISelectionFilter` subclass in `script.py`.

**Inline this class (RESEARCH.md Code Example 1 lines 481-488; Pattern 4 lines 231-247):**
```python
class _SupportedCategoryFilter(ISelectionFilter):
    def __init__(self, allowed):
        self.allowed = list(allowed)
    def AllowElement(self, element):
        cat = element.Category
        return cat is not None and cat.BuiltInCategory in self.allowed
    def AllowReference(self, ref, point):
        return False  # Pitfall 4: must implement both methods
```

**Reference shape (do not import) — `lib/Snippets/_selection_func.py` lines 39-47:**
```python
class ISelectionFilter_Categories(ISelectionFilter):
    def __init__(self, allowed_categories):
        self.allowed_categories = allowed_categories
    def AllowElement(self, element):
        if element.Category.BuiltInCategory in self.allowed_categories:
            return True
```

The snippet's class is missing `AllowReference` (Pitfall 4) — Phase 7's inline version fixes this. The fix-by-inlining is intentional; do NOT push the fix back to `_selection_func.py` (D-15 forbids extending the snippet for this phase).

##### G. Hybrid selection function (RESEARCH.md Code Example 1 lines 490-515)

Drop in verbatim (the analog's flat helper is structurally analogous but type-keyed; Phase 7's is category-keyed):
```python
def _resolve_input(uidoc, doc):
    """Hybrid input per D-01. Returns list of element ids or [] (cancelled/empty)."""
    pre_selected = list(uidoc.Selection.GetElementIds())
    if pre_selected:
        filtered = [
            eid for eid in pre_selected
            if doc.GetElement(eid).Category and
               doc.GetElement(eid).Category.BuiltInCategory in SUPPORTED_CATEGORIES
        ]
        if filtered:
            return filtered
        # else fall through to PickObjects
    sel_filter = _SupportedCategoryFilter(SUPPORTED_CATEGORIES.keys())
    try:
        refs = uidoc.Selection.PickObjects(
            ObjectType.Element, sel_filter,
            "Select columns/beams/bracings to convert. Press Finish when done."
        )
    except OperationCanceledException:
        return []  # silent — user pressed Escape (Pitfall 8)
    if not refs:
        TaskDialog.Show("PDA Convert", "No elements selected.")
        return []
    return [r.ElementId for r in refs]
```

##### H. Module-level registry (NEW for Phase 7 — D-04 dispatch table)

No analog — Phase 7 introduces this pattern. Place near the top of script.py, after imports, before functions:
```python
# -- Supported category registry (D-04) --------------------------------------
# Both v1.3 categories share the same handler (D-05 — YAGNI per CLAUDE.md).
# v1.5+ Phase 15 (slabs) adds OST_Floors with a new handler without touching dispatch.
SUPPORTED_CATEGORIES = {
    BuiltInCategory.OST_StructuralColumns: 'convert_member',
    BuiltInCategory.OST_StructuralFraming: 'convert_member',  # covers beams + bracings
}
```

##### I. Transaction strategy (NEW for Phase 7 — analog has NO transactions; D-06 + RESEARCH.md Pattern 6 + Code Example 3)

The Phase 5 analog never opens a Transaction — it only reads the document and writes JSON to disk. Phase 7's `AnalyticalMember.Create` mutates the document and **requires** an active transaction (RESEARCH.md line 118).

**D-06 strategy:** Outer `TransactionGroup` named `"PDA: Convert to Analytical"` wraps per-element `Transaction` instances.

**Drop in verbatim (RESEARCH.md Code Example 3 lines 545-577):**
```python
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
                if tx.HasStarted() and not tx.HasEnded():
                    tx.RollBack()
                skips.append((pid, 'other-error', str(exc)))
        tg.Assimilate()  # CRITICAL: Assimilate, not Commit (Pitfall 5)
    except Exception:
        if tg.HasStarted() and not tg.HasEnded():
            tg.RollBack()
        raise
    return converted, already, skips
```

**Critical points (Pitfall 5 + Pitfall 10):**
- Use `tg.Assimilate()` at the end — NOT `tg.Commit()`. Assimilate merges inner transactions into a single named undo step.
- Read-back validation MUST happen BEFORE `tx.Commit()`. Once committed, the only undo is a fresh transaction.
- Catch `Exception` per element to keep the batch going (CONTEXT.md REVIT-CONVERT-04 — "doesn't fail whole batch on one bad element").

##### J. Idempotency precheck (NEW for Phase 7 — D-03 + Pitfall 1 + RESEARCH.md Code Example 2 lines 527-534)

```python
def _is_already_associated(doc, physical_id):
    """REVIT-CONVERT-03 idempotency precheck.
    Returns True if the physical element already has an associated analytical member.
    CRITICAL: GetAssociatedElementId returns InvalidElementId, not None (Pitfall 1).
    """
    manager = AnalyticalToPhysicalAssociationManager.GetAnalyticalToPhysicalAssociationManager(doc)
    if manager is None:
        return False  # first call in document — no manager yet => no associations
    associated_id = manager.GetAssociatedElementId(physical_id)
    return associated_id != ElementId.InvalidElementId
```

##### K. Per-element conversion (NEW for Phase 7 — D-11 reversal + Pitfall 3 + RESEARCH.md Pitfall 3 lines 354-372)

The analog has no equivalent — this is the entirely new core of Phase 7. Curve derivation branches on Location type:
```python
def _derive_curve(elem):
    """Bounded curve for AnalyticalMember.Create. Returns (curve, None) on success
    or (None, skip_reason) on geometry failure. Pitfall 3."""
    loc = elem.Location
    if isinstance(loc, LocationCurve):
        curve = loc.Curve
        if not curve.IsBound:
            return None, 'unsupported-geometry'
        return curve, None
    if isinstance(loc, LocationPoint):
        # Column: derive vertical line from base level + top level
        base_level_id = elem.LookupParameter('Base Level').AsElementId()
        top_level_id  = elem.LookupParameter('Top Level').AsElementId()
        if base_level_id == ElementId.InvalidElementId or top_level_id == ElementId.InvalidElementId:
            return None, 'missing-location'
        base_level = doc.GetElement(base_level_id)
        top_level  = doc.GetElement(top_level_id)
        p0 = XYZ(loc.Point.X, loc.Point.Y, base_level.Elevation)
        p1 = XYZ(loc.Point.X, loc.Point.Y, top_level.Elevation)
        return Line.CreateBound(p0, p1), None
    return None, 'missing-location'

def _convert_one(doc, physical_id):
    """D-11 reversed: AnalyticalMember.Create + AddAssociation.
    Caller must have an active Transaction. Returns the new analytical ElementId."""
    elem = doc.GetElement(physical_id)
    curve, skip_reason = _derive_curve(elem)
    if skip_reason is not None:
        raise ValueError(skip_reason)  # caller's except clause routes via skips
    analytical = AnalyticalMember.Create(doc, curve)
    manager = AnalyticalToPhysicalAssociationManager.GetAnalyticalToPhysicalAssociationManager(doc)
    manager.AddAssociation(analytical.Id, physical_id)
    return analytical.Id
```

##### L. Read-back verification (NEW for Phase 7 — D-10 + Assumption A6 in RESEARCH.md)

```python
def _verify_section_and_material(doc, analytical_id):
    """D-10: confirm section + material associated post-AddAssociation, pre-commit.
    AddAssociation propagates section/material from the physical element automatically;
    a null result here means the source element had nothing to propagate."""
    am = doc.GetElement(analytical_id)
    if am is None:
        return False
    has_section  = am.SectionTypeId  != ElementId.InvalidElementId
    has_material = am.MaterialId     != ElementId.InvalidElementId
    return has_section and has_material
```

##### M. Diagnostic emission (D-08, D-09 — RESEARCH.md Code Example 4 lines 588-615)

The analog's success TaskDialog (lines 477-486) is structurally similar but Phase 5 has no Output Window with linkify. Drop in verbatim:
```python
def _emit_summary(converted, already, skips):
    """D-08 (two-surface) + D-09 (always shown)."""
    output = script.get_output()
    output.set_title("PDA: Convert to Analytical")

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

**Pitfall 9 (line 431-436):** all user-facing strings here MUST be ASCII. Use `--` not `—`. The summary format string above is ASCII-clean.

##### N. Main entry point (analog lines 419-489 — adapt structure)

Analog structure (Phase 5):
```python
def main():
    view = uidoc.ActiveView
    if not isinstance(view, ViewDrafting):
        TaskDialog.Show(...); return
    if not _warning_already_shown_this_session():
        if not _show_2d_only_warning(): return
    detail_lines = _collect_detail_lines(view)
    if not detail_lines:
        TaskDialog.Show(...); return
    # ...transform pipeline...
    TaskDialog.Show("PDA Export Complete", success_msg)

if __name__ == "__main__":
    main()
```

**Phase 7 main() (adapted shape; transform pipeline replaced with run_batch):**
```python
def main():
    physical_ids = _resolve_input(uidoc, doc)
    if not physical_ids:
        return  # _resolve_input handled the user-facing TaskDialog (or silent Escape)
    converted, already, skips = run_batch(doc, physical_ids)
    _emit_summary(converted, already, skips)

if __name__ == "__main__":
    main()
```

The analog's active-view-type guard (`isinstance(view, ViewDrafting)`) is OMITTED — Phase 7 works in any view that supports physical-element selection (3D, plan, section). The analog's once-per-session warning is OMITTED (D-09 mandates the summary always shows; no pre-run warning).

#### Sections analog has but Phase 7 does NOT use

| Analog block | Lines | Why omitted in Phase 7 |
|---|---|---|
| sys.path guard | 21-33 | D-15: no `lib/Snippets/` imports |
| `_q4` quantize helper | 56-69 | No JSON output; no float serialization |
| Session env-var "2D only" warning | 76-107 | D-09: summary always shown — no pre-run warning |
| `_collect_detail_lines` | 110-139 | Wrong domain — Phase 7 selects elements, not detail lines |
| `_extract_segments` | 142-164 | No 2D coordinate extraction |
| `_get_or_add_node`, `_point_on_segment_interior`, `_segments_cross_interior`, `_merge_and_split` | 167-302 | No node-merge / T-junction / crossing logic |
| `_sort_nodes_lexicographic` | 305-317 | No nodes to sort |
| `_sanitise_filename` | 320-329 | No file save |
| `_build_json` | 332-416 | No JSON payload |
| `forms.save_file` call + JSON write | 467-474 | No file output — analytical members are stored in the .rvt by Revit itself |

---

### `ConvertToAnalytical.pushbutton/icon.png` (asset, binary)

**Analog:** `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/icon.png`

No code excerpt — engineer authors a new icon. Conventions inferred from sibling pushbuttons:
- PNG, square, ribbon-icon-sized (typically 32x32 or 64x64 — pyRevit auto-scales).
- Visually distinct from `ExportToPDA.pushbutton/icon.png` so the two buttons don't blur together at ribbon size.
- Plan should treat `icon.png` as a manual-authoring task, not an automated build artifact.

---

### `fixtures/phase07/*.rvt` (test fixtures, binary) + `fixtures/phase07/UAT_RUNBOOK.md`

**No analog exists** — the sibling repo currently has no `fixtures/` directory. Phase 7 establishes the convention. Per D-12 the three RVT files are:

1. `phase07_minimal_frame.rvt` — 4 columns + 2 beams + 1 diagonal brace (covers all 3 categories in one model).
2. `phase07_multi_storey.rvt` — 2 storeys, mixed beams + columns (larger batch).
3. `phase07_pre_converted.rvt` — same as #1 but pre-converted (tests `already-associated` path explicitly).

These are authored on Mac (engineer's primary workstation per project memory) and committed for manual-copy to the Windows host. The runbook (`UAT_RUNBOOK.md`) is engineer-authored markdown documenting:
- How to load each fixture in Revit 2025 on the Windows host.
- Click-by-click test procedure for the new pushbutton.
- Expected counts in the summary TaskDialog per fixture.
- Phase 5 Tier 1 round-trip verification step (D-13) using fixture 1.

The planner should treat fixture authoring as a Plan 7-03 task (UAT + Windows deploy) and surface fixture authoring location to the user during plan-phase if the `fixtures/phase07/` location is not yet confirmed.

---

## Shared Patterns

### Pattern: pyRevit pushbutton bundle layout

**Source:** `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/`

```
ConvertToAnalytical.pushbutton/
├── bundle.yaml      # title, tooltip, author
├── icon.png         # ribbon icon
└── script.py        # IronPython 2.7 entry; runs on click
```

**Apply to:** All Phase 7 pushbutton work. pyRevit treats the `.pushbutton` folder name as the button identity; the bundle.yaml `title:` field is the displayed text. RESEARCH.md Pattern 1 (lines 187-199).

### Pattern: IronPython 2.7 script header

**Source:** `ExportToPDA.pushbutton/script.py` lines 1-13 + RESEARCH.md Pattern 2

Every pyRevit `script.py` opens with:
1. `# -*- coding: utf-8 -*-` magic comment (UTF-8 source decoding for IronPython 2.7).
2. Module docstring (triple-quoted; describes purpose + phase + planning doc reference).
3. Dunder metadata: `__title__` (multi-line allowed via `\n`), `__author__`, `__doc__`.
4. Imports (Revit DB, Revit UI, pyrevit).

**Apply to:** `ConvertToAnalytical.pushbutton/script.py`.

### Pattern: Revit globals derivation

**Source:** `ExportToPDA.pushbutton/script.py` lines 71-74 + RESEARCH.md Pattern 3

```python
uidoc = __revit__.ActiveUIDocument
doc   = uidoc.Document
app   = __revit__.Application
```

`__revit__` is pyRevit's magic injected global. Always derive `uidoc`, `doc`, `app` from it at module scope. Never call transactional APIs at module scope (RESEARCH.md anti-pattern, line 300).

**Apply to:** `ConvertToAnalytical.pushbutton/script.py` after imports.

### Pattern: TaskDialog at end of run

**Source:** `ExportToPDA.pushbutton/script.py` lines 477-486 (success message) + `ExportToPDA_Truss.pushbutton/script.py` lines 457-466 (clone confirmation)

The Phase 5 analog ends with `TaskDialog.Show(title, body)` reporting counts and the output path. Phase 7 extends this to two surfaces (D-08): a TaskDialog summary AND a pyRevit Output Window markdown table. The TaskDialog is **always** shown (D-09).

**Apply to:** `ConvertToAnalytical.pushbutton/script.py` `_emit_summary()` function. RESEARCH.md Code Example 4 lines 588-615.

### Pattern: ASCII-only user-facing strings (Pitfall 9)

**Source:** `ExportToPDA.pushbutton/script.py` line 474 explicit comment about `ensure_ascii=True`.

IronPython 2.7 has fragile Unicode handling. All TaskDialog `MainInstruction` / `MainContent` and Output Window text MUST be ASCII. Use `--` not `—`. Use `'` not curly quotes.

**Apply to:** Every string literal that reaches a TaskDialog or `output.print_*` call in `script.py`.

### Anti-pattern: module globals for session state

**Source:** RESEARCH.md Pitfall 6 (lines 398-403) + `ExportToPDA.pushbutton/script.py` lines 76-88 demonstrate the correct workaround.

pyRevit re-imports the script on every click — module-level dicts/lists do NOT persist across clicks. Phase 7 does NOT need session state per CONTEXT.md, so this anti-pattern is unlikely to bite. If it ever does, use `script.set_envvar` / `script.get_envvar` (verified Phase 5 pattern).

### Anti-pattern: extending `lib/Snippets/_selection_func.py`

**Source:** D-15 (CONTEXT.md) + RESEARCH.md anti-pattern line 301.

The existing snippet's `ISelectionFilter_Categories` class is missing `AllowReference` (Pitfall 4). Phase 7 inlines a corrected filter class in `script.py` rather than fixing the snippet. Phase 8 (per its existing spec) will introduce `_pda_export_common.py` when actual sharing materializes.

**Apply to:** Plan 7-01 must NOT modify any file under `lib/Snippets/`.

## No Analog Found

| File | Role | Data Flow | Reason | Planner action |
|------|------|-----------|--------|----------------|
| `fixtures/phase07/phase07_minimal_frame.rvt` | test fixture (binary) | manual UAT input | No prior `.rvt` fixtures in sibling repo | Plan 7-03 task: engineer authors on Mac, commits binary; commit message documents fixture content |
| `fixtures/phase07/phase07_multi_storey.rvt` | test fixture (binary) | manual UAT input | Same | Same |
| `fixtures/phase07/phase07_pre_converted.rvt` | test fixture (binary) | manual UAT input | Same | Same — engineer pre-runs conversion in Revit then saves |
| `fixtures/phase07/UAT_RUNBOOK.md` | docs | static markdown | No prior UAT runbook in sibling repo | Plan 7-03 task: engineer authors runbook covering load → click → expected-counts for each fixture, plus D-13 Phase 5 round-trip step |

These four files are intentionally engineer-manual-authored. The planner should NOT generate placeholder content for them; instead, Plan 7-03 should call out fixture authoring as a discrete task with acceptance criteria (e.g., "fixture loads in Revit 2025 without warnings", "minimal frame has exactly 4 columns + 2 beams + 1 brace", "pre-converted fixture has 7 AnalyticalMembers with associations already in place").

## Cross-Plan Pattern Distribution (for the planner)

| Plan | Files in scope | Patterns to drop in |
|------|----------------|---------------------|
| **Plan 7-01: Bundle + Selection + Category Filter** | `bundle.yaml`, `script.py` skeleton with sections A, C, D, F, G, H | A (header), C (imports), D (Revit globals), F (`_SupportedCategoryFilter`), G (`_resolve_input`), H (`SUPPORTED_CATEGORIES` registry). Empty `main()` with TaskDialog placeholder. |
| **Plan 7-02: Conversion + Idempotency + Transactions** | `script.py` extended with sections I, J, K, L, N | I (TransactionGroup wrapper / `run_batch`), J (`_is_already_associated`), K (`_derive_curve`, `_convert_one`), L (`_verify_section_and_material`), N (real `main()`). |
| **Plan 7-03: Diagnostics + UAT + Windows Deploy** | `script.py` extended with section M; `icon.png`; 3 `.rvt` fixtures; `UAT_RUNBOOK.md` | M (`_emit_summary`). Engineer-authored binary assets. Manual-copy deploy verification step on Windows host (RESEARCH.md Pitfall 7 — stale bundle). |

## Metadata

**Analog search scope:**
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/` (5 existing pushbuttons; 2 carry full implementations, 3 are empty scaffolds)
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/` (read-only reference per D-15)

**Files scanned (full read):**
- `ExportToPDA.pushbutton/bundle.yaml` (3 lines)
- `ExportToPDA.pushbutton/script.py` (489 lines)
- `ExportToPDA_Truss.pushbutton/script.py` (470 lines, clone of frame variant — confirms pattern stability)
- `lib/Snippets/_selection_func.py` (47 lines)

**Empty scaffolds NOT scanned (per RESEARCH.md line 177-179):**
- `Loads.pushbutton/`, `StructuralAnalyticalModel.pushbutton/`, `Supports.pushbutton/` — placeholders only.

**Pattern extraction date:** 2026-04-29
**Phase:** 07-revit-element-to-analytical-conversion
**Source decisions:** CONTEXT.md D-01 through D-15 (with D-11 reversed 2026-04-29); RESEARCH.md Critical Finding, Patterns 1-9, Pitfalls 1-10, Code Examples 1-4.

---

## PATTERN MAPPING COMPLETE
