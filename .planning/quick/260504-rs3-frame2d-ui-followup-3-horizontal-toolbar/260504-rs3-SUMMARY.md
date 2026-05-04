---
phase: 260504-rs3
plan: 01
subsystem: ui
tags: [frame2d, css, layout, flex, horizontal-toolbar, spike]

# Dependency graph
requires:
  - phase: 260504-j8m
    provides: design tokens (--color-*, --space-*, --radius-md, --shadow-sm), card-aesthetic .panel-section base
  - phase: 260504-lti
    provides: theme-aware --canvas-* tokens + [data-theme="dark"] overrides — toolbar border-bottom inherits dark theme automatically
  - phase: 260504-nwi
    provides: 10 collapsible <details class="card" open> disclosures in frame2d/index.html (their inner content unchanged here)
provides:
  - frame2d UI rendered with horizontal wrap-row toolbar above canvas (was 210px left rail)
  - .workspace flipped from row-flow to column-flow flex container
  - .panel rewritten as full-width horizontal wrap-row toolbar with border-bottom (was border-right)
  - Shared horizontal-layout sizing rule for .card and .panel-section (flex: 0 1 auto + min-width: 180px + margin-bottom: 0)
affects: [frame2d-ui]

# Tech tracking
tech-stack:
  added: []  # Pure CSS — zero new dependencies, zero JS, zero HTML changes
  patterns:
    - "flex-direction: column on .workspace flips toolbar above canvas without HTML reorder (source order .panel→.canvas-area was already correct)"
    - "flex-wrap: wrap on toolbar = wrap is primary; overflow-x: auto = scroll fallback if content overflows even after wrap"
    - "Shared sizing rule on .card + .panel-section (flex: 0 1 auto + min-width) so both card-disclosures (nwi) and surviving non-disclosure sections (Reset View, SOLVE) sit inline in the new toolbar"
    - "min-height: 0 on flex-column parent to prevent flex children forcing the workspace taller than the viewport"

key-files:
  created: []
  modified:
    - ui/frame2d/style.css (single CSS-only commit — 20 insertions, 10 deletions)

key-decisions:
  - "EXPECTED_BASE was 77796aba48297af0c9a2abf10fac17c69a535b1e — captured by orchestrator and exported into the executor shell; verified script.js + index.html byte-equality against this hash via canonical `git diff --quiet $BASE..HEAD -- <file>` gate"
  - "Pure CSS layout flip — index.html source order (.panel before .canvas-area inside .workspace) was already correct, so HTML restructure was unnecessary; plan correctly collapsed to a single CSS commit"
  - "Padding on .panel tightened from var(--space-4) var(--space-3) to var(--space-3) — keeps the toolbar compact vertically so canvas gets more height"
  - "Cards sized via flex: 0 1 auto + min-width: 180px — content-driven width with a sane minimum, instead of stretching to full width or collapsing to text-content width"
  - "margin-bottom: 0 override on cards because .panel { gap: var(--space-2) } now handles spacing — without override, vertical wrap rows would have 12px margin + 8px gap stacking"
  - "No media queries added — the spike's purpose is to OBSERVE wrap behaviour at the user's normal viewport, not engineer around it pre-emptively"
  - "No JavaScript added, no toolbar-collapse shortcut — pure CSS; single revert restores pre-rs3 vertical-rail layout exactly"

patterns-established:
  - "Pattern: flex-direction toggle for primary layout flip — no HTML changes when source order already matches the desired visual order"
  - "Pattern: shared sizing rule for sibling card-like containers (.card + .panel-section) keeps disclosure cards and non-disclosure sections aligned in horizontal-layout flex parents"
  - "Pattern: spike commits are intentionally minimal + revertable — observe behaviour first, decide trade-offs after UAT"

requirements-completed: [QUICK-260504-rs3]

# Metrics
duration: ~5min
completed: 2026-05-04
---

# Phase 260504-rs3 Plan 01: Frame2D UI Followup-3 — Horizontal Toolbar Spike Summary

**CSS-only layout flip — flipped the frame2d left-rail panel from a 210px vertical sidebar to a horizontal wrap-row toolbar above the canvas; index.html and script.js byte-identical from EXPECTED_BASE; single revertable commit.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-04T19:03:00Z (approximate)
- **Completed:** 2026-05-04T19:08:06Z
- **Tasks executed:** 1 of 2 (Task 1 auto; Task 2 is a checkpoint:human-verify pending user UAT)
- **Files modified:** 1 (`ui/frame2d/style.css` — 20 insertions, 10 deletions)

## Accomplishments

- Flipped `.workspace` from row-flow to column-flow flex container; added `min-height: 0` defensively to prevent flex children from forcing the workspace taller than the viewport.
- Rewrote `.panel` from a 210px vertical sidebar to a full-width horizontal wrap-row toolbar:
  - `width: 210px` / `min-width: 210px` → `width: 100%` / `min-width: 0`
  - `border-right: 1px solid var(--color-border-subtle)` → `border-bottom: 1px solid var(--color-border-subtle)` (visual divider stays, repositioned)
  - `padding: var(--space-4) var(--space-3)` → `padding: var(--space-3)` (tighter — toolbar stays compact vertically)
  - `flex-direction: column` → `flex-direction: row`, ADD `flex-wrap: wrap`, ADD `align-items: flex-start`
  - `gap: var(--space-1)` → `gap: var(--space-2)` (slightly more breathing room between cards)
  - `overflow-y: auto` → `overflow-x: auto` (wrap is primary; horizontal scroll is fallback)
  - `box-shadow: var(--shadow-sm)` UNCHANGED
