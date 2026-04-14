---
created: 2026-04-13T22:55:03.445Z
promoted: 2026-04-14
promoted_to: Phase 3 (Interchange Format and External Inputs)
title: Include input payload in results JSON export
area: ui
files:
  - ui/frame2d/script.js
  - ui/truss2d/script.js
---

## Problem

The results JSON export (Phase 03-03 feature) only contains solver output (UG, FG,
member_forces, member_shears, member_moments, meta). When a downloaded results file
is shared or used for verification, there is no record of what structure was solved —
no node coordinates, member layout, restraints, or applied loads.

This makes it impossible to:
- Verify results against hand calculations without re-entering the structure
- Share a solved result with full context
- Use Claude (or any tool) to check equilibrium or member force correctness

Discovered during horizontal UDL correctness debugging: the downloaded
`frame_v2-results-20260413-234946.json` had correct-looking outputs but no way to
verify them without knowing the input.

## Solution

Extend the results export in both UIs to include the full API payload alongside the
solver output. The downloaded file should have the shape:

```json
{
  "input": {
    "nodes": [...],
    "members": [...],
    "restrainedDoF": [...],
    "forceVector": [...],
    "ENForces": [...],
    "ENMoments": [...],
    "udl_x": [...],
    "E": ..., "I": ..., "A": ...
  },
  "output": {
    "solver": "frame_v2",
    "UG": [...],
    "FG": [...],
    "member_forces": [...],
    "member_shears": [...],
    "member_moments": [...],
    "meta": {...}
  }
}
```

The `input` block is the exact payload already built before the fetch() call —
just wrap it alongside the response. No API changes needed.

Implement for frame2d first, then truss2d.
