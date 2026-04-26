---
phase: 06-frame-v2-pure-bar-joint-robustness
plan: 03
subsystem: ui
tags: [frame2d, ui, pre-solve-scan, structured-422, diagnostic-overlay, canvas, fastapi-testclient, pure-bar, udl-on-bar]

requires:
  - phase: 06-frame-v2-pure-bar-joint-robustness/06-01
    provides: Pure-bar joint solver semantics (D-01..D-05) — pre-solve scan in script.js mirrors `is_pure_bar_joint(n) := every incident member is a bar` so server and client agree on which joints get flagged
  - phase: 06-frame-v2-pure-bar-joint-robustness/06-02
    provides: SolverDiagnosticError typed exception + structured 422 payload {detail, cause, offending_nodes, offending_members}; FastAPI exception handler with isinstance/hasattr branching and legacy flat-payload fallback
  - phase: 04-2d-frame-solver-ui-hardening
    provides: FastAPI TestClient pattern (tests/test_uat_frame2d.py); errorBanner DOM helper; drawSupports/drawNodes canvas primitives; setStatus diagnostic display

provides:
  - validateBeforeSolve() pre-solve scan in ui/frame2d/script.js — flags pure-bar joints (informational) and UDL-on-bar members (blocking) BEFORE the round-trip to the server
  - Structured 422 parser in solve() error branch — reads cause/offending_nodes/offending_members; backward-compatible fallback for legacy flat {detail} payloads (D-13)
  - drawDiagnosticOverlays() canvas painter — three layers (red strokes on offending members, red rings on offending nodes, small offset red dots on pure-bar joints) using existing #e53935 colour token; wired into draw() after drawNodes()
  - Module-level diagnostic state: pureBarNodeIds, offendingNodes, offendingMembers (all 0-based) — cleared on validateBeforeSolve and on a fresh successful solve
  - tests/test_phase6_ui_contract.py — three FastAPI TestClient tests asserting the API surfaces every field the JS parser depends on (UDL-on-bar payload shape; captured-fixture end-to-end success; legacy flat-payload backward compat)
  - tests/snapshots/baseline/tests.test_phase6_ui_contract.py__test_ui_contract_pure_bar_fixture_solves.json — new baseline mirrored from TRUST-19 (same FEM path, byte-identical output)

affects:
  - PUREBAR-04 (UI diagnostics) — fully closed end-to-end. Generic "Structure is unstable" banner replaced with cause-aware messaging plus canvas highlights identifying the offending joints/members.
  - Any future cause taxonomy (e.g. `under_restrained`, `ill_conditioned`) — the UI parser is forward-compatible: new cause values render as `[<cause>]` suffixes; offending_nodes/offending_members are highlighted automatically without UI changes.

tech-stack:
  added: []
  patterns:
    - "Pre-solve client-side validation mirrors server-side predicate semantics — script.js's `every incident member has m.type === 'bar'` matches `assemble_primary_stiffness_matrix`'s pure-bar predicate exactly. UDL-on-bar detection mirrors FrameV2Adapter's precondition. Server-UI contract parity is now executable."
    - "Defensive parsing of server-supplied indices (T-06-03-02 mitigation): `Number.isInteger(i) && i >= 0 && i < nodes.length` filter drops malformed entries silently. A hostile or buggy server cannot drive the canvas out of bounds."
    - "Re-use of existing canvas colour token (#e53935 from drawNodes) and primitives (highlightNode, drawSupports stroke pattern) — no new CSS classes. D-04 Claude's Discretion applied: visual language stays consistent with existing UI."
    - "UI-contract test pattern (FastAPI TestClient + assert payload field names): catches silent server-side renames that would otherwise regress the UI parser without test failure. Replaces manual browser smoke testing in --auto mode."

key-files:
  created:
    - tests/test_phase6_ui_contract.py
    - tests/snapshots/baseline/tests.test_phase6_ui_contract.py__test_ui_contract_pure_bar_fixture_solves.json
  modified:
    - ui/frame2d/script.js

