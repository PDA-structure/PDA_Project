---
phase: 260529-7hw-modernise-frame2d-self-weight-checkbox-i
plan: 01
subsystem: ui-frame2d
tags: [ui, frame2d, modernisation, toolbar-parity, spike-pattern]
requires:
  - quick-260528-vzl  # .tool-btn--spike pattern + --spike-* palette
provides:
  - Self-weight ρ toggle button replacing the last unmodernised checkbox in frame2d UI
  - .density-gated CSS pattern (reusable for future input-gating on toggle state)
  - toggleSelfWeight() + syncSelfWeightVisualState() helpers
affects:
  - ui/frame2d/index.html  (Material Properties card)
  - ui/frame2d/style.css   (additive — new .density-gated block)
  - ui/frame2d/script.js   (additive helpers + 2 invocation sites)
tech-stack:
  added: []
  patterns:
    - "Hidden-canonical-state pattern: visible `.tool-btn--spike` button drives state via a hidden `<input type=\"checkbox\">` that remains the read/write target for solve()/saveModel()/loadModelFromJson(). Zero behaviour change in solver path."
    - "Sync-helper pattern: `syncSelfWeightVisualState()` reads the hidden checkbox and reconciles button `.active` + label `.is-active` — invoked at page-load init and after Load-JSON state mutation."
key-files:
  created: []
  modified:
    - ui/frame2d/index.html
    - ui/frame2d/style.css
    - ui/frame2d/script.js
decisions:
  - "Use additive `.density-gated` CSS class rather than disabling the density input via the `disabled` attribute — preserves the existing inputDensity read/write in solve()/saveModel()/loadModelFromJson() without conditional logic, and opacity + pointer-events convey the gated state more clearly than a disabled control."
  - "Place helpers above setMode() rather than at file bottom — co-locates UI mode-related helpers; init call at file bottom (existing init block) covers page-load DOM-ready ordering since the script tag is at end of <body>."
  - "Single sync call after the if/else block in loadModelFromJson covers both branches (data.selfWeight present and absent) — cleaner than duplicating the call in each branch."
metrics:
  duration: ~15min
  completed: 2026-05-29
  files_changed: 3
  commits: 1
  tests: 70/70 green
---

# Quick 260529-7hw: Modernise frame2d Self-Weight Checkbox to ρ Toggle Button Summary

Modernised the "Include self-weight" checkbox in the frame2d Material Properties card into a `.tool-btn--spike` toggle button bearing an italic Georgia ρ (rho) glyph, with the Density input gated on the toggle's active state. Single atomic commit, zero behaviour change in solve / save / load.

## What Changed

### index.html (Material Properties card, lines 335-344)

Replaced the 6-line `<label class="checkbox-label">` + `<label>Density…` block with:

- A new `<button class="tool-btn tool-btn--spike" id="btnSelfWeight" onclick="toggleSelfWeight()">` carrying an inline SVG with an italic Georgia ρ glyph + "Self-weight" text label.
- A hidden `<input type="checkbox" id="chkSelfWeight" style="display:none" aria-hidden="true">` — same id as before, off the layout and a11y tree, but still the canonical state read by solve()/saveModel()/loadModelFromJson().
- The Density `<label>` wrapped with the new `.density-gated` class.

`id="inputDensity"`, `value="7850"`, `min="0"`, `step="50"`, and `<sup>3</sup>` are byte-identical to the pre-change form.

### style.css (additive block after `.tool-btn--spike.active:hover`, lines 342-352)

Inserted a new `.density-gated` rule:

```css
.density-gated {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.15s;
}
.density-gated.is-active {
  opacity: 1;
  pointer-events: auto;
}
```

Existing `.tool-btn--spike` block untouched — `.density-gated` rides on the same `--spike-*` palette indirectly via the button it pairs with.

### script.js

Three additive changes:

1. **Two helpers above `setMode()`** (lines 197-220):
   - `toggleSelfWeight()` — reads current `.active` class, flips it, mirrors to hidden `chkSelfWeight.checked`, toggles `.is-active` on the density label, calls `draw()`.
   - `syncSelfWeightVisualState()` — reads `chkSelfWeight.checked` and reconciles button + label visual state. Safe guards for missing DOM elements.

2. **Post-Load-JSON sync call** (line 3153, immediately after the existing `if (data.selfWeight) { … } else { … }` block) — covers both branches in one call.

3. **Page-load init call** appended to the existing bottom-of-file init block (line 3710) — runs after DOM parse since the script tag sits at end of `<body>`.

