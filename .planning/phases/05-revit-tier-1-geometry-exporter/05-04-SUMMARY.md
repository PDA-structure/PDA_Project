---
phase: 05-revit-tier-1-geometry-exporter
plan: 04
type: execute
wave: 4
autonomous: false
requirements:
  - REVIT-T1-01
  - REVIT-T1-02
  - REVIT-T1-03
  - REVIT-T1-04
  - REVIT-T1-05
completed: 2026-04-21
---

# Plan 05-04 Summary — HUMAN-UAT (Live Revit + frame2d Round-trip)

## Outcome

**Verdict:** PASS — all 6 canonical fixtures and the REVIT-T1-05 round-trip verified end-to-end by operator in live Revit session.

## What Was Verified

### Revit-side fixtures (Windows machine, live pyRevit)

| # | Fixture | Result |
|---|---------|--------|
| F1 | Non-drafting view guard — dialog refuses non-drafting views | PASS |
| F2 | 2D-only warning banner + session-scoped "don't show again" checkbox + D-04 empty-view dialog | PASS (after fix e61ba08) |
| F3 | Single detail-line → canonical PDA JSON with clean 4-dp metres and no Z field | PASS (after fix 6c37327) |
| F4 | Portal frame (3 snap-joined lines) → 4 merged nodes / 3 members (REVIT-T1-03 endpoint merge) | PASS |
| F5 | T-junction (line landing on another line's interior) → automatically split into 4 nodes / 3 members (D-05) | PASS |
| F6 | Mid-span crossing (two diagonals) → 4 nodes / 2 members NOT split + warning text in success dialog (D-06) | PASS |

### REVIT-T1-05 round-trip (Mac, local uvicorn + frame2d UI)

- Portal-frame JSON from F4 loaded cleanly in `ui/frame2d/index.html` → canvas populated with the 4-node / 3-member portal at the expected 1 m = 20 px grid scale.
- Operator added fixed supports at both column bases and `Fy = -10 kN` at a top-corner node.
- `/solve/frame2d` returned a non-error result: green success banner, displacements rendered, BMD/SFD rendered.
- Observed max displacement: **0.0200 mm** (≈ 2.0×10⁻⁵ m).
- Physical sanity check: analytical column axial shortening ΔL = PL/AE = 10 000 N × 4 m / (0.01 m² × 200 GPa) = 2.0×10⁻⁵ m. Match to 3 sig figs — the solver is not just non-erroring, it is physically correct on this fixture.

## Requirements Delivered

All five REVIT-T1 requirements now PASS:

| ID | Verdict | Evidence |
|----|---------|----------|
| REVIT-T1-01 | PASS | F3/F4 success dialogs + saved JSON files |
| REVIT-T1-02 | PASS | F1 view-type refusal; F2 warning + session persistence after fix e61ba08 |
| REVIT-T1-03 | PASS | F4 produced 4 nodes (not 6) — endpoint merge proven |
| REVIT-T1-04 | PASS | F3 JSON inspection: clean 4-dp metres, no Z/z field, after fix 6c37327 |
| REVIT-T1-05 | PASS | Round-trip: solve succeeded and result matches analytical PL/AE |

## Bugs Surfaced and Fixed In-session

Plan 05-04 was designed to catch runtime-environment issues that offline CPython-3 verification in plans 05-01..03 could not reproduce. It caught three:

| Commit | Plan | Root cause |
|--------|------|-----------|
| `a5e9221` | 05-01 | sys.path guard used 5 relative dir hops instead of 4 — resolved to a path one level above `.extension` folder, so `lib/Snippets/` never reached sys.path. Import failed on first button click. |
| `e61ba08` | 05-01 | `__revit__.Application` is sealed in modern Revit/IronPython — setattr of session flag raised `System.MissingMemberException`. Switched to `pyrevit.script.set_envvar/get_envvar` (canonical pyRevit in-process registry). |
| `6c37327` | 05-02 | IronPython 2.7's json serialiser uses full-precision repr, not CPython 3's shortest-round-trip. `round(x, 4)` produces noisy JSON like `1.2567999999999999`. Added `_q4(x) = float("%.4f" % x)` and applied at every coord write path. |

None of these were design flaws. All three are IronPython 2.7 / pyRevit / .NET runtime facts that the plan-phase research partially anticipated (pitfall lists mention IronPython; RESEARCH Open Question 4 mentioned sys.path for lib/Snippets) but that only live-runtime UAT could expose concretely.

## Artifacts

- `.planning/phases/05-revit-tier-1-geometry-exporter/05-HUMAN-UAT.md` — full fixture-by-fixture log with PASS/FAIL, observed values, sanity check, and known-bug records (commit `9a4fa48`)
- `/Users/catrinevans/Downloads/PDA_UAT_1_pda.json` — Fixture 3 initial (noisy) export, kept as evidence of the pre-fix behaviour
- Portal-frame JSON from F4 — transferred Mac-side for round-trip; not archived (readily regenerable from the fixture spec)

## Deviations

- The plan's Step 7 scaffold was written by the orchestrator (not an executor subagent) because plan 05-04 is `autonomous: false` — the orchestrator paused at Wave 4 for human UAT. Scaffold created at checkpoint entry (commit `791c5dc`) before fixture work began.

## Self-Check: PASSED

- [x] All six Revit-side fixtures executed in live Revit session
- [x] Round-trip executed on Mac with live API server + frame2d UI
- [x] Observed displacement sanity-checked against analytical PL/AE (matches to 3 sig figs)
- [x] All five REVIT-T1 requirements verified PASS
- [x] Three real bugs surfaced, diagnosed, fixed, pushed, and retested PASS in-session
- [x] 05-HUMAN-UAT.md status frontmatter set to `passed`
- [x] No open gaps — no gap-closure phase required
