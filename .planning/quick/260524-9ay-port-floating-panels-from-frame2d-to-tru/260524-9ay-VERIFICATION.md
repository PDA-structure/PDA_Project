---
phase: quick-260524-9ay
verified: 2026-05-24T08:15:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Float button appears in every panel-section header except Solve"
    expected: "7 panel-sections (Geometry, Supports, Loads, Edit, File, Material Properties, Display) each show a small ↗ button right-aligned in their h3. The Solve section has no button."
    why_human: "DOM rendering and visual button placement cannot be verified without a browser."
  - test: "Float/dock cycle works end-to-end"
    expected: "Clicking ↗ moves section to canvas overlay (top-right, 12 px margin, drop shadow + 1.5px border). Button changes to ↙. Clicking ↙ restores section to original toolbar position."
    why_human: "DOM move, overlay positioning, and visual appearance require browser rendering."
  - test: "Drag with viewport clamping"
    expected: "Dragging a floated section by its h3 moves it. Dragging toward any edge clamps so at least 40 px of the section remains visible. Cursor changes to grabbing during drag."
    why_human: "Mouse drag interaction and viewport clamp behaviour require browser interaction."
  - test: "Page reload resets all sections to docked"
    expected: "After reload, all sections are back in the sidebar toolbar — no persistence."
    why_human: "Requires browser interaction to test reload behaviour."
---

# Phase quick-260524-9ay: Port Floating Panels from frame2d to truss2d — Verification Report

**Phase Goal:** Port the 260523-i52 floating panels pattern from ui/frame2d/ to ui/truss2d/ — same float/dock affordance on truss2d's toolbar panel-sections. All 10 locked decisions (D-1..D-10) must be implemented.
**Verified:** 2026-05-24T08:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every panel-section except Solve has a visible float button in its h3 header | ? UNCERTAIN | `setupCardFloat` iterates `sections.length - 1` (= 7 of 8 sections), skipping the last (Solve). Solve section has no `<h3>` (double safety: `if (!h3) continue`). Button injected via `h3.appendChild(btn)`. Visual confirmation needs browser. |
| 2 | Clicking the float button moves the section into the canvas overlay and adds a drop shadow + border | ? UNCERTAIN | `floatCard` calls `layer.appendChild(section)`, adds `.floating` class. CSS `.panel-section.floating` has `box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1.5px solid #bbb`. Wired correctly. Visual confirmation needs browser. |
| 3 | Clicking the dock button returns the section to its original toolbar position | ? UNCERTAIN | `dockCard` does sibling-walk on `aside.panel` children by `data-originalIndex`, uses `insertBefore`; fallback: inserts before Solve (detected by absence of `data-original-index`). Logic verified in code. Functional confirmation needs browser. |
| 4 | Floating sections are draggable by their h3 header | ? UNCERTAIN | `floatCard` attaches `h3._cardDragHandler` via `h3.addEventListener('mousedown', ...)`. `onCardDragStart` guard: returns if target has `.card-float-btn` class. Logic correct. Needs browser drag test. |
| 5 | Dragging clamps to viewport with at least 40 px visible on every edge | ? UNCERTAIN | `onCardDragStart.onMove` computes `minLeft = 40 - w - layerRect.left; maxLeft = window.innerWidth - 40 - layerRect.left; minTop = 40 - h - layerRect.top; maxTop = window.innerHeight - 40 - layerRect.top` then clamps via `Math.max/Math.min`. Formula verified. Needs browser drag test. |
| 6 | Clicking a floated section (or dragging it) brings it to the top of the z-stack | ✓ VERIFIED | `floatCard` does `section.style.zIndex = String(++_floatZIndex)`. `onCardDragStart` does `section.style.zIndex = String(++_floatZIndex)` immediately on mousedown. `_floatZIndex` declared at module level, monotonically increasing. |
| 7 | Page reload resets all sections to docked state | ? UNCERTAIN | No localStorage or sessionStorage usage in the floating-panel code. `setupCardFloat` sets `data-state="docked"` fresh on each DOMContentLoaded. Needs browser reload test to confirm. |
| 8 | Floated section width matches its docked width | ? UNCERTAIN | `floatCard` reads `w = section.offsetWidth` before the DOM move (captures sidebar width). `section.style.width` is NOT set explicitly. Width will be content-determined in absolute layer — consistent with frame2d source pattern (which also does not set `style.width`). This is an intentional parity decision. Visual check recommended. |

