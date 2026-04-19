# Phase 3: Interchange Format and External Inputs - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 9 new/modified files
**Analogs found:** 7 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/frame2d/script.js` (modified) | component | file-I/O | `ui/truss2d/script.js` | exact |
| `ui/frame2d/index.html` (modified) | config/view | request-response | `ui/truss2d/index.html` | exact |
| `ui/truss2d/script.js` (modified) | component | file-I/O | `ui/frame2d/script.js` | exact |
| `ui/truss2d/index.html` (modified) | config/view | request-response | `ui/frame2d/index.html` | exact |
| `converters/tekla_to_pda.py` | utility | batch/transform | `solver_core/src/pda_analysis_software/adapters/truss_adapters.py` | partial (transform role) |
| `pyrevit_exporters/export_to_pda.py` | utility | batch/transform | `converters/tekla_to_pda.py` (sibling, new) | no analog |
| `tests/test_interchange.py` | test | request-response | `tests/test_truss2d.py` | role-match |
| `tests/test_tekla_converter.py` | test | batch/transform | `tests/test_truss2d.py` | role-match |
| `tests/fixtures/` (new files) | config | — | `tests/test_truss2d.py` fixture pattern | partial |

---

## Pattern Assignments

### `ui/frame2d/script.js` (modified — add `saveModel`, `triggerLoad`, file input handler)

**Analog:** `ui/frame2d/script.js` itself (existing functions `createDownloadLink`, `saveHistory`, payload assembly, `confirm()`)

**Download / Blob pattern** (`ui/frame2d/script.js` lines 1109–1138):
```javascript
function createDownloadLink(res) {
  if (_lastBlobUrl) URL.revokeObjectURL(_lastBlobUrl);
  const json = JSON.stringify(res, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  _lastBlobUrl = URL.createObjectURL(blob);

  const now = new Date();
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0');
  const filename = (res.solver || 'results') + '-results-' + ts + '.json';

  const a = document.createElement('a');
  a.href = _lastBlobUrl;
  a.download = filename;
  // ... style and return a
}
```
`saveModel()` must follow this exact pattern: create `Blob`, call `URL.createObjectURL`, programmatically `.click()` a temporary anchor, then `URL.revokeObjectURL`. Do NOT append the anchor to the results panel — append to `document.body`, click, then immediately remove it (results panel anchor is for persistent links; save is fire-and-forget).

**Canvas state deep-clone pattern** (`ui/frame2d/script.js` lines 239–248):
```javascript
function saveHistory() {
  history.push({
    nodes:     JSON.parse(JSON.stringify(nodes)),
    members:   JSON.parse(JSON.stringify(members)),
    supports:  JSON.parse(JSON.stringify(supports)),
    nodeLoads: JSON.parse(JSON.stringify(nodeLoads)),
    origin:    origin ? { ...origin } : null,
    currentMemberStart: currentMemberStart ? { ...currentMemberStart } : null,
  });
}
```
`saveModel()` canvas section must capture exactly these same state objects: `nodes`, `members`, `supports`, `nodeLoads`, and `origin`. `origin` is a top-level JS variable (line 18: `let origin = null`) — it is NOT part of `nodes` and must be saved explicitly.

**Solve payload assembly** (`ui/frame2d/script.js` lines 388–398):
```javascript
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
This is the exact solve payload block to embed in the save file. Note: `solver` in the file's top-level metadata is `"frame2d"` (routing key), but this `payload.solver` field is `"frame_v2"` (the registered engine name). These are two different fields in the saved JSON.

**confirm() pattern** (`ui/frame2d/script.js` line 272):
```javascript
function resetAll() {
  if (!confirm('Reset everything?')) return;
  // ...
}
```
Load uses the same single-line guard: `if (nodes.length > 0 && !confirm("This will replace the current structure. Continue?")) return;`

**Save button disabled state:** Save/Load buttons are stateless actions, not modes. Do NOT use `setMode()` or `data-mode` for them. Use plain `onclick` click handlers. Disable save when canvas is empty: check `nodes.length === 0` in the save handler or via a helper.

---

### `ui/frame2d/index.html` (modified — add Save/Load toolbar buttons and hidden file input)

**Analog:** `ui/frame2d/index.html` existing toolbar sections (lines 19–156)

**Toolbar section pattern** (lines 69–75, the Edit section):
```html
<section class="panel-section">
  <h3>Edit</h3>
  <button class="tool-btn" data-mode="editNode" onclick="setMode('editNode')" title="...">✏️ Edit Node</button>
  <button class="tool-btn" onclick="undoLastAction()">↩️ Undo</button>
  <button class="tool-btn" data-mode="delete" onclick="setMode('delete')" title="...">🗑 Delete</button>
  <button class="tool-btn danger" onclick="resetAll()">🔄 Reset All</button>
</section>
```
Save/Load buttons do NOT use `data-mode` — they are stateless actions like `undoLastAction()`. Add them as a new `<section class="panel-section">` with `<h3>File</h3>`. Place between the Edit section and the Material Properties section.

**Hidden file input pattern** (new, no existing analog — standard browser pattern):
```html
<input type="file" id="fileInput" accept=".json" style="display:none">
```
Place this `<input>` element anywhere in `<body>` — convention is near the bottom before the `<script>` tag. The Load button's `onclick` calls `document.getElementById('fileInput').click()` to trigger the native file picker.

---

### `ui/truss2d/script.js` (modified — add `saveModel`, `triggerLoad`, file input handler)

**Analog:** `ui/truss2d/script.js` itself — same pattern as frame2d but with truss2d state shape.

**Truss2D state differs from frame2d** (`ui/truss2d/script.js` lines 147–156):
```javascript
function saveHistory() {
  history.push({
    nodes:    JSON.parse(JSON.stringify(nodes)),
    members:  JSON.parse(JSON.stringify(members)),
    supports: JSON.parse(JSON.stringify(supports)),
    loads:    JSON.parse(JSON.stringify(loads)),   // NOTE: "loads" not "nodeLoads"
    origin:   origin ? { ...origin } : null,
    currentMemberStart: currentMemberStart ? { ...currentMemberStart } : null,
  });
}
```
Truss2D uses `loads` (not `nodeLoads`). The canvas section of the truss2d save file must use `loads`.

**Truss2D solve payload** (`ui/truss2d/script.js` lines 256–263):
```javascript
const payload = {
  solver: 'truss2d',
  nodes:  nodes.map(n => [n.realX, n.realY]),
  members: members.map(m => [m.start + 1, m.end + 1]),  // 1-based
  E, A,
  forceVector,
  restrainedDoF,
};
```
Much simpler than frame2d — no ENForces, ENMoments, I, bars, beamPin*, springDoF. The truss2d save file's top-level metadata uses `"solver": "truss2d"`.

**Download pattern** (`ui/truss2d/script.js` lines 658–687): Identical to frame2d's `createDownloadLink`. Copy the same Blob/anchor pattern verbatim, adjusting only the filename prefix to `truss2d-model-`.

---

### `ui/truss2d/index.html` (modified — add Save/Load toolbar buttons and hidden file input)

**Analog:** `ui/truss2d/index.html` existing toolbar (lines 18–94)

**Toolbar section pattern** (lines 48–55, the Edit section):
```html
<section class="panel-section">
  <h3>Edit</h3>
  <button class="tool-btn" data-mode="editNode" onclick="setMode('editNode')" title="...">✏️ Edit Node</button>
  <button class="tool-btn" onclick="undoLastAction()">↩️ Undo</button>
  <button class="tool-btn" data-mode="delete" onclick="setMode('delete')" title="...">🗑 Delete</button>
  <button class="tool-btn" onclick="resetView()">🔍 Reset View</button>
  <button class="tool-btn danger" onclick="resetAll()">🔄 Reset All</button>
</section>
```
Add a new `<section class="panel-section">` with `<h3>File</h3>` between Edit and Material Properties. Add hidden `<input type="file" id="fileInput" accept=".json" style="display:none">` before the `<script>` tag.

---

### `converters/tekla_to_pda.py` (new — standalone Python CLI)

**Analog:** `solver_core/src/pda_analysis_software/adapters/truss_adapters.py` (partial — same transform-and-emit-dict role, different data source)

**Adapter transform pattern** (`solver_core/src/pda_analysis_software/adapters/truss_adapters.py`) as structural reference — the converter is the Python analog of an adapter: read raw input, map to canonical schema, return a dict/object.

**Python CLI entry-point pattern** (stdlib idiom, no existing analog in repo):
```python
import json
import sys

def convert(xlsx_path: str) -> dict:
    # ... openpyxl parsing ...
    return { "schema_version": "1.0", "solver": "frame2d", ... }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tekla_to_pda.py <path_to_tsd_export.xlsx>", file=sys.stderr)
        sys.exit(1)
    result = convert(sys.argv[1])
    print(json.dumps(result, indent=2))
```

**openpyxl sheet-reading pattern** (from RESEARCH.md — no codebase analog):
```python
import openpyxl

def read_sheet_as_dicts(ws):
    """Return list of row dicts keyed by header row values, skipping blank rows."""
    headers = [cell.value for cell in ws[1]]
    return [
        {headers[i]: row[i].value for i in range(len(headers))}
        for row in ws.iter_rows(min_row=2)
        if any(cell.value is not None for cell in row)
    ]

wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
```
`read_only=True` skips formatting (faster). `data_only=True` returns cell values, not formula strings — also prevents macro/formula injection.

**Node ID remapping pattern** (critical — TSD IDs are database keys, not array indices):
```python
# Build index map: TSD node ID -> 0-based array index
node_rows = read_sheet_as_dicts(wb[COLUMN_MAP["nodes_sheet"]])
tsd_id_to_index = {}
nodes = []
for row in node_rows:
    tsd_id = row[COLUMN_MAP["node_id"]]
    idx = len(nodes)
    tsd_id_to_index[tsd_id] = idx
    nodes.append([float(row[COLUMN_MAP["node_x"]]), float(row[COLUMN_MAP["node_y"]])])

# Members use remapped indices (1-based for PDA API)
member_rows = read_sheet_as_dicts(wb[COLUMN_MAP["members_sheet"]])
members = []
for row in member_rows:
    si = tsd_id_to_index[row[COLUMN_MAP["member_start"]]] + 1  # 1-based
    ei = tsd_id_to_index[row[COLUMN_MAP["member_end"]]]   + 1
    members.append([si, ei])
```

**Configurable COLUMN_MAP** (top of file, user-editable):
```python
# Adjust these to match your TSD export's actual column headers and sheet names.
COLUMN_MAP = {
    "nodes_sheet":   "Nodes",
    "node_id":       "Node",
    "node_x":        "X (m)",
    "node_y":        "Y (m)",
    "members_sheet": "Elements",
    "member_id":     "Element",
    "member_start":  "Start Node",
    "member_end":    "End Node",
    "member_E":      "E (kN/m2)",
    "member_I":      "I (m4)",
    "member_A":      "A (m2)",
}
```

---

### `pyrevit_exporters/export_to_pda.py` (new — PyRevit script, runs inside Revit)

**Analog:** None in codebase. Pattern entirely from RESEARCH.md.

**PyRevit/Revit API pattern** (IronPython 2.7 / CPython compatible):
```python
# Compatible with IronPython 2.7 and CPython 3.x — use only json, os, sys from stdlib
import json
from Autodesk.Revit.DB import FilteredElementCollector, AnalyticalMember
from pyrevit import forms, script

doc = __revit__.ActiveUIDocument.Document

# Revit 2023+ API: use AnalyticalMember, NOT element.GetAnalyticalModel() (removed in 2023)
members_col = FilteredElementCollector(doc).OfClass(AnalyticalMember).ToElements()
```

**Feet-to-metres conversion** (critical — Revit XYZ is always in feet):
```python
FEET_TO_METRES = 0.3048

def xyz_to_metres(xyz):
    return [round(xyz.X * FEET_TO_METRES, 4), round(xyz.Y * FEET_TO_METRES, 4)]
```

**Node deduplication pattern**:
```python
def get_or_add_node(xyz, nodes_list, tol=1e-3):
    """Return 0-based index of existing node within tol, or append new node."""
    pt = xyz_to_metres(xyz)
    for i, n in enumerate(nodes_list):
        if abs(n[0] - pt[0]) < tol and abs(n[1] - pt[1]) < tol:
            return i
    nodes_list.append(pt)
    return len(nodes_list) - 1
```

**PyRevit file save pattern**:
```python
save_path = forms.save_file(file_ext='json')
if save_path:
    with open(save_path, 'w') as f:
        json.dump(output, f, indent=2)
    script.get_output().print_md("Exported {} nodes, {} members.".format(len(nodes), len(members)))
```

---

### `tests/test_interchange.py` (new — integration tests for save/load round-trip)

**Analog:** `tests/test_truss2d.py` (role-match: same pytest structure, `@pytest.fixture`, `pytest.approx`)

**Test file header pattern** (`tests/test_truss2d.py` lines 1–14):
```python
"""
Tests for the 2D truss solver.

Analytical reference cases:
  - Single horizontal bar under axial load
  ...
"""

import numpy as np
import pytest

from pda_analysis_software.solvers.truss2d import Truss
from pda_analysis_software.adapters.truss_adapters import Truss2DAdapter
from pda_analysis_software.models.truss2d_model import TrussModel2D
```
`test_interchange.py` uses `from fastapi.testclient import TestClient` and `from api_server.app import app` instead of solver imports.

**FastAPI TestClient pattern** (from RESEARCH.md — `httpx` already installed):
```python
from fastapi.testclient import TestClient
from api_server.app import app
import json

client = TestClient(app)

def test_saved_json_is_solve_ready():
    with open("tests/fixtures/sample_pda_frame2d.json") as f:
        model = json.load(f)
    # Extract solve payload: all top-level fields except schema metadata and canvas
    payload = {k: v for k, v in model.items() if k not in ("schema_version", "canvas")}
    payload["solver"] = "frame_v2"   # file uses "frame2d"; API engine uses "frame_v2"
    resp = client.post("/solve/frame2d", json=payload)
    assert resp.status_code == 200
    result = resp.json()
    assert "UG" in result
    assert "member_moments" in result
```

**Pytest fixture pattern** (`tests/test_truss2d.py` lines 34–43):
```python
@pytest.fixture
def horizontal_bar_truss():
    return Truss(
        nodes=[[0.0, 0.0], [L, 0.0]],
        members=[[1, 2]],
        E=E, A=A,
        forceVector=[0.0, 0.0, 1000.0, 0.0],
        restrainedDoF=[1, 2, 4],
    )
```
Use `@pytest.fixture` for reusable JSON model dicts loaded from fixture files.

**Analytical verification pattern** (`tests/test_truss2d.py` lines 46–59):
```python
def test_truss_displacements(horizontal_bar_truss):
    t = horizontal_bar_truss
    t.solve_displacements()
    expected_u2x = 1000.0 * L / (E * A)  # 5e-7 m
    assert t.UG[2, 0] == pytest.approx(expected_u2x, rel=1e-9)
```
Round-trip tests must use a known cantilever or simple beam fixture and assert the loaded+solved result matches the expected analytical value, not just `status_code == 200`.

---

### `tests/test_tekla_converter.py` (new — unit tests for the Tekla CLI converter)

**Analog:** `tests/test_truss2d.py` (role-match: pytest structure)

**Fixture file pattern** — test creates a minimal in-memory Excel workbook (no actual TSD needed):
```python
import pytest
import openpyxl
import io
from converters.tekla_to_pda import convert, read_sheet_as_dicts, COLUMN_MAP

@pytest.fixture
def minimal_tsd_xlsx(tmp_path):
    """Hand-crafted Excel with 3 nodes, 2 members in the expected TSD column format."""
    wb = openpyxl.Workbook()
    ws_nodes = wb.active
    ws_nodes.title = "Nodes"
    ws_nodes.append(["Node", "X (m)", "Y (m)"])
    ws_nodes.append([1, 0.0, 0.0])
    ws_nodes.append([2, 3.0, 0.0])
    ws_nodes.append([3, 3.0, 3.0])
    ws_members = wb.create_sheet("Elements")
    ws_members.append(["Element", "Start Node", "End Node", "E (kN/m2)", "I (m4)", "A (m2)"])
    ws_members.append([1, 1, 2, 200e6, 1e-4, 0.01])
    ws_members.append([2, 2, 3, 200e6, 1e-4, 0.01])
    path = tmp_path / "tsd_export.xlsx"
    wb.save(path)
    return str(path)
```

---

### `tests/fixtures/sample_pda_frame2d.json` and `tests/fixtures/sample_pda_truss2d.json` (new)

**Analog:** `tests/test_frame_v2.py` cantilever fixture (lines 37–47) — use the same cantilever model geometry.

The fixture JSON files must be hand-crafted JSON matching the canonical schema (D-04). Use the cantilever from `test_frame_v2.py`: nodes `[[0,0],[1,0]]`, fixed support at node 1, point load at node 2. This gives a known analytical answer (`Uy2 = -FL³/3EI`) for the round-trip assertion.

---

## Shared Patterns

### Blob/download pattern
**Source:** `ui/frame2d/script.js` lines 1109–1138  
**Apply to:** `saveModel()` in both `ui/frame2d/script.js` and `ui/truss2d/script.js`
```javascript
const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
const url  = URL.createObjectURL(blob);
const a    = document.createElement('a');
a.href = url;
a.download = `frame2d-model-${ts}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

### confirm() guard pattern
**Source:** `ui/frame2d/script.js` line 272 (`resetAll`) and `ui/truss2d/script.js` line 181  
**Apply to:** Load handler in both UIs before overwriting canvas state  
```javascript
if (nodes.length > 0 && !confirm("This will replace the current structure. Continue?")) return;
```

### FileReader + file input reset pattern
**Source:** MDN (no existing codebase analog)  
**Apply to:** Load file input handler in both UIs  
```javascript
document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) { /* parse and restore */ };
  reader.readAsText(file);
  e.target.value = '';   // CRITICAL: reset so same file can be re-selected
});
```

### JSON schema validation guard
**Source:** No existing analog — apply to load handler in both UIs  
**Apply to:** Both load handlers, before restoring state  
```javascript
let data;
try {
  data = JSON.parse(evt.target.result);
} catch {
  alert("Could not read file. Make sure it is a valid PDA JSON file.");
  return;
}
if (!data.schema_version || !data.solver || !data.nodes || !data.members) {
  alert("File is missing required fields. The file may be from an older version.");
  return;
}
if (data.solver !== 'frame2d') {   // or 'truss2d' in the truss UI
  alert("This file is for the " + data.solver + " solver and cannot be loaded here.");
  return;
}
```

### syncPixelFromReal — must call after restoring origin
**Source:** `ui/frame2d/script.js` lines 305–309  
**Apply to:** Load handler in frame2d UI — call after setting `origin` and `nodes`  
```javascript
function syncPixelFromReal(node) {
  if (!origin) return;
  node.x = origin.x + (node.realX / UNIT) * GRID;
  node.y = origin.y - (node.realY / UNIT) * GRID;
}
// In load handler:
origin  = data.canvas.origin;
nodes   = data.canvas.nodes;
nodes.forEach(syncPixelFromReal);   // restore pixel coords from real coords + origin
```

### TestClient import pattern
**Source:** RESEARCH.md (httpx already installed at 0.28.1)  
**Apply to:** `tests/test_interchange.py`  
```python
from fastapi.testclient import TestClient
from api_server.app import app
client = TestClient(app)
```

### Python CLI entry-point guard
**Source:** stdlib idiom — no existing codebase analog  
**Apply to:** `converters/tekla_to_pda.py`  
```python
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tekla_to_pda.py <export.xlsx>", file=sys.stderr)
        sys.exit(1)
    result = convert(sys.argv[1])
    print(json.dumps(result, indent=2))
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `pyrevit_exporters/export_to_pda.py` | utility | batch/transform | No Revit/PyRevit scripts exist in the repo; Revit API is an external runtime unavailable in this environment |

The Revit exporter pattern comes entirely from RESEARCH.md. The planner should reference RESEARCH.md Pattern 5 (lines 293–343) for the `FilteredElementCollector`, `AnalyticalMember`, and `forms.save_file` patterns.

---

## Critical Notes for Planner

1. **`solver` field disambiguation:** The file schema's top-level `"solver"` (`"frame2d"` / `"truss2d"`) is for load-time routing and validation. The API payload's `"solver"` field (`"frame_v2"` / `"truss2d"`) is the engine-registered name. When stripping `canvas` and `schema_version` before POSTing, also ensure `payload.solver` is set to the engine name, not the file-level routing name.

2. **`origin` is not inside `nodes`:** It is a separate top-level JS variable (frame2d line 18, truss2d line 31). It must be explicitly saved and restored, or the canvas will be blank after load even though the solve payload is valid.

3. **Unit split in canvas vs solve payload:** `canvas.memberOverrides` stores `{E_GPa, I_cm4, A_cm2}` (UI display units). The top-level `E`, `I`, `A` fields in the solve payload are always SI units (Pa, m⁴, m²). Two representations in one file — never mix them.

4. **openpyxl is not installed:** `pip3 install openpyxl` required before running converter or its tests. Must NOT be added to `solver_core/pyproject.toml` — add to a `requirements-dev.txt` at the project root.

5. **Revit exporter cannot be run-tested:** Deliver as a documented script; test is `python3 -m py_compile pyrevit_exporters/export_to_pda.py` only.

---

## Metadata

**Analog search scope:** `ui/frame2d/`, `ui/truss2d/`, `tests/`, `api_server/`, `solver_core/src/pda_analysis_software/adapters/`
**Files scanned:** 9 source files read
**Pattern extraction date:** 2026-04-18
