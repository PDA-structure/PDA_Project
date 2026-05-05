---
phase: 260505-tke
plan: 01
subsystem: ui-frame2d
tags: [css, ui, density, toolbar-wrap, display-card, has-selector, bundle-a]
requires: [c3d1434]  # 260505-sq0 close-out (light-mode contrast pass)
provides: [Display-card-density, toolbar-wrap-narrower-min-width, summary-tighter-font-size]
affects: [ui/frame2d/style.css]
tech-stack:
  added: []
  patterns:
    - "CSS :has() parent-selector for HTML-untouched scoping (details.card:has(#chkDeflected) → Display card only)"
    - "Direct literals instead of new design tokens (140px, 10px, 11px, 2px, 2px 5px) for density tweaks below the existing token scale"
key-files:
  created: []
  modified:
    - ui/frame2d/style.css
decisions:
  - "Single atomic commit instead of two — total diff was 30 insertions / 2 deletions across one cohesive density-tweak block; both items target the rs3 horizontal-toolbar layout, so a single revert point keeps the rollback story clean"
  - "Used :has(#chkDeflected) over :nth-of-type(N) or [data-theme] tricks — uniquely identifies the Display card by semantic content (only Display has #chkDeflected), stable across future card additions/reorderings"
  - "Did not touch #themeToggle button styling — its inline style attribute already renders correctly, so leave it alone (deferred as a possible future refinement if user requests)"
metrics:
  duration_seconds: 112
  duration_minutes: 2
  completed_date: "2026-05-05T20:26:05Z"
  tasks_completed: 1
  tasks_total: 2
  tasks_pending_human_uat: 1
status: pending-human-uat
expected_base: c3d1434fa22a729b63c8a72e4c1842f3d6aa7bb3
commits:
  - hash: "77e2134"
    type: feat
    summary: "frame2d Bundle A — Display card density + toolbar wrap improvement (CSS-only, ui/frame2d/style.css; +30 / −2)"
---

# Phase 260505-tke Plan 01: Frame2D Bundle A (Display section density + toolbar wrap improvement) Summary

**One-liner:** Two CSS-only density tweaks to `ui/frame2d/style.css` — Display card now stacks its checkbox-label items vertically with tighter font/gap (via `:has(#chkDeflected)` parent-selector), and the rs3 horizontal toolbar drops `.card { min-width: 180px → 140px }` + `summary { font-size: 11px → 10px }` so cards stay on one row at narrower viewports. Single atomic commit, single revert point, no HTML/JS/test changes, sq0 baseline preserved.

## Status

- **Task 1 (auto): COMPLETE** — single atomic commit `77e2134` on `main`, all 7 automated verification gates green.
- **Task 2 (checkpoint:human-verify): PENDING HUMAN UAT** — browser inspection of desktop full-screen + a narrower viewport (~1100-1300px), regression smoke (cantilever solve, save/load, theme toggle, 10 cards collapse/expand, sq0 UDL/Spring panels). Executor did NOT run browser UAT per Bundle A constraint contract.

## Commits

| Hash | Type | Subject |
|------|------|---------|
| `77e2134` | feat | `feat(quick-260505-tke): frame2d Bundle A — Display card density + toolbar wrap improvement` |

CSS diff: +30 insertions, −2 deletions on `ui/frame2d/style.css` (single file).

## Bundle A scope — what each item delivered

### Item 1 — Display card density (carry-over from 260504-nwi UAT)

**Problem (from nwi UAT close):** Display section crowded — user wants items stacked one-per-line with smaller text. After rs3 flipped the panel to a horizontal wrap-row toolbar, the global `.checkbox-label { flex-direction: row !important }` rule (line 295) made the 8 visibility checkboxes inside Display sit side-by-side, eating horizontal space.

**Solution (line 297-323 of post-tke style.css):** appended a Display-scoped CSS block using the `:has()` parent-selector. The Display card is the only `<details class="card">` containing `#chkDeflected`, so `details.card:has(#chkDeflected)` uniquely identifies it without any HTML changes.

