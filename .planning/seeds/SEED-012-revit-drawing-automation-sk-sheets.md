---
id: SEED-012
status: dormant
planted: 2026-05-15
planted_during: v1.3 — Revit Tier 2 + Results-Import (Phase 7 complete, Phase 8 next)
trigger_when: "SEED-005 (`from_solver_result`) shipped AND CustomRevitExtension round-trip stable AND ≥1 full calc package reproduced end-to-end via the calc platform"
scope: Large
---

# SEED-012: Revit drawing automation for SE deliverable SK sheets

## Why This Matters

A typical UK SE calc deliverable ships with a paired set of SK (sketch)
drawings — typically **1× Proposed Plan** and **1× Sections & Details**.
This pattern is consistent across the four reference calc packages reviewed
during the 2026-05-15 sanitisation pass (held privately at
`~/Documents/handcals/refs/TEMPLATE CALC PACKAGE/`):

- Package A — proposed-plan SK + sections-and-details SK (smallest sample, ~18 calc pages)
- Package B — two SK sheets accompanying a ~30 page calc PDF
- Package C — two SK sheets accompanying a ~39 page calc PDF
- Package D — drawings referenced from inside the editable .docx calc package

(See the private memory `private-calc-package-mapping` for the real-world
identifiers behind Package A/B/C/D; that mapping is intentionally not
committed.)

The engineer currently **re-draws in Revit (or 2D CAD) what they have already
modelled and analysed**. This is a workflow loop the platform thesis
(`calc_platform_workflow_vision`) is built to close.

Tedds doesn't produce drawings. Robot/SAP don't. Revit can — with the right
extension built on top of the pda_project model + calc results.

**On-thesis test (from `calc_platform_workflow_vision`):**
- ✅ Removes a tool the engineer context-switches to (manual drafting step)
- ✅ Preserves data continuity (analytical model → calcs → drawings, no re-keying)
- ✅ Eliminates re-drawing what's already modelled

This is a major workflow gain, not a "feature for its own sake."

## When to Surface

**Trigger:** SEED-005 (`from_solver_result`) shipped AND
CustomRevitExtension round-trip stable AND
≥1 full calc package reproduced end-to-end via the calc platform.

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches any of these conditions:

- New milestone planning includes **Revit-side automation** beyond the
  current Tier 2 exporter (i.e. moving from data-out → drawings-out)
- New milestone planning targets **calc-platform integration with Revit**
  (calcs and drawings as one bundled deliverable)
- New milestone planning targets **the end-to-end "single tool replacement"
  workflow** (`calc_platform_workflow_vision`) — drawing automation is the
  highest-leverage missing piece once calcs are integrated
- v1.5+ or v2.0+ milestone with theme "deliverable automation" or
  "drafting workflow"

Do NOT surface this for v1.4 (3D solvers) — premature; the 3D solver chain
must mature first.

## Scope Estimate

**Large** — a full milestone of work, possibly multi-phase across two repos:

- **pda_project side:** export bundle from calc platform → standardised JSON
  payload containing project metadata, member list with sizes/utilisations,
  and drawing-relevant geometry. New module, probably
  `calc_templates/export/drawing_bundle.py`.

- **CustomRevitExtension side:** new pyRevit pushbutton(s) reading from
  Revit's analytical model + the calc bundle, generating:
  - Plan view with structural members tagged by their calc reference
  - 1–2 section views with title block auto-populated
  - Generic title-block sheet template (fields: project number, title,
    client, date, calcs-by, drawing number, revision, status). Practice
    branding stays per-engineer / per-project; the template just exposes
    the field structure.

**Defer to later phases of this seed:**
- Detail callouts (fixings, foundation details, padstones)
- Multi-sheet detail families
- Live-update on calc re-run (drawings stay in sync with current solve)

## Breadcrumbs

Related work and decisions already in the codebase:

- **Sibling repo:** `~/Documents/CustomRevitExtension/` — pyRevit-based UI,
  currently shipping `ConvertToAnalytical.pushbutton` (Phase 7) and
  `ExportToPDA.pushbutton` (Phase 5). Drawing automation belongs HERE,
  not in pda_project. See memory `custom_revit_extension_repo`.
- **Memory `revit_physical_to_analytical_api`:** documents the
  `AnalyticalMember.Create + AddAssociation` canonical path — drawing
  automation will read these same analytical members for plan/section views.
- **Memory `revit_addassociation_no_propagation`:** SectionTypeId/MaterialId
  must be set explicitly — drawing tags need to read from the analytical
  member's metadata, which only works if Phase 7's explicit-assignment
  pattern was followed.
- **Memory `learnrevitapi_reference`:** Erik Frits' practical pyRevit/Revit
  API reference — must be cited in research phase for this seed.
- **Memory `pyrevit_stack_column_limit`:** ribbon stacks max 3 columns —
  drawing pushbuttons will need to fit within existing
  `PDA_Tools.tab` panel structure (currently 4 panels:
  Analytical / Dev / Resources / TestCodes).
- **Memory `revit_host_manual_copy_deployment`:** Windows host pushbutton
  deployment is manual copy + pyRevit Reload, NOT auto-clone. New
  pushbuttons will require explicit folder copy. Author CI deployment
  scripts as part of this seed's planning phase.
- **Memory `calc_platform_workflow_vision`:** the thesis this seed serves.
- **Memory `private_calc_package_mapping` (LOCAL ONLY):** real-world
  identifiers for Package A/B/C/D, plus the path to the reference SK
  drawings. Never commit those identifiers.

## Notes

**Prerequisite reality-check (will be re-verified at surface time):**

1. **SEED-005 status:** `from_solver_result` factory must be wired in
   pda_handcalcs first. Without it, drawing automation has no calc context
   to tag against. Per `calc_platform_integration_strategy`, SEED-005 is
   the integration seam.

2. **CustomRevitExtension maturity:** Phase 8 (Tier 2 ExportToPDA) must
   read AnalyticalMember directly with real section/material values. Phase
   7 is complete but Phase 8 is the next entry (per STATE.md 2026-05-06).
   Drawing automation cannot proceed until the metadata flow is
   trustworthy end-to-end.

3. **Real-project test threshold:** at least one of the four sample
   packages (recommend Package A — the smallest at ~18 calc pages) should
   be fully reproduced via the calc platform before drawing automation
   begins. That reproduction surfaces what the drawing bundle actually
   needs to contain.

**Wishlist items captured for the activation phase:**

- Generic title-block template with editable fields (the calc-platform
  letterhead pattern from SEED-007 v2 is a starting point — see
  `calc_platform_report_layout_multi_house_style`). Per-practice branding
  is per-engineer / per-project, not baked into the template.
- Auto-cross-reference: beam B1 on plan view should hyperlink to the calc
  page where B1 was designed. This is the "single document" experience
  the engineer wants.
- Drawing revisions tracked alongside calc revisions (a revised calc
  should mark its parent SK as "needs review").

**Provenance:** Surfaced 2026-05-15 during review of a privately-held set
of four real UK SE calc packages at
`~/Documents/handcals/refs/TEMPLATE CALC PACKAGE/`. Captured as a seed
because Revit drawing automation is on the long-term wishlist but
premature now. Sanitised the same day after realising the original draft
had named the source practice + clients + project numbers — leakage caught
before push to origin. See memory `private_calc_package_mapping` for the
real-world mapping (local-only).
