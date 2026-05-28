---
phase: quick-260528-vzl
plan: 01
subsystem: ui/frame2d
tags: [ui, spike, frame2d, toolbar, design-tokens, css]
requires:
  - existing .tool-btn rules in ui/frame2d/style.css (line 277 area — `display:block`, `width:100%`, padding, font-size, transitions)
  - existing setMode() in ui/frame2d/script.js — toggles `active` class on `[data-mode]` buttons (UNTOUCHED by this spike)
  - existing :root token system in ui/frame2d/style.css (lines 2–94)
provides:
  - new `--spike-*` palette tokens at :root (bg / surface / ink / accent-active / accent-primary [reserved] / accent-danger [reserved] / border)
  - new `.tool-btn--spike` modifier class (resting / :hover / :focus-visible / .active / .active:hover) — additive on top of `.tool-btn`
  - new `.spike-glyph` SVG sizing rule (16×16, color: currentColor)
  - new inline SVG markup for the Add Member button (two filled node-dots + diagonal line + "+" badge)
affects:
  - one button only — Add Member, line 27 of ui/frame2d/index.html
  - zero behavioural change — `data-mode="member"`, `onclick="setMode('member')"`, `title` preserved verbatim
tech-stack:
  added: []
  patterns:
    - "modifier class pattern (`.tool-btn--spike`) for additive, deletable spike styling"
    - "inline SVG with `fill=\"currentColor\"` / `stroke=\"currentColor\"` so colour is owned by CSS via the `color` property"
    - "`aria-hidden=\"true\"` + `focusable=\"false\"` on decorative SVG so screen readers / keyboard announce only the button's text"
    - "reserved unused tokens (`--spike-accent-primary`, `--spike-accent-danger`) defined at :root so the full proposed palette is observable in DevTools alongside the active accent"
key-files:
  created: []
  modified:
    - ui/frame2d/index.html
    - ui/frame2d/style.css
decisions:
  - "Option A active-state (accent on glyph + 1.5px ring, NO background fill change) — locked at plan time and delivered verbatim; the active-state moment is the whole point of the spike"
  - "Theme-independent spike palette (no `[data-theme=\"dark\"]` override) — intentional; the user is evaluating the palette itself, not theme adaptation"
  - "Single-button scope (Add Member only) — leaves nine other emoji buttons unchanged in the same toolbar for direct side-by-side comparison"
  - "`--spike-*` prefix (not `--color-*`) — makes the spike trivially deletable; no risk of collision with the existing design-token system"
  - "No `!important` — `.tool-btn.tool-btn--spike.active` is equal-class-count + modifier; specificity is sufficient"
metrics:
  duration: ~5 minutes
  completed: 2026-05-28
---

# Quick Task 260528-vzl: Spike Modernised Add Member Button Summary

**One-liner:** Restyled a single frame2d toolbar button (Add Member) with a new inline SVG glyph and a `--spike-*` palette (charcoal-navy / warm taupe-grey / cream ink / neon-green active accent) using an additive `.tool-btn--spike` modifier class — nine surrounding emoji buttons left intact for direct side-by-side palette evaluation.

## What Shipped

**Two-file atomic commit `fd2a801`** — `ui/frame2d/index.html` and `ui/frame2d/style.css`, +70/-1 lines.

### `ui/frame2d/style.css`

