---
id: SEED-005
status: dormant
planted: 2026-05-10
planted_during: v1.3 — Revit Tier 2 + Results-Import (Phase 7 complete; calc-platform spike work in parallel sibling repo)
trigger_when: When integrating calc templates from marimo_spike into pda_project (design_core/checks + calc_templates) — the integration milestone after spike validation criteria are met
scope: Medium
---

# SEED-005: Solver → calc factory pattern (`from_solver_result`)

When the calc platform integrates into pda_project, expose two
construction paths on each design check class so engineers can drive
member design directly from solver output without re-keying loads:

```python
SteelBeamEC3.from_loads(g_k=12, q_k=8, L=7, ...)            # standalone
SteelBeamEC3.from_solver_result(result, member_id=3, ...)   # solver-driven
```

Both paths converge on the same `.compute() → DesignResult`. The
factory choice is the integration seam.

## Why This Matters

The whole reason the calc platform exists in the same project as the
solver is to **close the analysis → design → check loop in one tool**.
If integrating means "engineer keys in M_Ed by hand from a printed
solver output," we've added a UI, not a workflow.

The factory pattern keeps the standalone calc useful (training, ad-hoc
checks, CPD demos, comparison against published worked examples)
while opening the solver-driven path that is the platform's actual
differentiation.

## When to Surface

**Trigger:** When a milestone includes scope to integrate the calc
platform from `~/Documents/handcals/marimo_spike/` into pda_project
(`design_core/checks/<material>_<code>.py` + `calc_templates/`).

This seed should be presented during `/gsd-new-milestone` when the
milestone scope matches any of these conditions:
- Milestone includes calc-platform integration into `design_core/`
- Milestone introduces a "design from solver result" workflow
- Milestone touches `AnalysisResult` consumers

## Scope Estimate

**Medium** — a phase or two. Non-trivial because the solver→calc
contract differs by check type:

- **Steel beam / simply-supported RC** — single envelope (M_max,
  V_max) is enough; `from_solver_result(result, member_id)` extracts
  envelope and constructs the check
- **EC2 zoned RC** (Tedds-style 3-zone β1 monolithic factor) — needs
  full M/V diagrams or per-zone extracts; the factory must accept
  zoning parameters or compute them
- **Steel column** — needs N_Ed, M_y,Ed, M_z,Ed at multiple sections
  along the member, plus effective-length context that the solver
  may not know (depends on bracing topology, not just analysis output)

The contract between `AnalysisResult` and the design checks therefore
needs careful design — likely one or two phases:

1. Define `ResultExtraction` helpers on `AnalysisResult` (or in
   `design_core/extract.py`) that translate "member i's envelope at
   load combo X" into the kwargs each check expects
2. Implement `from_solver_result` factory on each check class

Pure standalone path (`from_loads(...)`) is unchanged from the
spike-era API — that's the design invariant.

## Breadcrumbs

Where the integration lands:
- `pda_project/solver_core/src/pda_analysis_software/results/results.py` —
  `AnalysisResult` dataclass (the input to `from_solver_result`)
- `pda_project/design_core/` — does not exist yet; will be created
  at integration time
- `pda_project/calc_templates/` — does not exist yet; mirror of
  `marimo_spike/*_spike.py` files post-rebrand

Spike sources to migrate:
- `~/Documents/handcals/marimo_spike/rc_beam_spike.py` (BS 8110)
- `~/Documents/handcals/marimo_spike/rc_beam_ec2_spike.py` (EC2,
  the canonical multi-feature reference post-2026-05-10 fixes)
- `~/Documents/handcals/marimo_spike/steel_beam_spike.py` (EC3 with
  dual-mode UX, the canonical reference for the architecture)

Memory entries that bear on this seed:
- `calc_platform_marimo_path_a.md` — integration trigger conditions
- `calc_platform_two_ux_modes.md` — both UX modes survive
  integration
- `calc_platform_pedagogical_transparency.md` — verbose render
  output is a feature; `compute()` returns a `DesignResult` plus
  the calc-template renders LaTeX from it (not from compute internals)

## Notes

Origin: 2026-05-10 conversation during step 2 of the calc-platform
sequence. User flagged "we will need to let the input be output from
2D frame, 2D truss or beyond in the near future" as forward-looking
data for consideration. Recommendation given: don't design for it
during the spike phase — the calc API is still settling, and
coupling now would lock to the wrong shape. The factory pattern is
the natural seam at integration time.

Open questions to resolve at integration time (NOT now):
- Does `AnalysisResult` carry load-combo metadata, or is combo
  selection a separate concern?
- For multi-load-combo solver runs, does `from_solver_result` accept
  a combo selector, or do we run the check once per combo and
  envelope at the design layer?
- Effective length for column buckling: solver doesn't know
  bracing intent — must be supplied by user even on the
  solver-driven path (or detected via "members converging at this
  node" heuristics). Lean on user input for v1.
