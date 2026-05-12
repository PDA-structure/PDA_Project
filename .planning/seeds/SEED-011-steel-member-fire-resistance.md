---
id: SEED-011
status: dormant
planted: 2026-05-12
planted_during: v1.3 — Revit Tier 2 + Results-Import (calc-platform spike in parallel sibling repo)
trigger_when: When the real-project test hits a steel beam over habitable space requiring fire resistance — first loft conversion or beam-over-ceiling job will do it
scope: Small-Medium (self-contained calc, EN 1993-1-2 single-method)
section: Steel
related_seeds: [SEED-008, SEED-009]
references:
  - "~/Documents/handcals/refs/Steel member fire resistance design.docx"
---

# SEED-011: Steel member fire resistance (EN 1993-1-2)

A standalone marimo template for fire-resistance design of a steel
member per BS EN 1993-1-2. Computes the **section factor** (Am/V),
**critical temperature** θa,crit, and verifies the member survives the
required fire period — with options for unprotected and protected
(intumescent paint / boarded) configurations.

## Why This Matters

Almost every residential **loft conversion** and most **rear-extension**
jobs include a steel beam in a position that needs a fire rating:
- Beam supporting a floor between habitable rooms → 30 min (R30) min
- Beam supporting a floor between dwellings or apartments → 60 min (R60)
- Beam at compartment line → can rise to R90

Current practice fragmentation:
- **Tedds** (the reference): proper EN 1993-1-2 calc with section factor,
  critical-temperature method (eq. 4.22), choice of protection
- **By hand:** look up from a manufacturer's pre-calculated table
  (Tata, British Steel) — fast but no audit trail
- **Building Control rule-of-thumb:** "use 1 layer of 12.5mm fireline
  board" — usually conservative, sometimes uneconomical

The platform's pedagogical-transparency thesis applies cleanly here:
showing the section factor, the critical temperature derivation, and
the protection-thickness lookup makes the answer defensible — and
**fast** if it's a template instead of a from-scratch calc.

## Why this seed exists now

The user included this reference in the May-2026 batch even though it
wasn't requested. Reading the .docx confirmed:
1. It's a self-contained calc — no dependency on other templates
2. It opens the **Steel** section of the calc taxonomy
   ([[calc_platform_calc_topics_taxonomy]]) for fire-design coverage
3. It's narrowly scoped (~80 lines from the Tedds output) — small
   enough to be a single-phase template

Planting now captures the format intent before the reference batch
loses its freshness. Implementation defers until a real-project hit.

## When to Surface

**Trigger:** first loft conversion or beam-over-ceiling job in real
projects.

Surfaces during `/gsd-new-milestone` when:
- Milestone scope mentions "fire", "R30", "R60", "intumescent",
  "section factor", "protection"
- Milestone follows a real-project test that hit a fire-rating
  requirement
- Milestone scope is "extending Steel section of calc library"

May couple with existing EC3 steel beam template — most-natural
sequencing is: design the beam to EC3 ambient → then check the same
beam to EC3 fire as a separate report chapter.

## Scope estimate

**Small-Medium**. The Tedds reference is ~80 lines and uses a single
method (critical temperature approach, §4.2.4 + eq. 4.22). One phase.

Sub-checks from the reference:

| Sub-check | Description |
|---|---|
| Section factor Am/V | From Table 4.3 — depends on section type + exposure (3-sided, 4-sided) |
| Degree of utilisation μ0 | Load ratio at fire LC (typically 0.65 of cold check) |
| Critical temperature θa,crit | Eq. 4.22 — 39.19·ln(1/(0.9674·μ0^3.833) - 1) + 482 |
| Unprotected member | Time-temperature curve, ISO 834 standard fire, check at required period |
| Protected member | Thermal conductivity / thickness of protection (intumescent / board) — iterate to find thickness giving θa < θa,crit at required period |
| Output | Required protection thickness OR unprotected adequacy + safety margin |

The Tedds calc version 1.0.05 is relatively simple — single member,
single fire scenario, single protection type per run. Multi-member or
multi-scenario is out of v1 scope.

## Tedds format target (from reference)

Top of calc:

```
Steel member fire resistance design (EN 1993-1-2)
In accordance with EN 1993-1-2:2005 incorporating Corrigenda Dec 2005,
Sept 2006 and Mar 2009 and the UK national annex
Tedds calculation version 1.0.05

Design summary
  Overall design status: [PASS/FAIL]
  Overall design utilisation: [value]

[Section properties block — section type, fy, fu, E, h, b, t, ...]

Critical temperature - Section 4.2.4
  Critical temperature - exp. 4.22
    θa,crit = 39.19·ln(1/(0.9674·μ0^3.833) - 1) + 482 = 826 °C
  Section factor - Table 4.3
    SF = Am/V = 270.47 m⁻¹
  ...
  Critical temperature results
    θa,crit = 826 °C
```

The reference appears to stop at deriving θa,crit + section factor —
either the rest is variable-driven from a Tedds library (`_exVarsLib`
references suggest this) or this particular ref is showing only the
critical-temperature method without the protection thickness derivation.
A second pass on the Tedds output may be needed at implementation
time to confirm whether protection-thickness selection is included.

## Concrete starting point

```
~/Documents/handcals/marimo_spike/
  steel/
    fire_resistance.py   # this seed's deliverable
```

Reactive inputs:
- Section: type (UB/UC/RHS/CHS), grade, dimensions (or section name +
  lookup from `sections/` library)
- Exposure: 3-sided (under floor) or 4-sided (free-standing)
- Fire LC: combination factors per EN 1990 fire LC
- Applied loads at fire LC (or load ratio if simpler)
- Fire period required: R30 / R60 / R90 / R120
- Protection: none / intumescent (with manufacturer thickness table) /
  board (with k-value)

Outputs:
- Section factor Am/V (m⁻¹)
- Degree of utilisation μ0
- Critical temperature θa,crit (°C)
- For unprotected: time-temperature derivation → PASS if θa(t_required)
  < θa,crit
- For protected: minimum protection thickness → from manufacturer
  table or thermal calc

## Breadcrumbs

- New: `pda_project/calc_templates/steel/fire_resistance.py`
- Shared with existing EC3 steel beam / column templates: section
  property lookup, member naming
- Integration with [[SEED-005]] factory: `from_solver_result` would
  take the same beam used in the cold check and re-run at fire LC
- Integration with [[SEED-006]] compiled report: fire check chapter
  per member as a separate sub-section

Memory entries:
- [[calc_platform_calc_topics_taxonomy]] — **Steel** section, fire
  sub-topic
- [[calc_platform_workflow_vision]] — closes the "every loft job"
  workflow gap
- [[calc_platform_pedagogical_transparency]] — section factor + θa,crit
  derivation visible
- [[calc_platform_tedds_reference_available]] — Tedds ref shows format
  target; may need expanding when implemented

## Open questions to resolve at trigger time (NOT now)

- **Protection thickness lookup:** intumescent paint thicknesses come
  from manufacturer-specific tables (Sherwin-Williams Firetex, Nullifire,
  PPG). Should the template ship with a small library of these, or
  defer to user-input k-value? Probably user-input k-value for v1 +
  small library when a real project needs a specific manufacturer.
- **Time-temperature integration:** for unprotected and protected
  members the actual temperature rise needs integrating over time
  using the §4.2.5 incremental method (eqs. 4.25 / 4.27). Worth a
  small helper that runs the time-step iteration. Standard approach.
- **Composite fire design:** beams within concrete slabs get composite
  protection from the slab. Common in residential. EN 1994-1-2 (composite
  fire). Adjacent seed — flag if scope expands.
- **Connection fire:** the column-to-beam connections in fire often
  govern. EN 1993-1-8 + EN 1993-1-2 interaction. Out of scope for v1.
- **Acceptance criteria:** UK Building Regs Approved Document B sets
  the period required; the template should let user input it directly,
  not try to infer from building class.

## Notes

Origin: 2026-05-12 conversation. User included this reference in the May
2026 batch without explicitly asking for the seed — noted that fire is
common on residential lofts and beams between dwellings. The Steel-fire
section of the calc taxonomy starts here.

Implementation deferred until a real-project hit confirms scope (e.g.
"this project needs R60 on the principal beam — does the platform
answer?"). Seed exists to capture the Tedds format target before the
reference batch context decays.
