---
phase: 05-revit-tier-1-geometry-exporter
type: human-uat
started: 2026-04-21
completed: <fill in when all 6 fixtures + round-trip done>
operator: paulo@pda-structure.co.uk
revit_version: <2023 | 2024 | 2025 — fill in>
pyrevit_version: <fill in from Revit → pyRevit tab → About>
status: pending   # → passed | passed-with-bugs | failed
known_bugs:
  - "Plan 05-01 sys.path guard had off-by-one (5 hops, should be 4) — fixed in commit a5e9221 before UAT proceeded; retest confirms button now loads"
---

# Phase 5 Human UAT — Revit Tier 1 Geometry Exporter

## Summary

<Filled in by human after all fixtures run.>

## Fixture Results

### F1 — Non-drafting view guard (REVIT-T1-02 view-type refusal)
- Outcome: <PASS | FAIL | SKIP>
- Verdict: <PASS | FAIL>
- Observed dialog title: <...>
- Observed dialog message: <...>
- Notes: <...>

### F2 — First-click 2D-only warning + session persistence (REVIT-T1-02)
- Outcome: <PASS | FAIL | SKIP>
- Verdict: <PASS | FAIL>
- Warning banner text: <PASS | FAIL>
- Session-flag persistence across second click: <PASS | FAIL>
- D-04 empty-view dialog: <PASS | FAIL>
- Notes: <...>

### F3 — Single-line export (REVIT-T1-01, REVIT-T1-04)
- Outcome: <PASS | FAIL | SKIP>
- Verdict: <PASS | FAIL>
- Success dialog counts: expected 2 nodes / 1 members — <observed>
- JSON shape manual inspection: <PASS | FAIL>
- REVIT-T1-04 4-dp metres + no-Z inspection: <PASS | FAIL>
- Exported file: <absolute path — optionally copy to .planning/phases/05-.../fixtures/>
- Notes: <...>

### F4 — Portal frame + endpoint merge (REVIT-T1-03)
- Outcome: <PASS | FAIL | SKIP>
- Verdict: <PASS | FAIL>
- Success dialog counts: expected 4 nodes / 3 members — <observed>
- Lexicographic node order (D-08): <PASS | FAIL> — first node coords: <...>
- Exported file: <path>
- Notes: <...>

### F5 — T-junction split (D-05)
- Outcome: <PASS | FAIL | SKIP>
- Verdict: <PASS | FAIL>
- Success dialog counts: expected 4 nodes / 3 members — <observed>
- T-node shared by 3 members in canvas.members: <PASS | FAIL>
- Exported file: <path>
- Notes: <...>

### F6 — Mid-span crossing warning (D-06)
- Outcome: <PASS | FAIL | SKIP>
- Verdict: <PASS | FAIL>
- Success dialog counts: expected 4 nodes / 2 members — <observed>
- Crossing warning text present: <PASS | FAIL>
- Exported file: <path>
- Notes: <...>

## REVIT-T1-05 Round-trip

- Fixture used: F4 (portal frame) — <path>
- API server health: <http://127.0.0.1:8000/health output>
- Loaded into ui/frame2d/index.html without error: <PASS | FAIL>
- Canvas populated correctly: <PASS | FAIL>
- Added supports / load in UI and clicked Solve: <PASS | FAIL>
- Solve returned non-error result: <PASS | FAIL>
- Max displacement observed: <float, metres>

## Requirement Verdicts

| ID | Description | Verdict | Evidence |
|----|-------------|---------|----------|
| REVIT-T1-01 | One-click drafting-view → canonical PDA JSON | <PASS \| FAIL> | F3, F4 success dialogs + JSON files |
| REVIT-T1-02 | Refuse non-drafting view + show 2D-only warning once per session | <PASS \| FAIL> | F1, F2 |
| REVIT-T1-03 | Coincident endpoints (within 1mm) merge to one node | <PASS \| FAIL> | F4 (4 nodes not 6) |
| REVIT-T1-04 | All node coords in metres, ≤4dp, no Z field | <PASS \| FAIL> | F3 JSON inspection |
| REVIT-T1-05 | Exported JSON loads cleanly in frame2d UI and solves | <PASS \| FAIL> | Round-trip section |

## Gaps

<List any FAILs or partial passes here. For each gap, include:
 - which requirement / fixture is affected,
 - what was observed vs expected,
 - severity (blocking | major | minor),
 - whether it warrants gap-closure phase (5.1) or can ship as known-bug.>
