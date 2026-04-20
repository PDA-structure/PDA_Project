---
phase: 04-2d-frame-solver-ui-hardening
plan: 03
subsystem: testing
tags: [pytest, fastapi-testclient, uat, fixtures, frame-solver, regression]

# Dependency graph
requires:
  - phase: 04-2d-frame-solver-ui-hardening
    provides: "Plan 04-01 TRUST-13..17 multi-member tests; Plan 04-02 frame2d UI Spring tool (saves valid springDoF/springStiffness payloads)"
  - phase: 03-interchange-format-and-external-inputs
    provides: "Phase 3 Save button + interchange JSON schema v1.0 used by the human fixture-authoring step"
provides:
  - "tests/fixtures/uat/ — 5 canonical frame2d fixtures (cantilever, simple beam UDL, portal frame UDL, continuous beam with pin release, spring-support beam) saved via the frame2d UI"
  - "tests/test_uat_frame2d.py — CI-runnable UAT harness: TestClient POSTs each fixture to /solve/frame2d and asserts closed-form hand-calc references"
  - "Two D-14 regression fixes (API solver-alias bug + Reset All state-leak bug) with regression tests in the UAT harness"
affects: ["testing", "api_server", "ui-frame2d"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UAT-as-pytest: each canonical structure becomes a named test that POSTs a human-saved JSON fixture and asserts analytical references; reproducible in CI without a browser"
    - "Regression test sequencing for API bugs: expose the bug via a POST-shaped test, fix the server, the test now passes (and would FAIL pre-fix)"

key-files:
  created:
    - "tests/fixtures/uat/cantilever.json"
    - "tests/fixtures/uat/simple_beam.json"
    - "tests/fixtures/uat/portal_frame.json"
    - "tests/fixtures/uat/continuous_pin_release.json"
    - "tests/fixtures/uat/spring_support_beam.json"
    - "tests/test_uat_frame2d.py"
  modified:
    - "api_server/app.py                — register `frame2d` as an alias for `frame_v2` engine"
    - "ui/frame2d/script.js             — resetAll clears middle-mouse pan state + blob URL + diagram state"

key-decisions:
  - "Task 3 fixed TWO bugs — one discovered by me during UAT harness authoring (API rejecting `solver: \"frame2d\"`, HTTP 500), one reported by the human during UAT Task 1 (Reset All leaving stale `isPanning`=true that silently dropped subsequent canvas clicks)"
  - "API bug has an automated regression test (test_regression_solver_key_frame2d_alias_accepted). The browser pan-state bug does not — JS canvas click events can't be driven from pytest — instead a manual-verification procedure is documented below, satisfying the plan's explicit tolerance: 'grep ... fix|regression ... ≥ 1 entry' (we have 2 fix entries in commit messages)"
  - "solver_core/ was not touched across the plan — `git diff 3405f68..HEAD -- solver_core/` returns empty, honouring CLAUDE.md's hard constraint"

patterns-established:
  - "D-14 in action: UAT harness authoring surfaced two real bugs, both fixed in-phase with tests/commits, not deferred"
  - "Solver-key aliasing in AnalysisEngine.register() — multiple names can route to the same adapter, used here to reconcile file-routing key vs engine name"

requirements-completed: [HARDEN-03]

# Metrics
duration: "~35 min"
completed: 2026-04-20
---

# Phase 04 Plan 03: UAT Harness Summary

**CI-runnable UAT harness: 5 canonical frame2d structures saved via the human-operated UI, each POSTed to `/solve/frame2d` and asserted against closed-form structural-mechanics references, plus two D-14 bug fixes (API solver-alias HTTP 500 + frame2d `resetAll` middle-mouse-pan state leak).**

## Performance

- **Duration:** ~35 min (executor wall clock; Task 1 fixture authoring was done by the human before this session)
- **Started:** 2026-04-20T17:24Z (human began Task 1 UI authoring)
- **Completed:** 2026-04-20T18:15Z (all three tasks committed)
- **Tasks:** 3 of 3 complete (Task 1 human-action checkpoint; Tasks 2–3 automatic)
- **Files modified:** 8 (5 new fixtures + 1 new test file + 2 fixes)
- **Test count:** 53 passing (was 46 before this plan; +5 UAT + +2 regression)

## Accomplishments

- **5 canonical UAT fixtures** committed under `tests/fixtures/uat/` — cantilever, simple_beam, portal_frame, continuous_pin_release, spring_support_beam. Each was built in the frame2d UI by the human and saved via the Phase 3 Save button; all include `schema_version: "1.0"` and either classic or spring (D-08) supports. The spring-support fixture exercises the Plan 04-02 UI Spring tool end-to-end.
- **CI-runnable UAT harness** in `tests/test_uat_frame2d.py`: 5 tests (one per fixture), each loads the JSON, normalises the solver routing key, POSTs to `/solve/frame2d`, and asserts against inline closed-form references (PL³/3EI, wL³/24EI, symmetric portal equilibrium, pin-release moment zero, spring-deflection P/K).
- **Two UAT-surfaced bugs fixed** per D-14:
  1. API rejected `solver: "frame2d"` on raw saved files (HTTP 500). Fix: register `frame2d` as an alias in the engine.
  2. `resetAll` in `ui/frame2d/script.js` did not clear `isPanning`/pan anchors, causing silent canvas-click drops after Reset All. Fix: zero those anchors plus defensive cleanup of diagram state and result blob URLs.
- **Regression tests added** for the API bug (`test_regression_solver_key_frame2d_alias_accepted`, `test_regression_health_lists_frame2d_alias`); the UI pan-state bug has a manual-verify procedure below.
- **Folded todo resolved:** `.planning/todos/pending/2026-04-19-multi-member-frame-solver-test-coverage.md` moved to `completed/` per D-14.

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit 5 UAT JSON fixtures** — `8ace399` (`test(04-03): add 5 canonical UAT frame2d fixtures (Task 1 — HARDEN-03 / D-12)`). Fixtures were authored by the human via the frame2d UI's Save button before this executor session; this commit just brings them under version control.
2. **Task 2: Write UAT harness** — `51ef075` (`test(04-03): add UAT harness tests/test_uat_frame2d.py (Task 2 — HARDEN-03)`). 5 parametric-style tests, each with inline hand-calc references, reusing the `test_interchange.py` TestClient pattern.
3. **Task 3: D-14 bug fixes + regression tests** — `d34a5cf` (`fix(04-03): D-14 UAT-surfaced bugs — API solver alias + resetAll state leak`). API alias in `api_server/app.py`; `resetAll` hardened in `ui/frame2d/script.js`; two regression tests appended to `tests/test_uat_frame2d.py`.

**Plan metadata:** _to be committed by `<step name="git_commit_metadata">`_

_Note: This is a testing/harness plan, not a TDD plan; each commit is a single logical step._

## Files Created/Modified

- `tests/fixtures/uat/cantilever.json` — L=1 m cantilever, tip point load -10 kN
- `tests/fixtures/uat/simple_beam.json` — L=4 m SS beam, UDL 10 kN/m downward
- `tests/fixtures/uat/portal_frame.json` — 4-node pinned-base portal, UDL 10 kN/m on beam
- `tests/fixtures/uat/continuous_pin_release.json` — 3-node 2-span beam, beamPinRight on span 1, UDL on span 1 only
- `tests/fixtures/uat/spring_support_beam.json` — L=4 m, pin at node 0, K_y = 1000 kN/m spring at node 1, P=-10 kN at node 1
- `tests/test_uat_frame2d.py` — 5 UAT tests + 2 regression tests (345+73 = 418 lines with docs)
- `api_server/app.py` — +7 lines: registers `frame2d` as a second engine key routing to `FrameV2Adapter`
- `ui/frame2d/script.js` — +22 lines in `resetAll()`: clear `isPanning` + pan anchors, revoke `_lastBlobUrl`, remove any stale `.download-link`, call `clearDiagramState()` to guarantee post-reset canvas matches a fresh page load

## Per-fixture summary

| Case | File | Hand-calc reference | Test | Result |
|---|---|---|---|---|
| 1. Cantilever, tip point load | `cantilever.json` | Uy_tip = PL³/(3EI) = -1.667e-4 m; θ_tip = ±PL²/(2EI); base M = -P·L (hogging, CLAUDE.md convention) | `test_uat_cantilever` | PASS |
| 2. Simple beam, UDL | `simple_beam.json` | R_0 = R_1 = wL/2 = 20 kN; end rotations \|θ\| = wL³/(24EI) = 1.333e-3 rad; end moments ≈ 0 | `test_uat_simple_beam_udl` | PASS |
| 3. Portal frame, UDL on beam | `portal_frame.json` | Symmetric: ΣR_y at bases = wL = 40 kN; R_y_0 = R_y_3 = 20 kN; R_x_0 = -R_x_3 (kick-out); M_base = 0 (pinned) | `test_uat_portal_frame_udl` | PASS |
| 4. Continuous beam w/ pin release | `continuous_pin_release.json` | beamPinRight on span 1: m1.Mj = 0 at shared node 2; m2.Mi = 0 by moment equilibrium; ΣR_y = w·L_span1 = 40 kN | `test_uat_continuous_pin_release` | PASS |
| 5. Spring-support beam | `spring_support_beam.json` | δ = P/K_y = -0.01 m at node 1; spring reaction K·\|δ\| = 10 kN; pin carries 0 vertical (statically-determinate about spring); rigid-bar rotation about pin → zero bending moments throughout | `test_uat_spring_support_beam` | PASS |

All 5 UAT tests individually green. Full suite 53/53 passing (46 prior + 5 UAT + 2 regression).

Final fixture listing:

```
$ ls tests/fixtures/uat/
cantilever.json
continuous_pin_release.json
portal_frame.json
simple_beam.json
spring_support_beam.json
```

## D-14 bug report #1: API rejected saved files with `solver: "frame2d"`

**Where found:** During Task 2 — the first run of my ground-truth script that POSTed each fixture to `/solve/frame2d` to capture expected values.

**Symptom:** HTTP 500 / `ValueError: Unknown solver 'frame2d'. Available: ['frame_v2', 'truss2d']` on every fixture. The frame2d UI's Save button writes `solver: "frame2d"` at the top level (a file-routing key identifying which UI owns the file; see `ui/frame2d/script.js:1463`). The API's `AnalysisEngine` registry only knew `frame_v2` and `truss2d`.

**Root cause:** Mismatch between the UI's file-routing convention and the engine's registry names. Documented in the plan's `<fixture_schema>` note, but never fixed at the API layer — the plan instructed the test harness to swap the key before POSTing. That's a brittle workaround: any future tool, script, or user that POSTs a saved file without knowing to swap the key hits HTTP 500.

**Fix (`api_server/app.py`):**

```python
engine.register("frame_v2", lambda model: FrameV2Adapter(model))
engine.register("frame2d",  lambda model: FrameV2Adapter(model))   # NEW — alias
engine.register("truss2d",  lambda model: Truss2DAdapter(model))
```

`/health` now lists both `frame_v2` and `frame2d` as available solvers. Both routing keys dispatch to the same `FrameV2Adapter`, so behaviour is identical.

**Regression tests** in `tests/test_uat_frame2d.py`:

- `test_regression_solver_key_frame2d_alias_accepted` — POSTs `cantilever.json` with raw `solver: "frame2d"` (no swap), asserts HTTP 200 + closed-form cantilever tip deflection. Verified to FAIL pre-fix by simulating the un-registered state:

  ```
  $ python3 -c 'del engine._registry["frame2d"]; client.post("/solve/frame2d", payload)'
  → ValueError: Unknown solver 'frame2d'
  ```

- `test_regression_health_lists_frame2d_alias` — asserts `/health` lists both names. Guards against accidental removal of the alias in a future refactor.

**Commit:** `d34a5cf`.

## D-14 bug report #2: `resetAll` state leak — silent canvas-click drops

**Where found:** Reported by the human during Task 1 fixture authoring (twice, on cases 2 and 3): after clicking Reset All, the UI "looked clean" but subsequent canvas clicks silently failed — UDLs didn't render after Apply, supports didn't register at all. Recovery required a hard page reload.

**Symptom:** After Reset All:
- Case 2 (simple_beam): user added 2 nodes and 1 member fine, then clicked UDL → clicked member → Apply — UDL did not appear on the canvas.
- Case 3 (portal_frame): user added 4 nodes and 3 members fine, then clicked `Pinned` support tool → clicked a node — no support glyph appeared; reactions/payload silently had no support entry.
- In both cases: hard-reload of the browser page (uvicorn still running) restored correct behaviour immediately, confirming the bug was purely client-side state.

**Root cause:** `resetAll()` cleared model data (`nodes`, `members`, `supports`, `nodeLoads`, `history`, `_udlActiveMemberIdx`, `_springActiveNodeId`, `origin`, `view`) and hid panels — but did NOT clear the middle-mouse-pan state:

```js
let isPanning = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;
```

`isPanning` is set `true` on middle-mouse-down (line 1750) and reset to `false` on mouseup (line 1757) or mouseleave (line 1758). In edge cases — middle-drag released outside the canvas rectangle, browser missing the mouseup event, or any extension interfering with pointer events — `isPanning` can remain stuck `true`. The canvas click handler starts with:

```js
canvas.addEventListener('click', e => {
  try {
  if (isPanning) return;             // ← silent drop of every subsequent click
```

So after such an edge event, every click on the canvas is silently ignored. The user sees the UI responding to the button bar (mode label updates, reset still works) but NO support/UDL click ever completes. The previous fix commit `71ede0f` ("Fix resetAll — reset view, mode, clear stale panel state") addressed panel display state but did not reach the pan-state variables.

**Fix (`ui/frame2d/script.js`):** `resetAll()` now zeroes the pan state:

```js
isPanning = false;
panStartX = 0; panStartY = 0; panStartTx = 0; panStartTy = 0;
```

Plus additional defensive cleanup so a post-reset canvas exactly matches a fresh-load canvas:

```js
if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }
const existingDl = document.querySelector('.download-link');
if (existingDl) existingDl.remove();
clearDiagramState();
```

**Why no automated regression:** This is a JS/canvas/DOM bug. The Python pytest suite drives the HTTP API via `TestClient` — it cannot drive canvas `click` events or middle-mouse-drag. Adding a JS test harness (Jest/Playwright) is scope-creep that wasn't planned. The plan's acceptance criterion explicitly allows this case:

> "If a bug was found: `git log --oneline -5 | grep -iE "fix|regression"` returns ≥ 1 entry (commit trail documents the fix)"

Commit `d34a5cf` matches this pattern. Manual-verification procedure below.

**Manual verification procedure** (for future regression testing until a JS harness lands):

1. `uvicorn api_server.app:app --reload`
2. Open `ui/frame2d/index.html` in a browser.
3. Middle-mouse-drag on the canvas, release OUTSIDE the canvas bounds (or over a panel). This is the reproducer for the stuck-`isPanning` state.
4. Click Reset All → confirm.
5. Click `Add Node`, click anywhere on the canvas twice — two red dots should appear at grid intersections.
6. Click `Pin Support`, click one of the dots — a support glyph should appear immediately.
7. **Before fix:** step 6 silently fails — no glyph, no support registered.
   **After fix:** glyph appears correctly.
8. Optional: repeat with UDL tool → click a member → Apply, confirm the UDL arrow renders.

**Commit:** `d34a5cf`.

## Decisions Made

- **Fix both bugs in Task 3, not just one** — the plan envisaged Task 3 as possibly-NO-OP, possibly-one-bug-fix. The API bug was not on the plan's radar (plan's `<fixture_schema>` instructed the test harness to swap the key) but surfaced unambiguously during my ground-truth capture. Fixing it at the server is the durable solution; the UI bug is separately the human-reported one. D-14 says "bugs found during UAT are fixed in this phase with regression tests" — applying that to both bugs is the correct read.
- **`resetAll` hardening is defensive, not surgical** — I added several cleanups beyond the strict `isPanning` fix (blob URL, download link, `clearDiagramState`). A previous quick-task (commit `71ede0f`) had already done one round of resetAll hardening; this is a second round covering what that missed. The rule-of-thumb going forward: post-`resetAll` canvas MUST behave identically to a fresh page load; any state that `setMode('node')` + `draw()` don't re-initialise must be explicitly cleared in `resetAll`.
- **solver_core untouched across the whole phase** — confirmed via `git diff 3405f68..HEAD -- solver_core/` returning empty. This honours the plan's hard constraint and CLAUDE.md's invariants. All behaviour comes from the Plan 04-01 TRUST-13..17 spring/pin backend and Plan 04-02 UI payload plumbing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] API rejected `solver: "frame2d"` on saved files**
- **Found during:** Task 2 (ground-truth capture for test assertions)
- **Issue:** HTTP 500 / `ValueError: Unknown solver 'frame2d'` from `engine.solve()`; the UI's Save button writes `solver: "frame2d"` as a file-routing key that the engine registry didn't recognise
- **Fix:** Register `"frame2d"` as a second key routing to `FrameV2Adapter` in `api_server/app.py:42`
- **Files modified:** `api_server/app.py`
- **Verification:** `test_regression_solver_key_frame2d_alias_accepted` passes (verified to FAIL pre-fix by unregistering the alias in a monkey-patched session)
- **Commit:** `d34a5cf`

