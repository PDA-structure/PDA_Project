# Phase 3: Model Evolution and UX Polish - Research

**Researched:** 2026-04-12
**Domain:** Python dataclass union types, FEM solver per-member arrays, section property geometry, browser Blob/download API, canvas overlay rendering
**Confidence:** HIGH — all findings verified against live codebase and installed packages

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Extend Pydantic request model with `E: Union[float, List[float]]`, `I: Union[float, List[float]]`, `A: Union[float, List[float]]`. No new endpoint, no versioning.
- **D-02:** `FrameV2Adapter` owns broadcast logic: scalar → `[value] * n_members`. Solver receives per-member arrays.
- **D-03:** Existing tests must pass without modification after the change.
- **D-04:** Click a member to open its properties panel (prompt-based, same as UDL pattern). Per-member E, I, A overrides.
- **D-05:** Unset member properties fall back to global E/I/A. Payload uses float for uniform, list when at least one override.
- **D-06:** Section property calculator is a permanent sidebar panel (always visible). Section type selector, dimension inputs, "Calculate" button, results below.
- **D-07:** Section types: Rectangle (`I = b·h³/12`, `A = b·h`), Circle (`I = π·d⁴/64`, `A = π·d²/4`), I-section (standard formula).
- **D-08:** Units: dimensions in mm; output I in cm⁴, output A in cm².
- **D-09:** Section property formulas implemented as standalone Python function in `solver_core/.../utils/section_properties.py`. UI duplicates formulas in JS.
- **D-10:** "Download results" link appears in results panel of both frame2d and truss2d UI after a successful solve.
- **D-11:** Export content: full `AnalysisResult` fields as returned by API — `solver`, `UG`, `FG`, `member_forces`, `member_shears`, `member_moments`, `meta`. Arrays as lists.
- **D-12:** Filename: `{solver}-results-{timestamp}.json` (e.g., `frame2d-results-20260412-143022.json`).
- **D-13:** Toggle-able overlay shows node index (0-based) and 1-based DOF numbers. Label format: `N0 [1,2,3]`.
- **D-14:** Toggle via new "Node labels" checkbox in sidebar, same row pattern as `chkSFD`.
- **D-15:** Overlay drawn on canvas after main render. Does not interfere with node click/drag.
- **D-16:** Symbol size control: slider or numeric input in "Display" section, range 0.5× to 2.0×, default 1.0. Applies to node circles, support triangles, load arrows.

### Claude's Discretion
- Exact HTML/CSS layout of the section calculator sidebar panel
- Whether the section calculator JS duplicates Python formulas or calls a new API endpoint
- Exact canvas rendering approach for the node label overlay (font size, offset from node circle)
- Slider vs. numeric input for symbol size control
- Whether `section_properties.py` lives in `solver_core` utils or is a separate module

### Deferred Ideas (OUT OF SCOPE)
- Bending stress output (σ = M·c/I)
- Per-member properties for truss2d (Phase 4 or backlog)
- Export as CSV
- Auto-populate member fields from calculator result
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODEL-01 | Per-member E/I/A in `FrameModel2D` via Union type with scalar broadcast | Union type in dataclass + Pydantic v2 verified; solver needs Em/Im arrays (§Architecture Patterns: Per-Member Properties Flow) |
| MODEL-02 | Backward-compatible — existing UI and tests pass unchanged | All 10 existing tests use raw solver or scalar-only `FrameModel2D`; Union type is a superset of float; adapter broadcast keeps solver contract identical |
| MODEL-03 | Section property calculator as standalone utility (Python + JS) | Formulas verified numerically; I-section formula confirmed; unit conversion (mm→cm) documented |
| MODEL-04 | Frame2d and truss2d UI export solve results to JSON download | Blob API pattern confirmed; `renderResults()` is the correct injection point in both scripts |
| MODEL-05 | Node numbers and DOF labels visible in frame2d UI (toggle-able overlay) | Canvas draw order confirmed; checkbox pattern established; DOF formula verified |
</phase_requirements>

---

## Summary

Phase 3 has five requirements spanning solver internals, API types, a utility module, and two separate UI features. The research confirms all five are straightforward extensions of existing patterns with no new runtime dependencies.

The most surgical change is the per-member E/I/A work (MODEL-01, MODEL-02). The solver currently stores `self.E = float(E)` and `self.I = float(I)` and uses them in 5 places in `frame_v2.py`. These become `self.Em` and `self.Im` arrays, mirroring the already-existing `self.Am` per-member area pattern. The adapter broadcasts scalar inputs to lists before the solver sees them, so tests that call `BeamBarStructure_v2` directly with scalars are untouched. The one test that uses `FrameModel2D` via the adapter (`test_cantilever_adapter_pipeline`) keeps its scalar inputs — the Union type in the dataclass accepts float, and the adapter broadcasts.