- Added a new shared horizontal-layout sizing rule for `.card, .panel-section`: `flex: 0 1 auto; min-width: 180px; margin-bottom: 0;` — sizes the 10 nwi disclosure cards and the 2 surviving `.panel-section` blocks (Reset View, SOLVE) consistently in the new horizontal flow.
- All other CSS rules untouched: `.canvas-area` (`flex: 1` is direction-agnostic), `canvas`, `.tool-btn`, `.support-btn`, `.solve-btn`, `.support-tag`, `.checkbox-label`, `.panel-label`, `.sec-inputs`, `#solveStatus`, `.results-panel`, `.results-grid`, `.results-table-wrap`, all `--color-*`/`--space-*`/`--radius-*`/`--shadow-*`/`--canvas-*` token definitions, the `[data-theme="dark"]` override block, summary/details disclosure CSS rules, `@font-face`, `body`/`header`/reset rules, `#springPanel`/`#udlPanel` floating-panel rules.

## Byte-Equality Invariants (both held)

- **`ui/frame2d/script.js` byte-identical** to EXPECTED_BASE `77796aba48297af0c9a2abf10fac17c69a535b1e` — verified by `git diff --quiet 77796ab..HEAD -- ui/frame2d/script.js` returning zero diff.
- **`ui/frame2d/index.html` byte-identical** to EXPECTED_BASE `77796aba48297af0c9a2abf10fac17c69a535b1e` — verified by `git diff --quiet 77796ab..HEAD -- ui/frame2d/index.html` returning zero diff.

Source order inside `.workspace` was already `.panel` → `.canvas-area` (lines 22 / 193 of index.html), so flipping `.workspace { flex-direction: column }` was sufficient to put the toolbar on top with zero HTML restructure.

## Task Commits

1. **Task 1: CSS-only layout flip** — `9ef7eaa31208473e6de42e5f527caaf1f455f6c0` (short `9ef7eaa`, type `feat`)
   - 20 insertions, 10 deletions in `ui/frame2d/style.css`
   - Single-file gate verified: only `ui/frame2d/style.css` changed in this commit.
   - Inline CSS verifier passed: `.workspace=column, .panel=row+wrap+border-bottom, .card sizing in place, old 210px/border-right removed`.

## Verifier Results (Task 1, all four gates green)

| Gate | Result |
|------|--------|
| CSS content gate (positive + negative needles in node script) | PASS |
| Single-file commit gate (`git diff HEAD~1..HEAD --name-only`) | PASS — only `ui/frame2d/style.css` |
| script.js byte-equality from EXPECTED_BASE | PASS — zero diff |
| index.html byte-equality from EXPECTED_BASE | PASS — zero diff |

Negative removal verified — none of these literal fragments remain anywhere in the rewritten `.panel` block:
- `width: 210px` — REMOVED
- `min-width: 210px` — REMOVED
- `border-right: 1px solid var(--color-border-subtle)` — REMOVED

## Deviations from Plan

None — plan executed exactly as written. The auto task's eight steps each landed verbatim:
1. `.workspace` flipped to column-flow with `min-height: 0` defensive add.
2. `.panel` rewrote per the target rule (verbatim from the plan's target).
3. New shared `.card, .panel-section` sizing rule added immediately after the `.card` rule.
4. No other rule touched.
5. `index.html` not modified.
6. `script.js` not modified.
7. No media queries added.
8. No toolbar-collapse JS added.

## Task 2 (Manual UAT, checkpoint:human-verify) — APPROVED 2026-05-04 (with note)

User reviewed the live UI and confirmed: "this is great for today, i have checked a few bits and look already better." Approved.

**Single follow-up flagged:** toolbar wrap behaviour on window resize "may need to be improved at some point" — captured as a backlog todo at `.planning/todos/pending/2026-05-04-frame2d-toolbar-wrap-improvement.md` with concrete remediation options ranked by effort (tighter min-width → smaller summary text → card grouping consolidation → media-query breakpoints → icon-only collapsed mode). Recommended next step is options 1+2 as a CSS-only follow-up; escalate to option 3 (card consolidation) if still cramped after that.

The horizontal-toolbar layout itself is a confirmed improvement over the vertical rail at the user's normal viewport. rs3 stays in main.

## Rollback

The single auto commit is the only code change for this plan. `git revert 9ef7eaa` restores the pre-rs3 layout in full — no cascading reverts needed.

## Self-Check: PASSED

- File `ui/frame2d/style.css` exists and contains all required positive needles (`flex-direction: column`, `flex-direction: row`, `flex-wrap: wrap`, `border-bottom: 1px solid`, `min-width: 180px`).
- File `ui/frame2d/style.css` no longer contains any of the forbidden negative fragments (`width: 210px`, `min-width: 210px`, `border-right: 1px solid var(--color-border-subtle)`).
- Commit `9ef7eaa` exists in `git log` on the worktree branch.
- `ui/frame2d/script.js` byte-identical to EXPECTED_BASE `77796ab` (zero-diff confirmed).
- `ui/frame2d/index.html` byte-identical to EXPECTED_BASE `77796ab` (zero-diff confirmed).
