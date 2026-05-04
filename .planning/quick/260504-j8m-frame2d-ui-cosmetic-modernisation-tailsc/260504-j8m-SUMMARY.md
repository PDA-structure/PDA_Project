---
phase: 260504-j8m
plan: 01
subsystem: ui-frame2d
tags: [ui, css, theme, typography, canvas, polish, quick-task]
status: tasks-complete-pending-uat
gsd_summary_version: 1.0
requires:
  - existing FastAPI StaticFiles mount at /ui (commit b7bb211 — already in place)
  - vanilla JS + canvas frame2d UI (no framework migration in scope)
provides:
  - Tokenised colour/spacing/radius/shadow palette in ui/frame2d/style.css
  - Light/dark theme via [data-theme="dark"] override block + manual toolbar toggle (id=themeToggle) with localStorage persistence and prefers-color-scheme fallback
  - Self-hosted Inter typography (woff2 weights 400/500/600 under ui/fonts/, served via existing /ui mount)
  - chkDiagLabels checkbox (default OFF) gating BMD/SFD numeric labels and the V=0 zero-crossing tick
  - Infinite grid in drawGrid() that follows pan/zoom indefinitely (world-space loop bounds via inverse-transform of canvas corners)
  - Card-grouped left-rail panel sections with soft shadows and breathing room
affects:
  - ui/frame2d/index.html (themeToggle button + chkDiagLabels checkbox added; no other markup change)
  - ui/frame2d/style.css (full file rewritten with token migration; zero hardcoded colour-property assignments remain)
  - ui/frame2d/script.js (theme bootstrap added near top; drawGrid() body replaced; drawBMD/drawSFD label blocks guarded; chkDiagLabels listener wired)
  - ui/fonts/Inter-{Regular,Medium,SemiBold}.woff2 (new files, shared with future truss2d mirror task)
  - NOT affected: solver_core/, api_server/, tests/, ui/truss2d/, save/load JSON format, mode-string identifiers, hit-test math, keyboard shortcuts
tech-stack:
  added:
    - Inter (OFL) self-hosted from rsms.me/inter, weights 400/500/600
  patterns:
    - CSS custom-property token system (--color-*, --space-*, --radius-*, --shadow-*, --font-*) as the single source of theme truth
    - Theme switching via dataset attribute on documentElement + CSS override selector
    - localStorage persistence with prefers-color-scheme fallback
    - World-space canvas grid via inverse-transform of viewport corners (replaces canvas-pixel loop bounds — defect-by-design once pan was added)
key-files:
  created:
    - ui/fonts/Inter-Regular.woff2
    - ui/fonts/Inter-Medium.woff2
    - ui/fonts/Inter-SemiBold.woff2
  modified:
    - ui/frame2d/style.css
    - ui/frame2d/index.html
    - ui/frame2d/script.js
decisions:
  - Token-definition blocks (:root and [data-theme="dark"]) keep raw hex literals — that is correct and necessary; the must-have rule "no hardcoded colour values in style.css" is a context-aware constraint that applies to property-value assignments, not to token definitions. Verified via context-aware node script (strips :root and [data-theme="dark"] blocks, then matches; PASS).
  - lineWidth in drawGrid scaled as 0.5 / view.scale to keep grid lines visually 0.5 px at any zoom — without this, gridlines render as a solid block when zoomed out.
  - Inline-styled colours in index.html (errorBanner, udlPanel, springPanel, Section Calculator selects) deliberately left as-is per the plan. They look slightly inconsistent in dark mode; deferred to future polish.
metrics:
  tasks_completed: 5
  tasks_total: 6  # Task 6 = checkpoint:human-verify, awaiting browser UAT
  files_created: 3
  files_modified: 3
  duration_minutes: 5
  completed_date: 2026-05-04
commits:
  - hash: 00782d6
    message: feat(quick-260504-j8m) add design tokens + self-hosted Inter typography
  - hash: d538621
    message: feat(quick-260504-j8m) light/dark theme via CSS vars + toolbar toggle
  - hash: af00755
    message: style(quick-260504-j8m) toolbar/panel/modal layout polish
  - hash: 001c0ec
    message: feat(quick-260504-j8m) toggle for BMD/SFD numeric labels
  - hash: 3407ed1
    message: feat(quick-260504-j8m) infinite grid that follows pan/zoom
---

# Phase 260504-j8m Plan 01: frame2d UI Cosmetic Modernisation Summary