The three UI features (MODEL-03, MODEL-04, MODEL-05) are all vanilla JS additions to existing files. The section calculator duplicates the Python formulas in JS (D-09 discretion confirmed). The download link uses the standard Blob API with `URL.createObjectURL`. The node label overlay follows the exact same checkbox toggle and canvas layering pattern as the existing BMD/SFD toggles.

**Primary recommendation:** Implement in this order: (1) solver per-member arrays, (2) adapter broadcast + model Union type, (3) API Pydantic update, (4) Python utility module, (5) UI features in parallel.

---

## Standard Stack

### Core (existing — do not change)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.10.11 | Runtime | Installed; required by pyproject.toml [VERIFIED: env] |
| numpy | 2.2.6 | FEM computation | Only solver dependency; `np.asarray`, `@` operator throughout [VERIFIED: env] |
| FastAPI | 0.135.0 | HTTP API | Installed; Pydantic v2 compatible [VERIFIED: env] |
| Pydantic | 2.12.5 | Request validation | v2 required for FastAPI 0.100+; handles Union cleanly [VERIFIED: env] |
| pytest | 9.0.2 | Test runner | Installed; analytical verification pattern established [VERIFIED: env] |

### No new dependencies required for this phase
All features are implementable with the current stack. The section calculator Python module uses only `math` (stdlib). The JS formulas use only arithmetic. The Blob download API is native browser. No `pip install` or `npm install` needed.

---

## Architecture Patterns

### Pattern 1: Per-Member Properties Flow

The existing `Am` (per-member area) array in `BeamBarStructure_v2` is the established template. E and I follow the same pattern.

**Current state (scalar-only):** [VERIFIED: frame_v2.py lines 69-70, 284, 309, 434, 438]
```python
# __init__
self.E = float(E)   # line 69 — scalar only
self.I = float(I)   # line 70 — scalar only

# _element_frame_global
Kl = self._K_local_frame_6x6(self.E, A, self.I, L)  # line 284

# _element_bar_global
k = self.E * A / L   # line 309

# _compute_member_actions (bar branch)
self.mbrForces[e] = (self.E * self.Am[e] / L) * float(ext)  # line 434

# _compute_member_actions (beam branch)
Kl = self._K_local_frame_6x6(self.E, A, self.I, L)  # line 438
```

**Required change — 5 targeted sites in `frame_v2.py`:**
```python
# __init__ — replace scalar storage with array, mirroring Am pattern
E_raw = E if isinstance(E, (list, np.ndarray)) else [float(E)] * self.n_members
I_raw = I if isinstance(I, (list, np.ndarray)) else [float(I)] * self.n_members
self.Em = np.asarray(E_raw, float)   # was: self.E = float(E)
self.Im = np.asarray(I_raw, float)   # was: self.I = float(I)

# _element_frame_global
Kl = self._K_local_frame_6x6(self.Em[e], A, self.Im[e], L)

# _element_bar_global
k = self.Em[e] * A / L

# _compute_member_actions (bar branch)
self.mbrForces[e] = (self.Em[e] * self.Am[e] / L) * float(ext)

# _compute_member_actions (beam branch)
Kl = self._K_local_frame_6x6(self.Em[e], A, self.Im[e], L)
```

**Note:** `self.n_members` is computed before these lines (line 96 in current code) — the order is safe. [VERIFIED: frame_v2.py line 96]

**Adapter broadcast** in `FrameV2Adapter.solve()`:
```python
n_members = len(self.model.members)
E_val = self.model.E
I_val = self.model.I
A_val = self.model.A

E_list = E_val if isinstance(E_val, list) else [E_val] * n_members
I_list = I_val if isinstance(I_val, list) else [I_val] * n_members
# A is Optional — handle None separately
if A_val is None:
    A_eff = None  # A_beam/A_bar path continues
elif isinstance(A_val, list):
    A_eff = A_val
else:
    A_eff = [A_val] * n_members

s = BeamBarStructure_v2(
    ...
    E=E_list,
    I=I_list,
    A=A_eff,
    ...
)
```

**Adapter stress fix** — `A_eff` becomes per-member array:
```python
# Current (scalar):
A_eff = self.model.A
member_stresses = member_forces_arr / A_eff  # works for scalar

# After change (per-member array):
A_eff_arr = np.array(A_list, float)  # shape (n_members,)
member_stresses = member_forces_arr / A_eff_arr  # element-wise, shape (n_members,)
```

