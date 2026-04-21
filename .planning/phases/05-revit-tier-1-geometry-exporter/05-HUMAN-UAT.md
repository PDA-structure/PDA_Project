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
  - "Plan 05-01 sys.path guard had off-by-one (5 hops, should be 4) — fixed in commit a5e9221; retest PASSED (button loads)"
  - "Plan 05-01 session flag used setattr on __revit__.Application which raises AttributeError in modern Revit/IronPython — fixed in commit e61ba08 (switched to pyrevit.script.set_envvar/get_envvar); retest F2 PASSED"
  - "Plan 05-02 float coords serialised with IronPython 2.7 json repr noise (e.g. 1.2567999999999999 instead of 1.2568) even though round(x,4) was applied — fixed in commit 6c37327 (added _q4 helper doing float('%.4f' % x) round-trip at every coord write path); retest F3 PASSED"
---

# Phase 5 Human UAT — Revit Tier 1 Geometry Exporter

## Summary

<Filled in by human after all fixtures run.>

## Fixture Results

### F1 — Non-drafting view guard (REVIT-T1-02 view-type refusal)
- Outcome: PASS
- Verdict: PASS
- Observed dialog title: "PDA Export" (as expected)
- Observed dialog message: view-type refusal message shown as expected
- Notes: worked first try on floor plan; no file written, no crash

### F2 — First-click 2D-only warning + session persistence (REVIT-T1-02)
- Outcome: PASS (after fix e61ba08)
- Verdict: PASS
- Warning banner text: PASS
- Session-flag persistence across second click: PASS
- D-04 empty-view dialog: PASS
- Notes: initial run raised AttributeError on Application when checkbox ticked. Root cause: setattr on .NET Application is rejected by modern Revit/IronPython. Fix switched to pyrevit.script.set/get_envvar. Retest all paths PASS.

### F3 — Single-line export (REVIT-T1-01, REVIT-T1-04)
- Outcome: PASS (after fix 6c37327)
- Verdict: PASS
- Success dialog counts: expected 2 nodes / 1 members — observed 2 nodes, 1 members
- JSON shape manual inspection: PASS
- REVIT-T1-04 4-dp metres + no-Z inspection: PASS (after _q4 fix; initial export had trailing noise like 1.2567999999999999, retest shows clean 1.2568; no z/Z anywhere)
- Exported file: /Users/catrinevans/Downloads/PDA_UAT_1_pda.json (initial noisy version archived in phase fixtures if needed); retest produced clean JSON
- Notes: initial export revealed IronPython 2.7 json serialiser emits full-precision repr. Fix added _q4 helper applying "%.4f" % x round-trip at every coord write path. Retest clean.

### F4 — Portal frame + endpoint merge (REVIT-T1-03)
- Outcome: PASS
- Verdict: PASS
- Success dialog counts: expected 4 nodes / 3 members — observed 4 nodes, 3 members
- Lexicographic node order (D-08): not explicitly verified yet (user reported counts only); will confirm from saved JSON
- Exported file: portal_pda.json (Windows machine; will be transferred to Mac for round-trip step)
- Notes: endpoint merge works — coincident snap-points at (0, 4) and (5, 4) collapsed to single nodes. 4 nodes confirms REVIT-T1-03.

### F5 — T-junction split (D-05)
- Outcome: PASS
- Verdict: PASS
- Success dialog counts: expected 4 nodes / 3 members — observed 4 nodes, 3 members
- T-node shared by 3 members in canvas.members: not explicitly verified from JSON yet (counts confirm split fired)
- Exported file: T-junction JSON saved on Windows machine
- Notes: T-split logic fires correctly. Long line was split at the interior point where the perpendicular line landed.

### F6 — Mid-span crossing warning (D-06)
- Outcome: PASS
- Verdict: PASS
- Success dialog counts: expected 4 nodes / 2 members — observed 4 nodes, 2 members
- Crossing warning text present: PASS — "Warning: 1 mid-span crossing(s) detected and NOT split" appeared in success dialog
- Exported file: crossing-fixture JSON saved on Windows machine
- Notes: D-06 honoured: crossing detected but lines NOT auto-split. User decides in frame2d UI.

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
