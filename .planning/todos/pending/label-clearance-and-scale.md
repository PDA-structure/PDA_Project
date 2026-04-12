---
title: BMD/SFD/deflection labels — font scaling + clearance offset
priority: low
source: checkpoint-feedback
phase: 03-03
---

# BMD/SFD label improvements

User feedback during 03-03 checkpoint verification.

## What to do

In `ui/frame2d/script.js`, modify `labelText()` (around line 701):

1. **Scale font with symbol size** — change `ctx.font = 'bold 10px sans-serif'` to use `getSymbolScale()`:
   ```javascript
   const fs = Math.round(10 * getSymbolScale());
   ctx.font = `bold ${fs}px sans-serif`;
   ```

2. **Add clearance offset** — currently labels sit exactly at the BMD/SFD diagram tip and overlap the filled area. In `drawBMD()` and `drawSFD()`, add a small extra perpendicular offset (~8px) when calling `labelText()` so the label clears the fill:
   ```javascript
   // Extra nudge beyond diagram tip
   const nudge = 8 * getSymbolScale();
   labelText(fmtM(Mi_bmd), x + perpX * (Mi_bmd * scaleFactor + nudge * Math.sign(Mi_bmd)), ...);
   ```

## Files
- `ui/frame2d/script.js` — `labelText()`, `drawBMD()`, `drawSFD()`
