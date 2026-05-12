---
id: SEED-009
status: dormant
planted: 2026-05-12
planted_during: v1.3 — Revit Tier 2 + Results-Import (calc-platform spike in parallel sibling repo)
trigger_when: When the real-project test hits a beam landing on a masonry wall — almost every loft / extension job has at least one of these
scope: Medium (single template, but rich — combines two coupled checks)
section: Masonry
related_seeds: [SEED-007, SEED-008]
references:
  - "~/Documents/handcals/refs/Masonry concrentrade + padstone.docx"
---

# SEED-009: Masonry concentrated load + padstone

A combined check for **two tightly-coupled design problems** that almost
always appear together in residential SE work:

1. **Concentrated bearing on masonry** — does the wall accept a point
   load delivered to its top face? Per BS EN 1996-1-1 §6.1.3, with the
   enhancement factor β (eq. 6.10 / 6.11) capturing the local-vs-effective
   bearing area ratio and the distance to the wall edge.

2. **Padstone (spreader) design** — if the local bearing fails (typical
   case for any steel beam over ~2.5m span), what concrete padstone
   spreads the load into the wall enough for it to pass? Modelled as a
   **beam on elastic foundation** using Winkler theory and Krilov's
   functions — gives the full deflection/moment/shear distribution in
   the padstone and the peak reaction stress on the masonry.

## Why This Matters

Every loft conversion and most extensions land at least one new steel
beam on existing masonry. The bearing check is mandatory before the
beam can be specified. Currently:

- **By hand:** engineers use the BS table for typical β values and
  guesstimate the padstone — fast but not auditable, no record of why
  *that* padstone was chosen.
- **Tedds:** has a full template (`Masonry bearing design`, Tedds
  v1.0.14) — accurate but locked behind the Tedds licence and produces
  a calc that's identical for every project (the workflow-integration
  gap that motivates the whole platform).
- **Excel:** rarely covers the Krilov spreader analysis properly;
  reduces to "100×100×440 padstone, no calc."

The Tedds template (the reference) demonstrates the value of doing it
properly:

- For Concentrated Load 1 (29.6 kN, 100×100 bearing, edge of wall): bare
  masonry resistance = 23.8 kN → **FAIL without padstone**
- With a 100×65×440 mm concrete padstone, the elastic-foundation analysis
  shows max stress under the padstone = 0.87 N/mm² vs allowable
  β·fd = 2.38 N/mm² → **PASS, utilisation 0.366**

That's the kind of "do the right calc once, get the right answer with
audit trail" that the platform's pedagogical-transparency thesis
(`calc_platform_pedagogical_transparency.md`) is built on.

## When to Surface

**Trigger:** when the real-project test hits a beam landing on masonry.

This seed should surface during `/gsd-new-milestone` when:
- Milestone scope mentions "padstone", "bearing", "concentrated load",
  "masonry support"
- Milestone follows a real-project test that needed this check
- Milestone scope is "extending Masonry section of calc library"

Likely couples with [[SEED-008]] (a project with a beam-on-masonry
usually has a foundation under the wall too) and [[SEED-007]] (the
beam reaction is a derived load from the build-up).

## Scope estimate

**Medium**. Single template but rich because two sub-checks are
combined:

| Sub-check | Lines (est.) | Complexity |
|---|---|---|
| Masonry properties (fk, fd from fb, fm, K, γM) | ~30 | Low — table lookups + eq. 3.1 |
| Slenderness check §5.5.1.4 | ~10 | Trivial |
| Concentrated load check §6.1.3 (β factor) | ~30 | Low — eq. 6.10 / 6.11 |
| Padstone as beam on Winkler foundation (Krilov) | ~80 | **Medium-high** — hyperbolic / trig Krilov functions, initial-conditions method |
| Walls subjected to vertical loading §6.1.2 (capacity reduction Φ) | ~30 | Medium — Annex G |
| Tabular summary + PASS/FAIL | ~10 | Low |

