---
name: SEED-001 — slab/floor load chasedown via analytical model
type: project
trigger_when:
  - milestone targets analytical-model expansion (v1.4+ or any future Revit work)
  - feature work touches load-takedown, vertical-load distribution, or slab-to-beam load transfer
  - user mentions Revit slabs / floors / area loads
planted_during: v1.3 milestone scoping
planted_at: 2026-04-26
---

# SEED-001: Slab/Floor Load Chasedown via Analytical Model

## The Idea

Engineers will eventually want PDA to model slabs and floors as area-load carriers, with **load chasedown** (a.k.a. load takedown) to automatically transfer:

```
slab/floor distributed load
        ↓ load distribution (1-way / 2-way slab)
   supporting beams (accumulated line loads)
        ↓ beam reactions
       columns (accumulated point loads)
        ↓ column reactions
    foundations (accumulated reactions)
```

This is a classic structural-engineering workflow used in every project that has slabs (which is most of them). Revit's analytical model has the data structure for it — slab analytical surfaces, beam load-takedown association — but PDA's current solvers are 1D members only (truss, frame).

## Why This Matters

- **Real engineer workflow.** Engineers spend significant time doing load takedowns by hand or in spreadsheets. A Revit→PDA→solve pipeline that handles this automatically is high value.
- **Forces analytical model to be primary.** Right now (v1.3) the conversion-to-analytical pushbutton handles columns/beams/bracings. Adding slabs requires extending that conversion to surfaces and area loads.
- **Solver scope expansion.** Real load chasedown needs either (a) a 2D plate/shell solver or (b) a tributary-area approximation. Tributary-area is the engineer-pragmatic choice for v1.4-ish; full plate/shell aligns with backlog 999.X (plate/shell solver).

## Designed Hooks (v1.3)

When designing v1.3's element-to-analytical conversion pushbutton, leave room for slab/floor expansion:
- **Selection filter** is a list of element categories, not hard-coded — easy to add `OST_Floors`, `OST_StructuralFoundation` later
- **`revit_meta` schema** allows non-line-element metadata (`element_type: "beam" | "column" | "bracing" | "slab" | ..."`)
- **Helper module** (`_pda_export_common.py`) has the structure to hold area-element extraction alongside line-element extraction
- **Out of Scope list** explicitly mentions slabs/floors so the deferral is intentional, not accidental

## When to Surface

This seed should re-surface during:
- Any v1.4+ milestone planning that involves analytical model expansion
- Any feature work that touches vertical-load distribution
- Any user mention of Revit slabs / floors / area loads
- Any plate/shell solver work (backlog 999.X)
- Any time the user asks "what about slabs/floors?"

## Pointers

- Revit API: `Floor`, `FloorType`, `AnalyticalSurface`, `AreaLoad`, `LineLoad` — the same `AnalyticalToPhysicalAssociationManager` pattern used for `AnalyticalMember` extends to `AnalyticalSurface`
- Tributary-area logic: standard structural texts (Hibbeler, McCormac); 1-way slab → load chases to two parallel supports; 2-way slab → load chases to all four
- Future requirement IDs: `LOADTAKEDOWN-XX`, `SLAB-XX`, `FLOOR-XX`
