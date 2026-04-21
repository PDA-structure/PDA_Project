---
phase: 05-revit-tier-1-geometry-exporter
plan: 02
subsystem: revit-extension
tags: [pyrevit, ironpython, revit-api, geometry-pipeline, detail-line, t-junction, crossing, lex-sort]

# Dependency graph
requires:
  - phase: 05-revit-tier-1-geometry-exporter
    provides: "Plan 05-01 scaffold: script.py skeleton with guards, session warning, detail-line collector, and TODO(05-02) insertion point"
provides:
  - "Pure-Python geometry pipeline inside ExportToPDA.pushbutton/script.py: _extract_segments -> _merge_and_split -> _sort_nodes_lexicographic"
  - "feet->metres unit conversion via lib/Snippets/_units_conversion.convert_internal_units, 4-decimal-place rounded (REVIT-T1-04)"
  - "Chebyshev (L-infinity) 1mm endpoint-merge tolerance (REVIT-T1-03)"
  - "T-junction split (D-05) with iterative restart-on-change loop + 10000-iteration DoS guard (threat T-05-07)"
  - "Mid-span crossing detection (D-06, warn-not-split) with shared-node-skip"
  - "Lexicographic (x, y) node sort + member-index remap (D-08) producing byte-identical node ordering across Revit sessions"
  - "Zero-length segment silent-skip (Claude's Discretion) in both _extract_segments and _merge_and_split (i != j guard)"
  - "Pipeline wired into main(); TODO(05-02) removed; TODO(05-03) preserved for plan 05-03"
affects:
  - 05-03-PLAN.md  # plan 05-03 consumes the (nodes_m, members_pairs, crossings) tuple from main() and builds the JSON payload at TODO(05-03)
  - 05-04-PLAN.md  # live UAT validates the pipeline against real Revit detail-line fixtures

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Iterative restart-on-change T-junction split with bounded max_iter — avoids infinite loops under pathological self-touching geometry"
    - "Chebyshev (L-inf) tolerance for node-merge vs Euclidean for perpendicular-foot test — each matches its natural metric"
    - "Parametric tolerance t_tol = tol / seg_len — scales correctly with segment length (RESEARCH pitfall 10)"
    - "Offline algorithm verification via ast-parse-safe helpers extracted from script.py with regex + exec into a Revit-free namespace"

key-files:
  created: []
  modified:
    - /Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py

key-decisions:
  - "Kept `import math` at module top (alongside os/re/sys/json) rather than inside the two callers — cleaner and pyRevit loads stdlib modules lazily anyway"
  - "Preserved the `i != j` guard after _get_or_add_node in _merge_and_split — acts as a second line of defence against zero-length lines that slipped past the _extract_segments filter due to per-axis-tolerance asymmetry"
  - "Kept both _extract_segments zero-length check (Chebyshev tol on post-rounded coords) AND the merge-step i != j guard — defence in depth for REVIT-T1-03"

patterns-established:
  - "Plan-to-plan insertion points: TODO(05-02) -> TODO(05-03) chain lets each downstream plan splice at exact markers without touching prior code"
  - "Offline algorithm verification harness: extract helper sources via `re.search(r'^def <name>.*?(?=^def |^# -- )')` and exec into a Revit-free namespace — confirms numerical correctness without needing a Revit session"

requirements-completed:
  - REVIT-T1-03
  - REVIT-T1-04

# Metrics
duration: 3.5min
completed: 2026-04-21
---

# Phase 5 Plan 2: Revit Geometry Pipeline Summary

**Pure-Python geometry pipeline inside `ExportToPDA.pushbutton/script.py`: feet->metres conversion + 4-dp rounding, 1mm Chebyshev endpoint-merge, T-junction split, mid-span crossing detection, and lexicographic node sort — all wired into `main()` at the plan 05-01 TODO marker.**

## Performance

- **Duration:** 3.5 min
- **Started:** 2026-04-21T16:42:42Z
- **Completed:** 2026-04-21T16:46:10Z
- **Tasks:** 3
- **Files modified:** 1 (sibling repo CustomRevitExtension/.../script.py)

