---
quick_id: 260523-i52
check_date: 2026-05-23
checker: gsd-plan-checker
verdict: PASS (with 2 minor warnings — not blocking)
---

# Plan Verification — 260523-i52 (floating in-window panels for frame2d)

## Verdict: PASS

The plan passes all 11 verification dimensions with high confidence. Two minor warnings are noted for executor awareness but do not block execution. The plan is ready to run.

---

## Dimension-by-Dimension Findings

### 1. Coverage — PASS

All 10 locked CONTEXT decisions (D-1..D-10) are explicitly enumerated in the plan's `requirements:` frontmatter and each one maps to at least one task:

| Decision | Mapped task(s) | Evidence in plan |
|----------|----------------|------------------|
| D-1 (all 10 cards uniformly) | T2 | `document.querySelectorAll('details.card')` iterates all 10 |
| D-2 (top-right of canvas-area, 12 px margin) | T1 (#cardFloatLayer anchor) + T2 (floatCard sets left/top) | Explicit 12 px margin in floatCard step |
| D-3 (manual button only, no auto-snap) | T2 (toggle click) + T3 (no drag-over-toolbar detection) | No snap logic anywhere in plan |
| D-4 (no persistence) | T3 (DO NOT add localStorage) | Truth #15 + explicit constraint |
| D-5 (Unicode arrows ↗ / ↙) | T2 (button creation + state-toggle text/title swap) | Glyphs hardcoded in floatCard/dockCard |
| D-6 (drag handle = summary only) | T3 (mousedown bound to summary, not card) | Guard `e.target.classList.contains('card-float-btn')` |
| D-7 (z-index bring-to-top) | T2 (floatCard) + T3 (onCardDragStart) | `_floatZIndex` increments in both paths |
| D-8 (clamp ≥40 px visible) | T3 (clamp logic in onMove) | Math derivation included verbatim |
| D-9 (width identical to docked) | T1 (.card.floating inherits min-width: 110px) | No width override in .card.floating |
| D-10 (drop shadow + thicker border) | T1 (CSS .card.floating rule) | Uses `--shadow-lg` + `--color-border-hover` |

**100% decision coverage.** No D-XX is silently dropped.

### 2. Listener survival — PASS (highest-confidence claim verified)

Verified by direct grep against `ui/frame2d/script.js`:

```
$ grep -nE "closest|parentNode|parentElement" ui/frame2d/script.js
(no output)
```

ZERO references to `closest()`, `parentNode`, or `parentElement` exist in script.js. Every listener binding in the file uses `document.getElementById(...)` which is DOM-relocation-safe. The plan's central claim — that `appendChild` to a new parent preserves listeners — holds.

Truth #5 in `must_haves.truths` explicitly cites the listener line range (1953-1961) and the surviving-binding mechanism. Truth #6 covers slider+number sync (lines 1994-1995) and updateScaleVisibility (line 1981). Both verifiable in the T4 UAT script (steps 4, 5).

### 3. Atomicity — PASS

| Task | Touches | Independent commit? |
|------|---------|--------------------|
| T1 | style.css only (8 rules + 1 line-392 modification) | YES — pure CSS, no JS dependency |
| T2 | script.js only (setupCardFloat/floatCard/dockCard + DOMContentLoaded wire) | YES — works against T1's classes |
| T3 | script.js only (drag handlers + canvas pointer-events guard) | YES — depends on T2's floatCard binding hook but T2's hook is one-line `summary.addEventListener('mousedown', ...)` ready for T3 |
| T4 | checkpoint:human-verify (UAT + docs) | YES — gates merge, no code change |

T1 ships first (pure CSS, no behaviour change unless `.card.floating` class is applied — it isn't yet). T2 introduces the class-toggle and state machine. T3 adds drag. Clean ordering.

### 4. Truth observability — PASS

All 21 truths in `must_haves.truths` are verifiable through T4's UAT script (steps 3-14) OR via `git diff` inspection:

- Truths 1-13 (functional behaviour) → UAT steps 3-12
- Truth 14 (canvas pointer-events guard) → UAT step 4 (drag Display over canvas while diagrams enabled)
- Truth 15 (no persistence) → UAT step 10 (DevTools Local Storage check)
- Truth 16 (stopPropagation) → UAT step 9
- Truth 17 (theme switching) → UAT step 11
- Truth 18 (no index.html edits) → UAT step 14 (`git diff --stat`)
- Truth 19 (no out-of-scope edits) → UAT step 14
- Truth 20 (61 pytest green) → UAT step 13
- Truth 21 (non-floated cards byte-identical) → UAT step 12

### 5. Tokens claimed exist — PASS

| Token | Light theme | Dark theme |
|-------|-------------|------------|
| `--shadow-lg` | `style.css:50` (`0 4px 18px rgba(0,0,0,0.12)`) | inherits from :root (rgba works on both) |
| `--color-border-hover` | `style.css:19` (`#9fa8da`) | `style.css:594` (`#4a5060`) |
| `--color-surface-hover` | `style.css:7` (`#e8eaf6`) | `style.css:582` (`#2a313c`) |

All three are theme-aware. Additional tokens referenced by the plan (`--color-border-subtle`, `--color-fg-faint`, `--color-fg-strong`, `--color-border-input`, `--color-info-border`) all exist in both themes (lines 12-25 / 587-600).

**WARNING (non-blocking):** CONTEXT.md D-10 originally specified `--color-shadow` and `--color-border-input` as the lift-tokens. The actual codebase has NO `--color-shadow` token. The planner self-corrected by substituting `--shadow-lg` (real, theme-stable) and `--color-border-hover` (real, theme-aware). This is a sensible improvement — the lift-precedent set by 260523-cyp T11 used `--shadow-lg`. Document this token substitution in the SUMMARY.md when written.

### 6. Pre-existing regression guards — PASS

Truths 20, 21, and 22 cover regression:
- Truth 20: "All 61 pytest tests remain green (regression guard — solver path untouched)"
- Truth 21: "Behaviour for a never-floated card is byte-identical to pre-i52"
- Truth 22 (implicit via T4 UAT step 12): every checkbox + slider + tool button tested with no cards floated

The T4 UAT script step 12 explicitly walks through pre-i52 baseline behaviour. Z-index leakage is bounded — only `.card.floating` carries the z-index inline style, which is cleared in `dockCard()` (T2 step 4).

### 7. Scope contract — PASS

`files_modified:` in PLAN.md frontmatter lists ONLY:
- `ui/frame2d/script.js`
- `ui/frame2d/style.css`

CONTEXT explicitly forbade HTML edits ("no edits to ui/frame2d/index.html"). The plan's `<interfaces>` section §1 confirms `data-original-index` is set via JS at DOMContentLoaded, not as an authored HTML attribute. Truth #18 makes the no-HTML-edits claim explicit. T4 UAT step 14 verifies via `git diff --stat`.

No scope creep. No drift into truss2d, solver_core, api_server, or tests.

### 8. Drag-vs-disclosure-click race — PASS

Explicit handling in T3:

> `if (!moved && Math.hypot(dx, dy) > 3)` set `moved = true` → only then `ev.preventDefault()` (suppress disclosure toggle from the trailing mouseup)

The 3 px threshold is hardcoded. Click-without-drag preserves the native `<summary>` disclosure toggle (UAT step 9 verifies). This is the correct interaction model — native click semantics retained, drag only kicks in past the threshold.

Additionally, the float button's own click handler uses `stopPropagation()` (T2 step 2), so clicking the button never bubbles to start either a disclosure or a drag.

### 9. Z-index bookkeeping — PASS

Concrete strategy specified:

- T2 declares module-level state: `let _floatZIndex = 100;`
- `floatCard()` (T2 step 3): `card.style.zIndex = ++_floatZIndex;`
- `onCardDragStart()` (T3 step 1): `card.style.zIndex = ++_floatZIndex;`
- `dockCard()` (T2 step 4): `card.style.zIndex = '';` (clears inline style)

Monotonic counter. Bring-to-top on both float-click AND drag-start (per D-7). Counter resets on page reload (no persistence per D-4). UAT step 6 verifies z-order swap.

### 10. Dock-restoration correctness — PASS

Plan T2 step 4 specifies the dock algorithm:

> "find the first `aside.panel > *` whose `data-original-index` (when present) is greater than this card's, OR the first `section.panel-section`, and `insertBefore` it. If none found, `appendChild`"

This correctly handles the edge case: when a mid-panel card (e.g., Material Properties, index 7) docks while later cards (Section Calculator 8, Display 9) are still floated, it finds the first `section.panel-section` (the Reset View block at index.html:217) and inserts before it. When all are docked, it lands at the correct slot.

Verified panel structure:
- `<aside class="panel">` at line 22
- 10 `<details class="card">` at lines 24, 30, 59, 66, 71, 79, 87, 98, 111, 140
- 2 `<section class="panel-section">` at lines 217, 221

The "find by `data-original-index` greater than this card's" logic correctly handles all interleaved float/dock combinations. T4 UAT step 8 verifies via "dock Material Properties first, then Display" sequence.

**WARNING (non-blocking):** The dock algorithm correctness depends on `data-original-index` being preserved on EVERY card during EVERY float. Since the dataset attribute is set once at page-init (T2 step 2) and never cleared, it survives `appendChild` moves into and out of `#cardFloatLayer`. Confirmed safe.

### 11. CLAUDE.md compliance — PASS

CLAUDE.md project rules checked:
- No matplotlib / solver_core touched — UI-only change. PASS
- No printing in solver_core — N/A
- DOF numbering — N/A (UI)
- Visualization import rule — N/A
- New solver registration — N/A
- "Hard rule: GSD workflow enforcement" — this IS a GSD-managed quick task. PASS

UI conventions checked:
- "Mode entry auto-enables matching visibility layer" — N/A (no new modes added)
- Canvas grid / coord conventions — N/A (no canvas logic changes)
- The plan does not affect any solver, API, or test path. Confirmed PASS.

---

## Cross-Plan Data Contracts (Dimension 9) — N/A

Single-plan quick task. No cross-plan pipelines.

## Research Resolution (Dimension 11) — N/A

No RESEARCH.md exists for this quick task; CONTEXT.md (discuss+validate mode) covered the design space.

## Nyquist Compliance (Dimension 8) — PARTIAL

This is a UI-only quick task with no automated test infrastructure for frame2d browser UIs (consistent with prior quick tasks like 260523-cyp). The plan correctly relies on a human-verify checkpoint (T4) with a 14-step UAT script + `pytest -q` regression guard.

Each `<task>` carries a `<verify>` block with an `<automated>` grep command (T1, T2, T3) confirming structural completeness. T4 is `checkpoint:human-verify` which is the correct type for browser UAT.

Wave 0 is not required — there is no existing test harness for `ui/frame2d/script.js` and adding one is out of scope (CONTEXT explicitly excludes tests/**). This follows established frame2d quick-task convention.

PASS for this project's testing model.

---

## Summary

**PASS — execute the plan.**

Most important findings:
- All 10 locked CONTEXT decisions (D-1..D-10) have explicit task coverage; no scope reduction; no scope creep into HTML / truss2d / solver_core / tests.
- The plan's strongest claim — that `appendChild` preserves listeners because no parent-traversal exists in script.js — is verified by `grep -nE "closest|parentNode|parentElement" ui/frame2d/script.js` returning zero matches. All three CSS tokens (`--shadow-lg`, `--color-border-hover`, `--color-surface-hover`) exist in both light AND dark themes.
- Two minor warnings, non-blocking: (1) CONTEXT D-10 named `--color-shadow` which does not exist in style.css; planner correctly substituted `--shadow-lg` (real, theme-stable) — document the token substitution in SUMMARY.md when written; (2) dock-restoration correctness depends on `data-original-index` being preserved across DOM moves (which it is, since dataset attributes survive `appendChild`) — executor should not clear it in dockCard.

No revisions required. Ready for execution.