```css
details.card:has(#chkDeflected) .checkbox-label {
  flex-direction: column !important;   /* override global row !important */
  align-items: flex-start;
  gap: 2px !important;                  /* tighter than global 6px !important */
  font-size: 11px;                      /* smaller than inherited 13px body */
  margin-bottom: 2px;
}

details.card:has(#chkDeflected) > label,
details.card:has(#chkDeflected) > label.panel-label {
  font-size: 11px;
  margin-bottom: 2px;
}

details.card:has(#chkDeflected) > label input[type="number"],
details.card:has(#chkDeflected) > label.panel-label input[type="number"],
details.card:has(#chkDeflected) > label.panel-label input[type="range"] {
  font-size: 11px;
  padding: 2px 5px;
}
```

The 7 `.checkbox-label` items, the 2 bare `<label>` items (Deflection scale, BMD/SFD scale), and the 2 `.panel-label` items (Symbol size, Label size) all read at ~11px now. The 4 number/range inputs get tighter padding so they don't look oversized next to the smaller label text. The `#themeToggle` button — which has its own inline `style="display:flex; ..."` — was deliberately NOT touched.

**Browser support for `:has()`:** Safari 15.4+, Chrome 105+, Firefox 121+ (all GA Dec 2023). User's UAT environments (Mac Safari + Windows-laptop browsers via Tailscale) all support it.

### Item 2 — rs3 toolbar wrap improvement (carry-over from rs3 todo `2026-05-04-frame2d-toolbar-wrap-improvement.md`)

**Problem (from rs3 spike close):** at intermediate viewport widths (~1300-1500px) the cards wrapped to 2-3 rows earlier than ideal.

**Solution:** two single-value edits.

- Line 188: `.card, .panel-section { min-width: 180px }` → `min-width: 140px`. Cards now need less horizontal space → fewer cards per row → cards stay on one row at narrower widths.
- Line 196: `summary { font-size: 11px }` → `font-size: 10px`. Tighter chevron-pill text frees horizontal space inside each collapsed card.

All other properties of the `summary` rule are UNCHANGED (the `summary::-webkit-details-marker`, `summary::marker`, `summary:hover`, `summary::before`, `details[open] > summary::before`, `details[open] > summary`, `@media (prefers-reduced-motion: reduce)` rules from nwi remain byte-equivalent).

## sq0 baseline preservation (the user explicitly flagged this)

All four sq0 invariants verified post-tke:

| Invariant | Verification |
|-----------|--------------|
| `--color-grid: #d4d8df` (line 20) unchanged | grep confirmed; CSS-content node script PASS |
| `#udlPanel { border: 1px solid var(--color-info-border) ... }` unchanged | CSS-content node script PASS |
| `#springPanel { border: 1px solid var(--color-accent-spring-border) ... }` unchanged | CSS-content node script PASS |
| `[data-theme="dark"]` override block (lines ~499-560) unchanged | byte-equivalent — only edited regions are around lines 188, 196, 297-323 (all well above) |

The tke commit's diff hunks land at lines 188 (1-line change), 196 (1-line change), and 297-323 (a new 27-line block insertion). None of them touch the sq0 baseline regions.

## Cross-plan byte-equality gates (5/5 PASS, EXPECTED_BASE = `c3d1434`)

| Gate | Result |
|------|--------|
| Only `ui/frame2d/style.css` changed across the plan | PASS |
| `ui/frame2d/script.js` byte-identical to base `c3d1434` | PASS |
| `ui/frame2d/index.html` byte-identical to base `c3d1434` | PASS |
| `ui/truss2d/` byte-identical to base `c3d1434` | PASS |
| `solver_core/` + `api_server/` + `tests/` byte-identical to base `c3d1434` | PASS |

## Test results

`pytest tests/ -q` → **61 passed in 0.95s**. No Python touched in this plan, but pytest confirms nothing regressed.

## CSS-content node-script gate (Task 1 automated verifier)

```
PASS: Item 1 (Display :has() density block) + Item 2a (min-width 140px) + Item 2b (summary 10px) all applied;
      global .checkbox-label intact; sq0 baseline preserved
```

