---
phase: 04-2d-frame-solver-ui-hardening
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/frame2d/style.css
autonomous: false
requirements:
  - HARDEN-02
must_haves:
  truths:
    - "User sees a 'Spring' button in the Supports toolbar group in the frame2d UI"
    - "Clicking a node in Spring mode opens a modal with Kx, Ky, Kθ inputs (kN/m and kN·m/rad)"
    - "Blank inputs → that DOF has no spring; at least one non-blank K is required (D-06)"
    - "Spring replaces any existing classic support at that node (D-05)"
    - "Canvas renders a coil glyph per active spring axis + value tag (D-07)"
    - "Save produces JSON with `canvas.supports[nodeId]` as a spring object `{type:'spring', Kx, Ky, Ktheta}` (D-08)"
    - "Load restores spring supports round-trip AND still accepts Phase 3 string-valued supports (backward compatible)"
    - "Solve payload sends correct springDoF (base=nodeId*3+1; Kx→base, Ky→base+1, Kθ→base+2) with SI unit conversion (kN/m→N/m ×1e3; kN·m/rad→N·m/rad ×1e3)"
    - "An end-to-end UAT of the simple-beam-with-spring case (see HARDEN-03 Plan 03) produces reaction = K·δ"
  artifacts:
    - path: "ui/frame2d/index.html"
      provides: "Spring toolbar button in Supports group"
      contains: "data-mode=\"spring\""
    - path: "ui/frame2d/script.js"
      provides: "spring mode dispatcher, modal UX, drawSupports coil glyph, payload builder wiring, save/load spring object round-trip"
      contains: "springDoF.push, Ktheta, drawSpring"
    - path: "ui/frame2d/style.css"
      provides: "Modal styling for the spring input dialog (consistent with existing UDL panel style)"
      contains: "#springPanel"
  key_links:
    - from: "ui/frame2d/script.js (solve() payload builder at ~line 445)"
      to: "API /solve/frame2d springDoF/springStiffness fields"
      via: "supports array → flattened DOF list + SI-unit K values"
      pattern: "springDoF:.*(push|\\[.*base|nodeId"
    - from: "ui/frame2d/script.js (saveModel at ~line 1304)"
      to: "canvas.supports[nodeId] spring object form"
      via: "D-08 schema"
      pattern: "type:.*spring.*Kx.*Ky.*Ktheta"
    - from: "ui/frame2d/script.js (file load handler at ~line 1380)"
      to: "supports array restoration (strings AND spring objects)"
      via: "type-check on the decoded value"
      pattern: "typeof.*object|data.type.*spring"
---

<objective>
Expose the already-implemented elastic spring support backend (`springDoF` / `springStiffness` in the solver) in the frame2d browser UI, so an engineer can place translational (Kx, Ky) and rotational (Kθ) springs at any node, save them to the canonical JSON schema (extended per D-08), reload them round-trip, and solve correctly.

Purpose: Close HARDEN-02. The solver and adapter are ready today — this plan builds only the UI surface.

Output: A new "Spring" toolbar button, a modal for entering Kx/Ky/Kθ in kN/m and kN·m/rad, canvas coil glyphs per active axis with a value tag, correctly wired payload to `/solve/frame2d` (replacing the hardcoded `springDoF: []` / `springStiffness: []` at ui/frame2d/script.js:445 AND the identical hardcode in the Save function at line 1304), and a backward-compatible save/load for spring supports as objects under `canvas.supports[nodeId]`.

Non-goals:
- Prescribed-settlement BC (D-02 — deferred)
- Solver changes (spring backend already landed)
- `schema_version` bump (D-08 — Phase 3 schema extended, not broken)
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md
@CLAUDE.md

# Canonical references (from 04-CONTEXT.md)
@ui/frame2d/index.html
@ui/frame2d/script.js
@ui/frame2d/style.css
@api_server/app.py
@tests/fixtures/sample_pda_frame2d.json

<interfaces>
<!-- Contracts that already exist — DO NOT modify these, just consume them. -->

From api_server/app.py — Frame2DRequest Pydantic model accepts:
```python
springDoF: List[int] = []           # 1-based DOF indices
springStiffness: List[float] = []   # SI units: N/m for Ux/Uy springs, N·m/rad for θ spring
```

From ui/frame2d/script.js — Existing `supports` global array (line 64):
```javascript
let supports = [];   // { nodeId, type:'fixed'|'pinned'|'rollerX'|'rollerY' }
// This plan EXTENDS the type field. A spring support entry has shape:
//   { nodeId, type: 'spring', Kx: number|null, Ky: number|null, Ktheta: number|null }
// Existing string-type entries remain unchanged.
```