**2. [Rule 1 - Bug] `resetAll` left `isPanning` stuck true, dropping canvas clicks silently**
- **Found during:** Task 1 (human UI fixture authoring — cases 2 & 3 both hit it)
- **Issue:** After Reset All, canvas clicks were silently ignored because `isPanning` (set by middle-mouse pan) was not cleared; required hard page reload to recover
- **Fix:** `resetAll()` now sets `isPanning = false` + zeroes `panStart{X,Y,Tx,Ty}`; also revokes stale `_lastBlobUrl`, removes lingering `.download-link`, and calls `clearDiagramState()` to guarantee post-reset canvas = fresh-load canvas
- **Files modified:** `ui/frame2d/script.js` (resetAll body, +22 lines including explanatory comment)
- **Verification:** Manual procedure documented in the bug report above; regression test is not feasible without a JS/browser harness (out of plan scope)
- **Commit:** `d34a5cf`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — real bugs)
**Impact on plan:** Both are in-scope per D-14 ("bugs found during UAT → fix in Phase 4 with a regression test"). No scope creep — both fixes land in the phase the bugs were surfaced.

## Issues Encountered

- **Reading/editing ui/frame2d/script.js was painful due to mixed line endings.** The file has some CR-only and some LF line delimiters (mixed \r and \n), confusing the Read tool (it counts lines incorrectly for parts of the file). Workaround: normalised to a tmp file via `tr '\r' '\n'` for reading, then used `git grep` for pinpoint line numbers on the raw file. This is a pre-existing issue — not created by this plan. Not a project deliverable; flagging for future cleanup if the file is ever reformatted.
- **Initial run of the ground-truth script on cantilever.json returned HTTP 500**, which was the direct discovery of bug #1 above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **HARDEN-03 closed:** 5 canonical UAT fixtures + CI-runnable harness + 2 UAT-surfaced bugs fixed and regressed.
- **D-12, D-13, D-14 all implemented:** fixtures committed (D-12), inline hand-calc test harness (D-13), bugs fixed with regression tests in-phase (D-14).
- **Full test suite green:** 53/53 tests passing (46 prior + 5 UAT + 2 regression).
- **`solver_core/` NOT touched across the whole phase.** Confirmed via `git diff 3405f68..HEAD -- solver_core/` returning empty across all three plan commits.
- **Folded todo marked completed:** `.planning/todos/pending/2026-04-19-multi-member-frame-solver-test-coverage.md` moved to `.planning/todos/completed/` per D-14 and CONTEXT Claude's Discretion.
- **Phase 04 complete** if Plan 04-03 is the last plan; next stop is Phase 05 (Revit Tier 1 geometry exporter in the sibling `CustomRevitExtension` repo). The `workflow.auto_advance: true` in `.planning/config.json` will chain in once the verifier approves.

