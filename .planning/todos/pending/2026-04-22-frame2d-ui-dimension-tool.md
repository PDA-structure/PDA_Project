---
title: "frame2d UI: dimension tool for geometry annotation"
status: pending
priority: P2
source: "promoted from /gsd-note batch 2026-04-22 (point 1a)"
created: 2026-04-22
theme: ui
---

## Goal

Add a dimension tool to the frame2d UI that lets the user pick any two pieces of geometry and draws a dimensioned line on the canvas showing the measured distance. Parity with dimensioning tools in Tekla Structural Designer and Robot Structural Analysis.

## Context

Requested 2026-04-22 alongside a batch of UI improvements (see source note below). Purpose is on-canvas verification of geometry without exporting, and annotation for documentation screenshots.

Source note: `.planning/notes/2026-04-22-frame2d-ui-improvements-batch.md` (Point 1a)

## Scope

Pick-mode with toolbar button (following existing `data-mode` convention per CLAUDE.md). Supported pairings:

- **node → node** — straight-line distance between two nodes
- **node ↔ member** — perpendicular distance from node to member line (or line segment)
- **member → member** — semantics TBD (see open questions)

## Open design questions

- **Persistence** — are dimensions stored in the model JSON and rendered permanently, or transient (appear on click, clear on next action)?
- **Member-to-member semantics** — when two members are picked:
  - Centreline offset (only defined when parallel)
  - Shortest distance between line segments
  - Perpendicular distance from midpoint of one to the other
- **Units and precision** — metres to 3 dp; follow existing canvas convention (1 grid = 1 m per CLAUDE.md)
- **Visual style** — extension lines + arrowheads + label, or dashed line + label?
- **Editing / deletion** — if persistent, how does the user remove a dimension?
- **Mirror to truss2d** — should the same tool appear in the truss2d UI for consistency?

## Files likely in scope

- `ui/frame2d/script.js` — pick mode state machine, distance calculation, render
- `ui/frame2d/index.html` — toolbar button
- `ui/frame2d/style.css` — dimension line and label styling
- If persistent: canonical JSON schema extension (new `dimensions` array) and save/load round-trip tests
- Possibly `ui/truss2d/*` — mirror if UX parity is desired

## Acceptance Criteria

- [ ] Resolve open design questions (persistence, member-to-member semantics, visual style)
- [ ] Toolbar button with active-state highlighting following existing `data-mode` pattern
- [ ] node → node dimension draws with correct measured distance
- [ ] node ↔ member dimension uses perpendicular-to-segment distance
- [ ] member → member dimension per resolved semantics
- [ ] Label position legible at default zoom and grid scale
- [ ] (If persistent) saved JSON round-trips dimensions through save/load without loss
- [ ] (If persistent) delete-dimension interaction works
- [ ] Mirror to truss2d UI if applicable
