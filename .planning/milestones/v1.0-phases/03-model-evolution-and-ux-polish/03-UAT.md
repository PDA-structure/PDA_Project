---
status: complete
phase: 03-model-evolution-and-ux-polish
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-04-12T21:00:00Z
updated: 2026-04-13T18:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Section Calculator Sidebar
expected: Open the frame2d UI. In the sidebar, a Section Calculator panel is permanently visible. Select a section type (e.g. Rectangle), enter dimensions (width and height in mm), and the I (cm⁴) and A (cm²) values update automatically without clicking anything.
result: pass

### 2. Per-Member E/I/A Mode — Override Prompts
expected: In frame2d UI, click the "Per-Member E/I/A" button to enter that mode. Click on an existing member — a sequence of prompts appears asking for E (GPa), I (cm⁴), A (cm²). Enter custom values and confirm. The member is now drawn with a thick blue outline on the canvas.
result: pass

### 3. Per-Member Override Indicator
expected: After setting a per-member override (Test 2), the affected member shows a distinct blue highlight (thick #3f51b5 stroke) while unmodified members remain their default colour. Adding a second member without override shows the two styles side by side.
result: pass

### 4. Solve With Per-Member Overrides
expected: With at least one member having a per-member E/I/A override, click Solve. The solver returns results (displacements, reactions, member forces) without error. Results are displayed in the results panel as normal. No console errors.
result: pass

### 5. Backward Compatibility — Solve With No Overrides
expected: Clear the canvas and build a simple structure (e.g. two-node cantilever with fixed support). Solve without setting any per-member overrides. Results appear correctly, identical in behaviour to before Phase 03. No regressions.
result: pass

### 6. JSON Export — frame2d
expected: After solving in frame2d, a download link appears in the UI (below or near the results). Clicking it downloads a JSON file whose filename follows the pattern `frame2d-results-YYYYMMDD-HHmmss.json`. The file contains all result fields: UG, FG, member_forces, member_shears, member_moments, meta.
result: pass

### 7. JSON Export — truss2d
expected: Open the truss2d UI. Build and solve a simple truss. A download link appears after solving. Clicking it downloads a JSON file named `truss2d-results-YYYYMMDD-HHmmss.json` containing UG, FG, and member_forces.
result: pass

### 8. Node Label Overlay — frame2d
expected: In frame2d UI, there is a "Node Labels" checkbox in the Display section. Checking it causes each node on the canvas to show a label like `N0 [1,2,3]` (node index and its DOF numbers). Unchecking it hides the labels. The canvas redraws immediately on toggle.
result: pass

### 9. Symbol Size Scaler — frame2d
expected: In frame2d UI, a symbol size input (range 0.5–2.0) is visible in the Display section. Setting it to 0.5x makes nodes, supports, and load arrows visibly smaller; setting it to 2.0x makes them visibly larger. The canvas redraws when the value changes.
result: pass

### 10. Symbol Size Scaler — truss2d
expected: In truss2d UI, the same symbol size scaler (0.5–2.0) exists in the Display section. Adjusting it changes the visual size of nodes, supports, and load arrows in the truss canvas. Behaviour mirrors frame2d.
result: skipped
reason: truss2d UI was not updated in Phase 03 — symbol size scaler and zoom not implemented for truss2d yet

## Summary

total: 10
passed: 9
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]