## Line Count Delta

- **Before (plan 05-01 end):** 156 lines
- **After (plan 05-02 end):** 352 lines
- **Delta:** +196 lines (plan target was +150; extra ~45 lines are docstrings + comments)

## Accomplishments

- Delivered REVIT-T1-04 in full: every endpoint converted via `convert_internal_units(value, get_internal=False, units='m')`, rounded to 4 decimal places, Z dropped entirely (`p0.Z` / `p1.Z` never read — grep-verified absent).
- Delivered REVIT-T1-03 in full: `_get_or_add_node` uses Chebyshev (L-infinity) tolerance — `|dx| < tol AND |dy| < tol` where `tol = TOLERANCE_M = 0.001`. Matches the requirement's literal "within 1mm".
- Implemented D-05 T-junction split via iterative restart-on-change loop: when an unattached node lands on the interior of a member, the member is replaced with two new members sharing the junction node; loop repeats until no splits occur, bounded by `max_iter = 10000` (threat T-05-07 DoS mitigation).
- Implemented D-06 mid-span crossing detection without splitting: unordered-pair walk over members, shared-node members skipped, parametric interior test on both segments via `_segments_cross_interior`; any hit recorded in the `crossings` list for plan 05-03 to report.
- Implemented D-08 lexicographic node sort + member-index remap: `indexed.sort(key=lambda pair: (pair[1][0], pair[1][1]))` produces byte-identical node ordering across Revit sessions for the same geometry, enabling diffable fixtures.
- Wired the full pipeline into `main()`: TODO(05-02) replaced with the three pipeline calls + an empty-segment guard (all-zero-length-lines abort path); preview TaskDialog reports node / member counts and mid-span crossing count (if any); TODO(05-03) marker preserved for plan 05-03.

## Task Commits (sibling repo /Users/catrinevans/Documents/CustomRevitExtension/)

1. **Task 1: Add _extract_segments + _get_or_add_node helpers + zero-length filter** — `0ae500a` (feat, +40 lines)
2. **Task 2: Add _point_on_segment_interior + _segments_cross_interior + _merge_and_split + _sort_nodes_lexicographic** — `66f012a` (feat, +139 lines)
3. **Task 3: Wire pipeline into main() — replace TODO(05-02) with _extract_segments -> _merge_and_split -> _sort_nodes_lexicographic** — `359862b` (feat, +24 / -7 lines)

**pda_project planning-artifact commit:** recorded separately after this SUMMARY.md lands.

## Grep-Verifiable Markers Confirmed

All `must_haves.artifacts[0].contains_all` strings present in `script.py`:

| Marker | Present |
|---|---|
| `def _extract_segments` | yes |
| `def _get_or_add_node` | yes |
| `def _merge_and_split` | yes |
| `def _sort_nodes_lexicographic` | yes |
| `def _point_on_segment_interior` | yes |
| `def _segments_cross_interior` | yes |
| `convert_internal_units` | yes |
| `round(` | yes (5 occurrences — 4x in `_extract_segments` for x0/y0/x1/y1, 1x in `_get_or_add_node`) |
| `TOLERANCE_M` | yes |

All `must_haves.key_links` patterns present:

| Link | Pattern | Present |
|---|---|---|
| `main()` -> `_merge_and_split` | `_merge_and_split\(` | yes |
| `_extract_segments` -> `convert_internal_units` | `convert_internal_units\(.*get_internal=False.*units='m'\)` | yes |
| `_sort_nodes_lexicographic` -> remap | `old_to_new` | yes |

## Task-Level Acceptance Criteria (all passed)