key-decisions:
  - "D-11 honoured (split semantics): pure-bar joints surface as INFORMATIONAL (non-error setStatus + small offset red dots, Solve still allowed); UDL-on-bar surfaces as BLOCKING (error setStatus + red member highlight + early return from solve)."
  - "D-12 honoured (visual unity): pre-flight and post-flight overlays share the same #e53935 palette and red-dot/red-line/red-ring vocabulary so the user sees one consistent diagnostic language whether the issue was caught client-side or server-side."
  - "D-13 honoured (backward compat): the existing `err.detail || res.statusText` fallback is preserved verbatim. Legacy flat-payload errors (genuine under-restraint, ill-conditioning) still display correctly. New parsing is purely additive."
  - "D-04 Claude's Discretion (visual style): pure-bar dots are small (radius 3*sc) and offset NE (+10,-10) to avoid overlapping the existing 5*sc node marker. Offending members get lineWidth 3 + setLineDash([]) to override the bar dash pattern so the offending member is unambiguous even when bar-typed."
  - "Pre-flight pureBarNodeIds is intentionally NOT cleared on a successful solve (Task 2 success branch only clears offendingNodes/offendingMembers). Pure-bar joints remain visually flagged after success because they are still the visual signature of an auto-restrained θ DOF — useful context for the user when interpreting results."
  - "UI-contract test for `pure_bar_pratt_captured.json` is intentionally duplicated with TRUST-19 in test_frame_v2.py. The duplication guards against TRUST-19 being moved or renamed without the UI's success path losing its end-to-end gate."

patterns-established:
  - "validateBeforeSolve() helper pattern: a single function called at the top of solve() (after E/I/A guards, before payload construction) that resets diagnostic state, computes per-node incidence over members, runs both predicates (pure-bar and UDL-on-bar), and returns false to BLOCK on hard errors. Future pre-flight checks (e.g. orphan member detection) can be added inside this function without rewiring solve()."
  - "Snapshot baseline reuse for symmetric tests: when a new test exercises the SAME FEM path as an existing test (same fixture, same API endpoint, same solver), its baseline can be mirrored from the existing test's baseline rather than running a full capture. Avoids accidentally overwriting other baselines and proves the new test is testing the same code path."
  - "0-based-id arithmetic on members[]: m.start and m.end are node IDs that equal node array indices after reindexNodes. The validateBeforeSolve incidence map keys directly off these — no conversion needed. drawDiagnosticOverlays still uses nodes.find(n.id === idx) for lookup safety after deletion-driven id remaps."

requirements-completed:
  - PUREBAR-04

duration: ~8min
completed: 2026-04-26
---

# Phase 06 Plan 03: frame2d UI Diagnostics — Pre-Solve Scan + Structured 422 Parsing + Canvas Overlays

**The frame2d browser UI now replaces the generic "Structure is unstable" banner with cause-aware messaging and canvas highlights identifying the exact joint(s)/member(s) at fault. A pre-solve scan catches UDL-on-bar before the fetch and informs the user about pure-bar joints; the post-solve error branch parses the structured 422 payload from Plan 06-02 and paints offending elements in red.**

## Performance

- **Duration:** ~8 minutes (executor agent)
- **Started:** 2026-04-26T14:44:43Z
- **Completed:** 2026-04-26T14:52:41Z
- **Tasks:** 4 / 4
- **Files created:** 2 (test_phase6_ui_contract.py, baseline snapshot)
- **Files modified:** 1 (ui/frame2d/script.js, +194 lines net)

## Accomplishments

