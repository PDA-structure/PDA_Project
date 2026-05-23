---
phase: quick-260523-cyp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/script.js
  - ui/frame2d/style.css
  - ui/frame2d/index.html
autonomous: true
requirements:
  - 260523-cyp-D1  # Canvas-drawn legend (top-right, screen-space, gated on results)
  - 260523-cyp-D2  # Linear thickness scaling 1.5 -> 6 px by |axial|/max|axial|
  - 260523-cyp-D3  # Reaction arrows + arcs at every restrained DOF (Fx, Fy, Mz)
  - 260523-cyp-D4  # Force-reaction colour orange (#ef6c00 light / #ffb74d dark) — NOT purple
  - 260523-cyp-D5  # Refactor drawNodeLoads + drawMoments to apex-at-node via shared drawForceArrow()
  - 260523-cyp-D6  # Mirror centroid-outward + halo + 9px font + 14px offset to drawMemberLabel
  - 260523-cyp-D7  # chkReactions toggle in Display panel (gates arrows + legend Reaction row)

must_haves:
  truths:
    # From D-1 (legend)
    - "After a solve, a legend is visible in the top-right of the frame2d canvas"
    - "The legend keys list Tension (blue), Compression (red), Near-zero (grey), Reaction (orange)"
    - "The legend is part of the canvas image (visible in any right-click-save canvas export)"
    - "The legend stays pinned to the top-right at constant size when the user pans or zooms the canvas"
    - "The legend reads cleanly in dark mode (semi-transparent dark card with light text)"
    # From D-2 (thickness)
    - "After a solve, member line thickness varies with |axial force| (member_forces) only — not shear, not moment"
    - "The member with the largest |axial| is drawn at ~6 px; near-zero axial members at ~1.5 px"
    - "Bar members (m.type === 'bar') participate in thickness scaling while preserving their dashed line style"
    - "Thickness scaling applies only to undeformed members; deflected-shape overlay, BMD, SFD all remain at their existing line widths"
    - "Per-member E/I/A override outline (4 px blue) still renders on top of the scaled undeformed line"
    - "Pin-release circles still render at the ends of pinLeft / pinRight members"
    - "Zero-suppressed force labels still hide for members with |F| < 1e-3 (existing frame2d behaviour preserved)"
    # From D-3 (reactions — forces + moments)
    - "After a solve, orange arrows appear at every restrained translational DOF (Fx at base+0, Fy at base+1)"
    - "After a solve, an orange curved-arc moment-reaction symbol appears at every FIXED-support node showing Mz reaction"
    - "Pinned supports show two arrows (Fx + Fy) and no Mz arc (rotation is free at pinned supports)"
    - "rollerX supports show only an Fx arrow; rollerY supports show only an Fy arrow"
    - "Spring supports show arrows / arcs only for the DOFs that have non-null stiffness (Kx → Fx arrow, Ky → Fy arrow, Ktheta → Mz arc)"
    - "Each reaction arrow is labelled with magnitude in kN; each Mz arc is labelled in kNm"
    - "Reaction arrows / arcs use the apex-at-node convention: arrow apex at the node, shaft / arc body extends outward, label at the tail outside the structure"
    - "When a node has coincident Fx + Fy reactions, the two arrow apexes are pulled back by ~2*sc along their force directions so they read as two separate triangles, not a merged diamond"
    - "Reactions with |value| < 1e-3 are suppressed (no zero-length nothings drawn)"
    # From D-4 (force-reaction palette)
    - "Force-reaction arrows render in orange (#ef6c00 in light mode, #ffb74d in dark mode), NOT in moment-load purple"
    - "Mz-reaction arcs render in the same orange family (--canvas-reaction-moment), visually distinct from moment-load purple"
    - "The new --canvas-reaction / --canvas-reaction-label / --canvas-reaction-moment tokens exist in both :root and [data-theme=\"dark\"] blocks of ui/frame2d/style.css"
    # From D-5 (apex-at-node refactor of existing loads + moment loads)
    - "drawNodeLoads now routes Fx and Fy node-load arrows through the shared drawForceArrow() helper (apex-at-node — head triangle apex at node, shaft extends OPPOSITE force direction, label at tail)"
    - "drawNodeLoads now routes moment loads through the shared moment-arc renderer with apex-at-node geometry (arrowhead at the node, arc body extends outward)"
    - "Existing UDL rendering (drawUDLs) is unchanged — refactor only touches node loads (Fx, Fy, moment) and reactions, not member-distributed loads"
    - "Existing load palette (--canvas-load green, --canvas-load-moment purple) is preserved — only the geometry is refactored, not the colours"
    # From D-6 (drawMemberLabel mirror)
    - "drawMemberLabel picks its perpendicular sign by pointing AWAY from the structure centroid (top fans up, bottom fans down, diagonals fan outward)"
    - "drawMemberLabel renders a white halo via ctx.strokeText at rgba(255,255,255,0.9) lineWidth 3 before the coloured fill (light mode); dark mode uses an inverted halo via cssVar('--canvas-bg') or rgba(0,0,0,0.6)"
    - "Member force labels render at 9 px base size scaled by getSymbolScale() — frame2d's existing labelScale + LABEL_FONT_FAMILY are preserved"
    - "Member force labels sit 14 px perpendicular-offset from the member centreline"
    # From D-7 (chkReactions toggle)
    - "A 'Show reactions' checkbox exists in the Display card of ui/frame2d/index.html, checked by default, placed between 'Show loads' and 'Show deflected shape'"
    - "Toggling chkReactions OFF hides ALL reaction arrows and arcs AND drops the Reaction row from the legend (legend stops advertising a colour that isn't drawn)"
    - "Toggling chkSupports OFF leaves reaction arrows / arcs visible (geometry vs solve-output split — same rule as truss2d)"
    - "Toggling chkReactions has an addEventListener('change', draw) wiring (consistent with chkSupports / chkLoads)"
    # Pre-solve behaviour (regression guard) — MUST NOT regress
    - "Before any solve: no legend, no reaction arrows, no Mz arcs; members render at the existing uniform 2 px thickness with their default --canvas-stroke / --canvas-bar colours"
    - "Before any solve: bar members still render dashed; per-member E/I/A overrides still render the 4 px blue outline; pin-release circles still render"
    - "Before any solve: drawNodeLoads still renders green Fx/Fy arrows and purple moment-load arcs (just now via the shared apex-at-node helper)"
    - "Before any solve: drawUDLs, drawSupports, drawDeflected, drawBMD, drawSFD, drawDiagnosticOverlays all render byte-equivalent to the pre-change state"
    # Constraint: surface area is tightly bounded
    - "git diff --stat shows changes confined to exactly three files: ui/frame2d/script.js, ui/frame2d/style.css, ui/frame2d/index.html"
    - "No edits to ui/truss2d/**, solver_core/**, api_server/**, tests/**"
    - "pytest -q remains green (61 passing) before and after — no Python touched"

  artifacts:
    - path: "ui/frame2d/style.css"
      provides: "--canvas-reaction / --canvas-reaction-label / --canvas-reaction-moment tokens in :root and [data-theme=dark] blocks"
      contains: "--canvas-reaction"
    - path: "ui/frame2d/script.js"
      provides: "Linear thickness rule 1.5 + 4.5 * (|axial|/maxAbsForce) inside drawMembers(); preserves bar dash, E/I/A outline, pin circles, zero-suppressed labels"
      contains: "maxAbsForce"
    - path: "ui/frame2d/script.js"
      provides: "Shared drawForceArrow(node, axis, value, color, label) helper supporting both Fx/Fy arrows and curved-arc Mz arcs with apex-at-node geometry + apex-gap pull-back"
      contains: "function drawForceArrow"
    - path: "ui/frame2d/script.js"
      provides: "drawReactions() iterating supports, looking up FG[base+0]/FG[base+1]/FG[base+2] per restrained DOF (fixed = all three; pinned = Fx+Fy; rollerX = Fx; rollerY = Fy; spring = whichever K* are non-null), gated on results && chkReactions.checked"
      contains: "function drawReactions"
    - path: "ui/frame2d/script.js"
      provides: "drawLegend() canvas-drawn 4-row top-right card, screen-space via ctx.setTransform(1,0,0,1,0,0), dark-mode aware, Reaction row hidden when chkReactions unchecked"
      contains: "function drawLegend"
    - path: "ui/frame2d/script.js"
      provides: "drawNodeLoads refactored to route Fx, Fy, AND moment loads through shared apex-at-node helpers (existing colours preserved, geometry only changed)"
      contains: "drawForceArrow"
    - path: "ui/frame2d/script.js"
      provides: "drawMemberLabel updated with centroid-outward perpendicular sign + white halo via ctx.strokeText + 9 px base font + 14 px offset"
      contains: "strokeText"
    - path: "ui/frame2d/index.html"
      provides: "New chkReactions checkbox in Display card, checked by default, between chkLoads and chkDeflected"
      contains: "chkReactions"

  key_links:
    - from: "draw()"
      to: "drawMembers (with thickness scaling), drawNodeLoads (refactored apex-at-node), drawReactions (new), drawLegend (new)"
      via: "explicit calls in the draw() function body, with drawReactions gated on results && chkReactions.checked and drawLegend gated on results truthiness"
      pattern: "draw\\(\\)[\\s\\S]*drawMembers[\\s\\S]*drawReactions[\\s\\S]*drawLegend"
    - from: "drawMembers"
      to: "results.member_forces[idx]"
      via: "computed once-per-draw maxAbsForce, then per-member thickness = 1.5 + 4.5 * (|f|/maxAbsForce); bar dash + override outline + pin circles preserved"
      pattern: "maxAbsForce"
    - from: "drawReactions"
      to: "results.FG + supports[] (including spring DOF stiffness fields)"
      via: "iterate supports; for each support, map type → restrained DOF list ({fixed:[0,1,2], pinned:[0,1], rollerX:[0], rollerY:[1], spring: filter by K* not null}); look up FG[base+dof]; draw via drawForceArrow() for Fx/Fy or moment-arc for Mz"
      pattern: "results\\.FG"
    - from: "drawForceArrow"
      to: "drawNodeLoads (Fx, Fy paths) AND drawReactions (Fx, Fy paths)"
      via: "shared helper called from both; apex-at-node geometry + apex-gap pull-back identical across all call sites for consistent visual grammar"
      pattern: "drawForceArrow"
    - from: "drawLegend"
      to: "document.getElementById('chkReactions').checked"
      via: "legend builds its items[] array conditionally — Reaction row appended only when chkReactions is checked, so legend stops advertising a colour that isn't drawn"
      pattern: "chkReactions"
    - from: "drawMemberLabel"
      to: "structure centroid (mean of nodes[].x, nodes[].y)"
      via: "compute centroid once per draw call (or once per member-label call), pick perpendicular sign that points AWAY from centroid"
      pattern: "centroid"
    - from: "chkReactions checkbox"
      to: "draw()"
      via: "document.getElementById('chkReactions').addEventListener('change', draw) — mirrors existing chkSupports / chkLoads wiring"
      pattern: "chkReactions.*addEventListener"
