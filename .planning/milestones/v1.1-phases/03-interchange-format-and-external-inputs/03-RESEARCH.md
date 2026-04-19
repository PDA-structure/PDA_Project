# Phase 3: Interchange Format and External Inputs - Research

**Researched:** 2026-04-18
**Domain:** JSON schema design, vanilla JS File API, Python Excel parsing (openpyxl), Revit PyRevit API
**Confidence:** HIGH (JS save/load), MEDIUM (Tekla converter), LOW (Revit PyRevit)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Schema is solve-ready — fields mirror the API request payload exactly (`nodes`, `members`, `ENForces`, `ENMoments`, `forceVector`, `restrainedDoF`, `E`, `I`, `A`, `bars`, `beamPinLeft`, `beamPinRight`, `springDoF`, `springStiffness`). Loading a file and POSTing to `/solve/frame2d` or `/solve/truss2d` must work without field transformation.
- **D-02:** Schema includes full canvas round-trip state in a top-level `canvas` key: support type strings, node loads `{nodeId, direction, magnitude}`, UDL `{memberId, wy, wx}`, per-member E/I/A overrides in UI units (GPa, cm4, cm2), node coords in metres. On load the canvas is fully restored.
- **D-03:** Top-level metadata: `schema_version: "1.0"` and `solver: "frame2d"` (or `"truss2d"`). Loader uses `solver` to route and validate.
- **D-04:** File structure (see CONTEXT.md D-04 for full JSON shape).
- **D-05:** Save and Load are toolbar buttons in both `frame2d/index.html` and `truss2d/index.html`, positioned between "Edit" and "Material Properties" sections.
- **D-06:** Save triggers immediate download named `frame2d-model-{ISO timestamp}.json`; no user prompt; no success toast.
- **D-07:** Load uses hidden `<input type="file" accept=".json">` triggered by button click. Shows `confirm()` before overwriting a non-empty canvas.
- **D-08:** After loading, canvas is redrawn but NOT auto-solved.

### Claude's Discretion

- Exact toolbar button label and icon for Save/Load (resolved in UI-SPEC: "Save JSON" / "Load JSON" with floppy/folder emoji)
- Whether Save is disabled when canvas is empty (resolved in UI-SPEC: yes, disabled when `nodes.length === 0`)
- Error handling for malformed or mismatched JSON (resolved in UI-SPEC: `alert()` messages)
- File format for Tekla Excel import (server-side vs standalone Python script) — Claude to decide

### Deferred Ideas (OUT OF SCOPE)

- Grillage solver (Phase 4)
- Load combinations
- Design code checking
- External converter deployment strategy (not discussed — Claude to decide)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTERCHANGE-01 | Save/load structure from frame2d and truss2d browser UIs | JS File API patterns, `createDownloadLink` reuse, FileReader API |
| INTERCHANGE-02 | Saved JSON schema matches solver API input format exactly | Verified against `Frame2DRequest` / `Truss2DRequest` Pydantic models in `api_server/app.py` |
| INTERCHANGE-03 | Tekla Structural Designer Excel export can be converted to canonical JSON schema and solved | openpyxl parsing strategy, recommended converter shape |
| INTERCHANGE-04 | Revit PyRevit script exports analytical model to canonical JSON schema | PyRevit IronPython/CPython constraints, Revit 2023+ AnalyticalMember API |
| INTERCHANGE-05 | Interchange format is documented and usable as a communication tool | Schema is self-describing via `schema_version` and `solver` fields |
</phase_requirements>

---

## Summary

Phase 3 has three distinct implementation tracks: (1) browser save/load in two vanilla JS UIs, (2) a Python script for converting Tekla Structural Designer Excel exports, and (3) a PyRevit script for Revit analytical model export. The browser track is the most well-defined and highest confidence — the codebase already contains all the primitives needed (`createDownloadLink`, `saveHistory`, `FileReader`). The Tekla converter is moderately well-defined: openpyxl is the right tool, but TSD's Excel export format is not publicly documented to column-level detail, so the converter must be designed with a configurable column-mapping layer. The Revit track is the lowest confidence: the Revit 2023+ API changed how analytical models are accessed (new `AnalyticalMember` class replacing the old `AnalyticalModel` class), and PyRevit scripts run under IronPython 2.7 by default (CPython available since pyRevit 4.8).

**Primary recommendation:** Implement in dependency order — schema design first (gates all other work), then JS save/load (fastest value delivery), then Tekla converter as a standalone Python CLI script, then Revit PyRevit script.

---

## Standard Stack

