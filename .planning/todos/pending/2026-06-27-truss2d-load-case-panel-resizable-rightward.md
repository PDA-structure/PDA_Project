---
created: 2026-06-27T00:00:00.000Z
title: Load Cases panel should be resizable rightward into canvas space
area: ui
priority: medium
files:
  - ui/truss2d/style.css
  - ui/truss2d/script.js
---

## Problem

The Load Cases panel (phase 999.2-03) is too narrow to read its rows comfortably — case
name, nature, category, and load-count get cramped. The user wants the panel to be able
to grow in width to the right, occupying canvas space, so its contents read properly —
similar to how the results tab behaves in the frame2d UI.

## Solution

Allow the Load Cases panel to expand horizontally (rightward) over the canvas, mirroring
the frame2d results-tab sizing behaviour. Either a resize handle or a wider floating mode
that overlays the canvas area. Reuse the existing floating panel-section / setupCardFloat
machinery and the frame2d results-tab pattern as the reference implementation. Keep dark
+ light token styling.

## Notes

UAT feedback from phase 999.2 execution. Non-blocking. Pairs with the generator-wizard
resizing todo ([[2026-06-27-truss2d-generate-combination-box-resizable]]). Look at
frame2d's results tab for the concrete sizing approach.
