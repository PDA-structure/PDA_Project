"""UAT harness for the 2D frame solver (Phase 04, Plan 03 / HARDEN-03).

Five canonical hand-checkable cases are POSTed to ``/solve/frame2d`` via
FastAPI TestClient and asserted against closed-form structural-mechanics
reference values:

    1. cantilever                — tip point load (PL^3/3EI)
    2. simple_beam_udl           — simply-supported beam with UDL
                                   (5wL^4/384EI midspan, wL^3/24EI end rotation)
    3. portal_frame_udl          — pinned-base portal, UDL on beam
                                   (symmetric vertical reactions, kick-out thrust)
    4. continuous_pin_release    — 2-span beam with beamPinRight on span 1 only
    5. spring_support_beam       — cantilever with Ky spring at tip (P/K deflection)

Fixtures under ``tests/fixtures/uat/`` were authored by a human via the
frame2d UI's Save button (Task 1 of Plan 04-03, per D-12) and exercise
the full stack: Pydantic request → FrameV2Adapter → BeamBarStructure_v2
→ AnalysisResult → JSON response.

**Solver-routing key swap** (plan fixture_schema note): the saved UI file
uses ``"solver": "frame2d"`` as a file-type routing key. The API engine
registry only knows ``"frame_v2"``. This harness swaps the key before
POSTing, which mirrors what the UI's ``solve()`` function does inline.

CLAUDE.md invariants verified:
    * 1-based DOF numbering in the public API
      (restrainedDoF, springDoF values in fixtures are 1-based).
    * Cantilever fixed-end moment is negative for downward tip load
      (solver hogging-negative convention).
    * solver_core/ is NOT modified — all behaviour comes from the
      already-landed spring backend and pin-release fixes from
      Phase 04 Plan 01 (TRUST-13..17).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api_server.app import app


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "uat"


@pytest.fixture(scope="module")
def client() -> TestClient:
    """FastAPI test client shared across all UAT tests in this module."""
    return TestClient(app)


def _load_and_solve(client: TestClient, name: str) -> dict:
    """Load a UAT JSON fixture by bare name, normalise the top-level solver
    routing key (``"frame2d"`` → ``"frame_v2"``), strip canvas/schema
    metadata, POST to ``/solve/frame2d``, assert 200, return the JSON body.
    """
    path = FIXTURES_DIR / f"{name}.json"
    with path.open() as fh:
        payload = json.load(fh)

    # Plan fixture_schema note: saved files use file-routing key "frame2d",
    # the API's AnalysisEngine registry expects engine name "frame_v2".
    if payload.get("solver") == "frame2d":
        payload["solver"] = "frame_v2"
    payload.pop("schema_version", None)
    payload.pop("canvas", None)

    response = client.post("/solve/frame2d", json=payload)
    assert response.status_code == 200, (
        f"{name}: expected HTTP 200, got {response.status_code}: "
        f"{response.text[:400]}"
    )
    return response.json()


# ---------------------------------------------------------------------------
# 1. CANTILEVER — tip point load
# ---------------------------------------------------------------------------
def test_uat_cantilever(client: TestClient) -> None:
    """UAT-01: Cantilever, L=1 m, fixed at node 0, free at node 1; P=-10 kN at tip.

    Fixture: E=200 GPa, I=1e-4 m^4, A=0.01 m^2, F=-10000 N at DOF 5 (node 1 Uy).

    Classical closed-form (Euler-Bernoulli cantilever, downward tip load):
        EI              = 2.0e7 N*m^2
        tip Uy          = P*L^3/(3*EI)  = -10000*1/(3*2e7) = -1.6667e-4 m
        tip rotation θ  = P*L^2/(2*EI)  = -10000*1/(2*2e7) = -2.5e-4 rad
                          (solver returns +2.5e-4 because it uses
                           clockwise-positive θ convention for downward
                           deflection — see CLAUDE.md frame conventions
                           and TRUST-06/07 sign precedents)
        base Ry         = +10000 N  (upward reaction)
        base M          = P*L       = -10000 N*m  (hogging; CLAUDE.md:
                          "Moment at fixed end of cantilever with downward
                          load is negative: mbrMoments[e,0] < 0")
    """
    res = _load_and_solve(client, "cantilever")

    UG = res["UG"]
    FG = res["FG"]
    assert len(UG) == 6 and len(FG) == 6   # 2 nodes × 3 DOF

    # Node 0 fully fixed.
    for idx in (0, 1, 2):
        assert UG[idx] == pytest.approx(0.0, abs=1e-12)

    # Node 1 — tip displacement / rotation.
    assert UG[3] == pytest.approx(0.0, abs=1e-9)           # Ux — no axial load
    assert UG[4] == pytest.approx(-1.6667e-4, rel=1e-4)    # Uy = PL^3/(3EI)
    # Solver's θ convention is clockwise-positive; magnitude |θ| = PL^2/(2EI).
    assert abs(UG[5]) == pytest.approx(2.5e-4, rel=1e-4)

    # Fixed-end reactions.
    assert FG[0] == pytest.approx(0.0, abs=1e-6)           # Rx
    assert FG[1] == pytest.approx(10000.0, rel=1e-5)       # Ry = -P
    assert FG[2] == pytest.approx(-10000.0, rel=1e-5)      # M  = -|P|*L (hogging)

    # Member moment at fixed end: hogging negative (CLAUDE.md invariant).
    mm = res["member_moments"][0]
    assert mm[0] == pytest.approx(-10000.0, rel=1e-5)
    assert mm[1] == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# 2. SIMPLE BEAM — UDL
# ---------------------------------------------------------------------------
def test_uat_simple_beam_udl(client: TestClient) -> None:
    """UAT-02: Simply-supported beam, L=4 m, UDL w=10 kN/m downward.

    Fixture: nodes 0 pinned (restrainedDoF=[1,2]) and 1 rollerY ([5]),
    E=200 GPa, I=1e-4 m^4, EI=2e7 N*m^2.
    UDL converted by the UI to: ENForces=[-20000,-20000],
    ENMoments=[+13333.33,-13333.33] (matches CLAUDE.md sign convention).

    Classical closed-form simply-supported UDL:
        vertical reactions:  R_0 = R_1 = wL/2 = +20000 N
        end rotations:       |θ_0| = |θ_1| = wL^3/(24*EI) = 1.333e-3 rad
        end moments:         M_0 = M_1 = 0 (pinned supports, θ free)

    These are the solver's documented pattern — TRUST-03
    (``test_udl_simply_supported_deflection`` in tests/test_frame_v2.py:170)
    asserts the identical closed-form set for the bare FEM solver.
    This UAT asserts the API layer reproduces it.
    """
    res = _load_and_solve(client, "simple_beam")

    UG = res["UG"]
    FG = res["FG"]
    assert len(UG) == 6 and len(FG) == 6

    # Both supports: no vertical displacement, no axial displacement.
    assert UG[0] == pytest.approx(0.0, abs=1e-12)  # node 0 Ux (pinned)
    assert UG[1] == pytest.approx(0.0, abs=1e-12)  # node 0 Uy (pinned)
    assert UG[3] == pytest.approx(0.0, abs=1e-9)   # node 1 Ux (no axial load)
    assert UG[4] == pytest.approx(0.0, abs=1e-12)  # node 1 Uy (rollerY)

    # End rotations: equal & opposite magnitude wL^3/(24*EI) by symmetry.
    # w=10000, L=4, E=200e9, I=1e-4 → 10000*64/(24*2e7) = 1.3333e-3 rad.
    expected_rotation = 10000.0 * 4.0**3 / (24.0 * 200e9 * 1e-4)
    assert abs(UG[2]) == pytest.approx(expected_rotation, rel=1e-4)
    assert abs(UG[5]) == pytest.approx(expected_rotation, rel=1e-4)
    assert UG[2] == pytest.approx(-UG[5], abs=1e-9)   # symmetric & opposite

    # Vertical reactions wL/2 each.
    assert FG[1] == pytest.approx(20000.0, rel=1e-5)   # R_0
    assert FG[4] == pytest.approx(20000.0, rel=1e-5)   # R_1
    # No horizontal reaction at pinned support (no horizontal load).
    assert FG[0] == pytest.approx(0.0, abs=1e-6)
    # Vertical equilibrium: ΣR_y = wL total applied.
    assert FG[1] + FG[4] == pytest.approx(10000.0 * 4.0, rel=1e-5)

    # End moments zero for simply-supported beam.
    mm = res["member_moments"][0]
    assert abs(mm[0]) < 1e-3   # Mi ≈ 0 at pinned end
    assert abs(mm[1]) < 1e-3   # Mj ≈ 0 at rollerY end


# ---------------------------------------------------------------------------
# 3. PORTAL FRAME — pinned bases, UDL on beam
# ---------------------------------------------------------------------------
def test_uat_portal_frame_udl(client: TestClient) -> None:
    """UAT-03: Symmetric portal frame — pinned column bases, UDL on top beam.

    Fixture: 4 nodes 0(0,0), 1(0,3), 2(4,3), 3(4,0); 3 members — left col
    (0→1), beam (1→2), right col (2→3). UDL w=10 kN/m downward on beam only.
    Bases pinned: ``restrainedDoF = [1, 2, 10, 11]`` (Ux, Uy at nodes 0 & 3).

    Symmetric pinned-base portal under symmetric vertical load:
        * ΣR_y at bases = wL_beam = 40 kN            (vertical equilibrium)
        * R_y,0 = R_y,3 = wL_beam/2 = 20 kN           (by symmetry)
        * R_x,0 = -R_x,3                              (horizontal equilibrium;
                                                       kick-out thrust = 0 net)
        * No moment reaction at either base (pinned θ free)
    """
    res = _load_and_solve(client, "portal_frame")

    UG = res["UG"]
    FG = res["FG"]
    assert len(UG) == 12 and len(FG) == 12   # 4 nodes × 3 DOF

    # Pinned bases: Ux = Uy = 0; θ free.
    for idx in (0, 1, 9, 10):
        assert UG[idx] == pytest.approx(0.0, abs=1e-12)

    # Symmetry checks (geometric + load symmetry):
    #   node 1 ↔ node 2 mirror pair across the frame vertical centreline.
    assert UG[3] == pytest.approx(-UG[6], abs=1e-9)    # Ux_1 = -Ux_2
    assert UG[4] == pytest.approx(UG[7], abs=1e-9)     # Uy_1 = Uy_2
    assert UG[5] == pytest.approx(-UG[8], abs=1e-9)    # θ_1  = -θ_2

    # Base vertical reactions equal & total = wL_beam.
    assert FG[1] == pytest.approx(20000.0, rel=1e-4)   # R_y,0
    assert FG[10] == pytest.approx(20000.0, rel=1e-4)  # R_y,3
    assert FG[1] + FG[10] == pytest.approx(40000.0, rel=1e-4)

    # Horizontal reactions equal-and-opposite (no net horizontal load).
    assert FG[0] == pytest.approx(-FG[9], abs=1e-4)

    # Pinned bases → no moment reactions (θ free).
    assert FG[2] == pytest.approx(0.0, abs=1e-6)
    assert FG[11] == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# 4. CONTINUOUS BEAM WITH PIN RELEASE — 2-span, UDL on span 1 only
# ---------------------------------------------------------------------------
def test_uat_continuous_pin_release(client: TestClient) -> None:
    """UAT-04: Two-span beam with beamPinRight on span 1 + UDL on span 1 only.

    Fixture: 3 nodes at (0,0), (4,0), (8,0); 2 members 0→1 and 1→2.
    Member 1 has ``beamPinRight = [1]`` (moment release at its j-end =
    shared node 2). Both outer nodes fully fixed. UDL w=10 kN/m on span 1
    (member 0) only — span 2 is unloaded.

    Pin-release invariants (D-12):
        * m1.Mj = 0 at released j-end (member_moments[0][1])
        * m2.Mi = 0 at shared node 2 by moment equilibrium
          (no external moment, and m1.Mj = 0 forces m2.Mi = 0)

    Vertical equilibrium:
        * Total load applied = w * L_span1 = 10000 * 4 = 40 kN downward
        * ΣR_y = +40 kN upward

    Fixed-base hogging (span 1 behaves like a propped cantilever):
        * m1.Mi < 0 at the fixed i-end (hogging at left support)
    """
    res = _load_and_solve(client, "continuous_pin_release")

    UG = res["UG"]
    FG = res["FG"]
    assert len(UG) == 9 and len(FG) == 9   # 3 nodes × 3 DOF

    # Outer fixed supports: all DOFs zero.
    for idx in (0, 1, 2, 6, 7, 8):
        assert UG[idx] == pytest.approx(0.0, abs=1e-12)

    # Vertical equilibrium across the two fixed supports.
    total_load = 10000.0 * 4.0
    assert FG[1] + FG[7] == pytest.approx(total_load, rel=1e-4)

    # No horizontal load → no horizontal reactions.
    assert FG[0] == pytest.approx(0.0, abs=1e-6)
    assert FG[6] == pytest.approx(0.0, abs=1e-6)

    # Pin-release invariants.
    mm = res["member_moments"]
    assert mm[0][1] == pytest.approx(0.0, abs=1e-4), (
        f"beamPinRight: m1.Mj should be 0, got {mm[0][1]}"
    )
    assert mm[1][0] == pytest.approx(0.0, abs=1e-4), (
        f"Moment equilibrium at shared node 2: m2.Mi should be 0, got {mm[1][0]}"
    )

    # Fixed-base hogging on span 1 (propped-cantilever-like).
    assert mm[0][0] < -1.0, f"m1.Mi should be hogging (negative), got {mm[0][0]}"


# ---------------------------------------------------------------------------
# 5. SPRING-SUPPORT BEAM — pin + Ky spring at tip, P at spring node
# ---------------------------------------------------------------------------
def test_uat_spring_support_beam(client: TestClient) -> None:
    """UAT-05: Single-span beam — pinned at node 0, Ky spring at node 1
    (``springDoF=[5]``, ``springStiffness=[1e6]`` = 1 MN/m), P=-10 kN at
    node 1 Uy.

    Fixture: nodes 0(0,0), 1(4,0); member 0→1; ``restrainedDoF=[1,2]``
    (pin at node 0 restrains Ux, Uy only; θ_0 is free). Applied load is
    a tip point load at DOF 5.

    With load applied directly at the spring node and node 0 pinned
    (no rotational stiffness at the pin), the system is statically
    determinate about the spring — the spring alone supports the load:

        * δ_spring = P / K_y = -10000 / 1e6 = -0.01 m    (Uy at node 1)
        * Spring reaction magnitude |K_y * δ| = 10000 N  (= |P|)
        * Pin carries no vertical force (R_y,0 ≈ 0) — the rigid-body
          mechanism pivots freely about the pin.
        * End rotation |θ_0| = |θ_1| = δ/L = 0.01/4 = 2.5e-3 rad
          (beam rotates about the pin as a rigid bar, both ends rotate
           the same — zero bending moment throughout)

    Covers HARDEN-02 end-to-end through the API boundary (TRUST-16 in
    tests/test_frame_v2.py covers it at the adapter level).
    """
    res = _load_and_solve(client, "spring_support_beam")

    UG = res["UG"]
    FG = res["FG"]
    assert len(UG) == 6 and len(FG) == 6

    # Pin at node 0: Ux = Uy = 0; θ free.
    assert UG[0] == pytest.approx(0.0, abs=1e-12)
    assert UG[1] == pytest.approx(0.0, abs=1e-12)

    # Spring deflection at node 1: δ = P/K_y.
    P = 10000.0
    K_y = 1.0e6
    assert UG[4] == pytest.approx(-P / K_y, rel=1e-5)

    # Pin carries no vertical load (statically-determinate about spring).
    assert FG[1] == pytest.approx(0.0, abs=1e-4)
    # No horizontal reaction (no horizontal applied load).
    assert FG[0] == pytest.approx(0.0, abs=1e-6)

    # Spring reaction magnitude = |K * δ| = P (balances applied load).
    spring_reaction = -K_y * UG[4]   # upward reaction on structure
    assert spring_reaction == pytest.approx(P, rel=1e-5)

    # Rigid-bar rotation about the pin: both ends have the same rotation.
    # δ_tip / L = 0.01 / 4 = 2.5e-3 rad.
    expected_theta = 0.01 / 4.0
    assert abs(UG[2]) == pytest.approx(expected_theta, rel=1e-4)
    assert abs(UG[5]) == pytest.approx(expected_theta, rel=1e-4)

    # Bending moments zero throughout (rigid-body rotation — no bending).
    mm = res["member_moments"][0]
    assert abs(mm[0]) < 1e-3
    assert abs(mm[1]) < 1e-3

    # Member axial force zero (load is perpendicular to axial direction).
    assert res["member_forces"][0] == pytest.approx(0.0, abs=1e-4)
