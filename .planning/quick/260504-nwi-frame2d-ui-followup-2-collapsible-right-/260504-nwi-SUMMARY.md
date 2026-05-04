---
phase: 260504-nwi
plan: 01
subsystem: ui
tags: [frame2d, html, css, details, summary, disclosure, accessibility, prefers-reduced-motion]

# Dependency graph
requires:
  - phase: 260504-j8m
    provides: card-based panel grouping (.panel-section), design tokens (--color-*, --space-*, --radius-md, --shadow-sm)
  - phase: 260504-lti
    provides: theme-aware --canvas-* tokens + [data-theme="dark"] overrides — chevron + hover automatically inherit dark theme via existing tokens
provides:
  - 10 collapsible left-rail cards in frame2d (Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display)
  - Native HTML5 <details>/<summary> disclosure pattern with custom Unicode chevron (▸ U+25B8)
  - prefers-reduced-motion guard for chevron rotation animation
  - .card CSS rule mirroring .panel-section so j8m card aesthetic is preserved
affects: [frame2d-ui, future-truss2d-collapsible-followup]

# Tech tracking
tech-stack:
  added: []  # Pure HTML + CSS — zero new dependencies
  patterns:
    - "Native <details>/<summary> for collapsible panels — browser handles open/close state, zero JS required"
    - "Negative-margin + matching-padding trick to extend summary click-target across full card width"
    - "Custom disclosure chevron via summary::before + details[open] > summary::before { transform: rotate(90deg) }"
    - "@media (prefers-reduced-motion: reduce) guard wrapping all chevron transitions"

key-files:
  created: []
  modified:
    - ui/frame2d/index.html (Task 1: 10 sections converted)
    - ui/frame2d/style.css (Task 2: disclosure styling)

key-decisions:
  - "Used Unicode chevron (▸ U+25B8) instead of CSS-drawn triangle — simpler, renders cleanly in Inter, matches the j8m typography aesthetic"
  - "Mirrored .panel-section rules onto a new .card selector rather than refactoring to .panel-section, .card combined — keeps the change additive and preserves the existing rules unchanged for the two surviving non-converted sections (Reset View, SOLVE)"
  - "Used negative margin + matching padding on summary to make the entire bar (full card width) clickable with hover background, per locked decision #8"
  - "Chevron colour = var(--color-fg-faint) — matches existing summary text colour, inherits dark-theme override automatically"
  - "EXPECTED_BASE captured as 7f42555 (the docs commit that landed the revised PLAN); script.js byte-equality verified against this base"

patterns-established:
  - "Pattern 1: Disclosure via <details class=\"card\" open> + <summary>{heading text}</summary> — browser handles state, zero JS"
  - "Pattern 2: Hide native disclosure markers via summary::-webkit-details-marker { display:none } + summary::marker { display:none } + summary { list-style:none }"
  - "Pattern 3: Custom chevron rotation guarded by prefers-reduced-motion media query"

requirements-completed: [QUICK-260504-nwi]

# Metrics
duration: ~4min
completed: 2026-05-04
---

# Phase 260504-nwi Plan 01: Frame2D UI Followup-2 — Collapsible Left-Rail Cards Summary

**Native <details>/<summary> disclosure pattern applied to 10 left-rail headed sections with custom Unicode chevron, smooth rotation, and prefers-reduced-motion guard — zero JavaScript added, script.js byte-identical from base.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-04T18:15:30Z
- **Completed:** 2026-05-04T18:18:59Z
- **Tasks executed:** 2 (Tasks 1 + 2 — Task 3 is a human-verify checkpoint surfaced to the user)
- **Files modified:** 2

## Accomplishments

