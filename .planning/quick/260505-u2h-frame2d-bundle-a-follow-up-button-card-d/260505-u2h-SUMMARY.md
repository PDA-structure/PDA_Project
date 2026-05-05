---
phase: quick-260505-u2h
plan: 01
subsystem: ui
status: incomplete
tags: [frame2d, css, density, ui, follow-up]

requires:
  - phase: quick-260505-tke
    provides: Display vertical-stack + initial card min-width 140px + summary 10px

provides:
  - Single-row toolbar at typical Mac viewport widths
  - 11px button font-size (down from 12px)
  - Tighter button padding (var(--space-1) var(--space-2) = 4px 8px, down from var(--space-2) var(--space-3) = 8px 12px)
  - Tighter card min-width (110px, down from tke's 140px)

affects: [frame2d-ui, toolbar-density]

key-files:
  modified:
    - "ui/frame2d/style.css — `.tool-btn { font-size: 12px → 11px; padding var(--space-2) var(--space-3) → var(--space-1) var(--space-2) }`; `.card, .panel-section { min-width: 140px → 110px }`"

key-decisions:
  - "Direct literal values (110px, 11px) — no new tokens; would be overengineering for a 3-line density delta"
  - "tke baseline preserved structurally — only the `.card { min-width }` value changes; tke's `.checkbox-label`, `summary`, and `details.card:has(#chkDeflected)` rules are byte-equivalent"
  - "sq0 baseline preserved — `--color-grid: #d4d8df` and `#udlPanel`/`#springPanel` token-driven CSS rules byte-equivalent"
  - "Inline execution (no executor agent spawn) — diff is 3 lines on a file already known from this session, agent overhead is not justified at this size"

requirements-completed: [U2H-01, U2H-02, U2H-03]

duration: 1min
completed: 2026-05-05
---

# Quick Task 260505-u2h: Frame2D Bundle A Follow-up Summary

**Tighten frame2d toolbar density further: smaller `.tool-btn` font (12→11px) + tighter `.tool-btn` padding (8/12→4/8px) + smaller `.card`/`.panel-section` min-width (140→110px). Single CSS-only commit `7d2d671` building on Bundle A (`77e2134`).**

## Performance

- **Duration:** ~1 min (3-line CSS diff, inline execution)
- **Tasks:** 1 of 2 complete (Task 2 = `checkpoint:human-verify` PENDING)
- **Files modified:** 1 (`ui/frame2d/style.css`)

## Accomplishments

- **Smaller button text** — `.tool-btn { font-size: 12px → 11px }`. Buttons now match the smaller summary text from tke (10px) more harmoniously; 11px is still legible on Mac retina + work-laptop screens.
- **Tighter button padding** — `.tool-btn { padding: var(--space-2) var(--space-3) → var(--space-1) var(--space-2) }`. Changes from 8px×12px to 4px×8px — buttons are physically smaller in both dimensions, freeing layout space inside cards.
- **Tighter card min-width** — `.card, .panel-section { min-width: 140px → 110px }`. Combined with smaller button content, cards can shrink enough that more fit on a single row at typical Mac/laptop widths.

## Task Commits

1. **Task 1: Apply density delta** — `7d2d671` (feat) atop EXPECTED_BASE `24e1867`
2. **Task 2: Browser UAT — single-row toolbar + button legibility** — **PENDING HUMAN UAT** (checkpoint:human-verify gate)

## Diffstat (against base `24e1867`)

```
 ui/frame2d/style.css | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)
```

Scope contract held:
- No `solver_core/` change
- No `api_server/` change
- No `tests/` change
- No `ui/truss2d/` change
- No `ui/frame2d/index.html` change
- No `ui/frame2d/script.js` change
- No new design tokens

## Verifier Gates (all 7 green)

1. `grep -c "min-width: 110px" ui/frame2d/style.css` = 1 ✓
2. `grep -c "min-width: 140px" ui/frame2d/style.css` = 0 (replaced) ✓
3. `grep -c "font-size: 11px" ui/frame2d/style.css` ≥ 2 (this task + tke baselines preserved) ✓
4. `grep -c "padding: var(--space-1) var(--space-2)" ui/frame2d/style.css` = 2 ✓
5. sq0 baseline: `--color-grid: #d4d8df` = 1 + `#udlPanel,` = 1 ✓
6. `git diff --stat 24e1867..HEAD` shows ONLY `ui/frame2d/style.css` (+3/-3) ✓
7. `pytest -q` → 61 passed ✓

## Decisions Made

- **Inline execution (no executor agent)** — at 3 lines of CSS in a file already familiar from this session, the planner+executor agent hops would have been ceremony for ceremony's sake. Direct edit + verifier gates produces the same outcome with less context spend.
- **No new design tokens** — `110px`, `11px` are direct literals. The `--space-1`/`--space-2` tokens cover the padding change cleanly without needing new ones.
- **Both Bundle A predecessors preserved** — tke's `.checkbox-label` Display rule, summary 10px, and the sq0 contrast fix all byte-equivalent. Only the tke `.card { min-width }` value is rewritten — a deliberate iteration on tke's work, not a regression.

## Pending Browser UAT (Task 2)

Refresh `http://127.0.0.1:8000/ui/frame2d/index.html` with hard-reload (Cmd+Shift+R). Verify:

1. **Single-row toolbar** — at current Mac viewport width, all toolbar cards fit on one row (no wrap)
2. **Smaller button text** — `Add Node`, `Pin`, `Roller`, `UDL`, etc. text is noticeably smaller but still legible
3. **Tighter buttons** — buttons take less vertical AND horizontal space inside cards
4. **No regressions** — Display vertical-stack from tke still works; UDL/Spring panels render with sq0 styling; light/dark theme toggle works; SOLVE end-to-end still works
5. **Resize narrower** — toolbar should still wrap eventually (when no longer fits), but at a much narrower width than before

If anything looks wrong, single revert restores Bundle A baseline: `git revert 7d2d671`.

## Issues Encountered

None.

## Self-Check: PASSED

- File `ui/frame2d/style.css` has the 3 expected diffs at lines 188, 245, 252 (verified via grep gates above).
- Commit `7d2d671` exists atop EXPECTED_BASE `24e1867`.
- pytest 61/61 green.

---
*Phase: quick-260505-u2h*
*Completed (executor portion): 2026-05-05*
*Awaiting browser UAT before final closure.*