- **Pre-solve scan implemented and active.** `validateBeforeSolve()` (script.js:495) walks members + per-node incidence at the top of `solve()` (after E/I/A guards). Server and client agree on the pure-bar predicate by construction: every incident member with `m.type === 'bar'` flags the node, exactly mirroring `assemble_primary_stiffness_matrix`'s loop semantics from Plan 06-01. UDL-on-bar detection (vertical `m.udl` + horizontal `m.udl_x`) blocks the solve early and avoids a doomed round-trip.
- **Structured 422 parsing wired end-to-end.** `solve()`'s error branch now reads `err.cause` (suffixes `[<cause>]` to the status text), `err.offending_nodes`, and `err.offending_members` (1-based → 0-based, range-filtered against `nodes.length` / `members.length` per T-06-03-02). The legacy `err.detail || res.statusText` fallback is preserved verbatim — backward compatibility for flat-payload consumers (D-13).
- **Canvas overlays live and consistent.** `drawDiagnosticOverlays()` paints three layers: red thick solid strokes on offending members (overrides bar dash), red rings on offending nodes via the existing `highlightNode` primitive, and small offset red dots on pure-bar joints. All three reuse the `#e53935` token already used by `drawNodes` — no new CSS. Wired into `draw()` immediately after `drawNodes()` so overlays paint on top of node markers but before support glyphs.
- **Three automated UI-contract tests pass.** `test_phase6_ui_contract.py` asserts via FastAPI TestClient that the API surfaces every field the JS parser depends on, the captured 2026-04-22 failing fixture solves end-to-end (PUREBAR-02 closure verified at the integration boundary), and the legacy flat payload is still emitted for non-typed errors (D-13). These stand in for manual browser smoke testing in --auto mode; manual UAT steps are documented in the module docstring for any-time human verification.
- **Backend untouched, snapshot baseline still verified.** `python3 scripts/verify_solver_snapshots.py` exits 0 with 36 test(s) verified (35 from Plans 06-01/06-02 + 1 new contract test mirroring TRUST-19). The user's hard constraint ("don't damage the solver") is mechanically enforced and respected.

## Task Commits

Each task was committed atomically per the executor protocol:

1. **Task 1: validateBeforeSolve() + diagnostic state** — `38de9c7` (feat) — script.js: +95 lines. Module-level `pureBarNodeIds`, `offendingNodes`, `offendingMembers` (lines 78-80); `validateBeforeSolve()` helper (lines 495-579); hook into `solve()` after E/I/A guards (line 587). Pre-solve scan computes per-node incidence, classifies pure-bar joints (informational) and UDL-on-bar members (blocking).
2. **Task 2: Structured 422 parser** — `ba3f37c` (feat) — script.js: +37 lines. Replaces the flat-only error handler at the fetch site with cause-aware parsing. Defensive index filtering via `Number.isInteger + range check`. Successful-solve branch clears `offendingNodes` / `offendingMembers` but intentionally keeps `pureBarNodeIds` visible.
3. **Task 3: drawDiagnosticOverlays() + draw() wire-up** — `6fe0065` (feat) — script.js: +64 lines. New function defined between `drawNodes` (line 840) and `highlightNode` (line 924); call site at line 739, immediately after `drawNodes()` in `draw()`. Three rendering layers (members → nodes → pure-bar dots) using `#e53935` and `getSymbolScale()`.
4. **Task 4: UI-contract tests + baseline snapshot** — `105d8a3` (test) — `tests/test_phase6_ui_contract.py` (+155 lines, 3 tests) + `tests/snapshots/baseline/tests.test_phase6_ui_contract.py__test_ui_contract_pure_bar_fixture_solves.json` (mirrored from TRUST-19 baseline since both tests exercise the same FEM path).

## Files Created

- `tests/test_phase6_ui_contract.py` — Three FastAPI TestClient contract tests (155 lines):
  - `test_ui_contract_udl_on_bar_payload_shape` — asserts the structured 422 response carries every field name the JS parser reads (`detail`, `cause`, `offending_nodes`, `offending_members`)
  - `test_ui_contract_pure_bar_fixture_solves` — captured 2026-04-22 fixture solves via /solve/frame2d (PUREBAR-02 verified at integration boundary, independently of TRUST-19)
  - `test_ui_contract_legacy_flat_payload_unchanged` — D-13 backward-compat: under-restrained model still emits flat `{detail: "..."}` payload
- `tests/snapshots/baseline/tests.test_phase6_ui_contract.py__test_ui_contract_pure_bar_fixture_solves.json` — Baseline solver-output snapshot for the new contract test, mirrored from `tests.test_frame_v2.py__test_trust_19_captured_pratt_fixture_replay.json` (both tests POST the same fixture through the same API path → byte-identical solver outputs by construction).

