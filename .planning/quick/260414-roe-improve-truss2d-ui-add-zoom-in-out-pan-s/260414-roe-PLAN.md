---
phase: quick-260414-roe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/truss2d/script.js
  - ui/truss2d/index.html
autonomous: false
requirements:
  - QUICK-260414-ROE
must_haves:
  truths:
    - "User can zoom the truss2d canvas with the scroll wheel, centered on cursor"
    - "User can pan the canvas by holding middle mouse button and dragging"
    - "User can reset the view to default scale/offset via a Reset View button"
    - "User can toggle node labels showing node index and DOF numbers (2 DOF/node)"
    - "User can toggle visibility of supports and loads independently"
    - "Member labels and node labels scale with the existing symbol size control"
    - "Member Forces table shows a σ (MPa) column sourced from res.meta.member_stresses"
    - "Node placement clicks still land at correct world coordinates after zoom/pan"
  artifacts:
    - path: "ui/truss2d/script.js"
      provides: "View transform (zoom/pan), toWorld(), resetView(), drawNodeLabels(), symbol-scaled fonts, stress column rendering"
      contains: "function toWorld"
    - path: "ui/truss2d/index.html"
      provides: "Display toggles for supports/loads/node labels, Reset View button"
      contains: "chkNodeLabels"
  key_links:
    - from: "ui/truss2d/script.js canvas click/mousemove handlers"
      to: "toWorld()"
      via: "replaces manual (clientX - rect.left) * scaleX math"
      pattern: "toWorld\\(e\\.clientX"
    - from: "ui/truss2d/script.js draw()"
      to: "ctx.setTransform with view.scale/tx/ty"
      via: "applied before drawing members/nodes/supports/loads"
      pattern: "setTransform\\(view\\.scale"
    - from: "ui/truss2d/script.js renderResults()"
      to: "res.meta.member_stresses"
      via: "optional chaining per-member lookup, divided by 1e6 for MPa"
      pattern: "member_stresses"
---

<objective>
Bring truss2d UI to parity with frame2d UI: add zoom (scroll wheel) + pan (middle mouse), add display toggles for supports/loads/node-labels, scale label fonts with the existing symbol size control, and add a σ (MPa) column to the Member Forces table.

Purpose: Improve UX for inspecting larger truss models and align behavior with frame2d so engineers have a consistent interaction model across solvers.

Output: Updated `ui/truss2d/script.js` and `ui/truss2d/index.html` with zoom/pan, view reset, new display checkboxes, and stress column in results.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@ui/truss2d/script.js
@ui/truss2d/index.html
@ui/frame2d/script.js
@ui/frame2d/index.html

<interfaces>
<!-- Truss2d uses 2 DOF/node (Ux, Uy). Frame2d uses 3 DOF/node. -->
<!-- DOF numbering is 1-based in public API; for node i (0-indexed): base = i * 2 + 1 -->
<!-- Canvas grid convention (both UIs): GRID=20px, UNIT=1m, origin set by first node placement -->
<!-- Scale correction for flex layout: scaleX = canvas.width / rect.width -->
<!-- Existing symbol scale helper: getSymbolScale() returns multiplier from the symbol size slider -->
<!-- AnalysisResult.meta may include 'member_stresses' (array of Pa, one per member) from Truss2DAdapter -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update script.js — view transform, node labels, display toggles, scaled fonts, stress column</name>
  <files>ui/truss2d/script.js</files>
  <action>
Make the following edits to `ui/truss2d/script.js`, mirroring the frame2d implementation:

1. **View transform state** — after `let _lastBlobUrl = null;`, add:
   ```javascript
   let view = { scale: 1, tx: 0, ty: 0 };
   let isPanning = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;

   function toWorld(clientX, clientY) {
     const rect = canvas.getBoundingClientRect();
     const px = (clientX - rect.left) * (canvas.width  / rect.width);
     const py = (clientY - rect.top)  * (canvas.height / rect.height);
     return { x: (px - view.tx) / view.scale, y: (py - view.ty) / view.scale };
   }

   function resetView() { view = { scale: 1, tx: 0, ty: 0 }; draw(); }
   ```
   Expose `resetView` on `window` (or ensure it's accessible) so the inline `onclick="resetView()"` in HTML works.

2. **Apply transform in draw()** — at the top of `draw()`:
   ```javascript
   ctx.setTransform(1, 0, 0, 1, 0, 0);
   ctx.clearRect(0, 0, canvas.width, canvas.height);
   ctx.setTransform(view.scale, 0, 0, view.scale, view.tx, view.ty);
   ```
   (Replace the existing clearRect setup.) Grid drawing should occur after the transform so grid zooms too (match frame2d behavior).

3. **Update canvas click handler** — replace the existing `(e.clientX - rect.left) * scaleX` / `scaleY` math with:
   ```javascript
   let { x: px, y: py } = toWorld(e.clientX, e.clientY);
   ```
   Use `px`, `py` wherever the old screen-pixel coords fed into origin/node placement and hit detection.

4. **Update mousemove handler** — use `toWorld(e.clientX, e.clientY)` for the displayed coordinates. Add pan logic at the top of the handler:
   ```javascript
   if (isPanning) {
     const rect = canvas.getBoundingClientRect();
     const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
     const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
     view.tx = panStartTx + (mx - panStartX);
     view.ty = panStartTy + (my - panStartY);
     draw();
     return;
   }
   ```

5. **Wheel zoom** — add after the click/mousemove listeners:
   ```javascript
   canvas.addEventListener('wheel', e => {
     e.preventDefault();
     const rect = canvas.getBoundingClientRect();
     const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
     const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
     const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
     view.tx = mx - (mx - view.tx) * factor;
     view.ty = my - (my - view.ty) * factor;
     view.scale *= factor;
     draw();
   }, { passive: false });
   ```

6. **Middle-mouse pan** — add:
   ```javascript
   canvas.addEventListener('mousedown', e => {
     if (e.button !== 1) return;
     e.preventDefault();
     isPanning = true;
     const rect = canvas.getBoundingClientRect();
     panStartX = (e.clientX - rect.left) * (canvas.width / rect.width);
     panStartY = (e.clientY - rect.top)  * (canvas.height / rect.height);
     panStartTx = view.tx;
     panStartTy = view.ty;
   });
   canvas.addEventListener('mouseup',   () => { isPanning = false; });
   canvas.addEventListener('mouseleave', () => { isPanning = false; });
   ```

7. **Node label overlay** — add (note: 2 DOF/node for truss):
   ```javascript
   function drawNodeLabels() {
     ctx.save();
     ctx.font = '600 11px Arial';
     ctx.fillStyle = '#1a2744';
     ctx.textAlign = 'left';
     ctx.textBaseline = 'bottom';
     nodes.forEach(function(n, i) {
       var base = i * 2 + 1;
       var label = 'N' + i + ' [' + base + ',' + (base + 1) + ']';
       ctx.fillText(label, n.x + 8, n.y - 8);
     });
     ctx.restore();
   }
   ```
   In `draw()`, after `drawNodes()`, add:
   ```javascript
   if (document.getElementById('chkNodeLabels')?.checked) drawNodeLabels();
   ```

8. **Supports/loads toggles** — in `draw()`, wrap:
   ```javascript
   if (document.getElementById('chkSupports')?.checked) drawSupports();
   if (document.getElementById('chkLoads')?.checked) drawLoads();
   ```

9. **Scale fonts with symbol size** — in `drawMemberLabel()` replace `ctx.font = '10px Arial'` with:
   ```javascript
   const fs = Math.round(10 * getSymbolScale());
   ctx.font = `${fs}px Arial`;
   ```
   In `drawNodes()` replace `ctx.font = 'bold 11px Arial'` with:
   ```javascript
   const fs = Math.round(11 * getSymbolScale());
   ctx.font = `bold ${fs}px Arial`;
   ```

10. **Stress column in results** — in `renderResults()`:
    - Add `<th>σ (MPa)</th>` to the Member Forces table header.
    - In the per-member forEach loop (where `idx` is the member index):
      ```javascript
      const stress = res.meta?.member_stresses?.[idx];
      ```
    - Add a cell:
      ```html
      <td>${stress !== undefined ? (stress / 1e6).toFixed(2) : '—'}</td>
      ```

Do not change solver logic, API calls, or other UI sections. Preserve existing functionality (undo, reset model, solve, snapshot, etc.).
  </action>
  <verify>
    <automated>node -c ui/truss2d/script.js</automated>
  </verify>
  <done>
    script.js parses cleanly; contains `function toWorld`, `function resetView`, `drawNodeLabels`, wheel listener, middle-mouse pan handlers, `chkSupports`/`chkLoads`/`chkNodeLabels` guards, `getSymbolScale()` used for member-label and node-label fonts, and `member_stresses` lookup in renderResults.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Update index.html with display toggles + Reset View button, then verify in browser</name>
  <files>ui/truss2d/index.html</files>
  <action>
Add to the Display `<section>` (alongside existing display controls):
```html
<label class="checkbox-label">
  <input type="checkbox" id="chkSupports" checked> Show supports
</label>
<label class="checkbox-label">
  <input type="checkbox" id="chkLoads" checked> Show loads
</label>
<label class="checkbox-label">
  <input type="checkbox" id="chkNodeLabels"> Node labels / DOFs
</label>
```

Each checkbox should trigger a redraw on change — either via `onchange="draw()"` inline, or by attaching listeners in script.js during init (follow whichever pattern frame2d uses; prefer consistency with frame2d).

Add a Reset View button near the existing Undo / Reset buttons in the Edit section:
```html
<button class="tool-btn" onclick="resetView()">🔍 Reset View</button>
```

No CSS changes expected; existing `.checkbox-label` and `.tool-btn` styles should cover these elements.
  </action>
  <what-built>
    Zoom (scroll wheel, cursor-anchored), middle-mouse pan, Reset View button, node label overlay with 2-DOF numbering, independent toggles for supports/loads/node-labels, member and node label fonts scaling with the symbol size slider, and a σ (MPa) column in the Member Forces results table.
  </what-built>
  <how-to-verify>
    1. Start the API: `uvicorn api_server.app:app --reload` from `pda_project/`.
    2. Open `ui/truss2d/index.html` in a browser (or serve it however you usually do).
    3. Place 3–4 nodes, connect members, add a support and a load.
    4. **Zoom:** scroll the mouse wheel over the canvas — structure should zoom toward the cursor.
    5. **Pan:** hold middle mouse button and drag — structure should translate with cursor.
    6. **Reset View:** click "Reset View" — view returns to scale=1, tx=ty=0.
    7. **Click accuracy:** after zooming/panning, click to place a new node — it should appear exactly under the cursor (not offset).
    8. **Toggles:** uncheck "Show supports", "Show loads", and check "Node labels / DOFs" — each should hide/show the relevant overlay. Node labels should read e.g. `N0 [1,2]`, `N1 [3,4]`.
    9. **Symbol size:** drag the symbol size slider — member labels AND node labels should resize (not just supports/loads).
    10. **Solve:** click Solve. In the Member Forces table, confirm a σ (MPa) column appears with numeric values (or `—` if meta.member_stresses is absent).
    11. Confirm no regressions: undo, reset, snapshot export still work.
  </how-to-verify>
  <verify>
    <automated>grep -q chkNodeLabels ui/truss2d/index.html && grep -q "resetView()" ui/truss2d/index.html && echo OK</automated>
  </verify>
  <done>
    index.html contains the three new checkboxes and the Reset View button; browser verification steps 4–11 all pass.
  </done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `node -c ui/truss2d/script.js` parses without error
- `grep` confirms new DOM IDs and button in index.html
- Manual browser verification of zoom/pan/toggles/labels/stress column
</verification>

<success_criteria>
- Scroll wheel zooms canvas toward cursor; middle-mouse drag pans; Reset View restores default
- Clicks land at correct world coordinates at any zoom/pan state
- Node label overlay displays `Ni [base, base+1]` (2 DOF/node) when enabled
- Show supports / Show loads toggles function independently
- Member and node label fonts scale with the symbol size slider
- Member Forces table renders σ (MPa) column when `res.meta.member_stresses` is present
- No regressions in existing functionality (undo, reset, solve, snapshot)
</success_criteria>

<output>
After completion, create `.planning/quick/260414-roe-improve-truss2d-ui-add-zoom-in-out-pan-s/260414-roe-SUMMARY.md`
</output>