- Converted 10 `<section class="panel-section"><h3>...</h3>...` blocks in `ui/frame2d/index.html` into native HTML5 `<details class="card" open><summary>...</summary>...` collapsibles. Sections converted: Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display.
- Added `.card` + `summary` + `summary::-webkit-details-marker` + `summary::marker` + `summary::before` + `details[open] > summary::before` + `@media (prefers-reduced-motion: reduce)` rules to `ui/frame2d/style.css` (60 net new lines, all additive — no existing rules modified).
- Two unheaded single-button sections (Reset View at line 181, SOLVE at line 185) preserved as `<section class="panel-section">` per plan inventory.
- All `<details>` carry the `open` attribute — sections default to expanded on page load, preserving current behaviour.
- `script.js` byte-identical from EXPECTED_BASE (`7f42555`) through both commits — verified by `git diff --quiet 7f42555..HEAD -- ui/frame2d/script.js` returning zero diff.

## Task Commits

Each task was committed atomically:

1. **Task 1: HTML conversion to <details>/<summary>** — `9d9bd9f` (feat)
   - 30 insertions, 30 deletions in `ui/frame2d/index.html`
   - Each conversion: `<section class="panel-section">` → `<details class="card" open>`, `<h3>X</h3>` → `<summary>X</summary>`, `</section>` → `</details>`
   - All inner content (buttons, labels, inputs, ids, onclick handlers) byte-identical
2. **Task 2: CSS disclosure styling** — `1d0bbf3` (style)
   - 60 insertions in `ui/frame2d/style.css`
   - Added `.card` rule mirroring `.panel-section`; `summary` rule with full-bleed click target via negative margin + padding; native marker hiding (`::-webkit-details-marker` + `::marker`); custom chevron via `summary::before` (Unicode ▸ U+25B8); rotation via `details[open] > summary::before { transform: rotate(90deg) }`; smooth 0.2s ease transition; `@media (prefers-reduced-motion: reduce)` guard

**Plan metadata:** (this SUMMARY commit follows)

## Files Created/Modified

- `ui/frame2d/index.html` — converted 10 headed left-rail sections from `<section class="panel-section">` to `<details class="card" open>` with `<summary>` headings; preserved 2 unheaded single-button sections unchanged
- `ui/frame2d/style.css` — added 60 lines of disclosure styling at the end of the panel-section CSS region (immediately after `.panel-section h3` rule); pure addition, no existing rules modified

## EXPECTED_BASE Captured

- **Pre-task base commit:** `7f42555` (docs(quick-260504-nwi): revise PLAN per plan-checker iteration 1, pass iteration 2)
- **script.js byte-equality verified:** `git diff --quiet 7f42555..HEAD -- ui/frame2d/script.js` returned empty (zero diff) at the end of Task 2.
- The plan's PLAN.md frontmatter referenced `1869d33` as a fallback base; the orchestrator captured the actual current pre-task base `7f42555` (which itself sits on top of `bf8e9e7`/`1869d33`). Either base produces zero script.js diff because nothing in script.js has changed since `1869d33`.

## Chevron Implementation Chosen

**Option A — Unicode chevron** (`\25B8` = ▸ U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE), per the plan's recommendation. Rationale:

