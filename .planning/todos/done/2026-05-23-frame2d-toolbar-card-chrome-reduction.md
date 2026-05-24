# Frame2d toolbar — reduce card chrome to grow canvas vertically

**Captured:** 2026-05-23 (after 260523-i52 close-out)
**Surfaced by:** User observation post-floating-panels UAT
**Scope:** Visual density tightening on `ui/frame2d/style.css` `.card` rule

## Problem

Each toolbar card (Geometry, Support, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display) is wrapped in its own `<details class="card">` with visible chrome: background fill, 1 px border, `border-radius: var(--radius-md)`, `padding: var(--space-3)`, `margin-bottom: var(--space-3)`, `box-shadow: var(--shadow-sm)`. The cards sit in a horizontal flex-wrap row above the canvas.

Total vertical real estate consumed by chrome (per card row): roughly `--space-3` margin (12 px) + 1 px border-top + `--space-3` padding (12 px) + summary text + body + padding-bottom + border + margin. The chrome around 10 cards adds up to noticeably less canvas room than there could be.

User observation: "we can remove substantially the rectangular box surrounding the buttons geometry, support, etc — this way we can increase the canvas slightly upward".

## Suggested directions (not locked — discuss in a future quick task)

1. **Borderless cards** — drop the `border: 1px solid ...` and `box-shadow: var(--shadow-sm)` from `.card`. Visual separation between cards comes from the gap in the flex-row layout. Floated state (`.card.floating`) keeps the existing border + shadow so the lift remains visually distinct.
2. **Thinner padding** — reduce `padding: var(--space-3)` (12 px) to `padding: var(--space-2)` (8 px). Recovers ~8 px per card row.
3. **No background fill on docked cards** — drop `background: var(--color-surface)` so the toolbar reads as a flat strip rather than a row of distinct cards. Floated state keeps the surface fill so popped cards remain clearly identifiable.
4. **Reduce margin-bottom** — currently `margin-bottom: var(--space-3)` (12 px); a single-line toolbar where every card wraps at most once doesn't need this. Could go to `margin-bottom: 0` since `gap` on the flex container already handles spacing.
5. **Slim the summary header** — currently `padding: var(--space-3)` + 10 px uppercase text. Could drop padding to `var(--space-2)` and shrink to 9 px text for further savings.

## Tradeoffs to consider during the discuss phase

- **Visual hierarchy loss**: removing all card chrome makes the toolbar feel like one flat strip — could obscure the discrete sections (Geometry vs Support vs Display). Counter: the `<summary>` text alone (uppercase, letter-spaced) might be enough separator
- **Floating-panel contrast (i52)**: the `.card.floating` state currently uses `--shadow-lg` + `--color-border-hover` border to lift floated cards. If docked cards lose their border + shadow, the floated/docked visual distinction becomes more pronounced (good), but might look "too detached" for some users
- **Dark mode**: the existing card-on-bg contrast relies on the subtle border + shadow. Without them, dark-mode toolbar may look flat or low-contrast. Test in both themes
- **Click affordance**: the existing hover state on `<summary>` provides a visual cue that the card title is clickable. Without surrounding chrome, the hover may feel weaker — could compensate with stronger hover styling

## Files in scope (when this is picked up)

- `ui/frame2d/style.css` — `.card` rule, `.panel-section` rule, summary rules, `.card.floating` (preserve floating chrome)

## Related

- 260523-i52 (floating panels) — the `.card.floating` rule depends on the docked vs floated visual contrast. Slimming docked chrome ENHANCES the lift effect of floated state, so this is complementary
- 260505-u2h, 260505-tke (Display section density) — established the precedent of card-density-reduction work. This is the natural next step
- `260505-w2a` (Display 2-column wrapper) — the Display card already has a 2-column body; this todo addresses the WRAPPING card chrome, not the body layout

## Priority

Medium-low. Polish improvement, not a blocker. Pair naturally with a future visual-tightening pass after the truss2d floating-panels mirror lands.