Tailscale-flavoured cosmetic refresh of the frame2d browser UI: design-token system, self-hosted Inter typography, light/dark theme with a manual ☀/☾ toggle, card-grouped panels with soft shadows, plus two approved canvas-code tweaks (default-off BMD/SFD numeric label toggle and an infinite grid that follows pan/zoom).

## Objective vs. Outcome

| Plan goal | Status |
|---|---|
| 5 atomic, independently revertable commits | DONE — see commits table above |
| Self-hosted Inter under `ui/fonts/` (shared between truss2d/frame2d for future mirror) | DONE — three weights downloaded from rsms.me, verified as Web Open Font Format binaries |
| Zero hardcoded colour-property assignments in `style.css` | DONE — verified by context-aware grep that ignores `:root` and `[data-theme="dark"]` token-definition blocks |
| `[data-theme="dark"]` block with overrides for every token | DONE |
| Manual ☀/☾ toggle (id=themeToggle) with localStorage persistence + prefers-color-scheme fallback | DONE |
| chkDiagLabels checkbox (default OFF) gates BMD/SFD numeric labels + V=0 tick | DONE |
| Infinite grid in drawGrid() — no `canvas.width`/`canvas.height` as loop bounds | DONE |
| Manual UAT checkpoint (Task 6) before merge | PENDING — see "Awaiting" |
| Zero changes outside `ui/frame2d/` and `ui/fonts/` | DONE — verified via `git diff --stat` |

## What Was Built

### Commit 1 — `00782d6` feat(quick-260504-j8m): add design tokens + self-hosted Inter typography
- Added `:root` token block at top of `ui/frame2d/style.css` defining the colour palette, spacing scale (4 → 24 px), radius scale (sm/md/lg), shadow scale (sm/md/lg) and font stacks (sans/mono).
- Added three `@font-face` declarations referencing `../fonts/Inter-{Regular,Medium,SemiBold}.woff2`.
- Switched body `font-family: Arial, sans-serif` → `var(--font-sans)`.
- Downloaded official Inter 4.66 woff2 builds (111/114/114 KB) from rsms.me into `ui/fonts/`.
- No other selectors changed in this commit.

### Commit 2 — `d538621` feat(quick-260504-j8m): light/dark theme via CSS vars + toolbar toggle
- Migrated every colour-property assignment in `style.css` to a `var(--color-*)` reference (header, panel, panel-section, tool-btn light/hover/active/danger, support-tag, solve-btn, solveStatus, mode-indicator, coords, canvas, results-panel, table, results, section-calculator, springPanel).
- Added complete `[data-theme="dark"]` override block at the bottom mapping every light token to a dark-mode value.
- Added themeToggle button (☾/☀ + label) inside the Display panel-section in `index.html`.
- Added theme bootstrap in `script.js` near the top (before `const API_URL`):
  - reads `localStorage.getItem('frame2d_theme')` if available;
  - falls back to `window.matchMedia('(prefers-color-scheme: dark)')`;
  - applies via `document.documentElement.dataset.theme` BEFORE DOMContentLoaded fires (avoids flash of wrong theme);
  - inside DOMContentLoaded, syncs button label/icon and wires the click handler that flips + persists.

### Commit 3 — `af00755` style(quick-260504-j8m): toolbar/panel/modal layout polish
- Card-grouped `.panel-section`: each section now has its own surface, subtle border, `var(--radius-md)` corners, `var(--space-3)` padding and a `var(--shadow-sm)` shadow. Old `border-bottom`-only divider removed.
- Spacing pass: replaced literal px values with `var(--space-*)` tokens on `.panel`, `.tool-btn`, `.solve-btn`, `.canvas-area`, `.results-panel`, `.results-grid`, table cells, header.
- Radius pass: `--radius-sm` for buttons, `--radius-md` for solve button / canvas / panel-section.
- Shadow + transition pass: `.tool-btn` transitions background/border/box-shadow (was background only); `.tool-btn:hover` and `.active` get shadow lift; `.solve-btn` and `:hover` get sm/md shadow respectively; canvas, header, .results-panel get shadow.
- Panel background switched to `var(--color-bg)` so the white card-sections sit on the page background and pop visually.
- Mono `.coords` font now uses `var(--font-mono)` instead of bare `monospace`.

