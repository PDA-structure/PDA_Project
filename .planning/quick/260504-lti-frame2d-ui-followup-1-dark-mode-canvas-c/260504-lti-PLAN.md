---
phase: 260504-lti
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/style.css
  - ui/frame2d/index.html
  - ui/frame2d/script.js
autonomous: false
requirements:
  - QUICK-260504-lti
must_haves:
  truths:
    - "In dark mode, every canvas-drawn element (members, nodes, supports, node loads, UDL arrows, BMD/SFD polygons, deflected shape, labels, grid) is visibly contrasted against the dark canvas background — no near-invisible #1a2744 navy on dark"
    - "Right-side toolbar buttons (Reset View, GEOMETRY/SUPPORTS/NODE LOADS/MEMBER LOADS/MEMBER PROPERTIES/EDIT/FILE section headers and their tool-btns) are visibly lighter in dark mode than the page background — better contrast than the j8m baseline"
    - "When a member's axial force is < 1e-3 in absolute value, no '0.00 kN' label is drawn on it (the same threshold that already gates the line colour now also gates the LABEL)"
    - "Default canvas label font size is ~10px (down from the j8m mix of 10/11/12 px) — feels noticeably smaller / less obtrusive"
    - "A label-zoom slider (id=inputLabelScale) sits in the Display panel beside inputDiagramScale and inputSymbolScale; dragging it 0.5x to 2.0x resizes every canvas label live, no other elements affected"
    - "Cantilever regression solve still gives M ≈ 50 kNm at fixed end and V ≈ 10 kN — the colour/label changes do not touch any solver, API, or save/load path"
    - "Save/load JSON round-trip remains unchanged — no JSON format change introduced by this plan"
    - "Zero behaviour change in: mode-string identifiers, panel positions (left rail), keyboard shortcuts, hit-test math, solver/API contracts. Only canvas colour-source, label-suppression guard, label-size scaling, and dark-mode button contrast"
  artifacts:
    - path: "ui/frame2d/style.css"
      provides: "≥10 canvas-* colour tokens defined in :root and overridden in [data-theme=\"dark\"]; --canvas-label-size token in :root; lighter dark-mode tool-btn / panel-section h3 background overrides"
      contains: "--canvas-stroke"
    - path: "ui/frame2d/script.js"
      provides: "cssVar(name) helper; every ctx.strokeStyle/fillStyle = '#...' literal in canvas-drawing functions replaced with cssVar('--canvas-...') call; Math.abs(f) > 1e-3 guard around member-force LABEL drawing block; labelScale state variable + listener wired to inputLabelScale; every ctx.font assignment scaled via labelScale + --canvas-label-size"
      contains: "cssVar"
    - path: "ui/frame2d/index.html"
      provides: "<input type=\"range\" id=\"inputLabelScale\" min=\"0.5\" max=\"2.0\" step=\"0.1\" value=\"1.0\"> in Display panel"
      contains: "inputLabelScale"
  key_links:
    - from: "drawing functions in ui/frame2d/script.js (drawGrid / drawMembers / drawNodes / drawSupports / drawNodeLoads / drawUDLs / drawNodeLabels / drawBMD / drawSFD / drawDeflected / labelText)"
      to: "CSS custom properties --canvas-* defined in :root and [data-theme=\"dark\"]"
      via: "cssVar(name) helper that calls getComputedStyle(document.documentElement).getPropertyValue(name).trim()"
      pattern: "cssVar\\('--canvas-"
    - from: "inputLabelScale change/input listener in ui/frame2d/script.js"
      to: "labelScale module-level variable + draw()"
      via: "addEventListener('input', e => { labelScale = parseFloat(e.target.value); draw(); })"
      pattern: "inputLabelScale"
    - from: "every ctx.font = '...' assignment in ui/frame2d/script.js"
      to: "labelScale * BASE_LABEL_SIZE (where BASE_LABEL_SIZE comes from --canvas-label-size token, default 10)"
      via: "Math.round(BASE_LABEL_SIZE * labelScale) + 'px Inter, system-ui, sans-serif' template-string composition"
      pattern: "labelScale"
    - from: "[data-theme=\"dark\"] block in ui/frame2d/style.css"
      to: ".tool-btn / .panel-section h3 (right-rail buttons + section headers)"
      via: "lighter --color-surface-alt / --color-fg-faint (or new --color-button-bg) tokens overridden under dark theme"
      pattern: "\\[data-theme=\"dark\"\\]"
    - from: "drawMembers() label drawing block in ui/frame2d/script.js (~line 855)"
      to: "Math.abs(f) > 1e-3 guard"
      via: "if-block wrapping the labelText()/fillText() call that prints 'X.XX kN'"
      pattern: "Math\\.abs\\(.+\\)\\s*>\\s*1e-3"
---

<objective>
Frame2D UI followup-1 polish round addressing 5 specific user complaints captured after j8m UAT approval:

1. **Dark-mode canvas content visibility** — every hardcoded canvas colour (#1a2744 navy, #1565c0 tension blue, #b71c1c compression red, #999 zero, #eee grid, etc.) replaced with `cssVar('--canvas-*')` reading theme-aware tokens, so canvas content stays legible in both light and dark modes.
2. **Buttons too dark in dark mode** — `[data-theme="dark"]` overrides bumped lighter for `.tool-btn` / panel-section header backgrounds.
3. **Zero-value '0.00 kN' labels** — wrap member-force label drawing with the same `Math.abs(f) > 1e-3` threshold that already gates the line colour.
4. **Default label font too big** — drop to 10 px via a `--canvas-label-size` token.
5. **Optional label-size slider** — new `inputLabelScale` range slider (0.5 → 2.0) in the Display panel, multiplies all canvas font sizes live.

Purpose: closes the followup feedback round on j8m without disturbing the just-landed cosmetic baseline. Each task is atomic, independently revertable, and stays inside the j8m safety contract (no solver/API/test/truss2d/save-load/mode-string/hit-test changes).

Output:
- 3 atomic auto commits (canvas colour token migration; dark-mode button contrast + zero-label suppression; smaller default label font + label-size slider).
- 1 manual UAT checkpoint after the 3 commits land.
- All canvas colours flow through `--canvas-*` tokens (no hardcoded hex literals on `ctx.strokeStyle` / `ctx.fillStyle` in canvas-drawing code paths).
- Untouched: `solver_core/`, `api_server/`, `tests/`, `ui/truss2d/`, save/load JSON format, mode strings, keyboard shortcuts, hit-test math.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@ui/frame2d/style.css
@ui/frame2d/index.html
@ui/frame2d/script.js
@.planning/quick/260504-j8m-frame2d-ui-cosmetic-modernisation-tailsc/260504-j8m-PLAN.md
@.planning/quick/260504-j8m-frame2d-ui-cosmetic-modernisation-tailsc/260504-j8m-SUMMARY.md

<interfaces>
<!-- Concrete code shapes already present. Use these directly — no codebase exploration needed. -->

### File sizes
- `ui/frame2d/style.css` — 341 lines (post-j8m, with full :root + [data-theme="dark"] token blocks already in place)
- `ui/frame2d/index.html` — 293 lines
- `ui/frame2d/script.js` — 2148 lines

### Existing tokens already in style.css :root (post-j8m, lines 2-59)
The j8m commit already established a token system. This plan EXTENDS that system with canvas-specific tokens — it does NOT redo j8m's UI-chrome tokens.

Existing tokens MUST be aliased where a 1:1 mapping exists (DRY, automatic dark-mode):
- `--color-info: #1565c0` (already drives tension result text — alias as `--canvas-tension: var(--color-info);`)
- `--color-danger-strong: #b71c1c` (already drives `.compression` class — alias as `--canvas-compression: var(--color-danger-strong);`)
- `--color-grid: #eeeeee` light / `#232932` dark (j8m already added — alias as `--canvas-grid: var(--color-grid);` — light/dark handled automatically)
- `--color-accent: #1a2744` light / `#4a6db5` dark (j8m navy — alias as `--canvas-stroke: var(--color-accent);`)
- `--color-fg-subtle: #777777` (close to `#999` zero — executor's call: alias OR define `--canvas-zero` as a fresh literal)

The executor MUST alias canvas-* tokens that have a 1:1 equivalent in the j8m token system to the existing `var(--color-*)` value (DRY-er, automatic dark-mode handling). The four mandatory aliases are:
```css
:root {
  --canvas-stroke: var(--color-accent);          /* was '#1a2744' navy */
  --canvas-tension: var(--color-info);           /* was '#1565c0' */
  --canvas-compression: var(--color-danger-strong); /* was '#b71c1c' */
  --canvas-grid: var(--color-grid);              /* was '#eee' — j8m already provides light/dark variants */
}
```
Tokens with no j8m equivalent (e.g. `--canvas-spring`, `--canvas-udl`, `--canvas-pin-release`) are defined as literal hex values per Step 1's token list. Aliasing avoids redundant dark-mode overrides — `--canvas-grid` automatically gets `#232932` in dark because `--color-grid` already does.

### Hardcoded canvas colour literals in script.js — full inventory (30 ctx.{strokeStyle,fillStyle} hex literals + 6 rgba() literals + 3 indirect sites: `color` var assignments, `RED` const, `labelText()` color args)
Audit list — every line that needs token migration in Task 1:

| Line | Original | Target token | Notes |
|---|---|---|---|
| 801 | `ctx.strokeStyle = '#eee';` | `--canvas-grid` | drawGrid |
| 835 (NOT a ctx.* assignment but assigns `color`) | `let color = m.type === 'bar' ? '#555' : '#1a2744';` | `cssVar('--canvas-bar')` / `cssVar('--canvas-stroke')` | drawMembers — `color` var, used at 844 |
| 840 | `color = ... ? '#999' : (f > 0 ? '#1565c0' : '#b71c1c');` | `--canvas-zero` / `--canvas-tension` / `--canvas-compression` | drawMembers force-coloured branch |
| 857 | `ctx.strokeStyle = '#3f51b5';` | `--canvas-member-preview` (or reuse `--color-accent-bright`) | drawMembers preview line |
| 882 | `ctx.fillStyle = color;` | leave as-is (`color` is local var, derived from token) | labelText helper |
| 899 | `ctx.strokeStyle = '#ff6f00';` | `--canvas-pin-release` | drawPinCircle outline |
| 902 | `ctx.fillStyle = '#fff';` | `--canvas-pin-release-fill` (or reuse `--color-surface`) | drawPinCircle fill |
| 911 | `ctx.fillStyle = '#e53935';` | `--canvas-node` (red node marker) | drawNodes |
| 913 | `ctx.fillStyle = '#222';` | `--canvas-label` | drawNodes id label |
| 938 | `const RED = '#e53935';` | `cssVar('--canvas-diagnostic')` (or reuse `--canvas-node`) | drawDiagnosticOverlays |
| 1008 | `ctx.fillStyle = '#1a2744';` | `--canvas-support` | drawFixed (hatch fill) |
| 1016 | `ctx.strokeStyle = '#1a2744'; ctx.fillStyle = '#1a2744';` | `--canvas-support` | drawPin |
| 1028 | same | `--canvas-support` | drawRollerH |
| 1044 | same | `--canvas-support` | drawRollerV |
| 1063 | `ctx.strokeStyle = '#6a1b9a'; ctx.fillStyle = '#6a1b9a';` | `--canvas-spring` | drawSpring |
| 1121 | `ctx.fillStyle = '#6a1b9a';` | `--canvas-spring` | drawSpring labels |
| 1129 | `ctx.strokeStyle = '#1a2744';` | `--canvas-support` | drawSpring base line |
| 1150 | `ctx.strokeStyle = '#2e7d32'; ctx.fillStyle = '#2e7d32';` | `--canvas-load` | drawNodeLoads y-direction |
| 1158, 1167 | `ctx.fillStyle = '#1b5e20';` (label colours after `ctx.font='10px Arial'`) | `--canvas-load-label` (or reuse `--canvas-load`) | drawNodeLoads value text |
| 1174 | `ctx.strokeStyle = '#6a1b9a'; ctx.fillStyle = '#6a1b9a';` | `--canvas-load-moment` (or reuse `--canvas-spring`) | drawNodeLoads moment-arc colour |
| 1189 | `ctx.fillStyle = '#4a148c';` | `--canvas-load-moment-label` (or reuse `--canvas-load-moment`) | drawNodeLoads moment value text |
| 1199 | `ctx.fillStyle = '#1a2744';` | `--canvas-label` | drawNodeLabels |
| 1222 | `ctx.strokeStyle = '#7b1fa2'; ctx.fillStyle = '#7b1fa2';` | `--canvas-udl` | drawUDLs (vertical UDL arrows) |
| 1249 | `ctx.fillStyle = '#4a148c';` | `--canvas-udl-label` (or reuse `--canvas-udl`) | drawUDLs value text |
| 1267 | `ctx.strokeStyle = '#0288d1'; ctx.fillStyle = '#0288d1';` | `--canvas-udl-x` | drawUDLs (horizontal UDL arrows) |
| 1298 | `ctx.fillStyle = '#01579b';` | `--canvas-udl-x-label` (or reuse `--canvas-udl-x`) | drawUDLs (horizontal UDL value text) |
| 1313 | `ctx.fillStyle = 'rgba(255,255,255,0.88)';` | `--canvas-label-bg` (semi-transparent text-backing rect) | labelText helper — NB: rgba, may need `rgba()` literal in dark mode (e.g. `rgba(22,26,32,0.88)` to match dark canvas-bg) |
| 1315 | `ctx.fillStyle = color;` | leave as-is (param) | labelText helper |
| 1334 | `ctx.strokeStyle = 'rgba(255,152,0,0.75)';` | `--canvas-deflected` | drawDeflected (must be visible on both themes — use a warm orange that works on both) |
| 1395 | `labelText('δ=...', maxLX, maxLY - 12, '#e65100');` | `cssVar('--canvas-deflected-label')` | passed as `color` arg to labelText |
| 1433 | `ctx.fillStyle = 'rgba(33, 150, 243, 0.25)';` | `--canvas-bmd-fill` | drawBMD polygon fill |
| 1434 | `ctx.strokeStyle = '#1565c0';` | `--canvas-bmd` | drawBMD polygon outline |
| 1465 | `ctx.strokeStyle = '#999';` | `--canvas-zero` | drawBMD baseline reset stroke |
| 1467 | repeated pair | `--canvas-bmd-fill` / `--canvas-bmd` | drawBMD inside-loop reset |
| 1485, 1490, 1502 | `labelText(fmtM(...), ..., '#1565c0');` | `cssVar('--canvas-bmd')` | drawBMD labels (already inside chkDiagLabels guard) |
| 1529 | `ctx.fillStyle = 'rgba(76, 175, 80, 0.25)';` | `--canvas-sfd-fill` | drawSFD polygon fill |
| 1530 | `ctx.strokeStyle = '#2e7d32';` | `--canvas-sfd` | drawSFD polygon outline |
| 1559 | `ctx.strokeStyle = '#999';` | `--canvas-zero` | drawSFD baseline reset stroke |
| 1561 | repeated pair | `--canvas-sfd-fill` / `--canvas-sfd` | drawSFD inside-loop reset |
| 1578, 1582, 1594 | `labelText(fmtV(...), ..., '#2e7d32');` | `cssVar('--canvas-sfd')` | drawSFD labels (already inside chkDiagLabels guard) |
| 1588 | `ctx.strokeStyle = '#2e7d32';` | `--canvas-sfd` | drawSFD V=0 zero-crossing tick |

After Task 1, the gate `grep -nE "ctx\.(strokeStyle|fillStyle)\s*=\s*'#" ui/frame2d/script.js` MUST return zero lines. (Lines that assign a local `color` variable derived from a `cssVar()` call, like line 844 `ctx.strokeStyle = color;`, are FINE — they don't match the regex.)

NB: the rgba() literals on lines 1313, 1334, 1433, 1467, 1529, 1561 are NOT matched by the `'#` regex above. They are NOT strictly required to migrate (the gate doesn't fail on them), but the executor SHOULD migrate them to tokens for theme correctness — see "rgba handling" below.

### rgba handling — pragmatic migration approach
For semi-transparent fills (text-backing rect, BMD/SFD shape fills, deflected outline), the executor has two options:

**Option A (preferred — single-source token):**
Define each as a fully opaque token, accept the visual difference. e.g. `--canvas-bmd-fill: rgba(33, 150, 243, 0.25);` in `:root` with `--canvas-bmd-fill: rgba(90, 169, 230, 0.30);` in dark. Both light and dark store rgba strings.

**Option B (keep alpha as separate constant):**
Define `--canvas-bmd: #1565c0;` and `--canvas-bmd-alpha: 0.25;`, compose in JS via `'rgba(' + hexToRgb(cssVar('--canvas-bmd')) + ',' + cssVar('--canvas-bmd-alpha') + ')'` — overkill.

Use Option A. The 6 rgba sites become 6 rgba-valued tokens. The verifier regex (`'#`) does NOT cover rgba, so this is a soft requirement; document the choice in the SUMMARY.

### Existing labelText helper (script.js 1303-1318) — what to change in Task 3
```js
function labelText(text, x, y, color) {
  ctx.save();
  const fs = Math.round(10 * getSymbolScale());
  ctx.font = `bold ${fs}px sans-serif`;
  ...
}
```
After Task 3:
```js
function labelText(text, x, y, color) {
  ctx.save();
  const fs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());
  ctx.font = `bold ${fs}px ${LABEL_FONT_FAMILY}`;
  ...
}
```
Where `BASE_LABEL_SIZE = 10` (parsed from `--canvas-label-size` once at module load, or hardcoded as a constant with the token serving as its CSS-side documentation), and `labelScale` is the new module-level variable (default 1.0) wired to `inputLabelScale`. `LABEL_FONT_FAMILY = 'Inter, system-ui, sans-serif'` is a one-line constant near the top.

### All ctx.font sites (10 total) — full inventory for Task 3
Lines 883, 914, 1119, 1158, 1167, 1189, 1198, 1249, 1298, 1308. Each currently uses a literal pixel value (`'10px Arial'`, `'bold 11px Arial'`, `'9px Arial'`, `'600 11px Arial'`, etc.) and family `'Arial'` or `'sans-serif'`.

Replace pattern:
- Compute the scaled size: `const fs_${suffix} = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());` — or inline as `Math.round(...)`.
- Compose the font string: `ctx.font = (isBold ? 'bold ' : '') + fs + 'px ' + LABEL_FONT_FAMILY;`
- Where `isBold` was true in the original (lines 914, 1198, 1249, 1298, 1308), preserve `bold`.

Example for line 883 (`ctx.font = '10px Arial';`):
```js
ctx.font = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale()) + 'px ' + LABEL_FONT_FAMILY;
```

Example for line 914 (`ctx.font = 'bold 11px Arial';` — node id label, bold, currently 11px):
```js
ctx.font = 'bold ' + Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() * 1.1) + 'px ' + LABEL_FONT_FAMILY;
```
The `* 1.1` keeps node-ID labels slightly larger than other labels (preserves a hint of the existing 11/10 hierarchy). Alternatively pick `fs` then add 1: `(fs + 1) + 'px'`. Executor's call.

Line 1198 (`'600 11px Arial'` — `drawNodeLabels` overlay) is a font-WEIGHT 600 + size 11 — preserve as `'600 ' + fs + 'px Inter'`.

Line 1119 (`'9px Arial'` — small spring K-value annotation) — keep slightly smaller: `Math.round(BASE_LABEL_SIZE * 0.9 * labelScale * getSymbolScale())`.

The verifier checks that `labelScale` is referenced from script.js and that `inputLabelScale` exists in HTML — it does NOT enforce a specific weight pattern, so the executor has flexibility on size hierarchy.

### `inputLabelScale` slider — exact HTML insertion site
In `ui/frame2d/index.html`, the Display panel runs lines 140-176 (post-j8m). The existing slider-style controls (`inputDiagramScale`, `inputSymbolScale`) are at lines 161-169. Insert the new `inputLabelScale` immediately after `inputSymbolScale` (line 169), before the closing `</section>`:

```html
<label class="panel-label">Label size &times;
  <input type="range" id="inputLabelScale" min="0.5" max="2.0" step="0.1" value="1.0">
</label>
```

NB: spec says `<input type="range">`, NOT `type="number"`. Use `range` so the user gets a draggable slider (the user explicitly asked for a slider in the followup spec).

### `inputLabelScale` listener — insertion site in script.js
Existing block (lines 1600-1616):
```js
document.getElementById('chkSupports').addEventListener('change', draw);
document.getElementById('chkLoads').addEventListener('change', draw);
...
document.getElementById('inputDiagramScale').addEventListener('input', draw);
document.getElementById('inputSymbolScale').addEventListener('input', draw);
```
Add immediately after line 1616:
```js
document.getElementById('inputLabelScale').addEventListener('input', function (e) {
  labelScale = parseFloat(e.target.value) || 1.0;
  draw();
});
```
And declare `let labelScale = 1.0;` and `const BASE_LABEL_SIZE = 10;` and `const LABEL_FONT_FAMILY = 'Inter, system-ui, sans-serif';` near the top of script.js (alongside `const GRID = 20; const UNIT = 1;` at lines 76-77, OR alongside the `let mode = 'node'; ...` state block at 87-99 — executor's call).

### Member-force label suppression (Task 2) — exact location
drawMembers() spans lines 828 onwards. Lines 838-842:
```js
if (results && results.member_forces) {
  const f = results.member_forces[idx];
  color = Math.abs(f) < 1e-3 ? '#999' : (f > 0 ? '#1565c0' : '#b71c1c');
  forceLabel = (f / 1000).toFixed(2) + ' kN';
}
```
The colour-gating is at line 840 (already present — Math.abs(f) < 1e-3 → grey #999). The `forceLabel` is assigned on line 841 unconditionally — THIS is the bug. Then somewhere later (need to inspect lines 850-870) the executor will find the labelText/fillText call that prints `forceLabel`. Wrap that call (or reassign `forceLabel = null` when `Math.abs(f) <= 1e-3`):

Simplest fix at the source:
```js
if (results && results.member_forces) {
  const f = results.member_forces[idx];
  const isZero = Math.abs(f) < 1e-3;
  color = isZero ? cssVar('--canvas-zero') : (f > 0 ? cssVar('--canvas-tension') : cssVar('--canvas-compression'));
  forceLabel = isZero ? null : (f / 1000).toFixed(2) + ' kN';
}
```
Then ensure the later draw site checks `if (forceLabel) { ... }`. (The executor should grep for `forceLabel` references downstream of line 841 to confirm — there's typically one labelText/fillText call.)

For shears and moments, the j8m plan ALREADY gates the BMD/SFD numeric labels behind `chkDiagLabels.checked` (default OFF). The user's complaint #2 is specifically about MEMBER-FORCE (axial) labels which are drawn unconditionally in drawMembers — those are the only zero-value labels still leaking through when shears/moments are toggled off. So Task 2's label suppression is scoped to `forceLabel` in drawMembers ONLY. Inside drawBMD/drawSFD the existing chkDiagLabels gate already does the job.

### Dark-mode button contrast (Task 2) — what to adjust
Post-j8m `[data-theme="dark"]` block (style.css 311-341). The relevant tokens that drive button background:
- `.tool-btn` uses `var(--color-surface-alt)` → in dark it's `#232932` (line 314)
- panel-section background uses `var(--color-surface)` → dark = `#1a1f26` (line 313)

User complaint #1.1: buttons feel too dark against the page bg in dark mode. Two tunable options:
- Make `.tool-btn` background lighter — bump dark `--color-surface-alt` from `#232932` to ~`#2c333d` or ~`#323942`.
- Or define a new dark-only `--color-button-bg-dark` override and use it.

Recommended: simplest is to bump the existing dark `--color-surface-alt` value. Tunes `.tool-btn` automatically without changing the token system. Section header (`.panel-section h3`) uses `--color-fg-faint` for text colour — in dark that's `#6f747c` (line 320). May need to bump to `#8a9099` or `#9aa1aa` for legibility, but ONLY adjust if the user-visible UAT confirms it; the primary fix is the button background.

The verifier for Task 2 doesn't enforce specific hex values — it just asserts the dark block exists and the existing j8m structure is preserved. Visual judgement is delegated to the UAT in Task 4.

### Safety contract (continues from j8m)
Touched files (this task):
- `ui/frame2d/script.js` (canvas-drawing colour replacements, label guards, labelScale variable, font scaling)
- `ui/frame2d/style.css` (new canvas-* tokens in :root + [data-theme="dark"], dark-mode button overrides, label-size token)
- `ui/frame2d/index.html` (new inputLabelScale slider in Display panel)

Untouched files (this task):
- `solver_core/` (no — no Python code change)
- `api_server/` (no — no FastAPI route change)
- `tests/` (no — no test added/changed; pytest 61/61 implicit-pass after this plan)
- `ui/truss2d/` (no — separate UI, mirror task tracked in todos)
- `ui/fonts/` (no — Inter already self-hosted from j8m; no new font)

Behaviour invariants:
- No mode-string identifier changes (e.g. `'node'`, `'fixed'`, `'rollerX'`, `'udl'` strings unchanged)
- No save/load JSON format change (no new fields, no removed fields)
- No hit-test math change (`toWorld()`, `findNodeAt()`, `findMemberAt()` unchanged)
- No setMode() behaviour change
- No solver/API contract change (no `/solve/frame2d` request or response field added/changed)

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Commit 1): Theme-aware canvas colour tokens — replace every hardcoded ctx colour with cssVar()</name>
  <files>ui/frame2d/style.css, ui/frame2d/script.js</files>
  <action>
**Goal:** every `ctx.strokeStyle = '#...'` and `ctx.fillStyle = '#...'` literal in canvas-drawing functions becomes a `cssVar('--canvas-*')` call. Tokens are defined in BOTH `:root` (light values, mostly the existing colours) and `[data-theme="dark"]` (lighter equivalents that contrast against the dark canvas background) blocks of style.css. Pure mechanical migration — no layout / math / behaviour change.

**Step 1 — Add canvas-* tokens to `ui/frame2d/style.css`.**

In the existing `:root` block (top of file, lines 2-59), append these new tokens AFTER the existing typography section (line 59 ish, just before the closing `}`):

```css
  /* ── Canvas content colours (theme-aware) ─────────────────── */
  --canvas-stroke: #1a2744;            /* default member / outline (light navy) */
  --canvas-bar: #555555;               /* bar-element member colour (was '#555') */
  --canvas-node: #e53935;              /* node circle fill (red marker) */
  --canvas-label: #1a2744;             /* default label text colour */
  --canvas-grid: var(--color-grid);    /* aliases j8m token — auto light/dark via :root + [data-theme="dark"] inheritance */
  --canvas-support: #1a2744;           /* fixed/pinned/roller glyph stroke + fill */
  --canvas-spring: #6a1b9a;            /* spring support glyph */
  --canvas-load: #2e7d32;              /* X/Y node-load arrow */
  --canvas-load-label: #1b5e20;        /* node-load value text */
  --canvas-load-moment: #6a1b9a;       /* moment-load arc + arrowhead */
  --canvas-load-moment-label: #4a148c; /* moment-load value text */
  --canvas-udl: #7b1fa2;               /* vertical UDL arrows */
  --canvas-udl-label: #4a148c;         /* vertical UDL value text */
  --canvas-udl-x: #0288d1;             /* horizontal UDL arrows */
  --canvas-udl-x-label: #01579b;       /* horizontal UDL value text */
  --canvas-tension: #1565c0;           /* member force > 0 (was '#1565c0') */
  --canvas-compression: #b71c1c;       /* member force < 0 (was '#b71c1c') */
  --canvas-zero: #999999;              /* member force ~0 + diagram baselines (was '#999') */
  --canvas-bmd: #1565c0;               /* BMD outline colour */
  --canvas-bmd-fill: rgba(33, 150, 243, 0.25);  /* BMD polygon fill (semi-transparent blue) */
  --canvas-sfd: #2e7d32;               /* SFD outline colour */
  --canvas-sfd-fill: rgba(76, 175, 80, 0.25);   /* SFD polygon fill */
  --canvas-deflected: rgba(255, 152, 0, 0.75);  /* deflected-shape outline (orange) */
  --canvas-deflected-label: #e65100;   /* δ_max label colour */
  --canvas-pin-release: #ff6f00;       /* pin-release circle outline */
  --canvas-pin-release-fill: #ffffff;  /* pin-release circle fill */
  --canvas-label-bg: rgba(255, 255, 255, 0.88); /* labelText() text-backing rect */
  --canvas-member-preview: #3f51b5;    /* in-progress member preview line */
  --canvas-diagnostic: #e53935;        /* offending nodes/members highlight */
  --canvas-label-size: 10px;           /* default canvas label font size (Task 3 reads this) */
```

Then in the existing `[data-theme="dark"]` block (lines 311-341), append corresponding overrides BEFORE the closing `}`:

```css
  /* ── Canvas content colours — dark theme overrides ─────────── */
  --canvas-stroke: #cfd6e0;            /* members visible on dark canvas */
  --canvas-bar: #9aa1aa;               /* bar lighter on dark */
  --canvas-node: #ff7373;              /* node marker — softer red on dark */
  --canvas-label: #e6e8eb;             /* labels readable on dark canvas */
  /* --canvas-grid: omitted — aliases var(--color-grid) which j8m already overrides to #232932 in dark */
  --canvas-support: #cfd6e0;           /* support glyphs — match member stroke */
  --canvas-spring: #ce93d8;            /* spring purple — lifted for dark */
  --canvas-load: #6abf6e;              /* load green — brighter on dark */
  --canvas-load-label: #a5d6a7;        /* load label — even brighter for legibility */
  --canvas-load-moment: #ce93d8;
  --canvas-load-moment-label: #e1bee7;
  --canvas-udl: #ce93d8;               /* purple UDL on dark */
  --canvas-udl-label: #e1bee7;
  --canvas-udl-x: #5aa9e6;             /* horizontal UDL blue — lifted */
  --canvas-udl-x-label: #90caf9;
  --canvas-tension: #5aa9e6;           /* tension blue — lifted for dark */
  --canvas-compression: #ff7373;       /* compression red — softer on dark */
  --canvas-zero: #6f747c;              /* zero-force grey — visible on dark */
  --canvas-bmd: #5aa9e6;
  --canvas-bmd-fill: rgba(90, 169, 230, 0.30);
  --canvas-sfd: #6abf6e;
  --canvas-sfd-fill: rgba(106, 191, 110, 0.30);
  --canvas-deflected: rgba(255, 183, 77, 0.85); /* deflected shape — warmer on dark */
  --canvas-deflected-label: #ffb74d;
  --canvas-pin-release: #ffb74d;
  --canvas-pin-release-fill: #161a20;  /* match dark canvas-bg */
  --canvas-label-bg: rgba(22, 26, 32, 0.88); /* dark backing rect for labels */
  --canvas-member-preview: #6b8acc;    /* preview line on dark */
  --canvas-diagnostic: #ff7373;
```

The exact hex values are advisory; the executor may tune them — but each `:root` `--canvas-*` token MUST have an override here (otherwise the dark theme falls back to the light value and the change is incomplete).

**Step 2 — Add the cssVar() helper near the top of `ui/frame2d/script.js`.**

Insert after the existing `const canvas = document.getElementById('canvas');` (or wherever the canvas const lives near the top — around line 70-75), before the existing `const GRID = 20;` declaration:

```js
// ── CSS variable bridge ───────────────────────────────────────────────────
// Reads a CSS custom property from :root (light) or [data-theme="dark"] (dark).
// Used by every canvas-drawing function so colours follow the active theme.
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
```

**Step 3 — Replace every hardcoded canvas colour literal in script.js drawing functions.**

Walk every site in the audit list under `<interfaces>` and replace as documented. Examples:

- Line 801 (`drawGrid`):
  ```js
  ctx.strokeStyle = '#eee';
  ```
  →
  ```js
  ctx.strokeStyle = cssVar('--canvas-grid');
  ```

- Lines 835 + 840 (`drawMembers` colour selection):
  ```js
  let color = m.type === 'bar' ? '#555' : '#1a2744';
  let forceLabel = null;
  if (results && results.member_forces) {
    const f = results.member_forces[idx];
    color = Math.abs(f) < 1e-3 ? '#999' : (f > 0 ? '#1565c0' : '#b71c1c');
    forceLabel = (f / 1000).toFixed(2) + ' kN';
  }
  ```
  →
  ```js
  let color = m.type === 'bar' ? cssVar('--canvas-bar') : cssVar('--canvas-stroke');
  let forceLabel = null;
  if (results && results.member_forces) {
    const f = results.member_forces[idx];
    color = Math.abs(f) < 1e-3 ? cssVar('--canvas-zero')
          : (f > 0 ? cssVar('--canvas-tension') : cssVar('--canvas-compression'));
    forceLabel = (f / 1000).toFixed(2) + ' kN';
  }
  ```

- Line 938 (`drawDiagnosticOverlays`):
  ```js
  const RED = '#e53935';
  ```
  →
  ```js
  const RED = cssVar('--canvas-diagnostic');
  ```

- Line 1313 (`labelText` text-backing rect):
  ```js
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ```
  →
  ```js
  ctx.fillStyle = cssVar('--canvas-label-bg');
  ```

- Lines 1485, 1490, 1502 (`drawBMD` labelText calls):
  ```js
  labelText(fmtM(Mi), n1.x + perpX * off, n1.y + perpY * off, '#1565c0');
  ```
  →
  ```js
  labelText(fmtM(Mi), n1.x + perpX * off, n1.y + perpY * off, cssVar('--canvas-bmd'));
  ```

- Lines 1578, 1582, 1594 (`drawSFD` labelText calls):
  ```js
  labelText(fmtV(Vi), n1.x + perpX * off, n1.y + perpY * off, '#2e7d32');
  ```
  →
  ```js
  labelText(fmtV(Vi), n1.x + perpX * off, n1.y + perpY * off, cssVar('--canvas-sfd'));
  ```

- Line 1395 (`drawDeflected` δ label):
  ```js
  labelText('δ=' + (maxTransverse * 1000).toFixed(3) + ' mm', maxLX, maxLY - 12, '#e65100');
  ```
  →
  ```js
  labelText('δ=' + (maxTransverse * 1000).toFixed(3) + ' mm', maxLX, maxLY - 12, cssVar('--canvas-deflected-label'));
  ```

The executor must walk EVERY line in the audit table under `<interfaces>` and migrate it. After this step:
```bash
grep -nE "ctx\.(strokeStyle|fillStyle)\s*=\s*'#" ui/frame2d/script.js
```
returns ZERO lines.

**Step 4 — Things NOT to change in this commit:**
- No change to ANY drawing math (no geometry, no transform, no force calculations).
- No change to `index.html`.
- No change to label-suppression guards (Task 2 owns that).
- No change to font sizes / labelScale (Task 3 owns that).
- No change to dark-mode button background (Task 2 owns that).
- No change to setMode(), draw() ordering, view object, or any handler.

**Commit message (suggested):** `feat(quick-260504-lti): theme-aware canvas colour tokens via cssVar() in frame2d UI`
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const css = fs.readFileSync('ui/frame2d/style.css','utf8'); const requiredRoot = ['--canvas-stroke','--canvas-grid','--canvas-support','--canvas-load','--canvas-label','--canvas-bmd','--canvas-sfd','--canvas-tension','--canvas-compression','--canvas-zero']; const requiredDark = ['--canvas-stroke','--canvas-support','--canvas-load','--canvas-label','--canvas-bmd','--canvas-sfd','--canvas-tension','--canvas-compression','--canvas-zero']; const missingRoot = []; const rootMatch = css.match(/:root\s*\{[\s\S]*?\}/); const darkMatch = css.match(/\[data-theme=\"dark\"\]\s*\{[\s\S]*?\}/); if (!rootMatch || !darkMatch) { console.error('FAIL: :root or [data-theme=\"dark\"] block missing'); process.exit(1); } requiredRoot.forEach(t => { if (!rootMatch[0].includes(t)) missingRoot.push(t+' in :root'); }); requiredDark.forEach(t => { if (!darkMatch[0].includes(t)) missingRoot.push(t+' in [data-theme=\"dark\"]'); }); if (missingRoot.length) { console.error('FAIL: missing canvas tokens:'); missingRoot.forEach(m => console.error('  '+m)); process.exit(1); } const js = fs.readFileSync('ui/frame2d/script.js','utf8'); if (!/function\s+cssVar\s*\(/.test(js)) { console.error('FAIL: cssVar() helper missing in script.js'); process.exit(1); } const lines = js.split('\n'); const bad = []; lines.forEach((line, i) => { if (/ctx\.(strokeStyle|fillStyle)\s*=\s*'#/.test(line)) bad.push((i+1)+': '+line.trim()); }); if (bad.length) { console.error('FAIL: hardcoded canvas colour literals remain in script.js:'); bad.forEach(b => console.error('  '+b)); process.exit(1); } if (!/cssVar\('--canvas-/.test(js)) { console.error('FAIL: no cssVar(\\'--canvas-\\*\\') calls found — migration not applied'); process.exit(1); } console.log('PASS');"</automated>
  </verify>
  <done>
- `ui/frame2d/style.css` `:root` block contains at minimum these 10 tokens: `--canvas-stroke`, `--canvas-grid`, `--canvas-support`, `--canvas-load`, `--canvas-label`, `--canvas-bmd`, `--canvas-sfd`, `--canvas-tension`, `--canvas-compression`, `--canvas-zero`.
- `[data-theme="dark"]` block overrides each of those tokens with a dark-theme value.
- `ui/frame2d/script.js` defines `function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }`.
- `grep -nE "ctx\.(strokeStyle|fillStyle)\s*=\s*'#" ui/frame2d/script.js` returns ZERO lines.
- At least one `cssVar('--canvas-...')` call exists in script.js (sanity check the migration was applied, not just removed).
- No change to drawing math / layout / index.html.
- Atomic commit landed.
  </done>
</task>

<task type="auto">
  <name>Task 2 (Commit 2): Lighter buttons in dark mode + zero-value member-force label suppression</name>
  <files>ui/frame2d/style.css, ui/frame2d/script.js</files>
  <action>
**Goal:** two small surgical fixes in one commit:
- (1.1) Bump dark-mode button background lighter for better contrast against the dark page bg.
- (#2) Wrap the member-force label drawing so members with `Math.abs(f) < 1e-3` don't show a "0.00 kN" label (the threshold already gates the line colour — now also gates the LABEL).

**Step 1 — Adjust dark-mode button-background tokens in `ui/frame2d/style.css`.**

In the existing `[data-theme="dark"]` block (around lines 311-341, post-Task 1 it's longer), bump the values that drive `.tool-btn` background and `.panel-section h3` text colour. The simplest tweak:

```css
[data-theme="dark"] {
  /* ... existing j8m + Task 1 dark overrides ... */
  --color-surface-alt: #2c333d;   /* was #232932 — lighter for tool-btn bg */
  --color-fg-faint: #8a9099;      /* was #6f747c — lifted for section-header h3 legibility */
  /* (canvas-* overrides from Task 1 unchanged) */
}
```

Concretely: locate the existing `--color-surface-alt: #232932;` and `--color-fg-faint: #6f747c;` lines INSIDE the `[data-theme="dark"]` block and replace their values with `#2c333d` and `#8a9099` respectively. Do NOT add new tokens — these tokens already exist in `:root` (light) and are already overridden in dark; this commit just re-tunes the dark values.

If on visual inspection these values are still too dark or too bright, the executor MAY adjust by ±0x10 in either direction (e.g. `#323942` for button bg) — but each pair of changes goes in a single edit. Do not iterate; UAT in Task 4 is the final visual judge.

**Step 2 — Wrap the member-force label drawing in `ui/frame2d/script.js`.**

Locate the `drawMembers()` function. Lines 838-842 are the colour-selection block:

```js
if (results && results.member_forces) {
  const f = results.member_forces[idx];
  color = Math.abs(f) < 1e-3 ? cssVar('--canvas-zero')
        : (f > 0 ? cssVar('--canvas-tension') : cssVar('--canvas-compression'));
  forceLabel = (f / 1000).toFixed(2) + ' kN';
}
```

The bug: `forceLabel` is assigned unconditionally even when `Math.abs(f) < 1e-3`. Fix at the source by setting `forceLabel = null` for zero-force members:

```js
if (results && results.member_forces) {
  const f = results.member_forces[idx];
  const isZero = Math.abs(f) < 1e-3;
  color = isZero ? cssVar('--canvas-zero')
        : (f > 0 ? cssVar('--canvas-tension') : cssVar('--canvas-compression'));
  forceLabel = isZero ? null : (f / 1000).toFixed(2) + ' kN';
}
```

Then DOWNSTREAM in drawMembers (search for `forceLabel` references — typically a single labelText or fillText call further down in the same function), confirm the call site is already guarded with `if (forceLabel) { ... }`. If not, wrap it:

```js
if (forceLabel) {
  // existing labelText / fillText code that prints forceLabel
}
```

The threshold `1e-3` matches the existing colour-gating threshold on line 840 — keep them in sync. The user's verbatim spec was: "wrap the label-drawing block with `if (Math.abs(f) > 1e-3) { ... }`". The above achieves the same semantically (null label → no draw) and is more idiomatic.

If the downstream call uses `if (forceLabel)`, the verifier needs to find an `Math.abs(...) > 1e-3` OR an `Math.abs(...) < 1e-3` guard. Both forms are acceptable. The verifier checks for either pattern in drawMembers' body.

**Step 3 — Confirm shears and moments are NOT in scope.**

Per the user's followup spec, the BMD/SFD numeric labels are ALREADY gated behind `chkDiagLabels.checked` (j8m, Commit 4). Default is OFF. So zero-shear / zero-moment labels never leak through unless the user explicitly ticks "Show diagram values". No additional guard needed for shears/moments. (If during execution the executor finds zero-value labels still leaking from drawBMD/drawSFD when chkDiagLabels IS ticked, the existing `Math.abs(Mi) > maxMoment * 0.01` and `Math.abs(Vi) > maxShear * 0.01` thresholds at lines 1483, 1488, 1499, 1576, 1580 are doing that job. Out of scope of this commit.)

**Step 4 — Things NOT to change in this commit:**
- No change to canvas colour token migration (Task 1 owns that — it must be in place before this commit; if Task 1's migration is incomplete, fail the verifier).
- No change to font sizes (Task 3).
- No change to `index.html`.
- No change to drawing math.
- No new tokens in style.css — only re-tune two existing dark-theme values.
- No change to `chkDiagLabels` or any other checkbox state/default.

**Commit message:** `style(quick-260504-lti): lighter dark-mode buttons + suppress zero-value member-force labels in frame2d UI`
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const css = fs.readFileSync('ui/frame2d/style.css','utf8'); const darkMatch = css.match(/\[data-theme=\"dark\"\]\s*\{([\s\S]*?)\}/); if (!darkMatch) { console.error('FAIL: [data-theme=\"dark\"] block missing'); process.exit(1); } const darkBody = darkMatch[1]; if (!/--color-surface-alt:\s*#[0-9a-fA-F]{3,8}/.test(darkBody)) { console.error('FAIL: --color-surface-alt override missing in dark block'); process.exit(1); } const oldVal = darkBody.match(/--color-surface-alt:\s*(#[0-9a-fA-F]{3,8})/); if (oldVal && oldVal[1].toLowerCase() === '#232932') { console.error('FAIL: --color-surface-alt still at j8m value #232932 — was not bumped'); process.exit(1); } const js = fs.readFileSync('ui/frame2d/script.js','utf8'); const drawMembersIdx = js.indexOf('function drawMembers()'); if (drawMembersIdx < 0) { console.error('FAIL: drawMembers not found'); process.exit(1); } const nextFn = js.indexOf('\nfunction ', drawMembersIdx + 10); const body = js.slice(drawMembersIdx, nextFn > 0 ? nextFn : drawMembersIdx + 4000); /* Strict: must detect NEW conditional that nulls forceLabel for zero-force members. Two acceptable shapes: */ /* Shape A: const isZero = Math.abs(...) < 1e-3; ... forceLabel = isZero ? null : ... */ const shapeA_isZero  = /\bconst\s+isZero\s*=\s*Math\.abs\([^)]+\)\s*<\s*1e-3/.test(body); const shapeA_assign  = /forceLabel\s*=\s*isZero\s*\?\s*null\s*:/.test(body); /* Shape B: forceLabel = Math.abs(...) < 1e-3 ? null : ... (inline ternary on the assignment itself) */ const shapeB_inline  = /forceLabel\s*=\s*[^;]*Math\.abs\([^)]+\)\s*<\s*1e-3\s*\?\s*null\s*:/.test(body); const shapeAOK = shapeA_isZero && shapeA_assign; if (!shapeAOK && !shapeB_inline) { console.error('FAIL: drawMembers does not contain a NEW guard that nulls forceLabel for zero-force members.'); console.error('  Need either: (a) `const isZero = Math.abs(...) < 1e-3;` AND `forceLabel = isZero ? null : ...`'); console.error('  OR        : (b) inline `forceLabel = ... Math.abs(...) < 1e-3 ? null : ...`'); console.error('  The pre-existing `let forceLabel = null;` declaration alone does NOT satisfy this — the executor must add a conditional assignment that produces null when |f| < 1e-3.'); process.exit(1); } console.log('PASS');"</automated>
  </verify>
  <done>
- `[data-theme="dark"]` block in `ui/frame2d/style.css` has `--color-surface-alt` value bumped LIGHTER than the j8m baseline (`#232932`) — verifier asserts the value is no longer `#232932`.
- `drawMembers()` body in `ui/frame2d/script.js` contains the `Math.abs(f) < 1e-3` (or `> 1e-3`) guard alongside the colour selection.
- The `forceLabel` is set to `null` (or its draw call is wrapped with `if (forceLabel)`) when the member force is zero — no "0.00 kN" labels rendered for zero-force members.
- No change to drawing math, no new style.css tokens, no new HTML elements.
- Atomic commit landed.
  </done>
</task>

<task type="auto">
  <name>Task 3 (Commit 3): Smaller default label font (10px) + label-size slider</name>
  <files>ui/frame2d/style.css, ui/frame2d/index.html, ui/frame2d/script.js</files>
  <action>
**Goal:** drop the default canvas label font to ~10px (down from j8m's mix of 10-12 px) AND add a live `inputLabelScale` slider in the Display panel that multiplies all canvas font sizes 0.5 → 2.0. Every `ctx.font = '...'` literal in script.js becomes a scaled-token-derived string.

**Step 1 — Confirm `--canvas-label-size` token exists in style.css `:root`.**

Task 1 added `--canvas-label-size: 10px;` to the `:root` block. If it's not there (Task 1 was incomplete), add it now; otherwise this is a no-op for Task 3. Note: this token is documentation — JS reads `BASE_LABEL_SIZE = 10` directly (parsing CSS strings is brittle). The token's value MUST match `BASE_LABEL_SIZE`. If the executor wants to drive size FROM the CSS token, that's allowed but more complex; default approach is the JS constant + CSS token-as-doc.

**Step 2 — Add the `inputLabelScale` slider to `ui/frame2d/index.html` Display panel.**

Locate the Display panel-section (lines 140-176 post-j8m). Find the existing `inputSymbolScale` `<label>` block (line 167-169):

```html
<label class="panel-label">Symbol size &times;
  <input type="number" id="inputSymbolScale" value="1.0" min="0.5" max="2.0" step="0.1">
</label>
```

Insert immediately after that block, before the themeToggle button (~line 170):

```html
<label class="panel-label">Label size &times;
  <input type="range" id="inputLabelScale" min="0.5" max="2.0" step="0.1" value="1.0">
</label>
```

NB: the existing `inputSymbolScale` is `type="number"`, but the user spec asks for a draggable slider — use `type="range"` here. Both controls live in the panel under the existing `.panel-label` styling; range inputs render as native sliders in all browsers and inherit the panel-label spacing fine.

**Step 3 — Add JS state for label-size scaling in `ui/frame2d/script.js`.**

Near the top of the file (alongside `const GRID = 20; const UNIT = 1;` at lines 76-77), add three new declarations:

```js
const BASE_LABEL_SIZE = 10;       // matches --canvas-label-size in style.css
const LABEL_FONT_FAMILY = 'Inter, system-ui, sans-serif';
let labelScale = 1.0;             // 0.5 → 2.0, driven by #inputLabelScale slider
```

Place them BEFORE `let _lastBlobUrl = null;` (line 79) so they're available to the drawing functions.

**Step 4 — Wire the `inputLabelScale` listener.**

In the existing event-listener block (script.js ~lines 1600-1616), add immediately after line 1616 (`document.getElementById('inputSymbolScale').addEventListener('input', draw);`):

```js
document.getElementById('inputLabelScale').addEventListener('input', function (e) {
  labelScale = parseFloat(e.target.value) || 1.0;
  draw();
});
```

**Step 5 — Replace every `ctx.font = '...'` literal in script.js with the scaled form.**

Audit list — 10 sites:

| Line | Old | New |
|---|---|---|
| 883 | `ctx.font = '10px Arial';` | `ctx.font = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale()) + 'px ' + LABEL_FONT_FAMILY;` |
| 914 | `ctx.font = 'bold 11px Arial';` | `ctx.font = 'bold ' + Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() + 1) + 'px ' + LABEL_FONT_FAMILY;` (preserves slight node-id-label boost) |
| 1119 | `ctx.font = '9px Arial';` | `ctx.font = Math.round(BASE_LABEL_SIZE * 0.9 * labelScale * getSymbolScale()) + 'px ' + LABEL_FONT_FAMILY;` (small spring K-value annotation, slightly smaller) |
| 1158 | `ctx.font = '10px Arial';` | same pattern as line 883 |
| 1167 | same | same |
| 1189 | same | same |
| 1198 | `ctx.font = '600 11px Arial';` | `ctx.font = '600 ' + Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale() + 1) + 'px ' + LABEL_FONT_FAMILY;` (preserves font-weight 600 + slight boost) |
| 1249 | `ctx.font = 'bold 10px Arial';` | `ctx.font = 'bold ' + Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale()) + 'px ' + LABEL_FONT_FAMILY;` |
| 1298 | same pattern | same |
| 1308 | `ctx.font = ` `bold ${fs}px sans-serif`;` (in labelText helper, where `fs = Math.round(10 * getSymbolScale())`) | Refactor: change `const fs = Math.round(10 * getSymbolScale());` to `const fs = Math.round(BASE_LABEL_SIZE * labelScale * getSymbolScale());` and `ctx.font = `bold ${fs}px ${LABEL_FONT_FAMILY}`;` |

Helper to extract a common pattern: the executor MAY add a small helper at the top of script.js to avoid repeating the formula, e.g.:

```js
function labelFont(opts = {}) {
  const { bold = false, weight = '', sizeMul = 1 } = opts;
  const fs = Math.round(BASE_LABEL_SIZE * sizeMul * labelScale * getSymbolScale());
  const prefix = bold ? 'bold ' : (weight ? weight + ' ' : '');
  return prefix + fs + 'px ' + LABEL_FONT_FAMILY;
}
```

Then `ctx.font = labelFont();` for default, `ctx.font = labelFont({bold: true});` for bold, `ctx.font = labelFont({weight: '600', sizeMul: 1.1});` for 600/larger. This is RECOMMENDED but optional — inline composition is also fine.

The verifier asserts that:
- `labelScale` is referenced from script.js
- `inputLabelScale` is referenced from script.js (the listener exists)
- Every `ctx.font` line uses a non-literal computation involving `labelScale` (not just a hardcoded `'10px'` / `'11px'` / `'12px'` literal). Acceptable patterns: `... labelScale ...`, calls to a helper that uses labelScale, template strings with `${...}` containing labelScale.

**Step 6 — Things NOT to change:**
- No change to canvas colour migration (Task 1) or label-suppression guards (Task 2) — both must be in place.
- No change to drawing math.
- No change to other Display-panel controls (chkBMD, chkSFD, chkDiagLabels, inputDiagramScale, inputSymbolScale).
- Symbol size (`getSymbolScale()`) and label scale (`labelScale`) are SEPARATE multipliers — both factor into final font size. This preserves the existing "symbol size also scales labels" behaviour from j8m while adding orthogonal label-only control.

**Commit message:** `feat(quick-260504-lti): add label-size slider + 10px default canvas label font`
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const css = fs.readFileSync('ui/frame2d/style.css','utf8'); if (!/--canvas-label-size\s*:/.test(css)) { console.error('FAIL: --canvas-label-size token missing in style.css'); process.exit(1); } const html = fs.readFileSync('ui/frame2d/index.html','utf8'); if (!/<input[^>]*type=\"range\"[^>]*id=\"inputLabelScale\"/.test(html) && !/<input[^>]*id=\"inputLabelScale\"[^>]*type=\"range\"/.test(html)) { console.error('FAIL: inputLabelScale range input missing in index.html'); process.exit(1); } if (!/min=\"0\\.5\"/.test(html) || !/max=\"2\\.0\"/.test(html)) { console.error('FAIL: inputLabelScale range bounds (0.5..2.0) missing'); process.exit(1); } const js = fs.readFileSync('ui/frame2d/script.js','utf8'); if (!/let\s+labelScale\s*=/.test(js) && !/var\s+labelScale\s*=/.test(js)) { console.error('FAIL: labelScale variable not declared in script.js'); process.exit(1); } if (!/inputLabelScale/.test(js)) { console.error('FAIL: inputLabelScale not referenced in script.js (listener missing)'); process.exit(1); } if (!/getElementById\\(['\"]inputLabelScale['\"]\\)\\.addEventListener/.test(js)) { console.error('FAIL: inputLabelScale change/input listener missing'); process.exit(1); } const fontLines = js.split('\n').map((l,i) => ({l,i:i+1})).filter(({l}) => /ctx\\.font\\s*=/.test(l)); if (fontLines.length === 0) { console.error('FAIL: no ctx.font lines found'); process.exit(1); } const literalOnly = fontLines.filter(({l}) => /ctx\\.font\\s*=\\s*['\\\"`][^'\\\"`]*\\d+px[^'\\\"`]*['\\\"`]/.test(l)); if (literalOnly.length > 0) { console.error('FAIL: '+literalOnly.length+' ctx.font lines still use string literals (no labelScale scaling):'); literalOnly.forEach(({l,i}) => console.error('  line '+i+': '+l.trim())); process.exit(1); } console.log('PASS ('+fontLines.length+' ctx.font sites scaled)');"</automated>
  </verify>
  <done>
- `--canvas-label-size: 10px` token exists in `ui/frame2d/style.css` `:root` block.
- `<input type="range" id="inputLabelScale" min="0.5" max="2.0" step="0.1" value="1.0">` exists in `ui/frame2d/index.html` Display panel.
- `let labelScale = 1.0;` declared in `ui/frame2d/script.js` near the top.
- `addEventListener('input', ...)` for `inputLabelScale` registered alongside the other Display-panel control listeners.
- Every `ctx.font = ...` assignment in script.js uses a non-literal expression involving `labelScale` (either inline computation, template string with `${...}`, or a helper-function call).
- No `ctx.font = '10px ...'` / `'11px ...'` / `'12px ...'` literals remain (verifier checks: the line must NOT match a static-string-literal-only ending pattern).
- No change to drawing math or any other panel control.
- Atomic commit landed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Manual UAT in browser (after all 3 commits)</name>
  <files>none — this is a manual browser UAT checkpoint, no files modified by this task</files>
  <action>Run the manual UAT script under <how-to-verify> in a browser. The 3 preceding auto commits made the actual code changes; this task only validates them visually + functionally. No code is written by this task.</action>
  <verify>Manual browser UAT: every step under <how-to-verify> passes (theme-aware canvas legibility in dark, lighter tool buttons in dark, no zero-kN labels on zero-force members, smaller default labels, live label-size slider, cantilever regression numbers, save/load round-trip, mode-string + hit-test invariants).</verify>
  <done>User types "approved" — or describes any divergence so an additional commit / revert can be made.</done>
  <what-built>
- 3 atomic commits on `main`, each independently revertable:
  1. Theme-aware canvas colour tokens via `cssVar()` helper — every `ctx.strokeStyle`/`ctx.fillStyle` literal in canvas-drawing functions migrated to `cssVar('--canvas-*')` calls; ≥10 canvas-* tokens defined in BOTH `:root` and `[data-theme="dark"]`.
  2. Lighter `.tool-btn` background in dark mode (`--color-surface-alt` bumped from `#232932`) + zero-value member-force label suppression (`forceLabel = null` when `Math.abs(f) < 1e-3` in drawMembers).
  3. `--canvas-label-size: 10px` token + `inputLabelScale` range slider (0.5 → 2.0) in Display panel + every `ctx.font` in script.js multiplied by `labelScale` (and `getSymbolScale()`).
- Modified files: `ui/frame2d/style.css`, `ui/frame2d/index.html`, `ui/frame2d/script.js`
- Untouched: `solver_core/`, `api_server/`, `tests/`, `ui/truss2d/`, `ui/fonts/`, save/load JSON format, mode-string identifiers, hit-test math, keyboard shortcuts, setMode() behaviour.
  </what-built>
  <how-to-verify>
1. **Start the API server (if not already running):** `uvicorn api_server.app:app --reload` from `pda_project/`.
2. **Open the frame2d UI:** browse to `http://127.0.0.1:8000/ui/frame2d/index.html` (or the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`).
3. **Theme toggle — dark-mode canvas content visibility (commit 1, the load-bearing fix):**
   - Click the ☀/☾ toggle to enter dark mode.
   - Build a small structure: 2 nodes 5 m apart (Add Node × 2), connect with a member, fix one end (Fixed support), apply a downward 10 kN load to the free end (Force Y = -10).
   - Confirm: nodes (red dots), member (light navy or whichever `--canvas-stroke` resolves to in dark), support glyph (legible against dark canvas — not invisible navy), load arrow (green, visible).
   - Click ▶ SOLVE.
   - Confirm: member colour switches to compression red (`--canvas-compression`) for the cantilever, force label is legible.
   - Tick "Show bending moment diagram" + "Show shear force diagram" + "Show diagram values".
   - Confirm: BMD polygon (blue, semi-transparent fill, legible outline), SFD polygon (green, legible), labels readable on dark canvas.
   - Tick "Show deflected shape".
   - Confirm: orange dashed deflected outline visible against dark canvas.
   - Toggle back to light mode — confirm everything still looks identical to the j8m baseline (no light-mode regression).
4. **Toolbar button contrast in dark mode (commit 2 — fix #1.1):**
   - In dark mode, hover over each right-rail tool button (Reset View, GEOMETRY/SUPPORTS/NODE LOADS/MEMBER LOADS/MEMBER PROPERTIES/EDIT/FILE).
   - Confirm each button is visibly LIGHTER than the page background (no longer feels too dark / blends in). Subjective — but should feel improved compared to the j8m dark-mode baseline.
5. **Zero-value member-force label suppression (commit 2 — fix #2):**
   - Reset (🔄). Build a 3-node simple beam under UDL: nodes at 0,0 / 5,0 / 10,0; two members; pin at left, roller (vertical) at right; UDL = -5 kN/m on each member; NO horizontal node loads (so axial force is ~0).
   - Click ▶ SOLVE.
   - Confirm: BOTH members render in the zero-force grey colour (`--canvas-zero`). NO "0.00 kN" labels appear next to either member. (Pre-fix behaviour: "0.00 kN" labels would render for both.)
   - Member-actions table at the bottom should show axial ≈ 0, shear and moment populated normally.
6. **Default label font is smaller (commit 3 — fix #3a):**
   - With the simple beam still solved, tick "Show bending moment diagram" + "Show diagram values".
   - Compare label size to your memory of the j8m baseline (or to a screenshot if available). Labels should feel noticeably smaller / cleaner — ~10 px default.
7. **`inputLabelScale` slider live behaviour (commit 3 — fix #3b):**
   - Locate the new "Label size ×" range slider in the Display panel (between "Symbol size ×" and the theme toggle).
   - Drag from default 1.0 up to 2.0 — every label (member force, BMD/SFD numeric annotations, node IDs, support K-values, load magnitudes) grows live.
   - Drag down to 0.5 — labels shrink live.
   - At every position, the rest of the canvas (members, polygons, nodes, support glyphs) is unaffected.
   - Reset slider to 1.0 — labels return to the new ~10 px default.
8. **Cantilever regression solve (no math broken — sanity check across all 3 commits):**
   - Reset. Build cantilever: 2 nodes 5 m apart, member, FIXED at left, Force Y = -10 kN at right node.
   - Click ▶ SOLVE.
   - Confirm: M_i ≈ 50 kNm at fixed end (negative = sagging at fixed end of downward-loaded cantilever per CLAUDE.md frame conventions), V_i ≈ 10 kN, Reaction Y ≈ 10 kN. Numbers should match the j8m UAT baseline exactly.
9. **Save/load JSON round-trip regression:**
   - With the cantilever solved, click 💾 Save JSON — file downloads.
   - 🔄 Reset All.
   - Click 📂 Load JSON, pick the saved file.
   - Cantilever reappears intact (nodes, member, support, load).
   - ▶ SOLVE → same results as step 8.
10. **Mode-string and hit-test invariant check:**
    - Click each tool button in turn (Add Node, Add Member, Fixed, Pin, RollerX, RollerY, Spring, Force X, Force Y, Moment, UDL, Beam/Bar, Pin-Left, Pin-Right, Per-Member EIA, Edit Node, Undo, Delete, Reset All, Save, Load).
    - Confirm: mode-indicator label updates correctly each click. Click a node → it gets selected (Edit Node mode) / a support gets placed (Fixed/Pin/Roller modes). Hit-detection still works exactly as before.
11. **Theme persistence across reload (j8m regression — must still hold):**
    - In dark mode, reload the page.
    - Confirm: theme persists as dark.
    - Toggle to light, reload. Confirm: persists as light.

**If any step diverges, describe what diverged.** Otherwise type "approved".

**Rollback note:** each of the 3 commits is independently revertable. `git revert <hash>` of just the broken commit and the others stay landed.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Task 1 node script proves: ≥10 canvas-* tokens in BOTH :root and [data-theme="dark"], cssVar() helper exists, zero `ctx.(strokeStyle|fillStyle) = '#...'` literals remain in script.js, at least one `cssVar('--canvas-...')` call references the migration.
- Task 2 node script proves: dark `--color-surface-alt` value bumped from j8m baseline (`#232932`), drawMembers body contains `Math.abs(...) [<>] 1e-3` guard AND either `forceLabel = null` or `if (forceLabel)` wrapping.
- Task 3 node script proves: `--canvas-label-size` token in style.css, `inputLabelScale` range input in HTML with min=0.5/max=2.0, `labelScale` variable + listener in script.js, every `ctx.font` line uses a non-literal computation (no `'10px Arial'`-style static literals remain).
- Task 4 manual UAT is the load-bearing functional verification: vanilla JS / no automated browser tests in this repo by design.
- pytest 61/61 green is implicit (no Python source touched). Sanity: `pytest tests/ -q` should still pass.
</verification>

<success_criteria>
- In dark mode, every canvas-drawn element is visibly contrasted against the dark canvas background — no near-invisible navy / ~black-on-dark elements.
- Right-rail tool buttons in dark mode have visibly better contrast than the j8m baseline.
- Zero "0.00 kN" labels appear on members with axial force < 1e-3 (including in beams under pure transverse load).
- Default canvas label font is ~10 px (down from j8m's mix); feels less obtrusive.
- A draggable label-size slider (`inputLabelScale`, 0.5 → 2.0) sits in the Display panel and resizes all canvas labels live.
- All three commits land atomically and are independently revertable.
- Zero behaviour change in: mode-string identifiers, save/load JSON format, hit-test math, solver/API contracts, drawing math, panel positions, keyboard shortcuts, setMode() behaviour.
- No changes outside `ui/frame2d/`.
- Manual UAT (Task 4) confirms dark-mode canvas legibility, button contrast, zero-label suppression, smaller default labels, live label-zoom slider, cantilever regression numbers, save/load round-trip, mode-string invariant.
</success_criteria>

<output>
After completion, create `.planning/quick/260504-lti-frame2d-ui-followup-1-dark-mode-canvas-c/260504-lti-SUMMARY.md` per the standard template, recording the three commit hashes, exact dark-mode hex tunings (so the user can see the values applied), the audit-line count migrated in Task 1, and any deviations from the plan (e.g. extra tokens defined beyond the minimum 10, helper function added in Task 3, etc.).
</output>
