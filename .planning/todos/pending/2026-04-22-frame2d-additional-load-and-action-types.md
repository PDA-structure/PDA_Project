---
title: "frame2d: additional load and action types — future work"
status: pending
priority: P3
source: "captured from conversation 2026-04-22"
created: 2026-04-22
theme: solver+ui
target: "long-term — after the distributed-load-system todo (todo #5) lands"
---

## Goal

Capture a coherent set of load and action types beyond the distributed-load system (`2026-04-22-frame2d-udl-continuous-and-partial.md`), so the 2D frame tool reaches feature parity with commercial static-analysis tools (Tekla Structural Designer, Robot, SAP2000) before any 3D work begins.

These items are grouped into one todo because they share the same design area — "what kinds of inputs does the solver accept" — and will likely be designed together even if they ship separately.

## Context

User intent (2026-04-22): harden 2D frame fully before moving to 3D. Real structural design requires more than UDL + point loads + fixed/pin/roller supports. Without these, frame2d cannot validate against realistic loading cases from commercial tools.

Each item below is sized informally. Any can be promoted to its own phase via `/gsd-insert-phase` when ready to schedule.

---

## Item 1 — Point moment (at node, or at offset along member)

### 1a. Point moment at a node

**Complexity:** small. The global `forceVector` already accepts entries for the θ DOF (1-based indexing, `base = i*3 + 3` for node `i`'s θ). This is purely a UI addition — a "point moment" pick mode that writes to the θ row of the force vector at the picked node.

**Scope:**
- UI: pick-mode button; pick node; enter moment magnitude (kN·m, sign convention: CCW positive, matching standard structural convention)
- Data model: no change — uses existing `forceVector`
- Solver: no change
- Save/load: JSON already round-trips `forceVector` entries

### 1b. Point moment at an offset along a member

**Complexity:** medium. Requires ENA formulas for a concentrated moment `M` applied at position `a` along a beam of length `L`. Standard fixed-end formulas:

```
F_i = -6Ma(L-a)/L³           (shear at i)
M_i = M(L-a)(L-3a)/L²        (moment at i)
F_j = +6Ma(L-a)/L³           (shear at j, equal and opposite)
M_j = Ma(3a·L - L² - a²)/L²  (moment at j)
```

Closed-form, no numerical quadrature needed. Conventions to verify against a reference text before implementation.

**Scope:**
- Solver: add helper in `frame_v2.py` that computes ENA for concentrated moment at position `a` along a member; distribute into `ENForces` + `ENMoments`
- UI: pick-mode button; pick member; enter position (fraction of L, or m from start node) and magnitude
- Tests: cantilever with moment at tip (hand-calc: reactions and deflection known); simply-supported beam with moment at midspan

### Acceptance criteria (1a + 1b)

- [ ] UI pick-mode for point moment at node, with magnitude entry and visual render (curved arrow)
- [ ] UI pick-mode for point moment at offset along member, with position + magnitude entry
- [ ] Solver ENA formulas for offset moment, with hand-calc verification test
- [ ] Save/load round-trips both load types
- [ ] Sign convention documented: CCW positive

---

## Item 2 — Self-weight / gravity (auto-derived)

**Complexity:** small-to-medium. Adds a `density` field per member (or global default), and a "include self-weight" toggle on solve. When enabled, solver auto-generates a UDL on every member equal to `ρ·A·g` (downward in global Y).

**Open design questions:**
- Per-member `density` or global default with per-member override? (Default with override is more flexible; mirrors commercial tools.)
- Gravity direction assumption: always `-Y` for 2D frame, or configurable?
- Self-weight treated as its own load case (for future load-combination support) or folded into the main applied loads?
- Does self-weight show visually on the canvas (arrows on every member) or is it invisible but documented in the results?

### Scope

- Model: add `density: float` (optional) to per-member properties; add `include_self_weight: bool` to request body
- Solver: when `include_self_weight=True`, add UDL per member before assembly
- UI: toggle in a "loads" panel; optional density field per member (integrates with Point 2 inspector todo: `2026-04-22-frame2d-ui-member-inspector-and-edit.md`)

### Acceptance criteria

- [ ] Per-member density property with sensible defaults (steel ~7850 kg/m³, concrete ~2400 kg/m³, timber ~500 kg/m³)
- [ ] Toggle to include self-weight on solve
- [ ] Solver generates correct UDL = ρ·A·g per member under gravity (global -Y)
- [ ] Test: cantilever under self-weight only — mid-span deflection matches `ρAL⁴/(8EI)`
- [ ] Save/load round-trips density and self-weight toggle

---

## Item 3 — Imposed support displacement / settlement

**Complexity:** medium. Current solver partitions DOFs into restrained (UG = 0) and free (solved). Imposed displacement introduces a third category: **prescribed DOF** where `UG[i] = Δ ≠ 0`.

### Two implementation approaches

**(a) Partition + residual force method** (cleaner, structurally correct):
```
[ K_ff  K_fp ] [ u_f ]   [ F_f ]
[ K_pf  K_pp ] [ u_p ] = [ F_p ]

where u_p is the vector of prescribed displacements.

Then:  K_ff · u_f = F_f − K_fp · u_p   (solve for u_f)
       F_p_reaction = K_pf · u_f + K_pp · u_p   (reaction at prescribed DOFs)
```

**(b) Penalty method** (simpler implementation, potentially ill-conditioned):
Add a very large stiffness `K_pen` at the prescribed DOF with force `K_pen · Δ`. Solver sees it as an ordinary constraint.

Method (a) is preferred. Condition number of `K_ff` stays clean; no tuning of `K_pen`.

### Open design questions

- API: how does the user specify prescribed displacement? Extension of existing support types — e.g. `imposed_displacement: [{dof: int, value: float}]`?
- Per-DOF or per-support? (Per-DOF is more general.)
- Sign convention for rotational settlement (imposed θ at a support)?

### Scope

- Solver: refactor `solve_structure` to handle three DOF categories (restrained, prescribed, free)
- Model: add `imposed_displacement` field
- UI: extend support dialog to allow imposed displacement entry
- Tests: simply-supported beam with one support settling — hand-calc reactions and mid-span moment known

### Acceptance criteria

- [ ] Solver handles prescribed DOFs via partition method
- [ ] API accepts imposed displacement per DOF
- [ ] Reaction at prescribed DOF reports correctly
- [ ] Test: two-span continuous beam with middle support settling by Δ — hand-calc moment redistribution matches
- [ ] UI: settlement entry integrated with support dialog

---

## Item 4 — Thermal loads (uniform ΔT and gradient ΔT/depth)

**Complexity:** medium-to-large. Adds two new model fields (section depth `h`, coefficient of thermal expansion `α`) and two new equivalent nodal action paths in the solver.

### Uniform temperature change ΔT

Axial expansion restrained by end conditions produces an axial force:

```
F_axial_equivalent = E · A · α · ΔT
```

As equivalent nodal forces in local frame:
```
ENForces_local = [ −EAαΔT, +EAαΔT ]   along member axis
```

### Temperature gradient through section depth (ΔT/h)

Differential expansion produces a constant curvature and end moments. For a linear gradient `ΔT_top − ΔT_bottom = ΔT_g` over depth `h`:

```
M_thermal = E · I · α · ΔT_g / h
```

As equivalent nodal moments:
```
ENMoments_local = [ −EIα·ΔT_g/h, +EIα·ΔT_g/h ]
```

Both formulas assume restraint; the solver machinery computes the actual stress state by combining with equilibrium as usual. Closed-form, no quadrature.

### Open design questions

- Model fields: `section_depth` and `thermal_expansion_coef` — where do they live? (Per-member is cleanest; global defaults acceptable.)
- Units: depth in metres, α in 1/K (e.g. ~12e-6 for steel, ~10e-6 for concrete)
- Separate "thermal load" object on the model, or folded into member properties?
- Sign convention for gradient: which face is "top"? (Local +y in the beam's local frame is natural.)
- Interaction with self-weight and other loads — does the user specify multiple thermal load cases? (Relates to 999.2 load combinations.)

### Scope

- Model: add `section_depth: float`, `thermal_expansion_coef: float` per member (with defaults per material)
- Model: add `thermal_loads: [{member, delta_T_uniform, delta_T_gradient}]` list
- Solver: add `apply_thermal_actions()` that writes ENForces + ENMoments per affected member
- UI: thermal load pick-mode; section-depth field in inspector (builds on Point 2 inspector todo)
- Tests: axially restrained beam with uniform ΔT — axial force `= EAαΔT`; simply-supported beam with uniform gradient — mid-span deflection `= αΔT_g·L²/(8h)`

### Acceptance criteria

- [ ] Per-member `section_depth` and `thermal_expansion_coef` with material defaults
- [ ] API accepts thermal loads (uniform + gradient)
- [ ] Solver applies correct equivalent nodal actions
- [ ] Tests pass against closed-form solutions
- [ ] Save/load round-trips thermal loads

---

## Item 5 — Load cases and combinations

**Already captured** in roadmap backlog **Phase 999.2 — Load Combination Generator (Eurocode and British Standard)**.

Cross-reference only. Do not duplicate here. When 999.2 is promoted to an active phase, all items above that generate discrete load cases (self-weight, thermal, imposed displacement) should be integrated with the combination generator's data model.

---

## Cross-references

- `2026-04-22-frame2d-udl-continuous-and-partial.md` — distributed load system (the umbrella that Items 1b, 2, and 4 build equivalent-nodal-action paths on top of)
- `2026-04-22-frame2d-ui-member-inspector-and-edit.md` — per-member editing UI that density, section_depth, and thermal_expansion_coef fields would plug into
- `.planning/notes/2026-04-22-physical-vs-finite-element-member-model.md` — the physical/analytical member distinction affects how loads and prescribed actions are specified (on the physical member vs on the finite element)
- Roadmap backlog 999.2 — load combinations generator

## Suggested sequencing (not a commitment)

1. Ship distributed load system first (todo #5 — waves 1–4)
2. Point moment at node (Item 1a) — trivial, can go in a small plan alongside other UI work
3. Self-weight (Item 2) — small, high value, no schema break
4. Point moment at offset (Item 1b) — builds on distributed load infrastructure
5. Imposed displacement (Item 3) — medium phase on its own, bigger solver refactor
6. Thermal loads (Item 4) — medium-large phase, depends on section_depth field
7. Integrate into load combinations (999.2) — once multiple load cases exist

Each item ships independently. Order is negotiable based on user demand.