Total: ~190 lines for one masonry leaf, one concentrated load. Add a
loop for multiple loads. Padstone analysis is the technical risk —
Krilov functions are not standard in Python scientific libraries, will
need writing from scratch (they're 2-line formulas, just unusual).

## Tedds format target (from reference)

The reference walks through TWO concentrated loads on the same wall
(both fail bare, both need padstones, both pass with padstones). Key
output structure:

```
Masonry bearing design (EN 1996-1-1)
Masonry panel details: L=8000, h=2500, t=100, hef=2500, tef=100
Masonry material details: Clay Group 1, fc=10, k=1, dsf=1.38 → fb=13.8
Mortar M4: fm=4.0, K=0.50
Characteristic compressive strength - eq. 3.1
  fk = K × fb^0.7 × fm^0.3 = 4.76 N/mm²
Design compressive strength: γM=3.0 (Cat II, Class 2 EC) → fd=1.59 N/mm²
Slenderness check: λ = hef/tef = 25.0 < 27 → PASS

Concentrated Load 1 details: Gk=5.9, Qk=14.4, ec=0, Lc×wc=100×100
                            distance to edge a1 = 2450 mm

Walls subjected to concentrated loads - Section 6.1.3
  Eccentricity check: ec ≤ t/4 → PASS
  Area of bearing: Ab = 10000 mm²
  Effective length at mid-height: lefm = Lc + hc·tan(30°) = 1543 mm
  Effective bearing area: Aef = lefm × t = 154338 mm²
  Aratio = min(Ab/Aef, 0.45) = 0.06
  βinit = max((1 + 0.3·a1/hc)·(1.5 - 1.1·Aratio), 1.0) = 1.85
  βmax = min(1.25 + a1/(2·hc), 1.5) = 1.50
  β = min(βinit, βmax) = 1.50

  NEdc = γfG·Gk + γfQ·Qk = 29.57 kN
  NRdc = β·Ab·fd = 23.79 kN
  Applied concentrated load exceeds design resistance, spreader required!

Design of spreader beam (Concrete padstone)
  Lsp = 440, hsp = 65, wsp = 100, esp = 0
  Esp = 27085 N/mm², Isp = 1/12·wsp·hsp³ = 2.289e6 mm⁴
  Modulus of wall: k0 = Ew/h = 1.90 N/mm²/mm
  Winkler's constant: Kc = k0·wsp = 190.35 N/mm/mm
  Characteristic α = (Kc/(4·Esp·Isp))^¼ = 0.00526 mm⁻¹
  αL = 2.32 → Medium classification

  [Krilov functions Bα,L, Cα,L, Dα,L; Aα,P1, Bα,P1]
  [Method of initial conditions: solve for δ0, φ0]
  [Compute max deflection, max moment, max shear]

  Maximum reaction: NEdsp = Kc·δmax = 87.08 kN/m
  Design stress: σEdsp = NEdsp/wsp = 0.87 N/mm²
  Allowable: σRdsp = β·fd = 2.38 N/mm²
  PASS - Design stress under spreader is less than allowable

Walls subjected to mainly vertical loading - Section 6.1.2
  [Φm reduction factor from Annex G — eq. G1, G2, G3]
  NRd = Φm·t·fd = 77.50 kN/m
  PASS - Design value of vertical resistance exceeds applied vertical load
```

## Concrete starting point

```
~/Documents/handcals/marimo_spike/
  masonry/
    bearing_and_padstone.py   # this seed's deliverable
```

Reactive inputs (marimo cells):
- Wall: L, h, t, tef, hef, masonry properties (unit type, fc, hu, wu, k,
  shape factor dsf), mortar type, EC class, manufacturing control
- Loads: list of `ConcentratedLoad(Gk, Qk, ec, Lc, wc, hc, distance_to_edge)`
- Padstone (per load): material (concrete or steel), Lsp, hsp, wsp, esp

Outputs:
- Per-load bare-masonry check (PASS / SPREADER REQUIRED)
- Per-padstone Krilov analysis → max deflection / moment / shear /
  reaction / stress (handcalcs-rendered)
- Summary table matching the Tedds layout (table with 7 columns: Load,
  Local design force, Local resistance, Spreader design stress,
  Spreader resistance, Utilisation, Result)

## Krilov functions — concrete formulas to lift

From the Tedds reference (these are the unusual bit):

```
α = (Kc / (4·Esp·Isp))^¼              [characteristic of system, mm⁻¹]
αL = α · Lsp                          [classification: short/medium/long]

Aαx = cosh(αx)·cos(αx)                [where αx is in radians]
Bαx = ½·(cosh(αx)·sin(αx) + sinh(αx)·cos(αx))
Cαx = ½·sinh(αx)·sin(αx)
Dαx = ¼·(cosh(αx)·sin(αx) − sinh(αx)·cos(αx))
```

Method of initial conditions:
- For free-free padstone with one point load at distance P1 from LH
  edge: solve 2×2 linear system for δ0 (initial deflection) and φ0
  (initial rotation) from M(L)=0, V(L)=0 conditions
- Deflection / moment / shear at any x then derived from
  Aαx · δ0 + Bαx · φ0/α + particular-integral term

This is the "rich technical bit" of the template. Worth a 20-line
standalone Python helper that any future spreader / pile-cap calc can
reuse.

## Breadcrumbs

Where this lands when integrating into pda_project:

- New: `pda_project/calc_templates/masonry/bearing_and_padstone.py`
- New: `pda_project/design_core/winkler.py` — Krilov functions + initial-
  conditions solver (reusable for retaining-wall stem-base interactions,
  pile head, padstone, masonry plinths, anything beam-on-Winkler)
- Integration with [[SEED-005]] factory: `from_solver_result` consumes
  the beam reaction at a support node from the 2D frame solver
- Integration with [[SEED-008]] foundations: the wall under the masonry
  panel needs a strip footing — same calc, same project namespace
- Integration with [[SEED-007]] load build-up: the beam reaction is a
  derived load from the project namespace

Memory entries:

- [[calc_platform_calc_topics_taxonomy]] — this lives in the **Masonry**
  section
- [[calc_platform_pedagogical_transparency]] — the Krilov derivation
  should be visible step by step; if hidden, the calc reduces to "use
  100×65×440 padstone" which is exactly what we're replacing
- [[calc_platform_workflow_vision]] — beam-on-masonry is one of the
  workflow's universal junctions
- [[calc_platform_tedds_reference_available]] — Tedds ref is the format
  + clause match target

## Open questions to resolve at trigger time (NOT now)

- **Padstone material:** concrete (typical) or steel plate (rarer,
  thinner padstones in cavity walls)? Tedds parameterises by Esp /
  fy_padstone. Probably worth a `material` enum.
- **Cavity wall:** the reference is single-leaf (load-bearing inner).
  Cavity wall with load on inner leaf only is the common residential
  case — should be the default geometry, with single-leaf as a
  simplification.
- **Steel padstone shear / bending capacity:** for steel padstones,
  also check the plate in bending (separate check beyond the masonry
  resistance). The Tedds reference is concrete-only, so we'll cover
  steel when a project needs it.
- **β notation clash:** EC6 β here is a bearing enhancement factor; EC2
  β for punching shear in [[SEED-008]] is a load-distribution factor.
  Different symbols, same letter — the user-facing calc should
  disambiguate with subscripts (β_bearing, β_punching) or full words.
- **Mid-height vs top-of-wall check:** EC6 requires both. Tedds does
  both. We must too.

## Notes

Origin: 2026-05-12 conversation with user-provided Tedds reference. The
Krilov-functions approach to spreader design is sophisticated enough
to be a differentiator — most engineers default to "100×140×440 stock
padstone" without checking; this template makes the choice defensible.

Workflow surprise from the same conversation: the Llanfair Farm PDF
contains masonry-panel-under-wind (different problem, §6.3, EC6 Annex
F) and steel-masonry-support (different problem, beam carrying masonry
above) — NOT this concentrated-load-into-wall check. Three distinct
masonry calcs in EN 1996-1-1; this seed covers only the third.
