---
created: 2026-06-27T00:00:00.000Z
title: Brighter load-case nature colours in truss2d
area: ui
priority: low
files:
  - ui/truss2d/style.css
  - ui/truss2d/script.js
---

## Problem

The colour-by-nature palette added in phase 999.2-03 (Dead blue-grey, Imposed ochre,
Wind teal — the `--canvas-nature-*` tokens) is too muted. During browser UAT the user
noted the colours could be brighter for clearer at-a-glance distinction between load
cases on the canvas.

## Solution

Punch up the saturation/brightness of the `--canvas-nature-*` tokens (light + dark
variants) in `ui/truss2d/style.css` so each nature reads distinctly at a glance, while
staying within the existing token system and not clashing with the 8 existing canvas
colours. Carry the same palette to frame2d when the load-case layer ports there.

## Notes

UAT feedback from phase 999.2-03 (load-case layer). Non-blocking — flagged as a later
improvement. Relates to [[loadcomb-critical-combination-traceability]] portability goal.
