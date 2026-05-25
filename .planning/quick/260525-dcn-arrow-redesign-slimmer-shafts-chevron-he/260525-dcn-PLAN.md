---
phase: 260525-dcn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/truss2d/script.js
  - ui/frame2d/script.js
autonomous: false

must_haves:
  truths:
    - "Force arrows (load and reaction) have open chevron arrowheads — a V shape, not a filled triangle"
    - "Arrow shafts are 1.5px wide with round line caps"
    - "Reaction labels sit at the shaft midpoint with a background pill, not at the arrow tail"
    - "Load labels remain at the arrow tail (unchanged positioning)"
    - "Moment arcs in frame2d are unchanged — keep existing V-style arrowhead"
    - "forceLeaderLine hack for horizontal reactions is removed"
  artifacts:
    - path: "ui/truss2d/script.js"
      provides: "Rewritten drawForceArrow with open chevron + reaction label on shaft"
      contains: "lineCap"
    - path: "ui/frame2d/script.js"
      provides: "Rewritten drawForceArrow with open chevron + reaction label on shaft"
      contains: "lineCap"
  key_links:
    - from: "drawForceArrow"
      to: "LabelManager.add"
      via: "bgColor property for reaction labels"
      pattern: "bgColor.*reaction"
---

<objective>
Modernise force arrow visuals in both truss2d and frame2d UIs: replace filled triangle arrowheads with open chevron tips, slim down shaft width to 1.5px, and fix the horizontal reaction label problem by placing reaction labels directly on the arrow shaft with a background pill.

Purpose: Cleaner, more modern arrow aesthetic and permanently fix the horizontal reaction label confusion where labels float detached from their arrow.
Output: Updated drawForceArrow in both ui/truss2d/script.js and ui/frame2d/script.js.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260525-dcn-arrow-redesign-slimmer-shafts-chevron-he/260525-dcn-CONTEXT.md

<interfaces>
<!-- LabelManager.add() spec — both UIs use the same shared label-manager.js -->
<!-- Key fields for this task: bgColor, bgPadding, forceLeaderLine -->

From ui/label-manager.js:
```javascript
// add() accepts: text, anchorX, anchorY, preferredX, preferredY, priority,
//   color, font, fontSize, haloColor, haloWidth, bgColor, bgPadding,
//   rotation, textAlign, textBaseline, radius, type

// bgColor: if set, draws a filled rect behind the label text (used by member force labels)
// bgPadding: padding around bgColor rect (default 2)
// forceLeaderLine: if truthy, always draws a leader line from anchor to label
// leaderLine in _finalize: leaderLine || !!label.forceLeaderLine
```

From ui/truss2d/script.js (current drawForceArrow, line 745):
```javascript
function drawForceArrow(node, axis, forceValue, color, label, labelManager, isReaction)
// Colours: loads '#2e7d32', reactions '#7b1fa2'
```

