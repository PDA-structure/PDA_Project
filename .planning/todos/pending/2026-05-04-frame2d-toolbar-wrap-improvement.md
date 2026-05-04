---
created: 2026-05-04T20:15:00.000Z
title: frame2d horizontal toolbar — improve wrap behaviour on window resize
area: ui
priority: medium
files:
  - ui/frame2d/style.css
related:
  - .planning/quick/260504-rs3-frame2d-ui-followup-3-horizontal-toolbar/260504-rs3-PLAN.md
  - .planning/quick/260504-rs3-frame2d-ui-followup-3-horizontal-toolbar/260504-rs3-SUMMARY.md
---

## Problem

The rs3 spike (2026-05-04) flipped the frame2d panel from a vertical left rail to a horizontal wrap-row toolbar above the canvas. UAT-approved on 2026-05-04 — "looks already better" — but the user flagged that the wrap behaviour on window resize "may need to be improved at some point".

The spike intentionally shipped with no media queries, no breakpoints, no toolbar-collapse JS. `.panel` uses plain `flex-wrap: wrap` and each `.card` has `flex: 0 1 auto; min-width: 180px`. At intermediate viewport widths, cards reflow to 2-3 rows. At very narrow widths, `overflow-x: auto` on `.panel` adds a horizontal scrollbar.

What the user is asking for is harder than it looks: 12 cards (10 collapsible + Reset View + SOLVE) is a lot for a horizontal toolbar. Even when collapsed, that's ~12 chevron-pills × ~180px min-width = ~2160px before wrap. On a 1920×1080 monitor that's already 2 rows.

## Possible solutions (in rough order of complexity)

1. **Tighter min-width.** Drop `.card { min-width: 180px }` to ~140-150px so more cards fit per row at common viewport sizes. Cheapest change, may make collapsed cards look cramped.

2. **Smaller summary text in collapsed state.** The summary already uses `font-size: 11px`. Could go to 10px or use `font-size: clamp(...)` for fluid sizing. Minor.

3. **Card grouping consolidation.** Merge related cards: e.g. (Geometry + Edit) → "Build", (Node Loads + Member Loads) → "Loads", (Material Properties + Section Calculator) → "Section". Reduces card count from 10 to ~5-6, dramatically improving wrap behaviour. Higher effort — design work, not just CSS — and a behaviour change inside cards (which were locked-as-is in rs3).

4. **Responsive breakpoints.** `@media (max-width: 1280px)` collapses some cards or shrinks them. Adds CSS complexity but no JS.

5. **Icon-only collapsed mode.** When a card is closed, show just the chevron + a single emoji/icon (no text). User clicks to expand inline or in a popover. Most polished but requires JS to manage popover state — biggest scope creep.

## Recommendation

Start with **(1) + (2)** as a small CSS-only follow-up — likely 5-line change, no risk. UAT against the wrap-quality observation. If still ugly, escalate to **(3)** card consolidation as a properly-scoped quick task with its own discuss/plan loop.

Avoid (5) — it reintroduces JS for a layout problem that should be solved in CSS.

## Acceptance criteria

- At ~1500-1900px viewport (typical monitor), toolbar occupies ≤ 2 rows.
- At ~1100px viewport, toolbar still readable (no buttons cut off, no horizontal scroll required for normal use).
- Cards remain individually collapsible and visually consistent with the lti+nwi+rs3 token system.
- No JS changes; `script.js` byte-equality preserved.
- No card content changes (the 10 cards' inner controls are locked from nwi).

## Status

Backlog — surface when ready to revisit frame2d UI polish, OR when user explicitly asks. The current rs3 layout is functional; this is polish, not a blocker.
