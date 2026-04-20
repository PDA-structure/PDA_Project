---
status: resolved
phase: 04-2d-frame-solver-ui-hardening
source: [04-VERIFICATION.md]
started: 2026-04-20T19:10:00Z
updated: 2026-04-20T19:25:00Z
---

## Current Test

[all tests approved]

## Tests

### 1. Reset All clears middle-mouse-pan state (D-14 bug #2)
expected: After Reset All, canvas clicks register new nodes/supports/UDLs without requiring a hard page reload — including the reproducer path where a middle-mouse-drag releases outside the canvas.
steps: |
  1. Start `uvicorn api_server.app:app --reload`
  2. Open `ui/frame2d/index.html`
  3. Middle-mouse-drag the canvas and release the button OUTSIDE the canvas bounds (reproducer for stuck isPanning=true)
  4. Click Reset All → confirm
  5. Click Add Node → click twice on canvas → two red dots should appear
  6. Click Pin Support → click one of the dots → a pin glyph must appear immediately
  7. Click Solve → reactions include the pinned support
fix_location: ui/frame2d/script.js:363-364 (resetAll)
result: approved-2026-04-20

### 2. Spring UI end-to-end 11-step UAT (from Plan 04-02 Task 3)
expected: All 11 steps in 04-02-PLAN.md <how-to-verify> pass — Spring button render, modal open/cancel/apply, single-axis Ky spring coil, spring replaces classic support (D-05), edit pre-fill, δ=P/K and reaction=K·δ, Save D-08 schema, Load round-trip, Phase 3 backward compatibility, zero console errors.
prior_approval: Approved by user on 2026-04-19 (recorded in 04-02-SUMMARY.md, 11 of 11 steps confirmed)
result: approved-2026-04-19

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
