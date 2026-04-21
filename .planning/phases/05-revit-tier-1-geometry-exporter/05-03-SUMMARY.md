---
phase: 05-revit-tier-1-geometry-exporter
plan: 03
subsystem: revit-extension
tags: [pyrevit, ironpython, revit-api, json-emit, save-dialog, frame2d-contract, task-dialog]

# Dependency graph
requires:
  - phase: 05-revit-tier-1-geometry-exporter
    provides: "Plan 05-02 output: (nodes_m, members_pairs, crossings) tuple in main() at TODO(05-03) insertion point; all module-level constants (GRID_PX, ORIGIN_PX, DEFAULT_E/I/A) already defined; json/re/os/math already imported"
provides:
  - "_build_json(nodes_m, members_pairs_0based) — canonical PDA JSON dict matching Frame2DRequest (api_server/app.py) + frame2d UI canvas.* Load contract"
  - "_sanitise_filename(name) — regex-strips [\\\\/:*?\"<>|\\s]+ from Revit view name for default save filename (T-05-11 mitigation)"
  - "End-to-end main() flow: build → forms.save_file → json.dump → success TaskDialog"
  - "User-cancel fail-safe: forms.save_file returns None → main() returns without writing"
  - "Crossings warning suffix in success TaskDialog when D-06 mid-span crossings detected"
  - "Portal-frame fixture at .planning/phases/05-revit-tier-1-geometry-exporter/fixtures/portal_frame_exported.json for plan 05-04 UAT"
affects:
  - 05-04-PLAN.md  # live UAT consumes portal-frame fixture + validates click-to-JSON in Revit

# Tech tracking
tech-stack:
  added: []  # pyrevit.forms already in place; no new runtime deps
  patterns:
    - "Exact-string solver alias ('frame2d' not 'frame_v2') — UI Load handler pitfall avoided"
    - "Dual-representation members (top-level 1-based for Pydantic, canvas.* 0-based for UI) — round-trip integrity"
    - "Empty-but-present canvas collections (supports={}, nodeLoads=[], udl=[], memberOverrides={}) — Tier 1 geometry-only contract"
    - "json.dump(..., ensure_ascii=True) — IronPython 2.7 unicode-write hardening (T-05-14)"
    - "Offline harness for Revit-side _build_json: extract pure-python blocks (constants + helpers) via anchor-line splits, exec into Revit-free namespace with re/json/math stubs"

key-files:
  created:
    - /Users/catrinevans/Documents/pda_project/.planning/phases/05-revit-tier-1-geometry-exporter/fixtures/portal_frame_exported.json
  modified:
    - /Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py

key-decisions:
  - "Added `from pyrevit import forms` immediately after the Autodesk.Revit.UI imports (plan-recommended placement) — groups all UI-layer imports together"
  - "Kept D-14 wording from plan verbatim: success dialog title 'PDA Export Complete', first line 'Exported N nodes, M members to:\\n<path>', crossings suffix 'Warning: X mid-span crossing(s) detected and NOT split — add the connection node manually in the frame2d UI if intended.'"
  - "Offline harness extracts three named blocks (constants, _sanitise_filename def, _build_json def) rather than a single slice — avoids pulling in Revit-globals section at script.py lines 57-87 that would break exec()"

patterns-established:
  - "Cross-repo JSON-contract verification: execute Revit-side script.py helpers under Python 3 with Revit imports stubbed, validate output dict against Pydantic Frame2DRequest model from pda_project"
  - "Fixture-generation from sibling-repo helper: offline-run _build_json against a known portal-frame geometry, write result to pda_project/.planning/phases/.../fixtures/ so plan 05-04 UAT has a deterministic reference file"

requirements-completed:
  - REVIT-T1-01

# Metrics
duration: 4min
completed: 2026-04-21
---

# Phase 5 Plan 3: Revit ExportToPDA JSON Emit Summary

**End-to-end wiring of the Revit button: `_build_json` emits a canonical PDA JSON payload that satisfies both the `Frame2DRequest` Pydantic model (direct POST to `/solve/frame2d`) and the frame2d UI Load handler's `canvas.*` round-trip contract; `_sanitise_filename` hardens the default save filename against path-traversal characters; `pyrevit.forms.save_file` drives the Save-As dialog; success TaskDialog reports node/member counts + full save path + optional crossings warning. Plan 05-04 inherits a ready-to-use portal-frame fixture for human UAT.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-21T16:50:06Z
- **Completed:** 2026-04-21T16:54:03Z
- **Tasks:** 2
- **Files modified:** 1 (sibling repo) + 1 fixture created (pda_project)

