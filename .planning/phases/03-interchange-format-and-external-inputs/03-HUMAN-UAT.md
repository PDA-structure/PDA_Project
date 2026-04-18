---
status: resolved
phase: 03-interchange-format-and-external-inputs
source: [03-VERIFICATION.md]
started: 2026-04-18T14:15:00Z
updated: 2026-04-18T15:30:00Z
---

## Current Test

[closed — user accepted Phase 3 on 2026-04-18: Save/Load JSON buttons work in both UIs]

## Tests

### 1. Frame2d live canvas Save/Reset/Load visual round-trip (SC-1)
expected: All canvas state visually identical to pre-save state.
result: passed — user confirmed Save JSON and Load JSON work on frame2d.

### 2. Truss2d live canvas Save/Reset/Load visual round-trip (SC-1)
expected: Full canvas visual restore including supports and load arrows at correct nodes.
result: passed — user confirmed Save JSON and Load JSON work on truss2d.

### 3. Cross-solver mismatch alert UX
expected: Alert appears on solver mismatch; no canvas corruption.
result: deferred — not explicitly exercised; automated truth check in VERIFICATION.md passed.

### 4. Save-button disabled attribute reactivity
expected: Save button disabled/enabled reactively as nodes are added/removed.
result: deferred — tracked in UI todo (fix-truss2d-add-load-and-scale-input-regressions).

### 5. End-to-end solve after load (SC-1)
expected: Reloaded canvas can be solved without re-entering data; displacements match.
result: passed — user confirmed the loaded model solves and produces results (separate bending-moment-diagram issue traced to a pre-existing solver bug, not Phase 3).

### 6. Real TSD Excel file conversion (SC-3)
expected: Real TSD export → converter → JSON → UI → solve.
result: deferred — needs TSD licence; not part of dev environment. Converter verified via 9 unit tests with hand-crafted openpyxl fixtures.

### 7. Real Revit PyRevit script execution (SC-4)
expected: Script runs in Revit 2023+, produces JSON loadable in frame2d UI.
result: deferred — needs Revit 2023+; not part of dev environment. Script verified via ast.parse and API-shape review.

### 8. JSON paste-into-chat readability (SC-5)
expected: Saved JSON is self-describing enough to reason about without context.
result: passed — user pasted a saved frame2d model into conversation to diagnose a solver issue. The paste-to-debug flow worked as intended.

## Summary

total: 8
passed: 4
issues: 0
pending: 0
skipped: 0
deferred: 4

## Gaps

- **2d UI bugs surfaced during review** (captured as todo `2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md`):
  - Add Load button fails silently in truss2d after a specific interaction sequence
  - Scale factor input appears to "get stuck" after Solve
  - Both need DevTools console output to root-cause; user couldn't open Safari DevTools during this session
- **Pre-existing frame_v2 solver bug** (captured as todo `2026-04-18-fix-frame-v2-pin-release-and-udl-condensation.md`):
  - `beamPinLeft`/`beamPinRight` + UDL produces incorrect bending moments
  - Element stiffness is condensed correctly but the equivalent nodal action vector is not
  - Predates Phase 3 — not a regression
- **Integration tests without real tools** (deferred):
  - TSD Excel conversion requires a Tekla Structural Designer licence
  - Revit script execution requires Revit 2023+
  - Both are covered by unit tests and static analysis; full runtime validation is a future concern when the relevant tools are available
