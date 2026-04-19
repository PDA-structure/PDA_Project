---
phase: 04-2d-frame-solver-ui-hardening
plan: 03
type: execute
wave: 2
depends_on:
  - 02
files_modified:
  - tests/fixtures/uat/cantilever.json
  - tests/fixtures/uat/simple_beam.json
  - tests/fixtures/uat/portal_frame.json
  - tests/fixtures/uat/continuous_pin_release.json
  - tests/fixtures/uat/spring_support_beam.json
  - tests/test_uat_frame2d.py
autonomous: false
requirements:
  - HARDEN-03
must_haves:
  truths:
    - "5 canonical JSON fixtures exist in tests/fixtures/uat/: cantilever, simple_beam, portal_frame, continuous_pin_release, spring_support_beam"
    - "Each fixture was produced by the frame2d UI Save button and loads back in the UI round-trip"
    - "tests/test_uat_frame2d.py loads each fixture via FastAPI TestClient, POSTs to /solve/frame2d, asserts reactions + key displacements against inline hand-calc reference values"
    - "All five UAT tests pass; any bug found during authoring is fixed in THIS phase with a regression test (D-14)"
    - "Full test suite (including Plan 01 TRUST-13..17) green — no regression"
  artifacts:
    - path: "tests/fixtures/uat/cantilever.json"
      provides: "Cantilever beam canonical UAT case (fixed at node 1, tip load at node 2)"
      contains: "\"restrainedDoF\": [1, 2, 3]"
    - path: "tests/fixtures/uat/simple_beam.json"
      provides: "Simply-supported beam UAT case (pinned + rollerY, UDL)"
      contains: "\"beamPinRight\""
    - path: "tests/fixtures/uat/portal_frame.json"
      provides: "Portal frame UAT case (pinned column bases, UDL on beam)"
      contains: "\"members\""
    - path: "tests/fixtures/uat/continuous_pin_release.json"
      provides: "Two-span continuous beam with pin release + UDL UAT case"
      contains: "\"beamPinRight\""
    - path: "tests/fixtures/uat/spring_support_beam.json"
      provides: "Simple beam with Ky spring support UAT case — produced via the Plan 02 UI Spring tool"
      contains: "\"springDoF\""
    - path: "tests/test_uat_frame2d.py"
      provides: "UAT harness — loads each fixture, POSTs to /solve/frame2d, asserts against hand-calc references"
      contains: "TestClient(app)"
  key_links:
    - from: "tests/test_uat_frame2d.py"
      to: "api_server.app.app (FastAPI)"
      via: "from api_server.app import app + TestClient"
      pattern: "from api_server.app import app"
    - from: "tests/test_uat_frame2d.py"
      to: "tests/fixtures/uat/*.json"
      via: "json.load + client.post('/solve/frame2d', json=payload)"
      pattern: "/solve/frame2d"
---

<objective>
Close HARDEN-03 by (1) producing 5 canonical UAT JSON fixtures using the frame2d UI's Save button, (2) building a pytest harness that loads each fixture, POSTs to `/solve/frame2d`, and asserts against hand-calculated reference values, and (3) fixing any bug surfaced during fixture authoring with a regression test in this same phase (D-14).

Purpose: Give the project a repeatable UAT that runs in CI without a browser — the 5 canonical cases (cantilever, simple beam, portal frame, continuous beam with pin release, spring-support beam) verify every major frame-solver feature end-to-end through the actual API surface the UI uses.

Output:
- `tests/fixtures/uat/` directory with 5 JSON files, each produced via the frame2d UI Save button (Phase 3 interchange schema with the D-08 spring extension where applicable).
- `tests/test_uat_frame2d.py` — 5+ parameterised/individual tests with hand-calc reference values inline.
- Any bug → fix committed alongside a new regression test in `tests/test_frame_v2.py` or `tests/test_interchange.py`.

Prerequisites:
- Plan 01 (TRUST-13..17 tests) — not strictly required for this plan, but runs in the same wave kickoff.
- Plan 02 (spring UI tool) — REQUIRED. The `spring_support_beam.json` fixture can only be produced after the Spring UI button exists.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md
@CLAUDE.md
@.planning/phases/04-2d-frame-solver-ui-hardening/04-02-frame2d-ui-spring-support-PLAN.md