**Pydantic model change in `api_server/app.py`:**
```python
from typing import Union, List  # Union already imported via List — add Union

class Frame2DRequest(BaseModel):
    E: Union[float, List[float]]    # was: E: float
    I: Union[float, List[float]]    # was: I: float
    A: Optional[Union[float, List[float]]] = None  # was: A: Optional[float] = None
```

Pydantic v2 accepts scalar for `Union[float, List[float]]` without a validator — verified. [VERIFIED: runtime test against Pydantic 2.12.5]

**FrameModel2D dataclass change:**
```python
from typing import Union, List  # add Union

E: Union[float, List[float]]    # was: E: float
I: Union[float, List[float]]    # was: I: float
A: Optional[Union[float, List[float]]] = None  # was: A: Optional[float] = None
```

Python dataclass accepts float for `Union[float, List[float]]` — no runtime changes, just type annotation. [VERIFIED: runtime test]

### Pattern 2: Per-Member UI (frame2d click → prompt)

Established pattern from UDL mode [VERIFIED: ui/frame2d/script.js lines 119-130]:
```javascript
} else if (mode === 'udl') {
  const mi = findMemberAt(px, py);
  if (mi !== null) {
    const mag = parseFloat(prompt('UDL magnitude in N/m (positive = downward):', ...));
    if (!isNaN(mag)) { members[mi].udl = mag; results = null; }
  }
```

Per-member E/I/A follows the same pattern with `mode === 'memberProps'`:
```javascript
} else if (mode === 'memberProps') {
  const mi = findMemberAt(px, py);
  if (mi !== null) {
    const m = members[mi];
    const E_input = prompt(`Member ${mi+1} — E (GPa), or leave blank to use global:`, m.E_override ?? '');
    if (E_input !== null && E_input.trim() !== '') {
      const val = parseFloat(E_input);
      if (!isNaN(val)) members[mi].E_override = val;
    }
    // repeat for I and A
    results = null;
    draw();
  }
```

Storage on member object: `members[mi].E_override = val | null`, same for `I_override`, `A_override`.

In the payload builder (before `fetch`), resolve per-member overrides:
```javascript
const E_global = parseFloat(document.getElementById('inputE').value);
const I_global = parseFloat(document.getElementById('inputI').value);
const A_global = parseFloat(document.getElementById('inputA').value);

// Check if any member has an override
const anyOverride = members.some(m => m.E_override != null || m.I_override != null || m.A_override != null);

const E_payload = anyOverride
  ? members.map(m => (m.E_override ?? E_global) * 1e9)   // GPa → Pa
  : E_global * 1e9;
const I_payload = anyOverride
  ? members.map(m => (m.I_override ?? I_global) * 1e-8)  // cm⁴ → m⁴
  : I_global * 1e-8;
const A_payload = anyOverride
  ? members.map(m => (m.A_override ?? A_global) * 1e-4)  // cm² → m²
  : A_global * 1e-4;
```

Override indicator on canvas (blue left-border effect approximated as a thicker colored stroke):
```javascript
// In drawMembers(), after normal line draw:
if (m.E_override != null || m.I_override != null || m.A_override != null) {
  ctx.save();
  ctx.strokeStyle = '#3f51b5';
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
  ctx.restore();
}
```

### Pattern 3: Section Property Calculator (Python + JS)

**Python utility** (`solver_core/src/pda_analysis_software/utils/section_properties.py`):
```python
import math
from typing import Tuple

def section_properties(section_type: str, **dims) -> Tuple[float, float]:
    """
    Returns (I_cm4, A_cm2) for a cross-section defined by dims in mm.
    
    section_type='rectangle': dims = b, h
    section_type='circle':    dims = d
    section_type='i_section': dims = b, H, tf, tw
    """
    if section_type == 'rectangle':
        b, h = dims['b'], dims['h']
        I_mm4 = b * h**3 / 12
        A_mm2 = b * h
    elif section_type == 'circle':
        d = dims['d']
        I_mm4 = math.pi * d**4 / 64
        A_mm2 = math.pi * d**2 / 4
    elif section_type == 'i_section':
        b, H, tf, tw = dims['b'], dims['H'], dims['tf'], dims['tw']
        hw = H - 2 * tf
        I_mm4 = b * H**3 / 12 - (b - tw) * hw**3 / 12
        A_mm2 = 2 * b * tf + tw * hw
    else:
        raise ValueError(f"Unknown section_type: {section_type!r}")
    
    I_cm4 = I_mm4 / 1e4   # mm⁴ → cm⁴
    A_cm2 = A_mm2 / 100   # mm² → cm²
    return I_cm4, A_cm2
```