From ui/frame2d/script.js — Existing `setMode()` dispatcher (line 95) and canvas click handler (line 105):
```javascript
// Current support-mode branch at line 147 matches ['fixed','pinned','rollerX','rollerY'].
// This plan adds a separate 'spring' branch that opens a modal instead of immediately
// pushing to the supports array.
```

From ui/frame2d/script.js — Existing `saveModel()` `canvasSupports` reducer at line 1270-1273:
```javascript
const canvasSupports = supports.reduce((obj, s) => {
  obj[String(s.nodeId)] = s.type;   // current: always a string
  return obj;
}, {});
// AFTER this plan:
//   For s.type === 'spring' → store { type:'spring', Kx, Ky, Ktheta } object (K in UI units: kN/m, kN·m/rad)
//   For s.type in ('fixed','pinned','rollerX','rollerY') → keep storing the string (backward compatible)
```

From ui/frame2d/script.js — Existing Load handler at lines 1380-1384 (current code):
```javascript
const sObj = (data.canvas && data.canvas.supports) || {};
supports = Object.entries(sObj).map(([nodeId, type]) => ({
  nodeId: parseInt(nodeId, 10),
  type: type,             // assumes string → breaks on spring object; fix below
}));
// AFTER this plan: detect if `type` is a string or an object with type==='spring' and restore accordingly.
```

From ui/frame2d/script.js — Existing `drawSupports()` at line 624:
```javascript
function drawSupports() {
  supports.forEach(s => {
    ...
    if (s.type === 'fixed') drawFixed(n.x, n.y);
    else if (s.type === 'pinned') drawPin(n.x, n.y);
    else if (s.type === 'rollerY') drawRollerH(n.x, n.y);
    else if (s.type === 'rollerX') drawRollerV(n.x, n.y);
    // ADD: else if (s.type === 'spring') drawSpring(n.x, n.y, s.Kx, s.Ky, s.Ktheta);
  });
}
```

Existing unit-conversion pattern for reference (from the solve() function lines 393-400):
```javascript
// E GPa → Pa ×1e9; I cm⁴ → m⁴ ×1e-8; A cm² → m² ×1e-4
// ANALOGOUS for springs: Kx/Ky kN/m → N/m ×1e3; Kθ kN·m/rad → N·m/rad ×1e3
```

DOF index formula (from CLAUDE.md Frame solver conventions):
```
base = nodeId * 3 + 1       # nodeId is 0-based (matches existing code at line 405)
Kx → base, Ky → base+1, Kθ → base+2
```
</interfaces>

