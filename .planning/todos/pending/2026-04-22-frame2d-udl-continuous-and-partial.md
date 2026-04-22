---
title: "frame2d: distributed-load system (UDL, partial, triangular, trapezoidal, general VDL)"
status: pending
priority: P1
source: "captured from conversation 2026-04-22 (rewritten from UDL-only scope)"
created: 2026-04-22
updated: 2026-04-22
theme: ui+solver
target: "schema + wave 1 before Phase 6 Tier 2 plan-phase; later waves can ship after"
---

## Goal

Introduce a unified distributed-load system for frame2d that covers every common distributed-load shape (UDL full, UDL partial, triangular, trapezoidal, peaked, arbitrary piecewise-linear) via **one underlying solver primitive** — piecewise-linear distributed load — with an incremental UI rollout across five preset shapes.

Matches the loading capability of Tekla Structural Designer, Robot Structural Analysis, and SAP2000 for static 2D frame analysis.

## Context

Originally captured 2026-04-22 as a UDL-only todo ("continuous and partial UDL"). Rewritten the same day once the solver analysis showed that **general piecewise-linear VDL is not materially harder than partial UDL**: both break the `wL/2`, `wL²/12` shortcut and require the ENA integral `∫ w(x) · N_k(x) dx` over `[a,b]` with Hermite cubic shape functions `N_k`. Letting `w(x)` be linear instead of constant adds a single term to the integrand and integrates in closed form — no numerical quadrature, no new solver machinery beyond what partial UDL already needs.

User philosophy: **harden 2D frame fully before moving to 3D**. This todo is a core plank of that. When 3D arrives, the distributed-load primitive extends via direction cosines — no re-design.

Source note: `.planning/notes/2026-04-22-frame2d-ui-improvements-batch.md` (predecessor scope)

## Scope

**In scope:**
- Solver: piecewise-linear distributed-load ENA primitive for beams; axial-distributed variant (`q(x)` along member axis); proper direction-cosine decomposition for loads specified in global coordinates
- JSON schema: new `distributed_loads` array (shape defined below); coexists with legacy `ENForces` / `ENMoments` during transition
- UI: five preset pick-modes in frame2d (inventory below), plus a general breakpoint editor
- Continuous multi-member VDL — path through nodes, exporter decomposes into per-member entries
- Save/load round-trip for all shapes
- Analytical verification tests for every preset shape against closed-form or hand-calc results

**Explicitly out of scope (captured elsewhere):**
- Point moment at offset along member — captured in `2026-04-22-frame2d-additional-load-and-action-types.md` (Item 1b)
- Thermal loads — same todo, Item 4
- Self-weight auto-generation — same todo, Item 2
- Load combinations — backlog 999.2
- Truss2d — axial-only members don't take transverse VDL; mirror to truss2d only for axial distributed loads if demand arises later

## Underlying solver primitive

**One primitive: piecewise-linear distributed load.**

For a member of length `L` in its local frame, a distributed load is defined by an ordered list of breakpoints `[(x_k, w_k)]` where:
- `x_k` is position from the start node in metres (`0 ≤ x_k ≤ L`)
- `w_k` is load intensity at `x_k` (N/m for transverse; N/m for axial)
- Load is zero for positions before the first breakpoint and after the last
- Between consecutive breakpoints, `w(x)` is linear

ENA computation for each segment `[x_a, x_b]` with linear `w(x) = w_a + (w_b − w_a)(x − x_a)/(x_b − x_a)`:

```
F_i, M_i, F_j, M_j = ∫[x_a → x_b] w(x) · N_k(x) dx    (k = 1..4)
```

Where `N_k(x)` are the standard Hermite cubic shape functions for a 2-node Euler-Bernoulli beam element. The integrand is (linear) × (cubic) = quartic in `x`, integrable in closed form. Resulting formulas are parameterised by `w_a, w_b, x_a, x_b, L`. Derive once; all preset shapes reduce to specific cases of this formula.

Full derivation to live in a solver-internal design comment or test-driven documentation when implemented — not required in this todo.

## Proposed JSON schema

```json
{
  "distributed_loads": [
    {
      "id": "dl_1",
      "member_id": 2,
      "frame": "global_y",
      "breakpoints": [
        {"x": 0.0, "w": 0.0},
        {"x": 3.5, "w": 10.0},
        {"x": 6.0, "w": 10.0}
      ],
      "group_id": null
    }
  ]
}
```

Field semantics:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Optional identifier for editing/deletion |
| `member_id` | int | Member this load applies to (current member array) |
| `frame` | enum | `"local"` (transverse to member), `"axial"` (along member axis), `"global_y"` (vertical, solver decomposes using direction cosines), `"global_x"` (horizontal) |
| `breakpoints` | list | Ordered by `x`, length ≥ 2. Load is zero outside `[breakpoints[0].x, breakpoints[-1].x]` |
| `group_id` | string or null | Optional — all per-member segments of a continuous multi-member VDL share this ID |

