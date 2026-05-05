---
phase: quick-260505-sq0
plan: 01
subsystem: ui
tags: [frame2d, css, design-tokens, contrast, light-mode, accessibility]

# Dependency graph
requires:
  - phase: quick-260504-j8m
    provides: design-token system + light/dark theme toggle
  - phase: quick-260504-lti
    provides: --canvas-* token bridge for theme-aware canvas content
provides:
  - Darkened light-mode canvas grid (`--color-grid: #d4d8df` from `#eeeeee`) — visible against `--color-canvas-bg: #fefefe`
  - Token-driven CSS rules for `#udlPanel` and `#springPanel` containers, titles, labels, inputs, button rows, and Apply/Cancel buttons
  - Stripped-bare HTML for both floating panels (no inline `style="..."` attributes carrying hard-coded colour literals)
affects: [frame2d-ui, light-mode-contrast, theme-system, future-truss2d-tokenisation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Floating-panel container styling lives in stylesheet, not inline — sources `--color-surface`, `--color-info-border`, `--color-accent-spring-border` so dark/light theme propagates automatically"
    - "Existing `#springPanel label/input/.hint/.panel-actions` rule pattern (j8m era) extended to `#udlPanel` for parity"

key-files:
  created: []
  modified:
    - "ui/frame2d/style.css — light-mode `--color-grid` retuned + new ~80-line token-driven block for `#udlPanel`/`#springPanel` containers and buttons"
    - "ui/frame2d/index.html — both floating panels' inline-style attributes removed; new `class=\"panel-title\"` and `class=\"panel-actions\"` style hooks"

key-decisions:
  - "Truss2D explicitly out of scope: it has no design tokens (older pre-j8m stylesheet), no `#udlPanel`/`#springPanel` (frame-only features), and its grid colour lives in `script.js` line 361 (`ctx.strokeStyle = '#eee'`) which constraints forbid touching. Captured as separate larger backlog item."
  - "No new design tokens introduced — every value sourced from existing `:root` tokens that already have `[data-theme=\"dark\"]` overrides, so dark-mode picks up automatically without a regression risk."
  - "Existing `#springPanel label/input/.hint/.panel-actions` rules (lines 399-410 of style.css) left in place; new block is additive and reuses the same tokens (`--color-fg-strong`, `--color-accent-spring-border`, `--color-fg-muted`)."
  - "Light-mode `--color-grid` set to `#d4d8df` — chosen to harmonise with `--color-border-subtle: #e0e0e0` so canvas frame and gridlines aren't visually competing."

patterns-established:
  - "Floating-panel-via-id design-token pattern: `#udlPanel, #springPanel { ... var(--color-surface) ... var(--color-info-border) | var(--color-accent-spring-border) ... }` — extensible for any future modal panels."

requirements-completed: [SQ0-01, SQ0-02, SQ0-03, SQ0-04]

# Metrics
duration: 2min
completed: 2026-05-05
---

# Quick Task 260505-sq0: Light-mode Contrast Pass (frame2d UDL/Spring Panels + Canvas Grid) Summary

**Light-mode-readability fix on frame2d UI: darkened `--color-grid` (#eeeeee → #d4d8df) and migrated the UDL + Spring floating panels from hard-coded inline-style colours (#fff/#90caf9/#ce93d8/#1565c0/#6a1b9a/#555) to design-token CSS rules — no new tokens, no JS changes, dark mode untouched.**

## Performance

- **Duration:** ~2 min (CSS + HTML only — no test/solver work)
- **Started:** 2026-05-05T19:45:21Z
- **Completed:** 2026-05-05T19:47:21Z
- **Tasks:** 2 of 3 executor-completed; Task 3 (browser UAT) **pending human verification on work laptop**
- **Files modified:** 2 (`ui/frame2d/style.css`, `ui/frame2d/index.html`)

## Accomplishments

- **Canvas grid visible in light mode on a light secondary screen** — token retuned from #eeeeee (~1% luminance contrast vs `--color-canvas-bg: #fefefe`) to #d4d8df (~17% contrast), but still subtle enough to feel like a grid not a heavy mesh.
- **UDL floating panel** now sources background, border (`--color-info-border`), label colour (`--color-fg-strong`), input border (`--color-info-border`), Apply-button fill (`--color-info`), and Clear/Cancel button styling (`--color-surface-alt` + `--color-border`) entirely from tokens — picks up dark theme automatically.
- **Spring floating panel** container styling moved from inline-style to a single shared CSS rule alongside #udlPanel; existing `#springPanel label/input/.hint/.panel-actions` rules untouched (precedent already established for token-driven label/input).
- **HTML cleanup** — both panels now open with bare `<div id="udlPanel">` / `<div id="springPanel">`; six previously-inline rules dropped per panel. All `id`, `onclick`, `type`, `step`, `placeholder` attributes preserved verbatim.

## Task Commits

Each task was committed atomically against EXPECTED_BASE `a6fab29`:

1. **Task 1: Retune light-mode `--color-grid` + add `#udlPanel`/`#springPanel` container CSS rules** — `195ac08` (feat)
2. **Task 2: Strip hard-coded colours from `#udlPanel`/`#springPanel` inline styles in HTML** — `e15392f` (refactor)
3. **Task 3: Browser UAT — verify light + dark mode contrast on the work laptop** — **PENDING HUMAN UAT** (checkpoint:human-verify gate; not yet completed)

**Plan metadata commit:** _(handled by orchestrator after UAT closes — `docs(quick-260505-sq0): complete light-mode contrast pass`)_

## Diffstat (against base `a6fab29`)

```
 ui/frame2d/index.html | 48 +++++++++++++---------------
 ui/frame2d/style.css  | 88 ++++++++++++++++++++++++++++++++++++++++++++++++++-
 2 files changed, 109 insertions(+), 27 deletions(-)
```

Scope contract held:
- No `solver_core/` change
- No `api_server/` change
- No `tests/` change
- No `ui/truss2d/` change (intentionally out of scope, see below)
- No `script.js` change (constraint forbade JS edits — confirmed)
- No save/load JSON schema change
- No new design tokens introduced

## Files Created/Modified

- `ui/frame2d/style.css`
  - Line 20: `--color-grid: #eeeeee;` → `--color-grid: #d4d8df;` (light-mode only)
  - New ~80-line block between existing `#springPanel` rules (line ~410) and `[data-theme="dark"]` block (line 412 → now line ~497) covering shared `#udlPanel, #springPanel` container styling, panel-title, UDL labels/inputs, shared panel-actions, generic button base, secondary buttons (Clear/Cancel/springCancel), Apply buttons (UDL info-blue, Spring spring-purple).
- `ui/frame2d/index.html`
  - Lines 250-266: `#udlPanel` plus children — six inline-style attributes removed, two class hooks added (`panel-title`, `panel-actions`).
  - Lines 268-288: `#springPanel` plus children — eight inline-style attributes removed, two class hooks added (`panel-title`, `panel-actions`).
  - All input `id`/`type`/`step`/`placeholder` and button `id`/`onclick` attributes preserved unchanged.

## Decisions Made

- **Truss2D intentionally out of scope.** Discovery during planning showed:
  - `ui/truss2d/style.css` has NO design tokens — it is the older pre-j8m stylesheet with hard-coded hex colours throughout (`#f0f2f5`, `#1a1a2e`, etc.). There is no `--color-grid` to retune.
  - `ui/truss2d/index.html` has NO `#udlPanel` or `#springPanel` — those are frame-specific features.
  - Truss2D's canvas grid colour lives in `ui/truss2d/script.js` line 361 (`ctx.strokeStyle = '#eee'`) and the constraint "No JS changes" forbids touching it.
  - Therefore truss2d cannot be patched cosmetically without a much larger restyle. Captured as backlog follow-up below.
- **No new design tokens.** All values reused (`--color-surface`, `--color-info-border`, `--color-accent-spring-border`, `--color-fg-strong`, `--color-info`, `--color-accent-spring`, `--color-on-accent`, `--color-surface-alt`, `--color-surface-hover`, `--color-border`, `--color-border-hover`, `--color-fg`, `--color-fg-muted`, `--shadow-lg`, `--radius-md`, `--color-grid`). Dark-mode overrides for every one of these already exist at lines 414-442 — no new dark override needed.
- **Light-mode `--color-grid` value** set to `#d4d8df`. Chosen to harmonise with `--color-border-subtle: #e0e0e0` so the canvas frame and gridlines complement each other rather than fight.
- **Display:none initial state** for the panels now lives in CSS, not inline HTML. JS still toggles `style.display = 'block'` (or removes it) — that path was unchanged because inline `style.display` from JS overrides CSS, so the show/hide flow is byte-equivalent.

## Deviations from Plan

None — plan executed exactly as written. All Task 1 verify gates passed (3/3); all Task 2 verify gates passed (6/6).

## Dark-mode regression confirmation

- `--color-grid: #232932` line (dark-mode) untouched — verified by `grep -c "color-grid: #232932" ui/frame2d/style.css` returning **1**.
- All eleven design tokens used in the new CSS block already have `[data-theme="dark"]` overrides — `--color-surface`, `--color-info-border`, `--color-accent-spring-border`, `--color-fg-strong`, `--color-info`, `--color-accent-spring`, `--color-on-accent`, `--color-surface-alt`, `--color-surface-hover`, `--color-border`, `--color-border-hover`, `--color-fg`, `--color-fg-muted` (verified at lines 414-442 of style.css).
- No dark-mode-specific work was added or removed — the regression guard is structural: dark mode picks up new rule values automatically.
- Browser confirmation against the 13/13-UAT-approved dark-mode baseline pending Task 3 human UAT.

## Project-wide regression sanity

- **`pytest -q` → 61/61 passing** in 1.02s (CSS/HTML-only change, expected; the 56-baseline snapshot regression gate is unaffected).
- **No solver/adapter/engine/test/api files touched** — diff scoped to the two `ui/frame2d/` files.

## Issues Encountered

None.

## Pending Browser UAT (Task 3 — checkpoint:human-verify)

**Task 3 is a `checkpoint:human-verify` gate.** The user will run browser UAT on the WORK LAPTOP (light-mode secondary screen — the screen where the original bug was reported) per the verification script in `260505-sq0-PLAN.md` lines 422-451:

- Light-mode: canvas grid visibility, UDL panel readability (background/border/labels/inputs/Apply button/Clear+Cancel buttons), Spring panel readability (same checks + hint text + three K_x/K_y/K_θ inputs).
- Dark-mode regression guard: open both panels and confirm IDENTICAL appearance to the 13/13-UAT-approved 260504-j8m baseline.
- Functional smoke test: build a cantilever, apply UDL via panel, apply spring support via panel, run SOLVE — all should still work end-to-end (no JS regression, since `script.js` was not touched).

**Resume signal:** user types "approved" → orchestrator finalises this SUMMARY with the docs commit. If issues found → executor (or follow-up quick task) resumes from the failure point.

## User Setup Required

None — no env vars, no external services, no dependencies added.

## Next Steps / Recommended Backlog

1. **Imminent:** Browser UAT on work laptop (Task 3) — gates closure of this quick task.
2. **Backlog follow-up (much larger):** "Migrate `ui/truss2d/` to frame2d's design-token system (j8m parity for truss2d)" — would cover truss2d grid colour (currently hard-coded in script.js), panel/button/header tokenisation, light/dark theme toggle, and modal styling parity. Not a contrast pass — a full restyle. Worth pursuing only when truss2d UI sees more user attention.
3. **Already-pending follow-ups (carried from prior tasks):**
   - `2026-05-04-frame2d-toolbar-wrap-improvement.md` (rs3 follow-up — toolbar wrap on window resize).
   - 260504-nwi follow-up (a): Display section crowded — wants items stacked one-per-line with smaller text.

## Self-Check: PASSED

**Files claimed-modified verified to exist with expected changes:**

- `ui/frame2d/style.css` exists and contains both `--color-grid: #d4d8df;` (line 20) and the new `#udlPanel,\n#springPanel` shared rule.
- `ui/frame2d/index.html` exists; lines 250-288 contain bare `<div id="udlPanel">` and `<div id="springPanel">` with no hard-coded hex colours (`grep -c -E '#[0-9a-fA-F]{3,6}'` over lines 250-295 returns **0**).

**Commits claimed verified to exist on this branch:**

- `195ac08` — `git log --oneline | grep 195ac08` → FOUND
- `e15392f` — `git log --oneline | grep e15392f` → FOUND
- Both atop EXPECTED_BASE `a6fab29` (verified by `git diff --stat a6fab29..HEAD` → only `ui/frame2d/style.css` and `ui/frame2d/index.html` changed).

**Test gate:** `pytest -q` → 61 passed in 1.02s.

---
*Phase: quick-260505-sq0*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