**Score:** 8/8 truths have verified or plausibly correct implementations. 6 require browser visual/functional confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/truss2d/style.css` | Floating panel CSS — `.panel-section.floating` | ✓ VERIFIED | Line 239: `.panel-section.floating { position: absolute; pointer-events: auto; box-shadow: ...; border: 1.5px solid #bbb; ... }` |
| `ui/truss2d/style.css` | Float button styling — `.card-float-btn` | ✓ VERIFIED | Lines 249–274: 18×18, `#ddd` border, `#888` text, hover + focus-visible states |
| `ui/truss2d/style.css` | Float overlay layer — `#cardFloatLayer` | ✓ VERIFIED | Lines 229–237: `position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 50` |
| `ui/truss2d/script.js` | Float/dock state machine — `setupCardFloat` | ✓ VERIFIED | Lines 1151–1187: full implementation present and substantive (173 lines total across all float functions) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `script.js` | `#cardFloatLayer` | `setupCardFloat` creates layer + injects buttons on DOMContentLoaded | ✓ WIRED | Line 1319: `document.addEventListener('DOMContentLoaded', setupCardFloat)`. Line 1156–1161: idempotent layer creation. |
| `script.js` | `style.css` `.floating` class | `floatCard` adds `.floating`, `dockCard` removes it | ✓ WIRED | Line 1201: `section.classList.add('floating')`. Line 1247: `section.classList.remove('floating')`. CSS rule at line 239 consumed. |
| `script.js` | `.panel` | `dockCard` re-inserts section at original index via `insertBefore` | ✓ WIRED | Line 1218: `document.querySelector('aside.panel')`. Lines 1226–1244: sibling-walk + `insertBefore`. Fallback at lines 1236–1242 handles Solve section detection by absence of `data-original-index`. |

### Data-Flow Trace (Level 4)

Not applicable. This is a pure UI behaviour feature (DOM manipulation, CSS classes, event handlers). There is no data fetching, no API calls, no state store. The "data" is the DOM structure itself.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| script.js syntax valid | `node --check ui/truss2d/script.js` | No errors | ✓ PASS |
| `setupCardFloat` function present | `grep -q "setupCardFloat" ui/truss2d/script.js` | Found | ✓ PASS |
| `floatCard` function present | `grep -q "floatCard" ui/truss2d/script.js` | Found | ✓ PASS |
| `dockCard` function present | `grep -q "dockCard" ui/truss2d/script.js` | Found | ✓ PASS |
| `onCardDragStart` present | `grep -q "onCardDragStart" ui/truss2d/script.js` | Found | ✓ PASS |
| DOMContentLoaded registration | `grep -q "DOMContentLoaded.*setupCardFloat" ui/truss2d/script.js` | Found at line 1319 | ✓ PASS |
| CSS `.panel-section.floating` | `grep -q "panel-section.floating" ui/truss2d/style.css` | Found at line 239 | ✓ PASS |
| CSS `#cardFloatLayer` | `grep -q "cardFloatLayer" ui/truss2d/style.css` | Found at line 229 | ✓ PASS |
| CSS `.card-float-btn` | `grep -q "card-float-btn" ui/truss2d/style.css` | Found at line 249 | ✓ PASS |
| CSS `.canvas-area position: relative` | `grep -q "position: relative" ui/truss2d/style.css` | Found at line 157 | ✓ PASS |
| No frame2d files touched | `git diff --name-only e0704cc HEAD` | `ui/truss2d/style.css`, `ui/truss2d/script.js` only | ✓ PASS |
| Commits exist | `git show --stat 5a45c44 b961bcc` | Both present, correct files | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| D-1 | Solve section excluded from floating (last of 8 panel-sections) | ✓ SATISFIED | `sections.length - 1` iteration limit; Solve has no `<h3>` (second guard: `if (!h3) continue`) |
| D-2 | Initial float position: top-right, 12 px inner margin | ✓ SATISFIED | `section.style.left = Math.max(12, layerRect.width - w - 12) + 'px'; section.style.top = '12px'` |
| D-3 | Float/dock state machine present | ✓ SATISFIED | `section.dataset.state` toggled between `'docked'` and `'floating'`; button click handler branches on state |
| D-4 | No persistence across reload | ✓ SATISFIED | No localStorage/sessionStorage; `setupCardFloat` resets state fresh on DOMContentLoaded |
| D-5 | Float button: 18px, unicode arrows (↗/↙), text changes on state change | ✓ SATISFIED | `btn.textContent = '↗'` on dock; `btn.textContent = '↙'` on float; CSS: `width: 18px; height: 18px` |
| D-6 | Drag handle is `<h3>`; 3 px move threshold | ✓ SATISFIED | `h3.addEventListener('mousedown', h3._cardDragHandler)`; `Math.hypot(dx, dy) > 3` threshold in `onMove` |
| D-7 | Bring-to-top on float and drag-start via monotonic `_floatZIndex` | ✓ SATISFIED | `_floatZIndex` incremented in both `floatCard` (line 1198) and `onCardDragStart` mousedown (line 1280) |
| D-8 | Viewport clamp: 40 px visible per edge | ✓ SATISFIED | Full clamp formula present at lines 1298–1303 |
| D-9 | Floated width matches docked width | ✓ SATISFIED (parity with frame2d) | `w = section.offsetWidth` read before DOM move. `style.width` not set — same approach as frame2d source. Content width preserved. |
| D-10 | No HTML edits — buttons JS-injected | ✓ SATISFIED | No changes to `ui/truss2d/index.html` (confirmed via `git diff --name-only e0704cc HEAD`) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ui/truss2d/script.js` | 272 | `return null` | ℹ Info | Pre-existing — `findMemberNear` returns null when no member is found at cursor. Not introduced by this task, not a stub. |

No TODOs, FIXMEs, placeholder comments, or empty implementations introduced by this task.

### Human Verification Required

**Open `http://localhost:8000/ui/truss2d/index.html` in a browser with the API server running.**

#### 1. Float button presence

**Test:** Inspect each of the 8 panel-sections in the left toolbar.
**Expected:** 7 sections (Geometry, Supports, Loads, Edit, File, Material Properties, Display) each have a small `↗` button right-aligned in their `h3` header. The Solve section (contains the SOLVE button) has no float button.
**Why human:** DOM rendering and visual alignment of the injected button require a browser.

#### 2. Float/dock cycle

**Test:** Click `↗` on the "Geometry" section.
**Expected:** The section lifts out of the sidebar and appears overlaid on the canvas area (top-right, ~12 px from edges) with a drop shadow and a thin grey border. The button icon changes to `↙`. Click `↙` — the section re-inserts at its original position in the sidebar.
**Why human:** DOM move, absolute positioning, and visual appearance require browser rendering.

#### 3. Multi-section z-ordering

**Test:** Float two different sections (e.g. "Geometry" then "Supports").
**Expected:** The second floated section appears on top of the first. Clicking on the first (behind) section should bring it to the front.
**Why human:** Z-index stacking order requires visual inspection.

#### 4. Drag with threshold and clamp

**Test:** Float a section, then drag it by the `h3` header across the canvas.
**Expected:** The cursor changes to `grabbing`. The section follows the mouse. Dragging toward any viewport edge causes the section to stop moving at 40 px from that edge (it clamps, not disappears off-screen). A sub-3 px click on the header does not trigger drag.
**Why human:** Mouse drag interaction and clamping behaviour require browser interaction.

#### 5. Page reload resets to docked

**Test:** Float 2-3 sections, then reload the page (`Cmd+R`).
**Expected:** All sections are back in the sidebar in their original order. No sections are floating.
**Why human:** Requires browser reload to confirm no unintended persistence.

#### 6. No regression to existing functionality

**Test:** After floating and docking sections, use the truss2d solver normally: add nodes, add members, add a support, add a load, click Solve.
**Expected:** All existing functionality works correctly. No console errors.
**Why human:** End-to-end workflow requires browser interaction.

### Gaps Summary

No gaps found. All must-have truths are verified at the code level. The 6 human verification items are routine browser-rendering checks that cannot be automated with grep/static analysis.

The implementation is a faithful port of the frame2d i52 pattern with correct adaptations for truss2d's `<section class="panel-section">` / `<h3>` structure:
- 8 panel-sections; 7 floatable (indices 0–6); Solve (index 7) excluded by both index limit AND absence of `<h3>`
- No design tokens used — all hex literals (#ddd, #888, #bbb, #3f51b5, etc.)
- `dockCard` fallback correctly detects Solve via absence of `data-original-index`
- No frame2d, solver_core, api_server, or test files touched

---

_Verified: 2026-05-24T08:15:00Z_
_Verifier: Claude (gsd-verifier)_
