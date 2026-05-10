---
id: SEED-007
status: dormant
planted: 2026-05-10
planted_during: v1.3 — Revit Tier 2 + Results-Import (Phase 7 complete; calc-platform spike work in parallel sibling repo)
trigger_when: When load build-up friction surfaces during the real-project test of the calc platform — almost certainly on day one of the first real project, because the existing 5 templates take g_k as a fixed input and don't help the engineer arrive at it
scope: Medium
---

# SEED-007: Unit-aware live calculator (Tedds-style variables)

A web-based live calculator that lets engineers type lines like:

```
gk_finishes  = 0.5 kN/m2 ; floor finishes (carpet + screed)
gk_ceiling   = 0.15 kN/m2 ; suspended ceiling + services
gk_partitions = 1.0 kN/m2 ; movable partitions allowance
gk_total     = gk_finishes + gk_ceiling + gk_partitions = ? kN/m2
b            = 2 m ; tributary width
w            = gk_total * b = ? kN/m
```

…and the platform parses each line, tracks variables in a
**project-scoped namespace**, computes the `?` values, and **flags
dimensional errors** (e.g. if you write `w = ? kN/m2` instead of
`kN/m`, it errors because the LHS dimension doesn't match the RHS).

## Why This Matters

The 5 calc templates built during the spike phase (BS 8110 RC, EC2 RC,
EC3 steel beam, EC3 steel column, EC5 timber beam) all take $g_k$,
$q_k$, etc. as **fixed numerical inputs**. They check whether a beam
passes given the load — they don't help the engineer **arrive** at the
load.

Real projects build load up from components:
- $g_{k,total} = g_{finishes} + g_{screed} + g_{ceiling} + g_{services} + g_{partitions} + ...$
- Loads converted between area, line, and point: $w = g_k \cdot b$,
  $P = w \cdot L$, etc.
- Per-floor or per-room build-ups that need to be reused across many
  member checks within the same project

Today UK engineers do this in:
- **Excel** — formula errors, no unit checking, lost between projects
- **Tedds Variables** — locked to one calc, doesn't carry across the project
- **Pen and paper** — fast but un-archivable, regenerated each project
- **Pocket calculator** — fastest but no record

This is exactly the kind of fragmentation that the platform thesis
(memory `calc_platform_workflow_vision.md`) is designed to eliminate.

A live unit-aware calculator that's **project-scoped** — variables
persist across the project's calc templates — fills the missing
front-end of the workflow:

```
[ Load build-up calculator ]  →  defines g_k, q_k, ψ_2, ...
            ↓
[ Standard calc templates ]   →  consume g_k, q_k from the project namespace
            ↓
[ Compiled report (SEED-006) ] →  includes the load build-up as the first chapter
```

**One bonus over Tedds:** because `forallpeople` (already a platform
dep) tracks units rigorously, this calculator actually catches errors
that Tedds doesn't. Tedds will happily multiply kN by m and call it
"kNm²" if you typo. The proposed calculator — by requiring the engineer
to assert the expected unit after `?` — surfaces these bugs at the
point of authoring.

## When to Surface

**Trigger:** When load build-up friction surfaces during the real-project
test of the calc platform.

The user has flagged that almost certainly on **day one of the first
real project**, the gap will be obvious — they'll need to build $g_k$
from finishes / ceiling / services and will feel the friction
immediately.

This seed should be presented during `/gsd-new-milestone` when:
- Milestone scope mentions "load build-up", "load schedule",
  "project variables", "calc namespace"
- Milestone follows the real-project test of the calc platform
- Milestone is described as a "front-end of the calc platform"
  feature

It is also possible this seed surfaces **alongside** SEED-006
(compiled-report system), since the load build-up is naturally the
first chapter of the project report. Could be planned as part of the
same milestone if priorities align.

## Scope Estimate

**Medium** — a phase or two:

- **Parser** (~100 lines Python): regex or small grammar that maps
  `10 kN/m2` → `10 * kN/m**2`, `gk * b = ?` → evaluate `(gk * b)` and
  validate against the asserted unit, `; comment` → annotation.
  Forgiving syntax: handle `kN/m^2`, `kN/m**2`, `kN m^-2` etc.
- **Project namespace** — a dict-like object that variables write into;
  loaded into each calc template's input scope so they pre-fill from
  the namespace
- **Unit-mismatch error messages** — must be readable: "expected kN/m,
  got kN·m" not a Python traceback
- **UI** — marimo `mo.ui.text_area` reactive to changes, parser runs on
  every change, line-by-line render of formula → substitution → result
  (a la handcalcs); error lines highlight with the offending variable
  and expected vs computed unit
- **Persistence** — variables survive across template loads (project
  namespace stored alongside project metadata; aligns with SEED-006's
  project-file format)
- **Optional v2** — autocomplete on variable names, inline unit hints,
  syntax highlighting, "use this variable in calc X" cross-link

Does NOT need to be built before standard-library expansion. The
real-project test will say whether it's a day-one need or not.

## Syntax sketch (concrete starting point)

Each line follows one of these forms:

| Form | Example | Behaviour |
|---|---|---|
| Definition | `gk_finishes = 0.5 kN/m2 ; carpet + screed` | Add `gk_finishes` to namespace as `0.5 kN/m²`. Comment after `;` is rendered as annotation. |
| Computed assertion | `w = gk_total * b = ? kN/m` | Evaluate RHS expression. Compare unit against the assertion after `?`. Substitute computed value for `?`. Render formula → substitution → result. |
| Pure expression | `gk_total = gk_finishes + gk_ceiling + gk_partitions = ? kN/m2` | Same as computed assertion. Sums all components, asserts kN/m². |
| Comment-only line | `; --- floor 1 loading ---` | Section divider, rendered as bold/header. |
| Blank line | (empty) | Vertical spacing in render. |

Parser pseudocode:

```python
def parse_line(line: str, namespace: dict) -> ParsedLine:
    line, comment = split_on_semicolon(line)
    if not line.strip():
        return CommentLine(comment)

    # Definition vs computed assertion: presence of "= ? <unit>"
    if "= ?" in line:
        lhs, expr_with_assert = line.split("=", 1)
        expr, asserted_unit = expr_with_assert.rsplit("= ?", 1)
        value = eval_with_units(expr.strip(), namespace)
        if not units_compatible(value, asserted_unit.strip()):
            raise UnitMismatch(lhs.strip(), asserted_unit.strip(), value)
        namespace[lhs.strip()] = value
        return ComputedLine(lhs.strip(), expr.strip(), value, asserted_unit.strip(), comment)
    else:
        lhs, value_str = line.split("=", 1)
        value = parse_quantity(value_str.strip())  # "0.5 kN/m2" → forallpeople Quantity
        namespace[lhs.strip()] = value
        return DefinitionLine(lhs.strip(), value, comment)
```

Render: each parsed line becomes a row in the marimo output — formula
on left, substitution in middle, result on right (a la handcalcs).
Error rows show the offending dimension difference in red.

## Breadcrumbs

Where this lands:

- New: `pda_project/calc_templates/load_calculator.py` — the marimo
  notebook implementing the calculator
- New: `pda_project/design_core/calc_namespace.py` — the project-scoped
  namespace plumbing (consumed by the standard-library templates so
  they can pre-fill from project variables)
- Will integrate with: SEED-005 factory pattern (`from_loads(...)`
  could become `from_namespace(namespace, "g_k", "q_k", ...)`)
- Will integrate with: SEED-006 compiled report (the load build-up is
  naturally the first chapter)

Existing platform infrastructure to lean on:

- `forallpeople` — already a dep; handles all the dimensional algebra.
  See `~/Documents/handcals/marimo_spike/sections/material.py` for an
  example of usage.
- `handcalcs` — already a dep; rendering formula → substitution →
  result. Pattern shown across all 5 templates.
- `marimo` — already a dep; reactive UI primitives include
  `mo.ui.text_area` for the input, `mo.md` for rendering.

Memory entries that bear on this seed:

- `calc_platform_workflow_vision.md` — load build-up is part of the
  workflow the platform must own
- `calc_platform_pedagogical_transparency.md` — this calculator
  doubles down on transparency: every load component visible, every
  unit checked
- `calc_platform_integration_strategy.md` — placement in the
  sequencing (after real-project test surfaces the need)

## Notes

Origin: 2026-05-10 conversation immediately after planting SEED-006.
User raised the load-build-up gap and sketched the syntax. The
calculator extends the platform's "what does the engineer ACTUALLY do
on a project?" coverage from "design checks given loads" to "design
checks AND deriving the loads from project components."

Open questions to resolve at trigger time (NOT now):

- **Syntax permissiveness**: should we accept `kN/m2`, `kN/m^2`,
  `kN/m**2`, `kN.m-2`, `kN m^-2` interchangeably? Lean yes — UK
  engineering practice varies. Normalize all to forallpeople form
  internally.
- **Multi-line expressions**: support `\` continuation or only
  one-expression-per-line? One-line keeps the parser trivial; lean
  one-line.
- **Imports / shared libraries**: can a project import a "standard load
  catalogue" (BS 6399 / EN 1991-1-1 typical loads — concrete slab
  weights, brick wall weights, etc.)? This compounds value but adds
  scope. Likely v2.
- **Cross-project variable reuse**: should `gk_finishes` defined in one
  project be reusable in another? Lean **no** for v1 — project-scoped
  is enough. Add a "save as template" action in v2 if the friction
  proves real.
- **Functions**: should the calculator support `f(x) = x^2 + 1`? Tedds
  does. EC engineers use it for load-distribution shapes
  (trapezoidal-to-equivalent-UDL conversions). Lean **yes** for v1
  with simple lambda-style: `udl_eq = (P/L) * (1 - 0.5*a/L) = ? kN/m`.
- **Comparison with Mathcad / SMath**: those tools also do this and do
  it well. The platform's edge isn't "we have a calculator" — it's
  "the calculator's variables flow directly into the design checks
  and the compiled report, with no copy-paste." Stay focused on
  workflow integration, not feature parity.