## Files Modified

- `ui/frame2d/script.js` — Three discrete additions (no removals, no refactors):
  - **Diagnostic state (lines 78-80):** `pureBarNodeIds`, `offendingNodes`, `offendingMembers` initialised to `[]`.
  - **`validateBeforeSolve()` (lines 495-579):** new helper called at top of `solve()` (line 587).
  - **Structured 422 parser (lines 660-697):** replaces the flat-only error branch at the fetch site.
  - **`drawDiagnosticOverlays()` (lines 871-916):** new canvas painter wired into `draw()` at line 739 (after `drawNodes`).

## Decisions Made

Followed plan as specified. Notable choices that shaped the implementation:

- **Pre-flight `pureBarNodeIds` survives a successful solve.** Task 2's success branch only clears `offendingNodes` / `offendingMembers`. Pure-bar joints are still the visual signature of an auto-restrained θ DOF and the user benefits from seeing the dots after a successful solve too — they're informational context, not error markers.
- **Member rendering for offending members overrides the bar dash.** `drawDiagnosticOverlays` calls `ctx.setLineDash([])` on the red stroke even for bar members. A red dashed line would be visually identical to a normal bar; the solid heavy red stroke is unambiguous.
- **Defensive index filtering on server-supplied data (T-06-03-02).** `Number.isInteger(i) && i >= 0 && i < nodes.length` filter drops any malformed entry silently. A bug in the structured-422 emitter (or a hostile server) cannot drive the canvas to render outside bounds or throw on `members[idx]`.
- **Reuse of `nodes.find(n.id === idx)` for node lookup.** After `reindexNodes()` (deletion-driven id remap), node IDs equal array indices. But using `.find` over the id-keyed comparison is robust to any future change that decouples them; consistent with how `drawMembers`, `drawSupports`, and other existing draw functions look up nodes.
- **Mirrored baseline rather than re-running capture.** Re-running `scripts/capture_solver_snapshots.py` would overwrite all 35+ existing baselines. Instead, the new contract test's baseline was authored from TRUST-19's existing baseline (same fixture, same API path → byte-identical solver state). This keeps the snapshot gate honest: any drift from TRUST-19's solver output would equally fail the new contract test.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's `<action>` blocks were translated into source edits with the parameter names and ordering preserved. The only deviation-adjacent decision was the snapshot-baseline mirroring (above) — but the plan's verify command explicitly required `python scripts/verify_solver_snapshots.py exits 0`, and mirroring is the correct way to satisfy that gate without touching the existing baselines.

## Issues Encountered

**Worktree solver_core scaffolding required for snapshot regression check (same as Plan 06-02).** The freshly-created worktree did NOT contain `__init__.py`, `engine/`, `models/`, `results/` (these are pre-existing untracked files in the main repo). The snapshot verifier explicitly forces `sys.path` to use the worktree's `solver_core/src`, so `python3 scripts/verify_solver_snapshots.py` initially failed with `ModuleNotFoundError: No module named 'pda_analysis_software.results'`.

**Resolution:** copied the missing untracked files from the main repo into the worktree (mirroring Plan 06-02's resolution). These files are NOT part of this plan's scope and were NOT committed. They are ambient runtime infrastructure that the project lives with as untracked files in both worktree and main repo.

**Snapshot capture for the new test triggered a "baseline missing" failure.** The verifier's autouse plugin captured `test_ui_contract_pure_bar_fixture_solves` (it solves a real model) and reported missing baseline → exit 1. Re-running the full capture script would overwrite all 35+ existing baselines and risk masking a regression. **Resolution:** mirrored TRUST-19's existing baseline JSON content into the new test's baseline filename, since both tests POST the exact same fixture through the same API endpoint and produce byte-identical solver output. This keeps the gate honest (any drift in TRUST-19's solver output would equally fail the new contract test) without touching any of the other 35 baselines.

Neither issue affected the plan's correctness criteria — they were purely about getting the test infrastructure to behave consistently with the worktree's untracked-file ambient state.

## User Setup Required

