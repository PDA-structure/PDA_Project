---
phase: 260418-vxi
plan: 01
subsystem: ui-diagnostic
tags: [ui, safari, error-handling, diagnostic]
requires: []
provides: [ui-error-banner]
affects: [ui/frame2d, ui/truss2d]
tech-stack:
  added: []
  patterns:
    - "window.addEventListener('error') + 'unhandledrejection' for global JS error capture"
    - "Per-entry-point try/catch + showError + re-throw for targeted diagnostic wrap"
key-files:
  created: []
  modified:
    - ui/frame2d/index.html
    - ui/frame2d/script.js
    - ui/truss2d/index.html
    - ui/truss2d/script.js
decisions:
  - "Duplicate showError helper in both script.js files rather than extracting (per plan constraint)"
  - "Use var + function expressions inside helper for Safari ES5 compatibility"
  - "Wrap handler registered via addEventListener directly (no module separation) — simplest additive change"
  - "Re-throw err inside every catch so normal error propagation path is preserved; banner is purely observational"
requirements: [DIAG-01]
metrics:
  duration: ~25 min
  completed: 2026-04-18
---

# Phase 260418-vxi Plan 01: Add Diagnostic Error Banner to Both UIs Summary

Pure-diagnostic change: dismissible red error banner at top of both `ui/frame2d` and `ui/truss2d` pages, wired to `window.error` / `window.unhandledrejection` plus explicit try/catch on 6 suspect entry points per UI, so any runtime JS exception surfaces to the user in Safari without requiring DevTools.

## Summary

Task 1 added identical banner DOM (`#errorBanner` / `#errorBannerClose`) as first child of `<body>` in both `ui/frame2d/index.html` and `ui/truss2d/index.html`, plus an identical `showError()` helper, `window.addEventListener('error', …)` handler, `window.addEventListener('unhandledrejection', …)` handler, and `DOMContentLoaded` close-button wiring at the top of both `script.js` files. Safari-compatible: `var`, `function (e) {…}` instead of arrow functions, explicit `e.reason && e.reason.message` null-check (no optional chaining).

Task 2 wrapped 6 entry points in each `script.js` with the standard pattern:
```js
try {
  // existing code byte-identical
} catch (err) {
  showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
  throw err;
}
```
Every catch re-throws so error propagation is unchanged. All 12 wraps (6 per UI) landed successfully — no entry points were skipped.

## Wrap Locations (post-edit line numbers)

### ui/frame2d/script.js

| # | Entry point                    | Try-open line | Catch-throw lines |
|---|--------------------------------|---------------|-------------------|
| 1 | canvas `click` handler         | 107           | 279–282           |
| 2 | `draw()` function body         | 486           | 507–510           |
| 3 | `drawDeflected()` function body| 889           | 958–961           |
| 4 | `inputScale` `input` listener  | 1164          | 1166–1169         |
| 5 | `saveModel()` function body    | 1213          | 1335–1338         |
| 6 | `fileInput` `change` handler   | 1346          | 1436–1439         |

### ui/truss2d/script.js

| # | Entry point                    | Try-open line | Catch-throw lines |
|---|--------------------------------|---------------|-------------------|
| 1 | canvas `click` handler         | 102           | 187–190           |
| 2 | `draw()` function body         | 343           | 354–357           |
| 3 | `drawDeflected()` function body| 628           | 659–662           |
| 4 | `inputScale` `input` listener  | 714           | 716–719           |
| 5 | `saveModel()` function body    | 730           | 798–801           |
| 6 | `fileInput` `change` handler   | 809           | 871–874           |

All 12 wraps present. Zero entry points skipped.

## Skipped entry points

None. Both UIs had all 6 target entry points.

## Clean page-load behaviour

The banner carries inline `style="display:none; …"` and nothing in `script.js` changes that on load. On Safari, the pages render identically to before — no red strip visible unless an error fires or is thrown manually. Confirmed by static inspection of both `index.html` files (both have `id="errorBanner"` with `display:none` inline style at body position 0).

## Safari-compatibility specifics applied

- Helper body uses `var` only (no `let`/`const`).
- All event handlers passed as `function (e) {…}` not arrow functions (broader support, preserves `arguments` if ever needed).
- `unhandledrejection` handler uses explicit `e.reason && e.reason.message` — no optional chaining (`?.`) or nullish coalescing (`??`).
- No template literals inside the helper — string concatenation only.
- Banner uses inline styles (no dependency on CSS classes that might not yet be parsed).

Note: the existing `draw()` in `ui/truss2d/script.js` contains pre-existing optional chaining (`document.getElementById('chkNodeLabels')?.checked`, etc.). These are NOT introduced by this task — they existed before. Per the plan's strict "code inside try block is byte-identical" rule, they were left untouched. This is a latent Safari-compat concern but is out of scope for a purely additive diagnostic task; if any of those expressions throw in Safari, the new `draw()` wrap will now surface the error via the banner.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit    | Description                                                     |
|------|-----------|-----------------------------------------------------------------|
| 1    | `cc99c20` | feat(260418-vxi-01): add error banner + global handlers to both UIs |
| 2    | `2f82b0a` | feat(260418-vxi-02): wrap 6 entry points in try/catch in both UIs   |
| 3    | deferred  | Human Safari verification — deferred to post-merge user test    |

## Task 3 — Deferred Checkpoint

Task 3 is a `checkpoint:human-verify` requiring the user to open Safari and manually throw a test error to confirm the banner fires + dismisses. Per execution instructions this is deferred to post-merge user verification. The orchestrator will present the banner to the user for manual test after the worktree merges back.

When the user runs the verification (per the plan's `<how-to-verify>` steps), they should specifically look for:
- Banner NOT visible on initial load in either UI (clean state).
- Throwing `throw new Error('test')` in the console surfaces a red banner with message + stack.
- ✕ button dismisses the banner.
- Reproducing the original truss2d "Add Load" silent-failure bug — if it still reproduces, the banner will now show the concrete error message + first 3 stack frames, unblocking the follow-up fix task. If the bug no longer reproduces on the clean page, mark as "diagnostic ready for future recurrence".

## Known Stubs

None. This is a pure diagnostic layer — it adds behaviour (error reporting) without placeholder data or unwired components.

## Verification Results

### Automated (Task 1)
```
✓ ui/frame2d/index.html contains id="errorBanner" and id="errorBannerClose"
✓ ui/truss2d/index.html contains id="errorBanner" and id="errorBannerClose"
✓ ui/frame2d/script.js contains function showError, 'error' handler, 'unhandledrejection' handler
✓ ui/truss2d/script.js contains function showError, 'error' handler, 'unhandledrejection' handler
```

### Automated (Task 2)
```
✓ ui/frame2d/script.js: 6 showError(err.message, ...) catch sites, 6 throw err; re-throws, parses as valid JS
✓ ui/truss2d/script.js: 6 showError(err.message, ...) catch sites, 6 throw err; re-throws, parses as valid JS
```

### `node -c` parse check
```
✓ ui/frame2d/script.js — parses
✓ ui/truss2d/script.js — parses
```

### Human-verified (Task 3)
Deferred to post-merge user test in Safari.

## Self-Check: PASSED

- ui/frame2d/index.html — modified, `#errorBanner` present
- ui/frame2d/script.js — modified, `showError` + 6 catches present
- ui/truss2d/index.html — modified, `#errorBanner` present
- ui/truss2d/script.js — modified, `showError` + 6 catches present
- Commit `cc99c20` — exists in git log (Task 1)
- Commit `2f82b0a` — exists in git log (Task 2)