From ui/frame2d/script.js (current drawForceArrow, line 1455):
```javascript
function drawForceArrow(node, axis, forceValue, color, labelColor, label, labelManager, isDark, isReaction)
// Colours: loads cssVar('--canvas-load'), reactions cssVar('--canvas-reaction')
// Label bg: cssVar('--canvas-label-bg')
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite truss2d drawForceArrow — open chevron + reaction labels on shaft</name>
  <files>ui/truss2d/script.js</files>
  <action>
Rewrite the `drawForceArrow` function (line 745) in `ui/truss2d/script.js`. The function signature stays the same: `drawForceArrow(node, axis, forceValue, color, label, labelManager, isReaction)`.

**Arrow geometry changes:**

1. **Shaft:** Change `ctx.lineWidth` from `2` to `1.5`. Add `ctx.lineCap = 'round'`. The shaft now runs from `tailX,tailY` to `apexX,apexY` (the full length, not stopping at the head base). The existing `arrowLen`, `apexGap`, `apexX/Y`, `tailX/Y`, `dirX/dirY`, `perpX/perpY` computations stay the same.

2. **Arrowhead:** Replace the filled triangle (`ctx.fill()` + `closePath`) with an open chevron stroke:
   ```javascript
   // Open chevron at apex — V-shape, no fill
   const chevronDepth = 5 * sc;   // reuse existing headDepth value
   const chevronHW    = 4 * sc;   // slightly narrower than old arrowHW for ~30deg spread
   const chevBaseX = apexX - chevronDepth * dirX;
   const chevBaseY = apexY - chevronDepth * dirY;
   ctx.beginPath();
   ctx.lineJoin = 'round';
   ctx.lineCap  = 'round';
   ctx.moveTo(chevBaseX + perpX * chevronHW, chevBaseY + perpY * chevronHW);
   ctx.lineTo(apexX, apexY);
   ctx.lineTo(chevBaseX - perpX * chevronHW, chevBaseY - perpY * chevronHW);
   ctx.stroke();   // stroke only, no closePath, no fill
   ```
   Remove the old `ctx.fillStyle = color` (not needed since we only stroke). Keep `ctx.strokeStyle = color`.

3. **Label positioning — branched on `isReaction`:**

   For **reaction arrows** (`isReaction === true`):
   - Position label at the shaft midpoint: `midX = (tailX + apexX) / 2`, `midY = (tailY + apexY) / 2`
   - Use `bgColor: 'rgba(255, 255, 255, 0.85)'` and `bgPadding: 2` for the background pill
   - Set `preferredX: midX, preferredY: midY`
   - Remove `forceLeaderLine` from the spec entirely (no longer needed)

   For **load arrows** (`isReaction === false`):
   - Keep the existing tail-based label position: `labelX = tailX - dirX * labelGap - perpX * labelGap`, `labelY = tailY - dirY * labelGap - perpY * labelGap`
   - Keep existing haloColor, no bgColor
   - No `forceLeaderLine`

The old `headDepth` and `arrowHW` variables used for the filled triangle can be removed or repurposed. The `baseX/baseY` computation (old triangle base) is no longer needed for the shaft (shaft goes to apex), but the chevron uses its own base calculation.

Do NOT change `drawMomentArc`, `drawLoads`, `drawReactions`, or any other function.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && grep -c "ctx.fill()" ui/truss2d/script.js | grep -v "^0$" && echo "STILL HAS FILL" || echo "OK: no fill in drawForceArrow"; grep "lineCap.*round" ui/truss2d/script.js && echo "OK: round lineCap found"; grep "forceLeaderLine" ui/truss2d/script.js && echo "FAIL: forceLeaderLine still present" || echo "OK: forceLeaderLine removed"; grep "bgColor" ui/truss2d/script.js | grep -q "reaction\|isReaction\|midX\|midY" || grep -c "bgColor" ui/truss2d/script.js</automated>
  </verify>
  <done>
    - drawForceArrow draws open chevron (stroke-only V) instead of filled triangle
    - Shaft width is 1.5 with round lineCap
    - Reaction labels positioned at shaft midpoint with white background pill
    - Load labels remain at tail with halo (unchanged behaviour)
    - forceLeaderLine property completely removed from the spec
    - No other functions modified
  </done>
</task>

<task type="auto">
  <name>Task 2: Rewrite frame2d drawForceArrow — open chevron + reaction labels on shaft</name>
  <files>ui/frame2d/script.js</files>
  <action>
Rewrite the `drawForceArrow` function (line 1455) in `ui/frame2d/script.js`. The function signature stays the same: `drawForceArrow(node, axis, forceValue, color, labelColor, label, labelManager, isDark, isReaction)`.

Apply the same structural changes as Task 1, adapted for frame2d's theme-aware patterns:

**Arrow geometry changes (identical to Task 1):**

1. **Shaft:** `ctx.lineWidth = 1.5`, `ctx.lineCap = 'round'`. Shaft runs tail-to-apex.

2. **Arrowhead:** Open chevron stroke (same geometry as Task 1):
   ```javascript
   const chevronDepth = 5 * sc;
   const chevronHW    = 4 * sc;
   const chevBaseX = apexX - chevronDepth * dirX;
   const chevBaseY = apexY - chevronDepth * dirY;
   ctx.beginPath();
   ctx.lineJoin = 'round';
   ctx.lineCap  = 'round';
   ctx.moveTo(chevBaseX + perpX * chevronHW, chevBaseY + perpY * chevronHW);
   ctx.lineTo(apexX, apexY);
   ctx.lineTo(chevBaseX - perpX * chevronHW, chevBaseY - perpY * chevronHW);
   ctx.stroke();
   ```
   Remove `ctx.fillStyle = color` (only stroke needed). Keep `ctx.strokeStyle = color`.

3. **Label positioning — branched on `isReaction`:**

   For **reaction arrows** (`isReaction === true`):
   - Position at shaft midpoint: `midX = (tailX + apexX) / 2`, `midY = (tailY + apexY) / 2`
   - Use `bgColor: cssVar('--canvas-label-bg')` and `bgPadding: 2`
   - Use `preferredX: midX, preferredY: midY`
   - Use `color: labelColor` (frame2d has separate label colour)
   - Use `font: '600 ' + fs + 'px ' + LABEL_FONT_FAMILY` (existing pattern)
   - Use `haloColor: isDark ? 'rgba(22, 26, 32, 1)' : 'rgba(255, 255, 255, 1)'` (existing pattern)

   For **load arrows** (`isReaction === false`):
   - Keep existing tail-based label position: `labelX = tailX - dirX * labelGap`, `labelY = tailY - dirY * labelGap`
   - Keep existing haloColor pattern, no bgColor

Do NOT change `drawMomentArc`, `drawNodeLoads`, `drawReactions`, or any other function. The moment arc already has a clean V-style arrowhead and should remain unchanged.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && grep -c "ctx.fill()" ui/frame2d/script.js; grep "lineCap.*round" ui/frame2d/script.js && echo "OK: round lineCap found"; grep "forceLeaderLine" ui/frame2d/script.js && echo "FAIL: forceLeaderLine still present" || echo "OK: no forceLeaderLine"; grep "canvas-label-bg" ui/frame2d/script.js | head -5</automated>
  </verify>
  <done>
    - drawForceArrow draws open chevron (stroke-only V) instead of filled triangle
    - Shaft width is 1.5 with round lineCap
    - Reaction labels positioned at shaft midpoint with theme-aware background pill (cssVar --canvas-label-bg)
    - Load labels remain at tail (unchanged behaviour)
    - Moment arcs completely untouched
    - No other functions modified
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Browser UAT — verify arrow visuals in both UIs</name>
  <files>ui/truss2d/script.js, ui/frame2d/script.js</files>
  <action>
User visually verifies the open chevron arrowheads and reaction label placement in both UIs.
  </action>
  <what-built>Open chevron arrowheads and reaction labels on shaft in both truss2d and frame2d UIs</what-built>
  <how-to-verify>
    1. Open truss2d UI (http://localhost:8000/ui/truss2d/index.html or load a saved model)
    2. Add nodes, members, supports, and loads — verify load arrows have open V-shaped tips (not filled triangles) and slim shafts
    3. Solve the structure — verify reaction arrows also have open V-shaped tips
    4. Check that reaction labels (purple) sit ON the arrow shaft with a white background, not floating at the tail
    5. Check that load labels (green) remain at the tail end of the arrow (unchanged)
    6. Check a horizontal reaction specifically — label should be centred on the horizontal shaft, clearly attached
    7. Repeat steps 1-6 in frame2d UI (http://localhost:8000/ui/frame2d/index.html)
    8. In frame2d, toggle dark mode — verify reaction label backgrounds adapt (dark bg in dark mode)
    9. In frame2d, verify moment arcs are unchanged (still have V-style arrowhead at arc end)
  </how-to-verify>
  <verify>User visually confirms arrow rendering in browser</verify>
  <done>User approves arrow visuals in both UIs</done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Both drawForceArrow functions use `ctx.stroke()` for arrowhead (no `ctx.fill()` for arrow triangles)
- `ctx.lineWidth = 1.5` in both functions
- `ctx.lineCap = 'round'` in both functions
- Reaction labels have `bgColor` property in LabelManager spec
- `forceLeaderLine` property removed from both files
- `drawMomentArc` unchanged in frame2d
- pytest 61/61 still passes (no solver/API changes)
</verification>

<success_criteria>
Both UIs render force arrows with open chevron tips and 1.5px round-capped shafts. Reaction labels sit on the shaft midpoint with a background pill. Load labels remain at the tail. The horizontal reaction label confusion is eliminated. Moment arcs in frame2d are visually unchanged.
</success_criteria>

<output>
After completion, create `.planning/quick/260525-dcn-arrow-redesign-slimmer-shafts-chevron-he/260525-dcn-SUMMARY.md`
</output>
