---
created: 2026-04-13T19:27:21.797Z
title: Improve horizontal UDL UX and correctness in frame2d
area: ui
priority: high
files:
  - ui/frame2d/script.js
  - api_server/app.py
  - solver_core/src/pda_analysis_software/adapters/frame_adapters.py
---

## Problem

Horizontal UDL (w_x) was implemented and works, but the UX and correctness need review before it can be considered production-ready. The two-step sequential prompt (w_y then w_x) is clunky, arrow rendering may not look right for inclined members, and the fixed-end moment sign convention for non-axis-aligned members hasn't been verified.

## Solution

Priority items for next session:

1. **UX — combined input panel:** Replace the two sequential prompts (w_y → w_x) with a single combined UDL input (a small dialog or inline panel showing both w_y and w_x fields at once). Matches how per-member E/I/A works.

2. **Arrow rendering:** Verify that horizontal UDL blue arrows render correctly for inclined members, not just vertical columns and horizontal beams. Arrows should be perpendicular to the member axis in local coords, or global horizontal depending on convention chosen.

3. **Edge cases:** Test with inclined members having both w_x and w_y non-zero, and ensure zero values are handled cleanly (no ghost arrows, no solver errors).

4. **Sign convention verification:** Confirm fixed-end moment signs for w_x are correct for all member orientations. Run an analytical check (e.g. propped cantilever column under w_x) and compare moment diagram against hand calculation.

5. **Label clarity:** UDL button tooltip and any UI labels should clearly distinguish vertical UDL (purple, w_y) from horizontal UDL (blue, w_x) with sign conventions stated.
