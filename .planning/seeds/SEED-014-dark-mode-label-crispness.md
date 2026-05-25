# SEED-014: Dark Mode Label Crispness — Halo→Background Rect Migration

**Planted:** 2026-05-25
**Trigger:** Next dark mode polish pass or truss2d blueprint parity session

## Problem

Canvas text labels in dark mode look blurry/fuzzy, especially when zoomed out. Light mode is crisp because member force labels use solid `bgColor` background rects. Dark mode labels rely on halo strokes (`ctx.strokeText` with a dark rgba colour), which anti-aliases poorly against the dark canvas background — the stroke edges blend into the background rather than creating a sharp boundary.

## Root Cause

- `haloColor: isDark ? 'rgba(22, 26, 32, 1)' : 'rgba(255, 255, 255, 1)'` — the dark halo is nearly the same colour as the canvas background (`#0D1117`), so the anti-aliased edge pixels are invisible, making text look soft
- `ctx.strokeText()` inherently produces softer edges than `ctx.fillRect()` + `ctx.fillText()` — the stroke anti-aliases on both sides of each glyph outline
- Screen-space rendering (shipped 2026-05-25 `d1c5da6`) fixed zoom-dependent blur but not the halo anti-aliasing issue

## Proposed Fix

Switch ALL dark mode labels from halo strokes to solid background rects:

1. **In LabelManager specs:** labels that currently use `haloColor` for dark mode should instead use `bgColor: cssVar('--canvas-label-bg')` (which is `rgba(22, 26, 32, 0.88)` in dark mode)
2. **Affected labels:** force arrow labels (loads, reactions), moment arc labels, UDL labels, spring labels, BMD/SFD/AFD diagram annotations, deflection peak label
3. **Already correct:** member force labels and node IDs already use `bgColor` — they look crisp in dark mode
4. **The pattern:** `haloColor: isDark ? null : 'rgba(255,255,255,1)'` + `bgColor: cssVar('--canvas-label-bg')` — always use bgColor, only add halo in light mode for extra contrast if needed

## Scope

- frame2d only (truss2d doesn't have dark mode yet)
- ~10 labelManager.add() call sites to update
- Zero logic changes — just swapping haloColor for bgColor in the label specs
- Combine with truss2d blueprint parity pass (SEED-013 "quick wins") for efficiency

## Bonus: Legend Box

The legend box in the top-right corner may also benefit from the same treatment — ensure it uses `backdrop-filter: blur()` or a solid semi-transparent rect in dark mode rather than relying on canvas fillRect with hard edges.

## Related

- SEED-013 (modern web platform architecture) — truss2d blueprint parity pass is the natural trigger
- `d1c5da6` — screen-space label rendering (zoom blur fixed, dark anti-alias remains)
- `78ed51b` — deeper dark mode palette (canvas bg now `#0D1117`)