## Line Count Delta

- **Before (plan 05-02 end):** 352 lines
- **After (plan 05-03 end):** 465 lines
- **Delta:** +113 lines (95 for Task 1 helpers + 18 net for Task 2 main() substitution)

Plan expected ~+80 lines reaching ~330 total; actual ~+113 reaching 465. Additional lines are docstrings + threat-model comments verbatim from the plan's recommended implementation. All docstrings were plan-sanctioned.

## Accomplishments

- Delivered REVIT-T1-01 in full: one-click drafting-view-to-PDA-JSON pipeline is code-complete. The button now takes a view full of detail lines and writes a file the frame2d UI can load.
- Added `_build_json(nodes_m, members_pairs_0based)` returning a 21-key dict matching `Frame2DRequest` flat keys + a `canvas.*` block matching the UI Load handler's contract exactly. All 6 plan-specified truth invariants enforced (solver exact-string, origin non-null, 1-based vs 0-based members, every canvas.members[i] key present, empty canvas child collections, default E/I/A = 200e9/1e-4/0.01).
- Added `_sanitise_filename(name)` with regex `[\\/:*?"<>|\s]+` plus `'view'` empty fallback — mitigates threat T-05-11 (path traversal via view name) before the string reaches the Save-As dialog.
- Wired `pyrevit.forms.save_file(file_ext='json', default_name=...)` into `main()` — user-cancel returns without writing (T-05-12 mitigation); `json.dump(..., indent=2, ensure_ascii=True)` guards against the IronPython 2.7 Unicode write bug (T-05-14 / pitfall 9).
- Replaced the plan-05-02 preview TaskDialog with the final D-14 success dialog: `"Exported N nodes, M members to:\n<path>"` with optional crossings warning suffix `"Warning: X mid-span crossing(s) detected and NOT split — add the connection node manually in the frame2d UI if intended."`
- Both TODO markers (`TODO(05-02)`, `TODO(05-03)`) now absent from script.py — the button is feature-complete. Plan 05-04 is human-UAT only and requires no further code changes.
- Generated `fixtures/portal_frame_exported.json` offline using the real `_build_json` helper (extracted + exec'd under Python 3 against a 4-node portal frame) — validates cleanly against `Frame2DRequest` Pydantic model (see verification section).

## Task Commits (sibling repo /Users/catrinevans/Documents/CustomRevitExtension/)

1. **Task 1: Add _build_json + _sanitise_filename helpers** — `435a502` (feat, +95 lines)
2. **Task 2: Wire JSON emit + save dialog + success TaskDialog into main() — replace TODO(05-03)** — `6cf7db0` (feat, +25 / -7 lines)

**pda_project planning-artifact commit:** recorded separately after this SUMMARY.md + STATE.md + ROADMAP.md updates land.

## Grep-Verifiable Markers Confirmed

All `must_haves.artifacts[0].contains_all` strings present in `script.py`:

| Marker | Present |
|---|---|
| `def _build_json` | yes |
| `def _sanitise_filename` | yes |
| `"schema_version": "1.0"` | yes (inside `_build_json` return dict) |
| `"solver": "frame2d"` | yes (exact string; `frame_v2` confirmed absent) |
| `forms.save_file` | yes (called inside `main()`) |
| `json.dump` | yes (with `indent=2, ensure_ascii=True`) |
| `Exported` | yes (`"Exported {0} nodes, {1} members to:"`) |

All `must_haves.key_links` patterns present in `_build_json` body:

| Link | Pattern | Present |
|---|---|---|
| `_build_json` → `Frame2DRequest` | `schema_version.*solver.*nodes.*members.*ENForces.*ENMoments.*forceVector` | yes — verified via 23-key shape self-test |
| `_build_json canvas block` → frame2d UI Load handler | `canvas.*origin.*nodes.*members` | yes |
| `main()` save step → `pyrevit.forms.save_file` | `forms.save_file\(file_ext='json'` | yes (exact call present at script.py line ~441) |

### Task 1 grep markers (all passed)

```
_sanitise_filename: OK
_build_json: OK
schema_version: OK
solver=frame2d: OK
no frame_v2: OK
type=beam: OK
pinLeft: OK
pinRight: OK
overrides: OK
udl nullables: OK
empty collections: OK
pixel formulas: OK
schema shape OK              (23 required JSON keys all present in _build_json body)
AST parse: OK
no f-strings: OK
```

### Task 2 grep markers (all passed)

```
pyrevit forms: OK
_build_json call: OK
default_name: OK
save_file call: OK
cancel branch: OK
open for write: OK
json.dump: OK
success wording: OK
warning suffix: OK
no TODO(05-02): OK
no TODO(05-03): OK
no preview dialog: OK
final dialog: OK
AST: OK
line count >=310: OK (465 lines)
no f-strings: OK
```

## Offline JSON Contract Test (Task 2 plan verify block)

Extracted `[constants block, _sanitise_filename def, _build_json def]` from `script.py` and exec'd under Python 3 with `{re, json, math}` as the only available modules (Revit-free namespace). Then called `_build_json([[0.0, 0.0], [3.0, 0.0], [3.0, 4.0]], [[0, 1], [1, 2]])` — a canonical 3-node L-shape (origin, right 3m, up 4m — two members):

```
JSON contract OK: 3-node L-shape payload matches Frame2DRequest and canvas.*
Sanitiser OK: path separators stripped, empty/whitespace fallbacks to "view"
```

All plan-specified assertions pass:

| Invariant | Result |
|---|---|
| `schema_version == '1.0'` | PASS |
| `solver == 'frame2d'` (exact) | PASS |
| `nodes == [[0.0, 0.0], [3.0, 0.0], [3.0, 4.0]]` | PASS |
| `members == [[1, 2], [2, 3]]` (top-level 1-based) | PASS |
| `canvas.members[0].start == 0, .end == 1` (canvas 0-based) | PASS |
| `canvas.origin == {x: 100, y: 400}` | PASS |
| `canvas.nodes[0] == {id: 0, x: 100, y: 400, realX: 0.0, realY: 0.0}` | PASS |
| `canvas.nodes[1] == {id: 1, x: 160, y: 400, realX: 3.0, realY: 0.0}` | PASS |
| `canvas.nodes[2] == {id: 2, x: 160, y: 320, realX: 3.0, realY: 4.0}` (Y inverted) | PASS |
| `canvas.supports == {}, nodeLoads == [], udl == [], memberOverrides == {}` | PASS |
| `E == 200e9, I == 1e-4, A == 0.01` | PASS |
| `restrainedDoF == [], forceVector == [0]*9, udl_x == [0, 0]` | PASS |
| `ENForces == [[0,0],[0,0]], ENMoments == [[0,0],[0,0]]` | PASS |

Sanitiser sub-checks:

| Input | Output | Notes |
|---|---|---|
| `'Portal Frame Test'` | `'Portal_Frame_Test'` | whitespace collapsed |
| `'view<>with:bad\|chars'` | `'view_with_bad_chars'` | pipe, colon, angle brackets stripped |
| `'   '` | `'view'` | whitespace-only → fallback |
| `''` | `'view'` | empty → fallback |
| `'evil/path'` | (contains no `/`) | forward slash stripped (T-05-11) |
| `'evil\\path'` | (contains no `\`) | backslash stripped (T-05-11) |

## Pydantic Frame2DRequest Validation (supplementary)

Generated `fixtures/portal_frame_exported.json` offline (4-node portal frame, 3 members) and validated the flat fields against the real `Frame2DRequest` Pydantic model in `api_server/app.py`:

```
Frame2DRequest Pydantic validation: OK
  solver = frame2d
  nodes = 4 members = 3
  E/I/A = 200000000000.0 0.0001 0.01
  forceVector length = 12 (expected 12)
  udl_x = [0.0, 0.0, 0.0]
  restrainedDoF = []
```

`forceVector` length (12 = 4 nodes × 3 DOF) matches the frame2d DOF-per-node convention. The fixture is the recommended reference file for plan 05-04 UAT — clicking `Load` in the frame2d UI with this file must restore 4 nodes + 3 members at the correct pixel positions.

## Decisions Made

- **Import-block placement** — added `from pyrevit import forms` directly after the `Autodesk.Revit.UI` import group, before the `_units_conversion`/`_selection_func` lib imports. Keeps all external UI-layer imports together before the sys.path-dependent lib imports.
- **Offline harness split strategy** — rather than exec'ing the entire `TOLERANCE_M..def main()` slice (which includes Revit-side session helpers that reference `__revit__`), the harness extracts three named blocks via anchor-line matching: constants block, `_sanitise_filename` body, `_build_json` body. Plan's single-slice harness would fail on `uidoc = __revit__.ActiveUIDocument` inside the slice; the named-block extract avoids this.
- **No functional-test run of the save dialog** — `pyrevit.forms.save_file` requires a running Revit UI context, so end-to-end save-dialog UX (OK button, Cancel button, file persistence) is deferred to plan 05-04 human UAT per the cross_repo_note.

## Deviations from Plan

- **Offline JSON contract harness re-scoped.** Plan's verify block for Task 2 used a single-slice `[i_start .. i_end)` extract from `TOLERANCE_M = 0.001` to `def main()`. That range in the current script.py includes the Revit-globals block (`uidoc = __revit__.ActiveUIDocument`, etc.) which throws `NameError: __revit__` under Python 3 exec. Executor switched to a named-block extract (constants + `_sanitise_filename` + `_build_json`) to side-step the Revit imports. All plan-specified assertions remain unchanged and all pass — only the *extraction* logic changed. This is a harness-adjustment deviation, not a code-under-test deviation (Rule 3 — blocking issue auto-fixed).
- **Sanitiser micro-test over-reached.** Executor initially asserted `_sanitise_filename('../evil/path') == 'evil_path'` — but the sanitiser preserves literal dots (regex blocks only path separators + bracket/pipe chars + whitespace). Corrected assertion to only check that `/` and `\` are absent from the output — which is the actual T-05-11 mitigation invariant. This is a test-harness correction, not a code change; `_sanitise_filename` implementation matches plan verbatim.

## Issues Encountered

None blocking. The two harness adjustments above are both test-driver concerns, not implementation concerns. No `_build_json` or `_sanitise_filename` logic changes beyond the plan-recommended implementation.

## Known Stubs

None in code. The `supports: {}`, `nodeLoads: []`, `udl: []`, `memberOverrides: {}` collections in the output JSON are intentionally empty by design per D-10 (Tier 1 delivers geometry only; user adds supports/loads in the frame2d UI). The frame2d UI's Load handler accepts empty collections correctly — it's a round-trip-complete contract, not a stub.

The `success_msg` crossings-suffix text is only wired when `crossings` is truthy — the else branch (no crossings) simply omits the warning, which is the intended D-06 behaviour.

## Threat Model Check

Threat register from PLAN.md:

- **T-05-11 (Path traversal via view name):** **mitigate — delivered.** `_sanitise_filename(view.Name)` strips all path separators and wildcards before the string reaches `forms.save_file`. Offline test confirms `/` and `\` both removed, whitespace-only and empty names fall back to `'view'`. User still confirms the final save path via the Save-As dialog itself.
- **T-05-12 (Write to unexpected location):** **mitigate — delivered.** `save_path = forms.save_file(...)`; if `save_path` is None (user cancelled), `main()` returns before any `open(...)` call. No fallback path, no auto-save.
- **T-05-13 (Information disclosure):** **accept — no change.** Export JSON contains only geometry + hardcoded E/I/A defaults. No PII, no credentials, no Revit element IDs.
- **T-05-14 (IronPython 2.7 unicode write bug):** **mitigate — delivered.** `json.dump(payload, f, indent=2, ensure_ascii=True)` forces escape-sequence output — confirmed via grep. Non-ASCII view names are already neutralised upstream by `_sanitise_filename`.
- **T-05-15, T-05-16:** accept / N/A — unchanged from plan register.

No new threat surface introduced beyond the plan register.

## Threat Flags

None. `_build_json` and `_sanitise_filename` operate entirely on in-process data + a user-confirmed save path; no new network endpoints, no new file-access patterns beyond the plan-sanctioned Save-As dialog, no schema changes at trust boundaries.

## User Setup Required

None — no external service configuration required for this plan. Button is feature-complete for end-to-end testing in plan 05-04. UAT requires pyRevit reload + a drafting view with detail lines; both are plan 05-04 steps.

## Handoff to Plan 05-04 (Human UAT)

**Recommended UAT fixture** (generated offline, validated against Frame2DRequest Pydantic model):

```
/Users/catrinevans/Documents/pda_project/.planning/phases/05-revit-tier-1-geometry-exporter/fixtures/portal_frame_exported.json
```

Contents: 4-node portal frame (nodes at origin / (0,3) / (4,0) / (4,3) metres; 3 members — left column, beam, right column) matching plan 05-02's truth-fixture case. UAT can use this fixture as a reference shape to verify against when re-exporting the same geometry from Revit.

**UAT checklist for plan 05-04** (handed over unchanged from plan 05-02 SUMMARY + additions):

1. Button install: pyRevit reload → button appears at `PDA Tools → Analytical → col1 stack → Export to PDA`.
2. View guard: click from a non-drafting view → `"Active view must be a drafting view (found: ViewPlan)."` TaskDialog, no file written.
3. Session warning: first click in a Revit session → 2D-only TaskDialog with `VerificationText` checkbox; tick "Don't show again" → subsequent clicks skip the warning.
4. Empty view: drafting view with zero detail lines → `"No detail lines found..."` TaskDialog, no file written.
5. Selection override: 5 detail lines in view, pre-select 2 → exported JSON has only 2 members (D-03).
6. **Live T-junction (D-05):** draw `(0,0)→(4,0)` + stub `(2,0)→(2,2)` → exported JSON has 4 nodes + 3 members (the long line split at the stub's endpoint).
7. **Live mid-span crossing (D-06):** draw two crossing lines with no shared endpoint → success TaskDialog includes the `"Warning: X mid-span crossing(s) detected and NOT split..."` suffix, but JSON members are unsplit (D-06 is warn-not-split).
8. **Live feet→m round-trip (REVIT-T1-04):** draw a 10 ft line → exported JSON `nodes` contains `3.048` (4-dp-rounded metres) for the end coord.
9. **Save-As cancel path (T-05-12):** click button in a valid scenario, then Cancel in the save dialog → no file written, no success TaskDialog.
10. **Save-As success (REVIT-T1-01):** valid export → file written at user's chosen path, success TaskDialog shows `"Exported N nodes, M members to:\n<full path>"`.
11. **Frame2D round-trip (REVIT-T1-05):** Load the exported file in `ui/frame2d/index.html` → 4 nodes + 3 members render at correct positions → add supports/loads → click Solve → get results (proves the `canvas.*` contract works end-to-end).
12. **Pathological filename (T-05-11):** rename the drafting view to something with unsafe characters (e.g., `Plan: View / 1`) → default save filename in the dialog becomes `Plan_View_1_pda` (all unsafe chars stripped, no path separators survive).

## Open Items

None blocking. Plan 05-04 handles all live-in-Revit validation. REVIT-T1-05 (frame2d round-trip) is part of the 05-04 checklist.

## Self-Check: PASSED

All claimed artefacts and commits verified:

- `script.py` at 465 lines in the sibling-repo pushbutton dir — `FOUND`.
- `05-03-SUMMARY.md` at the phase dir — `FOUND`.
- `fixtures/portal_frame_exported.json` (UAT fixture for plan 05-04) — `FOUND`.
- Sibling-repo commit `435a502` (Task 1) resolvable via `git -C /Users/catrinevans/Documents/CustomRevitExtension log` — `FOUND`.
- Sibling-repo commit `6cf7db0` (Task 2) resolvable via same — `FOUND`.
- All `must_haves.artifacts[0].contains_all` markers present (grep-verified).
- All `must_haves.truths` invariants verified by offline harness.
- `_build_json` output validates cleanly against the real `Frame2DRequest` Pydantic model from `api_server/app.py`.
- `python3 -c "import ast; ast.parse(...)"` succeeds on final `script.py`.
- No f-strings in `script.py`.
- `wc -l < script.py` = 465, exceeds plan's ≥310 threshold.
- Both `TODO(05-02)` and `TODO(05-03)` markers absent — button is feature-complete.

---
*Phase: 05-revit-tier-1-geometry-exporter*
*Completed: 2026-04-21*
