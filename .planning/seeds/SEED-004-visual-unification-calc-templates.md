---
id: SEED-004
status: dormant
planted: 2026-05-10
planted_during: v1.3 — Revit Tier 2 + Results-Import (Phase 7 complete; calc-platform spike work in parallel sibling repo)
trigger_when: At least 4 calc templates exist AND dual-mode UX is locked AND at least one real-project use has happened — i.e. when calc-platform integration scope appears in a milestone
scope: Small
---

# SEED-004: Visual unification pass across calc templates

Single design sweep to standardise input layouts across all calc templates —
subtle box / shadow on the input area in quick-check mode, consistent
spacing, matched section headers, unified callout styling.

## Why This Matters

Each calc template (`rc_beam_spike.py`, `rc_beam_ec2_spike.py`,
`steel_beam_spike.py`, future `steel_column_spike.py`,
`timber_beam_spike.py`) is being authored independently during the spike
phase. Each acquires its own subtle visual quirks — different section-header
styles, different `mo.callout` kinds, different hstack/vstack proportions.
When these ship as the production calc platform, the visual divergence
will look unprofessional next to a polished competitor like Tedds.

The trap to avoid: polishing visuals during the spike phase. The dual-mode
UX (reactive vs quick-check) was only just validated on `steel_beam_spike`
on 2026-05-10. Replicating it to 3 more templates plus gathering
real-project signal will likely surface UX changes — so any visual
treatment applied now would be polishing a moving target.

The right time is **after** the dual-mode pattern is locked across all
4+ templates AND at least one real-project use has stress-tested the
ergonomics — that's when the visual-design budget pays off.

## When to Surface

**Trigger:** When a milestone includes scope to integrate the calc
platform from `~/Documents/handcals/marimo_spike/` into pda_project
(`design_core/calc_templates/` per the post-spike integration plan).

This seed should be presented during `/gsd-new-milestone` when the
milestone scope matches any of these conditions:
- Milestone includes calc-platform integration into `design_core/`
- Milestone scope mentions `marimo_spike`, `calc_templates`, or
  "ship calc platform"
- Milestone is described as a UX/polish/design pass on existing tooling

## Scope Estimate

**Small** — a few hours. One design pass across 4–6 template files:

- Decide on a canonical input-area treatment (likely `mo.callout(kind=
  "neutral")` wrapping the input hstack in quick-check mode, no callout
  in reactive mode)
- Apply uniformly across all templates
- Standardise section header styles (## numbering, callout kinds for
  pass/fail/warn/info)
- Single design pass in one PR — keep it surgical, no behavioural
  changes

## Breadcrumbs

Code locations (all in sibling repo `~/Documents/handcals/marimo_spike/`):

- `rc_beam_spike.py` — BS 8110 RC, simplest template
- `rc_beam_ec2_spike.py` — EC2 RC with SW toggle, A_s,prov input,
  K_s modifier (post-2026-05-10 fixes)
- `steel_beam_spike.py` — EC3 steel beam, has dual-mode toggle
  pattern (2026-05-10) — **canonical reference** for input layout
- `sections/` — shared section-property library imported by steel
  templates

Memory entries that bear on this seed:
- `calc_platform_marimo_path_a.md` — integration trigger ("3–4
  templates + real-project use")
- `calc_platform_two_ux_modes.md` — dual-mode requirement
- `calc_platform_pedagogical_transparency.md` — verbosity is a
  feature; visual treatment must not hide intermediate steps

## Notes

Origin: 2026-05-10 conversation during step 2 of the calc-platform
sequence (validating the quick-check UX on `steel_beam_spike`). User
asked whether to add a subtle box/shadow around the input area now.
Recommendation given: defer until pattern locked across all templates
+ real-project use; do one design sweep at integration time, not now.

The cheap-now option that was discussed but not taken: wrap the inputs
hstack in `mo.callout(kind="neutral")` only in quick-check mode (~3
lines, trivially removable). If a future spike-phase user-test session
demands a stronger visual signal of "form mode active", this is the
fallback that doesn't lock the design.