- Task 1: all ≥4 `round(..., 4)` calls present (count: 5); no `p0.Z`/`p1.Z` access; Chebyshev-merge test uses `abs(n[0] - pt_m[0]) < tol` and `abs(n[1] - pt_m[1]) < tol`; `ast.parse` succeeds; no f-strings.
- Task 2: `import math` at module top; all four helper defs present; `t_tol = tol / seg_len` present (pitfall 10); parallel-line guard `abs(denom) < 1e-12` present; `crossings.append((a_idx, b_idx, hit))` present; shared-node-skip `if bi == ai or bi == aj or bj == ai or bj == aj` present; lexicographic sort key `lambda pair: (pair[1][0], pair[1][1])` present; `ast.parse` succeeds.
- Task 3: all three pipeline calls present (`segments = _extract_segments(detail_lines)`, `nodes_m, members_pairs, crossings = _merge_and_split(segments)`, `nodes_m, members_pairs = _sort_nodes_lexicographic(nodes_m, members_pairs)`); `TODO(05-02)` removed; `TODO(05-03)` preserved; "mid-span crossing" text present in preview TaskDialog; "No straight detail lines found" empty-guard present; `wc -l` = 352 ≥ 220.

## Offline Algorithm Sanity Checks

### Task 2 plan-specified foot-of-perpendicular checks

```
T-junction case: p=(1,0) on segment (0,0)->(2,0)        -> True   [PASS]
Endpoint-coincidence case: p=(0,0) on (0,0)->(2,0)      -> False  [PASS]
Off-segment case: p=(1,1) on (0,0)->(2,0), tol=1mm      -> False  [PASS]
```
Python-3 harness output: `OK`.

### Extended truth-fixture verification (all 6 `must_haves.truths` checked)

Ran `_merge_and_split` + `_sort_nodes_lexicographic` extracted from `script.py` against the plan's truth fixtures in a Revit-free namespace:

```
PORTAL 4n/3m/0crossings OK, sorted: [[0.0, 0.0], [0.0, 3.0], [4.0, 0.0], [4.0, 3.0]]
T-JUNCTION 4n/3m/junction-touches-3 OK
CROSS 4n/2m/1crossing OK
LINE 2n/1m OK
ZERO-LENGTH-GUARD OK
REPRODUCIBILITY OK

All plan truth fixtures pass offline algorithm check.
```

