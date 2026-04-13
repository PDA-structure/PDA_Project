---
created: 2026-04-13T19:45:00.000Z
title: Revit to solver pipeline via PyRevit JSON export
area: general
priority: medium
files: []
---

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