- Inter font (the project's self-hosted typeface, j8m) renders ▸ cleanly at 10px.
- Single-character implementation, smaller diff than CSS-drawn triangle borders.
- Inherits text colour automatically — `color: var(--color-fg-faint)` token-aware in dark mode.
- Verifier neutral on which option is chosen (only checks for `details[open]` selector + `transform: rotate(90deg)` + marker-hiding rules + reduced-motion media query) — all satisfied by either option.

If at UAT it renders inconsistently across browsers, swapping to Option B (CSS-drawn triangle borders) is a 6-line change in `style.css`.

## Decisions Made

- **Unicode chevron over CSS-drawn triangle.** Inter renders the glyph cleanly; simpler markup; smaller diff.
- **`.card` rule duplicating `.panel-section` rather than `.panel-section, .card { ... }` shared selector.** Keeps the change additive and unblocks easy revert of either commit independently. Negligible duplication cost (6 lines).
- **Chevron colour = `var(--color-fg-faint)`.** Matches existing h3 colour for visual continuity; inherits dark-theme override (`#8a9099`) automatically.
- **Hover background = `var(--color-surface-hover)`.** Existing j8m token; auto-flips correctly in dark.
- **Negative-margin trick for full-bleed click target.** Required to honour locked decision #8 ("Summary bar is the entire click target — full width, padded, with hover state"). Margin `calc(-1 * var(--space-3))` + matching `padding: var(--space-3)` extends the click area across the entire card width; rounded top corners only (`border-radius: var(--radius-md) var(--radius-md) 0 0`) so the summary bar sits flush against card content when expanded.
- **No `[data-theme="dark"] summary::before` override added.** The chevron is already legible at `--color-fg-faint` in dark (`#8a9099` against the dark surface). If UAT reveals it's too dim, the plan calls out adding `[data-theme="dark"] summary::before { color: var(--color-fg-muted); }` as a one-line follow-up — deferred until visual inspection signals it's needed.

## Deviations from Plan

None — plan executed exactly as written.

The plan's two `<task type="auto">` blocks were prescriptive enough that no deviation rules fired. Both commits' verifier scripts passed on first run (no fix-attempts consumed). 61/61 pytest tests still green (sanity check; no Python touched).

## Self-Check: PASSED

Verified post-write:

- `ui/frame2d/index.html` — exists, contains 10 `<details class="card" open>`, 10 `<summary>`, 2 surviving `<section class="panel-section">`, single `<script src="script.js">` tag.
- `ui/frame2d/style.css` — exists, contains all required selectors: `.card`, `summary::-webkit-details-marker`, `summary::marker`, `summary::before`, `details[open] > summary::before { transform: rotate(90deg) }`, `@media (prefers-reduced-motion: reduce)` block with `transition: none`.
- Commit `9d9bd9f` exists in `git log` — Task 1 (HTML conversion).
- Commit `1d0bbf3` exists in `git log` — Task 2 (CSS disclosure styling).
- `git diff --quiet 7f42555..HEAD -- ui/frame2d/script.js` — zero diff (script.js byte-identical).
- `git diff HEAD~1..HEAD --name-only` for HEAD — only `ui/frame2d/style.css`.
- `git diff HEAD~2..HEAD~1 --name-only` for Task 1 commit — only `ui/frame2d/index.html`.

## Issues Encountered

None during execution. Worktree was initially at an unrelated `5115d1e` (v1.3 docs branch); reset to `EXPECTED_BASE=7f42555` per the orchestrator's instructions before beginning work, so both commits build directly on the revised PLAN.md.

## Next Phase Readiness

- **Task 3 (manual UAT)** is now ready for the user to run. The plan's `<how-to-verify>` script lists 13 verification steps covering: default-expanded sections, click-to-collapse independence (not-an-accordion), smooth chevron transition, prefers-reduced-motion behaviour, hover state + full-bleed click target, no default browser triangle visible, full toolbar regression smoke, cantilever solve regression, save/load JSON round-trip, theme toggle, dark-mode polish, `git diff` script.js byte-equality.
- **Truss2D follow-up (deferred):** The same `<details>/<summary>` pattern would benefit truss2d's left rail. Captured as a future quick-task; not in scope for nwi.
- **Persistence (deferred — locked decision #5):** Open/closed state intentionally not persisted to localStorage in this plan. If user requests sticky collapse state at UAT, that's a 10-line script.js followup (~1 commit, separate plan).
- **Rollback paths preserved:** Both commits are independently revertable. `git revert 1d0bbf3` reverts CSS only (falls back to browser-default disclosure triangles, collapse behaviour preserved). `git revert 9d9bd9f` (after CSS revert) returns the page to the pre-nwi static layout.

---
*Phase: 260504-nwi*
*Completed: 2026-05-04*