Formulas verified numerically: [VERIFIED: runtime test]
- Rectangle 100×200 mm → I=6666.67 cm⁴, A=200.00 cm²
- Circle d=100 mm → I=490.87 cm⁴, A=78.54 cm²
- I-section b=100, H=200, tf=10, tw=8 → I=2195.47 cm⁴, A=34.40 cm²

The `utils/` directory does not yet exist — Wave 0 creates it with `__init__.py`.

**JS duplicates** (per D-09, no API call needed):
```javascript
function calcSection() {
  const type = document.getElementById('sectionType').value;
  let I_cm4, A_cm2;
  if (type === 'rectangle') {
    const b = parseFloat(document.getElementById('sec_b').value);
    const h = parseFloat(document.getElementById('sec_h').value);
    I_cm4 = b * Math.pow(h, 3) / 12 / 1e4;
    A_cm2 = b * h / 100;
  } else if (type === 'circle') {
    const d = parseFloat(document.getElementById('sec_d').value);
    I_cm4 = Math.PI * Math.pow(d, 4) / 64 / 1e4;
    A_cm2 = Math.PI * d * d / 4 / 100;
  } else {  // i_section
    const b = parseFloat(document.getElementById('sec_b').value);
    const H = parseFloat(document.getElementById('sec_H').value);
    const tf = parseFloat(document.getElementById('sec_tf').value);
    const tw = parseFloat(document.getElementById('sec_tw').value);
    const hw = H - 2 * tf;
    const I_mm4 = b*H*H*H/12 - (b-tw)*hw*hw*hw/12;
    I_cm4 = I_mm4 / 1e4;
    A_cm2 = (2*b*tf + tw*hw) / 100;
  }
  document.getElementById('secResultI').textContent = `I = ${I_cm4.toFixed(2)} cm⁴`;
  document.getElementById('secResultA').textContent = `A = ${A_cm2.toFixed(4)} cm²`;
}
```

Dynamic input visibility (show/hide input groups on `<select>` change):
```javascript
document.getElementById('sectionType').addEventListener('change', function() {
  document.querySelectorAll('.sec-inputs').forEach(el => el.style.display = 'none');
  document.getElementById('sec-' + this.value).style.display = '';
});
```

### Pattern 4: JSON Download (Blob API)

Standard browser Blob + createObjectURL pattern — no library needed. [ASSUMED — Blob API is a browser standard; behavior confirmed by W3C spec knowledge]

```javascript
function createDownloadLink(res) {
  const json = JSON.stringify(res, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  
  const now  = new Date();
  const ts   = now.getFullYear().toString()
    + String(now.getMonth()+1).padStart(2,'0')
    + String(now.getDate()).padStart(2,'0')
    + '-'
    + String(now.getHours()).padStart(2,'0')
    + String(now.getMinutes()).padStart(2,'0')
    + String(now.getSeconds()).padStart(2,'0');
  const filename = `${res.solver}-results-${ts}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.textContent = 'Download results (JSON)';
  a.style.color = '#1a2744';
  a.style.textDecoration = 'underline';
  a.addEventListener('mouseover', () => a.style.color = '#3f51b5');
  a.addEventListener('mouseout',  () => a.style.color = '#1a2744');
  return a;
}
```

Inject in `renderResults()` at the top of the results panel:
```javascript
function renderResults(res) {
  const panel = document.getElementById('resultsPanel');
  // Remove any existing download link
  const existing = panel.querySelector('.download-link');
  if (existing) existing.remove();
  
  const a = createDownloadLink(res);
  a.className = 'download-link';
  panel.insertBefore(a, panel.firstChild);
  
  // ... rest of existing renderResults logic unchanged ...
}
```

`URL.createObjectURL` memory management: the object URL persists until the page is unloaded or explicitly revoked with `URL.revokeObjectURL(url)`. For a structural analysis tool with infrequent solves, not revoking is acceptable. If revoking on next solve is desired, store the URL in a variable and revoke before creating a new one.

Applies identically to `ui/truss2d/script.js` — same pattern, same injection point.

### Pattern 5: Node Label Overlay (Canvas)

Canvas draw order established in CONTEXT.md and confirmed in `draw()` function: [VERIFIED: script.js lines 378-396]
```javascript
function draw() {
  // ... (existing) ...
  drawGrid();
  drawUDLs();      // conditional
  drawMembers();
  drawBMD();       // conditional
  drawSFD();       // conditional
  drawDeflected(); // conditional
  drawNodes();
  drawSupports();  // conditional
  drawNodeLoads(); // conditional
  // NEW: node label overlay — always last
  if (document.getElementById('chkNodeLabels').checked) drawNodeLabels();
}
```

Checkbox HTML (follows established pattern) [VERIFIED: script.js line 942]:
```html
<label class="checkbox-label">
  <input type="checkbox" id="chkNodeLabels"> Node labels