Backwards compatibility decision (open question): does the new schema **coexist** with legacy `ENForces` / `ENMoments` (safer, dual-path solver) or **replace** them with an auto-migration on load (cleaner, one codepath)? Flagged in open questions below.

## UI preset inventory (5 presets — recommended minimum for commercial parity)

| Preset | Pick UX | Breakpoint mapping |
|---|---|---|
| **Full UDL** | pick member, enter `w` | `[(0, w), (L, w)]` |
| **Partial UDL** | pick member, click start + end on member, enter `w` | `[(a, w), (b, w)]` |
| **Triangular** | pick member, click start + end on member, enter `w_a` and `w_b` (either can be 0) | `[(a, w_a), (b, w_b)]` — covers both L→R and R→L via sign of magnitudes |
| **Trapezoidal** | same as triangular — unified pick mode | `[(a, w_a), (b, w_b)]` with both non-zero |
| **General breakpoint editor** | pick member, then open a breakpoint table; user adds N rows | Any piecewise-linear shape |

**Design note:** Triangular and trapezoidal share a pick mode (click start + end, enter two magnitudes). Whether either magnitude is zero determines the shape — no need for a separate "triangular L→R" vs "R→L" vs "trapezoidal" button. This simplifies the toolbar.

**Mid-peak triangular** is deliberately **excluded** from the preset list — it's expressible in the breakpoint editor (`[(0,0), (L/2, w), (L,0)]`) and doesn't justify its own pick mode. Could add later if user demand emerges.

**Continuous multi-member** is not a preset — it's a **modifier** on the three segment-defining presets (partial UDL, triangular, trapezoidal). User holds a modifier key or toggles a "continuous" switch, then picks the start node and end node (non-adjacent); exporter splits the load across the path.

## Open design questions

1. **Breakpoint `x` unit** — metres from start or fraction of L? Metres matches existing conventions (CLAUDE.md: grid = 1 m) and avoids surprises when members are edited. Fraction is more portable across scaled models. **Recommend metres.**
2. **Global vs local load frame** — the `frame` enum proposal above handles both. Does the UI default to `global_y` (gravity-direction loading, most common) or `local` (perpendicular to member)? Commercial tools default to global. **Recommend `global_y` default with local as an option.**
3. **Backwards compatibility** — coexist with legacy `ENForces`/`ENMoments`, or replace with auto-migration? Replacing is cleaner but requires a migration path for any saved models. **Recommend coexist for v1 of this todo, deprecate legacy in a follow-up.**
4. **Continuous multi-member path validity** — must members in the path be collinear? Cross a common plane? Exporter decomposes into per-member segments using what rule when the path bends? **Recommend: require collinear path; reject with a clear error otherwise. Design decision to lock before implementation.**
5. **Axial distributed load UI** — do we expose axial VDL as a preset, or only via the general editor? Rare in practice — walls and columns under their own weight, prestress. **Recommend: general editor only for v1; add dedicated preset if demand emerges.**
6. **Sign convention** — transverse load positive downward (current convention in `CLAUDE.md`)? Axial load positive in tension (matches member force convention)? Codify before implementation.
7. **Rendering** — hatched trapezoid between member axis and load magnitude line? Arrow per breakpoint? Legend with kN/m values? Minimum: label with magnitude(s); ideal: full hatched shape.

## Wave breakdown

Each wave ships independently. No wave reworks the previous wave's schema or solver core.

### Wave 1 — Schema + solver primitive + UDL preset (full and partial) + continuous UDL across collinear members

- **Target timing:** complete **before Phase 6 Tier 2 plan-phase begins** (schema lock)
- Solver: implement piecewise-linear ENA integral; assemble into existing `ENForces`/`ENMoments` pipeline
- Schema: `distributed_loads` array; coexist with legacy fields
- UI: Full UDL (preset) + Partial UDL (preset) + Continuous UDL (modifier) across collinear members
- Tests: full UDL equivalence with legacy; partial UDL on simply-supported beam matches closed-form; continuous UDL across 3 collinear members equals equivalent full-span UDL

### Wave 2 — Triangular and trapezoidal presets

- Extends wave 1 without solver changes (same ENA primitive, new pick mode)
- UI: unified triangular/trapezoidal pick mode with two magnitudes
- Tests: cantilever under triangular load matches closed-form tip deflection; trapezoidal case with hand-calc reactions

### Wave 3 — General breakpoint editor + continuous VDL across collinear members

- Extends wave 2 with full piecewise-linear entry and continuous-path modifier applied to triangular/trapezoidal
- UI: breakpoint table (open on pick); add/remove/edit rows; canvas re-renders as user edits
- Tests: mid-peak triangular via breakpoint editor matches hand-calc; continuous trapezoidal matches

### Wave 4 — Polish

- Visual render: hatched shape on canvas with magnitude labels
- Edit existing distributed load (click to select, edit breakpoints, delete)
- Legend showing load magnitudes
- Deprecation path for legacy `ENForces`/`ENMoments` — migration script + UI fallback
- Error messages for invalid inputs (non-monotonic breakpoints, negative lengths, etc.)

## Phase 6 Tier 2 timing flag

