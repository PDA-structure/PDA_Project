---
quick_id: 260523-cyp
status: ready_for_planning
gathered: 2026-05-23
mode: discuss+validate
parent_task: 260522-81l (truss2d colour-coded analysis output enhancements)
---

# Quick Task 260523-cyp: Mirror truss2d colour-coded analysis output to frame2d — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Task Boundary

**Mirror the truss2d enhancements that landed in 260522-81l (plus all 7 UAT iterations on top) into `ui/frame2d/`.** Frame2d already has tension/compression colour-coding via design tokens (`cssVar('--canvas-tension')` / `cssVar('--canvas-compression')`) and zero-suppressed force labels — these are NOT touched. The gap is everything else from the truss2d task plus a frame2d-specific layer for moment reactions.

**Baseline taken from truss2d (locked, NOT re-opened):**
- Linear thickness scaling: `thickness = 1.5 + 4.5 * (|F| / max|F|)` per draw
- Apex-at-node force arrows: head triangle apex at node, shaft extends OPPOSITE to force direction, label at tail outside structure
- `apexGap = 2 * sc` pull-back so coincident X+Y arrows don't merge into a diamond
- Centroid-outward perpendicular sign for member labels (top fans up, bottom fans down, diagonals outward)
- White text halo on member + arrow labels (`rgba(255,255,255,0.9)` stroke beneath fill)
- 9 px label base font with `getSymbolScale()` multiplier
- 14 px perpendicular offset on member labels
- Canvas-drawn 4-row legend in top-right card, screen-space via `ctx.setTransform(1,0,0,1,0,0)`
- `chkReactions` Display-panel toggle that also drops the legend's Reaction row when unchecked

**In scope (this quick task):**
1. Add linear thickness scaling to `drawMembers()` (preserve all existing logic: bar-dash, E/I/A override outline, pin-release circles, zero-suppressed labels)
2. New `drawForceArrow()` shared helper supporting both X/Y FORCE arrows and curved-arc MOMENT arrows
3. New `drawReactions()` covering F-reactions (Fx, Fy) at every restrained translational DOF AND M-reactions (Mz) at fixed supports
4. New `drawLegend()` canvas-drawn top-right card
5. New `chkReactions` checkbox in the Display panel
6. Mirror centroid-outward + halo + 9 px font + 14 px offset improvements in frame2d's `drawMemberLabel()`
7. Refactor existing `drawLoads()` to use the new shared `drawForceArrow()` helper (apex-at-node parity)
8. Add `--canvas-reaction` design token (light + dark mode variants) — orange `#ef6c00` light, `#ffb74d` dark
9. Apex-at-node refactor extends to `drawMoments()` (moment loads) so the canvas reads consistently across all "force at node" elements

**Out of scope (deferred to future quick tasks):**
- BMD/SFD overlay changes — existing diagrams stay as-is
- Member-actions results table — separate concern, unchanged
- Pin-release circle styling — already done, unchanged
- E/I/A override outline — already done, unchanged
- Bar member dashing — preserve as-is during thickness scaling
- Solver changes — frame2d returns FG (3n × 1) which already contains all reactions including Mz; no solver changes needed
- Load combinations, T/C split tables, deflection feedback, analysis-folder export — these are future quick tasks per seed `truss-analysis-export-richness.md`

</domain>

<decisions>
## Implementation Decisions

### 1. Force-reaction colour — **Orange `#ef6c00`**