---

<objective>
Mirror the truss2d colour-coded analysis output enhancements (260522-81l + its 7 UAT iterations) into the frame2d UI. Frame2d already has tension/compression colour-coding and zero-suppressed force labels — this task adds linear thickness scaling, reaction arrows + Mz reaction arcs, a canvas-drawn legend, the apex-at-node arrow geometry, the centroid-outward member-label improvements, and a chkReactions display toggle. Force-reaction colour is orange (`#ef6c00` / `#ffb74d`) NOT truss2d's purple, because frame2d already uses purple for moment LOADS and the visual collision at a node carrying both a moment load and non-zero reactions would be unreadable.

Purpose: lift frame2d's canvas to calc-report-screenshot parity with truss2d — readers no longer need the legend explained, axial-force magnitudes are visible at a glance from line thickness, reactions appear next to their supports (forces AND moments) instead of only inside the results table, and the apex-at-node arrow convention reads "force pushes into the node" consistently across loads and reactions.

Output: enhanced `ui/frame2d/script.js` (primary surface), `ui/frame2d/style.css` (new `--canvas-reaction*` tokens in both themes), and `ui/frame2d/index.html` (single new `chkReactions` checkbox). No solver, no API, no test changes. truss2d untouched.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260523-cyp-mirror-truss2d-colour-coded-analysis-out/260523-cyp-CONTEXT.md
@.planning/quick/260522-81l-add-colour-coded-tension-compression-vis/260522-81l-PLAN.md
@.planning/quick/260522-81l-add-colour-coded-tension-compression-vis/260522-81l-SUMMARY.md
@./CLAUDE.md
@ui/frame2d/script.js
@ui/frame2d/index.html
@ui/frame2d/style.css

<!-- Reference (no edits to these): the matching truss2d source that landed in 260522-81l -->
<!-- ui/truss2d/script.js — drawMembers thickness pattern, drawForceArrow shared helper, drawReactions, drawLegend, drawMemberLabel centroid-outward + halo -->
<!-- ui/truss2d/index.html — chkReactions checkbox position pattern -->

<!-- Solver sign-convention reference (no edits): -->
<!-- solver_core/src/pda_analysis_software/solvers/frame_v2.py -->
<!--   FG = Ks @ UG => 3n × 1 column vector -->
<!--   For node i (0-indexed): base = i * 3 -->
<!--     FG[base+0] = +X reaction (force in +X world; canvas Y NOT flipped for X) -->
<!--     FG[base+1] = +Y reaction (force in +Y world; canvas Y IS flipped, so +Y world → -y canvas) -->
<!--     FG[base+2] = Mz reaction (anti-clockwise positive in world / mathematical convention) -->

<interfaces>
<!-- Existing frame2d state and helpers the executor will touch / extend. ALL already in the file. -->

State variables (script.js top):
  let nodes      = [];                  // { id, x, y, realX, realY }  -- x/y are CANVAS pixels
  let members    = [];                  // { start, end, type, udl, udl_x, E_override, I_override, A_override, pinLeft, pinRight }
  let supports   = [];                  // { nodeId, type, Kx?, Ky?, Ktheta? }
                                        //   type in {'fixed','pinned','rollerX','rollerY','spring'}
                                        //   Kx/Ky/Ktheta on spring supports: null = free, number = restrained with that stiffness
  let nodeLoads  = [];                  // { nodeId, direction: 'x'|'y'|'moment', magnitude }
  let results    = null;                // last API response: { member_forces, member_shears, member_moments, UG, FG, meta, solver }
  const ctx;                            // canvas 2D context
  const canvas;                         // HTMLCanvasElement
  const view     = { scale, tx, ty };   // pan/zoom transform applied in draw()

Constants:
  const GRID                            // canvas pixels per metre
  const BASE_LABEL_SIZE                 // base font size in px (currently 10) — Task 4 lowers to 9 for member/arrow labels per D-6
  const LABEL_FONT_FAMILY               // typography family (Inter)
  let   labelScale                      // user-adjustable label scale multiplier

Helpers (do NOT rewrite — call / extend):
  function draw()                       // top-level render loop; clears + transforms + dispatches (line ~783)
  function drawGrid()                   // ~line 812
  function drawMembers()                // ~line 844 — THIS GAINS thickness scaling (Task 2)
  function drawMemberLabel(n1,n2,text,color)  // ~line 890 — THIS GAINS centroid-outward + halo + 9px + 14px (Task 4)
  function drawPinCircle()              // ~line 908 — preserve as-is
  function drawNodes()                  // ~line 924 — preserve as-is
  function drawDiagnosticOverlays()     // ~line 954 — preserve as-is (PUREBAR red overlays)
  function drawSupports()               // ~line 1009 — preserve as-is
  function drawFixed/Pin/RollerH/RollerV/Spring()  // glyph helpers — preserve as-is
  function drawNodeLoads()              // ~line 1160 — THIS GETS REFACTORED through drawForceArrow + apex-at-node moment arc (Task 3)
  function drawNodeLabels()             // ~line 1214 — preserve as-is
  function drawUDLs()                   // ~line 1229 — preserve as-is (member-distributed loads, not in scope per D-5)
  function drawDeflected()              // ~line 1345 — preserve as-is (thickness scaling does NOT leak in)
  function drawBMD() / drawSFD()        // ~line 1426 / 1530 — preserve as-is
  function getSymbolScale()             // reads #inputSymbolScale
  function cssVar(name)                 // reads --canvas-* design tokens (theme-aware)
  function highlightNode(n, color)      // ~line 1000 — preserve as-is

Existing design tokens to read in new code (defined in style.css):
  --canvas-tension                      // tension blue (var(--color-info), aliases #1565c0)
  --canvas-compression                  // compression red (var(--color-danger-strong))
  --canvas-zero                         // near-zero grey (#999 / dark #6f747c)
  --canvas-bg                           // canvas background (used for halo invert in dark mode)
  --canvas-label                        // member-label text colour (light: #1a2744 / dark: #e6e8eb)
  --canvas-load                         // node-load green (#2e7d32 / dark #6abf6e) — preserve for Fx/Fy node loads
  --canvas-load-moment                  // moment-load purple (#6a1b9a / dark #ce93d8) — preserve for moment loads
  --color-fg-strong                     // legend text colour, theme-aware

New design tokens to ADD in Task 1 (NOT yet present):
  --canvas-reaction          #ef6c00    (light) / #ffb74d (dark)  — Fx/Fy reaction arrow stroke + fill
  --canvas-reaction-label    #bf360c    (light) / #ffcc80 (dark)  — kN / kNm reaction text colour
  --canvas-reaction-moment   #ef6c00    (light) / #ffb74d (dark)  — Mz reaction arc stroke + arrowhead fill

