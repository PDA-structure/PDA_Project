---
slug: frame2d-bmd-deflected-broken
status: resolved
resolution: user-error (stray node placed outside visible viewport)
trigger: "After Solve in frame2d UI, ticking 'Show deflected shape' and 'Show BMD' checkboxes does not work properly. 'Show SFD' and 'Show AFD' work correctly. User reported during UAT of toolbar-modernisation spike 260528-vzl."
created: 2026-05-28
updated: 2026-05-29
resolved: 2026-05-29
---

## Resolution

**Not a code bug.** User-confirmed 2026-05-29: an accidental stray node was placed outside the visible canvas viewport during model construction. The solver picked it up and analysed a different structure than the one the user saw on screen, so BMD/Deflected results were computed for an effectively-different geometry and did not look "correct" to the user (or didn't appear at all once the off-canvas node skewed the diagram-scaling auto-fit).

Headless reproduction failed because it built clean geometry programmatically with no stray nodes — the agent could not see what the user could not see.

This incident is **evidence in support of pending todo** `.planning/todos/pending/2026-05-23-frame2d-accidental-node-placement.md` (Add-Node mode too click-sensitive; user can drop nodes outside the visible viewport without realising). Recommended fixes from that todo (3 px click-vs-drag threshold, Esc to exit Add-Node mode, single-shot placement, visible viewport guard / off-canvas warning) would have prevented this.

Lesson for future sessions: when frame2d / truss2d diagrams "don't work" but the solver/code path is healthy, **first ask whether there's a stray node outside the visible viewport**. Cheaper than headless reproduction. Captured as feedback memory `feedback_check_stray_offcanvas_node_first`.


# Debug Session: frame2d-bmd-deflected-broken

## Symptoms

**Expected behaviour:** After clicking Solve, ticking any of the four diagram checkboxes in the Display card should toggle the corresponding overlay on the canvas and reveal its associated scale slider.

**Actual behaviour:** chkDeflected and chkBMD "do not work properly" (exact failure mode not yet pinned down — could be no render, invisible render, scale slider not appearing, toggle-off not working, or layout broken). chkSFD and chkAFD behave as expected.

**Error messages:** None reported. (drawDeflected is wrapped in try-catch that calls `showError()` — verify whether the error banner is firing silently and being missed.)

**Timeline:** Surfaced during UAT of quick task 260528-vzl (toolbar modernisation spike). Toolbar spike commits (fd2a801, 45bc5f2, d650341, 2e88dce) touched `.tool-btn--spike` class, palette tokens, `.solve-btn--spike`, and `.support-btn .support-label` only — none of these target the Display card. Most recent script.js change was `f85e2a9` (HiDPI canvas + screen-space label refactor) — likely candidate for an introduced regression.

**Reproduction:**
1. Open http://127.0.0.1:8000/ui/frame2d/index.html (dev server already running)
2. Build a simple structure (e.g. cantilever: Node at (0,0), Node at (5,0), Member between, Fixed support at first node, vertical load or UDL on member)
3. Click Solve
4. Tick each of the four Display checkboxes in isolation (untick the other three each time)
5. Observe: chkDeflected and chkBMD broken; chkSFD and chkAFD work

## Map of relevant code

- `ui/frame2d/script.js:1976-2064` — drawDeflected (wrapped in try-catch — may be swallowing an error)
- `ui/frame2d/script.js:2071-2187` — drawBMD (no try-catch)
- `ui/frame2d/script.js:2192-2325` — drawSFD (no try-catch — but works)
- `ui/frame2d/script.js:2327-2470` — drawAFD (no try-catch — but works)
- `ui/frame2d/script.js:967-970` — draw() dispatch order: BMD → SFD → AFD → Deflected
- `ui/frame2d/script.js:2472-2475` — change listeners on the four checkboxes
- `ui/frame2d/script.js:2486-2503` — updateScaleVisibility() toggles deflectionScaleLabel / bmdScaleLabel / sfdScaleLabel / afdScaleLabel
- `ui/frame2d/script.js:2518-2521` — syncScaleControls for inputScale / inputBMDScale / inputSFDScale / inputAFDScale
- `ui/frame2d/index.html:396-405` — the four checkboxes
- `ui/frame2d/index.html:414-437` — the four scale-label blocks
- `ui/frame2d/index.html:917-920` — solve() enables chkBMD / chkSFD / chkAFD post-solve

## Hypothesis space

H1. **drawDeflected swallowed error** — try-catch on lines 1977/2060-2063 catches and re-throws after `showError()`. If error banner is dismissed/missed and the catch path is hit, user sees "nothing happens".

H2. **inputScale or inputBMDScale id mismatch** — only Deflection and BMD use these specific ids; if either is mistyped or missing, parseFloat returns NaN → scale=0 → diagram has zero magnitude → invisible. SFD/AFD use inputSFDScale/inputAFDScale which work.

H3. **Pre-existing regression from HiDPI commit f85e2a9** — screen-space label refactor may have rewritten only SFD/AFD label paths cleanly and left BMD/Deflected calling stale APIs.

H4. **chkSelfWeight or solver-side issue** — moments/UG missing in results when self-weight is on/off? Self-weight branch added in v1.2 might have an n_mbr+1 indexing issue.

H5. **Layout regression hiding scale labels** — our toolbar spike CSS doesn't target the Display card, but verify the scale labels still become visible.

H6. **chkDiagLabels checkbox retirement** (per STATE.md 260523-i52 UAT-surfaced fix `6550a5e`) — diagram annotations now render unconditionally; if BMD/Deflected weren't fully migrated they may try to read the retired checkbox and throw on `null.checked`.

## Current Focus

hypothesis: (none — all six hypotheses eliminated under headless reproduction; awaiting user clarification on exact failure mode)
test: re-run with user-supplied repro (specific model file or exact click sequence) to capture the failure they're seeing
expecting: specific user-reproducible failure mode — likely device-specific (devicePixelRatio≠1, theme, viewport size) or model-specific (load type, member orientation, support combination)
next_action: hand back to user with the questions in "Inconclusive — questions for user" below; user provides answers, then resume

## Evidence

- timestamp: 2026-05-29
  H6 grep: `grep -n chkDiagLabels ui/frame2d/script.js` returns only two comment lines (`script.js:2134` and `:2245`) that explicitly note the checkbox was retired. **No live `getElementById('chkDiagLabels')` calls remain.** H6 eliminated.
- timestamp: 2026-05-29
  HTML inventory: all four checkboxes present and well-formed (`index.html:396-405`). All four scale-label blocks present with unique IDs `deflectionScaleLabel/bmdScaleLabel/sfdScaleLabel/afdScaleLabel` (`index.html:414-437`). All four scale-input IDs (`inputScale`, `inputBMDScale`, `inputSFDScale`, `inputAFDScale`) are unique — `grep -c` returns 4 matches in `index.html`. Layout regression H5 eliminated.
- timestamp: 2026-05-29
  Solver verified via direct curl POST to `/solve/frame2d` for cantilever (5 m, fixed at node 1, tip load -1 kN at node 2): returns valid `UG`, `member_moments=[[-5000,0]]`, `member_shears=[[1000,-1000]]`, `member_forces=[[0,-0]]`. Solver path healthy; H4 eliminated.
- timestamp: 2026-05-29
  Headless Chrome (148.0.7778.179) reproduction at `127.0.0.1:9223`. Programmatically built cantilever (E=200 GPa, I=10000 cm⁴, UDL=5 kN/m downward, tip load 2 kN downward), ran solve(), then ticked each diagram checkbox in isolation. All four checkboxes toggle their respective `*ScaleLabel` displays correctly (display=='' when on, 'none' when off). No JS errors caught by window.onerror or unhandledrejection handlers. Error banner stays hidden. H1 (swallowed error) eliminated.
- timestamp: 2026-05-29
  Pixel-level diff: captured `canvas.toDataURL('image/png')` for each checkbox state. **chkBMD renders a parabolic moment polygon above the beam axis** (Mi=-62.5 kNm contour at x=100, M=0 at x=200, smooth quadratic via UDL midspan term). **chkSFD renders a triangle below the beam** (Vi=25 kN linearly tapering to 0). **chkAFD correctly draws nothing** (max axial < 1e-10 for pure-bending case → early return at script.js:2341). **chkDeflected renders a smooth downward Hermite curve** from fixed support to free end; endpoint at scale=500 falls off-canvas (sy=625 > canvas height 450) but that is a scale-too-high artefact, not a render bug. All four diagrams functionally correct.
- timestamp: 2026-05-29
  Portal-frame verification: built 4-node portal (5 m × 4 m) with horizontal node load + UDL on top beam. All four diagrams render correctly with valid value labels.
- timestamp: 2026-05-29
  Path-trace probe (intercepted `ctx.moveTo`/`ctx.lineTo`): BMD polygon = 21 baseline points then 21 contour points with smooth quadratic offset (peak -60 px at i-end → 0 px at j-end, matching expected -62.5 kNm → 0 kNm with UDL midspan correction). Deflected polyline = 21 points smoothly curving from (100, 300) to (200, 625), matching expected δ=32.6 mm × scale 500 × ppm 20 = 326 px below baseline. Both BMD and Deflected geometry calculations are correct.
- timestamp: 2026-05-29
  HiDPI verified safe: with `devicePixelRatio=1` (headless default), `ctx.setTransform(dpr * view.scale, ...)` reduces to identity-ish; render coordinates map 1:1 to canvas pixels. H3 cannot be ruled in/out with dpr=1 but no symptom arises here.

## Eliminated

- **H1 (drawDeflected swallowed error)** — no error caught; banner stays hidden across all four ticks.
- **H2 (NaN scale → invisible diagram)** — all four `parseFloat(...) || N` fallbacks are correctly placed; `inputScale`, `inputBMDScale`, `inputSFDScale`, `inputAFDScale` are all unique element IDs and present in DOM.
- **H3 (HiDPI regression)** — at dpr=1, transform is correct; rendered curves match expected geometry. (Note: cannot test dpr=2 in headless without manual device-pixel-ratio override; if user is on Retina display and sees a bug, re-test there.)
- **H4 (solver / self-weight / shape issue)** — solver returns well-formed `UG`, `member_moments`, `member_shears`, `member_forces` for both cantilever and portal-frame cases.
- **H5 (Layout regression hiding scale labels)** — scale label display toggles correctly between '' and 'none'; toolbar spike CSS does not touch Display card.
- **H6 (chkDiagLabels orphan refs)** — comments only; no live `getElementById('chkDiagLabels')` calls.

## Inconclusive — questions for user

Headless Chrome on this Mac shows all four diagrams rendering correctly for both a cantilever and a portal-frame test case. The bug is not reproducible from the symptoms as stated. Need user input to proceed:

1. **What "does not work properly" means exactly?**
   - (a) Checkbox ticks but no diagram appears at all (canvas unchanged)?
   - (b) Diagram appears but in the wrong place / wrong sign?
   - (c) Scale slider does not appear?
   - (d) Toggling off does not remove the diagram?
   - (e) Page/canvas layout breaks?
   - (f) Console/banner error visible?

2. **Exact model that triggers it?** Save the broken model via the Save button and attach the JSON, OR provide step-by-step UI clicks (Add Node, Add Member, etc.) that reproduce.

3. **Browser + display environment?**
   - Browser + version (Safari? Chrome?)
   - Retina display? (matters for devicePixelRatio)
   - Light or dark theme?
   - Zoom level (Ctrl+0 to reset)?

4. **Does it happen on a fresh page load, or only after some specific interaction sequence?** (e.g. after Load JSON, after switching theme, after dragging a floating card)

5. **Is the dev server cache stale?** Force-reload (Cmd+Shift+R) and re-test. If the bug disappears, the cause was a cached older script.js from before the HiDPI/spike commits.

## Resolution

(populated when fix lands)
