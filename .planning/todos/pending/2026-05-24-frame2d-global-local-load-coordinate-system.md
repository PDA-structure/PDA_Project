# Global vs Local Load Coordinate System — frame2d + truss2d

**Captured:** 2026-05-24 (after McKenzie 5.3 UDL debug fix)
**Updated:** 2026-05-25 (expanded scope to truss2d local loads + truss UDL)
**Scope:** UI + solver convention for UDL and point load coordinate systems across both UIs

## Problem

Currently both UIs assume all loads act in global coordinates (gravity direction). The solver handles local→global decomposition correctly (T-matrix rotation), but the UI doesn't expose the choice.

## Phase 1 — Local point loads on truss2d

**Priority:** Medium
**Trigger:** Next truss with inclined roof loads (wind perpendicular to rafter)

Currently truss2d only has global X/Y point loads at nodes. Add the ability to apply loads in local member coordinates (along/perpendicular to a member).

**Approach:**
- When adding a load, user selects a reference member (or the load mode prompts for one)
- Toggle: "Global" (default) / "Local" — local means axial + transverse relative to that member
- UI decomposes local load into global X/Y components using the member's direction cosines:
  - `Fx_global = F_axial * cos(θ) - F_transverse * sin(θ)`
  - `Fy_global = F_axial * sin(θ) + F_transverse * cos(θ)`
- The solver receives global forces as usual — decomposition is purely a UI convenience
- Canvas draws local-mode loads perpendicular/parallel to the reference member (visual feedback)

**Files:** `ui/truss2d/script.js` (load input, canvas rendering), no solver changes needed

## Phase 2 — Global/Local toggle on frame2d

**Priority:** Medium
**Trigger:** Same as Phase 1, or wind load on inclined frame member

Add "Global / Local" toggle per load (UDL and point loads) in frame2d UI.

**Approach:**
- Small toggle next to magnitude input: "Global" (default) / "Local"
- Global UDL: arrows always point straight down regardless of member angle
- Local UDL: arrows point perpendicular to the member axis
- Global point load: X = horizontal, Y = vertical (current behaviour)
- Local point load: axial + transverse relative to selected member
- Visual feedback: different arrow rendering (global = vertical arrows, local = perpendicular to member)
- Solver pipeline already handles both — ENForces are in local transverse, T-matrix does global↔local

**Files:** `ui/frame2d/script.js`, `ui/frame2d/index.html`

## Phase 3 — UDL on truss2d members

**Priority:** Lower
**Trigger:** When truss models need distributed loads (e.g. roof dead load as UDL instead of manual node forces)

Add UDL capability to truss members with a critical constraint: **truss connections are all pinned** (no moment capacity).

**Approach:**
- UDL on a truss member treated as a simply supported beam between its two nodes
- Equivalent nodal forces: wL/2 at each end node (in the load direction)
- **No fixed-end moments** — unlike frame2d where UDL generates wL²/12 FEM
- This is the standard truss analysis approach for distributed loads
- UI: UDL input per member (similar to frame2d UDL panel), draws arrows along member
- Global/Local toggle applies here too (Phase 1 prerequisite)
- Canvas rendering: slim chevron arrows along member (reuse frame2d UDL visual pattern)

**Solver impact:** Minimal — the UI converts UDL to equivalent nodal point loads before sending to the truss solver. No solver changes needed; the conversion is: for each member with UDL w (kN/m) and length L:
  - Node i gets: wL/2 in the load direction
  - Node j gets: wL/2 in the load direction
  - If local transverse: decompose via member angle before adding to global force vector

**Files:** `ui/truss2d/script.js`, `ui/truss2d/index.html`, no solver_core changes

## Prerequisites (all phases)

- UDL decomposition fix in place (DONE — commit `24469f3`)
- Solver core handles both conventions correctly (DONE — T-matrix handles global↔local)
- LabelManager handles new load label types (DONE — label collision system in place)
- Open chevron arrow rendering (DONE — modernised arrows shipped 2026-05-25)

## Tradeoffs

- Adding toggles increases UI complexity in the load input flow
- Most engineers only need global loads for building structures; local loads are niche
- Phase 3 (truss UDL) adds a conversion layer that must be tested against hand calculations
- Could defer all three phases and document "all loads are global" — only add when real demand emerges