### Commit 4 — `001c0ec` feat(quick-260504-j8m): toggle for BMD/SFD numeric labels
- Added `chkDiagLabels` checkbox (default UNCHECKED) to the Display panel-section, between chkSFD and chkNodeLabels.
- Wrapped the labelling forEach in `drawBMD()` (end-moment text + UDL midspan-peak text) inside `if (document.getElementById('chkDiagLabels').checked) { ... }`. Polygon shape drawing remains unchanged.
- Wrapped the labelling forEach in `drawSFD()` (end-shear text + V=0 tick + V=0 label) inside the same flag. Polygon shape drawing remains unchanged.
- Added `getElementById('chkDiagLabels').addEventListener('change', draw)` alongside the other chk* listeners so toggling immediately re-renders.
- `setMode()` and `clearDiagramState()` deliberately untouched — default OFF is the point; no auto-tick on diagram visibility.

### Commit 5 — `3407ed1` feat(quick-260504-j8m): infinite grid that follows pan/zoom
- Replaced `drawGrid()` body. Old loop bounds were canvas-pixel space (`for x = 0; x < canvas.width`) but the active transform is the world transform (set in `draw()` line 742) — so once the user panned beyond ±canvas.width the grid walked off the visible area.
- New body inverse-transforms canvas corners through `view.scale`/`view.tx`/`view.ty` to derive the world rect, snaps each bound to the nearest GRID multiple via `Math.floor`/`Math.ceil`, and draws lines spanning the world rect.
- `lineWidth = 0.5 / view.scale` keeps gridlines visually 0.5 px at any zoom level.
- `draw()` ordering, `view` object structure, pan/zoom handlers, `toWorld()` all unchanged.

## Deviations from Plan

### Task 2 verification — context-aware re-check after first PASS attempt failed

**Found during:** Task 2 (verification gate)
**Issue:** The plan's Task 2 verifier is a flat regex over all of `style.css`: any hex literal anywhere in the file fails it. Token-definition blocks (`:root` and `[data-theme="dark"]`) MUST contain hex literals — that is the entire point of CSS custom properties. The flat regex therefore reports false positives on the very token blocks the plan required us to add.
**Fix:** Wrote and ran a context-aware verifier (Rule 3 — auto-fix blocking issue) that strips `:root { ... }` and `[data-theme="dark"] { ... }` token-definition blocks before checking for hex/rgb literals. After stripping: zero literals remain in property-value assignments. PASS.
**Why this is correct:** The plan's must-have truth #2 reads "no hardcoded hex / rgb / named colour values remain in ui/frame2d/style.css — all colours go through var(--color-*) tokens". The implicit semantic is that CONSUMERS go through tokens; the DEFINITIONS necessarily contain literals. The context-aware check enforces the actual intent.
**Files modified:** none (this is a verification-tooling deviation, not a code deviation).
**Commit:** n/a (no code change).

### Task 3 — minor enhancement: `font-family: inherit` on buttons + panel background switch

**Found during:** Task 3
**Issue:** Without `font-family: inherit` on `.tool-btn` and `.solve-btn`, browsers fall back to the user-agent button font (often Helvetica or system-ui), which defeats the point of self-hosting Inter on body. The plan didn't call this out explicitly but it's a Rule 2 (auto-add missing critical functionality — typography correctness).
**Fix:** Added `font-family: inherit;` on `.tool-btn` and `.solve-btn`. Also switched `.panel` background to `var(--color-bg)` (not in plan — was `var(--color-surface)`) so the white card-sections sit on the page background and pop visually; otherwise card+panel are both white-on-white in light mode and the card grouping is invisible. Documented as a layout polish judgement call within Task 3's spec scope.
**Files modified:** ui/frame2d/style.css
**Commit:** af00755

### Inline-style colours in index.html — deliberately left as-is

**Found during:** Task 2 audit
**Issue:** `errorBanner` (top-banner), `udlPanel`, `springPanel`, and Section Calculator `<select>` use inline `style="..."` colours (`#d32f2f`, `#90caf9`, `#1565c0`, `#ce93d8`, `#6a1b9a`, `#ccc`, etc.).
**Fix:** None — the plan's `<interfaces>` block explicitly says "inline-style colours in index.html are NOT in scope of that gate. They MAY be left alone."
**Impact:** These elements look slightly inconsistent in dark mode (e.g. error banner stays bright red regardless of theme; UDL/spring panel borders stay light-mode hues). Acceptable per spec; future polish opportunity.

## Authentication Gates

None — all work is local file editing + npm-style verification. No external auth required.

## Verification Evidence

### Per-task automated gates (all PASS)