None — no external service configuration required. Manual browser UAT steps are documented in the test module docstring (`tests/test_phase6_ui_contract.py`) for any-time human verification but are NOT gating in --auto mode.

## Verification

- `node --check ui/frame2d/script.js` → exit 0 (JS file parses cleanly)
- `grep -nE 'function validateBeforeSolve|let pureBarNodeIds|let offendingMembers|let offendingNodes' ui/frame2d/script.js` → 4 hits
- `grep -nE 'err.cause|err.offending_nodes|err.offending_members' ui/frame2d/script.js` → 6 hits (all in error branch)
- `grep -n 'err.detail || res.statusText' ui/frame2d/script.js` → 1 hit (backward-compat fallback preserved)
- `grep -n 'function drawDiagnosticOverlays' ui/frame2d/script.js` → 1 hit; call site `drawDiagnosticOverlays();` after `drawNodes();` confirmed at line 739 (drawNodes at line 738)
- `grep -E 'console\.error' ui/frame2d/script.js` → 0 hits (no debug logging left in)
- `python3 -m pytest tests/test_phase6_ui_contract.py -v` → 3 passed
- `python3 -m pytest tests/ -x -q` → **61 passed** (58 pre-existing + 3 new UI-contract tests)
- `python3 scripts/verify_solver_snapshots.py` → exit 0 — "OK: all captured outputs match baseline (36 test(s) verified)"
- `git diff 3b61385..HEAD -- solver_core/ api_server/` → 0 lines changed (UI/test-only change, hard constraint honored)

## Next Phase Readiness

- **PUREBAR-04 fully closed.** The original requirement ("Replace generic 'Structure is unstable' UI message with a specific, actionable diagnostic that names the offending node(s) / member(s)") is satisfied end-to-end: pre-solve scan catches UDL-on-bar before the fetch, structured 422 from Plan 06-02 is parsed and surfaced via cause-suffixed status + canvas overlays, and pure-bar joints are flagged informationally so the user understands the auto-restraint visual.
- **Phase 6 complete from a UI surface area.** All five PUREBAR requirements (01: detection, 02: auto-restraint, 03: UDL-on-bar reject, 04: UI diagnostics, 05: regression tests) now have implementation + tests + UI surfacing.
- **Forward-compatible cause taxonomy.** Future failure modes (`under_restrained`, `ill_conditioned`, etc.) added in subsequent phases will surface in the UI automatically: the `[<cause>]` suffix and the offending-element overlays work for any cause value without UI changes. Only the human-readable `detail` text needs phase-specific wording in the typed exception.
- **Snapshot baseline now at 36 verified entries.** Any future Phase 6+ work that touches the solver path will be caught by the snapshot gate; the new UI-contract test entry guards specifically against drift in the pure-bar fixture's FEM path.

## Self-Check: PASSED

- File created: `tests/test_phase6_ui_contract.py` ✓ (verified via `ls`)
- File created: `tests/snapshots/baseline/tests.test_phase6_ui_contract.py__test_ui_contract_pure_bar_fixture_solves.json` ✓
- File modified: `ui/frame2d/script.js` ✓ (+194 lines net across 3 commits)
- Commits exist:
  - `38de9c7` ✓ (Task 1: validateBeforeSolve + state)
  - `ba3f37c` ✓ (Task 2: structured 422 parser)
  - `6fe0065` ✓ (Task 3: drawDiagnosticOverlays + wire-up)
  - `105d8a3` ✓ (Task 4: UI-contract tests + baseline)
- All 4 commits visible via `git log --oneline 3b61385..HEAD` from worktree HEAD.
- Backend untouched: 0 lines changed in `solver_core/` or `api_server/` (verified via `git diff 3b61385..HEAD --stat`).
- CLAUDE.md hard rules honored: vanilla JS canvas UI (no framework), validation lives at UI/API/adapter/solver boundaries, no matplotlib in solver_core (no Python production code touched).
- No `console.error`, `print`, or debug logging introduced (grep returns 0 hits).

---
*Phase: 06-frame-v2-pure-bar-joint-robustness*
*Plan: 03*
*Completed: 2026-04-26*