1. Appended a fenced "Spike — Add Member button (260528-vzl)" block at the end of `:root` (after `--canvas-label-size`), defining seven `--spike-*` tokens. `--spike-accent-primary` (#F5C82E) and `--spike-accent-danger` (#A8323A) are intentionally unused — they exist so the full proposed palette is observable in DevTools alongside `--spike-accent-active` (#56E892).
2. Appended a fenced "Spike modifier: .tool-btn--spike (260528-vzl)" block immediately after `.tool-btn.danger:hover` (~line 298), with five rules:
   - `.tool-btn--spike` (resting): `background: var(--spike-surface)`, `color: var(--spike-ink)`, `border: 1px solid var(--spike-border)`, `border-radius: var(--radius-sm)`, `display: inline-flex`, `align-items: center`, `gap: 6px`. Layout (`display: block` / `width: 100%` / padding / margin / text-align / font-size / font-family / transition) inherits from base `.tool-btn` — not redeclared.
   - `.tool-btn--spike .spike-glyph`: `width: 16px`, `height: 16px`, `flex: 0 0 16px`, `color: currentColor` (propagates to all SVG paths).
   - `.tool-btn--spike:hover`: lift via `box-shadow: 0 2px 6px rgba(0,0,0,0.30)` + border brightens to `rgba(234,230,216,0.24)` — background unchanged (lift, not colour swap).
   - `.tool-btn--spike:focus-visible`: `outline: 2px solid var(--spike-accent-active)`, `outline-offset: 2px`.
   - `.tool-btn--spike.active` (Option A): `background: var(--spike-surface)` (explicit — NO fill change), `color: var(--spike-accent-active)` (glyph + label both turn neon green via currentColor), `border: 1.5px solid var(--spike-accent-active)`, `box-shadow: var(--shadow-sm)`.
   - `.tool-btn--spike.active:hover`: pins background + border so the base hover rule cannot creep in.

No `!important` used. No dark-theme override block. Zero touches to existing `.tool-btn`, `.tool-btn:hover`, `.tool-btn:active`, `.tool-btn.active`, `.tool-btn.danger` rules.

### `ui/frame2d/index.html`

Replaced the Add Member button (line 27) verbatim per the plan:
- Old: `<button class="tool-btn" data-mode="member" onclick="setMode('member')" title="...">🔗 Add Member</button>`
- New: same wrapper with `class="tool-btn tool-btn--spike"` and an inline 18×18 SVG (`.spike-glyph`) containing — two filled circles (r=2.5) at (4,14) and (14,4), a 2px diagonal `<line>` between them, and a small "+" badge built from two crossed strokes centred at (15.5, 15.5). All paths use `fill="currentColor"` / `stroke="currentColor"`. `aria-hidden="true"` + `focusable="false"` so the button announces only "Add Member".
- `data-mode="member"`, `onclick="setMode('member')"`, `title="Click two nodes to connect them"` — all preserved byte-identical. Zero behavioural change.

## Verification

| Gate | Result |
| ---- | ------ |
| `git diff --name-only HEAD~1` returns exactly `ui/frame2d/index.html`, `ui/frame2d/style.css` | PASS |
| `grep -c 'tool-btn--spike' ui/frame2d/index.html` = 1 | PASS |
| `grep -c '\-\-spike-accent-active' ui/frame2d/style.css` ≥ 1 | PASS (6 occurrences) |
| `grep -c '\.tool-btn--spike\.active' ui/frame2d/style.css` ≥ 1 | PASS (2 occurrences) |
| `grep -c 'class="spike-glyph"' ui/frame2d/index.html` = 1 | PASS |
| `grep -cE 'currentColor' ui/frame2d/index.html` ≥ 4 | PASS (5 occurrences — 1 line stroke + 2 circle fills + 2 "+" strokes) |
| `grep -q '🔗 Add Member' ui/frame2d/index.html` returns no match | PASS |
| pytest | PASS — 70/70 green (suite grew beyond plan's 61/61 baseline; relevant signal is no regressions) |
| Scope contract — zero changes outside the two files | HELD |

## Scope Contract

| Surface | Touched? |
| ------- | -------- |
| `solver_core/` | No |
| `api_server/` | No |
| `tests/` | No |
| `visualization/` | No |
| `ui/truss2d/` | No |
| `ui/frame2d/script.js` | No |
| `ui/frame2d/sections.js` | No |
| `ui/frame2d/label-manager.js` | No |
| Other buttons in `ui/frame2d/index.html` | No (Add Node, Edit Node, Fixed, Pin, Roller×2, Spring, Force X, Force Y, Moment, UDL, etc. all unchanged) |
| `.tool-btn`, `.tool-btn:hover`, `.tool-btn:active`, `.tool-btn.active`, `.tool-btn.danger` rules in `style.css` | No |

## Deviations from Plan

None — plan executed exactly as written. Every must-have truth, artifact, and key-link from the frontmatter is satisfied by the single commit.

## Known Stubs

None.

## UAT Status

**Pending** — orchestrator will start the dev server and the user will UAT against the 10-step browser script in the plan's `<human-verify>` block. Follow-up decision (roll out across toolbar / iterate on glyph / iterate on palette / discard spike) will be captured by the orchestrator post-UAT.

## Commits

| Hash | Type | Message |
| ---- | ---- | ------- |
| `fd2a801` | feat | feat(frame2d-ui): spike modernised Add Member button — SVG glyph + .tool-btn--spike palette (260528-vzl) |

## Self-Check: PASSED

- `ui/frame2d/index.html` modified — FOUND
- `ui/frame2d/style.css` modified — FOUND
- Commit `fd2a801` in git log — FOUND
- 70/70 pytest green — VERIFIED
- Diff scope (2 files) — VERIFIED
- All 7 plan grep gates green — VERIFIED
