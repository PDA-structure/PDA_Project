---
phase: quick-260505-uzg
plan: 01
subsystem: ui
expected_base: 2c85ec5
tags: [frame2d, html, css, layout, canvas-real-estate]
must_haves:
  truths:
    - "All 10 toolbar cards default to closed (chevron-right) on page load"
    - "Results panel renders between toolbar and canvas, never below canvas"
    - "Results panel capped at 30vh max-height with internal scroll when overflowing"
    - "Canvas area still flex-grows to fill remaining vertical space"
    - "pytest 61/61 green"
    - "All earlier baselines preserved (sq0 contrast, tke density, u2h button sizing)"
---

# Plan 260505-uzg-01 — Canvas Real-Estate

**Goal:** Free up canvas vertical space by collapsing all toolbar cards by default and moving the results panel from below the canvas to between the toolbar and canvas.

## Tasks

### Task 1 — Close cards by default (HTML)
**File:** `ui/frame2d/index.html`
**Action:** Remove the `open` attribute from all 10 `<details class="card" open>` elements. Each becomes `<details class="card">`. User clicks a card's summary to expand; chevron transitions from right (▸) to down (▾) per the existing `nwi` chevron styling (`details[open] > summary::before { transform: rotate(90deg) }`).

### Task 2 — Relocate results panel (HTML + CSS)
**Files:** `ui/frame2d/index.html`, `ui/frame2d/style.css`
**Action:**
- Move `<div class="results-panel" id="resultsPanel">...</div>` block (4 result tables) from outside `<div class="workspace">` to INSIDE workspace, between `</aside>` (toolbar close) and `<!-- Canvas --> <main class="canvas-area">`.
- Update `.results-panel` CSS: keep `border-top: 2px solid var(--color-accent)` (visual separator from toolbar above); add `border-bottom: 1px solid var(--color-border-subtle)` (separator from canvas below); add `max-height: 30vh` + `overflow-y: auto` (caps vertical real estate, scroll internally when result tables exceed 30% of viewport); add `flex: 0 0 auto` (don't grow/shrink in flex column — content-sized).

### Task 3 — Browser UAT (checkpoint:human-verify)
**Action:** User refreshes `http://127.0.0.1:8000/ui/frame2d/index.html` (Cmd+Shift+R). Verifies:
1. All 10 cards closed by default — chevrons point right (▸) — toolbar shows just card titles
2. Click any card → it opens, chevron rotates to down (▾), buttons appear
3. Build a small frame, click SOLVE → results table appears BETWEEN toolbar and canvas (not below canvas)
4. Canvas/grid is the lowest visible element — nothing rendered below it
5. If results table is tall (4 result tables), it scrolls internally — does not push canvas off-screen
6. Light/dark theme still works; UDL/Spring panels still work; sq0+tke+u2h baselines preserved

**Done:** User replies "approved" → orchestrator writes close-out commit.

## Constraints (binding)

- Two files only — `ui/frame2d/index.html` + `ui/frame2d/style.css`
- No JS changes (existing `style.display = 'block'` show/hide on solve still works — `.results-panel` is the same element with the same id, just relocated in DOM)
- No new design tokens
- No truss2d changes
- 260505-sq0 baseline preserved (`--color-grid: #d4d8df` + `#udlPanel`/`#springPanel` token rules)
- 260505-tke baseline preserved (Display vertical-stack via `:has()`, summary 10px)
- 260505-u2h baseline preserved (`.tool-btn { font-size: 11px; padding: var(--space-1) var(--space-2) }`, `.card { min-width: 110px }`, Display label-input vertical stack)

## Tradeoffs

- **Cards closed by default** means user clicks one extra time to access frequently-used buttons (e.g., Add Node). Mitigation: native `<details>` behavior preserved — user can leave cards open after first click; state lasts until page refresh. Future: localStorage to persist last-used state (deferred — captured in `2026-05-05-frame2d-panel-ux-cheap-wins-pre-ribbon-and-999-5-prep.md` Bundle B follow-ups if desired).
- **Canvas shrinks when results visible** (results take up to 30vh). Acceptable per user's "nothing below canvas" preference. If results take too much vertical space at typical viewport sizes, drop `max-height` to 25vh or 20vh in a follow-up.