The 4 pre-existing `chkSelfWeight` read/write sites (now at lines 790/3031/3146/3150 after the upstream additions shifted line numbers) remain byte-identical to their pre-change form. The 3 `inputDensity` references (now at 791/3032/3148) also unchanged.

## Behaviour

- **At page load (self-weight off):** ρ button rendered in resting spike style (taupe-grey bg, cream ink); Density input visibly dimmed (opacity 0.4), pointer-events: none.
- **Click ρ button:** Button gains `.active` (neon-green glyph + 1.5px ring); Density input snaps to full opacity, becomes editable; canvas re-renders via `draw()`; hidden `chkSelfWeight.checked` flips to true.
- **Click ρ button again:** Reverts to inactive; Density re-dims.
- **Solve:** `solve()` reads the hidden checkbox identically to before; self-weight calculation path unchanged.
- **Save Model:** `saveModel()` emits `{ enabled, density }` under `selfWeight` identically to before.
- **Load JSON:** `loadModelFromJson` writes `chkSelfWeight.checked` from `data.selfWeight.enabled` (or `false` if missing); the new sync call immediately reconciles button + density label visual state.

## Verification

**Static grep battery:** all expected counts hit:

```
chkSelfWeight in script.js (with helpers):     8 occurrences (4 originals at lines 790/3031/3146/3150 + 2 in toggleSelfWeight/syncSelfWeightVisualState + 1 comment + 1 trailing comment)
inputDensity in script.js:                     3 occurrences (791/3032/3148)
id="btnSelfWeight" in index.html:              1
id="chkSelfWeight" in index.html:              1
id="inputDensity" in index.html:               1
function toggleSelfWeight (top-level):         1
function syncSelfWeightVisualState (top-level): 1
syncSelfWeightVisualState(); invocations:      2 (post-Load-JSON + init)
.density-gated CSS selectors:                  2 (base + .is-active)
```

**Pre-existing site preservation:** the 4 `chkSelfWeight` read/write lines and the 3 `inputDensity` read/write lines are byte-identical to the pre-change form (verified by grep + Read tool comparison).

**pytest:** 70/70 passed in 0.98s.

**Scope contract:** `git diff --name-only` returned exactly:

```
ui/frame2d/index.html
ui/frame2d/script.js
ui/frame2d/style.css
```

No touches to `ui/truss2d/`, `solver_core/`, `api_server/`, `tests/`, `visualization/`, or `notebooks/`.

## Manual Browser UAT (Pending User)

1. Reload `http://127.0.0.1:8000/ui/frame2d/index.html` (or tailnet equivalent).
2. Open Material Properties card → ρ button visible in spike style; Density input dimmed.
3. Click ρ → button activates (neon-green glyph + ring); Density brightens + editable.
4. Build a simple beam + solve → confirm self-weight included in reactions/deflection vs ρ off.
5. Save JSON, reload page, Load JSON → verify ρ button + Density visual state restored to match saved state (both ON and OFF cases).

## Deviations from Plan

None — plan executed exactly as written. Worktree base was correct; no rule 1/2/3 fixes triggered; no authentication gates; no architectural decisions needed.

The plan's verification block mentions `chkSelfWeight | wc -l` expecting 5 — actual count is 8 because the helper functions add two extra `document.getElementById('chkSelfWeight')` references (one per helper) plus two comment mentions. This is consistent with the plan's intent (helpers must reference the canonical id) and the byte-preservation of the 4 original read/write sites is independently verified.

## Commits

| # | Hash    | Message                                                         |
|---|---------|-----------------------------------------------------------------|
| 1 | d93b04f | feat(frame2d): modernise self-weight checkbox to ρ toggle button |

## Self-Check: PASSED

- ui/frame2d/index.html — FOUND
- ui/frame2d/style.css — FOUND
- ui/frame2d/script.js — FOUND
- Commit d93b04f — FOUND
- pytest 70/70 green — VERIFIED
- 4 pre-existing chkSelfWeight read/write sites byte-identical — VERIFIED
- 3 pre-existing inputDensity read/write sites byte-identical — VERIFIED
- 2 new helpers at top-level in script.js — VERIFIED
- 2 syncSelfWeightVisualState() invocations (init + post-Load-JSON) — VERIFIED
- .density-gated CSS rule (base + .is-active) — VERIFIED
- Zero touches outside ui/frame2d/ — VERIFIED