### Core (existing — do not add new runtime dependencies to solver_core)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib `json` | 3.10+ | JSON serialisation/deserialisation | Already available everywhere; no install needed |
| Vanilla JS `FileReader` API | Browser native | Read user-selected file on client side | Built into every modern browser; no library needed [VERIFIED: MDN] |
| Vanilla JS `Blob` + `URL.createObjectURL` | Browser native | Trigger file download | Already used in `createDownloadLink()` in both script.js files [VERIFIED: codebase] |

### Supporting — converters only (install in dev environment, NOT in solver_core)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openpyxl | >=3.1 | Read `.xlsx` TSD exports | Tekla converter script; pure Python, no C extensions, works on macOS/Windows |
| httpx | 0.28.1 | FastAPI TestClient backend | Already installed; use for API-level integration tests |

**openpyxl not currently installed.** [VERIFIED: `pip3 list` — not present in environment]

Install for converter development:
```bash
pip3 install openpyxl
```

Do NOT add openpyxl to `solver_core/pyproject.toml` — it is a dev/tooling dependency, not a solver dependency.

### Alternatives Considered

| Recommended | Alternative | Why Alternative is Worse |
|-------------|-------------|--------------------------|
| openpyxl | pandas+openpyxl | pandas is heavy (numpy + pandas); openpyxl alone is sufficient for reading a single worksheet |
| openpyxl | xlrd | xlrd 2.0+ dropped .xlsx support; only reads .xls (legacy format) |
| Standalone CLI script | FastAPI endpoint for Tekla conversion | Server-side upload adds complexity, CORS, file-size limits; CLI is simpler to test and deploy |
| `FileReader.readAsText()` | `FileReader.readAsArrayBuffer()` | JSON files are text; readAsText is the correct API for UTF-8 JSON |

---

## Architecture Patterns

### Pattern 1: Schema-First Design

The JSON schema is the integration contract that all three tracks (JS, Tekla, Revit) must satisfy. Write and document it first, derive everything else from it.

The schema has two logical sections:

```
{
  "schema_version": "1.0",   // for forward-compatible migration
  "solver": "frame2d",        // "frame2d" | "truss2d" — gates loader routing and validation

  // --- SOLVE PAYLOAD (subset: everything Frame2DRequest / Truss2DRequest accepts) ---
  "nodes": [[x, y], ...],          // metres, float
  "members": [[i, j], ...],        // 1-based node indices, int
  "ENForces": [[fi, fj], ...],     // N, float per member
  "ENMoments": [[mi, mj], ...],    // N·m, float per member
  "forceVector": [...],            // flat, 3*n_nodes for frame2d, 2*n_nodes for truss2d
  "E": <float | float[]>,          // Pa
  "I": <float | float[]>,          // m4
  "A": <float | float[] | null>,   // m2
  "bars": [...],                   // 1-based member indices
  "beamPinLeft": [...],
  "beamPinRight": [...],
  "restrainedDoF": [...],          // 1-based DOF indices
  "pinDoF": [],
  "springDoF": [],
  "springStiffness": [],
  "udl_x": [...],                  // one per member, N/m

  // --- CANVAS STATE (for full visual restoration in browser) ---
  "canvas": {
    "origin": {"x": px, "y": py},           // canvas pixel origin — needed to restore node positions correctly
    "nodes": [{"id": N, "x": px, "y": py, "realX": m, "realY": m}, ...],
    "members": [{"id": N, "start": i, "end": j, "type": "beam"|"bar",
                 "pinLeft": bool, "pinRight": bool,
                 "udl": wy_N_per_m | null, "udl_x": wx_N_per_m | null,
                 "E_override": GPa | null, "I_override": cm4 | null, "A_override": cm2 | null}, ...],
    "supports": [{"nodeId": N, "type": "fixed"|"pinned"|"rollerX"|"rollerY"}, ...],
    "nodeLoads": [{"nodeId": N, "direction": "x"|"y"|"moment", "magnitude": N_or_Nm}, ...]
  }
}
```

**Critical insight about `canvas.nodes`:** The JS canvas stores both pixel coordinates (`x`, `y`) and real-world coordinates (`realX`, `realY`). The solve payload's `nodes` array contains only `[[realX, realY], ...]`. On load, both must be restored — pixel coordinates are needed to redraw, real coordinates to re-assemble the solve payload. The canvas `origin` pixel position is also needed because node pixel coordinates are relative to it. See `saveHistory()` in `script.js` lines 239–249 for the exact state shape.

### Pattern 2: JS Save Function

