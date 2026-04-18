---
status: partial
phase: 03-interchange-format-and-external-inputs
source: [03-VERIFICATION.md]
started: 2026-04-18T14:15:00Z
updated: 2026-04-18T14:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Frame2d live canvas Save/Reset/Load visual round-trip (SC-1)
expected: All canvas state visually identical to pre-save state; no blank canvas; no missing support/load glyphs. Steps: Open frame2d UI → build a cantilever (2 nodes, 1 member, fixed support, point load) → Save JSON → Reset All → Load JSON.
result: [pending]

### 2. Truss2d live canvas Save/Reset/Load visual round-trip (SC-1)
expected: Full canvas visual restore including supports and load arrows at correct nodes. Steps: Open truss2d UI → build a simple horizontal bar (pinned + roller + point load) → Save → Reset → Load.
result: [pending]

### 3. Cross-solver mismatch alert UX
expected: Alert appears — "This file is for the frame2d solver and cannot be loaded here." No canvas corruption. Steps: Attempt to load a frame2d saved file inside the truss2d UI.
result: [pending]

### 4. Save-button disabled attribute reactivity
expected: On fresh frame2d canvas (no nodes), Save JSON button is disabled; after placing first node, button becomes enabled. Reactivity on every node add/delete/undo/resetAll/load.
result: [pending]

### 5. End-to-end solve after load (SC-1)
expected: POST succeeds end-to-end from reloaded canvas; displacements match pre-save solve — no re-entering any data. Steps: After loading a saved frame2d file, click Solve.
result: [pending]

### 6. Real TSD Excel file conversion (SC-3)
expected: CLI completes; generated JSON opens in frame2d UI; solve returns sensible analytical results. Steps: Produce a real TSD Excel export from Tekla Structural Designer, adjust COLUMN_MAP to match version/locale, run the converter, load the JSON in frame2d UI, solve.
result: [pending — requires TSD licence]

### 7. Real Revit PyRevit script execution (SC-4)
expected: Script produces a JSON file readable by the frame2d UI; solve succeeds after engineer adds supports/loads. Steps: Install the pyRevit script in Revit 2023+, run it against an analytical model, save the JSON, open it in the PDA frame2d UI, solve.
result: [pending — requires Revit 2023+]

### 8. JSON paste-into-chat readability (SC-5)
expected: Human reader can identify nodes, members, supports, loads, units, solver type from the JSON alone; no out-of-band context required. Steps: Paste a saved JSON into a conversation/chat tool, ask another engineer (or Claude) to verify the model.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
