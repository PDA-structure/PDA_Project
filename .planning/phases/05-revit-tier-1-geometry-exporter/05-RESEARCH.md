# Phase 5: Revit Tier 1 — Geometry Exporter - Research

**Researched:** 2026-04-20
**Domain:** pyRevit pushbutton (IronPython 2.7) emitting Phase 3 canonical JSON
**Confidence:** HIGH

## Summary

The exporter is a single pyRevit pushbutton that scopes to **detail lines in the active drafting view**, converts their endpoints from Revit internal units (feet) to metres, merges coincident endpoints within 1 mm, splits any line whose mid-span is touched by another line's endpoint, and writes a JSON file that the frame2d browser UI's Load handler can consume directly. Every technical piece — Revit API calls, pyRevit bundle layout, helper functions to reuse, JSON shape — is already concretely defined; there is almost no ambiguity left for the planner to resolve.

Two design points need sharp attention in the plan:
1. **The frame2d Load handler reads geometry exclusively from `canvas.nodes` and `canvas.members`** (not from the top-level `nodes`/`members` arrays). The exporter must emit a complete, UI-shaped `canvas` block — origin, node objects with `{id, x, y, realX, realY}`, member objects with `{id, start, end, type, pinLeft, pinRight, udl, udl_x, *_override}` — or the UI will appear to load and then show an empty canvas.
2. **The button's success criterion is "it opens in frame2d and solves after the user adds supports"**, not "the top-level solve payload is valid on its own." The top-level payload is a defensive courtesy (so `curl -X POST /solve/frame2d @file.json` doesn't 500), but the LoadHandler's canvas round-trip is the primary contract.

**Primary recommendation:** Implement a single `script.py` in `ExportToPDA.pushbutton/` that (1) guards on active view type, (2) shows the once-per-session 2D-only TaskDialog with `VerificationText` checkbox, (3) collects straight `DetailLine` elements (optionally filtered by current selection), (4) runs the endpoint-merge + T-junction split pipeline in pure Python, (5) sorts nodes lexicographically by (x, y), (6) emits canonical JSON via a single-pass serializer that fills both the flat solve payload AND the `canvas` round-trip block, (7) writes the file via `FileSaveDialog` pre-populated with `{ViewName}_pda.json`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Detail-line filtering (A1)**
- **D-01:** Export detail lines only — straight `DetailLine` elements in the active drafting view. Arcs, splines, ellipses, and other `CurveElement` subtypes are silently skipped.
- **D-02:** Accept all line styles — no line-style filter in Tier 1.
- **D-03:** Selection overrides — if the user has detail lines pre-selected in the active drafting view, export only those. Otherwise export every detail line in the view.
- **D-04:** Empty-view handling — TaskDialog warning ("No detail lines found in active drafting view — draw some first.") and do not write a file.

