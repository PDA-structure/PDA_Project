---
id: SEED-006
status: dormant
planted: 2026-05-10
planted_during: v1.3 — Revit Tier 2 + Results-Import (Phase 7 complete; calc-platform spike work in parallel sibling repo)
trigger_when: When per-check calc templates are stable across the major engineering disciplines AND a real-project test has surfaced concrete report-compilation requirements (titles, ordering, project metadata, page layout, references). Likely v1.5+ or a dedicated report-system milestone.
scope: Large
---

# SEED-006: Compiled-project-report system

A first-class platform feature: compile multiple calc templates + project
metadata + title block + load schedule + analysis output + design checks
into **one document per project**, with consistent formatting,
auto-numbering, cross-references, and revision control.

This is the feature where every commercial analysis tool fails — and
where, per the product vision (memory `calc_platform_workflow_vision`),
the platform's actual differentiation lives.

## Why This Matters

The end-to-end engineering workflow finishes with delivering a calc
package: title block + project info + load schedule + analysis results
+ design checks for every member, all in one consistent document the
engineer signs and submits. Today this is reconstructed manually for
every project from screenshots, Tedds outputs, Word templates, and
Excel exports — high error rate, slow, brittle.

If the calc platform doesn't solve this, it remains "a better Tedds"
instead of "the workflow tool" the product vision aims for. The
templates we're building right now (BS 8110 RC, EC2 RC, EC3 steel beam,
EC3 steel column, EC5 timber beam, future foundation / concrete column
/ vibration / etc.) are individually nice — but their value compounds
only when they're assembled into a coherent project document.

This is also the feature that's *most likely to get scoped wrong if
designed too early*. The right per-check shape, the right metadata
schema, the right ordering convention only become clear after a real
project has been run through the toolchain end-to-end. Hence the
trigger condition.

## When to Surface

**Trigger:** When ALL of these are true:

- Per-check calc templates are stable across at least beam, column,
  foundation (the typical-project minimum)
- The factory pattern from SEED-005 (`from_solver_result`) is
  implemented and the analysis → design loop has been closed for at
  least one real project
- A real-project test has produced concrete requirements (what
  metadata fields, what ordering, what page format, what cross-refs)

This seed should be presented during `/gsd-new-milestone` when:

- Milestone scope mentions "report system", "calc compilation",
  "project document", "deliverable assembly"
- Milestone follows the calc-platform integration milestone (it's
  the natural next step after templates are integrated)
- Milestone is positioned as the "make it usable on real projects"
  layer

## Scope Estimate

**Large** — a full milestone. Likely components:

- **Project metadata layer** — project name, ref, client, engineer,
  reviewer, revision, date, calc list, pages-of, etc.
- **Title block component** — used by every calc template; pulls from
  project metadata. Per-template override for special-case calcs.
- **Calc-template ordering and grouping** — by member type, by load
  case, by section, etc. User-configurable per project.
- **Auto cross-referencing** — "see calc 4.2 for column design" type
  links between sections, automatically updated when calcs are
  reordered.
- **Diagram/sketch embedding** — analysis results, member sketches,
  load diagrams must render inline alongside the textual calcs.
- **Revision control** — calc revs separate from project rev;
  superseded calcs archived not deleted.
- **Multiple output formats** — single HTML (current marimo
  `html-wasm` baseline), PDF (probably WeasyPrint or paged.js),
  potentially Word (for clients who require it — likely via
  Pandoc or python-docx).
- **Per-project state** — a "project file" (YAML or similar) that
  captures all inputs, calc selections, metadata, and lets a project
  be re-opened, edited, re-compiled.

The PDF and Word outputs are where most effort hides. HTML-only is
~3–5 phases. Add PDF: +2 phases. Add Word: +2 phases (likely deferred
indefinitely if HTML/PDF satisfies the use case).

## Breadcrumbs

Where this lands:

- `pda_project/calc_templates/` — per-check marimo files (post-SEED-005
  integration)
- `pda_project/design_core/checks/` — pure-Python check classes
- New: `pda_project/report/` — compilation engine
- New: project-file format spec (likely `*.pda` or `*.pda.yml`)

Spike-era source material to feed forward:

- All 5 marimo templates currently in `~/Documents/handcals/marimo_spike/`
  use `mo.export html-wasm` for single-file static output — that's the
  per-template baseline; the report system aggregates.
- The `_smoke_test.py` and `report.html` artifacts in the spike repo
  give concrete starting examples of compiled single-template output.

Memory entries that bear on this seed:

- `calc_platform_workflow_vision.md` — the WHY (workflow continuity is
  the product thesis)
- `calc_platform_integration_strategy.md` — sequencing puts this seed
  AFTER real-project test + SEED-005 implementation
- `calc_platform_pedagogical_transparency.md` — the report must
  preserve the verbose intermediate-step rendering the user explicitly
  values over Tedds-style condensed output

## Notes

Origin: 2026-05-10 conversation after step 4 timber spike completed.
User articulated the full product vision (loading → combinations →
analysis → design → foundations → title block → compiled document) and
identified the report-compilation feature as "where most analysis
software fails and this is where we can be more productive."

Open questions to resolve at trigger time (NOT now):

- **Project file format**: YAML for hand-editability vs JSON for
  schema-validation strictness vs a custom binary for size/integrity?
  Lean YAML for v1.
- **PDF generation**: WeasyPrint (HTML→PDF, slow but high fidelity)
  vs paged.js (browser-side, fast preview) vs ReportLab (programmatic,
  most control)? Decide based on whether marimo's HTML output is the
  source of truth or whether report assembly is a separate render
  pipeline.
- **Diagram rendering**: do solver outputs ship as SVG (embed
  directly), as PNG (raster, lossy), or as data with browser-side
  rendering? SVG is the technically right answer.
- **Multi-engineer collaboration**: scope this in or out for v1?
  Locking, branching, review workflow — all big. Probably out for v1.
- **Cross-reference auto-numbering**: how to handle calcs that reference
  each other when calc order changes? Likely needs a stable calc-id
  separate from display number.

Once the trigger fires, this likely becomes a multi-phase milestone
with these phases:

1. Project metadata schema + title block component
2. Calc aggregation pipeline (HTML → HTML)
3. PDF output (WeasyPrint or alternative)
4. Cross-reference + auto-numbering
5. Project file format + open/save UX
6. Revision-control layer