Frame2d already uses purple `#6a1b9a` for moment LOADS (`--canvas-load-moment`). Using purple `#7b1fa2` (truss2d's reaction colour) would create a near-indistinguishable visual collision when a frame has both moment loads and non-zero reactions at adjacent nodes. Orange `#ef6c00` (Material Design deep-orange) is clearly distinct from every existing canvas hue (green loads, navy supports, purple moment-loads, blue/red member forces).

**Strict palette parity with truss2d is intentionally broken** for this reason. The two solvers don't share screens; engineer-readable colour separation wins.

**New design tokens to add (in `ui/frame2d/style.css`):**
```css
:root {
  --canvas-reaction:        #ef6c00;   /* force reactions Fx/Fy */
  --canvas-reaction-label:  #bf360c;   /* darker orange for kN text */
  --canvas-reaction-moment: #ef6c00;   /* same hue for Mz arc */
}
[data-theme="dark"] {
  --canvas-reaction:        #ffb74d;   /* lighter orange visible on dark */
  --canvas-reaction-label:  #ffcc80;
  --canvas-reaction-moment: #ffb74d;
}
```

### 2. Moment-reaction visual treatment — **Curved arrow + magnitude label**

Mz exists only at FIXED supports (pinned and roller supports don't restrain rotation). For those nodes, draw a small arc with arrowhead showing rotational direction + `'M = X kNm'` label beside it. Mirrors the existing `drawMoments()` (moment load) pattern in frame2d so the canvas reads consistently across "rotational element at node" shapes.

Arc convention:
- Positive Mz (anti-clockwise in world / mathematical convention) → arrowhead at the end of the arc rotated anti-clockwise
- Negative Mz (clockwise) → arrowhead reversed
- Radius: scales with `getSymbolScale()`, base ~18 px (smaller than moment-load arc so the two visually differ)
- Arc spans ~240° of a circle, leaving a gap at the bottom for the label
- Label sits at the bottom of the arc, outside the gap

**Visual differentiation from moment LOADS:** moment-load arc uses purple `#6a1b9a`, ~22 px radius, full 270° span. Moment-reaction arc uses orange `#ef6c00`, ~18 px radius, 240° span. Adjacent at same node = visually distinct.

### 3. Thickness scaling magnitude — **Axial force only (mirror truss2d)**

Use `|member_forces[idx]| / max(|member_forces|)` exactly like truss2d. Axial is constant per member (clean thickness, no spatial variation). Shear and moment vary along the member and are already visualised via BMD/SFD overlays. Mixing units in a single thickness rule (kN axial vs kNm moment) would be ambiguous.

Bar members (`m.type === 'bar'`) are INCLUDED in thickness scaling — they carry significant axial force and that's their entire purpose. Bar dash style (`setLineDash([6, 4])`) is preserved.

Zero-tolerance: `|F| < 1e-3` clamps to minimum 1.5 px thickness, matching truss2d behaviour and frame2d's existing zero-label-suppression threshold.

### 4. Legend placement — **Canvas-drawn top-right card**

Mirror truss2d's `drawLegend()`:
- Screen-space rendering via `ctx.setTransform(1, 0, 0, 1, 0, 0)` so pan/zoom don't move it
- Semi-transparent white card (light mode) / semi-transparent dark card (dark mode) via `cssVar('--canvas-bg')` token for background
- 4 base rows: Tension / Compression / Near-zero / Reaction
- Reaction row dynamically drops when `chkReactions` is unchecked (matching truss2d behaviour)
- Captured in right-click-save canvas exports — directly supports calc-report-screenshot use case

**Dark-mode handling:** legend background uses `rgba(0,0,0,0.6)` in dark mode, `rgba(255,255,255,0.92)` in light mode, picked via `data-theme` attribute check at draw time. Text colour uses `cssVar('--color-fg-strong')`.

### 5. chkReactions checkbox placement

Inside the existing Display card, placed between "Show loads" and "Show node labels" (or wherever the analogous truss2d position maps to in the frame2d Display card 2-column grid layout). Single toggle controls BOTH force reactions and moment reactions — no separate `chkReactionMoments` sub-toggle. Default checked.

### 6. drawLoads + drawMoments refactor — **Apex-at-node helper**

Refactor frame2d's existing `drawLoads()` to use the new shared `drawForceArrow(node, axis, value, color, label)` helper. Same apex-at-node geometry as truss2d. Mirror the apex-gap so coincident X+Y loads at a single node don't merge.

`drawMoments()` (moment loads) ALSO refactors to apex-at-node for the moment-load arc — arc apex (where arrowhead lands) sits at the node, arc body extends outward. This is a behaviour change for the existing moment-load rendering — accepted scope creep because:
- Consistent visual grammar across all force/moment elements
- Same shared helper means moment-reactions automatically get the same treatment
- User implicitly accepted apex-at-node for "all force elements" when approving 260522-81l Task 6

### 7. drawMemberLabel mirror improvements

Frame2d's `drawMemberLabel()` (line ~890) still uses the old "always above" perpendicular flip. Mirror the truss2d improvements:
- Centroid-outward perpendicular sign (compute centroid from `nodes` array)
- White halo via `ctx.strokeText` at `rgba(255,255,255,0.9)` lineWidth 3 BEFORE the fill
- 9 px base font (preserve frame2d's `labelScale` and `getSymbolScale()` multipliers and `LABEL_FONT_FAMILY` typography)
- 14 px perpendicular offset (already at 14 in frame2d — no change to magnitude)

Frame2d's labels respect dark mode via `cssVar('--canvas-label')` for fill colour. Halo stroke colour adapts to dark mode by reading `cssVar('--canvas-bg')` or hardcoded `rgba(0,0,0,0.6)` in dark mode.

### Claude's Discretion

- Exact arc-span angles for moment-reaction (240° suggested) and moment-load (existing 270°) — tune visually; can adjust during UAT
- Whether the legend includes a "Bar member" row or omits it — recommend OMIT (bar dash is a member type, not a force state — legend is force-only)
- Whether the legend includes a "Moment reaction" row distinct from "Reaction" — recommend a SINGLE "Reaction" row in the legend (orange swatch covers both arrows + arcs)
- Whether to add `--canvas-legend-bg-light` / `--canvas-legend-bg-dark` tokens or inline-pick by `data-theme` attribute — recommend inline-pick (cheaper, single source of truth)
- Whether thickness scaling applies to the BMD/SFD overlays — NO, leave overlays at their existing line widths (mirrors truss2d's "only undeformed members" rule)

</decisions>

<specifics>
## Specific Ideas

### Files in scope
- `ui/frame2d/script.js` — primary edit (drawMembers, drawMemberLabel, new drawForceArrow + drawReactions + drawLegend, refactor drawLoads + drawMoments)
- `ui/frame2d/style.css` — add `--canvas-reaction*` tokens (light + dark)
- `ui/frame2d/index.html` — add `chkReactions` checkbox in Display panel

### Files explicitly NOT in scope
- `ui/truss2d/*` — done in 260522-81l
- `solver_core/**` — no changes; frame2d returns FG with Mz already populated
- `api_server/**` — no API changes
- `tests/**` — no test changes (presentation-layer only)

### Test fixture for tomorrow's UAT
Two fixtures to cover the matrix:
1. **Cantilever beam** (fixed support, downward UDL, free end) — clean Mz reaction at the fixed support; tests moment-reaction arc + label
2. **Portal frame** (two fixed supports, lateral load) — shows F-reactions in both X and Y at both supports + Mz at both supports; tests apex-gap with three coincident elements per node
3. **Continuous beam** (3 nodes, pinned + rollerY + rollerY, mid-span point load) — shows pure F-reactions (no Mz), thickness scaling across spans

Suggest saving as `cantilever-beam.json`, `portal-frame.json`, `continuous-beam.json` in the quick-task directory.

</specifics>

<canonical_refs>
## Canonical References

### Solver sign conventions (confirmed by reading source)
- Frame2d solver returns 3n × 1 FG vector; DOF base for node i is `i * 3`, indices `[base+0, base+1, base+2]` are `[Fx, Fy, Mz]` reactions per node
- Positive FG entries are forces/moments in +X / +Y / +Mz world direction (anti-clockwise positive convention)
- `Mz > 0` = anti-clockwise reaction (counter-clockwise arrow)
- Reaction DOF mapping per support type:
  - `fixed`   → `[base+0, base+1, base+2]` (Fx, Fy, Mz)
  - `pinned`  → `[base+0, base+1]` (Fx, Fy only; rotation free)
  - `rollerX` → `[base+0]` (Fx only)
  - `rollerY` → `[base+1]` (Fy only)
  - `spring` → spring-stiffness-dependent (read from existing `renderResults` reaction logic at frame2d/script.js ~1980)

### Project conventions
- `CLAUDE.md` → "3 DOF per node: Ux, Uy, θ (in that order)"
- `CLAUDE.md` → "DOF base for node i (0-indexed): `base = i * 3 + 1` (1-based)" — JS solves use 0-based, so `base = i * 3`
- `CLAUDE.md` → "Visualization is always a leaf — may import from solver_core but never the reverse" — leaf UI change

### Driving documents
- `.planning/quick/260522-81l-add-colour-coded-tension-compression-vis/260522-81l-CONTEXT.md` — parent task context (the truss2d work this mirrors)
- `.planning/quick/260522-81l-add-colour-coded-tension-compression-vis/260522-81l-PLAN.md` — parent task plan (same structure mirrors here)
- `.planning/quick/260522-81l-add-colour-coded-tension-compression-vis/260522-81l-SUMMARY.md` — execution outcome + UAT iterations (all 7 will be mirrored into frame2d as the baseline)
- `STATE.md` rows 260504-lti (frame2d design tokens), 260505-sq0 (truss2d explicitly excluded from design-token migration) — context for why frame2d uses cssVar + truss2d uses hex

### Memory references
- `feedback_check_render_toggle_first.md` — applicable: chkReactions is a render toggle; check it first if user reports "no arrows"
- `project_2d_solver_remote_deployment_priority` — UI work is appropriate after the 260504/05 frame2d UI marathon

</canonical_refs>
