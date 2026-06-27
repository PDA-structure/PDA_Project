---
created: 2026-06-27T00:00:00.000Z
title: Generate-combination wizard box should be resizable (bottom-right)
area: ui
priority: medium
files:
  - ui/truss2d/style.css
  - ui/truss2d/script.js
---

## Problem

The two-page "Generate combinations" wizard box (phase 999.2-04, the `.wizard-card`) is
fixed-size, so longer combination expressions and family/option text get cut off or
cramped — they cannot all be read properly.

## Solution

Make the wizard box flexible in size — allow the user to elongate/resize it from the
bottom-right corner (e.g. CSS `resize: both` on `.wizard-card` with a sensible min-size,
or a drag handle) so the full Page-2 preview rows (mono factored expressions + leading
tags) and Page-1 option labels are all readable. Stay within the existing token system;
keep the scrim + floating-card aesthetic.

## Notes

UAT feedback from phase 999.2-04. Non-blocking. Pairs with the Load Cases panel resize
todo ([[2026-06-27-truss2d-load-case-panel-resizable-rightward]]).