</label>
```

Event listener:
```javascript
document.getElementById('chkNodeLabels').addEventListener('change', draw);
```

Draw function:
```javascript
function drawNodeLabels() {
  ctx.font = '600 11px Arial';
  ctx.fillStyle = '#1a2744';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  nodes.forEach((n, i) => {
    const base = i * 3 + 1;
    const label = `N${i} [${base},${base+1},${base+2}]`;
    ctx.fillText(label, n.x + 8, n.y - 8);
  });
}
```

DOF formula: `base = i * 3 + 1` (0-based node index, 1-based DOF numbering) — matches the solver's DOF convention. [VERIFIED: CLAUDE.md frame solver conventions]

### Pattern 6: Symbol Size Control

Follows existing "Deflection scale ×" input (`id="inputScale"`) pattern [VERIFIED: script.js line 687]:
```html
<label class="panel-label">Symbol size ×
  <input type="number" id="inputSymbolScale" value="1.0" min="0.5" max="2.0" step="0.1">
</label>
```

```javascript
const sym = parseFloat(document.getElementById('inputSymbolScale').value) || 1.0;
// In drawNodes():
ctx.arc(n.x, n.y, 5 * sym, 0, Math.PI*2);
// In drawSupports(): multiply triangle size by sym
// In drawNodeLoads(): multiply arrowLen by sym
```

Event listener:
```javascript
document.getElementById('inputSymbolScale').addEventListener('input', draw);
```

Applies to both `ui/frame2d/script.js` and `ui/truss2d/script.js` independently — truss2d has equivalent draw functions.

### Anti-Patterns to Avoid

- **Passing Union type directly to solver:** The solver's `__init__` calls `float(E)` which will throw `TypeError: float() argument must be a string or a number, not 'list'`. The adapter MUST broadcast to list before calling `BeamBarStructure_v2`.
- **Broadcasting in Pydantic model_validator:** Tempting, but D-02 locks broadcast logic to the adapter. Pydantic just validates; adapter transforms.
- **Calling section calculator via API:** D-09 allows JS duplication — simpler, no round-trip latency, no new endpoint to maintain.
- **Using `innerHTML` injection for the download link:** Security risk (XSS if `res.solver` were ever user-provided). Use `createElement` + property assignment.
- **Drawing node labels before `drawNodes()`:** Labels would be covered by node circles. Must be last in draw order.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization for export | Custom serializer | `JSON.stringify(res)` | API already returns JSON-ready lists; no numpy arrays in browser |
| Blob download | iframe hack, server-side download | Browser Blob API + `URL.createObjectURL` | Native, no server round-trip, works offline |
| Per-member I in stiffness matrix | New solver class | Extend existing `Am` pattern to `Im` | Solver already has the per-member array infrastructure |
| Section formula I-section | Manual lookup table | Standard formula (see Pattern 3) | Closed-form, exact, 4 inputs only |
| Dynamic form fields for section calculator | Full JS form library | `display:none` toggle on `<div>` groups | 3 input groups, vanilla JS is sufficient |

---

## Common Pitfalls

### Pitfall 1: `self.E` still referenced after rename
**What goes wrong:** After renaming `self.E` to `self.Em`, any test or visualization code that accesses `solver_instance.E` will get `AttributeError`.
**Why it happens:** `self.E` is a public attribute; removing it is a breaking API change for anything that reads it.
**How to avoid:** Either keep `self.E` as a property (returning `self.Em[0]` or raising deprecation warning), or verify with a grep that nothing outside the solver reads `self.E` or `self.I` directly.
**Warning signs:** `AttributeError: 'BeamBarStructure_v2' object has no attribute 'E'` in test output.

Check: [VERIFIED: grep shows `self.E` only in frame_v2.py; test files access `cantilever.FG`, `cantilever.UG`, `cantilever.mbrForces`, `cantilever.mbrShears`, `cantilever.mbrMoments` — never `cantilever.E` or `cantilever.I`]

**Conclusion:** Safe to rename. No external consumer of `self.E` or `self.I` found.

### Pitfall 2: List length mismatch for per-member arrays
**What goes wrong:** User sends `E=[200e9]` (scalar wrapped in list) for a 3-member structure. Solver gets a 1-element array, `self.Em[2]` raises `IndexError`.
**Why it happens:** API accepts `List[float]` without length validation.
**How to avoid:** Add a length check in the adapter:
```python
if isinstance(E_val, list) and len(E_val) != n_members:
    raise ValueError(f"E list length {len(E_val)} != n_members {n_members}")
