# Quick Task 260525-ba6: Centralized label collision avoidance system — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Task Boundary

Replace independent label drawing in drawNodeLabels/drawMembers/drawLoads/drawReactions with a shared LabelManager that collects all labels, resolves collisions via candidate-position search (8 compass directions, member-line avoidance, priority-based placement order), and renders with optional leader lines. Must work for both truss2d and frame2d, handle any structure size, and produce clean export-mode output.

</domain>

<decisions>
## Implementation Decisions

### Label scope (user chose)
All label types managed — node IDs, member forces, applied loads, reactions, and diagram annotations (BMD/SFD/AFD in frame2d). Full refactor of label-drawing code in both UIs. Every text element on the canvas goes through the LabelManager.

### Leader lines (user chose)
When a label can't fit near its anchor point, move it further out and draw a thin leader line back to the anchor. Keeps all information visible.

### Font shrink before leader lines (user idea)
When labels are congested, progressively shrink font size before resorting to leader lines. Cascade: (1) try candidate positions at normal font size, (2) shrink font (e.g. 80% → 65%) and retry, (3) leader line as last resort.

### Claude's Discretion
- **Collision strategy:** Greedy candidate-position search (8 compass directions at varying radii). Fast, deterministic, good-enough for structural engineering scales (<200 nodes). No physics simulation needed.
- **Priority order:** Node numbers (highest) > Reactions > Applied loads > Member forces (lowest, most numerous) > Diagram annotations (lowest).

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants automation over manual drag (citing RSA/TSD weakness)
- Must handle both small trusses (6 nodes) and large frames (50+ nodes) without degradation
- Screenshot reference: `~/Desktop/Screenshot 2026-05-25 at 07.51.45.png` — Pratt truss showing overlap at nodes 1-4
- White background behind labels (just shipped in 260525-ahv) should be preserved — collision avoidance is additive

</specifics>
