---
created: 2026-04-12T13:03:56.355Z
title: UI symbol size scale control for frame2d and truss2d
area: ui
files:
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/truss2d/index.html
  - ui/truss2d/script.js
---

## Problem

On short-span structures (small distance between nodes), node dots, text labels, support symbols, and load arrows are drawn at fixed canvas sizes and dominate the view — making BMD/SFD/deflected shape diagrams hard to read even when supports and loads are hidden via the visibility toggles added in 2026-04-12.

Affected draw functions: `drawNodes`, `drawMemberLabel`, `drawFixed/drawPin/drawRollerH/drawRollerV`, `drawNodeLoads`, `drawUDLs`.

## Solution

Add a "Symbol size" number input (like the existing deflection scale / diagram scale inputs) to the Display section of both UIs. Read a `getSymbolScale()` value in each decoration draw function and multiply all fixed sizes (node radius, font size, arrow length, support symbol dimensions) by that factor. Default = 1.0.
