---
created: 2026-04-13T19:45:00.000Z
title: Save and load structure input in frame2d and truss2d
area: ui
priority: high
files:
  - ui/frame2d/script.js
  - ui/frame2d/index.html
  - ui/truss2d/script.js
  - ui/truss2d/index.html
---

## Problem

There is no way to save and reopen a structure. Every session starts from scratch, which makes iterative testing and sharing structures difficult. This is also a prerequisite for the Revit import pipeline — the JSON format produced here becomes the interchange format for all external integrations.

## Solution

Add save/load for structure input data (not results) in both UIs:

- **Save:** Serialize nodes, members, supports, loads, and member properties (E, I, A, UDL, pins, bars) to a JSON file. Download it with a timestamped filename (e.g. `frame2d-structure-YYYYMMDD.json`).
- **Load:** Accept a JSON file via a file input or drag-and-drop onto the canvas. Deserialize and reconstruct the canvas state. User clicks Solve to run fresh.
- **UX (user preference — implement all three):**
  - Thin top menu bar with File > Save / Open — keeps it entirely off the sidebar
  - Small save/load icon buttons in a corner — no labels, minimal footprint
  - Drag-and-drop load — drop a JSON file onto the canvas to open it; save button only
  - Do not auto-solve on load.
- **Format:** The saved JSON should be the canonical solver input format, matching what the API expects (nodes, members, restrainedDoF, forceVector, member properties). This ensures Revit export and any future integration can target the same schema.

Implement for frame2d first, then truss2d (simpler).
