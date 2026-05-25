---
phase: quick-260525-ahv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/truss2d/script.js
  - ui/truss2d/index.html
  - ui/frame2d/script.js
  - ui/frame2d/index.html
autonomous: false
must_haves:
  truths:
    - "Node labels in truss2d have a white filled rectangle behind the text so labels do not overlap member lines"
    - "Node labels in frame2d have a white filled rectangle behind the text so labels do not overlap member lines"
    - "Truss2d has a Show grid checkbox in the Display section, checked by default, that toggles grid visibility"
    - "Frame2d has a Show grid checkbox in the Display section, checked by default, that toggles grid visibility"
    - "Truss2d exportMode still suppresses grid regardless of checkbox state"
  artifacts:
    - path: "ui/truss2d/script.js"
      provides: "drawNodeLabels white background + chkGrid guard in draw()"
    - path: "ui/truss2d/index.html"
      provides: "chkGrid checkbox in Display section"
    - path: "ui/frame2d/script.js"
      provides: "drawNodeLabels white background + chkGrid guard in draw()"
    - path: "ui/frame2d/index.html"
      provides: "chkGrid checkbox in Display section"
  key_links:
    - from: "ui/truss2d/index.html#chkGrid"
      to: "ui/truss2d/script.js draw()"
      via: "onchange=draw() + conditional guard"
    - from: "ui/frame2d/index.html#chkGrid"
      to: "ui/frame2d/script.js draw()"
      via: "addEventListener change + conditional guard"
---

<objective>
Add white background rectangles behind node labels in both truss2d and frame2d UIs to prevent text overlapping member lines, and add a "Show grid" toggle checkbox to the Display section of both UIs.

Purpose: Node labels at support nodes overlap member lines making them hard to read. Grid toggle lets users declutter the canvas when inspecting results or capturing clean screenshots.
Output: 4 files modified (script.js + index.html for each UI).
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@ui/truss2d/script.js
@ui/truss2d/index.html
@ui/frame2d/script.js
@ui/frame2d/index.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add white background behind node labels in both UIs</name>
  <files>ui/truss2d/script.js, ui/frame2d/script.js</files>
  <action>
**truss2d — `drawNodeLabels()` at line 529 of `ui/truss2d/script.js`:**

Inside the `nodes.forEach` loop (after computing `label` but before `ctx.fillText`), add a white background rect:

1. Set `ctx.font` BEFORE measuring (it is already set at the top of the function for normal mode; for `exportMode` branch it sets `bold 13px Arial` — measure must happen AFTER the font assignment in each branch).
2. Use `ctx.measureText(label)` to get `textWidth`.
3. Derive text height from the font size: normal mode = 11, exportMode = 13. Use a height multiplier of ~1.3 (i.e., `fontSize * 1.3`).
4. Since `textAlign = 'left'` and `textBaseline = 'bottom'`, the rect origin is `(n.x + 8 - pad, n.y - 8 - textHeight + pad)` with dimensions `(textWidth + 2*pad, textHeight + 2*pad)` where `pad = 2`.
5. Fill the rect with `ctx.fillStyle = 'rgba(255,255,255,0.85)'` (slightly transparent white, not fully opaque, so it blends nicely).
6. Restore `ctx.fillStyle = '#1a2744'` before calling `ctx.fillText`.

Resulting code shape inside the forEach:
```javascript
var fontSize, label;
if (exportMode) {
  label = String(i + 1);
  ctx.font = 'bold 13px Arial';
  fontSize = 13;
} else {
  var base = i * 2 + 1;
  label = 'N' + i + ' [' + base + ',' + (base + 1) + ']';
  fontSize = 11;
}
var pad = 2;
var tw = ctx.measureText(label).width;
var th = fontSize * 1.3;
ctx.fillStyle = 'rgba(255,255,255,0.85)';
ctx.fillRect(n.x + 8 - pad, n.y - 8 - th, tw + 2 * pad, th + pad);
ctx.fillStyle = '#1a2744';
ctx.fillText(label, n.x + 8, n.y - 8);
```