Reaction DOF mapping (mirrors renderResults logic at script.js ~1977):
  base = s.nodeId * 3
  fixed   -> [base+0 (Fx), base+1 (Fy), base+2 (Mz)]
  pinned  -> [base+0 (Fx), base+1 (Fy)]
  rollerX -> [base+0 (Fx)]
  rollerY -> [base+1 (Fy)]
  spring  -> Kx != null ? [base+0] : [];  Ky != null ? add base+1;  Ktheta != null ? add base+2
            (spring DOF set is the union of whichever K* fields are non-null)

Canvas Y-flip convention (matches drawNodeLoads + truss2d drawForceArrow):
  Positive FG[base+1] (Fy in +Y world / upward) → arrow points in -y canvas (upward on screen)
  Positive FG[base+0] (Fx in +X world / rightward) → arrow points in +x canvas (rightward on screen, no flip)
  Positive FG[base+2] (Mz in +world / anti-clockwise) → arc arrowhead rotates anti-clockwise on screen
    NOTE: canvas y is flipped, so visual "anti-clockwise in world" reads as clockwise in raw canvas coords;
    mirror the existing drawNodeLoads moment-load arc rotation logic — it already gets this right.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --canvas-reaction* design tokens to ui/frame2d/style.css</name>
  <files>ui/frame2d/style.css</files>
  <action>
Add three new design tokens (`--canvas-reaction`, `--canvas-reaction-label`, `--canvas-reaction-moment`) in both the `:root` block and the `[data-theme="dark"]` block of `ui/frame2d/style.css`. These tokens are read by `drawReactions()` and `drawLegend()` added in Tasks 3 and 5.

Per CONTEXT.md D-4 (force-reaction colour locked): use orange (`#ef6c00`) NOT purple. Frame2d already uses purple `#6a1b9a` for moment LOADS via `--canvas-load-moment`; truss2d's reaction-purple `#7b1fa2` would create a near-indistinguishable collision when a frame has both a moment load and a non-zero reaction at adjacent nodes. Orange is the only major hue not already in the frame2d palette.

Steps:

1. Open `ui/frame2d/style.css`. Locate the `--canvas-tension:` line in the `:root` block (around line 76, immediately before `--canvas-compression`). Add the three new tokens immediately after the existing `--canvas-compression` / `--canvas-zero` cluster:

   ```css
   :root {
     /* ...existing tokens unchanged... */
     --canvas-tension: var(--color-info);
     --canvas-compression: var(--color-danger-strong);
     --canvas-zero: #999999;
     /* NEW — Mirror of 260522-81l, but ORANGE not PURPLE per 260523-cyp D-4
        (frame2d already uses purple for moment loads via --canvas-load-moment) */
     --canvas-reaction:        #ef6c00;   /* Fx/Fy reaction arrow stroke + fill */
     --canvas-reaction-label:  #bf360c;   /* kN / kNm reaction label text */
     --canvas-reaction-moment: #ef6c00;   /* Mz reaction arc stroke + arrowhead */
     /* ...remaining tokens unchanged... */
   }
   ```

2. Locate the `[data-theme="dark"]` block (around line 589 — the dark-mode canvas-content cluster starts with `--canvas-stroke: #cfd6e0`). Add the dark-mode variants immediately after the `--canvas-zero: #6f747c` line:

   ```css
   [data-theme="dark"] {
     /* ...existing dark canvas tokens unchanged... */
     --canvas-zero: #6f747c;
     /* NEW — dark-mode reaction tokens */
     --canvas-reaction:        #ffb74d;   /* lighter orange visible on dark canvas */
     --canvas-reaction-label:  #ffcc80;
     --canvas-reaction-moment: #ffb74d;
     /* ...remaining dark tokens unchanged... */
   }
   ```

3. Do NOT change any existing token values. Do NOT touch `--canvas-load-moment` (moment-load purple) — that token is what drawNodeLoads continues to read for the moment-LOAD arc colour. The two — moment LOAD purple, moment REACTION orange — must remain visually distinct (per CONTEXT decision 2).

4. Do NOT add `--canvas-legend-bg-*` tokens — per CONTEXT Claude's Discretion, drawLegend() picks its card background inline via `data-theme` attribute check (single source of truth, no extra tokens).

Justification (record in commit body or inline comment in the diff):
- Three new tokens added in both themes per D-4: `--canvas-reaction` / `-label` / `-moment`.
- Orange `#ef6c00` (light) / `#ffb74d` (dark) chosen because frame2d's purple is already taken by moment LOADS — visual collision is the entire D-4 rationale.
- Foundation-first: all subsequent tasks read these tokens via `cssVar()`. Landing them in commit 1 means the rest of the work compiles against named tokens, not raw hex strings.
  </action>
  <verify>
    <automated>git diff ui/frame2d/style.css | grep -c "canvas-reaction" | xargs -I{} sh -c 'test {} -eq 6'</automated>
    Visual check after Task 5 has wired things in:
    1. `git diff --stat ui/frame2d/style.css` — expect ~6-12 added lines, all confined to the two existing blocks (`:root` and `[data-theme="dark"]`). No other style.css edits.
    2. Open the frame2d UI in light mode and dark mode — no visible change yet (no consumer wired). The check is that the existing UI still renders unchanged (no accidental edits to other tokens). This is a foundation commit; visual impact lands in later tasks.
  </verify>
  <done>
- `--canvas-reaction`, `--canvas-reaction-label`, `--canvas-reaction-moment` exist in both `:root` and `[data-theme="dark"]` blocks (6 new lines minimum).
- Light values: `#ef6c00`, `#bf360c`, `#ef6c00`. Dark values: `#ffb74d`, `#ffcc80`, `#ffb74d`.
- No existing tokens modified or removed.
- No other file touched in this commit.
- UI still renders byte-identically (foundation commit — no consumer yet).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add linear thickness scaling to drawMembers() (preserve bar dash, E/I/A outline, pin circles, zero-suppressed labels)</name>
  <files>ui/frame2d/script.js</files>
  <action>
Modify `drawMembers()` (around line 844) so that after a successful solve, member line thickness varies linearly with `|member_forces[idx]| / max(|member_forces|)`. Mirror the truss2d rule from 260522-81l Task 1.

Per CONTEXT D-2 (thickness magnitude locked): axial force only (member_forces), NOT shear or moment (those vary spatially along the member and already show via BMD/SFD). Bar members are INCLUDED in thickness scaling — they exist specifically to carry axial. Bar dashing must be preserved.

Steps:

1. Inside `drawMembers()`, immediately above the `members.forEach((m, idx) => { ... })` loop, add the normalisation pass:

   ```js
   // Linear thickness scaling per 260523-cyp D-2 (mirrors truss2d 260522-81l).
   // |axial| / max|axial| → thickness 1.5 .. 6 px. Computed once per draw call.
   let maxAbsForce = 0;
   if (results && results.member_forces) {
     for (let i = 0; i < results.member_forces.length; i++) {
       const af = Math.abs(results.member_forces[i]);
       if (af > maxAbsForce) maxAbsForce = af;
     }
   }
   ```

2. Inside the per-member loop, AFTER the existing `if (results && results.member_forces) { ... }` colour-setting block, BEFORE the `ctx.strokeStyle = color;` line, compute the per-member thickness:

   ```js
   let thickness = 2; // default when no solve yet — preserves existing 2 px stroke
   if (results && results.member_forces && maxAbsForce > 1e-3) {
     const f = results.member_forces[idx];
     const af = Math.abs(f);
     const ratio = af < 1e-3 ? 0 : (af / maxAbsForce);   // clamp near-zero to min
     thickness = 1.5 + 4.5 * ratio;
   }
   ```

3. Replace the existing line `ctx.lineWidth = 2;` (the one immediately before `if (m.type === 'bar') ctx.setLineDash([6, 4]);`) with `ctx.lineWidth = thickness;`.

4. DO NOT touch:
   - The `if (m.type === 'bar') ctx.setLineDash([6, 4]);` line — bar dashing preserved.
   - The `ctx.setLineDash([]);` reset after the stroke — preserves zero-dash state for downstream draws.
   - The `if (forceLabel) drawMemberLabel(n1, n2, forceLabel, color);` call — zero-suppressed labels preserved (the existing `isZero` gate at line 856 already handles |F| < 1e-3 by setting `forceLabel = null`).
   - The `// override indicator — blue outline when member has per-member E/I/A` block (lines 873-882) — E/I/A override outline still renders at its existing 4 px lineWidth ON TOP of the scaled undeformed line.
   - The pin-release circle calls — `drawPinCircle()` still fires for pinLeft / pinRight members.

