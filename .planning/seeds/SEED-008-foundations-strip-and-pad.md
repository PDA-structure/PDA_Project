---
id: SEED-008
status: dormant
planted: 2026-05-12
planted_during: v1.3 — Revit Tier 2 + Results-Import (calc-platform spike in parallel sibling repo)
trigger_when: When the real-project test of the calc platform reaches its first job that needs a foundation design — almost certainly the first job, because every residential SE project ends in a foundation calc
scope: Medium-Large (one phase per sub-template; 5 sub-templates total)
section: Foundations
related_seeds: [SEED-007, SEED-010]
references:
  - "~/Documents/handcals/refs/Unreinforced strip foundation example.docx"
  - "~/Documents/handcals/refs/Strip foundation with two walls example.docx"
  - "~/Documents/handcals/refs/Unreinforced pad foundation example.docx"
  - "~/Documents/handcals/refs/Pad foundation example_1.docx"
  - "~/Documents/handcals/refs/Pad foundation with two columns example.docx"
---

# SEED-008: Foundations — strip and pad (unreinforced + RC variants)

Marimo calc templates for the two foundation types that close out almost
every residential SE job: **strip footings** under walls and **pad
foundations** under columns. Both come in unreinforced (plain-concrete
projection check per EN 1992-1-1 §12.9.3) and reinforced (full bending /
shear / crack-width / punching) variants.

## Why This Matters

The 5 templates built during the spike phase (BS 8110 RC, EC2 RC, EC3
steel beam, EC3 steel column, EC5 timber beam) all sit at the
*superstructure* layer — they take loads and return member sizes. None
of them deliver the actual answer that planners and contractors care
about: **what's the footing under this wall / column?**

Foundation design is also the calc with the highest fee-leverage on
residential work. From `calc_platform_integration_strategy.md`:

> the user's fee is small on residential, so the highest-leverage
> automation is exactly what residential SE work hits every job —
> Loading + Foundations (strip + pad) + Masonry + simple Beams.

Strip + pad together cover ~95% of residential foundation work
(remaining 5% = raft for difficult sites — see [[SEED-010]]).

**Workflow integration angle:** column / wall reactions come out of the
2D frame solver as `FG` entries. A `from_solver_result` factory (SEED-005)
should feed those directly into the strip/pad template:

```
solver_result.FG  →  strip_foundation.from_solver_result(node_id="A1")
                  →  PASS/FAIL + sizing recommendation
```

Without strip+pad, the workflow stops one calc short of "what gets
built."

## When to Surface

**Trigger:** when the real-project test of the calc platform reaches a
foundation calc — likely the first project, because every residential
SE job ends in a footing.

This seed should be presented during `/gsd-new-milestone` when:
- Milestone scope mentions "foundation", "footing", "settlement",
  "bearing pressure"
- Milestone follows a real-project test that flagged a missing
  foundation calc
- Milestone is described as "closing the residential workflow"

May surface **alongside** [[SEED-007]] (load build-up calculator),
because the foundation calc consumes loads from the build-up.

## Scope estimate

**Medium-Large** — five sub-templates, but each is a variant of two
base patterns:

| Sub-template | Pattern | Code path | Effort |
|---|---|---|---|
| Strip — unreinforced, 1 wall | Base strip | EN 1997 bearing + EN 1992 §12.9.3 plain | S |
| Strip — RC, 1–2 walls | Base strip + RC | EN 1997 + EN 1992 full | M |
| Pad — unreinforced, 1 column central | Base pad | EN 1997 bearing + EN 1992 §12.9.3 plain | S |
| Pad — RC, 1 column eccentric | Base pad + RC | EN 1997 + EN 1992 + punching | M |
| Pad — RC, 2 columns | Base pad + RC + multi-load | EN 1997 + EN 1992 + punching | M |

Estimate: **two phases**. Phase A = base strip + base pad (unreinforced
variants), validates the geometry / load-takedown / bearing
machinery. Phase B = RC variants + multi-load geometries. Splitting
keeps each phase shippable.

## Tedds format target (from references)

All 5 refs share the **same calc layout** (Tedds v3.3.06–3.3.07):

```
Strip foundation details - considering a one meter strip
Length of foundation;            Lx = 1000 mm
Width of foundation;             Ly = 800 mm
...
Foundation loads
Permanent surcharge load;        FGsur = 5.0 kN/m2
Self weight;                     Fswt = h × γconc = 7.5 kN/m2
Wall no.1 loads per linear metre
Permanent axial load;            FGz1 = 70.0 kN
Variable axial load;             FQz1 = 35.0 kN

Design approach 1
Partial factors on actions - Combination 1
  γG = 1.35, γQ = 1.50, γGf = 1.00, γQf = 0.00
Bearing resistance (Section 6.5.2)
  ...full bearing capacity derivation with Nq, Nc, Nγ...
PASS - Ultimate bearing capacity exceeds design base pressure

[then Combination 2 with γG = 1.00, γQ = 1.30]
[for RC variants: then Concrete details → Reinforcement → bending/shear/crack]
[for plain: then EN 1992 §12.9.3 projection check]
```

