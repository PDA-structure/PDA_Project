---
created: 2026-06-27T00:00:00.000Z
title: Reassign existing loads to a different load case in truss2d
area: ui
priority: medium
files:
  - ui/truss2d/script.js
  - ui/truss2d/index.html
---

## Problem

After phase 999.2-03, a load is tagged to whichever case is active when it is placed.
There is no way to MOVE an already-placed load from one case to another (e.g. Dead →
Imposed) without deleting and re-adding it. The user requested this flexibility during
999.2-03 browser UAT.

## Solution

Let the user reassign an existing load's case **in place, on the spot**. Primary
interaction requested at UAT: **click a load glyph on the canvas and change its load case
right there** (e.g. a small inline case picker on click), with the Load Cases panel
(counts + colour-by-nature) updating live. Options to consider:
- Click/right-click a load glyph → inline case selector (alongside direction/magnitude edit).
- A per-load case dropdown in a load list, or a "move selected loads to case ▾" action
  (mirrors the multi-select Member-A pattern from quick 260627-et7).

Keep the case load-counts and colour-by-nature display in sync immediately after
reassignment, and carry the case field through save/load (already additive).

## Notes

UAT feedback from phase 999.2-03 (load-case layer). Non-blocking — flagged as a later
improvement. Should port to frame2d when the load-case layer goes there.
