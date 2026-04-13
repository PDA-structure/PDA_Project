---
created: 2026-04-13T19:45:00.000Z
title: Blender add-on integration with solver core
area: general
priority: medium
files:
  - solver_core/src/pda_analysis_software/
---

## Problem

Blender is a target platform (listed in project long-term goals). Unlike Revit, Blender's add-on system is native Python — solver_core can be imported directly into Blender without any bridging layer. This makes it the most technically accessible path to a desktop-native structural analysis tool.

## Solution

Build a Blender add-on that embeds solver_core as a native tool:

- **Modelling:** User models the structure in Blender using edges (members) and vertices (nodes). A custom panel in the N-panel (sidebar) provides fields for supports, loads, section properties (E, I, A), member type (beam/bar/truss).
- **Solve:** Panel button calls solver_core directly (no HTTP, no API server needed in desktop mode). Results returned as AnalysisResult.
- **Visualisation:** Deflected shape as a mesh overlay, member forces/moments as colour maps or annotated edges, reaction arrows at supports. Blender's viewport handles 3D rendering natively.
- **Export:** Can output solver JSON for sharing or loading into the browser UI.

### Why Blender works where Revit doesn't
Blender add-ons are pure Python — `import numpy` and `from pda_analysis_software import ...` work directly inside Blender's Python runtime. No .NET, no subprocess, no IPC needed.

### Key challenges
- Packaging solver_core + numpy inside the Blender add-on bundle (Blender ships its own Python)
- Defining a clean UX for structural input within Blender's panel system
- Deciding scope: frame2d only first, or include truss2d from the start

**Prerequisite:** Solver API should be stable before building the add-on wrapper around it.