Sign convention: positive Q downward; reactions FGz / FQz; eccentricity
ex/ey from centre of base.

## Concrete starting point

Five `forallpeople`-backed marimo templates:

```
~/Documents/handcals/marimo_spike/
  foundations/
    strip_unreinforced.py       # 1-wall strip, plain concrete
    strip_rc_two_walls.py       # 2-wall strip, RC
    pad_unreinforced.py         # 1-col central, plain concrete
    pad_rc_eccentric.py         # 1-col eccentric, RC + punching
    pad_rc_two_columns.py       # 2-col, RC + punching
```

Each follows the existing `marimo_spike` pattern:
- Reactive inputs (geometry, loads, soil, materials)
- handcalcs-rendered derivation
- forallpeople for all dimensional algebra
- "Design summary" table at the top (matching Tedds layout)
- PASS/FAIL bands

DA1 Combinations 1 and 2 should be parameters — the calc runs both and
reports the governing case (matches Tedds).

## Breadcrumbs

Where this lands eventually (when integrating into pda_project per
`calc_platform_integration_strategy.md`):

- New: `pda_project/calc_templates/foundations/` package (5 modules
  + a `_common.py` for shared bearing-capacity / partial-factor logic)
- Integration with [[SEED-005]] factory pattern:
  - `from_solver_result(result, node_id="A1")` — takes a 2D frame
    result and a node ID, extracts FG[node], routes vertical / moment
    to the foundation
  - `from_loads(Gk=..., Qk=..., M=...)` — standalone for foundations
    not driven by analysis (most residential strip is hand-takedown)
- Integration with [[SEED-007]] load build-up calculator: foundation
  template reads `g_k`, `q_k`, etc. from the project namespace by
  default; user can override
- Integration with [[SEED-006]] compiled report: foundation chapter
  per project, with each footing as a sub-section

Memory entries that bear on this seed:

- [[calc_platform_calc_topics_taxonomy]] — this lives in the
  **Foundations** section
- [[calc_platform_workflow_vision]] — closing the residential workflow
- [[calc_platform_integration_strategy]] — sequencing: foundations come
  after SEED-005 closes the analysis→design loop on one steel calc
- [[calc_platform_pedagogical_transparency]] — bearing-capacity
  derivation visible; Nq, Nc, Nγ shown not pre-computed
- [[calc_platform_tedds_reference_available]] — Tedds refs are the
  format match target

## Open questions to resolve at trigger time (NOT now)

- **Bearing capacity formulation:** Tedds uses the full
  Brinch-Hansen-style formulation (Nq, Nc, Nγ + shape / depth /
  inclination factors). Worth replicating fully for clause-completeness
  even though most residential jobs use **presumed bearing pressure**
  from a soils report instead. Probably expose both modes.
- **Soil report parsing:** soil parameters (c′, φ′, density) come from
  a ground investigation report. Tedds accepts them as inputs. Worth
  building a small "soil profile" data object reusable across pad +
  strip + raft templates? Probably yes — one project, one soil.
- **Load combinations:** Tedds always runs DA1 Combo 1 AND Combo 2,
  reports both, governing case wins. Replicate. The Combo 2 (favouring
  soil resistance) often governs for cohesionless soils.
- **Plain-concrete projection limit (§12.9.3):** the
  `amax = 0.85·h / √(3·fdz / fctd,pl)` check is in the unreinforced
  refs. Cleanly separable: if reinforced, skip this check; if plain,
  run it.
- **Punching shear:** only relevant for pad foundations with
  concentrated column loads. Tedds applies §6.4 with shape factor β
  (different β than the masonry one in [[SEED-009]] — clashing notation).

## Notes

Origin: 2026-05-12 conversation reviewing Llanfair Farm + 5 docx
foundation refs. User split foundations into strip/pad vs raft when
asked (raft is its own conceptual model — see [[SEED-010]]).

User explicitly framed residential foundation work as the highest-fee-
leverage automation target: small fee per job, but every job hits it.
Time-saving here translates directly to margin.

The Llanfair Farm package PDF contains a strip-foundation worked
example (pages 27–30) — useful as a smoke-test fixture once the
template is built.
