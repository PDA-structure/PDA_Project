---
id: SEED-010
status: dormant
planted: 2026-05-12
planted_during: v1.3 — Revit Tier 2 + Results-Import (calc-platform spike in parallel sibling repo)
trigger_when: When a real project hits poor ground / shallow strata / new-build-over-mining requiring a raft instead of strip+pad — not first-job inevitable, but inevitable across the project portfolio
scope: Large (different design philosophy from strip+pad, more parameters, more sub-checks)
section: Foundations
related_seeds: [SEED-007, SEED-008]
references:
  - "~/Documents/handcals/refs/RC raft foundation.docx"
  - "~/Documents/handcals/refs/RC raft foundation_2.docx"
  - "~/Documents/handcals/refs/RC raft foundation_3.docx"
---

# SEED-010: Foundations — RC raft

Reinforced-concrete raft (mat) foundation per BS EN 1992-1-1, with
slab + edge-slab geometry, soil settlement modelled as "depression
diameter" (NHBC-style approach), and bending / shear / deflection
checks against allowable bearing pressure rather than EN 1997 bearing
capacity.

**Distinct from [[SEED-008]] (strip + pad).** Strip/pad use EN 1997
bearing capacity (Nq, Nc, Nγ machinery) and the foundation is sized
for a single load path. Raft is **whole-building** — distributes the
combined wall + column reactions across the full footprint, sized
against settlement-driven allowable pressure (typically 50–75 kN/m²
on residential soils).

## Why This Matters

Raft is the **second-line option** for residential when strip won't
work:
- Poor ground (made-ground, alluvial, shrinkable clay)
- Compromised existing foundations (historic settlement)
- New-build over old mining
- Shallow services / drainage runs preventing deep strip
- Mansard-style basement conversions where strip would undermine
  neighbours

Less frequent than strip + pad (~15–20% of residential jobs vs ~80%)
but **when needed, there's no substitute**. Tedds has a dedicated
calc (the 3 reference variants prove the user uses it regularly).

**Why split from SEED-008:** different design philosophy entirely.
Mixing into one foundations seed would confuse the spike scoping. From
the reference reading:

| Aspect | SEED-008 strip+pad | SEED-010 raft |
|---|---|---|
| Bearing | EN 1997 capacity (Nq,Nc,Nγ) | Allowable pressure (presumed) |
| Sizing variable | Width Ly / dimensions Lx×Ly | Slab thickness + edge thickening |
| Soil model | c′, φ′, density | Allowable + depression diameter |
| Standards | EN 1997 + EN 1992 | EN 1992 only |
| Geometry parameters | ~6 | ~15+ (slab, edge slabs × 4 sides) |
| Reinforcement design | Local | Two-way mesh across full slab |

## When to Surface

**Trigger:** when a real project needs a raft. Won't be first job, but
inevitable over the project portfolio. Often triggered by:
- Soils report flagging settlement / heave concern
- Architect's specification mandating raft (e.g. over mine workings)
- Conversion job where strip is uneconomical due to existing
  underpinning constraints

This seed should be presented during `/gsd-new-milestone` when:
- Milestone scope mentions "raft", "mat foundation", "settlement",
  "uniform bearing"
- Milestone follows a real-project test that hit a raft requirement
- Plant SEED-008 first; raft naturally follows once strip+pad are
  proven

## Scope estimate

**Large**. The 3 reference variants suggest the calc has multiple
configurations:

- **Variant 1** (`RC raft foundation.docx`): Edge/corner slab,
  bearing pressure 24.7 kN/m² edge — appears to be a residential raft
  with edge-strip thickening
- **Variant 2** (`RC raft foundation_2.docx`): Both edge AND
  interior slab regions, 83.0 / 20.9 kN/m² — larger building, mixed
  use perhaps
- **Variant 3** (`RC raft foundation_3.docx`): Edge + interior at
  69.8 / 20.9 — third geometric configuration

All three use the same calc engine (Tedds v1.0.06) — the variants are
**input configurations**, not different calc paths.

Likely structure: one base template with parameterised regions:
1. **Slab interior** — standard 2-way RC slab on grade
2. **Edge slab strips** — thickened periphery, takes wall line-load
3. **Corner regions** — load concentration

Plus the common machinery:
- Concrete properties (Table 3.1) — full EC2 derivation
- Reinforcement (top/bottom, both directions)
- Soil profile (allowable bearing, depression diameter, hardcore)
- Load path: walls → edge slabs → soil; columns → interior → soil

Estimate: **two or three phases**.
- Phase A: base raft geometry + slab interior check (1-way bending,
  shear, deflection)
- Phase B: edge slab + corner integration
- Phase C: punching shear at column drops + reinforcement detailing

Bigger than SEED-008's strip/pad sub-templates — and rare enough that
deferring this until SEED-008 is solid is the right move.

## Tedds format target (from references)

All 3 refs share the same Tedds calc layout (Tedds v1.0.06). Key
header structure:

```
RC raft foundation (EN 1992-1-1)
Design summary
  Overall design status: PASS
  Overall design utilisation: 0.998

Slab
Edge/corner slab
Concrete details - Table 3.1 (full derivation: fck, fcm, fctm, Ecm, fcd, ...)
Reinforcement details (fyk, γS, fyd)
Soil properties
  Allowable bearing pressure: qallow = 50.0 kN/m²
  Soil classification: C - Two or more variable soil types but firm
  Density of hardcore: ρfill = 20 kN/m³
  Angle of dispersal from horizontal: αfill = 60.0 deg
  Assumed diameter of depression: φdep_basic = 2500 mm

Slab details
  Slab thickness: hslab = 250 mm
  Hardcore thickness: hfill_slab = 150 mm
  Diameter of depression modified: φdep_slab = φdep_basic - hfill_slab·b1 = 2350 mm
  Cover top/bottom: cnom_slab_t = 35 mm, cnom_slab_b = 35 mm
  Top reinforcement: A393 mesh - 10mm at 200 c/c
  davg_t_slab = hslab - cnom_slab_t - ft = 205 mm

Slab UDL loading
  wG_slab = 0.0 kN/m², wQ_slab = 5.0 kN/m²

Slab design check
  wslab = ρconc·hslab = 6.1 kN/m²
  wfill_slab = ρfill·hfill_slab = 3.0 kN/m²
  Total uniform load at formation: Fslab = 14.1 kN/m²
  PASS - allowable bearing pressure exceeds bearing pressure at formation level

Self weight and UDL forces in slab
  Effective span: leff_slab = (φdep_slab + davg_t_slab)/2 = 1278 mm
  Ultimate ws&UDL: Fult_slab = 1.35·(wslab + wG) + 1.5·wQ = 15.8 kN/m²
  Moment at depression edge: Mneg = (Fult·π·leff²)·(leff/3)/(2·π·leff) = 4.3 kNm/m
  Shear: Vslab = Fult·leff/2 = 10.1 kN/m

Reinforcement required in top of slab for bending
  Ktotal = M/(d²·fck) = 0.004
  K' = (2·η·αcc/γC)·(1 - λ·(δ-k1)/(2·k2))·... = 0.207
  Lever arm z = ... = 190 mm
  As,min = max(0.26·fctm/fyk, 0.0013)·d = 295 mm²/m
  As,req = M/(fyd·z) = 52 mm²/m
  PASS - Provided exceeds required

Shear resistance with no shear reinforcement
  [full §6.2.2 derivation]
  PASS

Deflection control - Section 7.4
  [full §7.4 derivation with span-to-depth ratio]
  PASS

[then the same set of checks for Edge slab 1, Edge slab 2, etc.]
[then equivalent line loads, centroid of loads, bearing pressure at edge]
```

The **depression diameter** concept is the unusual bit — it's
effectively a NHBC-style settlement model where the raft is assumed
to span a circular depression of given diameter (typical 2500mm).
That's how the slab gets "loaded" — the slab between depressions is
treated as a 2-way slab with effective span = (depression diameter +
effective depth)/2.

## Concrete starting point

```
~/Documents/handcals/marimo_spike/
  foundations/
    raft.py        # this seed's deliverable
    _raft_common.py  # depression-model + region-load helpers
```

Reactive inputs:
- Concrete + reinforcement (shared with [[SEED-008]] RC variants —
  refactor opportunity if both built)
- Soil: allowable bearing pressure, classification, hardcore properties,
  depression diameter
- Slab regions: list of `RaftRegion(name, thickness, cover, top/bot
  reinforcement, UDL loads, line loads)` — interior, edge, corner each
  as one region
- Line loads: list of `LineLoad(wall_id, w_perm, w_var, x_from_edge)`

Outputs:
- Per-region: bearing pressure check, bending design, shear, deflection
- Overall: governing utilisation, PASS/FAIL
- Summary table matching Tedds layout

## Breadcrumbs

- New: `pda_project/calc_templates/foundations/raft.py`
- Shared with [[SEED-008]]: `_concrete_properties.py` (EC2 Table 3.1
  derivation), `_reinforcement.py` (fyd, As_min)
- Integration with 2D frame solver (via [[SEED-005]]) — multi-node:
  iterate over column-base nodes, sum reactions, route to raft
  interior; iterate over wall-bottom nodes, route to edge regions
- Integration with [[SEED-006]] compiled report: raft chapter shows
  plan view + per-region check tables

Memory entries:
- [[calc_platform_calc_topics_taxonomy]] — **Foundations** section
- [[calc_platform_integration_strategy]] — raft is a Phase B
  foundation (after strip/pad are solid)
- [[calc_platform_workflow_vision]] — raft completes the foundation
  coverage at residential scale
- [[calc_platform_pedagogical_transparency]] — depression model needs
  explicit assumption documentation (it's a simplified settlement
  approach)

## Open questions to resolve at trigger time (NOT now)

- **Depression diameter:** NHBC default is 2500mm for typical clay; the
  reference uses 2500mm. Should this be a parameter (per-site soil
  report) or a defaulted assumption? Probably both — exposed input
  with sensible default.
- **2-way vs 1-way analysis:** the reference uses a simplified 1-way
  effective-span approach (`leff = (φdep + d)/2`). For larger rafts a
  proper 2-way / FEA approach is needed. Scope decision: keep the
  template at 1-way (matches Tedds, fast, residential-adequate); flag
  in template comments that for complex geometries a 2-way FEA is
  recommended.
- **Edge / interior split:** the reference variants 2 and 3 show both
  edge AND interior regions. The split point matters — typically
  the edge region extends ~1m in from the wall line. Should be
  parameterised.
- **Punching shear at columns:** if the raft supports columns (mixed-
  use buildings), need full §6.4 punching check at each column. The
  3 residential references don't show this — likely because residential
  rafts are wall-loaded only. Add when commercial use surfaces.
- **Heave allowance:** for shrinkable clay sites the raft may need
  designed for heave (uplift) as well as gravity load. Tedds doesn't
  show this in the residential refs but it's required on NHBC sites.

## Notes

Origin: 2026-05-12 conversation. User pointed at 3 RC raft refs alongside
strip/pad refs; agreed when proposed that raft is conceptually distinct
enough to deserve its own seed.

The depression-diameter modelling is the key insight — Tedds's approach
is much more pragmatic than treating the raft as a plate on Winkler
springs (which would need FEA). Residential raft design is fundamentally
a sizing exercise, not an analysis exercise. Keep the template
proportionate.
