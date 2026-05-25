---
phase: 260525-ba6
plan: 01
subsystem: ui
tags: [label-collision, canvas, truss2d, frame2d, shared-module]
dependency_graph:
  requires: []
  provides: [label-collision-avoidance, shared-label-manager]
  affects: [ui/truss2d, ui/frame2d]
tech_stack:
  added: []
  patterns: [centralized-label-manager, priority-based-greedy-placement, font-shrink-cascade, leader-line-fallback]
key_files:
  created:
    - ui/label-manager.js
  modified:
    - ui/truss2d/script.js
    - ui/truss2d/index.html
    - ui/frame2d/script.js
    - ui/frame2d/index.html
decisions:
  - LabelManager is a standalone class with zero dependencies on either UI's globals
  - 8-direction compass candidate search with progressive font shrink (100/80/65%) before leader-line fallback
  - Member lines act as obstacles via point-to-segment distance check
  - Priority ordering: nodeId=10, dof=15, reaction=20, load=30, memberForce=40, diagram=50, udl=60, spring=70
  - drawHaloedLabel() and labelText() left in frame2d codebase but no longer called from main draw path
  - isDark computed once at top of draw() and passed as parameter, not computed inside LabelManager
metrics:
  duration: 9m
  completed: 2026-05-25
---

# Quick 260525-ba6: Centralized Label Collision Avoidance Summary

Shared LabelManager class with 8-direction candidate search, font-shrink cascade (100/80/65%), and leader-line fallback integrated into both truss2d (5 label sources) and frame2d (16 label sources), eliminating label overlap at congested nodes.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create LabelManager class and integrate into truss2d | `250da06` | `ui/label-manager.js` (251 lines), `ui/truss2d/script.js`, `ui/truss2d/index.html` |
| 2 | Integrate LabelManager into frame2d | `f4e0574` | `ui/frame2d/script.js`, `ui/frame2d/index.html` |
| 3 | Browser UAT | _skipped (checkpoint)_ | |

## What Was Built

### LabelManager (`ui/label-manager.js` - 251 lines)
- Standalone class with zero dependencies on either UI's globals
- `add(spec)` collects label specs with: text, anchor, preferred position, priority, colour, font, halo, background, rotation, alignment
- `resolve()` sorts by priority (lower = placed first), then greedy-places each label:
  1. Try preferred position at full size
  2. Try 8 compass candidates at radius R (full size)
  3. Try 8 candidates at 80% font size
  4. Try 8 candidates at 65% font size
  5. Try 8 candidates at 2.5x radius with leader line
  6. Fallback: accept overlap at preferred/first candidate
- `render(ctx)` draws all labels with rotation support, background rects, halo strokes, and leader lines
- `_collides()` checks both previously-placed label bounding boxes AND member-line segments (point-to-segment distance)

### Truss2d Integration (5 label sources)
- `drawNodes()`: node ID numbers (priority 10)
- `drawNodeLabels()`: DOF labels "N0 [1,2]" (priority 15)
- `drawMemberLabel()`: rotated member force labels (priority 40)
- `drawForceArrow()`: load labels (priority 30) and reaction labels (priority 20)

### Frame2d Integration (16 labelManager.add calls)
- `drawNodes()`: node ID numbers (priority 10)
- `drawNodeLabels()`: DOF labels "N0 [1,2,3]" with theme-aware background (priority 15)
- `drawMemberLabel()`: rotated member force labels with theme-aware halo (priority 40)
- `drawForceArrow()`: load labels (priority 30) and reaction labels (priority 20)
- `drawMomentArc()`: moment load/reaction labels (priority 20/30)
- `drawUDLs()`: vertical and horizontal UDL value labels (priority 60)
- `drawSpring()`: spring stiffness value labels (priority 70)
- `drawBMD()`: end moment + midspan peak annotations (priority 50)
- `drawSFD()`: end shear + zero-crossing annotations (priority 50)
- `drawAFD()`: axial force midpoint annotations (priority 50)
- `drawDeflected()`: delta-max peak label (priority 50)

### Theme Awareness
- `isDark` computed once at top of `draw()`, passed to functions that need theme-aware halo colours
- LabelManager itself is theme-agnostic; receives final colour strings
- frame2d dark mode: halo `rgba(22, 26, 32, 1)` / light mode: `rgba(255, 255, 255, 1)`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] `ui/label-manager.js` exists (251 lines, > 150 minimum)
- [x] `ui/truss2d/index.html` loads label-manager.js before script.js
- [x] `ui/truss2d/script.js` has `new LabelManager`, `labelManager.add()`, `labelManager.resolve()`, `labelManager.render()`
- [x] `ui/frame2d/index.html` loads label-manager.js before script.js
- [x] `ui/frame2d/script.js` has 16 `labelManager.add()` calls (>= 8 required)
- [x] Commit `250da06` exists in git log
- [x] Commit `f4e0574` exists in git log
- [x] `drawHaloedLabel()` and `labelText()` remain defined but unused in frame2d
- [x] Zero solver_core, api_server, or test file changes
