---
phase: 04-2d-frame-solver-ui-hardening
verified: 2026-04-20T19:00:00Z
status: human_needed
score: 22/22 automated must-haves verified
requirements_verified: [HARDEN-01, HARDEN-02, HARDEN-03]
must_haves_passed: 22
must_haves_total: 22
human_verification:
  - test: "Reset All clears middle-mouse-pan state (resetAll isPanning fix, D-14 bug #2)"
    expected: "After Reset All, canvas clicks register new nodes/supports/UDLs without requiring a hard page reload, including the reproducer path of middle-mouse-drag that releases outside the canvas"
    why_human: "JS canvas click events and middle-mouse-drag cannot be driven from pytest; the resetAll() fix at ui/frame2d/script.js:363-364 can only be exercised by a human operating the browser UI. The plan's acceptance criteria explicitly accepted this trade-off; manual procedure documented in 04-03-SUMMARY.md §'Manual verification procedure'"
  - test: "Spring UI end-to-end flow (11-step UAT from Plan 04-02 Task 3)"
    expected: "All 11 steps documented in 04-02-PLAN.md <how-to-verify> pass: Spring button renders, modal opens/cancels/applies, single-axis Ky spring draws coil, spring replaces classic support (D-05), editing pre-fills values, solve produces δ=P/K and reaction=K·δ, Save emits {type:'spring',Kx,Ky,Ktheta} object + SI springDoF/springStiffness top-level, Load round-trips AND restores Phase 3 string-valued supports, no DevTools console errors"
    why_human: "Canvas interactions, modal open/close, coil glyph rendering, and browser file Save/Load dialogs require visual + interactive verification that cannot be driven from pytest. Already approved by user on 2026-04-19 (per 04-02-SUMMARY.md); this entry records the dependency for future re-verification"
---

# Phase 4: 2D Frame Solver + UI Hardening Verification Report

**Phase Goal (ROADMAP.md):** The 2D frame solver and UI are reliable across the full range of common structural topologies — multi-member frames, spring supports, pin releases, and UDL combinations — verified by test coverage and direct UAT.