The `createDownloadLink(res)` function (script.js lines 1109–1138) already handles Blob creation and programmatic download. `saveModel()` follows the same pattern:

```javascript
// Source: existing createDownloadLink() in ui/frame2d/script.js
function saveModel() {
  // Assemble solve payload (same as the fetch('/solve/frame2d') payload block, lines 388-399)
  // Assemble canvas state from: nodes, members, supports, nodeLoads, origin
  const model = {
    schema_version: "1.0",
    solver: "frame2d",
    // ... solve payload fields ...
    canvas: { origin, nodes, members, supports, nodeLoads }
  };
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/:/g, '-').replace('T', 'T').slice(0, 19);
  const a = document.createElement('a');
  a.href = url; a.download = `frame2d-model-${ts}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

The ISO timestamp format in UI-SPEC uses hyphens for colons (`YYYY-MM-DDTHH-MM-SS`) for filesystem safety.

### Pattern 3: JS Load Function

```javascript
// Source: MDN FileReader API + existing confirm() pattern in both script.js files
function triggerLoad() {
  document.getElementById('fileInput').click();
}

document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    let data;
    try {
      data = JSON.parse(evt.target.result);
    } catch {
      alert("Could not read file. Make sure it is a valid PDA JSON file.");
      return;
    }
    // Validate schema_version and solver
    if (!data.schema_version || !data.solver) {
      alert("File is missing required data. The file may be from an older version.");
      return;
    }
    if (data.solver !== 'frame2d') {
      alert("This file is for the " + data.solver + " solver and cannot be loaded here.");
      return;
    }
    // Confirm overwrite if canvas non-empty
    if (nodes.length > 0 && !confirm("This will replace the current structure. Continue?")) return;
    // Restore state from canvas section
    origin    = data.canvas.origin;
    nodes     = data.canvas.nodes;
    members   = data.canvas.members;
    supports  = data.canvas.supports;
    nodeLoads = data.canvas.nodeLoads;
    results   = null;
    history   = [];
    draw();
  };
  reader.readAsText(file);
  // Reset input so same file can be re-loaded
  e.target.value = '';
});
```

**Edge case:** Reset `e.target.value = ''` after reading so the `change` event fires again if the user loads the same file twice. [VERIFIED: standard browser pattern]

### Pattern 4: Tekla Excel Converter (Standalone Python CLI)