Note: the font is set once at top for normal mode (`'600 11px Arial'`) and overridden inside the loop for exportMode. The fontSize variable captures whichever is active. Move the font-set for normal mode BEFORE the loop (it already is at line 531) and keep the exportMode override inside the branch.

**frame2d — `drawNodeLabels()` at line 1551 of `ui/frame2d/script.js`:**

Same pattern inside `nodes.forEach`. The font is set once before the loop via:
`ctx.font = '600 ' + Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() + 1) + 'px ' + LABEL_FONT_FAMILY;`

Inside the forEach, after computing `label`:
1. Compute `fontSize` = `Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() + 1)` (match the value used in the font string — or extract it before the loop into a variable to avoid recomputation).
2. Use `ctx.measureText(label).width` for text width.
3. Draw background rect using a theme-aware CSS variable. Add a `--canvas-label-bg` token to `ui/frame2d/style.css` in both `:root` and `[data-theme="dark"]`:

```css
:root {
  --canvas-label-bg: rgba(255,255,255,0.85);
}
[data-theme="dark"] {
  --canvas-label-bg: rgba(26,29,35,0.85);
}
```

4. Draw `ctx.fillRect(n.x + 8 - pad, n.y - 8 - th, tw + 2*pad, th + pad)`.
5. Restore `ctx.fillStyle = cssVar('--canvas-label')` before `ctx.fillText`.

For frame2d, extract fontSize into a variable before the loop:
```javascript
var fontSize = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() + 1);
ctx.font = '600 ' + fontSize + 'px ' + LABEL_FONT_FAMILY;
// ... inside forEach:
var pad = 2;
var tw = ctx.measureText(label).width;
var th = fontSize * 1.3;
ctx.fillStyle = cssVar('--canvas-label-bg');
ctx.fillRect(n.x + 8 - pad, n.y - 8 - th, tw + 2 * pad, th + pad);
ctx.fillStyle = cssVar('--canvas-label');
ctx.fillText(label, n.x + 8, n.y - 8);
```

**Scope constraint:** Do NOT change any other draw functions, solver logic, API, or test files.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && grep -n 'measureText\|fillRect.*pad\|canvas-label-bg' ui/truss2d/script.js ui/frame2d/script.js ui/frame2d/style.css | head -20</automated>
  </verify>
  <done>Both drawNodeLabels() functions draw a filled background rectangle behind each label using ctx.measureText for width. Labels no longer overlap member lines at support nodes. Frame2d uses theme-aware background via CSS variable.</done>
</task>

<task type="auto">
  <name>Task 2: Add Show grid checkbox toggle to both UIs</name>
  <files>ui/truss2d/index.html, ui/truss2d/script.js, ui/frame2d/index.html, ui/frame2d/script.js</files>
  <action>
**truss2d HTML — `ui/truss2d/index.html` around line 86 (Display section):**

Add a "Show grid" checkbox at the TOP of the Display section (before Show deflected shape), with `id="chkGrid"`, `checked` by default, and `onchange="draw()"`:

```html
<label class="checkbox-label">
  <input type="checkbox" id="chkGrid" checked onchange="draw()"> Show grid
</label>
```

Insert this as the first item inside the Display `<section>` (after `<h3>Display</h3>`, before the existing `chkDeflected` label). This matches logical ordering: grid is the most fundamental canvas layer.

**truss2d JS — `ui/truss2d/script.js` line 394:**

Current: `if (!exportMode) drawGrid();`
Change to: `if (!exportMode && document.getElementById('chkGrid')?.checked) drawGrid();`

The `?.checked` null-safe access ensures backward compatibility if the checkbox is somehow missing.

**frame2d HTML — `ui/frame2d/index.html` around line 142 (Display card):**

Add a "Show grid" checkbox in the first `<div class="display-col">` (the left column), as the FIRST item (before Show supports). This puts grid at the top of the display toggles, which is logical since grid is the most fundamental canvas layer:

```html
<label class="checkbox-label">
  <input type="checkbox" id="chkGrid" checked> Show grid
</label>
```

Note: frame2d uses `addEventListener` for change events (not inline `onchange`), so do NOT add `onchange` here.

**frame2d JS — `ui/frame2d/script.js` line 911:**

Current: `drawGrid();` (unconditional)
Change to: `if (document.getElementById('chkGrid')?.checked) drawGrid();`

**frame2d JS — event wiring at line ~2069 (after chkNodeLabels listener):**

Add after the `chkNodeLabels` addEventListener line:
```javascript
document.getElementById('chkGrid').addEventListener('change', draw);
```

**Scope constraint:** Do NOT change any other draw functions, solver logic, API, or test files. Do NOT change the truss2d exportMode guard — exportMode already suppresses grid independently of the checkbox via the compound condition.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && grep -n 'chkGrid' ui/truss2d/index.html ui/truss2d/script.js ui/frame2d/index.html ui/frame2d/script.js</automated>
  </verify>
  <done>Both UIs have a "Show grid" checkbox in the Display section, checked by default. Unchecking hides the grid. Truss2d exportMode still suppresses grid regardless. Frame2d event wiring follows the existing addEventListener pattern.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Browser UAT — node label backgrounds and grid toggle</name>
  <action>Human verifies all 4 visual changes in both UIs via browser.</action>
  <what-built>White background behind node labels (both UIs) + Show grid checkbox toggle (both UIs)</what-built>
  <how-to-verify>
    1. Open truss2d UI at https://catrins-imac.tail568b7e.ts.net/ui/truss2d/index.html
    2. Place 3+ nodes and connect with members. Enable "Node labels / DOFs" checkbox.
    3. Verify: each node label has a white background rectangle, text does not overlap member lines.
    4. Verify: "Show grid" checkbox is visible in Display section, checked by default.
    5. Uncheck "Show grid" — grid disappears. Re-check — grid returns.
    6. Open frame2d UI at https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html
    7. Place 3+ nodes and connect with members. Enable "Node labels" checkbox.
    8. Verify: each node label has a background rectangle (white in light mode, dark in dark mode).
    9. Verify: "Show grid" checkbox is visible in Display section, checked by default.
    10. Uncheck "Show grid" — grid disappears. Re-check — grid returns.
    11. Toggle dark mode in frame2d — verify label backgrounds match the theme.
  </how-to-verify>
  <verify>Human visual inspection</verify>
  <done>All 4 changes confirmed working in both UIs across light and dark themes.</done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No trust boundaries crossed. All changes are client-side canvas rendering and HTML checkbox toggles. No API calls, no user input processing, no data persistence affected.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ahv-01 | N/A | canvas rendering | accept | Pure visual changes to client-side canvas. No security surface. |
</threat_model>

<verification>
- `grep -c 'measureText' ui/truss2d/script.js` returns >= 1
- `grep -c 'measureText' ui/frame2d/script.js` returns >= 1
- `grep -c 'chkGrid' ui/truss2d/index.html` returns >= 1
- `grep -c 'chkGrid' ui/frame2d/index.html` returns >= 1
- `grep 'chkGrid.*checked.*drawGrid\|drawGrid.*chkGrid' ui/truss2d/script.js` matches the conditional
- `grep 'chkGrid.*checked.*drawGrid\|drawGrid.*chkGrid' ui/frame2d/script.js` matches the conditional
- pytest passes (no solver/API/test changes)
</verification>

<success_criteria>
- Node labels in both UIs render with a filled background rectangle behind text
- Both UIs have a "Show grid" checkbox (checked by default) that toggles grid visibility
- Truss2d exportMode still suppresses grid regardless of checkbox state
- Frame2d label background respects light/dark theme
- Zero solver_core / api_server / tests changes
- pytest 61/61 green (no regressions)
</success_criteria>

<output>
After completion, create `.planning/quick/260525-ahv-node-label-white-background-grid-toggle-/260525-ahv-SUMMARY.md`
</output>
