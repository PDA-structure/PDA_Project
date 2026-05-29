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

---

## Post-UAT iterations and close-out (added 2026-05-29)

The single-button spike approved on first sight ("really good"), so it grew into a full toolbar rollout across both solver UIs. All iterations live on the same quick task per repo-established UAT-iteration pattern (cf. 260523-cyp 14 iterations, 260523-i52 3 commits + 2 follow-ups).

### Commit arc (5 commits)

| # | Hash | Scope | Description |
|---|------|-------|-------------|
| 1 | `fd2a801` | frame2d (1 button) | Original spike — Add Member button only with `.tool-btn--spike` modifier + two-dots-plus-line glyph. Side-by-side comparison with 9 surviving emoji buttons. |
| 2 | `b8c9f42` | docs | Original close-of-spike-1 docs commit (PLAN + this SUMMARY + STATE.md row + stopped_at + last_activity) — landed before iteration. |
| 3 | `45bc5f2` | frame2d (3 buttons) | Iteration 2 after UAT feedback: glyph swap to **I-beam silhouette** (engineering reference); **Solve** button gets `--spike-accent-primary` (yellow) full fill via new `.solve-btn--spike` class; **Reset All** gets `--spike-accent-danger` (burgundy) ink → fill-on-hover via new `.tool-btn--spike.danger` rule. The reserved palette tokens are now in use, `:root` comment updated to match. |
| 4 | `d650341` | frame2d (full toolbar — 25 buttons) | Rollout across every remaining toolbar button. New SVG glyphs for: Add Node (node-dot + "+"), Edit Node (node + pencil), Fixed (hatched wall + member), Pin (triangle on hatched ground), Roller Y (triangle on circle on ground), Roller X (triangle pointing at hatched wall + circle), Spring (zigzag), Force X / Force Y (load arrows), Moment (curved arrow), Edit Load (load + pencil), UDL (beam + arrow row), Edit UDL (UDL + pencil), Beam/Bar (thick ⇌ thin), Pin Left (open circle at left tip), Pin Right (mirror), Per-Member E/I/A (I-beam + sliders idiom), Undo (curved arrow), Delete (trash), Save JSON (arrow into tray), Load JSON (arrow out of tray), Export Analysis (document + fold), Reset View (fit-to-frame corner brackets). Added `.support-btn .support-label` wrapper rule so the SVG+text group stays left-aligned while `.support-tag` badge gets pushed right via flex space-between. Dropdown menu items inside Export popover intentionally skipped (different inline-styled context). |
| 5 | `2e88dce` | truss2d (full toolbar mirror — 14 buttons + Solve) | Truss2d mirror of frame2d rollout. Same `--spike-*` palette tokens added at truss2d's `:root`. Same `.tool-btn--spike` / `.solve-btn--spike` / `.tool-btn--spike.danger` / `.support-btn .support-label` rules added above truss2d's existing `.support-btn` block. Same SVG glyph set, adapted to the truss2d button subset: no Fixed, no Spring, no Member Properties (truss is pin/pin/roller, axial-only). Single Add Load button gets the vertical load arrow glyph. |

### Cumulative scope

- 39 buttons modernised total (25 frame2d + 14 truss2d)
- 4 source files touched across the run: `ui/frame2d/{index.html,style.css}`, `ui/truss2d/{index.html,style.css}`
- Zero touches to `solver_core/`, `api_server/`, `tests/`, `visualization/`, any `.js` file, or any input/checkbox/scale-row control
- Zero behaviour change — every `data-mode`, `onclick`, `id`, `title` byte-preserved
- pytest 70/70 green throughout (no regressions)

### UAT outcome

Frame2d: glyphs approved ("nice the glyphs"); I-beam silhouette confirmed as the right structural-engineering reference; palette confirmed ("looks really good"); active treatment Option A retained ("modern enough"); reserved tokens approved for rollout ("let's give it a try").

Truss2d mirror landed without UAT-surfaced regressions.

### Debug session opened and resolved as user-error

During frame2d UAT (2026-05-28), user reported: "after solve the deflection and bending moment button does not work properly, but the shear diagram and axial load is the same". A debug session was opened at `.planning/debug/frame2d-bmd-deflected-broken.md` with 6 hypotheses. Headless reproduction by gsd-debugger (Chrome DevTools Protocol at `127.0.0.1:9223`) **eliminated all 6 hypotheses**: BMD polygon renders correctly, Deflected Hermite curve renders correctly, SFD/AFD render correctly, no JS errors caught, scale-slider visibility toggles fire correctly, solver outputs healthy.

Root cause confirmed by user 2026-05-29: **stray node placed outside the visible canvas viewport** — solver analysed a different structure than the user saw on screen. Not a code bug.

Debug session moved to `.planning/debug/resolved/frame2d-bmd-deflected-broken.md` with resolution note. Incident strengthens existing pending todo `.planning/todos/pending/2026-05-23-frame2d-accidental-node-placement.md` (Add-Node click-sensitivity fix is now justified by two independent UAT incidents).

New feedback memory captured: `feedback_check_stray_offcanvas_node_first.md` — for future frame2d/truss2d "diagram looks wrong after solve" reports, first question is whether there's a stray node outside the viewport. Cheaper than headless reproduction.

### What's still future work (deferred to separate quick tasks)

- **Material Properties self-weight modernisation** — captured during this UAT as a separate `/btw` branched conversation; will land as its own quick task. Idea: promote the `chkSelfWeight` checkbox to a `.tool-btn--spike` toggle with a ρ (rho — density) glyph, and gate the density input on the toggle's active state.
- **Add-Node click-sensitivity fix** — pending todo `.planning/todos/pending/2026-05-23-frame2d-accidental-node-placement.md` is now backed by a second UAT incident; should be picked up before more solver-UI polish.
- **Frame2d toolbar background parity** — pre-existing todo from `dfbc07e` is unrelated and remains open.
- **Light-mode adaptation of `--spike-*` palette** — palette is currently dark-first; if the theme toggle is exercised, the spike buttons keep the dark palette in light mode. Either define a `[data-theme="light"]` override block or accept the dark-first design as the intent (current default).
- **Truss2d theme toggle** — truss2d's theme toggle button (`themeToggle`) is in the `<header>`, not the toolbar; left untouched and unstyled by the spike.

### Final UAT status

**APPROVED** — UAT closed 2026-05-29 with the resolved debug session. Both solver UIs at toolbar-modernisation parity.