**Wave 1 — schema + solver primitive — should land before Phase 6 Tier 2 plan-phase begins.** Two reasons:

1. **Revit exporter writes to the canonical JSON schema.** If Tier 2 ships with legacy `ENForces`/`ENMoments` only, and `distributed_loads` lands later, the Revit exporter needs re-work to emit the new schema — retrofitting Revit → JSON output is significantly more expensive than getting the schema right the first time.
2. **The physical-vs-finite-element design question** (`.planning/notes/2026-04-22-physical-vs-finite-element-member-model.md`) and this distributed-load schema decision **interact**: if physical-member grouping is introduced, distributed loads should be specifiable on the physical member (auto-distributed to its child finite elements), not just on the elements. Both decisions ideally resolve before Tier 2 plan writing begins.

Recommended sequence before Tier 2 plan-phase:
1. Decide physical-vs-finite-element question (design note outcome)
2. Lock distributed-load schema (this todo, wave 1 design)
3. Implement wave 1 solver + schema
4. Phase 6 Tier 2 plan-phase begins with stable schema

Waves 2–4 can ship during or after Phase 6 without blocking it.

## Files likely in scope

- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — new `apply_distributed_loads()` helper implementing piecewise-linear ENA; integration into existing assembly
- `solver_core/src/pda_analysis_software/models/frame_model.py` — `distributed_loads` field
- `api_server/app.py` — request schema extension (Pydantic model for `distributed_loads`)
- `ui/frame2d/script.js` — pick modes, modifier for continuous, breakpoint editor, render
- `ui/frame2d/index.html` — toolbar buttons + breakpoint-editor dialog markup
- `ui/frame2d/style.css` — load rendering styles
- `tests/test_frame_v2.py` — analytical verification cases per wave

## Acceptance criteria (per wave)

### Wave 1 — Schema + solver + UDL (full, partial, continuous collinear)

- [ ] Schema locked: `distributed_loads` field documented with breakpoint + frame + group_id conventions
- [ ] Solver: piecewise-linear ENA implemented; derivation commented or test-documented
- [ ] Test: full UDL via new schema matches legacy `ENForces`/`ENMoments` path (equivalence)
- [ ] Test: partial UDL on simply-supported beam — reactions and mid-span moment match closed-form analytical values via `pytest.approx`
- [ ] Test: continuous UDL across 3 collinear members equals a single full-span UDL of same `w` and total length
- [ ] UI: Full UDL preset button (maintains existing UX)
- [ ] UI: Partial UDL preset — two clicks on member, magnitude entry
- [ ] UI: Continuous modifier — start-node + end-node pick with collinearity validation and clear error on non-collinear path
- [ ] Save/load round-trips Wave 1 loads through canonical JSON
- [ ] Legacy `ENForces`/`ENMoments` path still works — coexistence verified

### Wave 2 — Triangular + trapezoidal presets

- [ ] Unified pick mode: pick member, click start + end, enter `w_a` and `w_b`
- [ ] Test: cantilever under triangular load — tip deflection matches `wL⁴/(30EI)` via `pytest.approx`
- [ ] Test: trapezoidal on simply-supported beam — reactions match hand-calc
- [ ] Save/load round-trips Wave 2 shapes

### Wave 3 — Breakpoint editor + continuous VDL

- [ ] Breakpoint editor dialog: add/remove/edit rows; validates `x` monotonic
- [ ] Test: mid-peak triangular via editor matches `[(0,0), (L/2,w), (L,0)]` hand-calc
- [ ] Continuous modifier extends to triangular/trapezoidal presets
- [ ] Save/load round-trips arbitrary breakpoint configurations

### Wave 4 — Polish

- [ ] Canvas render: hatched/shaded shape with magnitude labels
- [ ] Click-to-edit existing distributed load
- [ ] Legacy `ENForces`/`ENMoments` deprecated with migration script; old saved JSON still loads
- [ ] Input validation errors surface clearly (non-monotonic `x`, negative lengths, etc.)

## Cross-references

- **Physical-vs-finite-element design note** (`.planning/notes/2026-04-22-physical-vs-finite-element-member-model.md`) — outcome affects whether loads attach to physical members or finite elements
- **Pure-bar joint todo** (`2026-04-22-frame2d-pure-bar-joint-instability.md`) — secondary finding: `apply_equivalent_nodal_actions` skips bars silently; this todo's solver work should fold in the decision on how to handle distributed loads on bar members
- **Additional load and action types** (`2026-04-22-frame2d-additional-load-and-action-types.md`) — Items 1b, 2, and 4 reuse the piecewise-linear ENA infrastructure
- **Member inspector + edit todo** (`2026-04-22-frame2d-ui-member-inspector-and-edit.md`) — edit affordance for distributed loads mirrors the member-edit pattern
- **Backlog 999.2** — load combinations build on the distributed-load schema

## Notes

This todo replaces the narrower "UDL continuous and partial" scope captured earlier on 2026-04-22. Wave 1's schema and solver primitive are the critical path; subsequent waves extend UI without solver rework.
