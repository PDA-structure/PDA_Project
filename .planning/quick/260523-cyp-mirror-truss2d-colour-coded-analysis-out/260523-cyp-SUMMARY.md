---
quick_id: 260523-cyp
status: complete
mode: discuss+validate (plan-checker iteration 0 PASS with 3 non-blocking warnings)
planned: 2026-05-23 (paused pre-execution)
executed: 2026-05-23 (same-day resume)
files_modified:
  - ui/frame2d/script.js
  - ui/frame2d/index.html
  - ui/frame2d/style.css
requirements_completed:
  - 260523-cyp-D1  # Legend = canvas-drawn top-right card
  - 260523-cyp-D2  # Thickness scaling driven by axial force (later retired — see T9)
  - 260523-cyp-D3  # Reactions cover Fx, Fy AND Mz at FIXED supports
  - 260523-cyp-D4  # Force-reaction colour = orange #ef6c00 (NOT truss2d purple)
  - 260523-cyp-D5  # Refactor drawLoads + drawMoments to apex-at-node via shared helpers
  - 260523-cyp-D6  # Mirror centroid-outward + halo + 9px + 14px to drawMemberLabel
  - 260523-cyp-D7  # chkReactions toggle in Display card
parent_task: 260522-81l (truss2d colour-coded analysis output)
---

# Quick Task 260523-cyp: Mirror truss2d colour-coded enhancements to frame2d — Summary

**Status:** complete (UAT-approved 2026-05-23)

Ported the 260522-81l truss2d colour-coded analysis output enhancements (3 planned tasks + 7 UAT iterations) to `ui/frame2d/`. Same evening saw the planned port + 14 further UAT-driven iterations that took frame2d beyond truss2d — added a dedicated Axial Force Diagram (AFD) polygon overlay, per-diagram conditional sliders, per-diagram legend rows, sharpened typography, and several layered fixes for slider semantics (clamp → global cap → tanh soft-cap). Frame2d is now the more complete UI; the truss2d revert / parity refresh sits as a small future quick task.

## Plan tasks (T1–T5)

Five atomic feature commits per the locked PLAN.md (D-1..D-7):

