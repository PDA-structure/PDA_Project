---
phase: quick-260524-9ay
plan: 01
subsystem: ui/truss2d
tags: [ui, floating-panels, ux, truss2d, port]
dependency_graph:
  requires: [260523-i52]
  provides: [truss2d-floating-panels]
  affects: [ui/truss2d/style.css, ui/truss2d/script.js]
tech_stack:
  added: []
  patterns: [float/dock state machine, drag handlers with viewport clamp, monotonic z-index counter]
key_files:
  created: []
  modified:
    - ui/truss2d/style.css
    - ui/truss2d/script.js
decisions:
  - "Used sections.length - 2 iteration limit to skip the last panel-section (Solve) — matches D-1"
  - "No e.stopPropagation() needed on float-btn click — h3 has no native toggle behaviour unlike frame2d's <summary>"
  - "dockCard fallback detects Solve section by absence of data-original-index attribute"
metrics:
  duration: ~15 minutes
  completed: 2026-05-24
  tasks_completed: 3
  files_modified: 2
---

# Phase quick-260524-9ay Plan 01: Port Floating Panels from frame2d to truss2d Summary

**One-liner:** Float/dock panel system ported from frame2d's `<details class="card">` pattern to truss2d's `<section class="panel-section">` — all 7 content sections gain a Unicode `↗` float button; Solve section excluded.

## What Was Built

Ported the 260523-i52 floating-panel pattern from `ui/frame2d/` to `ui/truss2d/`. Users can now pop any of the 7 toolbar panel-sections (Geometry through Display) out of the sidebar onto the canvas overlay, drag them by their h3 header, and dock them back to their original toolbar position.

### Task 1: CSS Foundation (`5a45c44`)

- Added `position: relative` to `.canvas-area` — anchors the `#cardFloatLayer` absolute overlay
- Added `#cardFloatLayer`: `position: absolute; inset: 0; pointer-events: none; z-index: 50`
- Added `.panel-section.floating`: drop shadow + 1.5px `#bbb` border + `#fff` background + `border-radius: 4px`
- Updated `.panel-section h3`: added `display: flex; align-items: center` so float button right-aligns via `margin-left: auto`
- Added `.card-float-btn`: 18×18 button, `#ddd` border, `#888` text, hex values throughout (no design tokens — truss2d has none)
- Added hover (`#e8eaf6` / `#9fa8da`) and `:focus-visible` (`outline: 2px solid #3f51b5`) states
- Added `cursor: grab` on `.panel-section.floating > h3` and `cursor: grabbing` on `.dragging` state
- Added `body.card-dragging canvas { pointer-events: none }` — suppresses canvas intercept during drag

### Task 2: setupCardFloat + Float/Dock State Machine (`b961bcc`)

- `setupCardFloat()`: creates `#cardFloatLayer`, iterates indices 0–6 (skips index 7 = Solve), sets `data-originalIndex` + `data-state="docked"`, injects `↗` button into each `<h3>`
- `floatCard(section)`: moves section to `#cardFloatLayer` via `appendChild` (DOM move, not clone — listeners survive), positions top-right with 12px margin, increments `_floatZIndex`, updates button to `↙`
- `dockCard(section)`: sibling-walk finds first docked `.panel-section` with higher `originalIndex`, uses `insertBefore`; fallback detects Solve section by absence of `data-original-index` attribute; clears inline styles; restores button to `↗`

### Task 3: Drag Handlers (`b961bcc`)

- `onCardDragStart(e, section)`: 3px move threshold via `Math.hypot`, viewport clamp keeps ≥40px visible per edge, `body.card-dragging` + `section.dragging` classes during active drag, `_floatZIndex` incremented on drag-start for bring-to-top
- Document-level `mousemove` + `mouseup` listeners cleaned up on mouseup
- Guard: returns early if target is `.card-float-btn` (prevents drag on button click)
- `DOMContentLoaded` registration for `setupCardFloat`

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes on Adaptation

- No `e.stopPropagation()` needed in the float-btn click handler — truss2d `<h3>` has no native toggle-disclosure behaviour (unlike frame2d's `<summary>`). This simplifies the implementation slightly.
- Tasks 2 and 3 were committed together in a single commit (`b961bcc`) because both touch `script.js` and the drag handler (`onCardDragStart`) is called from within `floatCard` — splitting would have required a commit with a forward reference to an undefined function.

## Known Stubs

None — all functionality is fully wired.

## Threat Flags

None — UI-only change, no network I/O, no user data processing. DOM manipulation is contained within the existing page context.

## Self-Check: PASSED

- `ui/truss2d/style.css` — FOUND, contains `cardFloatLayer`, `panel-section.floating`, `card-float-btn`, `card-dragging`, `position: relative`
- `ui/truss2d/script.js` — FOUND, contains `setupCardFloat`, `floatCard`, `dockCard`, `onCardDragStart`, `_floatZIndex`, `DOMContentLoaded.*setupCardFloat`
- Commit `5a45c44` — FOUND (CSS foundation)
- Commit `b961bcc` — FOUND (JS state machine + drag handlers)