```
Or in a Pydantic `model_validator(mode='after')`.

### Pitfall 3: A=None when per-member A list provided
**What goes wrong:** `FrameModel2D` has `A: Optional[Union[float, List[float]]] = None`. When `A` is a list but `A_beam`/`A_bar` are also set, the adapter's area resolution logic is ambiguous.
**Why it happens:** Current solver constructor: "Provide either A (scalar) OR (A_beam and A_bar)" — this was strict scalar logic. The adapter must handle `A` being a list vs `A_beam`/`A_bar` being set.
**How to avoid:** Adapter priority rule: if `A` is set (float or list), it takes precedence over `A_beam`/`A_bar`. Only fall back to `A_beam`/`A_bar` when `A is None`. Document this in the adapter.

### Pitfall 4: Stress calculation uses wrong A after per-member change
**What goes wrong:** Adapter currently computes `member_stresses = member_forces_arr / A_eff` where `A_eff` is a scalar. After per-member A, `A_eff` must be an array.
**Why it happens:** The stress calc path (frame_adapters.py lines 39-44) doesn't know about per-member A yet.
**How to avoid:** After broadcasting A to `A_list`, build `A_eff_arr = np.array(A_list, float)` and use element-wise division. NumPy's `member_forces_arr / A_eff_arr` is element-wise for matching-shape 1D arrays.

### Pitfall 5: Canvas view transform affects node label position
**What goes wrong:** Node label is placed at `n.x + 8, n.y - 8` but the canvas uses `view.scale` and `view.tx/ty` transforms (zoom/pan). The `ctx.setTransform` is set before `draw()` calls, so all pixel coords go through the transform — labels DO scale with zoom, which is correct behavior.
**Why it happens:** The `ctx.setTransform(view.scale, 0, 0, view.scale, view.tx, view.ty)` is applied to `ctx` before all draw calls. Node pixel coords `n.x, n.y` are already in the pre-transform canvas space.
**How to avoid:** No special handling needed. Font size will appear to scale with zoom — this is correct. If a fixed-size overlay were wanted regardless of zoom, use `ctx.save(); ctx.setTransform(1,0,0,1,0,0); ...; ctx.restore()` but that requires converting world coords to screen coords manually. The simpler approach (scale with zoom) matches how node circles and member lines render.

### Pitfall 6: `URL.createObjectURL` leaks across multiple solves
**What goes wrong:** Each call to `renderResults()` creates a new Blob URL. After many solves, old URLs pile up in memory (though browsers garbage-collect them on page unload).
**Why it happens:** `URL.createObjectURL` allocates memory that isn't freed until `URL.revokeObjectURL` is called.
**How to avoid:** Store the last blob URL in a module-level variable and revoke before creating a new one:
```javascript
let _lastBlobUrl = null;
function createDownloadLink(res) {
  if (_lastBlobUrl) URL.revokeObjectURL(_lastBlobUrl);
  const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
  _lastBlobUrl = URL.createObjectURL(blob);
  // ...
}
```

---

## Code Examples

### Full per-member element stiffness call (solver)
```python
# Source: frame_v2.py _element_frame_global (modified)
def _element_frame_global(self, e, rel_i=False, rel_j=False):
    theta = self.orientations[e]
    L = self.lengths[e]
    c, s = math.cos(theta), math.sin(theta)
    A = self.Am[e]
    E = self.Em[e]   # per-member E
    I = self.Im[e]   # per-member I
    Kl = self._K_local_frame_6x6(E, A, I, L)
    T = self._T_frame(c, s)
    Kg = T.T @ Kl @ T
    # ... rest unchanged
```

### Adapter broadcast (complete)
```python
# Source: frame_adapters.py FrameV2Adapter.solve() (modified)
def solve(self) -> AnalysisResult:
    n = len(self.model.members)
    
    E_raw = self.model.E
    I_raw = self.model.I
    A_raw = self.model.A
    
    E_list = E_raw if isinstance(E_raw, list) else [float(E_raw)] * n
    I_list = I_raw if isinstance(I_raw, list) else [float(I_raw)] * n
    
    if A_raw is None:
        A_list = None  # A_beam/A_bar path
    elif isinstance(A_raw, list):
        A_list = A_raw
    else:
        A_list = [float(A_raw)] * n
    
    if len(E_list) != n or len(I_list) != n:
        raise ValueError(f"E/I list length must equal n_members={n}")
    if A_list is not None and len(A_list) != n:
        raise ValueError(f"A list length must equal n_members={n}")
    
    s = BeamBarStructure_v2(
        nodes=self.model.nodes,
        members=self.model.members,
        ENForces=self.model.ENForces,
        ENMoments=self.model.ENMoments,
        force_vector=self.model.forceVector,
        E=E_list,
        I=I_list,
        A=A_list,
        # ... rest unchanged
    )
    s.solve_structure()
    
    # Stress calc — per-member A
    A_eff_arr = np.array(s.Am, float)  # Am is already built inside solver
    member_forces_arr = np.array(s.mbrForces, float) if s.mbrForces is not None else None
    member_stresses = member_forces_arr / A_eff_arr if member_forces_arr is not None else None
    
    return AnalysisResult(...)
