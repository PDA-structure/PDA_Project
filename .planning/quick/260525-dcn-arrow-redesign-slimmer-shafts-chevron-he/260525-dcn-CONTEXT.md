# Quick Task 260525-dcn: Arrow redesign — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Task Boundary

Modernise load and reaction arrow visuals in both truss2d and frame2d UIs. Replace filled triangle arrowheads with open chevron tips, slim down shafts, and fix the persistent horizontal reaction label problem by placing reaction labels directly on the arrow shaft.

</domain>

<decisions>
## Implementation Decisions

### Arrow style (user chose)
Open chevron — slim V-shape at the tip, no fill. Shaft is a thin line ending in an open angle. Modern, clean aesthetic.

### Horizontal reaction label fix (user chose)
Label placed directly ON the arrow shaft with a background pill — same concept as member force labels sitting on their member. Horizontal arrow gets its label centred on its shaft, clearly attached to it. No more confusion with vertical reactions.

### Claude's Discretion
- **Shaft width:** 1.5px (down from 2px)
- **Chevron angle:** ~30° spread (not too wide, not too narrow)
- **Line caps:** Round (`ctx.lineCap = 'round'`)
- **Applies to:** Both load arrows (green) and reaction arrows (purple in truss2d, orange in frame2d)
- **Moment arcs (frame2d):** Keep V-style arrowhead at arc end — already looks clean
- **Label-on-shaft applies to ALL reaction labels** (not just horizontal) for consistency

</decisions>

<specifics>
## Specific Ideas

- Both drawForceArrow functions (truss2d and frame2d) need rewriting
- Label positioning changes from "beyond arrow tail" to "centred on arrow shaft midpoint"
- The forceLeaderLine hack from previous commit can be removed — no longer needed
- Frame2d's drawHaloedLabel call inside drawForceArrow already removed (uses LabelManager)
- Truss2d colours: loads #2e7d32 (green), reactions #7b1fa2 (purple)
- Frame2d colours: loads via cssVar('--canvas-load'), reactions via cssVar('--canvas-reaction')

</specifics>