Specifically the verifier confirmed:
- `.card, .panel-section` block contains `min-width: 140px` and NO `min-width: 180px` (Item 2a applied).
- top-level `summary` rule contains `font-size: 10px` and NO `font-size: 11px` (Item 2b applied).
- Display-scoped `details.card:has(#chkDeflected) .checkbox-label` block exists with `flex-direction: column !important` (Item 1 applied).
- Global `.checkbox-label { flex-direction: row !important; ... }` rule INTACT (we appended, did not replace).
- `--color-grid: #d4d8df` present (sq0 baseline preserved).
- `#udlPanel { border: 1px solid var(--color-info-border) ... }` present (sq0 baseline preserved).
- `#springPanel { border: 1px solid var(--color-accent-spring-border) ... }` present (sq0 baseline preserved).

## Deviations from Plan

**None.** Plan executed exactly as written. The planner gave the executor permission to either single-commit or split into two atomic commits — executor chose single commit per the planner's stated preference (both shapes were valid).

## Auth Gates

None — pure CSS work, no external services touched.

## What's left (Task 2 — pending human UAT)

The user runs the manual UAT script captured in the plan's `<how-to-verify>` section (13 steps):

1. Start API server (`uvicorn api_server.app:app --reload`); browse to `http://127.0.0.1:8000/ui/frame2d/index.html` (or Tailscale URL).
2. Hard-reload to bypass cached CSS (Cmd+Shift+R / Ctrl+Shift+R).
3. **Item 1 (Display card density):** confirm the 7 visibility checkboxes stack vertically (one per line); font-size reads ~11px; gap is tight (~2-4px); 4 number/range inputs render correctly; theme toggle button still flips light/dark.
4. **Item 2 (Toolbar wrap):** at ~1500-1900px count rows = before-or-fewer; resize to ~1300px → noticeably fewer rows; resize narrower to ~1100px → still readable; resize wider → fewer rows.
5. **All 10 cards still collapse/expand** (regression check).
6. **All toolbar buttons still trigger correct modes** (regression check).
7. **Cantilever solve** (full smoke).
8. **sq0 baseline regression** — UDL panel + Spring panel render exactly as post-sq0.
9. **Light/dark theme** still polished.
10. **Save/Load JSON** round-trip.
11. **DevTools sanity:** computed styles confirm `min-width: 140px`, `summary font-size: 10px`, Display-card `.checkbox-label flex-direction: column`.
12. **Diff sanity** (developer check): `git diff c3d1434..HEAD -- ui/frame2d/script.js` ZERO output; `git diff --name-only c3d1434..HEAD` shows ONLY `ui/frame2d/style.css`.
13. **pytest smoke** (developer check): 61/61 passed (already confirmed by executor).

If everything looks right, user types "approved" → orchestrator merges and closes the quick task.
If anything diverges, single revert restores post-sq0 baseline: `git revert 77e2134`.

## Open question raised by the planner (carried forward to UAT)

> Does the Display card now read as "compact and tight" rather than "crowded"? And does the toolbar wrap noticeably better at intermediate widths (~1300-1500px)?

If either feels insufficient, escalation paths are captured in the existing todos:
- Item 1 escalates to Bundle B's `display-frequent` / `display-advanced` split (in todo `2026-05-05-frame2d-panel-ux-cheap-wins-pre-ribbon-and-999-5-prep.md`).
- Item 2 escalates to card consolidation per the rs3 wrap-improvement todo (`2026-05-04-frame2d-toolbar-wrap-improvement.md`).

## Pointers for orchestrator close-out

When the user approves:
- Mark `2026-05-04-frame2d-toolbar-wrap-improvement.md` as **resolved-by-tke**.
- Mark Item 1 (Display density) of `2026-05-05-frame2d-panel-ux-cheap-wins-pre-ribbon-and-999-5-prep.md` as **resolved-by-tke** (Bundle B items 3+4+5 remain pending for the next quick task).
- Update STATE.md "Last activity" with tke landing + UAT result.

## Self-Check: PASSED

- `ui/frame2d/style.css` modified — FOUND (commit `77e2134`).
- Commit `77e2134` exists in `git log` — FOUND.
- `.planning/quick/260505-tke-frame2d-bundle-a-display-section-density/260505-tke-SUMMARY.md` written — FOUND (this file).
- All 5 cross-plan diff gates PASS.
- All 7 CSS-content sub-checks in node-script verifier PASS.
- pytest 61/61 PASS.
- sq0 baseline (line 20 + `#udlPanel`/`#springPanel` rules) preserved — verified by node-script grep.
- No HTML / JS / truss2d / solver_core / api_server / tests changes.
- No new design tokens.