```

Note: `s.Am` is the already-resolved per-member area array inside the solver — use it directly for stress to avoid re-implementing the A_beam/A_bar resolution logic.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global scalar E/I for all members | Per-member Em/Im arrays (mirroring Am) | Phase 3 | Enables mixed-section frames (steel column + concrete beam) |
| Uniform section properties only | Per-member overrides with global fallback | Phase 3 | More realistic structural models |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No external consumer of `solver_instance.E` or `solver_instance.I` attributes exists (confirmed by grep of test files and adapters) | Pitfall 1 | Attribute rename would break existing code; mitigation: keep property alias |
| A2 | Blob API + `URL.createObjectURL` is available in all target browsers (Chrome, Firefox, Safari — modern versions) | Pattern 4 | Download link would not work; risk is negligible for a developer-facing tool |

**All other claims in this research are verified against the live codebase or verified by runtime execution.**

---

## Open Questions

1. **Should `section_properties.py` be an API endpoint too?**
   - What we know: D-09 says "either approach is fine at this scale"
   - What's unclear: If a future phase adds batch section optimization, a Python endpoint would be needed
   - Recommendation: Implement Python utility module (per D-09 requirement for standalone function), JS duplicates the formulas. Do not add an API endpoint — that's explicitly deferred.

2. **Symbol size control: slider vs numeric input?**
   - What we know: D-16 says "slider or numeric input"; UI-SPEC says numeric input `<input type="number">` matching "Deflection scale ×" pattern
   - Recommendation: Use `<input type="number">` (numeric input) — matches existing "Deflection scale ×" control at line 687 of script.js. Slider introduces a new HTML element type to the sidebar.

3. **Does the `utils/` directory need an `__init__.py`?**
   - The package structure (`solver_core/src/pda_analysis_software/`) uses `__init__.py` in each subdirectory
   - Recommendation: Yes, create `utils/__init__.py` (empty or with `from .section_properties import section_properties`).

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all features use existing Python stdlib, numpy, and native browser APIs).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | none (test discovery by convention) |
| Quick run command | `python -m pytest tests/ -x -q` |
| Full suite command | `python -m pytest tests/ -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODEL-01 | Per-member E/I/A list solves correctly | unit | `python -m pytest tests/test_frame_v2.py -x -q -k "per_member"` | ❌ Wave 0 |
| MODEL-01 | Scalar E/I/A still broadcasts correctly | unit | `python -m pytest tests/test_frame_v2.py::test_cantilever_adapter_pipeline -x` | ✅ existing |
| MODEL-02 | All existing tests pass unchanged | regression | `python -m pytest tests/ -x -q` | ✅ existing (10 tests) |
| MODEL-03 | Section property formulas correct (rect, circle, I-section) | unit | `python -m pytest tests/test_section_properties.py -x -q` | ❌ Wave 0 |
| MODEL-04 | (JS-only: no Python test) | manual | Open browser, solve, verify JSON download | n/a |
| MODEL-05 | (JS-only: no Python test) | manual | Toggle checkbox, verify labels on canvas | n/a |

### New tests needed (Wave 0)

**`tests/test_section_properties.py`** — covers MODEL-03:
```python
from pda_analysis_software.utils.section_properties import section_properties
import math, pytest

def test_rectangle():
    I, A = section_properties('rectangle', b=100, h=200)
    assert I == pytest.approx(100 * 200**3 / 12 / 1e4, rel=1e-9)
    assert A == pytest.approx(100 * 200 / 100, rel=1e-9)

def test_circle():
    I, A = section_properties('circle', d=100)
    assert I == pytest.approx(math.pi * 100**4 / 64 / 1e4, rel=1e-9)
    assert A == pytest.approx(math.pi * 100**2 / 4 / 100, rel=1e-9)

def test_i_section():
    I, A = section_properties('i_section', b=100, H=200, tf=10, tw=8)
    hw = 200 - 2*10
    expected_I = (100*200**3/12 - (100-8)*hw**3/12) / 1e4
    expected_A = (2*100*10 + 8*hw) / 100
    assert I == pytest.approx(expected_I, rel=1e-9)
    assert A == pytest.approx(expected_A, rel=1e-9)
```

