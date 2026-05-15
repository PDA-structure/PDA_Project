---
created: 2026-04-13T19:45:00.000Z
title: Revit to solver pipeline via PyRevit JSON export
area: general
priority: medium
status: superseded
superseded_date: 2026-05-15
superseded_by:
  - "Phase 5 (v1.2, shipped 2026-04-26) — ExportToPDA pushbutton (Revit detail-line Tier 1 exporter)"
  - "Phase 8 (v1.3, planned) — Revit Tier 2 Analytical Exporter Hardening (reads AnalyticalMember directly)"
  - "Phase 10 (v1.3, planned) — Revit Results-Import Table Stakes"
  - "Phase 11 (v1.3, planned) — Revit Results-Import Differentiators (DirectShape overlay, quantity selector, colour-coding)"
files: []
---

## SUPERSEDED 2026-05-15

This todo was captured 2026-04-13 ahead of the dedicated v1.2 + v1.3 Revit work. Both directions of the proposed pipeline are now scoped phases in the roadmap:

- **Phase 1 (Revit → solver export)** was delivered in v1.2 as Phase 5 (`ExportToPDA` pushbutton, shipped 2026-04-26). Tier 1 reads detail lines + DEFAULT_E/I/A; Tier 2 hardening is queued as Phase 8 (will read AnalyticalMember directly with real section/material values per memory `revit_phase5_export_uses_detail_lines_only`).

- **Phase 2 (solver → Revit results import)** is scoped in v1.3 as Phase 10 (Results-Import Table Stakes — TextNote annotations on members and supports) and Phase 11 (Differentiators — DirectShape deformed-geometry overlay, quantity selector, colour-coding).

The original "Key translation decisions" — section family → E/I/A mapping, support-type → restrainedDoF, load-case selection, 3D→2D projection — were resolved across Phases 4–8. The "Prerequisite: Save/Load structure JSON format must be finalised first" was completed in Phase 3 (v1.1, shipped 2026-04-19).

No remaining work in this todo. Moved to `done/` for archival.

---

## Original problem statement (preserved for record)

## Problem

Structural engineers model in Revit. Manually re-entering nodes, members, supports, and loads into the browser UI is error-prone and slow. A PyRevit script that exports the Revit analytical model to the solver's JSON format would eliminate this friction and make the tool useful in professional workflows.

## Solution

Build a bidirectional Revit ↔ solver pipeline:

### Phase 1 — Revit → solver (export)
PyRevit script that:
- Reads the Revit analytical model (AnalyticalModel API)
- Extracts: nodes (coordinates), members (connectivity), support conditions (AnalyticalSupport), section properties (E, I, A from family), loads (UDL, point loads)
- Flattens 3D geometry to a chosen 2D plane (user picks XZ or XY plane for frame2d)
- Outputs solver-format JSON (same schema as save/load feature)
- User loads JSON into the browser UI and clicks Solve

### Phase 2 — solver → Revit (results import)
PyRevit script that:
- Reads solver results JSON (UG displacements, member forces, moments)
- Writes results back to Revit analytical members as parameters or annotations
- Enables visualising deflection, moments, and forces within Revit

### Key translation decisions to resolve
- Section family → E/I/A mapping (may need a lookup table)
- Revit support types → restrainedDoF convention
- Load case selection (which Revit load case to export)
- 3D → 2D projection plane

**Prerequisite:** Save/load structure JSON format must be finalised first — the Revit export targets that schema.