| Truth (from PLAN must_haves.truths) | Check | Result |
|---|---|---|
| Truth 2: 3-line portal frame -> 4n, 3m, 0 crossings | `segs=[(0,0)->(0,3), (0,3)->(4,3), (4,3)->(4,0)]` | PASS |
| Truth 3: T-junction (stub ends on interior of long line) -> 4n, 3m, junction touched by 3 members | `segs=[(0,0)->(4,0), (2,0)->(2,2)]` | PASS (split produced) |
| Truth 4: cross-pattern -> 4n, 2m, 1 crossing | `segs=[(0,0)->(4,0), (2,-1)->(2,1)]` | PASS (crossings=[(0,1,(2.0,0.0))]) |
| Truth 5: zero-length line silently skipped | `segs=[(0,0)->(0.0005,0.0005)]` through merge's `i != j` guard | PASS (0 members) |
| Truth 6: reproducible node ordering under input reorder | `segs` reordered -> identical sorted output | PASS |
| Truth 1: 10ft line -> [[0, 0], [3.048, 0]] | coord-only check (convert_internal_units can't run without Revit) | PASS for the merge+sort half; live `convert_internal_units(10 ft, ...)` numeric check deferred to plan 05-04 |

Truth 7 (no Z field in output) is structurally guaranteed: `_extract_segments` never reads `.Z` (grep-verified), so downstream `nodes_m` is unconditionally 2-D `[x, y]` pairs.

## Decisions Made

- **`import math` placement:** at module top alongside `os`, `re`, `sys`, `json`, `json` (not inside each caller). Cleaner. Plan allowed either; executor picked the tidy option.
- **Second zero-length guard:** kept both the Chebyshev-on-rounded-coords check in `_extract_segments` AND the `if i != j` guard after `_get_or_add_node` in `_merge_and_split`. The second guard catches the edge case where a line's two endpoints are further apart than 1mm Chebyshev but both dedup to the same existing node — defence in depth for the "no zero-length-from-merge members" invariant.
- **Preview TaskDialog title:** "PDA Export (plan 05-02 preview)" — makes it visually obvious that this is pre-JSON-emit scaffold output, not the final success dialog (which arrives in plan 05-03).

## Deviations from Plan

None - plan executed exactly as written. Plan's recommended implementation, patterns, and docstrings adopted verbatim aside from the ASCII-only doc character substitutions (already plan-sanctioned, e.g. `Linf` for the Greek infinity symbol).

## Issues Encountered

None. All three tasks passed their automated verify block on the first attempt.

## Known Stubs

These stubs are **intentional scaffolding**, called out explicitly in this plan and/or plan 05-03 (not verifier-visible defects):

| Marker | File | Resolved in |
|---|---|---|
| `TODO(05-03): build JSON payload, save via forms.save_file, show success dialog` | `ExportToPDA.pushbutton/script.py` (inside `main()`) | Plan 05-03 |

The preview TaskDialog ("Pipeline output: N nodes, M members; ...") is a deliberate placeholder that plan 05-03 replaces with the real success dialog (node/member counts + full save path).

## User Setup Required

None — no external service configuration required for this plan. All changes are pure-Python inside the sibling Revit extension; `lib/Snippets/_units_conversion.py` was already in place.

Live Revit UAT (validating that `convert_internal_units` produces the expected 4-dp metres and that real drafting-view geometry hits the T-split / crossing branches) is deferred to plan 05-04.

## Threat Model Check

Threat register from PLAN.md:

- **T-05-07 (DoS, T-junction split loop):** Mitigated. `_merge_and_split` contains `max_iter = 10000` safety bound; the `while changed and guard < max_iter` loop cannot run longer than that. Typical drafting views have < 100 lines — expected guard count < 50.
- **T-05-08 (Information Disclosure):** N/A — no file I/O in this plan.
- **T-05-09 (Tampering via tolerance):** Accepted. `TOLERANCE_M = 0.001` is a module-level constant; no user-facing override per D-07.
- **T-05-10 (S/R/E):** N/A.

No new threat surface introduced beyond the plan's register.

## Open Items Handed to Plan 05-04 (HUMAN-UAT)

The following can only be validated inside a live Revit session and are explicitly out of scope here:

- Live T-junction split: draw 4ft line (0,0)->(4,0) + stub at (2,0)->(2,2) in a Revit drafting view; verify exported JSON has 4 nodes + 3 members.
- Live mid-span crossing: draw two crossing detail lines without shared endpoints; verify success TaskDialog includes the crossing warning suffix.
- Numeric round-trip: draw 10ft line; verify exported metres value is `3.048` (plan 05-03's JSON emit makes this observable).
- `convert_internal_units` behaviour across Revit 2021+ (UnitTypeId) vs pre-2021 (DisplayUnitType) — lib helper handles both but only a live session confirms the `rvt_year` branch works end-to-end.

## Next Plan Readiness

- **Plan 05-03 can start immediately** — the tuple `(nodes_m, members_pairs, crossings)` in `main()` is the exact shape 05-03 consumes; `TODO(05-03)` marker is at the correct insertion point (line 321 in the current file) with `json`, `os`, `re` already imported and constants `GRID_PX`, `ORIGIN_PX`, `DEFAULT_E`, `DEFAULT_I`, `DEFAULT_A` already defined.
- **No blockers** for plan 05-03 or 05-04.

## Self-Check: PASSED

All claimed artefacts and commits verified:

- `script.py` at 352 lines in the sibling-repo pushbutton dir.
- Sibling-repo commits `0ae500a` (Task 1), `66f012a` (Task 2), `359862b` (Task 3) resolvable via `git -C /Users/catrinevans/Documents/CustomRevitExtension log`.
- All `must_haves.artifacts[0].contains_all` markers present (grep-verified).
- All `must_haves.key_links` patterns present (grep-verified).
- `python3 -c "import ast; ast.parse(...)"` succeeds.
- No f-strings in script.py.
- `wc -l < script.py` = 352, exceeds plan's ≥220 threshold.
- All 6 `must_haves.truths` structural/algorithmic invariants verified offline against the extracted helper implementations.

---
*Phase: 05-revit-tier-1-geometry-exporter*
*Completed: 2026-04-21*