**Verified:** 2026-04-20T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (merged from ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Source | Status | Evidence |
|---|-------|--------|--------|----------|
| 1 | Portal frame, two-span continuous beam, and mixed pin-release + UDL cases solve with correct equilibrium at shared nodes and released ends, verified by pytest | ROADMAP SC-1 / HARDEN-01 | VERIFIED | TRUST-13/14/15 at tests/test_frame_v2.py:611/658/702; all pass |
| 2 | TRUST-13 (portal frame + UDL) passes with ΣM=0 at each beam-column joint | PLAN 01 | VERIFIED | tests/test_frame_v2.py:611 passes |
| 3 | TRUST-14 (two-span + beamPinRight + UDL on span 1) passes with M=0 at released end | PLAN 01 | VERIFIED | tests/test_frame_v2.py:658 passes; docstring references 260418-vcg + TRUST-12 |
| 4 | TRUST-15 (mixed beamPinLeft + beamPinRight at shared node) passes with M=0 on both released ends | PLAN 01 | VERIFIED | tests/test_frame_v2.py:702 passes |
| 5 | TRUST-16 (simple beam + Ky spring) passes end-to-end via FrameV2Adapter and verifies reaction = K·δ | PLAN 01 | VERIFIED | tests/test_frame_v2.py:766 passes; uses FrameV2Adapter(model).solve() with springDoF=[5] |
| 6 | TRUST-17 (cantilever + propped cantilever series) passes with analytical comparison | PLAN 01 | VERIFIED | tests/test_frame_v2.py:823 passes |
| 7 | All prior TRUST-01..TRUST-12 still pass (no regression) | PLAN 01 | VERIFIED | Full test_frame_v2.py: 20 tests pass |
| 8 | Engineer can place spring support (Kx, Ky, or Kθ) at any node in frame2d UI, solver uses it correctly, spring reaction appears in results | ROADMAP SC-2 / HARDEN-02 | VERIFIED | UI artifacts present (see below); 11-step human UAT approved on 2026-04-19 per 04-02-SUMMARY.md |
| 9 | User sees 'Spring' button in Supports toolbar; clicking a node opens modal with Kx/Ky/Kθ inputs | PLAN 02 | VERIFIED | index.html:52 (data-mode="spring"); index.html:259 (#springPanel modal); index.html:266/270/274 (inputs) |
| 10 | Blank inputs = cancel; at least one non-blank K required (D-06) | PLAN 02 | VERIFIED | script.js:381 applySpringSupport() implements D-06 guard |
| 11 | Spring replaces any existing classic support at that node (D-05) | PLAN 02 | VERIFIED | script.js:404 filters before push (D-05 pattern); confirmed by 11-step UAT step 5 |
| 12 | Canvas renders coil glyph per active spring axis + value tag (D-07) | PLAN 02 | VERIFIED | script.js:801 drawSpring() function with purple (#6a1b9a) coils |
| 13 | Save produces JSON with canvas.supports[nodeId] as spring object {type:'spring',Kx,Ky,Ktheta} (D-08) | PLAN 02 | VERIFIED | script.js:1458 emits object form; spring_support_beam.json:canvas.supports["1"] matches |
| 14 | Load restores spring supports round-trip AND still accepts Phase 3 string-valued supports | PLAN 02 | VERIFIED | script.js:1578 val.type === 'spring' check; 11-step UAT step 10 confirmed Phase 3 backward compat |
| 15 | Solve payload sends correct springDoF (base=nodeId*3+1) with SI unit conversion (×1e3) | PLAN 02 | VERIFIED | script.js:469 computeSpringPayload(); 3× `* 1e3` conversions at lines 475/476/477 |
| 16 | Running frame2d UI through 5 canonical cases produces results matching hand-calculation | ROADMAP SC-3 / HARDEN-03 | VERIFIED | All 5 UAT tests pass (test_uat_frame2d.py) + human-authored fixtures |
| 17 | 5 canonical JSON fixtures exist in tests/fixtures/uat/ | PLAN 03 | VERIFIED | All 5 present: cantilever, simple_beam, portal_frame, continuous_pin_release, spring_support_beam |
| 18 | Each fixture was produced by the frame2d UI Save button and loads round-trip | PLAN 03 | VERIFIED | schema_version=1.0, solver="frame2d" on all; spring_support_beam has canonical object-form canvas.supports |
| 19 | tests/test_uat_frame2d.py loads each fixture via TestClient, POSTs to /solve/frame2d, asserts reactions + displacements | PLAN 03 | VERIFIED | 5 test_uat_* functions + TestClient imports at tests/test_uat_frame2d.py:42,44 |
| 20 | All 5 UAT tests pass; bugs found during authoring fixed in this phase with regression tests (D-14) | PLAN 03 | VERIFIED | 5 UAT + 2 regression tests all pass; D-14 bugs #1 (API alias) + #2 (resetAll) both fixed |
| 21 | Full test suite (including Plan 01 TRUST-13..17) green — no regression | PLAN 03 | VERIFIED | pytest tests/ -q → 53/53 passing |
| 22 | solver_core/ untouched across all Phase 04 commits (hard constraint) | CLAUDE.md | VERIFIED | git log 3405f68^..HEAD -- solver_core/ returns empty |

**Score:** 22/22 truths verified (automated)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/test_frame_v2.py` | 5 new pytest functions TRUST-13..TRUST-17 | VERIFIED | All 5 `def test_trust_1[3-7]_*` functions present (lines 611, 658, 702, 766, 823) |
| `ui/frame2d/index.html` | Spring toolbar button in Supports group | VERIFIED | Line 52 has `data-mode="spring"`; modal markup at line 259; 3 inputs at 266/270/274 |
| `ui/frame2d/script.js` | spring mode dispatcher, modal UX, drawSupports coil glyph, payload builder, save/load round-trip | VERIFIED | MODE_LABELS:90; canvas click branch:160; applySpring:381; cancelSpring:417; computeSpringPayload:469; drawSpring:801; save object form:1458; load type-check:1578. 0 instances of hardcoded `springDoF: []` or `springStiffness: []`. `node --check` passes. |
| `ui/frame2d/style.css` | Modal styling for #springPanel | VERIFIED | 4 matching selectors at lines 203-214 |
| `tests/fixtures/uat/cantilever.json` | Cantilever (fixed at node 1, tip load at node 2) | VERIFIED | 1398 bytes, schema_version=1.0, solver=frame2d |
| `tests/fixtures/uat/simple_beam.json` | Pinned + rollerY, UDL | VERIFIED | 1447 bytes, schema_version=1.0 |
| `tests/fixtures/uat/portal_frame.json` | 4-node portal, pinned bases, UDL on beam | VERIFIED | 2521 bytes, 3 members |
| `tests/fixtures/uat/continuous_pin_release.json` | 2-span + beamPinRight + UDL on span 1 | VERIFIED | 2006 bytes |
| `tests/fixtures/uat/spring_support_beam.json` | Simple beam with Ky spring, produced via Plan 02 Spring tool | VERIFIED | 1527 bytes; springDoF=[5]; springStiffness=[1000000]; canvas.supports["1"]={type:"spring",Ky:1000,Kx:null,Ktheta:null} |
| `tests/test_uat_frame2d.py` | UAT harness with TestClient POSTs to /solve/frame2d + hand-calc assertions | VERIFIED | 18690 bytes; 5 test_uat_* + 2 test_regression_* functions; from fastapi.testclient import TestClient (line 42); /solve/frame2d POST at lines 72, 387 |
| `api_server/app.py` (D-14 fix #1) | `frame2d` registered as alias for `frame_v2` | VERIFIED | Line 42: `engine.register("frame2d", lambda model: FrameV2Adapter(model))` |
| `ui/frame2d/script.js` resetAll (D-14 fix #2) | Clear isPanning + pan anchors | VERIFIED | Lines 363-364: `isPanning = false; panStartX = 0; ...` inside resetAll() |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| tests/test_frame_v2.py (TRUST-16) | FrameV2Adapter → frame_v2.add_spring_stiffnesses | FrameModel2D(springDoF=..., springStiffness=...) through adapter | WIRED | Line 786: `springDoF=[5]`; Line 789: `adapter = FrameV2Adapter(model); result = adapter.solve()` |
| ui/frame2d/script.js solve() payload builder | API /solve/frame2d springDoF/springStiffness fields | supports array → flattened DOF list + SI-unit K values via computeSpringPayload() | WIRED | Lines 543, 553: `const { springDoF, springStiffness } = computeSpringPayload(); ... pinDoF: [], springDoF, springStiffness,` |
| ui/frame2d/script.js saveModel() | canvas.supports[nodeId] spring object form (D-08) | `{type:'spring', Kx, Ky, Ktheta}` object | WIRED | Line 1458: `obj[String(s.nodeId)] = { type: 'spring', Kx: s.Kx, Ky: s.Ky, Ktheta: s.Ktheta };` |
| ui/frame2d/script.js file load handler | supports array restoration (strings AND spring objects) | type-check on decoded value | WIRED | Line 1578: `if (val && typeof val === 'object' && val.type === 'spring')` |
| tests/test_uat_frame2d.py | api_server.app.app (FastAPI) | `from api_server.app import app` + TestClient | WIRED | Lines 42, 44 |
| tests/test_uat_frame2d.py | tests/fixtures/uat/*.json | json.load + client.post('/solve/frame2d', json=payload) | WIRED | Lines 72, 387 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ui/frame2d/script.js solve() payload | `springDoF`, `springStiffness` | computeSpringPayload() iterates `supports` global array, filters type==='spring', computes DOF indices and ×1e3 SI-unit conversion | Yes — `supports` array populated by applySpringSupport() on user click | FLOWING |
| tests/test_uat_frame2d.py | `res["UG"]`, `res["FG"]`, `res["member_moments"]` | `client.post("/solve/frame2d", json=payload).json()` — live FastAPI round-trip to frame_v2 solver | Yes — verified by assertion values matching hand-calc (PL³/3EI, wL²/8, P/K, etc.) | FLOWING |
| spring_support_beam.json | `springDoF: [5]`, `springStiffness: [1000000]` | Produced by UI Save button after applying Ky=1000 kN/m via Spring modal | Yes — fixture solves to δ=-0.01 m, reaction=10000 N matching analytical P/K | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `PYTHONPATH=. pytest tests/ -q` | 53 passed in 0.68s | PASS |
| Phase 04 tests pass | `pytest tests/test_frame_v2.py tests/test_uat_frame2d.py -v` | 27 passed (20 frame_v2 + 7 UAT) | PASS |
| All UAT fixtures parse as JSON | `python3 -c "json.load(...)" × 5 files` | All 5 parse; spring_support_beam has springDoF=[5], springStiffness=[1000000] | PASS |
| script.js is valid JavaScript | `node --check ui/frame2d/script.js` | exit 0 | PASS |
| Hardcoded empty spring arrays removed | `grep -cE "springDoF: \[\]|springStiffness: \[\]" ui/frame2d/script.js` | 0 | PASS |
| solver_core untouched in Phase 04 | `git log 3405f68^..HEAD --name-only -- solver_core/` | empty | PASS |
| API registers frame2d alias | `grep -n "frame2d" api_server/app.py` | Line 42 registers alias | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HARDEN-01 | 04-01 | Frame solver test suite covers multi-member topologies — portal frame, two-span continuous beam with shared interior node, mixed pinLeft/pinRight with UDL, equilibrium assertions | SATISFIED | TRUST-13/14/15 implement exactly these topologies; all pass with ΣFx/ΣFy/ΣM assertions (tests/test_frame_v2.py:611-760) |
| HARDEN-02 | 04-02 | User can place translational (Kx, Ky) and rotational (Kθ) spring supports at nodes in the frame2d UI and solve structures using them | SATISFIED | All UI artifacts present and wired end-to-end (button, modal, coil glyphs, save/load, payload SI conversion); 11-step human UAT approved per 04-02-SUMMARY.md |
| HARDEN-03 | 04-03 | Interactive UAT pass covering cantilever, simple beam, portal frame, continuous beam with pin release, and spring-support cases produces expected results | SATISFIED | All 5 UAT tests pass via test_uat_frame2d.py; all 5 fixtures authored via the UI Save button (D-12); D-14 bugs fixed in-phase with regression tests |

No orphaned requirements — all HARDEN-* IDs from REQUIREMENTS.md Phase 4 mapping are claimed by one of the three plans' frontmatter.

### Anti-Patterns Found

None at blocker severity. The 04-REVIEW.md captured 3 warnings and 8 info-level findings, all advisory. Summary:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ui/frame2d/script.js | 554, 1495 | `m.udl_x !== null` misses `undefined` for pre-schema members (WR-01 from 04-REVIEW) | Warning | Advisory — non-blocking; no fixture in this phase triggers it |
| ui/frame2d/script.js | 538-540, 1448-1450 | `.filter(Boolean)` fragile for future 0-based indexing (WR-02) | Warning | Advisory — CLAUDE.md locks API at 1-based |
| ui/frame2d/script.js | 574 | `catch {}` (no binding) swallows error text (WR-03) | Warning | Advisory — improves DX but does not break goal |
| ui/frame2d/script.js | 1587 | `console.warn` on unknown support form (IN-02 from 04-REVIEW) | Info | Load handler drops malformed entries silently to devtools |

None of these prevent the phase goal. Code-review report at 04-REVIEW.md is the canonical record.

### Human Verification Required

Two items require operating the browser UI; they cannot be driven by pytest.

#### 1. Reset All pan-state fix (D-14 bug #2)

**Test:**
1. Start `uvicorn api_server.app:app --reload`
2. Open `ui/frame2d/index.html` in a browser
3. Middle-mouse-drag the canvas and release the button OUTSIDE the canvas bounds (reproducer for stuck `isPanning=true`)
4. Click Reset All → confirm
5. Click `Add Node`, click anywhere twice — two red dots should appear
6. Click `Pin Support`, click one of the dots — a pin-support glyph must appear immediately

**Expected:** After step 6, the support glyph renders and the support is registered (click Solve to confirm reactions include it). Pre-fix, step 6 silently dropped the click; post-fix, it succeeds.

**Why human:** JS canvas click events and middle-mouse-drag cannot be driven from pytest. The fix lives at ui/frame2d/script.js:363-364 (inside resetAll()). Plan 04-03 acceptance criteria explicitly accept this trade-off; full manual procedure in 04-03-SUMMARY.md §"Manual verification procedure".

#### 2. Spring UI end-to-end 11-step UAT (from Plan 04-02 Task 3)

**Test:** Run all 11 steps documented in 04-02-PLAN.md `<how-to-verify>` block, covering: Spring button rendering, modal open/cancel/apply, coil glyph rendering, spring-replaces-classic-support (D-05), pre-fill on re-edit, solve produces δ=P/K and reaction=K·δ, Save JSON matches D-08 schema, Load round-trips, Phase 3 backward compatibility (loads `tests/fixtures/sample_pda_frame2d.json`), zero DevTools console errors.

**Expected:** All 11 steps pass exactly as described in 04-02-PLAN.md.

**Why human:** Canvas rendering, modal interactions, browser file Save/Load dialogs, and visual glyph verification cannot be automated from pytest. Already approved by the user on 2026-04-19 per 04-02-SUMMARY.md; this entry records the dependency so future re-verification repeats the flow.

### Gaps Summary

None. All 22 automated must-haves verified; all 3 HARDEN-* requirements satisfied with evidence; solver_core untouched across the phase as required by CLAUDE.md; full test suite 53/53 green. Status is `human_needed` only because two items inherently require browser-UI operation — the resetAll pan-state fix (D-14 #2) and the 11-step Spring UAT from Plan 04-02. The Spring UAT was already approved by the user on 2026-04-19 (recorded in 04-02-SUMMARY.md); the resetAll fix was implemented in d34a5cf but has no automated test because JS canvas events cannot be driven from pytest, as explicitly accepted by the plan's acceptance criteria.

---

*Verified: 2026-04-20T19:00:00Z*
*Verifier: Claude (gsd-verifier)*
