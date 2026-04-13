---
created: 2026-04-13T18:34:02.911Z
title: Add horizontal UDL support to frame2d
area: ui
files:
  - ui/frame2d/script.js
  - ui/frame2d/index.html
  - solver_core/src/pda_analysis_software/adapters/frame_adapters.py
---

## Problem

The current frame2d UDL implementation only supports vertical (downward) loading on members. There is no way to apply a horizontal distributed load — e.g. wind loading on a column. This makes it impossible to properly model lateral loading scenarios using UDLs, forcing users to use point loads as an approximation.

## Solution

Add a horizontal UDL input alongside the existing vertical UDL in the frame2d UI:

- Sign convention: positive = left-to-right (consistent with global X axis)
- UI: separate input field for horizontal UDL (w_x) next to the existing vertical UDL (w_y) in the member properties panel
- Solver side: compute equivalent nodal forces/moments for horizontal UDL using the same fixed-end force approach as vertical UDL — ENForces in X direction, ENMoments computed from wL²/12 formula
- Results: horizontal UDL should correctly drive shear (in axial direction for a column), bending moment diagrams, and lateral deflection
- A column under horizontal UDL should behave like a horizontal beam under vertical UDL — same FEM treatment, just rotated
- Document sign convention in UI tooltip or label