**Decision (Claude's discretion):** Implement as a standalone Python CLI script, not a FastAPI endpoint. Rationale: simpler to test (no server required), easier for engineers to run from a terminal or drag-and-drop, no CORS or file-upload complexity.

TSD's Excel export format is not publicly documented to column-level detail. [VERIFIED: checked Tekla official docs — only confirms data categories, not column names]. The converter must therefore be designed with a configurable column-mapping dict at the top of the script that the user can adjust to their TSD version's actual column headers.

The TSD "Solver Model Data" export (accessed via Review > Excel) does export:
- Node data: coordinates, DOFs [CITED: support.tekla.com/doc/tekla-structural-designer/2025/ana_tabular_solver_model_data]
- Element data: solver properties
- Force results and deflections

Since column headers vary by TSD version and locale, the converter pattern is:

```python
# converters/tekla_to_pda.py
import json, sys
import openpyxl

# Configurable column mapping — adjust to match your TSD export
COLUMN_MAP = {
    "nodes_sheet": "Nodes",          # sheet name containing node data
    "node_id": "Node",               # column header for node ID
    "node_x":  "X (m)",             # column header for X coordinate in metres
    "node_y":  "Y (m)",             # column header for Y coordinate
    "members_sheet": "Elements",     # sheet name for member data
    "member_id":  "Element",
    "member_start": "Start Node",
    "member_end":   "End Node",
    "member_E":     "E (kN/m2)",    # modulus column
    "member_I":     "I (m4)",
    "member_A":     "A (m2)",
}

def read_sheet_as_dicts(ws):
    """Return list of dicts keyed by header row values."""
    headers = [cell.value for cell in ws[1]]
    return [
        {headers[i]: row[i].value for i in range(len(headers))}
        for row in ws.iter_rows(min_row=2)
        if any(cell.value is not None for cell in row)
    ]

def convert(xlsx_path: str) -> dict:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    # ... read nodes, members, supports, loads ...
    return {
        "schema_version": "1.0",
        "solver": "frame2d",
        # ... assembled payload ...
    }

if __name__ == "__main__":
    result = convert(sys.argv[1])
    print(json.dumps(result, indent=2))
```

**Key risk:** TSD exports do NOT include support conditions or load vectors in the same sheet as geometry — supports and loads are defined separately in TSD and may require manual reconstruction or a second export. [ASSUMED — based on general knowledge of TSD's export structure; not verified against a live TSD export]

### Pattern 5: Revit PyRevit Exporter

PyRevit runs scripts inside Revit using IronPython 2.7 by default, with CPython 3.x available since pyRevit 4.8. [CITED: docs.pyrevitlabs.io]

The Revit 2023 API **completely replaced** the old `AnalyticalModel` class with:
- `AnalyticalElement` — base class
- `AnalyticalMember` — linear element (beam, column, brace)
- `AnalyticalPanel` — surface element (slab, wall)
[CITED: help.autodesk.com/view/RVT/2024/ENU — "Structural Engineering / Analytical Model"]

Old code using `element.GetAnalyticalModel()` (pre-2023 API) **will not work** in Revit 2023+. The new pattern uses `FilteredElementCollector` on `AnalyticalMember`.

```python
# pyrevit_exporters/export_to_pda.py — runs inside Revit via pyRevit
import json
from Autodesk.Revit.DB import FilteredElementCollector, AnalyticalMember, AnalyticalPanel
from Autodesk.Revit.DB.Structure import StructuralType
from pyrevit import forms, script

doc = __revit__.ActiveUIDocument.Document

members_col = FilteredElementCollector(doc).OfClass(AnalyticalMember).ToElements()

nodes = []      # collect unique XYZ positions
members = []    # [[start_idx+1, end_idx+1], ...]

def get_or_add_node(xyz, nodes_list):
    tol = 1e-3  # metres
    for i, n in enumerate(nodes_list):
        if abs(n[0]-xyz.X) < tol and abs(n[1]-xyz.Y) < tol:
            return i
    nodes_list.append([round(xyz.X, 4), round(xyz.Y, 4)])
    return len(nodes_list) - 1

for mbr in members_col:
    curve = mbr.GetCurve()
    si = get_or_add_node(curve.GetEndPoint(0), nodes)
    ei = get_or_add_node(curve.GetEndPoint(1), nodes)
    members.append([si+1, ei+1])

output = {
    "schema_version": "1.0",
    "solver": "frame2d",
    "nodes": nodes,
    "members": members,
    # Loads, supports, E/I/A must be filled manually — Revit analytical model
    # does not always carry these in a form directly extractable via API
    "ENForces": [[0,0]] * len(members),
    "ENMoments": [[0,0]] * len(members),
    "forceVector": [0] * (len(nodes) * 3),
    "E": 200e9, "I": 1e-4, "A": 0.01,
    "restrainedDoF": [],
    "bars": [], "beamPinLeft": [], "beamPinRight": [],
    "pinDoF": [], "springDoF": [], "springStiffness": [],
    "canvas": {"origin": None, "nodes": [], "members": [], "supports": [], "nodeLoads": []}
}

save_path = forms.save_file(file_ext='json')
if save_path:
    with open(save_path, 'w') as f:
        json.dump(output, f, indent=2)
    script.get_output().print_md("Exported {} nodes, {} members.".format(len(nodes), len(members)))
```

**Critical Revit constraint:** Revit's coordinate system is in **feet** internally (imperial), even when the project is metric. `XYZ.X`, `XYZ.Y`, `XYZ.Z` are in feet. Conversion: `metres = feet * 0.3048`. [ASSUMED — standard Revit API behaviour, widely documented in community resources, but should be verified against the active Revit document's display unit setting]

**3D vs 2D:** Revit analytical models are inherently 3D. For the 2D frame2d solver, the exporter must project to a plane (e.g. take only X and Y, confirm Z is approximately zero for planar frames). Non-planar models will need user confirmation or will produce incorrect results.

### Anti-Patterns to Avoid

- **Storing pixel coordinates as the "canonical" node position in the solve payload.** The solve payload must always use real-world metres. The `canvas` section stores pixel coords for visual restoration only — these must never be used in the solve payload.
- **Assuming TSD column headers are stable.** They are locale- and version-sensitive. Always design the converter with a user-editable column map at the top.
- **Using the pre-2023 Revit `GetAnalyticalModel()` API.** It was removed in Revit 2023. The new pattern is `FilteredElementCollector(doc).OfClass(AnalyticalMember)`.
- **Auto-solving on load.** D-08 is explicit: load restores state but does not call `solve()`. This preserves the user's mental model of the tool.
- **Making `origin` null in the canvas section.** Origin is the pixel anchor for all node positions. If it is null after loading, `syncPixelFromReal()` cannot restore node pixels and `draw()` will produce an empty canvas.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading .xlsx files | Custom XML parser for Office Open XML | openpyxl | Office Open XML is a 7000-page spec; openpyxl handles all edge cases |
| Triggering file download in browser | Custom server-side route or form POST | `Blob` + `URL.createObjectURL` + anchor `.click()` | Already established in `createDownloadLink()`; zero server involvement |
| Triggering file picker | Custom drag-and-drop surface (Phase 3) | Hidden `<input type="file">` + `.click()` | Simplest pattern; drag-and-drop is a Phase 4+ enhancement if needed |
| JSON schema validation | Hand-written field checker | Check `schema_version`, `solver`, and presence of `nodes`/`members` with `alert()` | Full schema validation (e.g., ajv) is out of scope and overkill for this phase |

---

## Common Pitfalls

### Pitfall 1: canvas.origin not saved — load produces blank canvas

**What goes wrong:** If `origin` is null or not included in the saved file's `canvas` section, `syncPixelFromReal()` cannot calculate node pixel positions (`n.x`, `n.y`). The solver payload loads correctly but the visual canvas is empty.
**Why it happens:** `origin` is a separate top-level JS variable (line 19 of frame2d/script.js: `let origin = null`), not part of the `nodes` array. Easy to overlook when assembling the canvas section.
**How to avoid:** Explicitly include `origin` in the `canvas` key. On load, restore it before calling `draw()`.
**Warning signs:** Canvas is blank after load, but if you click Solve the results appear correctly.

### Pitfall 2: E/I/A in wrong units in the canvas section vs. solve payload

**What goes wrong:** The solve payload sends E in Pa (e.g. `200e9`), but the canvas's `memberOverrides` stores E in GPa (e.g. `200`) for display in the UI inputs. If the converter produces SI units in the canvas section, the UI will display `200000000000` in the E field.
**Why it happens:** The UI applies unit conversions before POSTing (E_GPa * 1e9, I_cm4 * 1e-8, A_cm2 * 1e-4). The canvas section must store UI-unit values, not SI values.
**How to avoid:** The canvas `memberOverrides` stores `{E_GPa, I_cm4, A_cm2}`. The solve payload's `E`, `I`, `A` are in SI units. These are two different representations in one file.
**Warning signs:** Material property inputs show scientific notation numbers after load.

### Pitfall 3: Tekla node IDs are not contiguous 0-based integers

**What goes wrong:** TSD assigns node IDs that may not start at 0 or may have gaps (deleted nodes leave holes). If the converter uses TSD node IDs directly as the `members` array indices, the solver will receive wrong member connectivity.
**Why it happens:** TSD is a full BIM tool; node IDs are database keys, not array indices.
**How to avoid:** Build a `tsd_id_to_index` mapping when parsing the Nodes sheet, then use the index (not the original ID) in the `members` array.

### Pitfall 4: Revit uses feet, not metres

**What goes wrong:** The PDA solver expects coordinates in metres. Revit API `XYZ` values are in feet. An un-converted export produces a structure 3.28x larger than intended.
**Why it happens:** Revit's internal unit is always feet regardless of project units display setting.
**How to avoid:** Multiply all `XYZ` values by `0.3048` before writing to the JSON.
**Warning signs:** Deflections are very large; reactions are in odd orders of magnitude.

### Pitfall 5: forceVector length mismatch on load

**What goes wrong:** If the saved `forceVector` has a different length than `3 * nodes.length` (frame2d) or `2 * nodes.length` (truss2d), the solver rejects the payload.
**Why it happens:** If nodes were deleted and the forceVector was not trimmed, or if a converter generates the wrong length.
**How to avoid:** Validate `forceVector.length === nodes.length * (solver === 'frame2d' ? 3 : 2)` in the loader before POSTing. Surface this as a validation error, not a silent failure.

### Pitfall 6: FileInput `change` event does not fire when same file is re-selected

**What goes wrong:** User loads a file, edits the structure, then wants to reload the same file. The `change` event does not fire because the file input value has not changed.
**How to avoid:** Reset `e.target.value = ''` inside the `change` handler after reading the file.

---

## Code Examples

### Complete solve payload assembly (frame2d)

Verified from `ui/frame2d/script.js` lines 388–399: [VERIFIED: codebase]

```javascript
// Source: ui/frame2d/script.js lines 384-399
const payload = {
  solver: 'frame_v2',
  nodes:   nodes.map(n => [n.realX, n.realY]),
  members: members.map(m => [m.start + 1, m.end + 1]),   // 1-based
  ENForces, ENMoments, forceVector,
  E, I, A,
  bars, beamPinLeft, beamPinRight,
  restrainedDoF,
  pinDoF: [], springDoF: [], springStiffness: [],
  udl_x: members.map(m => m.udl_x !== null ? m.udl_x : 0),
};
```

Note: the `solver` field in the file schema is `"frame2d"`, but the API field `solver` uses `"frame_v2"` (the registered solver name). These are different. The file's top-level `solver` is for routing/validation; the payload's `solver` targets the API engine. [VERIFIED: api_server/app.py lines 44–68, engine.register("frame_v2", ...)]

### Frame2DRequest Pydantic model (authoritative schema reference)

Verified from `api_server/app.py` lines 44–68: [VERIFIED: codebase]

```python
class Frame2DRequest(BaseModel):
    solver: str = "frame_v2"
    nodes: List[List[float]]
    members: List[List[int]]
    ENForces: List[List[float]]
    ENMoments: List[List[float]]
    forceVector: List[float]
    E: Union[float, List[float]]
    I: Union[float, List[float]]
    A: Optional[Union[float, List[float]]] = None
    A_beam: Optional[float] = None
    A_bar: Optional[float] = None
    bars: List[int] = []
    beamPinLeft: List[int] = []
    beamPinRight: List[int] = []
    pins: Optional[List[List[int]]] = None
    restrainedDoF: List[int] = []
    pinDoF: List[int] = []
    springDoF: List[int] = []
    springStiffness: List[float] = []
    udl_x: Optional[List[float]] = None
```

### Truss2DRequest (authoritative schema reference)

Verified from `api_server/app.py` lines 155–163: [VERIFIED: codebase]

```python
class Truss2DRequest(BaseModel):
    solver: str = "truss2d"
    nodes: List[List[float]]
    members: List[List[int]]
    E: float
    A: float
    forceVector: List[float]
    restrainedDoF: List[int]
```

The truss2d schema is much simpler: no ENForces/ENMoments, no I, no bars/beamPin*/springDoF.

### openpyxl sheet reading pattern

```python
# Source: openpyxl official docs (openpyxl.readthedocs.io)
import openpyxl

wb = openpyxl.load_workbook("tsd_export.xlsx", read_only=True, data_only=True)
ws = wb["Nodes"]   # sheet name from COLUMN_MAP

headers = [cell.value for cell in ws[1]]
rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if any(v is not None for v in row):
        rows.append(dict(zip(headers, row)))
```

`read_only=True` avoids loading cell formatting, which is much faster for large models. `data_only=True` returns cell values rather than formulas.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `element.GetAnalyticalModel()` in Revit API | `FilteredElementCollector(doc).OfClass(AnalyticalMember)` | Revit 2023 | Old approach raises AttributeError in Revit 2023+ |
| `xlrd` for .xlsx reading | `openpyxl` | xlrd 2.0 (2020) | xlrd 2.0 dropped .xlsx support; openpyxl is now the standard |
| `<input type="file">` with `onchange` inline | addEventListener `change` with `e.target.value = ''` reset | Current best practice | Ensures re-load of same file works correctly |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TSD Excel exports have separate sheets for nodes and elements; supports and loads are NOT included in the same export | Tekla converter pattern, Pitfall 3 | If supports/loads are exported, the converter can be extended; if not, the limitation is correctly documented |
| A2 | TSD column headers are locale/version-sensitive and not stable across installations | Tekla converter pattern | If headers are stable, the configurable column map is still harmless but unnecessary |
| A3 | Revit `XYZ` coordinates are always in feet regardless of project display units | Revit pattern, Pitfall 4 | If project units are metric internally (not standard Revit behaviour), the 0.3048 conversion would double-convert and produce wrong values |
| A4 | pyRevit's CPython engine provides `json` module access and `open()` for file writing | Revit pattern | If pyRevit restricts file I/O in CPython mode, the script needs a different save mechanism |

---

## Open Questions

1. **What are the actual column headers in TSD's Solver Model Data Excel export?**
   - What we know: TSD exports node coordinates, DOFs, element properties [CITED: Tekla docs]
   - What's unclear: exact column header strings, sheet names, whether multiple export steps are needed
   - Recommendation: Treat the configurable COLUMN_MAP as a required user step; provide a sample header-discovery script that prints all sheet names and headers from a given .xlsx

2. **Does TSD export support conditions in the same Excel file as geometry?**
   - What we know: TSD supports fixed, pinned, roller boundary conditions
   - What's unclear: whether a single Excel export includes both geometry and boundary conditions, or requires separate exports
   - Recommendation: Initial converter handles geometry only; boundary conditions are documented as requiring manual entry in the browser UI after load

3. **Which pyRevit version is the user running, and does it support CPython?**
   - What we know: pyRevit 4.8+ supports CPython; IronPython 2.7 is the default
   - What's unclear: actual installed version; whether `json` stdlib is available in IronPython 2.7 (it is, as of IronPython 2.7.4+)
   - Recommendation: Write script to be compatible with both IronPython 2.7 and CPython 3.x; use only `json`, `os`, `sys` from stdlib

4. **How should the truss2d `canvas` section differ from frame2d?**
   - What we know: truss2d has `loads` (not `nodeLoads`), no `members.type`, no UDL, no pinLeft/Right
   - What's unclear: whether the canvas schema for truss2d needs explicit documenting or can be inferred from the codebase
   - Recommendation: Read `ui/truss2d/script.js` lines 147–160 (`saveHistory`) to confirm exact truss2d canvas state shape before implementing

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.10 | Converters, tests | Yes | 3.10.11 | — |
| pytest | Tests | Yes | 9.0.2 | — |
| httpx | API integration tests | Yes | 0.28.1 | — |
| openpyxl | Tekla converter | No | — | Install: `pip3 install openpyxl` |
| Revit (any version) | Revit exporter | Unknown | — | Script is offline deliverable; cannot test without Revit |
| pyRevit | Revit exporter | Unknown | — | Script is offline deliverable; cannot test without pyRevit |

**Missing dependencies with no fallback:**
- Revit + pyRevit: The Revit exporter cannot be executed or tested in this environment. Deliver as a well-documented script; test is a documentation/code-review verification only.

**Missing dependencies with fallback:**
- openpyxl: Simple `pip3 install openpyxl`. Add to a `requirements-dev.txt` (not to solver_core).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | none (auto-discovered) |
| Quick run command | `python3 -m pytest tests/ -x -q` |
| Full suite command | `python3 -m pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTERCHANGE-01 | Save produces valid JSON matching schema | unit | `pytest tests/test_interchange.py::test_save_schema_structure -x` | No — Wave 0 |
| INTERCHANGE-01 | Load round-trip restores all canvas state | unit | `pytest tests/test_interchange.py::test_load_roundtrip_frame2d -x` | No — Wave 0 |
| INTERCHANGE-02 | Saved JSON POSTed to `/solve/frame2d` produces same result as direct solve | integration | `pytest tests/test_interchange.py::test_saved_json_is_solve_ready -x` | No — Wave 0 |
| INTERCHANGE-02 | Saved JSON POSTed to `/solve/truss2d` produces same result as direct solve | integration | `pytest tests/test_interchange.py::test_saved_json_is_solve_ready_truss -x` | No — Wave 0 |
| INTERCHANGE-03 | Tekla converter produces valid schema from fixture Excel file | unit | `pytest tests/test_tekla_converter.py -x` | No — Wave 0 |
| INTERCHANGE-04 | Revit exporter script syntax is valid Python | manual | `python3 -m py_compile pyrevit_exporters/export_to_pda.py` | No — Wave 0 |
| INTERCHANGE-05 | Loaded file JSON is human-readable (prettified) | manual | Code review / visual inspection | No — trivial |

### Test Strategy for External Tool Converters

External tool tests (Tekla, Revit) cannot connect to a live TSD or Revit instance. Use fixture files:
- `tests/fixtures/sample_tsd_export.xlsx` — a hand-crafted minimal Excel file with the expected column headers and 3 nodes, 2 members. No actual TSD license needed.
- `tests/fixtures/sample_pda_frame2d.json` — a known-good saved file for round-trip tests.

The round-trip test (INTERCHANGE-02) uses FastAPI's `TestClient` (via httpx which is already installed):

```python
# tests/test_interchange.py
from fastapi.testclient import TestClient
from api_server.app import app

client = TestClient(app)

def test_saved_json_is_solve_ready():
    import json
    with open("tests/fixtures/sample_pda_frame2d.json") as f:
        model = json.load(f)
    # Extract the solve payload section (top-level fields, not 'canvas')
    payload = {k: v for k, v in model.items() if k not in ("schema_version", "canvas")}
    payload["solver"] = "frame_v2"
    resp = client.post("/solve/frame2d", json=payload)
    assert resp.status_code == 200
    result = resp.json()
    assert "UG" in result
    assert "member_moments" in result
```

### Sampling Rate
- **Per task commit:** `python3 -m pytest tests/test_interchange.py -x -q`
- **Per wave merge:** `python3 -m pytest tests/ -v`
- **Phase gate:** Full suite green (all 20 existing + new interchange tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_interchange.py` — covers INTERCHANGE-01, INTERCHANGE-02
- [ ] `tests/test_tekla_converter.py` — covers INTERCHANGE-03
- [ ] `tests/fixtures/sample_tsd_export.xlsx` — minimal hand-crafted fixture (3 nodes, 2 members)
- [ ] `tests/fixtures/sample_pda_frame2d.json` — known-good cantilever model for round-trip test
- [ ] `tests/fixtures/sample_pda_truss2d.json` — known-good simple truss for round-trip test

---

## Security Domain

This phase handles file I/O (user-uploaded JSON, user-selected Excel). Security controls:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes | Validate `schema_version`, `solver`, required fields before using loaded data |
| V5 File Upload | Yes (Tekla CLI) | CLI script runs locally; no server-side file upload attack surface in this phase |
| V6 Cryptography | No | No encryption required |
| V2 Authentication | No | No auth in this phase |

### Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON with prototype pollution | Tampering | `JSON.parse()` in browser is safe; no `eval()`; validate required fields before using |
| Oversized JSON file causing browser freeze | DoS | Not mitigated in this phase — out of scope; Phase 3 loads engineer-generated files, not untrusted uploads |
| Excel file with macro/formula injection (`=CMD(...)`) | Tampering | openpyxl with `data_only=True` returns cell values, not formulas — macros are not executed |

---

## Project Constraints (from CLAUDE.md)

These directives apply to all Phase 3 implementation:

| Directive | Applies To | Action |
|-----------|-----------|--------|
| `solver_core` must have NO matplotlib, NO printing in computation path | All | Converter scripts live outside solver_core; no constraint on them |
| No new dependencies in `solver_core/pyproject.toml` | Tekla converter | openpyxl goes in `requirements-dev.txt` only, never in pyproject.toml |
| DOF numbering: 1-based in public API (models, restrainedDoF) | Schema design | `members` array must use 1-based node indices; `restrainedDoF` must be 1-based |
| Visualization is always a leaf | All | Not relevant to this phase |
| New solvers must be registered via engine.register() | All | No new solvers in this phase |
| Test pattern: analytical verification | Tests | Use known structural cases (cantilever, simple beam) as fixture models for round-trip tests |

---

## Sources

### Primary (HIGH confidence)
- `ui/frame2d/script.js` — existing `createDownloadLink`, `saveHistory`, solve payload assembly, all verified line-by-line
- `api_server/app.py` — `Frame2DRequest`, `Truss2DRequest` Pydantic models, solver registration
- `solver_core/pyproject.toml` — confirms `numpy` is the only runtime dependency
- MDN Web Docs (FileReader API) — `FileReader.readAsText()`, `change` event reset pattern [CITED: standard browser API]
- Autodesk Revit 2024 API docs [CITED: help.autodesk.com/view/RVT/2024/ENU] — AnalyticalMember replacing AnalyticalModel in Revit 2023+

### Secondary (MEDIUM confidence)
- Tekla Structural Designer 2025 docs [CITED: support.tekla.com/doc/tekla-structural-designer/2025/ana_tabular_solver_model_data] — confirms node/element data categories but not exact column names
- openpyxl PyPI [CITED: pypi.org/project/openpyxl/] — current version, .xlsx support confirmed
- pyRevit docs [CITED: docs.pyrevitlabs.io] — IronPython/CPython engine support confirmed

### Tertiary (LOW confidence — marked [ASSUMED] above)
- TSD column header stability and sheet structure — not verified against actual TSD export
- Revit internal unit (feet) behaviour — widely documented community knowledge but not verified in this session
- pyRevit file I/O access in CPython mode — standard Python capability, assumed available

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all JS patterns verified in codebase; openpyxl well-documented
- Architecture — JS save/load: HIGH — direct reuse of existing patterns
- Architecture — Tekla converter: MEDIUM — openpyxl pattern is solid; TSD column format is LOW confidence
- Architecture — Revit exporter: LOW — Revit API is well-documented but cannot be tested in this environment
- Pitfalls: HIGH for JS patterns (verified); MEDIUM for converter pitfalls (assumed from general knowledge)

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (Tekla/Revit API sections — check for version changes; JS FileReader API is stable)