| Task | Verification | Result |
|---|---|---|
| 1 | `test -f ui/fonts/Inter-{Regular,Medium,SemiBold}.woff2 && grep @font-face style.css && grep -- --color-bg style.css && grep -- --font-sans style.css && grep -E "font-family:\s*var\(--font-sans\)" style.css` | PASS |
| 2 | Context-aware node script: strips `:root` + `[data-theme="dark"]` blocks, asserts zero hex/rgb literals in property-value assignments, asserts `[data-theme="dark"]` selector exists, asserts themeToggle in HTML, asserts dataset.theme + localStorage + prefers-color-scheme in JS | PASS |
| 3 | node script: asserts `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`, `box-shadow:`, `transition:`, `.panel-section` all present in style.css | PASS |
| 4 | node script: asserts chkDiagLabels in HTML, asserts `chkDiagLabels.*\.checked` guard inside drawBMD body and drawSFD body, asserts change listener registered | PASS |
| 5 | node script: asserts drawGrid uses `view.scale`/`view.tx`/`view.ty` + `Math.floor`/`Math.ceil`, asserts no `canvas.width`/`canvas.height` loop bounds remain | PASS |

### Font binary verification

```
ui/fonts/Inter-Regular.woff2:  Web Open Font Format (Version 2), TrueType, length 111268, version 4.66
ui/fonts/Inter-Medium.woff2:   Web Open Font Format (Version 2), TrueType, length 114348, version 4.66
ui/fonts/Inter-SemiBold.woff2: Web Open Font Format (Version 2), TrueType, length 114812, version 4.66
```

### Implicit Python regression

No Python source touched. `pytest tests/ -q` should still be 61/61 green; pytest skipped because (a) no Python diff, (b) the dev server is already running uvicorn for the Task 6 manual UAT.

## Awaiting (Task 6 — Manual UAT)

Browser-driven verification is the load-bearing functional gate (vanilla JS, no automated browser tests in this repo by design). User should:

1. **Reload the frame2d UI** at `http://127.0.0.1:8000/ui/frame2d/index.html` (uvicorn is already running with `--reload`; Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html` also works).
2. **Typography:** DevTools → Network. Confirm three `Inter-*.woff2` requests load 200. Computed `font-family` on body resolves to `Inter, ...`.
3. **Theme:** Click ☀/☾ in the Display panel — flips light↔dark; icon and label update. Reload → persists. Clear `localStorage.frame2d_theme` and toggle OS to dark mode (or DevTools → Rendering → prefers-color-scheme: dark) → page comes up dark. Inspect `<html data-theme="...">`.
4. **Layout polish:** Left-rail sections render as distinct cards with subtle shadow, rounded corners, breathing room. Tool button hover lifts. "Add Node" active state highlights navy.
5. **Toolbar smoke:** Click every mode button in Geometry / Supports / Node Loads / Member Loads / Member Properties / Edit / File. Mode label updates correctly each time. (Mode strings are unchanged per spec.)
6. **Cantilever regression:** Two nodes 5 m apart, member, fixed at one end, 10 kN ↓ at the free end. SOLVE. Status = "Solved ✓" green. M_i ≈ 50 kNm at fixed, V_i ≈ 10 kN, Reaction Y ≈ 10 kN at fixed node.
7. **chkDiagLabels:** Tick "Show bending moment diagram" → blue polygon. Tick "Show diagram values" → kNm labels appear. Untick → labels gone, polygon stays. Same for SFD + V=0 tick.
8. **Infinite grid:** Pan far off-screen (middle-mouse / Cmd-drag). Gridlines still cover the canvas. Scroll-wheel zoom in/out — grid density adjusts naturally; never ends at canvas edge.
9. **Save/Load JSON regression:** Save → reload page → Load → cantilever reappears intact → SOLVE → same results as step 6.
10. **Negative check:** With chkDiagLabels unticked, click various tool buttons. chkDiagLabels stays unticked (default OFF preserved — setMode() not modified).

If any step diverges: each commit is independently revertable via `git revert <hash>`. Reply "approved" otherwise.

## Self-Check: PASSED

- File `ui/fonts/Inter-Regular.woff2` — FOUND
- File `ui/fonts/Inter-Medium.woff2` — FOUND
- File `ui/fonts/Inter-SemiBold.woff2` — FOUND
- File `ui/frame2d/style.css` — FOUND (modified)
- File `ui/frame2d/index.html` — FOUND (modified)
- File `ui/frame2d/script.js` — FOUND (modified)
- Commit `00782d6` — FOUND
- Commit `d538621` — FOUND
- Commit `af00755` — FOUND
- Commit `001c0ec` — FOUND
- Commit `3407ed1` — FOUND