# Canonical references
@tests/test_interchange.py
@tests/fixtures/sample_pda_frame2d.json
@api_server/app.py
@ui/frame2d/script.js
@solver_core/src/pda_analysis_software/solvers/frame_v2.py

<interfaces>
<!-- TestClient pattern from tests/test_interchange.py — REUSE it exactly. -->
```python
import json
from pathlib import Path
import pytest
import numpy as np
from fastapi.testclient import TestClient
from api_server.app import app

FIXTURES = Path(__file__).parent / "fixtures" / "uat"
client = TestClient(app)

def _solve(payload_filename):
    with open(FIXTURES / payload_filename) as f:
        payload = json.load(f)
    # The saved JSON has extra `canvas`, `schema_version`, `solver` keys. The API accepts them via
    # Pydantic (unknown fields are ignored by default in Pydantic v2 unless model_config forbids; verify behaviour).
    # If the API rejects extras, strip them before POST:
    #    for k in ("schema_version", "solver", "canvas"): payload.pop(k, None)
    # Actually `solver` is REQUIRED at top level — it's the Frame2DRequest.solver field. Keep it.
    # Strip ONLY `schema_version` and `canvas`:
    payload.pop("schema_version", None)
    payload.pop("canvas", None)
    resp = client.post("/solve/frame2d", json=payload)
    assert resp.status_code == 200, f"API returned {resp.status_code}: {resp.text}"
    return resp.json()
```
</interfaces>

<fixture_schema>
Each UAT fixture is a full PDA interchange JSON (from the Save button) with:
- Top-level solve fields: `solver: "frame_v2"` (NOTE: saveModel writes `solver: "frame2d"` at top — this is the SAVE routing key, NOT the API solver key. See ui/frame2d/script.js:1295). The Frame2DRequest API expects `solver: "frame_v2"` OR accepts the default. Verify which key the POST needs — this is a likely bug-discovery point.
- Geometry: `nodes`, `members`
- Loads: `forceVector`, `ENForces`, `ENMoments`, `udl_x`
- Properties: `E`, `I`, `A`
- Releases & supports: `bars`, `beamPinLeft`, `beamPinRight`, `restrainedDoF`, `pinDoF`, `springDoF`, `springStiffness`
- Canvas state: `canvas.origin`, `canvas.nodes`, `canvas.members`, `canvas.supports`, `canvas.nodeLoads`, `canvas.udl`, `canvas.memberOverrides`