**Node merging & T-junctions (A2)**
- **D-05:** Split at T-junctions. If line A's endpoint falls within 1 mm of line B's mid-span (not at B's endpoints), split B into two members sharing the new interior node.
- **D-06:** Warn on mid-span crossings (no split). If lines A and B cross at an interior point of both, leave both unsplit and list the crossing in post-export warnings.
- **D-07:** Tolerance hard-coded at 1 mm. Expose as module-level constant `TOLERANCE_M = 0.001`.
- **D-08:** Node numbering: sorted by (x, y) ascending — node 1 is the bottom-left-most point.

**Default properties + units (A3)**
- **D-09:** Default `E = 200e9` (Pa), `I = 1e-4` (m⁴), `A = 0.01` (m²) — match frame2d UI prefill.
- **D-10:** Uniform defaults, no per-member mapping. Users tune per-member in the frame2d UI.
- **D-11:** Coordinate system: Revit internal XY of the detail-line endpoints, converted from feet to metres. Z is always dropped.
- **D-12:** Length units: always metres via `UnitUtils.ConvertFromInternalUnits(value, UnitTypeId.Meters)`. Reuse the `convert_internal_units()` helper at `lib/Snippets/_units_conversion.py`. Coordinates rounded to 4 decimal places. Revit's active project unit setting is ignored.

**Output UX + error flow (A4)**
- **D-13:** Save-As dialog for output destination. `FileSaveDialog` pre-populated with default filename `<ActiveViewName>_pda.json` (sanitise spaces/slashes).
- **D-14:** Success feedback: TaskDialog with counts + full path. "Exported N nodes, M members to `<full path>`." Single OK button.
- **D-15:** Pre-run validation fail-fast order: (1) active view must be `ViewDrafting`; (2) at least one detail line must be in scope; (3) Z is implicit (planar, no runtime guard).
- **D-16:** "2D TRUSSES AND 2D FRAMES ONLY" warning — pre-run, once-per-session. TaskDialog with "Don't show again this session" checkbox. Persistence: session-scoped module-level flag.

### Claude's Discretion
- Pushbutton directory name — choose to fit `Analytical.panel/col1.stack/` naming. **Recommendation:** `ExportToPDA.pushbutton/` (verb-prefixed, like `Loads`, `Supports`, `StructuralAnalyticalModel`).
- Button icon — 32x32 PNG; match panel visual style.
- Script structure — single `script.py` is fine for MVP as long as it reuses `lib/Snippets/_units_conversion.py`.
- Exact TaskDialog wording — may use `forms.alert()` or raw `TaskDialog.Show()`. **Recommendation:** raw `TaskDialog` for D-16 (needs `VerificationText` checkbox which `forms.alert` does not expose); `forms.alert` or `TaskDialog.Show` for D-04 and D-14 (simpler dialogs).
- Zero-length lines — default to silent skip.

### Deferred Ideas (OUT OF SCOPE)
- Line-style → property mapping (Tier 2+, requires `config/line_style_properties.json`).
- Survey coordinate support (`PointConverter` available but not used in Tier 1).
- Arc decomposition (frame2d has no arc concept).
- Auto-launch frame2d browser UI after export.
- Prescribed settlement / Dirichlet BC (Phase 4 D-02 reminder; unrelated to Phase 5).
- Per-export tolerance prompt (hard-coded 1 mm is final for Tier 1).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVIT-T1-01 | pyRevit button exports detail lines from active drafting view as canonical PDA JSON | Exact JSON contract + pyRevit bundle skeleton in §JSON Contract and §Pushbutton Skeleton |
| REVIT-T1-02 | Button shows "2D TRUSSES AND 2D FRAMES ONLY" warning before running and refuses unless active view is drafting | TaskDialog + VerificationText pattern in §Revit API Reference; `ViewDrafting` isinstance check in same section |
| REVIT-T1-03 | Endpoint coordinates within 1mm merged into a single node | Endpoint-merge algorithm in §Algorithms |
| REVIT-T1-04 | Coordinates converted feet→metres (×0.3048) rounded to 4 decimals; Z dropped | `convert_internal_units` reuse from `lib/Snippets/_units_conversion.py` in §Reuse Map; rounding applied at serialization |
| REVIT-T1-05 | Exported JSON loads in frame2d UI and solves after supports/loads added | Complete `canvas` block shape documented in §JSON Contract; Load handler behaviour analysed |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Autodesk.Revit.DB | 2023–2025 | Revit document/element API | Only way to query detail lines in the active doc [VERIFIED: sibling repo uses it everywhere] |
| Autodesk.Revit.UI | 2023–2025 | TaskDialog, FileSaveDialog | Only officially supported dialog APIs inside Revit [VERIFIED: revitapidocs.com/2024/FileSaveDialog] |
| pyRevit | 4.8+ (IronPython 2.7.12 engine) | Pushbutton host + `forms`/`script` helpers | Extension already exists; existing buttons use it [VERIFIED: sibling repo layout] |
| Python stdlib `json` | IronPython 2.7 built-in | JSON serialization | No external dep; supported in IronPython 2.7 [VERIFIED: IronPython 2.7 docs include `json` module] |
| Python stdlib `os`, `re` | IronPython 2.7 built-in | Path handling, filename sanitisation | No external dep |

### Supporting

| Function | Location | Purpose |
|----------|----------|---------|
| `convert_internal_units(value, get_internal=False, units='m')` | `lib/Snippets/_units_conversion.py` | Feet↔metres conversion with Revit 2021+/pre-2021 branching |
| `get_selected_elements([DetailLine])` | `lib/Snippets/_selection_func.py` | Read current selection for D-03 override |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `FileSaveDialog` (Revit API) | `pyrevit.forms.save_file(file_ext='json')` | pyRevit wrapper is simpler (legacy exporter already uses it) but the raw API gives exact control over the default filename and the title bar text. **Recommendation:** use pyRevit `forms.save_file` — already proven in `pyrevit_exporters/export_to_pda.py` and more idiomatic for this codebase. |
| `TaskDialog` (raw API) | `pyrevit.forms.alert()` | `forms.alert` doesn't expose `VerificationText` / `WasVerificationChecked` (verified against pyRevit source). For D-16's "don't show again" checkbox, raw `TaskDialog` is required. For D-04 and D-14 (simple alerts), `forms.alert` is cleaner. |
| Manual coincident-point comparison | Revit `XYZ.IsAlmostEqualTo(other, tolerance)` | `IsAlmostEqualTo` operates in internal units (feet), so the tolerance would need to be `0.001 / 0.3048 ≈ 0.00328 ft`. **Recommendation:** do the comparison in metres after conversion — keeps tolerance semantics crystal clear and matches D-07's wording. |
| `json.dump(obj, fp, indent=2)` | Manual string assembly | `json.dump` works fine in IronPython 2.7 [VERIFIED: IronPython 2.7 docs]. Use `ensure_ascii=True` (default) to avoid Unicode write-to-file edge cases. |

**No new dependencies** — everything needed is already present in the sibling repo or in IronPython 2.7's stdlib.

**Version verification:**
- Target Revit versions **2023, 2024, 2025** — all three use the same `UnitTypeId.Meters` constant [VERIFIED: revitapidocs.com/2025/UnitTypeId members page] and the same `FileSaveDialog` API [VERIFIED: revitapidocs.com/2024/FileSaveDialog class]. No version-specific branching needed for this phase.
- `UnitTypeId` is **not deprecated** in 2024 or 2025 — the ForgeTypeId migration (affecting `ParameterType`, `BuiltInParameterGroup`) is a separate story [VERIFIED: revitapidocs.com/2025/news]. `DisplayUnitType` pre-2021 fallback in `_units_conversion.py` is already there but will never be exercised on 2023+.

## JSON Contract (the single most important section)

### How the frame2d Load handler actually reads the file

From `ui/frame2d/script.js` lines 1549–1645 (read during research):

1. **Required top-level keys for acceptance:** `schema_version`, `solver`, `nodes`, `members`. If any are missing, alert "File is missing required data." and abort.
2. **Solver gate:** `data.solver` must equal the string `"frame2d"`. `"frame_v2"` is accepted at the API layer but **the UI's Load handler rejects it.** [VERIFIED: script.js line 1554] → **Exporter MUST emit `"solver": "frame2d"`.**
3. **Canvas state is restored FROM `data.canvas.*`, not from the top-level arrays.** Specifically:
   - `origin = data.canvas.origin` (object `{x, y}` in canvas pixels, or `null`)
   - `nodes = data.canvas.nodes` (array of `{id, x, y, realX, realY}` objects)
   - `members = data.canvas.members` (array of `{id, start, end, type, pinLeft, pinRight, udl, udl_x, E_override, I_override, A_override}` objects)
   - `supports = Object.entries(data.canvas.supports)` (object keyed by stringified nodeId; empty object `{}` is valid)
   - `nodeLoads = data.canvas.nodeLoads` (array, empty is valid)
   - `udl = data.canvas.udl` (array, empty is valid)
   - `memberOverrides = data.canvas.memberOverrides` (object, empty is valid)
4. **After load, `nodes.forEach(syncPixelFromReal)` recomputes pixel `x, y` from `realX, realY` + `origin`.** So pixel coordinates in `canvas.nodes` are not strictly required for correctness — but `origin`, `realX`, `realY`, and `id` ARE required. **Recommendation:** emit valid pixel coordinates anyway (cheap, avoids silent off-by-zero surprises if `origin` is null).
5. **If `origin` is null and `syncPixelFromReal` runs**, it early-returns doing nothing → nodes render at whatever `x, y` the file provided. If the file provided `x: 0, y: 0` for every node, the canvas is unusable. → **Exporter MUST emit a non-null `origin`.** Suggested value: pixel `{x: 100, y: 400}` (matches `sample_pda_frame2d.json`), which places the (0, 0) real-world node at canvas pixel (100, 400).
6. **The top-level flat arrays (`nodes`, `members`, `ENForces`, etc.) are NOT read on load** — only validated for existence. They exist to let the file POST directly to `/solve/frame2d`. [VERIFIED: no reference to `data.nodes` after the `if (!data.schema_version ...)` guard in the Load handler.]
7. **File input is reset after load** (`e.target.value = ''`) so the same file can be reloaded.

### The exact JSON the exporter must emit

```json
{
  "schema_version": "1.0",
  "solver": "frame2d",

  "nodes": [[x_m, y_m], ...],
  "members": [[i_1based, j_1based], ...],
  "ENForces": [[0, 0], [0, 0], ...],
  "ENMoments": [[0, 0], [0, 0], ...],
  "forceVector": [0, 0, 0, ...],
  "E": 200000000000.0,
  "I": 0.0001,
  "A": 0.01,
  "bars": [],
  "beamPinLeft": [],
  "beamPinRight": [],
  "restrainedDoF": [],
  "pinDoF": [],
  "springDoF": [],
  "springStiffness": [],
  "udl_x": [0, 0, ...],

  "canvas": {
    "origin": {"x": 100, "y": 400},
    "nodes": [
      {"id": 0, "x": <px>, "y": <py>, "realX": x_m, "realY": y_m},
      ...
    ],
    "members": [
      {
        "id": 0,
        "start": 0,
        "end": 1,
        "type": "beam",
        "pinLeft": false,
        "pinRight": false,
        "udl": null,
        "udl_x": null,
        "E_override": null,
        "I_override": null,
        "A_override": null
      },
      ...
    ],
    "supports": {},
    "nodeLoads": [],
    "udl": [],
    "memberOverrides": {}
  }
}
```

### Field-by-field spec

| Field | Type | Value for Tier 1 | Source |
|-------|------|------------------|--------|
| `schema_version` | string | `"1.0"` | Phase 3 D-03 |
| `solver` | string | `"frame2d"` | Phase 3 D-03; UI Load gate (script.js:1554) |
| `nodes` | `List[List[float]]` | `[[x_m, y_m], ...]` one per merged+sorted node, 4-dp rounded | Frame2DRequest; D-08 ordering |
| `members` | `List[List[int]]` | `[[i+1, j+1], ...]` 1-based node indices | Frame2DRequest + FrameModel2D convention |
| `ENForces` | `List[List[float]]` | `[[0, 0]] * n_members` | No loads in Tier 1 |
| `ENMoments` | `List[List[float]]` | `[[0, 0]] * n_members` | No loads in Tier 1 |
| `forceVector` | `List[float]` | `[0] * (3 * n_nodes)` | 3 DOF per node; CLAUDE.md frame conventions |
| `E` | `float` | `200e9` | D-09 |
| `I` | `float` | `1e-4` | D-09 |
| `A` | `float` | `0.01` | D-09 |
| `bars` | `List[int]` | `[]` | No bar members in Tier 1 (all beams) |
| `beamPinLeft` | `List[int]` | `[]` | No pin releases in Tier 1 |
| `beamPinRight` | `List[int]` | `[]` | No pin releases in Tier 1 |
| `restrainedDoF` | `List[int]` | `[]` | No supports in Tier 1 (user adds in UI) |
| `pinDoF` | `List[int]` | `[]` | No supports in Tier 1 |
| `springDoF` | `List[int]` | `[]` | No springs in Tier 1 |
| `springStiffness` | `List[float]` | `[]` | No springs in Tier 1 |
| `udl_x` | `List[float]` | `[0] * n_members` | No loads in Tier 1 (but field is required by `/solve/frame2d`; app.py line 74) |
| `canvas.origin` | `{x, y}` | `{"x": 100, "y": 400}` | Must be non-null for `syncPixelFromReal` |
| `canvas.nodes[i]` | object | see below | UI state object shape (script.js:62 comment) |
| `canvas.members[i]` | object | see below | UI state object shape (script.js:63 comment) |
| `canvas.supports` | object | `{}` | No supports in Tier 1 |
| `canvas.nodeLoads` | `List[object]` | `[]` | No loads in Tier 1 |
| `canvas.udl` | `List[object]` | `[]` | No UDLs in Tier 1 |
| `canvas.memberOverrides` | object | `{}` | No per-member overrides in Tier 1 |

**`canvas.nodes[i]` shape (exact keys required by UI):**
```json
{"id": 0, "x": 100, "y": 400, "realX": 0.0, "realY": 0.0}
```
- `id` — 0-based, must match order the node appears in the array
- `x`, `y` — canvas pixels; computed as `x = origin.x + realX * GRID` and `y = origin.y - realY * GRID` (GRID = 20). Stable enough — the UI re-syncs from `realX/realY` on load, but emitting valid values keeps the file diffable and usable without syncPixelFromReal.
- `realX`, `realY` — metres, 4-dp rounded, matching the flat `nodes` array

**`canvas.members[i]` shape (exact keys required by UI):**
```json
{
  "id": 0,
  "start": 0, "end": 1,
  "type": "beam",
  "pinLeft": false, "pinRight": false,
  "udl": null, "udl_x": null,
  "E_override": null, "I_override": null, "A_override": null
}
```
- `id` — 0-based, array position
- `start`, `end` — **0-based node ids** (NOT the 1-based member-list indices). Note the split with top-level `members` which is 1-based.
- `type` — always `"beam"` in Tier 1
- Remaining keys — nulls/false, tracking the UI's internal shape so round-trip is clean

### Coordinate precision

Every `realX`, `realY`, and the flat `nodes[i]` entries are rounded to 4 decimal places (REVIT-T1-04):
```python
x_m = round(convert_internal_units(xyz.X, get_internal=False, units='m'), 4)
y_m = round(convert_internal_units(xyz.Y, get_internal=False, units='m'), 4)
```

### Pixel coordinates for `canvas.nodes`

With `origin = {x: 100, y: 400}` and `GRID = 20`:
```python
px = 100 + realX * 20
py = 400 - realY * 20   # Note: Y axis is inverted in canvas
```

## Revit API Reference

### UnitUtils.ConvertFromInternalUnits

**Signature:** `UnitUtils.ConvertFromInternalUnits(value: double, unitTypeId: ForgeTypeId) -> double` [CITED: revitapidocs.com/2024/UnitUtils]

**Revit version availability:**
- 2021+: `UnitUtils.ConvertFromInternalUnits(value, UnitTypeId.Meters)` [VERIFIED: revitapidocs.com/2025/UnitTypeId class; unchanged across 2023, 2024, 2025]
- Pre-2021: `UnitUtils.ConvertFromInternalUnits(value, DisplayUnitType.DUT_METERS)` [VERIFIED: revitapidocs.com/2019/DisplayUnitType]

**Phase 5 target is Revit 2023+ so only the `UnitTypeId` path is exercised.** The existing `_units_conversion.py` helper branches on `rvt_year >= 2021`; the pre-2021 branch is dead code for us but harmless.

### FilteredElementCollector for DetailLine in active view

**Correct API pattern** (verified with the legacy exporter as a working baseline and cross-checked with revitapidocs/Dynamo Primer):

```python
from Autodesk.Revit.DB import (
    FilteredElementCollector, BuiltInCategory, DetailLine, Line, ViewDrafting
)

uidoc = __revit__.ActiveUIDocument
doc = uidoc.Document
active_view = uidoc.ActiveView

# Guard: must be a drafting view (D-15 step 1)
if not isinstance(active_view, ViewDrafting):
    # abort with TaskDialog
    ...

# View-scoped collector — second constructor arg limits scope to the view
collector = (FilteredElementCollector(doc, active_view.Id)
             .OfCategory(BuiltInCategory.OST_Lines)
             .WhereElementIsNotElementType()
             .ToElements())

# Filter to straight DetailLine with Line (not Arc/Spline) geometry
detail_lines = []
for el in collector:
    if not isinstance(el, DetailLine):
        continue
    curve = el.GeometryCurve
    if not isinstance(curve, Line):
        # D-01: silently skip arcs, splines, ellipses
        continue
    detail_lines.append(el)
```

**`BuiltInCategory.OST_Lines` is the correct category for `DetailLine` elements** [VERIFIED: legacy exporter uses `OfClass(AnalyticalMember)` but the DetailLine equivalent is `OfCategory(OST_Lines)` or `OfClass(CurveElement)` + `isinstance(el, DetailLine)` — both patterns are standard per revitapidocs/forums]. The narrower `OfClass(DetailLine)` is **not reliable** because DetailLine is a concrete subclass and collector `OfClass` needs the element's registered class which is often `CurveElement` in the API surface. The belt-and-braces approach is category filter + isinstance check.

**Alternative (also correct):** `FilteredElementCollector(doc, view.Id).OfClass(CurveElement).ToElements()` then filter by `isinstance(el, DetailLine) and isinstance(el.GeometryCurve, Line)`. [CITED: forums.autodesk.com Revit API DetailLine endpoint threads]

**Selection-override (D-03):**
```python
from Autodesk.Revit.DB import ElementId

selected_ids = uidoc.Selection.GetElementIds()
if selected_ids and len(selected_ids) > 0:
    source_elements = [doc.GetElement(eid) for eid in selected_ids]
    # Filter to straight DetailLines in the active view
    detail_lines = [
        el for el in source_elements
        if isinstance(el, DetailLine)
        and isinstance(el.GeometryCurve, Line)
        and el.OwnerViewId == active_view.Id
    ]
else:
    # Fall back to view-scoped collector (as above)
    ...
```

### DetailLine.GeometryCurve + GetEndPoint

```python
curve = detail_line.GeometryCurve   # -> Line (for straight lines)
p0 = curve.GetEndPoint(0)            # -> XYZ in feet (internal units)
p1 = curve.GetEndPoint(1)            # -> XYZ in feet
# p0.X, p0.Y, p0.Z are doubles in feet
```

`DetailLine` inheritance: `Element → CurveElement → DetailCurve → DetailLine` [VERIFIED: revitapidocs.com/2024/DetailLine]. `GeometryCurve` is inherited from `DetailCurve` and returns a bound `Curve`. For straight detail lines the concrete type is `Line`. `GetEndPoint(0)` and `GetEndPoint(1)` return `XYZ` objects.

### ViewDrafting detection

```python
from Autodesk.Revit.DB import ViewDrafting
if not isinstance(active_view, ViewDrafting):
    # Or alternatively: active_view.ViewType != ViewType.DraftingView
    abort_with_dialog(...)
```

Both `isinstance(view, ViewDrafting)` and `view.ViewType == ViewType.DraftingView` are valid [CITED: WebSearch + revitapidocs.com/2023/ViewType]. **Prefer `isinstance` — it's simpler and more readable in Python.**

### TaskDialog with VerificationText (D-16)

```python
from Autodesk.Revit.UI import (
    TaskDialog, TaskDialogCommonButtons, TaskDialogResult
)

td = TaskDialog("PDA Export")
td.MainInstruction = "2D Trusses and 2D Frames Only"
td.MainContent = ("This exports detail-line geometry only. Supports and loads must be "
                  "added in the frame2d browser UI after loading the JSON.")
td.CommonButtons = TaskDialogCommonButtons.Ok | TaskDialogCommonButtons.Cancel
td.DefaultButton = TaskDialogResult.Ok
td.VerificationText = "Don't show this message again this session"

result = td.Show()

if result != TaskDialogResult.Ok:
    return  # user cancelled

if td.WasVerificationChecked():
    # set module-level flag so subsequent clicks in this session skip the dialog
    _SHOW_2D_WARNING = False
```

[VERIFIED: gtalarico/revitapidocs.code `HowTo_CreateTaskDialog.py` and pyrevitlabs/pyRevit `rpw/ui/forms/taskdialog.py`. `WasVerificationChecked()` is a **method**, not a property — call it with parens.]

**Session-scoped persistence pattern for D-16:**

pyRevit reloads each script.py in its own fresh namespace on every button click, so a simple module-level flag `_SHOW_2D_WARNING = True` at the top of `script.py` does **NOT** persist across clicks. To achieve "once per session":

```python
# Persist the flag on the __revit__ application object, which lives for the Revit session.
import clr
app = __revit__.Application

if not hasattr(app, "_pda_export_warning_shown"):
    # First click this session — show the warning
    app._pda_export_warning_shown = False

if not app._pda_export_warning_shown:
    # ... show TaskDialog ...
    if td.WasVerificationChecked():
        app._pda_export_warning_shown = True
    # even if unchecked, we could still show again next click — user's choice
```

**Alternative:** use `pyrevit.script.get_document_data()` or a module-level attribute on `__revit__` — but attaching to `__revit__.Application` is the simplest pattern and survives as long as Revit is open. [ASSUMED: pyRevit re-executes script.py on each click — this is standard pyRevit behaviour but worth verifying in practice during execution.]

### FileSaveDialog (D-13)

**Recommendation:** use `pyrevit.forms.save_file(file_ext='json', default_name='<ViewName>_pda')` — already proven in the legacy exporter. If raw API is preferred:

```python
from Autodesk.Revit.UI import FileSaveDialog
from Autodesk.Revit.DB import ItemSelectionDialogResult

dlg = FileSaveDialog("JSON files (*.json)|*.json")
dlg.Title = "Export to PDA JSON"
dlg.InitialFileName = default_filename  # "<ViewName>_pda"
# Note: extension is typically auto-appended from the filter

if dlg.Show() == ItemSelectionDialogResult.Confirmed:
    model_path = dlg.GetSelectedModelPath()
    # Convert ModelPath to local string:
    from Autodesk.Revit.DB import ModelPathUtils
    save_path = ModelPathUtils.ConvertModelPathToUserVisiblePath(model_path)
else:
    return  # user cancelled
```

[VERIFIED: revitapidocs.com/2024/FileSaveDialog members page; namespace `Autodesk.Revit.UI`; inherited `Show()` method returns `ItemSelectionDialogResult`; `GetSelectedModelPath()` returns a `ModelPath`. The Filter string format is `"Label|*.ext"`.]

**pyRevit form wrapper is simpler — use it unless you need exact FileSaveDialog control:**
```python
from pyrevit import forms
save_path = forms.save_file(
    file_ext='json',
    default_name='{0}_pda'.format(sanitised_view_name),
)
if not save_path:
    return  # user cancelled
```

### Success TaskDialog (D-14)

```python
from Autodesk.Revit.UI import TaskDialog

msg = "Exported {0} nodes, {1} members to:\n{2}".format(n_nodes, n_members, save_path)
TaskDialog.Show("PDA Export Complete", msg)
```

Or via pyRevit:
```python
from pyrevit import forms
forms.alert(
    msg="Exported {0} nodes, {1} members.".format(n_nodes, n_members),
    sub_msg=save_path,
    title="PDA Export Complete",
)
```

## pyRevit Pushbutton Skeleton

### Bundle layout

```
PDA_customRevit.extension/
└── PDA_Tools.tab/
    └── Analytical.panel/
        └── col1.stack/
            ├── Loads.pushbutton/             (exists, stub)
            ├── Supports.pushbutton/          (exists, stub)
            ├── StructuralAnalyticalModel.pushbutton/  (exists, stub)
            └── ExportToPDA.pushbutton/       (NEW — this phase)
                ├── script.py                 (~200 lines)
                ├── icon.png                  (32x32 PNG, copy+recolor an existing one)
                └── bundle.yaml               (optional — title, tooltip, author)
```

**Naming note:** existing buttons use single-noun folder names (`Loads`, `Supports`). To stay consistent, `ExportToPDA.pushbutton` fits. Alternative `GeometryExport.pushbutton` is slightly more descriptive but less aligned with the existing panel.

### bundle.yaml (optional but recommended)

```yaml
title: Export to PDA
tooltip: "Export detail-line geometry from the active drafting view as canonical PDA JSON (frame2d)."
author: "paulo@pda-structure.co.uk"
```

[CITED: pyrevit Bundle Metadata docs — keys `title`, `tooltip`, `author`, `help_url`, `min_revit_version` are all supported.]

### script.py top-level structure

```python
# -*- coding: utf-8 -*-
"""
PDA Analysis Software — Tier 1 Geometry Exporter

Exports straight DetailLine elements from the active drafting view as canonical
PDA JSON (schema_version 1.0, solver "frame2d"). Merges coincident endpoints
within 1mm, splits at T-junctions, warns on mid-span crossings.

Phase 5. See .planning/phases/05-revit-tier-1-geometry-exporter/ for context.
"""
import os
import re
import json

from Autodesk.Revit.DB import (
    FilteredElementCollector, BuiltInCategory,
    DetailLine, Line, ViewDrafting, XYZ,
)
from Autodesk.Revit.UI import (
    TaskDialog, TaskDialogCommonButtons, TaskDialogResult,
)
from pyrevit import forms

# Reuse from extension lib
import sys
# Snippets dir is added to sys.path automatically by pyRevit — but if not:
# sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'lib', 'Snippets'))
from _units_conversion import convert_internal_units  # type: ignore

# ─────────────────────────────────────────────────────────────────────────────
# Constants
TOLERANCE_M = 0.001        # D-07: 1mm merge/split tolerance in METRES
GRID_PX = 20               # UI GRID constant — matches ui/frame2d/script.js
ORIGIN_PX = {"x": 100, "y": 400}  # default canvas origin
DEFAULT_E = 200e9
DEFAULT_I = 1e-4
DEFAULT_A = 0.01

# ─────────────────────────────────────────────────────────────────────────────
# Revit globals
doc = __revit__.ActiveUIDocument.Document
uidoc = __revit__.ActiveUIDocument
app = __revit__.Application

# ─────────────────────────────────────────────────────────────────────────────
# Main flow
def main():
    # D-15 step 1: active view is ViewDrafting
    view = uidoc.ActiveView
    if not isinstance(view, ViewDrafting):
        TaskDialog.Show(
            "PDA Export",
            "Active view must be a drafting view (found: {0}).".format(type(view).__name__)
        )
        return

    # D-16: once-per-session 2D-only warning
    if not _warning_already_shown_this_session():
        if not _show_2d_only_warning():
            return  # user cancelled

    # Collect detail lines (D-01, D-02, D-03)
    detail_lines = _collect_detail_lines(view)
    if not detail_lines:
        TaskDialog.Show(
            "PDA Export",
            "No detail lines found in active drafting view — draw some first."
        )
        return

    # Convert to endpoint pairs in metres
    segments = _extract_segments(detail_lines)
    if not segments:
        # Every line was an arc/spline/zero-length — same message as D-04
        TaskDialog.Show("PDA Export", "No straight detail lines found.")
        return

    # Merge coincident endpoints + split at T-junctions + detect crossings
    nodes_m, members_pairs, crossings = _merge_and_split(segments)

    # Sort nodes by (x, y) ascending (D-08) and remap member indices
    nodes_m, members_pairs = _sort_nodes_lexicographic(nodes_m, members_pairs)

    # Build JSON
    payload = _build_json(nodes_m, members_pairs)

    # D-13: save file
    default_name = _sanitise_filename(view.Name) + "_pda"
    save_path = forms.save_file(file_ext='json', default_name=default_name)
    if not save_path:
        return

    with open(save_path, 'w') as f:
        json.dump(payload, f, indent=2)

    # D-14: success dialog (mention crossings if any)
    success_msg = "Exported {0} nodes, {1} members to:\n{2}".format(
        len(nodes_m), len(members_pairs), save_path
    )
    if crossings:
        success_msg += "\n\nWarning: {0} mid-span crossing(s) detected and NOT split.".format(len(crossings))
    TaskDialog.Show("PDA Export Complete", success_msg)


if __name__ == "__main__":
    main()
```

Helper functions (to be implemented — sketched in §Algorithms below):
`_warning_already_shown_this_session`, `_show_2d_only_warning`, `_collect_detail_lines`,
`_extract_segments`, `_merge_and_split`, `_sort_nodes_lexicographic`,
`_build_json`, `_sanitise_filename`.

## Algorithms

### Endpoint-merge (node deduplication, D-07, REVIT-T1-03)

```python
def _get_or_add_node(pt_m, nodes_m, tol=TOLERANCE_M):
    """Return 0-based index of an existing node within tol metres, or append."""
    for i, n in enumerate(nodes_m):
        if abs(n[0] - pt_m[0]) < tol and abs(n[1] - pt_m[1]) < tol:
            return i
    nodes_m.append([round(pt_m[0], 4), round(pt_m[1], 4)])
    return len(nodes_m) - 1
```

**Complexity:** O(n²) for n endpoints. At Tier 1 scale (~dozens to low-hundreds of detail lines) this is trivial. For scale: if `len(segments) > 500`, consider a spatial hash — bucket nodes by `(int(x/tol), int(y/tol))` and only search within the bucket + 8 neighbours. **Do not pre-optimise.** Flag only if performance becomes a pain.

**Tolerance semantics:** two nodes merge if BOTH `|dx| < 1mm` AND `|dy| < 1mm` (Chebyshev / L∞ distance). This matches REVIT-T1-03 literally ("within 1mm tolerance") and is simpler than Euclidean. Consistent with the legacy exporter.

**Zero-length line handling:** at the extract-segments stage, check `|p1 - p0| < tol` and silently skip. Prevents degenerate members with two coincident node ids. [Claude's Discretion: silent skip, per CONTEXT.]

### Extract segments (feet → metres)

```python
def _extract_segments(detail_lines):
    """Return list of ((x0_m, y0_m), (x1_m, y1_m)) tuples in metres, 4-dp rounded."""
    segs = []
    for el in detail_lines:
        curve = el.GeometryCurve
        if not isinstance(curve, Line):
            continue  # D-01: skip arcs, splines
        p0 = curve.GetEndPoint(0)
        p1 = curve.GetEndPoint(1)
        x0 = round(convert_internal_units(p0.X, get_internal=False, units='m'), 4)
        y0 = round(convert_internal_units(p0.Y, get_internal=False, units='m'), 4)
        x1 = round(convert_internal_units(p1.X, get_internal=False, units='m'), 4)
        y1 = round(convert_internal_units(p1.Y, get_internal=False, units='m'), 4)
        # Zero-length check
        if abs(x1 - x0) < TOLERANCE_M and abs(y1 - y0) < TOLERANCE_M:
            continue
        segs.append(((x0, y0), (x1, y1)))
    return segs
```

### T-junction split (D-05) + mid-span crossing detection (D-06)

Algorithm in plain words:

1. Build initial `nodes_m` and `members_pairs` (as 0-based node indices into `nodes_m`) by running `_get_or_add_node` on every endpoint of every segment.
2. For each node `p` in `nodes_m` (= endpoints only at this stage):
3.   For each member `(i, j)` in `members_pairs`:
4.     If `p` IS `i` or `p` IS `j` → skip (endpoint of this member)
5.     Compute point-to-segment distance from `p_coords` to segment `(nodes_m[i], nodes_m[j])`, **including the bounds check** that the perpendicular foot lies within `[0, 1]` parametrically (i.e. not past either end)
6.     If distance < TOLERANCE_M AND foot is strictly inside (not at either end within tol) → **split this member** into two new members: `(i, p)` and `(p, j)`; remove the old `(i, j)` from `members_pairs`. Restart the inner loop since `members_pairs` changed.
7. After no more splits happen:
8. **Detect mid-span crossings (D-06):** iterate over all pairs of members `(a, b)`. If the 2D lines cross at an interior point of both segments (parametric `t_a, t_b` both strictly in `(0, 1)` with an interior tolerance), and neither endpoint of a is within TOL of b (and vice versa), record `(a, b, crossing_point)` in `crossings`. Do not split.

**Point-to-segment distance with parametric foot check (IronPython 2.7):**

```python
def _point_on_segment_interior(p, a, b, tol):
    """
    Returns True if p is within tol of the segment from a to b AND
    the foot of perpendicular is strictly inside the segment (not at an endpoint).
    p, a, b are (x, y) tuples. All in metres.
    """
    ax, ay = a
    bx, by = b
    px, py = p
    dx = bx - ax
    dy = by - ay
    seg_len2 = dx * dx + dy * dy
    if seg_len2 < tol * tol:
        return False  # degenerate segment
    # Parametric foot: t = ((p-a) . (b-a)) / |b-a|²
    t = ((px - ax) * dx + (py - ay) * dy) / seg_len2
    # Strict interior check with tol in PARAMETRIC units
    # foot-is-at-endpoint threshold: tol / seg_len
    import math
    seg_len = math.sqrt(seg_len2)
    t_tol = tol / seg_len
    if t <= t_tol or t >= 1.0 - t_tol:
        return False  # foot is at or past an endpoint — that's just connectivity, not a T
    # Perpendicular distance
    foot_x = ax + t * dx
    foot_y = ay + t * dy
    dist = math.sqrt((px - foot_x) ** 2 + (py - foot_y) ** 2)
    return dist < tol
```

**Segment-segment interior intersection for D-06:** standard parametric solution.
```python
def _segments_cross_interior(a0, a1, b0, b1, tol):
    """
    Returns the (x, y) intersection point if segments cross at an interior point
    of BOTH (i.e. both parametric coords strictly in (tol_t, 1-tol_t)), else None.
    """
    import math
    ax0, ay0 = a0; ax1, ay1 = a1
    bx0, by0 = b0; bx1, by1 = b1
    dax, day = ax1 - ax0, ay1 - ay0
    dbx, dby = bx1 - bx0, by1 - by0
    denom = dax * dby - day * dbx
    if abs(denom) < 1e-12:
        return None  # parallel or colinear — not our concern for D-06
    t = ((bx0 - ax0) * dby - (by0 - ay0) * dbx) / denom
    s = ((bx0 - ax0) * day - (by0 - ay0) * dax) / denom
    # Strict interior check on both sides
    len_a = math.sqrt(dax * dax + day * day)
    len_b = math.sqrt(dbx * dbx + dby * dby)
    tol_t_a = tol / len_a
    tol_t_b = tol / len_b
    if t <= tol_t_a or t >= 1.0 - tol_t_a:
        return None
    if s <= tol_t_b or s >= 1.0 - tol_t_b:
        return None
    return (ax0 + t * dax, ay0 + t * day)
```

### Lexicographic node sort (D-08)

```python
def _sort_nodes_lexicographic(nodes_m, members_pairs):
    """Sort nodes by (x, y) ascending and remap member indices accordingly."""
    # Build an index permutation based on (x, y) sort
    indexed = list(enumerate(nodes_m))  # [(old_idx, [x, y]), ...]
    indexed.sort(key=lambda pair: (pair[1][0], pair[1][1]))
    # old_idx -> new_idx map
    old_to_new = {}
    new_nodes = []
    for new_idx, (old_idx, coords) in enumerate(indexed):
        old_to_new[old_idx] = new_idx
        new_nodes.append(coords)
    new_members = [[old_to_new[i], old_to_new[j]] for i, j in members_pairs]
    return new_nodes, new_members
```

**Note:** Python 2.7 sort on a list of `[x, y]` lists works naturally lexicographically on floats (no custom key needed), but using the explicit key is clearer and future-proof if nodes become objects.

### JSON build

```python
def _build_json(nodes_m, members_pairs_0based):
    n_nodes = len(nodes_m)
    n_members = len(members_pairs_0based)

    # Build canvas.nodes
    canvas_nodes = []
    for i, (rx, ry) in enumerate(nodes_m):
        canvas_nodes.append({
            "id": i,
            "x": ORIGIN_PX["x"] + rx * GRID_PX,
            "y": ORIGIN_PX["y"] - ry * GRID_PX,
            "realX": rx,
            "realY": ry,
        })

    # Build canvas.members (0-based start/end)
    canvas_members = []
    for i, (s, e) in enumerate(members_pairs_0based):
        canvas_members.append({
            "id": i,
            "start": s, "end": e,
            "type": "beam",
            "pinLeft": False, "pinRight": False,
            "udl": None, "udl_x": None,
            "E_override": None, "I_override": None, "A_override": None,
        })

    return {
        "schema_version": "1.0",
        "solver": "frame2d",
        "nodes": nodes_m,
        "members": [[s + 1, e + 1] for s, e in members_pairs_0based],  # 1-based
        "ENForces": [[0, 0] for _ in range(n_members)],
        "ENMoments": [[0, 0] for _ in range(n_members)],
        "forceVector": [0] * (n_nodes * 3),
        "E": DEFAULT_E,
        "I": DEFAULT_I,
        "A": DEFAULT_A,
        "bars": [],
        "beamPinLeft": [],
        "beamPinRight": [],
        "restrainedDoF": [],
        "pinDoF": [],
        "springDoF": [],
        "springStiffness": [],
        "udl_x": [0] * n_members,
        "canvas": {
            "origin": ORIGIN_PX,
            "nodes": canvas_nodes,
            "members": canvas_members,
            "supports": {},
            "nodeLoads": [],
            "udl": [],
            "memberOverrides": {},
        },
    }
```

### Filename sanitisation

```python
def _sanitise_filename(name):
    """Strip/replace filesystem-unsafe chars in view name."""
    # Replace spaces, slashes, colons, etc.
    return re.sub(r'[\\/:*?"<>|\s]+', '_', name).strip('_') or 'view'
```

## Reuse Map

| What we need | Function / location | Signature | Notes |
|--------------|---------------------|-----------|-------|
| Feet → metres conversion | `lib/Snippets/_units_conversion.py::convert_internal_units` | `(value: float, get_internal=True, units='m') -> float` | Pass `get_internal=False` to convert FROM feet TO metres. Branches on `rvt_year >= 2021` internally so Revit 2023+ will always use `UnitTypeId.Meters`. |
| Current selection | `lib/Snippets/_selection_func.py::get_selected_elements` | `([type, ...]) -> [Element]` | Pass `[DetailLine]` as filter. Returns `[]` if nothing selected — caller falls back to view-scoped collector. |
| pyRevit save-file dialog | `pyrevit.forms.save_file` | `(file_ext='', default_name='', init_dir='', ...) -> str or None` | Returns the selected path or `None` if cancelled. Simpler than raw `FileSaveDialog`. |
| pyRevit basic alert | `pyrevit.forms.alert` | `(msg, title=None, sub_msg=None, ok=True, cancel=False, ...) -> bool` | Cleaner for D-04 (no detail lines) and D-14 (success). |
| Raw TaskDialog + checkbox | `Autodesk.Revit.UI.TaskDialog` | instance-based; see §Revit API Reference | Required for D-16 (VerificationText / WasVerificationChecked). `forms.alert` does not expose the checkbox. |

**DO NOT reuse** `lib/Snippets/_CoordinateConverterClass.py::PointConverter` — it's for survey/project coordinate transforms, which D-11 explicitly excludes from Tier 1.

**DO NOT copy from** `pda_project/pyrevit_exporters/export_to_pda.py` — it's the Phase 6 retirement target, lives in the wrong repo, and operates on `AnalyticalMember` elements (wrong data source for Phase 5). Use it only as a conceptual template for the JSON-emit pattern (see `get_or_add_node` in that file — our version is very similar but produces metres directly).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feet → metres conversion | Hard-coded `× 0.3048` | `convert_internal_units(value, get_internal=False, units='m')` from `_units_conversion.py` | Version-agnostic (handles Revit 2021+ and pre-2021); project convention is to reuse the helper |
| JSON serialization | Manual string concatenation | `json.dump(obj, fp, indent=2)` | IronPython 2.7 has the full `json` module; `indent=2` gives human-readable output matching the sample fixture |
| File-save dialog | Windows Forms `SaveFileDialog` | `pyrevit.forms.save_file` | Idiomatic pyRevit; already in legacy exporter; no extra clr imports |
| TaskDialog with checkbox | Custom WPF form | Raw `Autodesk.Revit.UI.TaskDialog` + `VerificationText` | Built-in, native look-and-feel, one property set |
| Selection probing | Manual `uidoc.Selection.GetElementIds()` loop + `doc.GetElement` | `get_selected_elements([DetailLine])` from `_selection_func.py` | Already solved, already filtered |
| Lexicographic sort | Custom comparator | Python built-in `sort(key=lambda p: (p[0], p[1]))` | Stable, correct, O(n log n) |

**Key insight:** the entire "new" logic in this phase is ~80 lines of geometry (merge + T-split + crossings + sort). Everything else is glue over existing helpers. The planner should resist the temptation to re-implement Revit or IronPython primitives.

## Runtime State Inventory

> Rename/refactor/migration categories: not applicable for Phase 5 (greenfield new pushbutton in a separate repo). This section is omitted.

## Common Pitfalls

### Pitfall 1: Load handler reads from `canvas.*`, not top-level arrays
**What goes wrong:** Exporter emits a correct flat `nodes`/`members` payload but no `canvas` block (or a minimal one). The UI's file input acceptance validates top-level keys pass, then calls `canvas.nodes` → `undefined` → silently sets `nodes = []` → canvas is empty after "successful" load.
**Why it happens:** The top-level arrays in `Frame2DRequest` look like the primary contract. They aren't — they're for direct POST to `/solve/frame2d`.
**How to avoid:** Emit a **complete** `canvas` block with `origin`, `canvas.nodes[]` as full objects (`id, x, y, realX, realY`), `canvas.members[]` as full objects, and the empty-but-present `supports: {}`, `nodeLoads: []`, `udl: []`, `memberOverrides: {}`.
**Warning signs:** Load reports "success" but canvas stays blank; `console.warn('Unknown support form ...')` appears in DevTools.

### Pitfall 2: `solver: "frame_v2"` vs `"frame2d"`
**What goes wrong:** The API registers both `frame_v2` and `frame2d` [VERIFIED: api_server/app.py line 36–42], so a flat-POST would work with either name. But the UI Load handler rejects anything that isn't exactly `"frame2d"` [VERIFIED: script.js line 1554].
**How to avoid:** Hard-code `"solver": "frame2d"` in the JSON emit. Never use `"frame_v2"`.

### Pitfall 3: `origin: null` makes `syncPixelFromReal` a no-op
**What goes wrong:** Load handler calls `nodes.forEach(syncPixelFromReal)`, but `syncPixelFromReal` early-returns if `origin` is null [VERIFIED: script.js line 442]. So if `canvas.origin` is null and `canvas.nodes[i].x / .y` are zero/missing, every node renders at pixel (0, 0) — invisible blob.
**How to avoid:** Always emit a non-null `origin`, e.g. `{"x": 100, "y": 400}`. For maximum robustness, also fill in valid pixel `x, y` in every `canvas.nodes[i]` (doesn't cost anything and survives a future refactor that skips the sync).

### Pitfall 4: `members` 1-based top-level vs 0-based canvas
**What goes wrong:** Top-level `members: [[1, 2]]` is 1-based node indices (mirrors `Frame2DRequest` / FEM convention). But `canvas.members[i].start` and `canvas.members[i].end` are **0-based** `node.id` values [VERIFIED: script.js line 131 — `start: currentMemberStart.id`]. Mixing these up produces off-by-one errors on reload.
**How to avoid:** Produce `members_pairs_0based` as the internal working representation. Emit top-level with `[s+1, e+1]` and `canvas.members[i]` with `[s, e]` unchanged.

### Pitfall 5: `WasVerificationChecked()` is a method, not a property
**What goes wrong:** `td.WasVerificationChecked` (no parens) returns the method object (truthy) instead of the actual boolean result. IronPython 2.7 doesn't auto-invoke.
**How to avoid:** Always call with parens: `td.WasVerificationChecked()`. Same for any `.NET` method accessed through IronPython.

### Pitfall 6: Module-level flag doesn't persist across pyRevit clicks
**What goes wrong:** Developer writes `_SHOW_WARNING = True` at top of `script.py`, expecting it to persist. pyRevit re-executes the file each click, so the flag resets every time.
**How to avoid:** Attach the flag to a long-lived object: `__revit__.Application._pda_export_warning_shown = True`. Verified-live-in-Revit is the only bulletproof test — worth a quick smoke test during execution.

### Pitfall 7: `OfClass(DetailLine)` may not collect reliably
**What goes wrong:** `FilteredElementCollector.OfClass` keys off the element's registered .NET class, and Revit can expose `DetailLine` through `CurveElement`. In practice `OfClass(DetailLine)` usually works but is fragile across Revit versions.
**How to avoid:** Use `OfCategory(BuiltInCategory.OST_Lines)` + `isinstance(el, DetailLine)` check. Or `OfClass(CurveElement)` + `isinstance`. Category-based filtering is more robust.

### Pitfall 8: IronPython 2.7 does not have f-strings
**What goes wrong:** Developer writes `f"Exported {n} nodes"` — IronPython 2.7 does not understand the syntax → `SyntaxError` at script load, button silently fails.
**How to avoid:** Use `.format()` throughout: `"Exported {0} nodes".format(n)`. Same for no type annotations outside `# type:` comments, no walrus operator, no ordered-dict-literal assumptions.

### Pitfall 9: `json.dump` with non-ASCII in default_ensure_ascii=False
**What goes wrong:** IronPython 2.7 has a known bug with unicode + `ensure_ascii=False` [VERIFIED: IronLanguages/main issue #988] — writes fail on certain strings.
**How to avoid:** Stick with the default `ensure_ascii=True`. View names with non-ASCII characters will be escaped in the JSON (fine — they're only in filenames anyway via `_sanitise_filename`).

### Pitfall 10: Tolerance in parametric vs metric space
**What goes wrong:** Checking "foot of perpendicular is at endpoint" with a fixed parametric threshold like `t < 0.01` means the tolerance varies with segment length — a 50m member allows 50cm of slop, a 0.5m member only 5mm.
**How to avoid:** Convert the 1mm metric tolerance to a parametric threshold per-segment: `t_tol = TOLERANCE_M / segment_length`. Use that in the interior-point test. Shown in the algorithm section.

### Pitfall 11: Revit `XYZ` objects cannot be compared or dict-keyed directly
**What goes wrong:** `XYZ` has no working `__eq__`/`__hash__` for dict use, and `IsAlmostEqualTo` uses feet.
**How to avoid:** Convert to Python tuples `(x_m, y_m)` right at the edge of the Revit API boundary. Operate on tuples for the rest of the pipeline.

## Code Examples

### Verified: Reading detail lines from the active drafting view

```python
# Source: combining CONTEXT D-01/D-03, legacy exporter get_or_add_node, and
#         revitapidocs FilteredElementCollector docs (2024)
from Autodesk.Revit.DB import (
    FilteredElementCollector, BuiltInCategory, DetailLine, Line, ViewDrafting,
)

view = uidoc.ActiveView
if not isinstance(view, ViewDrafting):
    # abort
    return

# Selection override
sel_ids = uidoc.Selection.GetElementIds()
if sel_ids:
    candidates = [doc.GetElement(eid) for eid in sel_ids]
    candidates = [e for e in candidates if e.OwnerViewId == view.Id]
else:
    candidates = (FilteredElementCollector(doc, view.Id)
                  .OfCategory(BuiltInCategory.OST_Lines)
                  .WhereElementIsNotElementType()
                  .ToElements())

detail_lines = [
    e for e in candidates
    if isinstance(e, DetailLine) and isinstance(e.GeometryCurve, Line)
]
```

### Verified: TaskDialog with VerificationText and result parsing

```python
# Source: gtalarico/revitapidocs.code HowTo_CreateTaskDialog.py
from Autodesk.Revit.UI import (
    TaskDialog, TaskDialogCommonButtons, TaskDialogResult,
)

td = TaskDialog("PDA Export")
td.MainInstruction = "2D Trusses and 2D Frames Only"
td.MainContent = ("This exports detail-line geometry only. Supports and loads "
                  "must be added in the frame2d browser UI after loading the JSON.")
td.CommonButtons = TaskDialogCommonButtons.Ok | TaskDialogCommonButtons.Cancel
td.DefaultButton = TaskDialogResult.Ok
td.VerificationText = "Don't show this message again this session"

result = td.Show()
if result != TaskDialogResult.Ok:
    return  # abort
if td.WasVerificationChecked():
    __revit__.Application._pda_export_warning_shown = True
```

### Verified: Feet → metres via the reusable helper

```python
# Source: sibling repo lib/Snippets/_units_conversion.py
from _units_conversion import convert_internal_units  # exported by the pyRevit lib

p0 = detail_line.GeometryCurve.GetEndPoint(0)  # XYZ in feet
x_m = round(convert_internal_units(p0.X, get_internal=False, units='m'), 4)
y_m = round(convert_internal_units(p0.Y, get_internal=False, units='m'), 4)
# z is dropped entirely per D-11
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `UnitUtils.Convert(value, DisplayUnitType.DUT_METERS)` | `UnitUtils.ConvertFromInternalUnits(value, UnitTypeId.Meters)` | Revit 2021 | `_units_conversion.py` handles both branches; on 2023+ only the UnitTypeId path runs. |
| `element.GetAnalyticalModel()` (pre-2023) | `AnalyticalMember` class + `AnalyticalModelHelper` | Revit 2023 | Phase 5 doesn't use analytical members at all (drafting-view detail lines instead). This is a Phase 6 concern. |
| pyRevit `forms.ask_for_string` as save-file UX | `pyrevit.forms.save_file` | pyRevit 4.7+ | Legacy exporter already uses `save_file`; continue. |
| Manual Windows Forms `SaveFileDialog` via `clr.AddReference` | `FileSaveDialog` (Revit UI API) or `pyrevit.forms.save_file` | Always preferred | Keeps the extension portable across Revit instances without System.Windows.Forms dependencies. |

**Deprecated/outdated (do not use):**
- `DisplayUnitType` — obsolete since Revit 2021 (the pre-2021 branch in `_units_conversion.py` is a fallback, not a primary path).
- `ParameterType` enum — obsolete, use `SpecTypeId` / `ForgeTypeId`. Not relevant to Phase 5 directly but worth knowing for Phase 6.
- `BuiltInParameterGroup` enum — deprecated in 2024, use `GroupTypeId`. Not relevant to Phase 5.

## Project Constraints (from CLAUDE.md)

Most project hard rules apply to `solver_core/` and do NOT apply to the sibling `CustomRevitExtension/` repo where the Phase 5 code lives. The ones that transitively apply:

| Rule | How it binds Phase 5 |
|------|----------------------|
| JSON must match `Frame2DRequest` in `api_server/app.py` so the UI can solve | Exporter output is validated by loading in frame2d UI → adding supports/loads → clicking Solve. Success criterion REVIT-T1-05. |
| DOF numbering 1-based in the public API | Top-level `members: [[i+1, j+1]]` uses 1-based node indices. Top-level `restrainedDoF`, `pinDoF`, `springDoF` are 1-based lists (but empty in Tier 1). |
| No `matplotlib`, no printing in solver_core | N/A — nothing in Phase 5 touches solver_core. |
| Layered pipeline (Model → Adapter → Solver → AnalysisResult) | N/A — Phase 5 produces an input file for the UI, not a new model/adapter/solver. |
| GSD workflow for file edits | Planning artifacts stay in `pda_project/.planning/phases/05-.../`. Revit-side code changes happen in sibling repo's git. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pyRevit installation | running the pushbutton in Revit | ✓ | — (already on user's machine per existing extension) | — |
| Revit 2023/2024/2025 | host for the button | Assumed (user's install) | — | — |
| IronPython 2.7 engine | running `script.py` | ✓ (bundled with pyRevit 4.x) | 2.7.12 | pyRevit 5 has CPython option but extension is currently IronPython 2.7 per CONTEXT |
| `_units_conversion.py` helper | feet→metres conversion | ✓ | — | Inline implementation if import path ever breaks |
| `_selection_func.py` helper | D-03 selection override | ✓ | — | Raw `uidoc.Selection.GetElementIds()` if import path breaks |
| frame2d browser UI (pda_project) | verification of REVIT-T1-05 | ✓ | Phase 4 complete | — |
| pda_project API server | end-to-end round-trip validation | ✓ | post-Phase-4 | `uvicorn api_server.app:app --reload` |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Notes on execution environment:**
- Sibling repo has its own git history — Revit-side code edits commit there, planning artifacts commit to `pda_project/`.
- Running the pushbutton requires Revit open with a drafting view active. Test structure generation is a **human-action step**: the verifier must manually draw some detail lines in a drafting view before clicking the button. Plan accordingly (HUMAN-UAT checkpoint).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pyRevit re-executes `script.py` in a fresh namespace on each button click, so module-level globals do not persist across clicks | Pitfall 6, §Revit API Reference D-16 | If globals DO persist, the `__revit__.Application._pda_export_warning_shown` pattern still works (attribute just already exists on second click). Low risk either way. |
| A2 | `canvas.nodes[i].x` and `canvas.nodes[i].y` pixel coordinates are harmless even if `origin` is non-null (since `syncPixelFromReal` overwrites them) | §JSON Contract | If `syncPixelFromReal` is skipped (e.g. future refactor), stale pixel values would cause visual offset. Low risk — code review of script.js line 1619 confirms it always runs post-load. |
| A3 | `BuiltInCategory.OST_Lines` is the correct category for `DetailLine` in Revit 2023+ | §Revit API Reference | Fallback: switch to `OfClass(CurveElement)` with `isinstance` filter — same result. Medium risk; verify during implementation by running the collector and counting returned elements. |
| A4 | Revit 2023, 2024, and 2025 all support `UnitTypeId.Meters`, `FileSaveDialog`, `TaskDialog.VerificationText`, and `ViewDrafting` identically | §Standard Stack, §Revit API Reference | If 2025 deprecated any of these (not indicated by revitapidocs 2025 news page), exporter would need version-specific branching. Low risk — these are stable, widely-used APIs. |
| A5 | The pyRevit `forms.save_file` helper accepts `file_ext='json'` and `default_name=<str>` and returns the full path string or `None` on cancel | §Revit API Reference D-13, §Reuse Map | Fallback: use raw `FileSaveDialog`. Low risk — legacy exporter already uses this exact call. |
| A6 | The frame2d Load handler's post-load `nodes.forEach(syncPixelFromReal)` runs without error even if `origin` is `null` (the function early-returns) | Pitfall 3 | Verified by reading script.js line 442. Zero risk. |
| A7 | IronPython 2.7's `json` module supports `json.dump(obj, fp, indent=2)` identically to CPython 2.7 | §Standard Stack | [VERIFIED: IronPython 2.7 docs list json module; known unicode issue only with `ensure_ascii=False`.] Low risk. |

**Canvas pixel coordinates note:** A2 can be reclassified to verified once the plan includes a smoke test that loads the exported file into frame2d and visually confirms the canvas is populated. This smoke test is REVIT-T1-05's acceptance step.

## Open Questions

1. **Button icon asset.** The existing `Loads.pushbutton/icon.png`, `Supports.pushbutton/icon.png`, and `StructuralAnalyticalModel.pushbutton/icon.png` are all 569-byte PNGs — likely placeholder/default icons. Should the new `ExportToPDA.pushbutton/icon.png` match these (use the same icon) or be custom?
   - **What we know:** existing icons are small 32x32 PNGs (569 bytes suggests minimal).
   - **What's unclear:** whether the user wants a distinct icon for this new button.
   - **Recommendation:** **Copy one of the existing 569-byte icons to start.** The planner can add an optional polish task at the end to design a distinct icon, but functional shipping doesn't require it. The button's tooltip (via `bundle.yaml`) will disambiguate.

2. **`forms.save_file` vs `FileSaveDialog` — which does the extension team prefer?**
   - **What we know:** legacy exporter uses `forms.save_file`. Raw `FileSaveDialog` is more control but more boilerplate.
   - **What's unclear:** user preference (no decision recorded in CONTEXT).
   - **Recommendation:** use `forms.save_file`. Claude's Discretion per CONTEXT covers this.

3. **Does the sibling repo need its own GSD workflow file?**
   - **What we know:** `pda_project/CLAUDE.md` has GSD workflow enforcement; the sibling repo does not (checked during research — no `CLAUDE.md` at sibling repo root).
   - **What's unclear:** whether the planner should add one for Phase 5's Revit-side commits.
   - **Recommendation:** out of Phase 5 scope. Planner can note this as a backlog item. Commits in the sibling repo for Phase 5 just follow normal git hygiene.

4. **How are pyRevit `lib/Snippets/*.py` modules importable from a pushbutton script?**
   - **What we know:** pyRevit automatically adds each extension's `lib/` folder to `sys.path` at startup. So `from _units_conversion import convert_internal_units` should work. [ASSUMED but consistent with pyRevit docs.]
   - **What's unclear:** whether `lib/Snippets/` (the subfolder) is also on `sys.path`, or just `lib/`.
   - **Recommendation:** plan should include a smoke-test task: "Drop a `print()` at top of script.py importing `_units_conversion` — run the button once and confirm no ImportError." If Snippets/ is not auto-pathed, add `sys.path.insert(0, os.path.join(<ext_root>, 'lib', 'Snippets'))` before the import. Small risk; easily fixed.

## Sources

### Primary (HIGH confidence)

**Local files read during research:**
- `/Users/catrinevans/Documents/pda_project/ui/frame2d/script.js` — Load handler lines 1386–1645, `syncPixelFromReal` line 442, Save function lines 1482–1506 (canonical source for the JSON contract)
- `/Users/catrinevans/Documents/pda_project/tests/fixtures/sample_pda_frame2d.json` — reference Phase 3 schema instance
- `/Users/catrinevans/Documents/pda_project/api_server/app.py` — `Frame2DRequest` Pydantic model (lines 51–75), solver alias registration (lines 36–42)
- `/Users/catrinevans/Documents/pda_project/.planning/phases/05-revit-tier-1-geometry-exporter/05-CONTEXT.md` — 16 locked decisions
- `/Users/catrinevans/Documents/pda_project/.planning/REQUIREMENTS.md` — REVIT-T1-01..05
- `/Users/catrinevans/Documents/pda_project/.planning/STATE.md` — cross-repo setup
- `/Users/catrinevans/Documents/pda_project/.planning/ROADMAP.md` §Phase 5
- `/Users/catrinevans/Documents/pda_project/.planning/milestones/v1.1-phases/03-interchange-format-and-external-inputs/03-CONTEXT.md` — Phase 3 schema D-01..D-04
- `/Users/catrinevans/Documents/pda_project/.planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md` — Phase 4 D-08 (spring support extension)
- `/Users/catrinevans/Documents/pda_project/pyrevit_exporters/export_to_pda.py` — legacy exporter (reference only)
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_units_conversion.py`
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_selection_func.py`
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_CoordinateConverterClass.py`
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/` structure (existing buttons = empty stubs + icon.png)

**Official Revit API documentation:**
- [FileSaveDialog Class (Revit 2024)](https://www.revitapidocs.com/2024/afc7f52e-49ef-2c31-4414-9984b5fe456f.htm) — constructor, inherits from FileDialog
- [FileSaveDialog Members (Revit 2024)](https://www.revitapidocs.com/2024/1b64fcfc-02f0-d317-f182-360e3737c85a.htm) — `Show()`, `GetSelectedModelPath()`, `Title`, `InitialFileName`, `Filter`, `DefaultFilterEntry`
- [TaskDialog Properties (Revit 2024)](https://www.revitapidocs.com/2024/a07765ed-483d-4c36-c521-f84554f06191.htm) — `VerificationText`, `MainInstruction`, `MainContent`, `CommonButtons`
- [UnitTypeId Class (Revit 2023)](https://www.revitapidocs.com/2023/bc1b6454-f10a-66dc-9268-1dccbc403f78.htm)
- [UnitTypeId Members (Revit 2024)](https://www.revitapidocs.com/2024/4245c082-629c-9ab0-7d43-fbb771db7991.htm)
- [UnitTypeId.Meters (Revit 2025)](https://apidocs.co/apps/revit/2025/adf9f897-73e3-efe7-1b6a-87035370ab11.htm)
- [DetailLine Class (Revit 2022)](https://www.revitapidocs.com/2022/5e6ee932-6034-e414-f7e2-3550c805d904.htm) — inheritance `Element → CurveElement → DetailCurve → DetailLine`
- [Revit 2025 API Changes](https://www.revitapidocs.com/2025/news)
- [How to Convert Units in Revit API (LearnRevitAPI)](https://www.learnrevitapi.com/newsletter/convert-units)
- [gtalarico/revitapidocs.code — HowTo_CreateTaskDialog.py](https://github.com/gtalarico/revitapidocs.code/blob/master/0-python-code/HowTo_CreateTaskDialog.py) — verified TaskDialog + VerificationText + WasVerificationChecked pattern

### Secondary (MEDIUM confidence)

- [pyRevit Extension Docs — Bundle Metadata](https://pyrevitlabs.notion.site/Bundle-Metadata-9fa4911c14fa49c48e715421400f1427) — bundle.yaml keys
- [pyRevit Extensions and Commands](https://pyrevit1.readthedocs.io/en/latest/creatingexts.html) — pushbutton folder structure
- [pyRevit forms reference](https://pyrevit1.readthedocs.io/en/latest/pyrevit/forms.html) — `alert()`, `save_file()` signatures
- [pyrevitlabs/pyRevit rpw/ui/forms/taskdialog.py](https://github.com/pyrevitlabs/pyRevit/blob/master/pyrevitlib/rpw/ui/forms/taskdialog.py) — WasVerificationChecked pattern
- [Autodesk Forum — Converting from Internal Units to Meters in Revit API 2023 or 2024](https://forums.autodesk.com/t5/revit-api-forum/converting-from-internal-units-to-meters-or-millimeters-in-revit/td-p/12025099)
- [Dynamo Python Primer — 4.5 The FilteredElementCollector](https://dynamopythonprimer.gitbook.io/dynamo-python-primer/4-revit-specific-topics/fetching-revit-elements) — view-scoped collector pattern
- [Solved: ViewDrafting.Create | viewFamilyTypeId](https://forums.autodesk.com/t5/revit-api-forum/viewdrafting-create-viewfamilytypeid/td-p/5679197) — ViewDrafting type usage
- [IronPython 2.7 json module](https://ironpython-test.readthedocs.io/en/latest/library/json.html)

### Tertiary (LOW confidence — flagged where used)

- [Revit API 2024 [Obsolete] — ricaun](https://ricaun.com/revit-api-2024-obsolete/) — general ForgeTypeId migration overview (used to confirm UnitTypeId is NOT in the deprecated set)
- [Boost Your BIM — ForgeTypeId in Revit 2022](https://boostyourbim.wordpress.com/2021/04/15/revit-2022-whats-up-with-forgetypeid/) — corroborating UnitTypeId stability

## Metadata

**Confidence breakdown:**
- JSON contract: HIGH — derived directly from reading `script.js` Load and Save handlers, and `api_server/app.py` Pydantic model
- Revit API calls: HIGH — verified against revitapidocs 2024/2025 pages; constants confirmed stable across 2023–2025
- pyRevit pushbutton skeleton: HIGH — sibling repo already has three working stubs to copy; bundle.yaml keys confirmed from pyRevit docs
- Algorithm specs (endpoint-merge, T-split, crossings): HIGH — standard computational geometry; parametric foot and segment-cross formulas are textbook
- Session-persistence pattern: MEDIUM — `__revit__.Application` attribute assignment pattern is ASSUMED to persist; verify with a live smoke test during execution
- `OST_Lines` category choice: MEDIUM — standard pattern per forums; falls back gracefully to `OfClass(CurveElement) + isinstance`

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 for Revit API claims (Revit 2025 is current; 2026 release typically mid-year); 2026-11-20 for pyRevit API claims (pyRevit 5 CPython migration may change some helpers but IronPython 2.7 path is stable).

## RESEARCH COMPLETE