**`tests/test_frame_v2.py` addition** — covers MODEL-01:
```python
def test_per_member_EI_two_span():
    """MODEL-01: Two-member beam with different E per member — verify equilibrium."""
    E1, E2 = 200e9, 100e9  # member 1 is steel, member 2 is 'softer'
    I_val, A_val, L_val = 1e-4, 0.01, 1.0
    F = 1000.0

    model = FrameModel2D(
        nodes=np.array([[0.0, 0.0], [L_val, 0.0], [2*L_val, 0.0]]),
        members=np.array([[1, 2], [2, 3]]),
        ENForces=np.array([[0.0, 0.0], [0.0, 0.0]]),
        ENMoments=np.array([[0.0, 0.0], [0.0, 0.0]]),
        forceVector=np.array([0.0, 0.0, 0.0, 0.0, -F, 0.0, 0.0, 0.0, 0.0]).reshape(-1, 1),
        E=[E1, E2], I=[I_val, I_val], A=A_val,
        restrainedDoF=[1, 2, 3, 7, 8, 9],
        pinDoF=[], bars=[], beamPinLeft=[], beamPinRight=[],
        springDoF=[], springStiffness=[],
    )
    result = FrameV2Adapter(model).solve()
    # Equilibrium: vertical reactions sum to applied load
    assert np.isclose(result.FG[1, 0] + result.FG[7, 0] - F, 0, atol=1e-6)
```

### Sampling Rate
- **Per task commit:** `python -m pytest tests/ -x -q`
- **Per wave merge:** `python -m pytest tests/ -v`
- **Phase gate:** Full suite green (target: 13+ tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_section_properties.py` — covers MODEL-03 (3 test functions)
- [ ] `solver_core/src/pda_analysis_software/utils/__init__.py` — package init (empty)
- [ ] `solver_core/src/pda_analysis_software/utils/section_properties.py` — Python utility (MODEL-03)
- [ ] MODEL-01 test addition in `tests/test_frame_v2.py`

---

## Security Domain

This phase introduces no authentication, session handling, user data persistence, or cryptographic operations. The only new data flow is:

- JSON export: browser reads API response (already returned to browser), serializes to local file. No server involvement. No XSS risk if `createElement` is used instead of `innerHTML` for the download link.
- Section calculator: pure arithmetic, no user input reaches the server.
- Per-member E/I/A: user-provided floats in the API request body — Pydantic validation already enforces float/List[float] type.

**V5 Input Validation** (already covered): Pydantic model validates all API inputs. The new Union fields maintain type safety. List length mismatch should be caught in the adapter with an explicit check.

No new ASVS categories apply to this phase beyond what Phase 1 established.

---

## Sources

### Primary (HIGH confidence — verified against live codebase)
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — full solver review; `self.E`, `self.I` usage confirmed at 5 sites
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` — adapter stress calc and broadcast insertion point confirmed
- `solver_core/src/pda_analysis_software/models/frame2d_model.py` — current type annotations confirmed
- `api_server/app.py` — `Frame2DRequest` fields confirmed; Union import path confirmed
- `ui/frame2d/script.js` — `renderResults()`, `draw()`, UDL click pattern, checkbox pattern all confirmed
- `tests/test_frame_v2.py` — 7 tests confirmed; none access `solver.E` or `solver.I`
- Runtime tests against Pydantic 2.12.5 — Union[float, List[float]] behavior confirmed
- Runtime tests — all three section property formulas numerically verified

### Secondary (MEDIUM confidence)
- CLAUDE.md — project conventions and DOF numbering rules
- `.planning/phases/03-model-evolution-and-ux-polish/03-CONTEXT.md` — locked decisions
- `.planning/phases/03-model-evolution-and-ux-polish/03-UI-SPEC.md` — UI design contract

### Tertiary (LOW confidence — [ASSUMED])
- Blob API availability across target browsers (A2 in Assumptions Log)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages installed, versions verified
- Per-member solver changes: HIGH — exact change sites identified, pattern mirrors existing Am
- Adapter broadcast: HIGH — tested against Pydantic 2.12.5 and Python dataclass
- Section formulas: HIGH — numerically verified by runtime execution
- UI patterns: HIGH — verified against existing script.js code
- Blob API: MEDIUM — standard browser API, single assumed claim

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, no moving parts)