**IMPORTANT schema note** (from existing saveModel in ui/frame2d/script.js:1295):
```javascript
solver: "frame2d",            // file routing key
```
This is the FILE-TYPE key (which solver the file belongs to), distinct from the inner request `solver: "frame_v2"` field the API expects. When POSTing to the API we must ensure `payload["solver"] == "frame_v2"`. If the saved file has `solver: "frame2d"` at top level, rewrite it in the test before POSTing — OR verify the file actually has "frame_v2" and update as part of this plan if it's a bug. The existing sample fixture at tests/fixtures/sample_pda_frame2d.json line 3 has `"solver": "frame2d"` — confirming this is the saved convention. The test harness MUST swap `"frame2d"` → `"frame_v2"` at the top-level before POST.
</fixture_schema>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Build 5 UAT JSON fixtures via the frame2d UI Save button</name>
  <files>tests/fixtures/uat/cantilever.json, tests/fixtures/uat/simple_beam.json, tests/fixtures/uat/portal_frame.json, tests/fixtures/uat/continuous_pin_release.json, tests/fixtures/uat/spring_support_beam.json</files>
  <action>Checkpoint task: the HUMAN operates the frame2d browser UI (with the Plan 02 Spring tool available) to build each of the 5 canonical structural cases and save them as JSON via the existing Phase 3 Save button. Files go into tests/fixtures/uat/. Claude cannot automate this step because building geometry requires clicking on the canvas — follow the full procedure in <how-to-verify> below.</action>
  <verify><automated>ls /Users/catrinevans/Documents/pda_project/tests/fixtures/uat/cantilever.json /Users/catrinevans/Documents/pda_project/tests/fixtures/uat/simple_beam.json /Users/catrinevans/Documents/pda_project/tests/fixtures/uat/portal_frame.json /Users/catrinevans/Documents/pda_project/tests/fixtures/uat/continuous_pin_release.json /Users/catrinevans/Documents/pda_project/tests/fixtures/uat/spring_support_beam.json</automated></verify>
  <done>All 5 JSON files exist in tests/fixtures/uat/ and each parses cleanly via jq. Any fixture that does not solve correctly in the UI is NOT saved — bugs found during authoring roll into Task 3.</done>
  <what-built>N/A — this task requires the human to operate the frame2d browser UI to build each canonical case and save it as JSON. The Spring UI tool (from Plan 02) must be working.</what-built>
  <how-to-verify>
    This is a file-creation task that CANNOT be automated — it requires running the UI (a human browser action), building each structural case by clicking, and triggering the Save button. Save all five files into `/Users/catrinevans/Documents/pda_project/tests/fixtures/uat/` (create the directory if it doesn't exist).

    Start the API server first:
    ```
    cd /Users/catrinevans/Documents/pda_project && uvicorn api_server.app:app --reload
    ```
    Open `ui/frame2d/index.html` in a browser.

    **General workflow per case:**
    1. Click Reset All to start clean.
    2. Set E = 200 GPa, I = 10000 cm⁴ (= 1e-4 m⁴), A = 100 cm² (= 0.01 m²) in the sidebar.
    3. Build the geometry + supports + loads described below.
    4. Click Solve — confirm the status banner shows "Solved ✓" before saving (this proves the case is well-posed).
    5. Click Save — the file downloads as `frame2d-model-*.json`.
    6. Rename to the target filename and move into `tests/fixtures/uat/`.

    **Case 1 — `cantilever.json`:**
    - Nodes: node 1 at (0,0), node 2 at (1,0)
    - Members: member 1 connecting node 1 → node 2 (type beam, no releases)
    - Supports: fixed at node 1
    - Loads: point load Y = -10000 N (Force Y at node 2, enter -10000)
    - Solve should succeed. Reference: Uy tip = -FL³/(3EI) = -10000·1³/(3·200e9·1e-4) = -1.667e-4 m

    **Case 2 — `simple_beam.json`:**
    - Nodes: node 1 at (0,0), node 2 at (4,0)
    - Member 1 connecting 1→2 (beam)
    - Supports: pinned at node 1; rollerY (Y fixed, X free) at node 2
    - Loads: UDL on member 1 = 10000 N/m downward (click UDL button, click member, enter wy=10000)
    - Reference: mid-span moment = wL²/8 = 10000·16/8 = 20000 N·m; reactions = wL/2 = 20000 N each
    - NOTE: w is in N/m NOT kN/m in the UDL input per existing UDL panel. Verify by reading ui/frame2d/index.html around the udlPanel section before building.

    **Case 3 — `portal_frame.json`:**
    - Nodes: node 1 at (0,0), node 2 at (0,3), node 3 at (4,3), node 4 at (4,0)
    - Members: 1→2 (left col), 2→3 (beam), 3→4 (right col) — three members
    - Supports: pinned at node 1; pinned at node 4
    - Loads: UDL on member 2 (beam) = 10000 N/m downward
    - Reference: vertical reactions = 20000 N each; horizontal reactions equal-and-opposite (thrust); symmetric portal

    **Case 4 — `continuous_pin_release.json`:**
    - Nodes: node 1 at (0,0), node 2 at (4,0), node 3 at (8,0)
    - Members: 1→2 (span 1), 2→3 (span 2) — two members
    - Apply pin-right release to member 1 (click Pin — Right End, click member 1)
    - Supports: fixed at node 1; fixed at node 3 (NOT just pinned — per TRUST-14 analog; gives the span 2 bending stiffness via the far-end fixed support)
    - Loads: UDL on member 1 ONLY = 10000 N/m downward; span 2 has no load
    - Reference: m1.Mj = 0 at node 2 (pin release); span 1 behaves as a half-propped beam; vertical reactions sum to w·L_span1 = 40000 N

    **Case 5 — `spring_support_beam.json`:** (requires Plan 02's Spring UI tool)
    - Nodes: node 1 at (0,0), node 2 at (4,0)
    - Member 1 connecting 1→2 (beam)
    - Supports: pinned at node 1. At node 2: use the Spring tool → `Ky = 1000` (kN/m, blank Kx and Kθ) → Apply. (Internally this becomes springDoF=[5], springStiffness=[1_000_000] after SI conversion.)
    - Loads: point load Y = -10000 N at node 2
    - Solve must succeed. Reference: δ at node 2 = P/K_y = 10000/1_000_000 = 0.01 m (downward → Uy = -0.01); reaction at node 2 spring = K_y·|δ| = 10000 N

    **After saving all five files**, verify:
    - `ls tests/fixtures/uat/` shows 5 JSON files with the exact names above.
    - Each file parses: `jq . tests/fixtures/uat/cantilever.json` (repeat for each) produces no errors.
    - Each file has `"schema_version": "1.0"` and `"solver": "frame2d"` (the file-routing key; the API test harness will swap this to `frame_v2` before POSTing).
    - `spring_support_beam.json` contains `"springDoF": [5]` and `"springStiffness": [1000000]` and `canvas.supports["1"]` contains a spring object with `"Ky": 1000`.

    **If any case fails to solve or gives wrong results**: stop and log the bug. This is D-14 territory — bugs go to Task 3 for fixing with a regression test. Do NOT save broken fixtures.
  </how-to-verify>
  <resume-signal>Type "approved — 5 fixtures saved and spot-checked" (and paste `ls tests/fixtures/uat/` output) once all five JSON files exist in the correct directory. If any bug was encountered during UI authoring, describe it clearly so Task 3 can fix it.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Write UAT test harness (tests/test_uat_frame2d.py) with hand-calc assertions for all 5 cases</name>
  <files>tests/test_uat_frame2d.py</files>
  <read_first>
    - tests/fixtures/uat/cantilever.json, simple_beam.json, portal_frame.json, continuous_pin_release.json, spring_support_beam.json (all created in Task 1 — read all five to confirm node ordering, DOF indices, and E/I/A values before writing asserts)
    - tests/test_interchange.py (reuse its TestClient pattern and fixture-loading style)
    - api_server/app.py (Frame2DRequest signature + the `/solve/frame2d` response shape: `UG`, `FG`, `member_forces`, `member_shears`, `member_moments`, `meta`)
    - .planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md (D-12: fixtures committed; D-13: test harness with inline hand-calc; D-14: bugs found → Task 3)
    - CLAUDE.md (Frame solver conventions; DOF = i*3 + (0,1,2) in 0-based; API response UG/FG are flat lists of length 3*n_nodes)
  </read_first>
  <action>
    Create `tests/test_uat_frame2d.py` with the following structure. Use the exact hand-calc references from Task 1's case descriptions. Each test must:
    1. Load the fixture JSON
    2. Strip `schema_version` and `canvas` (keep `solver`, rewrite `"frame2d"` → `"frame_v2"` if needed — see fixture_schema note in context)
    3. POST to `/solve/frame2d` via TestClient
    4. Assert the status code is 200
    5. Assert reactions and/or displacements against the inline hand-calc reference

    ```python
    """UAT harness for the 2D frame solver (HARDEN-03).

    Loads each canonical case JSON fixture from tests/fixtures/uat/, POSTs to
    /solve/frame2d via FastAPI TestClient, and asserts against hand-calculated
    reference values.

    Fixtures were produced via the frame2d UI Save button (Phase 3 interchange
    schema + Phase 4 spring extension per D-08). See .planning/phases/
    04-2d-frame-solver-ui-hardening/04-CONTEXT.md D-12 / D-13.
    """

    import json
    from pathlib import Path

    import numpy as np
    import pytest
    from fastapi.testclient import TestClient

    from api_server.app import app


    UAT_DIR = Path(__file__).parent / "fixtures" / "uat"
    client = TestClient(app)


    def _load_and_solve(filename):
        """Load a fixture, normalise the top-level `solver` routing key, POST, return response JSON."""
        with open(UAT_DIR / filename) as f:
            payload = json.load(f)
        # Saved files use `solver: "frame2d"` as a file-routing key. The API expects the
        # inner engine name `frame_v2`. Normalise here so the test harness mirrors what a
        # properly-configured client would send.
        if payload.get("solver") == "frame2d":
            payload["solver"] = "frame_v2"
        # Strip canvas state and schema_version — API ignores them but strip for clarity.
        payload.pop("schema_version", None)
        payload.pop("canvas", None)
        resp = client.post("/solve/frame2d", json=payload)
        assert resp.status_code == 200, (
            f"{filename} → HTTP {resp.status_code}: {resp.text}"
        )
        return resp.json()


    # ---------------------------------------------------------------------------
    # Case 1: Cantilever (tip point load)
    # Geometry: node 1 (0,0) fixed; node 2 (1,0); member 1→2; P = -10000 N at node 2 Y
    # E = 200e9 Pa, I = 1e-4 m⁴, A = 0.01 m²
    # Hand-calc: Uy_tip = -F·L³/(3·E·I) = -10000·1³/(3·200e9·1e-4) = -1.6667e-4 m
    #            θ_tip  =  F·L²/(2·E·I) = -1000 / (2·200e9·1e-4) ≈ 2.5e-5 rad (sign: since
    #            force is -Y, tip rotates clockwise → negative θ for right-handed coord where
    #            CCW is +)
    #            Reaction Ry at node 1 = +10000 N (up); moment at base M1 = +F·L = -(-10000)·1 =
    #            +10000 N·m (restoring).
    # ---------------------------------------------------------------------------
    def test_uat_cantilever():
        """UAT-01: Cantilever tip deflection and reactions match analytical."""
        res = _load_and_solve("cantilever.json")
        UG = res["UG"]   # flat, length 6 (2 nodes × 3 DOF)
        FG = res["FG"]
        # Node 2 Uy at flat index 4 (node 2, DOF y = index 3*1 + 1 = 4)
        assert UG[4] == pytest.approx(-10000.0 * 1.0**3 / (3 * 200e9 * 1e-4), rel=1e-5)
        # Reaction Ry at node 1 = +10000 N (balances the -10000 N tip load)
        assert FG[1] == pytest.approx(10000.0, rel=1e-5)
        # Global equilibrium: ΣFy = 0 → FG[1] + applied(-10000) == 0
        assert np.isclose(FG[1] - 10000.0, 0.0, atol=1e-4)


    # ---------------------------------------------------------------------------
    # Case 2: Simple beam (UDL)
    # Geometry: node 1 (0,0) pinned; node 2 (4,0) rollerY; member 1→2; UDL w = 10000 N/m
    # Hand-calc: reactions = w·L/2 = 20000 N each (upward)
    #            midspan moment magnitude = w·L²/8 = 10000·16/8 = 20000 N·m (sagging)
    #            midspan deflection = 5·w·L⁴/(384·E·I) = 5·10000·256/(384·200e9·1e-4) ≈ 1.667e-4 m
    # ---------------------------------------------------------------------------
    def test_uat_simple_beam_udl():
        """UAT-02: Simply-supported beam with UDL — reactions and member moments."""
        res = _load_and_solve("simple_beam.json")
        FG = res["FG"]
        # Reactions at nodes 1 and 2 vertical DOF (flat index 1 and 4): each = w·L/2 = 20000 N
        assert FG[1] == pytest.approx(20000.0, rel=1e-3)
        assert FG[4] == pytest.approx(20000.0, rel=1e-3)
        # Horizontal reactions zero
        assert FG[0] == pytest.approx(0.0, abs=1.0)
        # Member moment at midspan: API returns member_moments as [Mi, Mj] per member;
        # for a simply-supported beam with UDL and zero end moments (pin + rollerY, both
        # with θ free), Mi ≈ 0, Mj ≈ 0, max-M is at midspan (not reported directly).
        # Instead assert Mi and Mj are approximately zero (end moments).
        assert abs(res["member_moments"][0][0]) < 1.0   # Mi at pinned end
        assert abs(res["member_moments"][0][1]) < 1.0   # Mj at rollerY end


    # ---------------------------------------------------------------------------
    # Case 3: Portal frame (UDL on beam, pinned bases)
    # Geometry: 4 nodes, 3 members as described in Task 1
    # Hand-calc: symmetric pinned-base portal with UDL w on beam (L_beam = 4, H_col = 3)
    #            Vertical reactions Ry_1 = Ry_4 = w·L/2 = 20000 N (each)
    #            Horizontal reactions: H = w·L²/(8·h) for rigid portal → 10000·16/(8·3) = 6666.67 N
    #            (equal and opposite; left +X, right -X for load downward → inward thrust)
    # ---------------------------------------------------------------------------
    def test_uat_portal_frame_udl():
        """UAT-03: Portal frame — vertical reactions + global equilibrium."""
        res = _load_and_solve("portal_frame.json")
        FG = res["FG"]
        # Node 1 = flat indices 0,1,2; Node 4 = flat indices 9,10,11
        # Vertical reactions
        assert FG[1] == pytest.approx(20000.0, rel=1e-3)
        assert FG[10] == pytest.approx(20000.0, rel=1e-3)
        # Horizontal reactions equal-and-opposite (symmetric portal)
        assert np.isclose(FG[0] + FG[9], 0.0, atol=1.0)
        # Global ΣFy = total UDL applied = w·L_beam = 40000 N
        assert np.isclose(FG[1] + FG[10], 40000.0, atol=1.0)


    # ---------------------------------------------------------------------------
    # Case 4: Two-span continuous beam with pin release on span 1 + UDL on span 1 only
    # Geometry: 3 nodes (0,0), (4,0), (8,0); members 1→2, 2→3; beamPinRight on member 1;
    #           both end nodes fixed; UDL only on member 1 (w=10000 N/m); span 2 unloaded
    # Hand-calc: m1.Mj = 0 at node 2 (beamPinRight release); vertical reactions sum = w·L_span = 40000 N
    # ---------------------------------------------------------------------------
    def test_uat_continuous_pin_release():
        """UAT-04: Two-span continuous beam, pin release on span 1, UDL on span 1."""
        res = _load_and_solve("continuous_pin_release.json")
        FG = res["FG"]
        # Total vertical reactions (node 1 flat idx 1, node 3 flat idx 7) sum to UDL total
        assert np.isclose(FG[1] + FG[7], 40000.0, atol=1.0)
        # Member 1 moment at node 2 (Mj) = 0 — pin release
        assert res["member_moments"][0][1] == pytest.approx(0.0, abs=1.0)
        # Member 2 at node 2 (Mi) must also be 0 (ΣM at free node 2 with no external moment
        # AND m1.Mj already 0 forces m2.Mi = 0)
        assert res["member_moments"][1][0] == pytest.approx(0.0, abs=1.0)


    # ---------------------------------------------------------------------------
    # Case 5: Simple beam with Ky spring at one end
    # Geometry: node 1 (0,0) pinned; node 2 (4,0) with Ky = 1000 kN/m = 1e6 N/m spring;
    #           P = -10000 N at node 2 Y
    # Hand-calc: δ = P/K_y = 10000/1e6 = 0.01 m (downward → Uy2 = -0.01)
    #            Reaction at spring = K_y·|δ| = 10000 N (balances applied load directly,
    #            since load is at the spring node; pin at node 1 carries ~0 vertical)
    # ---------------------------------------------------------------------------
    def test_uat_spring_support_beam():
        """UAT-05: Simply-supported beam with vertical spring at one end — closes HARDEN-02+03."""
        res = _load_and_solve("spring_support_beam.json")
        UG = res["UG"]
        FG = res["FG"]
        # Uy at node 2 = flat index 4 = -P/K_y = -0.01 m
        assert UG[4] == pytest.approx(-0.01, rel=1e-3)
        # Spring reaction at node 2 = K_y · |δ| = 10000 N
        assert FG[4] == pytest.approx(10000.0, rel=1e-3)
        # Pin at node 1 carries ~0 vertical (load is directly over spring)
        assert FG[1] == pytest.approx(0.0, abs=1.0)
        # ΣFy equilibrium
        assert np.isclose(FG[1] + FG[4], 10000.0, atol=1e-3)
    ```

    Write the file exactly as above, with any tolerance adjustments needed once you read the actual fixtures — read the fixtures first to confirm node ordering and DOF layout match these assertions. If a fixture stores nodes in a different order (e.g., the portal was built with nodes in a different sequence), adjust the flat-index references accordingly BEFORE writing the assertions. Do NOT modify fixtures to make tests pass — adjust test indices to match what the UI produced.

    If a test fails with unexpected physics, that's a UAT bug discovery per D-14 — STOP, document it in the plan's SUMMARY.md, and move to Task 3.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && pytest tests/test_uat_frame2d.py -v</automated>
  </verify>
  <acceptance_criteria>
    - `tests/test_uat_frame2d.py` exists: `ls tests/test_uat_frame2d.py` succeeds
    - All 5 fixtures exist and parse: `for f in cantilever simple_beam portal_frame continuous_pin_release spring_support_beam; do jq . tests/fixtures/uat/$f.json > /dev/null || exit 1; done` exits 0
    - `grep -n "def test_uat_cantilever" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n "def test_uat_simple_beam_udl" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n "def test_uat_portal_frame_udl" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n "def test_uat_continuous_pin_release" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n "def test_uat_spring_support_beam" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n "from fastapi.testclient import TestClient" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n "from api_server.app import app" tests/test_uat_frame2d.py` returns exactly 1 match
    - `grep -n '/solve/frame2d' tests/test_uat_frame2d.py` returns at least 1 match (POST target)
    - `cd /Users/catrinevans/Documents/pda_project && pytest tests/test_uat_frame2d.py -q` exits 0
    - Global regression still clean: `cd /Users/catrinevans/Documents/pda_project && pytest tests/ -q` exits 0
  </acceptance_criteria>
  <done>All 5 UAT tests pass. Global test suite green. HARDEN-03 closed unless a bug was surfaced — in which case Task 3 covers the fix-and-regression cycle.</done>
</task>

<task type="auto">
  <name>Task 3: Fix any bug surfaced by UAT + add regression test (D-14)</name>
  <files>tests/test_frame_v2.py OR tests/test_uat_frame2d.py OR ui/frame2d/script.js OR api_server/app.py (depending on where the bug lives — DO NOT touch solver_core)</files>
  <read_first>
    - .planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md (D-14: bugs found → fix in Phase 4 with a dedicated regression test. Non-bug discoveries (UX nits, feature ideas) are captured as pending todos, NOT folded into this task)
    - The failing test output from Task 2 (if any)
    - The file the bug is in (to be determined)
    - CLAUDE.md (hard rules — solver_core has NO matplotlib, NO printing, and must not be modified in this phase; spring backend is already landed)
  </read_first>
  <action>
    **If Task 2 ended with all tests passing:** This task is a NO-OP — mark it skipped and move straight to Task 4 (SUMMARY). Record in SUMMARY.md: "No UAT bugs surfaced; Task 3 skipped per D-14."

    **If Task 2 surfaced a bug:**

    1. **Diagnose**: isolate the failing test, reproduce the failure deterministically, and identify the file + line where the bug lives.

    2. **Scope gate**: determine whether the bug is:
       - A **real bug** (incorrect physics, broken round-trip, wrong DOF mapping, unit-conversion error) → fix in this task.
       - A **UX nit** or **feature request** (not a bug — the solver/UI behaves correctly but suboptimally) → create a pending todo under `.planning/todos/pending/` and EXCLUDE it from this task.

    3. **Fix the bug** in the appropriate file:
       - If the bug is in UI save/load round-trip → fix `ui/frame2d/script.js`
       - If the bug is in the API request handling → fix `api_server/app.py`
       - If the bug is in a fixture (bad node ordering, wrong units) → rebuild the fixture via the UI (repeat Task 1 for the affected case) — do NOT hand-edit the JSON
       - If the bug is in the test assertions (wrong hand-calc) → fix `tests/test_uat_frame2d.py`
       - **DO NOT modify solver_core files** (hard constraint per planning context — spring backend is already implemented and regression-tested)

    4. **Add a regression test** in the most appropriate file:
       - Solver-physics bug → add `test_regression_<short_description>()` to `tests/test_frame_v2.py` alongside TRUST-13..17 (from Plan 01)
       - API request / payload bug → add to `tests/test_uat_frame2d.py` or `tests/test_interchange.py`
       - UI JS bug → add to the existing UAT harness if the failure manifests in a fixture POST, OR add a new fixture + test case
       - Regression test MUST fail against the pre-fix code and pass after the fix. Commit sequencing: (a) failing regression test, (b) fix. If the orchestrator squashes, ensure the regression test is in the same commit as the fix.

    5. **Re-run the full suite** to confirm the fix doesn't break anything else: `pytest tests/ -q` must exit 0.

    6. **Document** the bug and fix in `.planning/phases/04-2d-frame-solver-ui-hardening/04-03-SUMMARY.md`:
       - What was the user-observable symptom?
       - What was the root cause?
       - Which file was fixed? What changed?
       - What regression test name covers it?
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && pytest tests/ -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd /Users/catrinevans/Documents/pda_project && pytest tests/ -q` exits 0 (all tests pass)
    - If a bug was found: `git log --oneline -5 | grep -iE "fix|regression"` returns ≥ 1 entry (commit trail documents the fix)
    - If a bug was found: the regression test name appears in at least one test file (`grep -rn "test_regression_" tests/ | wc -l` ≥ 1 for bugs found — 0 is acceptable if no bug)
    - If no bug was found: `.planning/phases/04-2d-frame-solver-ui-hardening/04-03-SUMMARY.md` records "No UAT bugs surfaced; Task 3 skipped per D-14."
    - `solver_core/` files untouched across the whole phase: `git diff main --name-only -- solver_core/` returns empty (hard constraint)
  </acceptance_criteria>
  <done>Either (a) no bugs found and documented, or (b) all discovered bugs fixed with regression tests, and global suite green. solver_core untouched.</done>
</task>

</tasks>

<verification>
- Full pytest suite exits 0: `pytest tests/ -q`
- All 5 UAT tests individually green: `pytest tests/test_uat_frame2d.py -v`
- All 5 fixtures parse and have the expected structural fields: `for f in cantilever simple_beam portal_frame continuous_pin_release spring_support_beam; do jq 'has("nodes") and has("members") and has("restrainedDoF") and has("springDoF") and has("canvas")' tests/fixtures/uat/$f.json; done` all emit `true`
- `solver_core/` untouched per hard constraint
- Any bugs found are documented and regression-tested
</verification>

<success_criteria>
- HARDEN-03 requirement satisfied: 5 canonical UAT JSON fixtures in `tests/fixtures/uat/`, a CI-runnable harness in `tests/test_uat_frame2d.py`, all 5 UAT tests green
- D-12, D-13, D-14 all implemented
- No regression in any prior test (TRUST-01..12, TRUST-13..17 from Plan 01, interchange, truss, section_properties)
- No solver_core changes
- Any UAT-surfaced bug fixed with a regression test committed in this phase
</success_criteria>

<output>
After completion, create `.planning/phases/04-2d-frame-solver-ui-hardening/04-03-SUMMARY.md` with:
- Final `ls tests/fixtures/uat/` listing
- Per-fixture summary: structural case, hand-calc references, pass/fail result
- If any bug was found: full root-cause + fix + regression-test summary (per D-14)
- If no bug: explicit "No UAT bugs surfaced; Task 3 skipped per D-14"
- Confirmation that solver_core was NOT touched across the whole phase
- Folded todo status: mark `.planning/todos/pending/2026-04-19-multi-member-frame-solver-test-coverage.md` as completed (per CONTEXT Claude's Discretion D-14)
</output>