5. DO NOT touch:
   - `drawDeflected()` (~line 1345) — deflected-shape overlay stays at its existing 1.5 px dashed style (per CONTEXT D-2 / Claude's Discretion: thickness scaling applies only to undeformed members).
   - `drawBMD()` / `drawSFD()` — diagram overlays stay at their existing line widths.
   - `drawDiagnosticOverlays()` — the offending-member red overlay stays at its existing 3 px (it must remain visually dominant when a 422 fires).

Justification:
- Linear rule per CONTEXT D-2 (max 6 px, min 1.5 px floor).
- maxAbsForce computed once per draw, O(n_members) not O(n_members^2).
- Near-zero members clamp to the floor — they remain visible as thin grey lines, not zero-width strokes that would visually delete them.
- Bar members participate because axial is what they exist to carry (CONTEXT D-2 explicitly includes them).
- Order matters: thickness set before `if (m.type === 'bar') setLineDash`, so the dash style runs on top of the per-member-magnitude thickness — bar with high axial = thick dashed line.
  </action>
  <verify>
    <automated>git diff ui/frame2d/script.js | grep -c "maxAbsForce" | xargs -I{} sh -c 'test {} -ge 2'</automated>
    Visual UAT (after the task lands — full UAT script lives at the bottom of this PLAN):
    1. `git diff ui/frame2d/script.js` — expect ~12-18 added lines confined to `drawMembers()`, no edits to `drawDeflected()` / `drawBMD()` / `drawSFD()` / `drawNodeLoads()` / `drawDiagnosticOverlays()`.
    2. Open `http://127.0.0.1:8000/ui/frame2d/index.html`, build a continuous beam (3 nodes, pinned + rollerY + rollerY, mid-span point load), Solve, confirm the loaded span draws visibly thicker than the unloaded span.
    3. Build a portal frame with a bar diagonal carrying high axial — confirm the bar still renders DASHED and ALSO thicker than members in pure bending.
    4. Toggle "Show deflected shape" — orange dashed overlay remains thin (unchanged).
    5. Add a per-member E/I/A override on the thickest member — the 4 px blue outline still renders correctly on top of the scaled undeformed line.
    6. Add a pin-release on a member end — pin-release circle still draws.
  </verify>
  <done>
- `drawMembers()` contains a `maxAbsForce` normalisation pass before the loop and a per-member `thickness = 1.5 + 4.5 * (|F|/maxAbsForce)` computation inside it.
- The literal `ctx.lineWidth = 2;` inside `drawMembers()` (the one for the main stroke) has been replaced by `ctx.lineWidth = thickness;`.
- `drawDeflected()`, `drawBMD()`, `drawSFD()`, `drawDiagnosticOverlays()`, `drawNodeLoads()`, `drawUDLs()` are byte-identical to pre-change.
- Bar members still render dashed; per-member E/I/A override still renders 4 px blue outline; pin-release circles still render.
- Zero-suppressed force labels (`forceLabel = null` when `|F| < 1e-3`) still suppress correctly.
- Pre-solve behaviour unchanged: with `results === null`, thickness defaults to 2 — visually identical to pre-task state.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add shared drawForceArrow() helper; refactor drawNodeLoads (Fx/Fy/moment) to apex-at-node; add drawReactions() covering Fx/Fy arrows + Mz arcs</name>
  <files>ui/frame2d/script.js</files>
  <action>
This is the big architectural task — the shared `drawForceArrow()` helper is the WHOLE point of the apex-at-node refactor. Splitting it across multiple commits would leave the codebase in an intermediate state where some arrows are apex-at-node and others aren't, creating an inconsistent visual grammar that would visibly regress the existing drawNodeLoads behaviour. All three concerns are unified by the shared helper:

1. **New** `drawForceArrow(node, axis, value, color, label)` — shared helper. Apex of arrowhead lands AT the node; shaft extends OPPOSITE force direction; label at tail outside structure.
2. **New** moment-arc renderer (could be the same helper with an `axis === 'moment'` branch, OR a separate `drawMomentArc()` — executor's call; whichever is cleaner). Apex-at-node = arrowhead lands at the node; arc body extends outward.
3. **Refactor** `drawNodeLoads()` (Fx/Fy paths via `drawForceArrow`; moment-load path via the moment-arc renderer). Existing colours preserved (`--canvas-load` for Fx/Fy, `--canvas-load-moment` for moment).
4. **New** `drawReactions()` — iterates supports, looks up FG entries per restrained DOF, calls `drawForceArrow` for Fx/Fy and the moment-arc renderer for Mz. Reads `--canvas-reaction` / `--canvas-reaction-label` / `--canvas-reaction-moment` tokens added in Task 1.
5. **Wire** `drawReactions()` into `draw()` gated on `results && chkReactions.checked` (chkReactions arrives in Task 5; for THIS commit, gate on `results && document.getElementById('chkReactions')?.checked !== false` so the call is forward-compatible — see Wiring note below).

Steps:

### Step 1 — Add the shared helper(s)

Place the new helpers ABOVE `drawNodeLoads()` (around line 1158, between the `function highlightNode()` block and the `// ── Node loads ──` comment). Suggested API:

```js
// ── Shared apex-at-node force arrow helper ─────────────────────────────────
// Mirrors truss2d 260522-81l Task 6 (apex-at-node refactor).
// - node:   { x, y } in canvas pixels (already-transformed structure node)
// - axis:   'x' | 'y' (translational force direction)
// - value:  signed force in Newtons (sign decides arrow direction)
// - color:  stroke + fill colour (CSS string from cssVar())
// - labelColor: text colour (CSS string)
// - label:  text to render at the tail (e.g. '12.34 kN'); pass null to skip
// - apexGap: optional pull-back in px; 0 = apex on node, ~2*sc = pulled back
//            to leave room for a coincident orthogonal arrow at the same node.
function drawForceArrow(node, axis, value, color, labelColor, label, apexGap = 0) {
  if (Math.abs(value) < 1e-3) return;   // skip zero-length nothings (matches truss2d)
  const sc       = getSymbolScale();
  const arrowLen = 24 * sc;
  const arrowTip = 19 * sc;
  const arrowHW  = 5 * sc;
  const fs       = Math.round(9 * labelScale * sc);   // D-6: 9 px base, scales with labelScale + getSymbolScale

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);

  // Apex-at-node geometry: head triangle apex sits at the node (optionally
  // pulled back by apexGap along the force direction to make room for a
  // coincident orthogonal arrow); shaft extends OPPOSITE to force direction;
  // label sits at the tail end, outside the structure.
  if (axis === 'y') {
    // value > 0 = +Y world = upward = -y canvas (canvas Y is flipped)
    const sign      = value > 0 ? -1 : 1;
    const apexX     = node.x;
    const apexY     = node.y + sign * apexGap;
    const shaftEndX = apexX;
    const shaftEndY = node.y + sign * (apexGap + arrowLen);
    // shaft from apex outward
    ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(shaftEndX, shaftEndY); ctx.stroke();
    // head triangle — apex at (apexX, apexY), base at (apexX, apexY + sign*(arrowLen - arrowTip + arrowTip)) ≈ inner base
    ctx.beginPath();
    ctx.moveTo(apexX - arrowHW, apexY + sign * (arrowTip - 0));
    ctx.lineTo(apexX, apexY);
    ctx.lineTo(apexX + arrowHW, apexY + sign * (arrowTip - 0));
    ctx.fill();
    // label at tail (outside structure)
    if (label) {
      const labelY = shaftEndY + sign * (12 * sc);
      drawHaloedLabel(label, apexX, labelY, labelColor, fs);
    }
  } else {  // axis === 'x'
    const sign      = value > 0 ? 1 : -1;
    const apexX     = node.x + sign * apexGap;
    const apexY     = node.y;
    const shaftEndX = node.x + sign * (apexGap + arrowLen);
    const shaftEndY = apexY;
    ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(shaftEndX, shaftEndY); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(apexX + sign * arrowTip, apexY - arrowHW);
    ctx.lineTo(apexX, apexY);
    ctx.lineTo(apexX + sign * arrowTip, apexY + arrowHW);
    ctx.fill();
    if (label) {
      const labelX = shaftEndX + sign * (18 * sc);
      drawHaloedLabel(label, labelX, apexY + 4, labelColor, fs);
    }
  }
  ctx.restore();
}

// Helper: draw text with white halo (light mode) or dark halo (dark mode).
// Mirrors truss2d 260522-81l Task 4 (centroid-outward + halo).
function drawHaloedLabel(text, x, y, color, fontSize) {
  ctx.save();
  ctx.font         = `${fontSize}px ${LABEL_FONT_FAMILY}`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth   = 3;
  ctx.lineJoin    = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Apex-at-node moment arc — used for both moment LOADS and Mz REACTIONS.
// kind: 'load' | 'reaction'    (decides radius + arc-span; load uses 22 px / 270°, reaction uses 18 px / 240°)
// node:  { x, y } in canvas pixels
// value: signed moment in N·m (sign decides arc direction)
// color: arc stroke + arrowhead fill (CSS string)
// labelColor: text colour
// label: e.g. '5.67 kNm'; pass null to skip
function drawMomentArc(node, value, color, labelColor, label, kind = 'load') {
  if (Math.abs(value) < 1e-3) return;
  const sc       = getSymbolScale();
  const radius   = (kind === 'reaction' ? 18 : 22) * sc;
  const arcSpan  = kind === 'reaction' ? Math.PI * (240/180) : Math.PI * (270/180);
  const sign     = value > 0 ? 1 : -1;   // + = anti-clockwise in world
  const fs       = Math.round(9 * labelScale * sc);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2;
  // Place the arc gap at the bottom of the node so the label can sit below.
  // Match the existing drawNodeLoads moment-load arc orientation so the
  // refactor is visually backward-compatible.
  const startAngle = sign > 0 ? 0.3 : Math.PI + 0.3;
  const endAngle   = startAngle + sign * arcSpan;
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, startAngle, endAngle, sign < 0);
  ctx.stroke();
  // Arrowhead at the end of the arc (apex-at-arrow-end mirrors existing pattern)
  const ax     = node.x + radius * Math.cos(endAngle);
  const ay     = node.y + radius * Math.sin(endAngle);
  const tang   = endAngle + sign * Math.PI / 2;
  const arrSz  = 5 * sc;
  ctx.beginPath();
  ctx.moveTo(ax + arrSz * Math.cos(tang - 0.5), ay + arrSz * Math.sin(tang - 0.5));
  ctx.lineTo(ax, ay);
  ctx.lineTo(ax + arrSz * Math.cos(tang + 0.5), ay + arrSz * Math.sin(tang + 0.5));
  ctx.fill();
  // Label at the bottom of the arc, outside the gap
  if (label) {
    drawHaloedLabel(label, node.x, node.y + radius + 12 * sc, labelColor, fs);
  }
  ctx.restore();
}
```

### Step 2 — Refactor drawNodeLoads to use the shared helpers

Replace the body of `drawNodeLoads()` (currently ~line 1160 to ~1211) with a delegating implementation:

```js
function drawNodeLoads() {
  const loadColor       = cssVar('--canvas-load');
  const loadLabelColor  = cssVar('--canvas-load-label');
  const momentColor     = cssVar('--canvas-load-moment');
  const momentLabelColor= cssVar('--canvas-load-moment-label');
  // No coincident-arrow gap on LOADS (loads are user input — assume the user
  // didn't place two coincident loads; if they did, drawLoads matches reactions
  // by setting apexGap to 2*sc when this node also has another load at the
  // same axis). Keep apexGap = 0 here unless a coincident-arrow check is added.
  nodeLoads.forEach(l => {
    const n = nodes.find(nd => nd.id === l.nodeId);
    if (!n) return;
    const labelText = (Math.abs(l.magnitude) / 1000).toFixed(1) + (l.direction === 'moment' ? ' kNm' : ' kN');
    if (l.direction === 'x' || l.direction === 'y') {
      // Detect coincident orthogonal load at same node → apexGap pull-back
      const hasOther = nodeLoads.some(other =>
        other !== l &&
        other.nodeId === l.nodeId &&
        ((l.direction === 'x' && other.direction === 'y') ||
         (l.direction === 'y' && other.direction === 'x'))
      );
      const apexGap = hasOther ? 2 * getSymbolScale() : 0;
      drawForceArrow(n, l.direction, l.magnitude, loadColor, loadLabelColor, labelText, apexGap);
    } else if (l.direction === 'moment') {
      drawMomentArc(n, l.magnitude, momentColor, momentLabelColor, labelText, 'load');
    }
  });
}
```

NOTE: this is a behaviour change for moment-load rendering (arrowhead now anchors via the helper's geometry; existing colours and arc-span 270° preserved via `kind='load'`). Per CONTEXT D-5, this is explicitly accepted scope — consistent visual grammar across loads and reactions is the whole point.

### Step 3 — Add drawReactions()

Place `drawReactions()` immediately after `drawNodeLoads()`:

```js
function drawReactions() {
  if (!results || !results.FG) return;
  const FG          = results.FG;
  const sc          = getSymbolScale();
  const ZERO        = 1e-3;
  const arrowColor  = cssVar('--canvas-reaction');
  const labelColor  = cssVar('--canvas-reaction-label');
  const momentColor = cssVar('--canvas-reaction-moment');

  supports.forEach(s => {
    const n = nodes.find(nd => nd.id === s.nodeId);
    if (!n) return;
    const base = s.nodeId * 3;

    // Build restrained-DOF list per support type
    let dofs = [];
    if      (s.type === 'fixed')   dofs = [0, 1, 2];
    else if (s.type === 'pinned')  dofs = [0, 1];
    else if (s.type === 'rollerX') dofs = [0];
    else if (s.type === 'rollerY') dofs = [1];
    else if (s.type === 'spring') {
      if (s.Kx     != null) dofs.push(0);
      if (s.Ky     != null) dofs.push(1);
      if (s.Ktheta != null) dofs.push(2);
    }

    // Apex-gap when both Fx and Fy are restrained at this node (coincident arrows)
    const hasFx = dofs.includes(0);
    const hasFy = dofs.includes(1);
    const apexGap = (hasFx && hasFy) ? 2 * sc : 0;

    dofs.forEach(d => {
      const raw = FG[base + d];
      if (Math.abs(raw) < ZERO) return;
      if (d === 0) {
        drawForceArrow(n, 'x', raw, arrowColor, labelColor, (raw/1000).toFixed(2) + ' kN', apexGap);
      } else if (d === 1) {
        drawForceArrow(n, 'y', raw, arrowColor, labelColor, (raw/1000).toFixed(2) + ' kN', apexGap);
      } else {  // d === 2 → Mz
        drawMomentArc(n, raw, momentColor, labelColor, (raw/1000).toFixed(2) + ' kNm', 'reaction');
      }
    });
  });
}
```

### Step 4 — Wire drawReactions into draw()

In `draw()` (around line 783), add a call to `drawReactions()` AFTER the `if (document.getElementById('chkLoads').checked) drawNodeLoads();` line (which is around line 801), gated on `results` AND on `chkReactions` checked (the chkReactions element gets added in Task 5; for THIS commit, use a forward-compatible read that defaults to true if the element doesn't exist yet):

```js
if (results) {
  const chkR = document.getElementById('chkReactions');
  // Default to ON if checkbox not yet in DOM (intermediate-commit forward compatibility)
  if (!chkR || chkR.checked) drawReactions();
}
```

NOTE: this lets Task 5 add the checkbox and have it Just Work without a follow-up edit to draw(). Once Task 5 lands the checkbox, the `!chkR` branch becomes dead and the gate behaves as documented in D-7.

Justification:
- Single shared `drawForceArrow()` helper across drawNodeLoads (Fx/Fy) and drawReactions (Fx/Fy) per CONTEXT D-5 — eliminates duplication and guarantees identical visual grammar across loads and reactions.
- Single shared `drawMomentArc()` across drawNodeLoads (moment loads) and drawReactions (Mz reactions), distinguished by `kind: 'load'|'reaction'` → larger purple 22 px 270° arc for loads, smaller orange 18 px 240° arc for reactions. Visually distinct per CONTEXT decision 2.
- Apex-gap pull-back (`2 * sc` along force direction) when both Fx and Fy are restrained at a node, mirroring 260522-81l Task 6 fix. Prevents the diamond-shape merge at pinned/fixed supports.
- Zero-suppression at `|value| < 1e-3` matches truss2d and frame2d's existing convention.
- Spring supports respected: arrows / arcs drawn only for the K* that are non-null (free DOFs don't reaction → don't draw).
- Halo via `ctx.strokeText` (dark mode inverts to `rgba(0,0,0,0.6)`) directly in `drawHaloedLabel()` — labels on dark canvas don't disappear into the background.
- Forward-compatible gate (`!chkR || chkR.checked`) avoids ordering constraint between this commit and Task 5.
  </action>
  <verify>
    <automated>git diff ui/frame2d/script.js | grep -cE "function drawForceArrow|function drawMomentArc|function drawReactions" | xargs -I{} sh -c 'test {} -ge 3'</automated>
    Visual UAT:
    1. `git diff ui/frame2d/script.js` — expect three new functions (`drawForceArrow`, `drawMomentArc`, `drawReactions`) + helper `drawHaloedLabel` + refactored `drawNodeLoads` body + one new wired call in `draw()`. No other edits in this commit.
    2. Load `cantilever-beam.json` fixture (fixed left, downward UDL): solve → confirm orange Mz arc + label at the fixed support; no Fx arrow if Fx reaction is zero (cantilever with vertical-only UDL).
    3. Load `portal-frame.json` (fixed both supports, lateral wind): solve → confirm orange Fx + Fy arrows AND orange Mz arc at BOTH supports; confirm the Fx + Fy apexes are pulled back by ~2*sc each (no diamond merge).
    4. Load `continuous-beam.json` (3 nodes, pinned + rollerY + rollerY, mid-span point load): solve → confirm pure Fy reaction arrows at the three supports (no Mz arcs because pinned/roller have free rotation); confirm thickness scaling (from Task 2) renders the loaded spans thicker.
    5. Toggle "Show supports" OFF → support glyphs disappear, reaction arrows / arcs REMAIN (geometry vs solve-output split per D-3).
    6. Refactor sanity: add a +5 kN load and a downward -5 kN load at the same node and confirm the existing green load arrows still render apex-at-node with the same pull-back; moment loads still render purple with arrowhead at the node.
  </verify>
  <done>
- `drawForceArrow(node, axis, value, color, labelColor, label, apexGap)` exists in script.js — apex-at-node geometry, halo via `drawHaloedLabel()`.
- `drawMomentArc(node, value, color, labelColor, label, kind)` exists — `kind='load'` uses 22 px / 270° arc, `kind='reaction'` uses 18 px / 240° arc.
- `drawHaloedLabel(text, x, y, color, fontSize)` exists — dark-mode aware halo.
- `drawNodeLoads()` body fully refactored to delegate Fx/Fy paths to `drawForceArrow` and moment path to `drawMomentArc(kind='load')`. Existing colours (`--canvas-load`, `--canvas-load-moment`) preserved. Coincident X+Y load detection sets apexGap = 2*sc.
- `drawReactions()` exists — iterates supports, builds restrained-DOF list per support type (fixed = [0,1,2]; pinned = [0,1]; rollerX = [0]; rollerY = [1]; spring = filter by K*), calls drawForceArrow for Fx/Fy and drawMomentArc(kind='reaction') for Mz. Uses `--canvas-reaction*` tokens from Task 1. Apex-gap when both Fx and Fy restrained.
- `draw()` calls `drawReactions()` after `drawNodeLoads()`, gated on `results && (!chkR || chkR.checked)`.
- Existing drawUDLs, drawSupports, drawDeflected, drawBMD, drawSFD, drawNodes, drawDiagnosticOverlays unchanged.
- Toggling chkSupports OFF still leaves reaction arrows visible.
- No HTML/CSS edits in this commit (Task 1 already added tokens; Task 5 adds the checkbox).
- Pre-solve canvas: drawReactions returns early (no results.FG), no orange arrows render. Existing drawNodeLoads colours still render correctly (visual regression-free for the refactor itself).
  </done>
</task>

<task type="auto">
  <name>Task 4: Mirror centroid-outward + halo + 9 px font + 14 px offset improvements to drawMemberLabel</name>
  <files>ui/frame2d/script.js</files>
  <action>
Frame2d's `drawMemberLabel()` (line ~890) still uses the OLD "always above" perpendicular flip (`if (ny > 0) { nx = -nx; ny = -ny; }`). Mirror the truss2d improvements from 260522-81l Task 4 (centroid-outward + halo) and the later font-size tweak from iteration 8 (10 → 9 px) and the offset tweak from iteration 9 (18 → 14 px). Frame2d already sits at 14 px offset, so only font + flip + halo change here.

Per CONTEXT D-6 (locked):
- Centroid-outward perpendicular sign (top-chord labels fan up, bottom-chord fan down, diagonals fan outward) — eliminates label clustering at converging nodes on dense frames.
- White halo via `ctx.strokeText` at `rgba(255,255,255,0.9)` lineWidth 3 BEFORE the fill (light mode); dark mode uses `rgba(0,0,0,0.6)` so labels remain visible.
- 9 px base font (frame2d's current `BASE_LABEL_SIZE` is 10 — for the MEMBER LABEL ONLY, reduce by 1 px while preserving `labelScale` and `getSymbolScale()` multipliers).
- 14 px perpendicular offset (already at 14 in frame2d — no change to magnitude, just keep it).

Steps:

1. Compute the structure centroid ONCE per draw call (cheap — typical frames have < 50 nodes). Add this near the top of `draw()` (around line 783), immediately AFTER the `ctx.setTransform(view.scale, ...)` line, into a module-level variable visible to `drawMemberLabel`:

   ```js
   // Compute structure centroid once per draw — used by drawMemberLabel for
   // centroid-outward perpendicular sign (per 260523-cyp D-6 / mirror of 260522-81l Task 4).
   if (nodes.length > 0) {
     let cx = 0, cy = 0;
     for (let i = 0; i < nodes.length; i++) { cx += nodes[i].x; cy += nodes[i].y; }
     _structureCentroidX = cx / nodes.length;
     _structureCentroidY = cy / nodes.length;
   } else {
     _structureCentroidX = 0;
     _structureCentroidY = 0;
   }
   ```

   And declare module-level near the top of the file (alongside other module-level state):
   ```js
   let _structureCentroidX = 0;
   let _structureCentroidY = 0;
   ```

2. Replace the body of `drawMemberLabel(n1, n2, text, color)` (currently lines ~890-906) with:

   ```js
   function drawMemberLabel(n1, n2, text, color) {
     const mx  = (n1.x + n2.x) / 2;
     const my  = (n1.y + n2.y) / 2;
     const dx  = n2.x - n1.x;
     const dy  = n2.y - n1.y;
     const len = Math.hypot(dx, dy) || 1;
     // Raw perpendicular unit normal
     let nx = -dy / len;
     let ny =  dx / len;
     // Centroid-outward sign: pick the side that points AWAY from the structure centroid.
     // Vector from centroid to midpoint:
     const fromCx = mx - _structureCentroidX;
     const fromCy = my - _structureCentroidY;
     // If the raw normal points INTO the centroid (dot < 0), flip it.
     if (nx * fromCx + ny * fromCy < 0) { nx = -nx; ny = -ny; }
     const angle = Math.atan2(dy, dx);
     const offset = 14;   // px — preserved from existing frame2d
     ctx.save();
     ctx.translate(mx + nx * offset, my + ny * offset);
     ctx.rotate(Math.abs(angle) > Math.PI / 2 ? angle + Math.PI : angle);
     // 9 px base — D-6 locks this 1 px below frame2d's existing BASE_LABEL_SIZE (10)
     const fontSize = Math.round(9 * labelScale * getSymbolScale());
     ctx.font         = `${fontSize}px ${LABEL_FONT_FAMILY}`;
     ctx.textAlign    = 'center';
     ctx.textBaseline = 'middle';
     // White halo (light) / dark halo (dark) BEFORE coloured fill
     const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
     ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)';
     ctx.lineWidth   = 3;
     ctx.lineJoin    = 'round';
     ctx.strokeText(text, 0, 0);
     ctx.fillStyle = color;
     ctx.fillText(text, 0, 0);
     ctx.restore();
   }
   ```

3. Do NOT touch `drawNodes()` (node labels), `drawNodeLabels()` (DOF-index labels), `labelText()` (BMD/SFD label backing), or `drawHaloedLabel()` (added in Task 3 for arrow/arc labels) — those have their own typography that we are NOT changing in this task. The 9 px / centroid-outward / halo change applies ONLY to `drawMemberLabel` (member force kN labels).

4. Single-member edge case: if the structure has only one member (centroid = midpoint), the dot product is zero. The code above flips when `< 0`, NOT `<= 0`, so the zero case falls through to the raw normal → no infinite-flip, label renders on the raw side. Acceptable behaviour for a degenerate 1-member case.

Justification:
- Mirror of 260522-81l Task 4 (centroid-outward) + iterations 8 (font 10→9) and 9 (offset 18→14 — already at 14 in frame2d, so no change to magnitude).
- Compute centroid ONCE per draw — cheaper than per-label.
- Halo via `strokeText` with `lineJoin: 'round'` for clean corners. Dark-mode adapts via `data-theme` attribute check (same pattern as drawHaloedLabel in Task 3).
- 9 px specifically applies to member force labels — leaves node labels and DOF labels at the existing larger sizes (visual hierarchy: structure annotations bigger than force annotations).
  </action>
  <verify>
    <automated>git diff ui/frame2d/script.js | grep -cE "_structureCentroidX|strokeText.*text, 0, 0" | xargs -I{} sh -c 'test {} -ge 2'</automated>
    Visual UAT:
    1. `git diff ui/frame2d/script.js` — expect changes confined to (a) two module-level let declarations, (b) ~6 lines added to draw() for centroid computation, (c) the body of drawMemberLabel replaced (~20 lines).
    2. Load `portal-frame.json`, solve. Confirm member force labels (kN values on each member) sit OUTSIDE the structure outline — top-chord labels above, bottom labels below, vertical-column labels to the outside.
    3. Confirm labels are 9 px (visually one notch smaller than node-id labels — the labels at node positions show their 1-indexed node number).
    4. Where labels overlap a member or grid line, confirm a white halo backing makes them readable.
    5. Switch to dark mode (toggle data-theme on root, or use whatever toggle the app provides) — confirm labels remain readable (halo now dark, fill uses the tension/compression colour which is theme-aware via cssVar).
    6. Pre-solve: build a frame, don't solve, confirm there are NO force labels (drawMembers only emits forceLabel when results exist — drawMemberLabel only runs in the labelled branch).
  </verify>
  <done>
- Module-level `_structureCentroidX` / `_structureCentroidY` exist; centroid computed once per `draw()` call.
- `drawMemberLabel` body replaced: centroid-outward perpendicular sign (`nx * fromCx + ny * fromCy < 0` → flip), white halo via `strokeText` (light) / dark halo (dark), 9 px base font scaled by `labelScale * getSymbolScale()`, 14 px offset preserved.
- No edits to `drawNodes`, `drawNodeLabels`, `labelText`, `drawHaloedLabel`, `drawForceArrow`, `drawMomentArc`, `drawReactions`.
- Dark-mode halo uses `data-theme` attribute check (same pattern as Task 3 helper).
- Pre-solve member labels render unchanged (they don't render at all pre-solve — forceLabel is null).
  </done>
</task>

<task type="auto">
  <name>Task 5: Add drawLegend() canvas-drawn legend + chkReactions checkbox in index.html + wire into draw()</name>
  <files>ui/frame2d/script.js, ui/frame2d/index.html</files>
  <action>
Final wire-up. Adds:

1. New `drawLegend()` function in `ui/frame2d/script.js` — canvas-drawn 4-row top-right card, screen-space via `ctx.setTransform(1,0,0,1,0,0)`, dark-mode-aware background, drops the Reaction row when chkReactions is unchecked.
2. New `<input id="chkReactions" checked>` in the Display card of `ui/frame2d/index.html`, between `chkLoads` and `chkDeflected`.
3. New `addEventListener('change', draw)` for chkReactions in the existing event-listener block.
4. Wire `drawLegend()` into `draw()` as the LAST call.

### Step 1 — Add drawLegend() in script.js

Place above `drawReactions()` (or anywhere in the draw-helpers cluster). Mirror truss2d's `drawLegend` from 260522-81l Task 3 + iteration 7 (Reaction-row-drops-when-chkReactions-unchecked):

```js
function drawLegend() {
  if (!results) return;   // no legend pre-solve
  const sc = getSymbolScale();
  const chkR = document.getElementById('chkReactions');
  const showReactions = !chkR || chkR.checked;   // default true if checkbox not present

  // Legend lives in SCREEN space — reset transform so pan/zoom doesn't shift it.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const fs       = Math.round(11 * sc);
  const lh       = Math.round(16 * sc);
  const swatchW  = Math.round(22 * sc);
  const padX     = Math.round(10 * sc);
  const padY     = Math.round(8 * sc);
  const gap      = Math.round(8 * sc);

  // Build rows dynamically — Reaction row hidden when chkReactions unchecked.
  const items = [
    { color: cssVar('--canvas-tension'),     label: 'Tension (+)' },
    { color: cssVar('--canvas-compression'), label: 'Compression (-)' },
    { color: cssVar('--canvas-zero'),        label: 'Near-zero' },
  ];
  if (showReactions) {
    items.push({ color: cssVar('--canvas-reaction'), label: 'Reaction' });
  }

  ctx.font = `${fs}px ${LABEL_FONT_FAMILY}`;
  let maxTextW = 0;
  items.forEach(it => { maxTextW = Math.max(maxTextW, ctx.measureText(it.label).width); });
  const boxW = padX * 2 + swatchW + gap + Math.ceil(maxTextW);
  const boxH = padY * 2 + items.length * lh;

  const margin = Math.round(10 * sc);
  const x0 = canvas.width - boxW - margin;
  const y0 = margin;

  // Card background — dark-mode aware (per CONTEXT D-1 inline-pick by data-theme)
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle   = isDark ? 'rgba(22, 26, 32, 0.88)' : 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : '#ccc';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.rect(x0, y0, boxW, boxH);
  ctx.fill();
  ctx.stroke();

  // Rows
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  const textColor  = cssVar('--canvas-label');   // theme-aware
  items.forEach((it, i) => {
    const rowY = y0 + padY + i * lh + Math.round(lh / 2);
    ctx.strokeStyle = it.color;
    ctx.fillStyle   = it.color;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(x0 + padX, rowY);
    ctx.lineTo(x0 + padX + swatchW, rowY);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.fillText(it.label, x0 + padX + swatchW + gap, rowY);
  });

  ctx.restore();
}
```

### Step 2 — Add chkReactions checkbox in index.html

In `ui/frame2d/index.html`, locate the Display card (around line 140 — `<details class="card"><summary>Display</summary>`). Inside the first `<div class="display-col">`, add a new `chkReactions` checkbox between `chkLoads` (line 147-149) and `chkDeflected` (line 150-152):

```html
<label class="checkbox-label">
  <input type="checkbox" id="chkLoads" checked> Show loads
</label>
<label class="checkbox-label">
  <input type="checkbox" id="chkReactions" checked> Show reactions
</label>
<label class="checkbox-label">
  <input type="checkbox" id="chkDeflected"> Show deflected shape
</label>
```

The `checked` attribute makes it ON by default (per CONTEXT decision 5).

### Step 3 — Wire chkReactions change → draw

In the event-listener block in script.js (around line 1618-1619 where `chkSupports.addEventListener('change', draw)` and `chkLoads.addEventListener('change', draw)` live), add immediately after:

```js
document.getElementById('chkReactions').addEventListener('change', draw);
```

### Step 4 — Wire drawLegend into draw()

In `draw()`, add a call to `drawLegend()` as the LAST line of the try block (after `drawNodeLabels`), gated on `results` only:

```js
if (results) drawLegend();
```

### Step 5 — Update drawReactions gate (replace forward-compat read)

Task 3 wired drawReactions with a forward-compatible `!chkR || chkR.checked` read. That read is now redundant — the checkbox is in the DOM. The behaviour is identical so no edit is strictly required, but optionally tighten the gate to just `chkR.checked`. Recommendation: LEAVE the `!chkR || chkR.checked` form for defensive robustness (matches truss2d's pattern from iteration 7).

Justification:
- Canvas-drawn (not HTML overlay) per CONTEXT D-1 — legend must appear in right-click-save canvas exports for calc-report screenshots.
- Screen-space via `setTransform(1,0,0,1,0,0)` — legend stays pinned to top-right at constant size regardless of pan/zoom.
- Dark-mode background (`rgba(22, 26, 32, 0.88)`) picked inline by `data-theme` attribute check (single source of truth per CONTEXT Claude's Discretion — no new tokens).
- Reaction row dynamically drops when chkReactions unchecked — legend stops advertising a colour that isn't on the canvas (mirror of 260522-81l iteration 7).
- chkReactions placed between Show loads and Show deflected shape — direct mirror of where it lives in the truss2d UI Display panel.
- `addEventListener('change', draw)` mirrors the existing chkSupports / chkLoads / chkDeflected / etc. wiring pattern.
- Legend rendered LAST in draw() so it sits on top of everything (members, arrows, deflected, diagrams).
  </action>
  <verify>
    <automated>git diff ui/frame2d/index.html ui/frame2d/script.js | grep -cE "chkReactions|function drawLegend" | xargs -I{} sh -c 'test {} -ge 3'</automated>
    Visual UAT (this is the final commit — full UAT script runs here):
    1. `git diff ui/frame2d/index.html` — expect exactly one new `<label>` block containing `id="chkReactions" checked`. No other HTML edits.
    2. `git diff ui/frame2d/script.js` — expect (a) new `drawLegend()` function, (b) one new `addEventListener('change', draw)` line, (c) one new `if (results) drawLegend();` line in draw(). No other JS edits.
    3. Build the 3 fixture frames (cantilever-beam, portal-frame, continuous-beam), solve each, confirm legend appears top-right with 4 rows (Tension blue, Compression red, Near-zero grey, Reaction orange).
    4. Toggle chkReactions OFF → reaction arrows / arcs disappear AND the legend drops to 3 rows (Reaction row gone).
    5. Pan and zoom the canvas — legend stays pinned to top-right at constant size; arrows and member thickness pan/zoom with the structure.
    6. Switch to dark mode (data-theme="dark") — legend card flips to dark background with light text; tension/compression/zero/reaction swatches all theme-correct.
    7. Right-click canvas → "Save image as…" — open PNG, confirm legend is captured in the image.
    8. Reset All — canvas clears, legend disappears, arrows disappear.
    9. Final regression: `git diff --stat` shows exactly three files modified (script.js, style.css, index.html). `pytest -q` still passes (61).
  </verify>
  <done>
- `drawLegend()` exists in script.js — 4-row top-right card, screen-space via `setTransform(1,0,0,1,0,0)`, dark-mode-aware background via `data-theme` check, Reaction row dropped when chkReactions unchecked.
- `chkReactions` checkbox exists in index.html Display card, checked by default, between chkLoads and chkDeflected.
- `addEventListener('change', draw)` wires chkReactions changes to redraw.
- `draw()` calls `drawLegend()` LAST, gated on `results` truthiness.
- Toggling chkReactions OFF: arrows/arcs disappear, legend drops to 3 rows.
- Toggling chkSupports OFF: arrows/arcs REMAIN (geometry vs solve-output split).
- Legend captured in right-click-save canvas export (canvas-drawn, not HTML overlay).
- Dark mode: legend background dark, text light, swatches theme-correct.
- `pytest -q` green (61 passing). `git diff --stat` confined to the three target files.
  </done>
</task>

</tasks>

<verification>
End-to-end visual UAT after all five tasks land. Three test fixtures cover the matrix per CONTEXT specifics:

1. Start the API server (`uvicorn api_server.app:app --reload` from `pda_project/`) and open `http://127.0.0.1:8000/ui/frame2d/index.html` (or the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`).

2. **Fixture 1 — Cantilever beam** (`cantilever-beam.json`):
   - 2 nodes, 1 beam member with downward UDL, fixed support at left, free end at right.
   - Solve. Confirm:
     - Orange Mz reaction arc appears at the fixed support, labelled with kNm value.
     - Orange Fy reaction arrow points upward (positive Y world), labelled with kN value (≈ wL).
     - No Fx reaction arrow (UDL is vertical only — Fx ≈ 0, suppressed by `|raw| < ZERO`).
     - Thickness scaling visible — single-member case, so thickness = 6 px (it's the max).
     - Member force kN label sits below the beam (centroid is at the beam midspan; for a horizontal beam the centroid-outward sign picks downward, but with only 1 member the centroid equals the midpoint and the raw normal direction is preserved — accept either side, just confirm it's NOT clipped by the beam line itself).
     - Legend top-right shows 4 rows including Reaction (orange).

3. **Fixture 2 — Portal frame** (`portal-frame.json`):
   - 4 nodes, 3 members (2 columns + 1 beam), fixed supports at both base nodes, lateral wind load at top-left node.
   - Solve. Confirm:
     - Orange Fx + Fy arrows AT BOTH supports, with apex-gap pull-back so they read as two separate triangles per node (not a diamond).
     - Orange Mz arcs AT BOTH supports, visually distinct from the moment-load arc style if any moment loads coexist (smaller, 240° span, orange not purple).
     - Member force kN labels render centroid-outward — columns fan outward (left column label to the left, right column label to the right); beam label fans upward (centroid below beam midpoint).
     - White halo on labels readable over the grid + over the structure.
     - Thickness scaling: highest |axial| member is visibly thicker than the others (likely a column or the beam depending on load).
     - chkReactions toggle OFF: reactions + Reaction legend row vanish. ON: they return.
     - chkSupports toggle OFF: support glyphs disappear, reaction arrows REMAIN.

4. **Fixture 3 — Continuous beam** (`continuous-beam.json`):
   - 3 nodes, 2 members, pinned + rollerY + rollerY supports, mid-span point load.
   - Solve. Confirm:
     - Pure Fy reaction arrows at all three supports (NO Mz arcs because none of the supports are fixed).
     - Pinned support (node 1): only Fy arrow visible IF there's no horizontal component (pinned would also produce Fx, but the load is vertical, so |Fx| < ZERO suppresses). Confirm zero-suppression is working.
     - Roller supports: single Fy arrow each.
     - Thickness scaling visible across the two spans — the more heavily loaded span draws thicker.

5. **Pan + zoom test** (any fixture):
   - Pan canvas (middle-click drag) — legend stays pinned to top-right, structure + arrows pan.
   - Zoom (mouse wheel) — legend stays at constant size, structure + arrows scale.

6. **Dark mode test** (any fixture):
   - Toggle to dark mode (data-theme="dark") — confirm:
     - Legend background flips to dark, text and swatches theme-correct.
     - Reaction arrows use dark-mode orange (`#ffb74d`) — visibly lighter than light-mode `#ef6c00`.
     - Member labels still readable (halo flips to dark `rgba(0,0,0,0.6)`).

7. **Right-click save test**:
   - Right-click canvas → "Save image as…" → open PNG → confirm legend is part of the image (this is the primary D-1 motivation).

8. **Reset All test**:
   - Click Reset All on any fixture → canvas clears, legend disappears, reaction arrows / arcs disappear, members revert to uniform 2 px thickness with default colours.

9. **Regression check**:
   - `pytest -q` from `pda_project/` → 61 passing (unchanged).
   - `git diff --stat` → exactly three files: `ui/frame2d/script.js`, `ui/frame2d/style.css`, `ui/frame2d/index.html`. Zero changes to ui/truss2d/**, solver_core/**, api_server/**, tests/**.

Negative checks (regression guard):
- Pre-solve canvas: no legend, no reaction arrows, no Mz arcs, members at uniform 2 px with default colours, drawNodeLoads still renders green Fx/Fy + purple moment loads via the refactored apex-at-node helper.
- After Reset All: same as pre-solve.
- chkSupports OFF: support glyphs hidden, reaction arrows + Mz arcs REMAIN (proves geometry/output split).
- chkReactions OFF: reaction arrows + Mz arcs hidden, Reaction row dropped from legend (proves the dynamic legend).
- chkLoads OFF: green / purple load arrows hidden, BUT orange reaction arrows REMAIN (proves load and reaction are separately gated).
- Existing BMD / SFD / Deflected overlays: render at their existing line widths, NOT pulled into thickness scaling.
- Existing pin-release circles, E/I/A override outline, bar dash style, PUREBAR diagnostic overlays: all preserved.
</verification>

<success_criteria>
- All `must_haves.truths` observable in a single UAT session across the 3 fixtures.
- `git diff --stat` confined to `ui/frame2d/script.js`, `ui/frame2d/style.css`, `ui/frame2d/index.html` (exactly 3 files).
- No edits to `ui/truss2d/**`, `solver_core/**`, `api_server/**`, `tests/**`.
- `pytest -q` still green (61 passing) at every commit boundary.
- Existing frame2d behaviour preserved at every commit boundary:
  - BMD / SFD overlays render at existing line widths
  - Bar members render dashed
  - Per-member E/I/A override renders 4 px blue outline on top of the scaled undeformed line
  - Pin-release circles render at pinLeft / pinRight ends
  - PUREBAR diagnostic overlays render in red
  - Member force labels suppressed for |F| < 1e-3
  - All theme-aware tokens read correctly in both light and dark mode
- Force-reaction colour is orange (`#ef6c00` light / `#ffb74d` dark), NOT purple. Mz reaction arcs distinguished from moment-load purple arcs by colour AND geometry (smaller, 240° span).
- Shared `drawForceArrow` helper services BOTH `drawNodeLoads` (Fx/Fy paths) AND `drawReactions` (Fx/Fy paths) — single source of truth for apex-at-node geometry.
- Shared `drawMomentArc(kind)` services BOTH moment loads (`kind='load'`) and Mz reactions (`kind='reaction'`).
- chkReactions toggle controls both reaction visibility AND legend Reaction row.
- chkSupports toggle does NOT affect reaction visibility (geometry vs solve-output split per D-3).
- Five atomic commits land in order:
  1. style.css tokens (foundation)
  2. drawMembers thickness scaling
  3. drawForceArrow + drawNodeLoads refactor + drawReactions + wire (the big architectural commit)
  4. drawMemberLabel centroid-outward + halo + 9 px
  5. drawLegend + chkReactions checkbox + wire (UI integration)
</success_criteria>

<output>
After completion, create `.planning/quick/260523-cyp-mirror-truss2d-colour-coded-analysis-out/260523-cyp-SUMMARY.md` recording:
- The 5 atomic commit hashes
- Confirmation of all `must_haves.truths` via the UAT script in `<verification>` across the 3 fixtures
- Any minor tweaks made during execution (e.g. arc-span tuning, halo lineWidth, legend padding) with rationale
- The 3 fixture JSON files saved in the quick-task directory (`cantilever-beam.json`, `portal-frame.json`, `continuous-beam.json`) for replay value
- A note on parity with truss2d: this task achieves visual parity with truss2d's analysis output, with the deliberate divergence on force-reaction colour (orange not purple) recorded as a documented break of "strict palette parity" in favour of "engineer-readable colour separation" per CONTEXT D-4 rationale
- Confirmation that pytest -q remains green (61) and that the diff is confined to exactly 3 files
- Pointer to the parent task SUMMARY for the truss2d-side context if needed
</output>
