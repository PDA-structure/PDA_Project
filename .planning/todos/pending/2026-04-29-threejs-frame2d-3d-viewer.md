---
title: "Three.js 3D viewer for Frame2D solver results in the browser UI"
status: pending
priority: P2
source: "5-year strategic exploration (gsd-explore) on 2026-04-29 — Phase A of browser-first 3D & VR strategy"
created: 2026-04-29
theme: ui
promote_when: "v1.4 milestone (3D Truss + 3D Frame solvers) starts — natural pairing since 3D solvers need 3D visualisation. User intent (2026-04-29): finish v1.3 Revit Tier 2 work first, then promote this todo into a proper phase plan alongside Phase 12 / Phase 13."
---

## Goal

Add a basic Three.js-based 3D viewer to the existing Frame2D browser UI (`ui/frame2d/`) that renders the solved frame in 3D — geometry, supports, applied loads, deformed shape, and (stretch) axial-force colouring on members. This is the **confidence-building first move** for the larger browser-first 3D + VR strategy captured in `.planning/notes/2026-04-29-browser-first-3d-vr-strategy.md`.

## Context

Currently `ui/frame2d/` renders the frame in 2D using a Canvas/SVG approach (per CLAUDE.md). Adding 3D unlocks:

- A meaningful demo upgrade for showcase purposes
- A foundation for IFC import (Phase B) and WebXR walkthrough (Phase D / SEED-002)
- A visual story for the eventual construction-tech extensions (SEED-003)

The viewer must coexist with the existing 2D view — it's an *additional* mode, not a replacement.

## Scope (MVP)

The viewer should support, at minimum:

- **Geometry rendering:** nodes (small spheres), members (line segments or thin cylinders), supports (icons or geometric markers)
- **Camera controls:** orbit / pan / zoom (Three.js OrbitControls)
- **Mode toggle:** switch between existing 2D view and the new 3D view
- **Solver result display:** deformed shape (scaled), at minimum

Stretch (defer if time-pressured):

- Axial-force colouring on members
- Reaction-force arrows at supports
- Element-pick → display properties in a side panel
- Animated load-case transitions

## Out of scope

- IFC import (that's Phase B / a separate todo)
- WebXR / VR mode (that's Phase D / SEED-002)
- Replacing the 2D view — keep both
- Multi-user collaboration

## Tech notes

- **Library:** Three.js (mature, large ecosystem, integrates with `web-ifc` for Phase B). Babylon.js is the alternative — defer the choice to plan-phase if there's a strong reason to reconsider.
- **Loading model:** the Frame2D solver result returned by `/solve/frame2d` already contains nodes, members, displacements, member forces. Should not require any new API endpoint for this todo.
- **Page structure:** mirror the existing Frame2D UI conventions in `ui/frame2d/script.js` — use the `data-mode` toolbar pattern called out in CLAUDE.md.
- **Coordinate system:** PDA's 2D frame is in the XZ plane (per CLAUDE.md sign conventions). For 3D rendering, lift it into the Y-up Three.js convention without changing the underlying data model.

## Acceptance criteria

A user can:

1. Open the Frame2D UI, model and solve a frame as today
2. Click a "3D view" toggle in the toolbar
3. See the model rendered in 3D with orbit/pan/zoom working smoothly
4. See the deformed shape (scaled by a slider or fixed factor)
5. Toggle back to 2D without losing model state

## Related

- Note: `.planning/notes/2026-04-29-browser-first-3d-vr-strategy.md` (parent strategy)
- Seed: `.planning/seeds/SEED-002-webxr-quest3-walkthrough.md` (downstream — needs this todo done first)
- Seed: `.planning/seeds/SEED-003-construction-extension-via-quantity-takeoff.md` (downstream — also needs IFC import beyond this todo)