<constraints>
- **NO solver_core / api_server changes.** Spring backend is already implemented (frame_v2.py:411-418, Frame2DRequest accepts springDoF/springStiffness).
- **Backward compatible save format.** D-08: `canvas.supports[nodeId]` remains a string for classic supports; becomes an object only for springs. `schema_version` stays `"1.0"`.
- **Spring replaces classic support at a node** (D-05). `supports.filter(s => s.nodeId !== n.id)` must run before pushing a spring entry — the existing pattern at line 151 already enforces this for classic supports; reuse it.
- **At least one K required** (D-06). All-blank submission is treated as cancel (no spring created).
- **DOF math is 1-based** (CLAUDE.md hard rule). `base = nodeId * 3 + 1`.
- **Unit conversions before payload build**: kN/m → N/m (×1e3), kN·m/rad → N·m/rad (×1e3). Store the user-facing kN values in the `supports` array so the UI displays them consistently, and convert to SI only at payload/solve time.
- **Modal style**: follow the existing UDL panel pattern (`#udlPanel` in index.html; `udlWy` / `udlWx` inputs). See ui/frame2d/index.html for the pattern.
- This plan is NOT autonomous — Task 4 requires a human to visually verify the UI behaviour and the round-trip save/load.
</constraints>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Spring toolbar button + spring modal HTML + CSS</name>
  <files>ui/frame2d/index.html, ui/frame2d/style.css</files>
  <read_first>
    - ui/frame2d/index.html (Supports toolbar group at lines 30-52 — see the fixed/pinned/rollerX/rollerY buttons; UDL panel modal pattern for the spring modal reference — search for `id="udlPanel"`)
    - ui/frame2d/style.css (find the existing modal/panel styles — search for `#udlPanel` or `.panel`)
    - .planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md (D-03: single "Spring" button with data-mode="spring"; D-04: modal with 3 inputs Kx, Ky, Kθ in kN/m and kN·m/rad; D-07: coil glyph style; Specifics: placeholder text should hint at typical 10_000–100_000 kN/m soil-pad stiffness range)
    - CLAUDE.md (UI conventions section — GRID=20 px, active button highlighting via data-mode)
  </read_first>
  <action>
    **Change 1 — `ui/frame2d/index.html`, Supports group (lines 30-52):**
    Append a new button immediately after the rollerX button (current line 47-51) inside the `<section class="panel-section">` for Supports:

    ```html
    <button class="tool-btn support-btn" data-mode="spring" onclick="setMode('spring')"
      title="Elastic spring support — specify stiffness Kx, Ky, Kθ (blank = free)">
      〰 Spring
      <span class="support-tag">Kx | Ky | Kθ</span>
    </button>
    ```

    **Change 2 — `ui/frame2d/index.html`, Spring modal panel:**
    Add a new modal panel immediately AFTER the existing `#udlPanel` element (find it via `grep -n 'id="udlPanel"' ui/frame2d/index.html`). Copy the UDL panel's wrapper style. Required structure:

    ```html
    <div id="springPanel" class="overlay-panel" style="display:none;">
      <h3 id="springPanelTitle">Spring Support — Node X</h3>
      <p class="hint">Enter stiffness values. Blank = that DOF is free. At least one value required.</p>
      <label>Kx (kN/m): <input type="number" id="springKx" step="any" placeholder="e.g. 10000"></label>
      <label>Ky (kN/m): <input type="number" id="springKy" step="any" placeholder="e.g. 10000"></label>
      <label>Kθ (kN·m/rad): <input type="number" id="springKtheta" step="any" placeholder="e.g. 5000"></label>
      <div class="panel-actions">
        <button type="button" onclick="applySpringSupport()">Apply</button>
        <button type="button" onclick="cancelSpringSupport()">Cancel</button>
      </div>
    </div>
    ```

    Use whatever class name the existing UDL panel uses for `overlay-panel` — inspect `index.html` to find the actual class and replicate it. If the UDL panel uses `id="udlPanel"` with no overlay class, use the same pattern (a positioned div with inline/CSS display toggling).

    **Change 3 — `ui/frame2d/style.css`:**
    Add styling for `#springPanel` that MATCHES the existing `#udlPanel` styling. Easiest approach: find the `#udlPanel` block in style.css and add a sibling selector `#springPanel` so both share the same rules. Example:

    ```css
    /* BEFORE */ #udlPanel { ... existing rules ... }
    /* AFTER  */ #udlPanel, #springPanel { ... existing rules ... }
    ```

    Also add specific rules for the spring inputs if needed:
    ```css
    #springPanel label { display:block; margin: 6px 0; font-size: 13px; }
    #springPanel input[type="number"] { width: 140px; margin-left: 6px; }
    #springPanel .hint { font-size: 11px; color: #555; margin: 0 0 8px 0; }
    #springPanel .panel-actions { margin-top: 10px; display:flex; gap:8px; }
    ```

    Do NOT modify any other section of index.html or style.css. Do NOT touch script.js in this task — wiring is Task 2.
  </action>
  <verify>
    <automated>grep -n 'data-mode="spring"' /Users/catrinevans/Documents/pda_project/ui/frame2d/index.html && grep -n 'id="springPanel"' /Users/catrinevans/Documents/pda_project/ui/frame2d/index.html && grep -n 'id="springKx"' /Users/catrinevans/Documents/pda_project/ui/frame2d/index.html && grep -n 'id="springKy"' /Users/catrinevans/Documents/pda_project/ui/frame2d/index.html && grep -n 'id="springKtheta"' /Users/catrinevans/Documents/pda_project/ui/frame2d/index.html && grep -n '#springPanel' /Users/catrinevans/Documents/pda_project/ui/frame2d/style.css</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'data-mode="spring"' ui/frame2d/index.html` returns exactly 1 match (the new button)
    - `grep -n 'id="springPanel"' ui/frame2d/index.html` returns exactly 1 match
    - `grep -n 'id="springKx"' ui/frame2d/index.html`, `grep -n 'id="springKy"' ui/frame2d/index.html`, `grep -n 'id="springKtheta"' ui/frame2d/index.html` each return exactly 1 match
    - `grep -n 'applySpringSupport\|cancelSpringSupport' ui/frame2d/index.html` returns at least 2 matches
    - `grep -n '#springPanel' ui/frame2d/style.css` returns at least 1 match
    - `grep -n 'setMode.*spring' ui/frame2d/index.html` returns at least 1 match (button onclick)
    - Existing buttons untouched: `grep -c 'data-mode="fixed"' ui/frame2d/index.html` returns 1 (unchanged count); same for pinned, rollerX, rollerY
  </acceptance_criteria>
  <done>Spring button renders in the Supports group; modal HTML + CSS exist; Apply/Cancel actions wired to functions (to be defined in Task 2).</done>
</task>

<task type="auto">
  <name>Task 2: Wire spring mode in setMode/click handler, modal apply/cancel, payload builder, save, load</name>
  <files>ui/frame2d/script.js</files>
  <read_first>
    - ui/frame2d/script.js (entire file — this task modifies 6 separate regions):
      1. `supports` global declaration at line 64 (comment only — reflects extended shape)
      2. `MODE_LABELS` at lines 84-93 (add 'spring' label)
      3. `setMode()` at lines 95-102 (no change needed — it already iterates data-mode buttons)
      4. Canvas click handler at lines 147-154 (classic-support branch) — add a separate 'spring' branch
      5. `solve()` payload builder at lines 402-445 — replace hardcoded `springDoF: []` / `springStiffness: []` (line 445)
      6. `drawSupports()` at lines 624-635 — add spring branch and `drawSpring()` helper
      7. `saveModel()` at lines 1270-1304 — update canvasSupports reducer to emit spring objects; hardcoded springDoF/springStiffness at line 1304 must be replaced with real values
      8. File-load handler at lines 1380-1384 — update restoration to accept both string and spring-object forms
    - ui/frame2d/index.html (from Task 1 — #springPanel, #springKx/Ky/Ktheta, applySpringSupport()/cancelSpringSupport())
    - .planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md (D-03, D-04, D-05, D-06, D-08, D-09 — all apply here)
    - CLAUDE.md (Frame solver conventions — `base = i*3 + 1` 1-based DOF; Ux/Uy/θ order; UI unit conversions section)
    - api_server/app.py (Frame2DRequest: `springDoF: List[int] = []`, `springStiffness: List[float] = []` — these are the fields the payload must populate)
  </read_first>
  <action>
    **Step 1 — MODE_LABELS (line 84-93):** Add `spring: 'Spring Support',` to the MODE_LABELS object.

    **Step 2 — Extend canvas click handler at line 147.** The current branch for classic supports is:
    ```javascript
    } else if (['fixed', 'pinned', 'rollerX', 'rollerY'].includes(mode)) {
      const n = findNodeAt(px, py);
      if (n) {
        saveHistory();
        supports = supports.filter(s => s.nodeId !== n.id);
        supports.push({ nodeId: n.id, type: mode });
        results = null;
      }
    ```
    Add a new branch IMMEDIATELY AFTER the classic-support branch:
    ```javascript
    } else if (mode === 'spring') {
      const n = findNodeAt(px, py);
      if (n) {
        _springActiveNodeId = n.id;
        // Pre-fill from existing spring at this node (D-06 — editable)
        const existing = supports.find(s => s.nodeId === n.id && s.type === 'spring');
        document.getElementById('springPanelTitle').textContent = 'Spring Support — Node ' + (n.id + 1);
        document.getElementById('springKx').value     = existing && existing.Kx     != null ? existing.Kx     : '';
        document.getElementById('springKy').value     = existing && existing.Ky     != null ? existing.Ky     : '';
        document.getElementById('springKtheta').value = existing && existing.Ktheta != null ? existing.Ktheta : '';
        document.getElementById('springPanel').style.display = 'block';
        document.getElementById('springKx').focus();
      }
    ```
    And declare `let _springActiveNodeId = null;` alongside `_udlActiveMemberIdx` at the state region (around line 68).

    **Step 3 — Add applySpringSupport() and cancelSpringSupport() functions.** Place these next to the UDL panel apply/cancel functions in the file (search for `_udlActiveMemberIdx` to locate). The apply function enforces D-05 (replace classic support), D-06 (≥1 non-blank required):
    ```javascript
    function applySpringSupport() {
      try {
      if (_springActiveNodeId === null) return;
      const kxRaw     = document.getElementById('springKx').value.trim();
      const kyRaw     = document.getElementById('springKy').value.trim();
      const kthetaRaw = document.getElementById('springKtheta').value.trim();
      const Kx     = kxRaw     === '' ? null : parseFloat(kxRaw);
      const Ky     = kyRaw     === '' ? null : parseFloat(kyRaw);
      const Ktheta = kthetaRaw === '' ? null : parseFloat(kthetaRaw);
      // D-06: at least one non-blank value required
      if (Kx == null && Ky == null && Ktheta == null) {
        cancelSpringSupport();
        return;
      }
      // Validate any non-null value is a positive finite number
      for (const v of [Kx, Ky, Ktheta]) {
        if (v != null && (isNaN(v) || !isFinite(v) || v <= 0)) {
          alert('Spring stiffness must be a positive number. Blank = free.');
          return;
        }
      }
      saveHistory();
      // D-05: spring REPLACES any classic support at this node
      supports = supports.filter(s => s.nodeId !== _springActiveNodeId);
      supports.push({ nodeId: _springActiveNodeId, type: 'spring', Kx, Ky, Ktheta });
      document.getElementById('springPanel').style.display = 'none';
      _springActiveNodeId = null;
      results = null;
      updateSaveButtonState();
      draw();
      } catch (err) {
        showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
        throw err;
      }
    }

    function cancelSpringSupport() {
      document.getElementById('springPanel').style.display = 'none';
      _springActiveNodeId = null;
    }
    ```

    **Step 4 — Replace `springDoF: []` / `springStiffness: []` hardcode in `solve()` at line 445.** Immediately BEFORE the `const payload = { ... }` block, compute:
    ```javascript
    // Springs — D-09: DOF indices from supports[].type === 'spring'
    // Unit conversion: kN/m → N/m ×1e3; kN·m/rad → N·m/rad ×1e3
    const springDoF = [];
    const springStiffness = [];
    supports.forEach(s => {
      if (s.type !== 'spring') return;
      const base = s.nodeId * 3 + 1;  // 1-based, matches classic-support indexing above
      if (s.Kx     != null) { springDoF.push(base);     springStiffness.push(s.Kx     * 1e3); }  // kN/m → N/m
      if (s.Ky     != null) { springDoF.push(base + 1); springStiffness.push(s.Ky     * 1e3); }  // kN/m → N/m
      if (s.Ktheta != null) { springDoF.push(base + 2); springStiffness.push(s.Ktheta * 1e3); }  // kN·m/rad → N·m/rad
    });
    ```
    Then modify the payload object at line 445:
    - REMOVE: `pinDoF: [], springDoF: [], springStiffness: [],`
    - REPLACE with: `pinDoF: [], springDoF, springStiffness,`
    (The `pinDoF: []` stays hardcoded — pin DOF wiring is out of scope for this phase.)

    **Step 5 — Update the `restrainedDoF` forEach in `solve()` (line 404).** Classic-support branches already handle `fixed/pinned/rollerX/rollerY`. Add an `else if (s.type === 'spring') { /* no classic restraint — handled by springs */ }` branch so the loop doesn't silently skip — explicit is clearer. At minimum the existing code must NOT treat a spring entry as though it's missing a type; the forEach currently does NOT throw on unknown types but adds no restraint, which is correct. Still, add the comment for clarity.

    **Step 6 — Update `drawSupports()` at line 624.** Add a branch for `s.type === 'spring'` that calls a new `drawSpring(x, y, s.Kx, s.Ky, s.Ktheta)` helper. Add the helper function immediately after `drawRollerV()` (line 687):
    ```javascript
    function drawSpring(x, y, Kx, Ky, Ktheta) {
      const sc = getSymbolScale();
      ctx.save();
      ctx.strokeStyle = '#6a1b9a'; ctx.fillStyle = '#6a1b9a'; ctx.lineWidth = 1.5;
      // Horizontal coil on -X side of node for Kx
      if (Kx != null) {
        const coilLen = 22 * sc, zigs = 4, amp = 3 * sc;
        const x0 = x - 2, xEnd = x0 - coilLen;
        ctx.beginPath(); ctx.moveTo(x0, y);
        for (let i = 1; i <= zigs; i++) {
          const xi = x0 - (coilLen * i / zigs);
          const yi = y + (i % 2 === 0 ? 0 : amp * (i % 4 < 2 ? 1 : -1));
          ctx.lineTo(xi, yi);
        }
        ctx.lineTo(xEnd, y);
        ctx.stroke();
        // Small fixed hatch at the far end (anchored wall)
        ctx.beginPath(); ctx.moveTo(xEnd, y - 6*sc); ctx.lineTo(xEnd, y + 6*sc); ctx.stroke();
      }
      // Vertical coil below node for Ky
      if (Ky != null) {
        const coilLen = 22 * sc, zigs = 4, amp = 3 * sc;
        const y0 = y + 2, yEnd = y0 + coilLen;
        ctx.beginPath(); ctx.moveTo(x, y0);
        for (let i = 1; i <= zigs; i++) {
          const yi = y0 + (coilLen * i / zigs);
          const xi = x + (i % 2 === 0 ? 0 : amp * (i % 4 < 2 ? 1 : -1));
          ctx.lineTo(xi, yi);
        }
        ctx.lineTo(x, yEnd);
        ctx.stroke();
        // Small fixed hatch at far end
        ctx.beginPath(); ctx.moveTo(x - 6*sc, yEnd); ctx.lineTo(x + 6*sc, yEnd); ctx.stroke();
      }
      // Rotational spring: small spiral arc around node
      if (Ktheta != null) {
        const r = 9 * sc;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 1.8);
        ctx.stroke();
      }
      // Value tag label
      const labelParts = [];
      if (Kx     != null) labelParts.push('Kx=' + Kx + ' kN/m');
      if (Ky     != null) labelParts.push('Ky=' + Ky + ' kN/m');
      if (Ktheta != null) labelParts.push('Kθ=' + Ktheta + ' kN·m/rad');
      ctx.font = '9px Arial'; ctx.textAlign = 'left'; ctx.fillStyle = '#6a1b9a';
      ctx.fillText(labelParts.join(' · '), x + 10 * sc, y - 10 * sc);
      ctx.restore();
    }
    ```
    And in `drawSupports()`:
    ```javascript
    else if (s.type === 'spring') drawSpring(n.x, n.y, s.Kx, s.Ky, s.Ktheta);
    ```

    **Step 7 — Update `saveModel()` canvasSupports reducer at lines 1270-1273:**
    Replace:
    ```javascript
    const canvasSupports = supports.reduce((obj, s) => {
      obj[String(s.nodeId)] = s.type;
      return obj;
    }, {});
    ```
    With (D-08 schema extension):
    ```javascript
    const canvasSupports = supports.reduce((obj, s) => {
      if (s.type === 'spring') {
        // D-08: spring as object with K values in UI units (kN/m, kN·m/rad)
        obj[String(s.nodeId)] = { type: 'spring', Kx: s.Kx, Ky: s.Ky, Ktheta: s.Ktheta };
      } else {
        obj[String(s.nodeId)] = s.type;  // classic string form — backward compatible with Phase 3
      }
      return obj;
    }, {});
    ```

    Also replace the `springDoF: []` / `springStiffness: []` hardcode at line 1304 (inside the `model = { ... }` block) with real values. Compute them identically to Step 4 above — extract the loop into a helper so solve() and saveModel() share:
    ```javascript
    function computeSpringPayload() {
      const springDoF = [];
      const springStiffness = [];
      supports.forEach(s => {
        if (s.type !== 'spring') return;
        const base = s.nodeId * 3 + 1;
        if (s.Kx     != null) { springDoF.push(base);     springStiffness.push(s.Kx     * 1e3); }
        if (s.Ky     != null) { springDoF.push(base + 1); springStiffness.push(s.Ky     * 1e3); }
        if (s.Ktheta != null) { springDoF.push(base + 2); springStiffness.push(s.Ktheta * 1e3); }
      });
      return { springDoF, springStiffness };
    }
    ```
    Place `computeSpringPayload()` near the top of the solve section. In both `solve()` and `saveModel()`, replace the inline push-loops with:
    ```javascript
    const { springDoF, springStiffness } = computeSpringPayload();
    ```
    In `saveModel()` at line 1304, replace `pinDoF: [], springDoF: [], springStiffness: [],` with `pinDoF: [], springDoF, springStiffness,`.

    **Step 8 — Update file-load handler at lines 1380-1384.** Replace:
    ```javascript
    const sObj = (data.canvas && data.canvas.supports) || {};
    supports = Object.entries(sObj).map(([nodeId, type]) => ({
      nodeId: parseInt(nodeId, 10),
      type: type,
    }));
    ```
    With:
    ```javascript
    const sObj = (data.canvas && data.canvas.supports) || {};
    supports = Object.entries(sObj).map(([nodeId, val]) => {
      const nId = parseInt(nodeId, 10);
      // D-08: val may be a string ('fixed'|'pinned'|'rollerX'|'rollerY') OR a spring object { type:'spring', Kx, Ky, Ktheta }
      if (typeof val === 'string') {
        return { nodeId: nId, type: val };
      }
      if (val && typeof val === 'object' && val.type === 'spring') {
        return {
          nodeId: nId,
          type: 'spring',
          Kx:     val.Kx     != null ? val.Kx     : null,
          Ky:     val.Ky     != null ? val.Ky     : null,
          Ktheta: val.Ktheta != null ? val.Ktheta : null,
        };
      }
      // Unknown form — skip with a console warning for diagnostics
      console.warn('Unknown support form for node', nId, val);
      return null;
    }).filter(Boolean);
    ```

    **Step 9 — Update undo history if needed.** The current `saveHistory()` at line 287 clones the `supports` array via JSON.parse(JSON.stringify(supports)) — this already preserves all fields on spring entries (Kx/Ky/Ktheta). No change required, but verify by reading saveHistory() and confirming it deep-clones.

    **Step 10 — Update `reindexNodes()` at line 366.** Spring entries are already handled because `supports.forEach(s => { s.nodeId = idMap[s.nodeId]; })` at line 370 only touches the nodeId field. No change required — verify by re-reading reindexNodes.

    Do NOT modify any test files or solver_core files.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && node -e "const fs=require('fs'); const js=fs.readFileSync('ui/frame2d/script.js','utf8'); const checks=[['applySpringSupport',/function applySpringSupport\(/],['cancelSpringSupport',/function cancelSpringSupport\(/],['drawSpring',/function drawSpring\(/],['computeSpringPayload',/function computeSpringPayload\(/],['hardcode-removed-solve',/springDoF: \[\]/],['spring-mode-branch',/mode === 'spring'/],['spring-save-object',/type: 'spring', Kx/],['spring-load-object',/val.type === 'spring'/],['unit-conv-x1e3',/\* 1e3/]]; let ok=true; for (const [name,re] of checks){ const has=re.test(js); const expected = name.startsWith('hardcode-removed') ? false : true; const pass = has===expected; console.log((pass?'OK  ':'FAIL')+' '+name+' '+(has?'(present)':'(absent)')); if (!pass) ok=false;} process.exit(ok?0:1);"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "function applySpringSupport" ui/frame2d/script.js` returns exactly 1 match
    - `grep -n "function cancelSpringSupport" ui/frame2d/script.js` returns exactly 1 match
    - `grep -n "function drawSpring" ui/frame2d/script.js` returns exactly 1 match
    - `grep -n "function computeSpringPayload" ui/frame2d/script.js` returns exactly 1 match
    - `grep -n "mode === 'spring'" ui/frame2d/script.js` returns at least 1 match (canvas click branch)
    - `grep -n "type: 'spring'" ui/frame2d/script.js` returns at least 2 matches (one in saveModel, one in the spring-entry push, one in load handler)
    - `grep -cE "springDoF: \[\]" ui/frame2d/script.js` returns 0 (both hardcodes removed — line 445 AND line 1304)
    - `grep -cE "springStiffness: \[\]" ui/frame2d/script.js` returns 0
    - `grep -n "springDoF, springStiffness" ui/frame2d/script.js` returns at least 2 matches (payload shorthand used in both solve and saveModel)
    - `grep -n "\\* 1e3" ui/frame2d/script.js` returns at least 3 matches (Kx/Ky/Ktheta unit conversions — ALL three springs converted)
    - `grep -n "base = s.nodeId \\* 3 + 1" ui/frame2d/script.js` returns at least 1 match (DOF formula)
    - `grep -n "val.type === 'spring'" ui/frame2d/script.js` returns exactly 1 match (load-handler type check)
    - `grep -n "spring: 'Spring Support'" ui/frame2d/script.js` returns exactly 1 match (MODE_LABELS entry)
    - File parses as valid JS: `cd /Users/catrinevans/Documents/pda_project && node --check ui/frame2d/script.js` exits 0
    - No changes to solver_core / api_server / tests: `git diff --name-only | grep -vE "^(ui/frame2d/|.planning/)" | grep -E "solver_core|api_server|tests/" | wc -l` returns 0
  </acceptance_criteria>
  <done>Spring mode fully wired: click-to-open modal → apply pushes entry → draw renders coils → solve payload sends SI-unit springDoF/springStiffness → save emits object form → load restores round-trip. JS parses cleanly.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verification of spring UI behavior and save/load round-trip</name>
  <files>N/A — this is a human-verification checkpoint. No files modified by this task.</files>
  <action>Checkpoint task: after Task 2 lands, HUMAN must operate the frame2d browser UI and follow the 11-step verification procedure in <how-to-verify> below. The executor Claude pauses here until the user resumes.</action>
  <verify><automated>echo "Checkpoint task — human verification required; see <how-to-verify> block."</automated></verify>
  <done>User types the resume signal after confirming all 11 verification steps pass.</done>
  <what-built>
    From Tasks 1 and 2:
    - New "Spring" button in the Supports toolbar group in the frame2d UI
    - Modal at `#springPanel` with Kx / Ky / Kθ inputs (kN/m and kN·m/rad)
    - Canvas coil glyphs rendering per active axis with a value tag label
    - Save produces JSON where `canvas.supports[nodeId]` is a spring object `{type:'spring', Kx, Ky, Ktheta}` for spring nodes, and a string for classic supports
    - Load accepts BOTH forms (backward compatible with Phase 3 saved files)
    - Solve payload populates `springDoF` / `springStiffness` in SI units (kN/m→N/m ×1e3; kN·m/rad→N·m/rad ×1e3)
    - Spring replaces any classic support at the same node (D-05)
  </what-built>
  <how-to-verify>
    Start the API server (if not already running):
    ```
    cd /Users/catrinevans/Documents/pda_project && uvicorn api_server.app:app --reload
    ```
    Open `ui/frame2d/index.html` in a browser (drag-drop the file, or serve via a simple static server).

    1. **Spring button renders**: confirm a new "〰 Spring" button appears in the Supports section (alongside Fixed / Pin / Roller buttons). Clicking it highlights it as the active mode.

    2. **Modal opens on node click**: build a simple 2-node horizontal beam (Add Node at (0,0) and (4,0) meters — use the grid; Add Member between them). Click the Spring button, then click node 2. Modal opens with title "Spring Support — Node 2" and three blank inputs.

    3. **Blank submission = cancel**: click Apply with all three inputs blank. Modal closes; no spring added (no coil glyph drawn; supports list unchanged).

    4. **Single-axis spring**: reopen spring modal at node 2, enter `Ky = 1000` (kN/m), leave others blank, click Apply. Modal closes. A vertical coil glyph renders below node 2, with label "Ky=1000 kN/m".

    5. **Spring replaces classic support (D-05)**: click Fixed button, click node 1 (classic fixed support renders). Then click Spring button, click node 1, enter `Ky = 500`, Apply. The classic fixed glyph at node 1 is REPLACED by the Ky coil. Verify no fixed-support hatch remains under node 1.

    6. **Editing an existing spring**: click Spring button, click node 1 again. Modal reopens with `Ky = 500` pre-filled, others blank.

    7. **Solve with spring**: at node 1 pinned (click Pin button on node 1 first to replace the spring — we want a testable case), at node 2 add `Ky = 1000` (kN/m), add a -10_000 N load in Y at node 2 (Force Y button, enter -10000). Set E=200 GPa, I=10000 cm⁴, A=100 cm². Click Solve. Expected:
       - `Status: Solved ✓` banner
       - Reaction at node 2 vertical ≈ 10_000 N (spring carries the load directly since pin at node 1 offers no vertical since the load is directly over node 2 — actually the load IS directly over node 2, so spring = 10_000 N)
       - Uy at node 2 ≈ -1.0e-2 m (P / K = 10_000 / 1_000_000 = 0.01 m downward — note K_y kN/m × 1e3 = 1_000_000 N/m)

    8. **Save round-trip**: click Save. A `frame2d-model-*.json` file downloads. Open it in a text editor. Verify:
       - `canvas.supports["1"]` is `{ "type": "spring", "Kx": null, "Ky": 1000, "Ktheta": null }`  (K_y in user units kN/m)
       - Top-level `springDoF` contains `5` (node 2 → base=4; Ky = base+1 = 5)
       - Top-level `springStiffness` contains `1000000` (SI units: 1000 × 1e3)
       - `canvas.supports["0"]` is `"pinned"` (classic string form preserved)
       - `schema_version` is still `"1.0"`

    9. **Load round-trip**: click Reset All. Then click Load, select the saved JSON. Verify:
       - Node 2 shows the Ky coil glyph with label "Ky=1000 kN/m"
       - Node 1 shows the pinned classic glyph
       - Clicking Solve again produces identical results to step 7

    10. **Load Phase 3 backward compatibility**: load `tests/fixtures/sample_pda_frame2d.json` (a Phase 3 file — all supports are strings). Confirm it loads without errors and renders the cantilever correctly (fixed support at node 1, load at node 2).

    11. **Console clean**: open DevTools console throughout. No red errors should appear at any point.
  </how-to-verify>
  <resume-signal>Type "approved" if all 11 steps pass. Otherwise describe which step failed (with screenshot or DevTools error message) — Claude will fix the specific bug in a follow-up patch to Task 2.</resume-signal>
</task>

</tasks>

<verification>
- Visual UI sanity covered by checkpoint Task 3
- Code-level verification (structural): all acceptance_criteria greps in Tasks 1 and 2
- JS parse check: `node --check ui/frame2d/script.js` exits 0
- Full test suite still green (no accidental changes outside ui/): `pytest tests/ -q` exits 0
</verification>

<success_criteria>
- HARDEN-02 requirement satisfied: spring supports fully exposed in frame2d UI; round-trip save/load works; solve produces correct spring-reaction = K·δ behaviour
- D-03, D-04, D-05, D-06, D-07, D-08, D-09 all implemented per CONTEXT.md
- Zero changes to solver_core or api_server
- Phase 3 saved files still load correctly (backward compatible)
</success_criteria>

<output>
After completion, create `.planning/phases/04-2d-frame-solver-ui-hardening/04-02-SUMMARY.md` with:
- Summary of UI changes and file locations
- Confirmation of hardcode replacement (line 445 + line 1304)
- Canvas coil glyph design decisions (zig count, amplitude, color) for future UI reference
- Sample JSON snippet showing the extended schema in practice
- Human-verification outcomes from Task 3
</output>