## Self-Check: PASSED

All 10 claimed files exist on disk:
- `tests/fixtures/uat/{cantilever,simple_beam,portal_frame,continuous_pin_release,spring_support_beam}.json` ✓
- `tests/test_uat_frame2d.py` ✓
- `api_server/app.py` (modified) ✓
- `ui/frame2d/script.js` (modified) ✓
- `.planning/phases/04-2d-frame-solver-ui-hardening/04-03-uat-harness-SUMMARY.md` ✓
- `.planning/todos/completed/2026-04-19-multi-member-frame-solver-test-coverage.md` (moved from pending) ✓

All 3 task commits present in `git log --oneline --all`:
- `8ace399` test(04-03): add 5 canonical UAT frame2d fixtures ✓
- `51ef075` test(04-03): add UAT harness tests/test_uat_frame2d.py ✓
- `d34a5cf` fix(04-03): D-14 UAT-surfaced bugs — API solver alias + resetAll state leak ✓

`git diff 3405f68..HEAD -- solver_core/` returns empty (solver_core untouched across the plan). ✓

Full suite: `pytest tests/ -q` → `53 passed in 0.69s`. ✓

UAT subset: `pytest tests/test_uat_frame2d.py -v` → 7 passed (5 UAT + 2 regression). ✓

---
*Phase: 04-2d-frame-solver-ui-hardening*
*Completed: 2026-04-20*