1. **Design tokens** — `cf34c78`
   - `--canvas-reaction` orange `#ef6c00` (light), `#ffb74d` (dark)
   - `--canvas-reaction-label` darker orange for kN text
   - `--canvas-reaction-moment` same hue for the moment-reaction arc
   - Chose orange (NOT truss2d's `#7b1fa2` purple) because frame2d's existing moment-load purple `#6a1b9a` would have created a near-indistinguishable visual collision

2. **Linear thickness scaling in `drawMembers()`** — `db6caf9`
   - max|F| normalisation pass; per-member `thickness = 1.5 + 4.5 * (|F|/max|F|)`
   - Preserved bar dash, E/I/A override outline, pin-release circles, zero-suppressed labels
   - *Later retired — see T9 below*

3. **Shared `drawForceArrow` + `drawMomentArc` helpers; refactor `drawNodeLoads`; new `drawReactions`** — `3208578`
   - Apex-at-node geometry (head triangle apex at node, shaft extends OPPOSITE to force direction, 2*sc apex-gap so coincident X+Y arrows don't merge)
   - Refactored existing force + moment-load rendering through the helpers (behaviour change for force loads accepted per CONTEXT D-5; moment-load arc geometry preserved byte-identical via `kind='load'` branch)
   - New `drawReactions()` covers all five support types: `fixed` (Fx, Fy, Mz), `pinned` (Fx, Fy), `rollerX` (Fx), `rollerY` (Fy), `spring` (filters per non-null `Kx`/`Ky`/`Ktheta`)
   - Moment-reaction arc: orange, r=18*sc (vs purple r=14*sc moment-load)
   - Forward-compatible `(!chkR || chkR.checked)` gate so T5's checkbox lands without revisiting

4. **Mirror centroid-outward + halo + 9px to `drawMemberLabel`** — `ef49389`
   - Perpendicular sign now points AWAY from the structure centroid
   - White (light) / dark (dark mode) halo via `data-theme` attribute check
   - Font 10 → 9 px base (Inter Medium)

5. **`drawLegend()` + chkReactions toggle** — `9143da2`
   - 4-row canvas-drawn card in top-right (Tension / Compression / Near-zero / Reaction)
   - Screen-space via `ctx.setTransform(1,0,0,1,0,0)` so pan/zoom don't move it
   - chkReactions checkbox between Show loads and Show deflected shape

## UAT iterations (T6–T19)

Visual UAT surfaced 14 additional improvements — most beyond the original truss2d port:

6. **Scale-control UX** — `d7dfc60`
   - Slider+number combos for Deflection / BMD-SFD / Label size
   - Dropped trailing "×" from all four scale labels

7. **Label-size slider repair + Symbol size promoted to slider+number** — `dba4e3b`
   - CSS specificity bug (`.panel-label input[type="number"] { width: 100% }` was eating slider space inside Label size). Fixed via `label .scale-row input[type="number"]` selector

8. **AFD axial-force diagram** — `18369a8`
   - New chkAFD toggle + drawAFD() rendering perpendicular polygons alongside members (axial is constant per member → rectangles, not curves)
   - Tension blue / compression red, shares BMD/SFD slider at this stage
   - Drawn on negative-perp side so doesn't overlap BMD/SFD on simple beams

9. **Revert thickness scaling** — `9a12f3f`
   - With AFD now carrying magnitude visualisation, the line-thickness encoding became redundant noise. Reverted to uniform 2 px lineWidth. Colour-coding (tension blue, compression red, zero grey) preserved as at-a-glance sign read.
   - **Supersedes CONTEXT D-2** for the thickness portion (the SIGN colour-coding portion of D-2 remains)

10. **Sharpness pass 1** — `3ab3126`
    - Every label → Inter Medium (500 weight)
    - Halo → full opacity 1.0, lineJoin='round'
    - Legend card: bg 0.92→0.97 light, border #ccc→#888

11. **Per-diagram legend + sharpness pass 2** — `4cadbc2`
    - Legend rows tied to their respective toggles (chkAFD/BMD/SFD/Reactions). Empty legend → suppressed entirely.
    - Labels → 600 semibold, halo 3→4 px
    - Legend card: 600 weight rows, 2 px darker border, subtle drop shadow

12. **Conditional scale sliders + Deflected legend row** — `13d6651`
    - Deflection scale slider hidden until chkDeflected on
    - BMD/SFD scale slider hidden until any of chkBMD/SFD/AFD on
    - "Deflected shape" row (dashed orange swatch) added to legend when chkDeflected on

13. **Dedicated AFD slider + chkDiagLabels-gated member kN labels** — `29b88af`
    - AFD got its own scale slider (separate from BMD/SFD which were still bundled)
    - Member kN labels now respect chkDiagLabels (consistent with BMD/SFD value annotations — they no longer appear unconditionally after solve)

14. **Dedicated SFD slider + slider maxes 5→10** — `14b435e`
    - SFD split from BMD: `inputDiagramScale` renamed `inputBMDScale`; new `inputSFDScale` pair
    - All three diagram-scale sliders (BMD / SFD / AFD) max bumped from 5 to 10
    - Four diagram-specific scale rows: Deflection / BMD / SFD / AFD, each gated on its own toggle

15. **Suppress duplicate axial labels when AFD on** — `e624f4c`
    - With chkDiagLabels + chkAFD both on, member-line kN labels AND AFD polygon kN labels both rendered same value at different positions → suppress member-line label when chkAFD is on (AFD labels are authoritative when AFD is on, they scale with the slider)

16. **Polygon offset cap (per-point)** — `37affb3`
    - Bug: at slider=10, polygons extended ~2× minMbrLen perpendicular, punching past adjacent nodes
    - Initial fix: clampDiagOffset() helper capping per-station offset at minMbrLen
    - *Superseded by T17 — per-point clamping flattened UDL parabola peaks into table-tops*

17. **Global scaleFactor cap (UDL curvature preserved)** — `3e60138`
    - Replaced per-point clamp with a single global cap on scaleFactor — the whole diagram shrinks proportionally, peaks/troughs all preserved
    - UDL parabolas come back smooth

18. **Tanh soft-cap (slider 5..10 keeps growing)** — `776ac5f`
    - T17's hard cap meant slider past 5 had zero visual effect (dead range)
    - Soft tanh asymptote: linear up to minMbrLen knee, then asymptotes toward 1.5×minMbrLen
    - slider 5→7 = ~1.0×→1.25× minMbrLen, slider 7→10 = ~1.25×→1.38× minMbrLen (diminishing but visible)

19. **Legend readability** — `f331434`
    - Symbol size floor at 1.0 for legend → dragging Symbol size below 1.0 no longer shrinks the legend
    - Base font 11→12 px, line-height 16→17 px

## Files modified

- `ui/frame2d/script.js` — primary surface (all 19 commits touched it)
- `ui/frame2d/index.html` — chkReactions + chkAFD checkboxes, new BMD/SFD/AFD slider rows, slider+number combos for existing scales
- `ui/frame2d/style.css` — `--canvas-reaction*` tokens (light + dark), `.scale-row` flex layout

## Files NOT modified (scope contract held)

- `ui/truss2d/**` — done in 260522-81l
- `solver_core/**` — zero changes
- `api_server/**` — zero changes
- `tests/**` — zero changes
- `frame2d` existing features preserved: BMD/SFD overlays, bar dashing, E/I/A override outline, pin-release circles, member-actions table, all theme-aware tokens

## Regression checks

- `pytest -q` green throughout (61 passing — every check during execution)
- All 7 locked decisions (D1..D7) delivered
- 31 PLAN must_haves.truths observable in UAT
- Browser UAT live-iterated 2026-05-23 — sustained positive signals ("very good", "really nice", "great work") across the 14 UAT iterations

## CONTEXT decisions superseded

- **D-2 (axial force drives thickness)** — partially superseded by T9. The COLOUR-CODING portion of D-2 stands (axial sign picks tension blue vs compression red on member lines); the LINE-THICKNESS portion was retired in favour of the AFD polygon overlay introduced in T8.

## Out of scope — captured as future work

- **Truss2d revert / parity refresh** — frame2d now has features truss2d does not (AFD overlay, conditional sliders, sharpened labels, per-diagram legend rows). Decision deferred: either retire truss2d thickness scaling and add a truss-AFD overlay, OR leave truss2d as-is since it's axial-only and thickness still uniquely encodes magnitude there
- **Cap-tuning** — `headroom = 0.5 * minMbrLen` (asymptote at 1.5× minMbrLen) is a sensible default but user-tunable if needed
- **Number-box max** — diagram-scale number boxes have no max so users can still type 50/100 manually; soft-cap limits visual impact, not numeric input
- All deferred items from 260522-81l (load combos, split T/C tables, deflection feedback loop, analysis-folder export) remain as future quick tasks per seed `truss-analysis-export-richness.md`

## Commit log

```
cf34c78  feat       --canvas-reaction* design tokens (light + dark)
db6caf9  feat       linear thickness scaling in drawMembers
3208578  feat       shared drawForceArrow + drawMomentArc; refactor + drawReactions
ef49389  fix        mirror truss2d label decongestion to drawMemberLabel
9143da2  feat       drawLegend + chkReactions toggle
d7dfc60  feat       slider+number combos for scale inputs
dba4e3b  fix        repair Label size slider; promote Symbol size to slider+number
18369a8  feat       AFD axial-force diagram (parity with BMD/SFD)
9a12f3f  revert     drop member thickness scaling — AFD owns magnitude
3ab3126  style      sharpen labels (Inter Medium) + crisper legend card
4cadbc2  feat       per-diagram legend rows + further label/box sharpness
13d6651  feat       conditional scale sliders + Deflected legend row
29b88af  feat       dedicated AFD scale slider + member kN labels gated on chkDiagLabels
14b435e  feat       dedicated SFD scale slider + diagram-scale maxes 5→10
e624f4c  fix        suppress duplicate axial labels when AFD on
37affb3  fix        clamp polygon offsets at minMbrLen (per-point — superseded)
3e60138  fix        global scaleFactor cap (UDL curvature preserved)
776ac5f  fix        tanh soft-cap — slider 5..10 keeps growing
f331434  style      legend readability — Symbol size floor + bump base font
<docs>   docs       SUMMARY + STATE row + closeout
```
