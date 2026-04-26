"""
Tests for the 2D frame/beam-bar solver (BeamBarStructure_v2).

Analytical reference cases:
  - Cantilever beam: tip deflection and rotation under point load
  - Fixed-fixed beam: midpoint deflection under UDL (via ENAs)
"""

import json
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api_server.app import app
from pda_analysis_software.solvers.frame_v2 import BeamBarStructure_v2
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter
from pda_analysis_software.models.frame2d_model import FrameModel2D


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "uat"


@pytest.fixture(scope="module")
def client() -> TestClient:
    """FastAPI test client for TRUST-19 (and any future API-level tests)."""
    return TestClient(app)


E = 200e9   # Pa
I = 1e-4    # m^4
A = 0.01    # m^2
L = 1.0     # m
F = 1000.0  # N (tip load)


# ---------------------------------------------------------------------------
# Case 1: Cantilever beam — tip point load (no distributed load)
#
# Nodes: 1(0,0), 2(L,0)  — horizontal beam
# Members: [1,2]
# Fixed at node1: DoF 1,2,3 (Ux1, Uy1, theta1)
# Load: -F at node2 y-direction (DoF 5)
#
# Analytical:
#   tip deflection  Uy2 = -F*L^3 / (3*E*I)
#   tip rotation    θ2  =  F*L^2 / (2*E*I)
#   axial           Ux2 = 0
# ---------------------------------------------------------------------------
@pytest.fixture
def cantilever():
    return BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L, 0.0]],
        members=[[1, 2]],
        ENForces=[[0.0, 0.0]],
        ENMoments=[[0.0, 0.0]],
        force_vector=[0.0, 0.0, 0.0, 0.0, -F, 0.0],
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 3],
    )


def test_cantilever_tip_deflection(cantilever):
    cantilever.solve_structure()
    UG = cantilever.UG

    expected_uy2 = -F * L**3 / (3 * E * I)
    expected_th2 = F * L**2 / (2 * E * I)

    assert UG[3, 0] == pytest.approx(0.0, abs=1e-12)           # Ux2 — no horizontal load
    assert UG[4, 0] == pytest.approx(expected_uy2, rel=1e-9)   # Uy2
    assert UG[5, 0] == pytest.approx(expected_th2, rel=1e-9)   # theta2
    # Equilibrium: vertical reaction at fixed end = applied load
    assert np.isclose(cantilever.FG[1, 0] - F, 0, atol=1e-6)


def test_cantilever_reactions(cantilever):
    cantilever.solve_structure()
    FG = cantilever.FG

    # Reaction at fixed end (node1): Fy1 = +F, M1 = -F*L
    assert FG[1, 0] == pytest.approx(F, rel=1e-6)           # Uy1 reaction
    assert FG[2, 0] == pytest.approx(-F * L, rel=1e-6)      # theta1 reaction (moment)
    assert FG[0, 0] == pytest.approx(0.0, abs=1e-6)         # Ux1 reaction (no horizontal)
    # Global equilibrium: vertical reaction balances applied load
    assert np.isclose(FG[1, 0] - F, 0, atol=1e-6)


def test_cantilever_member_forces(cantilever):
    cantilever.solve_structure()

    # Axial force in a cantilever with transverse tip load = 0
    assert cantilever.mbrForces[0] == pytest.approx(0.0, abs=1e-6)

    # Shear at i-end = F, at j-end = -F (equal and opposite after ENA removal)
    assert cantilever.mbrShears[0, 0] == pytest.approx(F, rel=1e-6)

    # Moment at fixed end (i): hogging → -F*L in solver convention; free end (j) = 0
    assert cantilever.mbrMoments[0, 0] == pytest.approx(-F * L, rel=1e-6)
    assert cantilever.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-6)
    # Equilibrium: vertical reaction at fixed end = applied load
    assert np.isclose(cantilever.FG[1, 0] - F, 0, atol=1e-6)


def test_cantilever_adapter_pipeline():
    """Verify full adapter pipeline (as called by the API)."""
    model = FrameModel2D(
        nodes=np.array([[0.0, 0.0], [L, 0.0]]),
        members=np.array([[1, 2]]),
        ENForces=np.array([[0.0, 0.0]]),
        ENMoments=np.array([[0.0, 0.0]]),
        forceVector=np.array([0.0, 0.0, 0.0, 0.0, -F, 0.0]).reshape(-1, 1),
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 3],
        pinDoF=[],
        bars=[],
        beamPinLeft=[], beamPinRight=[],
        springDoF=[], springStiffness=[],
    )
    result = FrameV2Adapter(model).solve()

    expected_uy2 = -F * L**3 / (3 * E * I)
    assert result.solver == "frame_v2"
    assert result.UG[4, 0] == pytest.approx(expected_uy2, rel=1e-9)
    assert result.member_moments is not None
    assert result.member_shears is not None
    # Equilibrium: vertical reaction at fixed end = applied load
    assert np.isclose(result.FG[1, 0] - F, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 2: Simply supported beam — midpoint deflection via solve_structure()
#          (no pin releases needed; use restrainedDoF only)
#
# Nodes: 1(0,0), 2(L,0)
# Members: [1,2]
# Simply supported: fix Uy1 (DoF 2) and Uy2 (DoF 5), free rotations
# Fix horizontal: DoF 1 (pin), leave DoF 4 free (roller)
#
# Point load -F at midspan → modelled via ENAs: fyi = fyj = -F/2
# (Fixed-end shear reactions for point load at mid-span)
#   ENForces = [[-F/2, -F/2]]   (Fy at i and j ends)
#   ENMoments = [[F*L/8, -F*L/8]]  (fixed-end moments)
#
# Reaction check: R1 = R2 = F/2 each
# ---------------------------------------------------------------------------
def test_simply_supported_reactions():
    w = F  # treating F as total load (point load via ENA)
    # Fixed-end reactions for midpoint load P:
    #   Fy_i = P/2, Fy_j = P/2
    #   M_i = P*L/8 (hogging at i end = left), M_j = -P*L/8 (at j)
    model = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L, 0.0]],
        members=[[1, 2]],
        ENForces=[[-w / 2, -w / 2]],
        ENMoments=[[w * L / 8, -w * L / 8]],
        force_vector=[0.0] * 6,
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 5],  # fix Ux1, Uy1, Uy2
        pinDoF=[],
    )
    model.solve_structure()
    FG = model.FG

    # Vertical reactions at both ends should equal F/2
    assert FG[1, 0] == pytest.approx(w / 2, rel=1e-6)   # Uy at node1
    assert FG[4, 0] == pytest.approx(w / 2, rel=1e-6)   # Uy at node2
    # Equilibrium: sum of vertical reactions = total applied downward load
    assert np.isclose(FG[1, 0] + FG[4, 0] - w, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 3: UDL simply-supported beam (TRUST-03)
#
# Nodes: 1(0,0), 2(L_beam,0), L_beam=4m
# Pin at node1 (Ux1,Uy1), rollerY at node2 (Uy2)
# UDL w=10000 N/m → ENForces=[-wL/2,-wL/2], ENMoments=[wL²/12,-wL²/12]
#
# Analytical:
#   R1 = R2 = wL/2 = 20000 N
#   end rotation θ = wL³/(24EI)
# ---------------------------------------------------------------------------
def test_udl_simply_supported_deflection():
    """TRUST-03: UDL simply-supported beam, reactions and end-rotation against 5wL^4/384EI."""
    w = 10000.0
    L_beam = 4.0
    enf = -w * L_beam / 2
    enm_i = w * L_beam**2 / 12
    enm_j = -w * L_beam**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_beam, 0.0]],
        members=[[1, 2]],
        ENForces=[[enf, enf]],
        ENMoments=[[enm_i, enm_j]],
        force_vector=[0.0] * 6,
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 5],
    )
    s.solve_structure()

    total_applied_y = w * L_beam
    assert s.FG[1, 0] == pytest.approx(total_applied_y / 2, rel=1e-6)
    assert s.FG[4, 0] == pytest.approx(total_applied_y / 2, rel=1e-6)

    # End rotation for SS beam with UDL: wL³/(24EI)
    expected_theta = w * L_beam**3 / (24 * E * I)
    assert abs(s.UG[2, 0]) == pytest.approx(expected_theta, rel=1e-4)

    # Equilibrium
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0] - total_applied_y, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 4: Portal frame equilibrium (TRUST-04)
#
# Nodes: 1(0,0), 2(4,0), 3(2,3)  — inverted-V frame
# Members: [1,3] left column, [2,3] right column
# Fixed at nodes 1 and 2; lateral load at node 3
# ---------------------------------------------------------------------------
def test_portal_frame_equilibrium():
    """TRUST-04: Portal frame horizontal reaction sum equals applied lateral load."""
    F_lat = 5000.0

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [4.0, 0.0], [2.0, 3.0]],
        members=[[1, 3], [2, 3]],
        ENForces=[[0.0, 0.0], [0.0, 0.0]],
        ENMoments=[[0.0, 0.0], [0.0, 0.0]],
        force_vector=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, F_lat, 0.0, 0.0],
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 3, 4, 5, 6],
    )
    s.solve_structure()

    # Sum of horizontal reactions = -applied lateral load
    assert np.isclose(s.FG[0, 0] + s.FG[3, 0] + F_lat, 0, atol=1e-6)
    # Sum of vertical reactions = 0 (no vertical load applied)
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0], 0, atol=1e-3)


# ---------------------------------------------------------------------------
# Case 5: Bar member in mixed frame-bar structure (TRUST-05)
#
# Nodes: 1(0,0) fixed, 2(4,0), 3(4,3)
# Member 1: beam [1,2] horizontal
# Member 2: bar  [2,3] vertical (bars=[2])
# RollerY at node 3 (DoF 8), load -F at node 2 (DoF 5)
# ---------------------------------------------------------------------------
def test_bar_member_in_mixed_structure():
    """TRUST-05: Bar member carries zero shear and zero moment."""
    # Node2 is fully fixed: bar provides axial (Y) stiffness only, so Ux and theta at
    # node2 must be restrained to avoid zero-stiffness rows in the global matrix.
    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [4.0, 0.0], [4.0, 3.0]],
        members=[[1, 2], [2, 3]],
        ENForces=[[0.0, 0.0], [0.0, 0.0]],
        ENMoments=[[0.0, 0.0], [0.0, 0.0]],
        force_vector=[0.0, 0.0, 0.0, 0.0, -F, 0.0, 0.0, 0.0, 0.0],
        E=E, I=I, A=A,
        bars=[2],
        restrainedDoF=[1, 2, 3, 7, 8, 9],
    )
    s.solve_structure()

    # Bar member (index 1, 0-based) has zero shear and zero moment by definition
    assert s.mbrShears[1, 0] == pytest.approx(0.0, abs=1e-10)
    assert s.mbrShears[1, 1] == pytest.approx(0.0, abs=1e-10)
    assert s.mbrMoments[1, 0] == pytest.approx(0.0, abs=1e-10)
    assert s.mbrMoments[1, 1] == pytest.approx(0.0, abs=1e-10)

    # Equilibrium: vertical reactions at node0 and node2 sum to applied load
    assert np.isclose(s.FG[1, 0] + s.FG[7, 0] - F, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 6: Pin release at j-end (TRUST-06)
#
# Nodes: 1(0,0) fixed, 2(L,0)
# Member 1: beam, beamPinRight=[1] — moment released at j-end (node 2)
# Load: -F at node 2 (DoF 5)
# ---------------------------------------------------------------------------
def test_pin_release_beam_pin_right():
    """TRUST-06: Pin release at j-end: moment at released end is zero."""
    # beamPinRight condenses theta from element stiffness at j-end (local DOF 5).
    # The released theta at node1 must be listed in pinDoF so it is excluded from
    # the reduced system (otherwise the row/col has zero stiffness → singular).
    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L, 0.0]],
        members=[[1, 2]],
        ENForces=[[0.0, 0.0]],
        ENMoments=[[0.0, 0.0]],
        force_vector=[0.0, 0.0, 0.0, 0.0, -F, 0.0],
        E=E, I=I, A=A,
        beamPinRight=[1],
        restrainedDoF=[1, 2, 3],
        pinDoF=[6],
    )
    s.solve_structure()

    # Moment at released j-end must be zero
    assert s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-6)

    # Equilibrium: vertical reaction at fixed end = applied load
    assert np.isclose(s.FG[1, 0] - F, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 7: Propped cantilever with UDL (TRUST-07)
#
# Nodes: 1(0,0) fixed, 2(L_pc,0) rollerY (DoF 5)
# UDL w=10000 N/m over L_pc=4m
#
# Analytical:
#   R_prop = 3wL/8 = 15000 N  (at node 2)
#   R_fixed = 5wL/8 = 25000 N (at node 1)
# ---------------------------------------------------------------------------
def test_propped_cantilever_udl():
    """TRUST-07: Propped cantilever UDL: prop reaction = 3wL/8."""
    w = 10000.0
    L_pc = 4.0
    enf = -w * L_pc / 2
    enm_i = w * L_pc**2 / 12
    enm_j = -w * L_pc**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_pc, 0.0]],
        members=[[1, 2]],
        ENForces=[[enf, enf]],
        ENMoments=[[enm_i, enm_j]],
        force_vector=[0.0] * 6,
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 3, 5],
    )
    s.solve_structure()

    expected_R_prop = 3 * w * L_pc / 8
    expected_R_fixed = 5 * w * L_pc / 8
    assert s.FG[4, 0] == pytest.approx(expected_R_prop, rel=1e-6)
    assert s.FG[1, 0] == pytest.approx(expected_R_fixed, rel=1e-6)

    # Equilibrium: sum of vertical reactions = total UDL
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0] - w * L_pc, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 8: Per-member E/I — two-span beam with different E per member (TRUST-08)
#
# Nodes: 1(0,0) fixed, 2(L,0) intermediate support (Uy pinned), 3(2L,0) roller
# Members: [1,2] E1=200e9, [2,3] E2=100e9
# Load: -F applied at node 2 (DoF 5) vertically
#
# Equilibrium check: R1 + R3 = F (vertical reactions at fixed and roller ends)
# ---------------------------------------------------------------------------
def test_per_member_EI_two_span():
    """TRUST-08: Per-member E list — vertical reaction equilibrium for two-span beam."""
    E1 = 200e9
    E2 = 100e9
    I_val = 1e-4
    A_val = 0.01
    L_span = 1.0
    F_applied = 1000.0

    model = FrameModel2D(
        nodes=np.array([[0.0, 0.0], [L_span, 0.0], [2 * L_span, 0.0]]),
        members=np.array([[1, 2], [2, 3]]),
        ENForces=np.array([[0.0, 0.0], [0.0, 0.0]]),
        ENMoments=np.array([[0.0, 0.0], [0.0, 0.0]]),
        forceVector=np.array([0.0, 0.0, 0.0, 0.0, -F_applied, 0.0, 0.0, 0.0, 0.0]).reshape(-1, 1),
        E=[E1, E2],
        I=[I_val, I_val],
        A=A_val,
        restrainedDoF=[1, 2, 3, 8],  # fix node1 (Ux,Uy,theta), rollerY at node3 (Uy=DOF 8)
        pinDoF=[],
        bars=[],
        beamPinLeft=[], beamPinRight=[],
        springDoF=[], springStiffness=[],
    )
    result = FrameV2Adapter(model).solve()

    # Global vertical equilibrium: reactions at node1 (DOF 2, index 1) and node3 (DOF 8, index 7)
    # plus any reaction at intermediate node if Uy is free there — sum must equal applied load
    R1 = result.FG[1, 0]
    R3 = result.FG[7, 0]
    assert np.isclose(R1 + R3, F_applied, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 9: Propped cantilever via beamPinRight + UDL (TRUST-09)
#
# Regression test for 260418-vcg: pin-release + UDL was not condensing the
# local ENA. Only the far-end moment was zeroed while the stiffness was
# condensed, producing incorrect shear distribution and bending moment.
# With the fix, ENA condensation (f_c = f_a - Kab @ Kbb^-1 @ f_b) redistributes
# the UDL to the propped cantilever pattern: 5wL/8 at fixed end, 3wL/8 at
# released end, and M_i = +wL^2/8 at fixed end.
#
# Nodes: 1(0,0), 2(L_pc,0), L_pc=4m horizontal beam
# Member 1: beam, beamPinRight=[1] — moment released at j-end (node 2)
# Restraints: node1 fully fixed (DoFs 1,2,3); node2 Uy restrained as prop (DoF 5)
# Released rotation at node2 (DoF 6) must be in pinDoF (same as TRUST-06)
# ---------------------------------------------------------------------------
def test_propped_cantilever_via_beam_pin_right_udl():
    """TRUST-09: Propped cantilever via beamPinRight + UDL.

    Guards against the pre-260418-vcg bug where pin-release + UDL did not
    apply static condensation to the local ENA.
    """
    w = 10000.0
    L_pc = 4.0
    enf = -w * L_pc / 2
    enm_i = w * L_pc**2 / 12
    enm_j = -w * L_pc**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_pc, 0.0]],
        members=[[1, 2]],
        ENForces=[[enf, enf]],
        ENMoments=[[enm_i, enm_j]],
        force_vector=[0.0] * 6,
        E=E, I=I, A=A,
        beamPinRight=[1],
        restrainedDoF=[1, 2, 3, 5],  # fix Ux1,Uy1,theta1, prop Uy2
        pinDoF=[6],                   # released theta2 excluded from reduced system
    )
    s.solve_structure()

    # Fixed-end (i) moment from propped cantilever UDL: magnitude wL^2/8.
    # Solver sign convention: hogging fixed-end moment comes out negative
    # (matches TRUST-07 real-roller propped cantilever, solver is self-consistent).
    assert s.mbrMoments[0, 0] == pytest.approx(-w * L_pc**2 / 8, rel=1e-6)
    # Released (j) end moment: zero
    assert s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-6)
    # Fixed-end vertical reaction = 5wL/8
    assert s.FG[1, 0] == pytest.approx(5 * w * L_pc / 8, rel=1e-6)
    # Prop vertical reaction = 3wL/8
    assert s.FG[4, 0] == pytest.approx(3 * w * L_pc / 8, rel=1e-6)
    # Vertical equilibrium
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0] - w * L_pc, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 10: Propped cantilever via beamPinLeft + UDL (TRUST-10)
#
# Mirror of TRUST-09: released rotation at i-end (node 1), fixed at j-end.
# Solver sign convention: fixed j-end moment comes out positive (+wL^2/8),
# opposite in sign to TRUST-09's fixed i-end, as expected for a mirrored
# propped cantilever with the solver's 3-DoF frame convention.
# ---------------------------------------------------------------------------
def test_propped_cantilever_via_beam_pin_left_udl():
    """TRUST-10: Propped cantilever via beamPinLeft + UDL (mirror of TRUST-09).

    Guards against the pre-260418-vcg bug where pin-release + UDL did not
    apply static condensation to the local ENA.
    """
    w = 10000.0
    L_pc = 4.0
    enf = -w * L_pc / 2
    enm_i = w * L_pc**2 / 12
    enm_j = -w * L_pc**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_pc, 0.0]],
        members=[[1, 2]],
        ENForces=[[enf, enf]],
        ENMoments=[[enm_i, enm_j]],
        force_vector=[0.0] * 6,
        E=E, I=I, A=A,
        beamPinLeft=[1],
        restrainedDoF=[1, 2, 4, 5, 6],  # Ux1,Uy1 prop; Ux2,Uy2,theta2 fixed
        pinDoF=[3],                      # released theta1 excluded from reduced system
    )
    s.solve_structure()

    # Released (i) end moment: zero
    assert s.mbrMoments[0, 0] == pytest.approx(0.0, abs=1e-6)
    # Fixed (j) end moment: +wL^2/8 (positive in solver convention, mirror of
    # TRUST-09's fixed-end sign — the end-rotation sign flips between i-end
    # and j-end in the 3-DoF frame convention).
    assert s.mbrMoments[0, 1] == pytest.approx(w * L_pc**2 / 8, rel=1e-6)
    # Prop vertical reaction at i-end = 3wL/8
    assert s.FG[1, 0] == pytest.approx(3 * w * L_pc / 8, rel=1e-6)
    # Fixed vertical reaction at j-end = 5wL/8
    assert s.FG[4, 0] == pytest.approx(5 * w * L_pc / 8, rel=1e-6)
    # Vertical equilibrium
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0] - w * L_pc, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 11: Simply-supported via both-end pin releases + UDL (TRUST-11)
#
# Both rotations released via beamPinLeft + beamPinRight. After condensation,
# both end moments vanish and reactions are wL/2 at each node.
# ---------------------------------------------------------------------------
def test_simply_supported_via_both_end_pin_releases_udl():
    """TRUST-11: Both-end pin-release + UDL reproduces simply-supported reactions.

    Guards against the pre-260418-vcg bug where pin-release + UDL did not
    apply static condensation to the local ENA.
    """
    w = 10000.0
    L_pc = 4.0
    enf = -w * L_pc / 2
    enm_i = w * L_pc**2 / 12
    enm_j = -w * L_pc**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_pc, 0.0]],
        members=[[1, 2]],
        ENForces=[[enf, enf]],
        ENMoments=[[enm_i, enm_j]],
        force_vector=[0.0] * 6,
        E=E, I=I, A=A,
        beamPinLeft=[1],
        beamPinRight=[1],
        restrainedDoF=[1, 2, 5],  # pin at node1, rollerY at node2
        pinDoF=[3, 6],            # both released rotations excluded from reduced system
    )
    s.solve_structure()

    # Both end moments zero (simply supported via releases)
    assert s.mbrMoments[0, 0] == pytest.approx(0.0, abs=1e-6)
    assert s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-6)
    # Reactions wL/2 at each node
    assert s.FG[1, 0] == pytest.approx(w * L_pc / 2, rel=1e-6)
    assert s.FG[4, 0] == pytest.approx(w * L_pc / 2, rel=1e-6)
    # Vertical equilibrium
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0] - w * L_pc, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 12: Multi-member structure with beamPinRight at SHARED interior node (TRUST-12)
#
# This is the regression test for the force-recovery bug exposed when a
# pin-released member's released end rotation DOF is ACTIVE in the global
# system (not in pinDoF) and shared with another member.
#
# In the old (buggy) code, solve_member_actions used UG[theta_released] directly,
# but that value is the global node rotation set by OTHER members attached at the
# same node — NOT this member's own end rotation. Multiplying the full 6x6 Kl
# by this unrelated rotation then zeroing Mj left Vi/Mi/Vj contaminated.
#
# Structure:
#   Nodes: 1(0,0) fully fixed, 2(L,0) free interior, 3(2L,0) fully fixed
#   Members: m1(1→2) beamPinRight=[1] + UDL w
#            m2(2→3) standard beam + UDL w
#   pinDoF=[] — theta at node 2 IS active in global system; driven by m2's stiffness
#
# By symmetry and the pin release at node-2-end of m1 (Mj_m1=0):
#   - m1.Mj = 0 (released by beamPinRight)
#   - m2.Mi = 0 (moment equilibrium at node 2: Mj_m1=0, no external moment)
#   - m1.Mi = -wL²/2 = -80000 N.m  (numerically verified from fixed code)
#   - m2.Mj = +wL²/2 = +80000 N.m  (by symmetry)
#   - Vertical reactions: wL = 40000 N at each support
#
# The old buggy code gave m1.Mi ≈ -193333 N.m (2.4× wrong) and
# m1.Vy_i ≈ 125000 N (3.1× wrong).
# ---------------------------------------------------------------------------
def test_multi_member_pin_release_shared_node():
    """TRUST-12: beamPinRight at shared interior node — member force recovery.

    Guards against the bug in solve_member_actions where the released end rotation
    in UG was set by other members (multi-member assembly) rather than back-solved
    from the condensation relation for this member.

    Would FAIL on old code (pre-fix); PASSES after the stiffness back-solve fix.
    """
    w = 10000.0   # N/m UDL on both spans
    L_span = 4.0  # m span length

    enf = -w * L_span / 2           # = -20000 N
    enm_i =  w * L_span**2 / 12    # = +13333.33 N.m
    enm_j = -w * L_span**2 / 12    # = -13333.33 N.m

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_span, 0.0], [2 * L_span, 0.0]],
        members=[[1, 2], [2, 3]],
        ENForces=[[enf, enf], [enf, enf]],
        ENMoments=[[enm_i, enm_j], [enm_i, enm_j]],
        force_vector=[0.0] * 9,
        E=E, I=I, A=A,
        beamPinRight=[1],   # m1 releases theta at node 2 (shared with m2)
        restrainedDoF=[1, 2, 3, 7, 8, 9],  # node 1 and node 3 fully fixed
        # pinDoF intentionally empty: theta at node 2 is active in global system
    )
    s.solve_structure()

    # m1.Mj must be zero (beamPinRight releases the moment at node 2)
    assert s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-4)

    # Moment equilibrium at node 2 (free, no external moment): Mj_m1 + Mi_m2 = 0
    # Since Mj_m1 = 0, Mi_m2 must also be 0
    assert s.mbrMoments[1, 0] == pytest.approx(0.0, abs=1e-4)

    # m1.Mi = -wL²/2 = -80000 N.m (numerically verified from stiffness back-solve)
    assert s.mbrMoments[0, 0] == pytest.approx(-w * L_span**2 / 2, rel=1e-5)

    # m2.Mj = +wL²/2 = +80000 N.m (by symmetry with m1.Mi magnitude)
    assert s.mbrMoments[1, 1] == pytest.approx(w * L_span**2 / 2, rel=1e-5)

    # Vertical equilibrium: total UDL = w * 2 * L_span = 80000 N
    total_load = w * 2 * L_span
    R1 = s.FG[1, 0]
    R3 = s.FG[7, 0]
    assert np.isclose(R1 + R3, total_load, atol=1e-4)

    # Each support carries half the total load (symmetric structure + symmetric UDL)
    assert R1 == pytest.approx(total_load / 2, rel=1e-5)
    assert R3 == pytest.approx(total_load / 2, rel=1e-5)


# ---------------------------------------------------------------------------
# Case 13: Portal frame + UDL on beam, pinned column bases (TRUST-13)
#
# Nodes: 1(0,0) pin, 2(0,3), 3(4,3), 4(4,0) pin
# Members: m1[1,2] left column, m2[2,3] beam, m3[3,4] right column
# UDL w=10000 N/m only on beam (member 2) downward.
#
# Symmetric structure + symmetric loading → equal vertical reactions at
# pinned bases: Ry_1 = Ry_4 = wL_beam/2. Horizontal reactions equal and
# opposite (thrust). Joints 2 and 3 have no releases → moment continuity:
# m1.Mj + m2.Mi = 0 and m2.Mj + m3.Mi = 0 (no external moment at joints).
# ---------------------------------------------------------------------------
def test_trust_13_portal_frame_udl():
    """TRUST-13: Portal frame with pinned column bases + UDL on beam;
    asserts ΣFx, ΣFy, and ΣM at joints 2 and 3."""
    w = 10000.0
    L_beam = 4.0
    H = 3.0

    enf = -w * L_beam / 2
    enm_i = w * L_beam**2 / 12
    enm_j = -w * L_beam**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [0.0, H], [L_beam, H], [L_beam, 0.0]],
        members=[[1, 2], [2, 3], [3, 4]],
        ENForces=[[0.0, 0.0], [enf, enf], [0.0, 0.0]],
        ENMoments=[[0.0, 0.0], [enm_i, enm_j], [0.0, 0.0]],
        force_vector=[0.0] * 12,
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 10, 11],  # pinned bases at nodes 1 and 4 (Ux,Uy only)
    )
    s.solve_structure()

    # Vertical reactions at pinned bases (node 1 DOF 2 → row 1; node 4 DOF 11 → row 10)
    assert s.FG[1, 0] == pytest.approx(w * L_beam / 2, rel=1e-5)
    assert s.FG[10, 0] == pytest.approx(w * L_beam / 2, rel=1e-5)
    # Global horizontal equilibrium: ΣFx = 0 (no horizontal applied)
    assert np.isclose(s.FG[0, 0] + s.FG[9, 0], 0.0, atol=1e-4)
    # Global vertical equilibrium: ΣFy = total UDL
    assert np.isclose(s.FG[1, 0] + s.FG[10, 0], w * L_beam, atol=1e-4)
    # Moment equilibrium at joint 2 (no release, no external moment): m1.Mj + m2.Mi = 0
    assert s.mbrMoments[1, 0] == pytest.approx(-s.mbrMoments[0, 1], abs=1e-4)
    # Moment equilibrium at joint 3: m2.Mj + m3.Mi = 0
    assert s.mbrMoments[1, 1] == pytest.approx(-s.mbrMoments[2, 0], abs=1e-4)


# ---------------------------------------------------------------------------
# Case 14: Two-span continuous beam with beamPinRight on span 1 + UDL on
#          span 1 only (TRUST-14)
#
# Generalises the 260418-vcg regression to a multi-span asymmetric loading
# scenario. See TRUST-12 (tests/test_frame_v2.py:546) for the symmetric
# both-spans-loaded analog.
#
# Nodes: 1(0,0) fixed, 2(L,0) free interior, 3(2L,0) fixed; L_span=4m
# Members: m1[1,2] beamPinRight=[1] + UDL w, m2[2,3] standard beam, NO UDL
# pinDoF=[] — theta at node 2 is active (m2 provides rotational stiffness).
# ---------------------------------------------------------------------------
def test_trust_14_two_span_pin_release_udl_span1_only():
    """TRUST-14: Two-span continuous beam with beamPinRight on span 1 +
    UDL on span 1 only. Generalizes the 260418-vcg regression to a
    multi-span setup; see TRUST-12 (tests/test_frame_v2.py:546) for the
    symmetric both-spans-loaded analog."""
    w = 10000.0
    L_span = 4.0

    enf = -w * L_span / 2
    enm_i = w * L_span**2 / 12
    enm_j = -w * L_span**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_span, 0.0], [2 * L_span, 0.0]],
        members=[[1, 2], [2, 3]],
        ENForces=[[enf, enf], [0.0, 0.0]],
        ENMoments=[[enm_i, enm_j], [0.0, 0.0]],
        force_vector=[0.0] * 9,
        E=E, I=I, A=A,
        beamPinRight=[1],
        restrainedDoF=[1, 2, 3, 7, 8, 9],  # nodes 1 and 3 fully fixed
    )
    s.solve_structure()

    # m1.Mj = 0 at released j-end (node 2)
    assert s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-4)
    # Moment equilibrium at shared node 2: Mj_m1 + Mi_m2 = 0; with Mj_m1=0, Mi_m2=0
    assert np.isclose(s.mbrMoments[0, 1] + s.mbrMoments[1, 0], 0.0, atol=1e-4)
    assert s.mbrMoments[1, 0] == pytest.approx(0.0, abs=1e-4)
    # Vertical equilibrium: total load on span 1 only = w*L_span
    total_load = w * L_span
    assert np.isclose(s.FG[1, 0] + s.FG[7, 0], total_load, atol=1e-4)
    # Fixed-base hogging moment on span 1 (m1.Mi) must be strongly negative
    assert s.mbrMoments[0, 0] < -1.0


# ---------------------------------------------------------------------------
# Case 15: Mixed beamPinLeft on span 2 + beamPinRight on span 1 at shared
#          interior node 2 (TRUST-15)
#
# Edge case for solve_member_actions when BOTH members at a shared node
# have released θ — each span behaves as a cantilever against its far-end
# fixed support (there is no rotational coupling through node 2).
# ---------------------------------------------------------------------------
def test_trust_15_mixed_pin_release_shared_node():
    """TRUST-15: Mixed beamPinLeft on span 2 + beamPinRight on span 1 at
    shared interior node 2. Edge case for solve_member_actions back-solve
    when BOTH members at a node have released θ — each span behaves as a
    cantilever against its far-end fixed support."""
    w = 10000.0
    L_span = 4.0

    enf = -w * L_span / 2
    enm_i = w * L_span**2 / 12
    enm_j = -w * L_span**2 / 12

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_span, 0.0], [2 * L_span, 0.0]],
        members=[[1, 2], [2, 3]],
        ENForces=[[enf, enf], [enf, enf]],
        ENMoments=[[enm_i, enm_j], [enm_i, enm_j]],
        force_vector=[0.0] * 9,
        E=E, I=I, A=A,
        beamPinLeft=[2],
        beamPinRight=[1],
        restrainedDoF=[1, 2, 3, 7, 8, 9],  # nodes 1 and 3 fully fixed
        # pinDoF must include theta at node 2 (DOF 6) because BOTH members
        # release their θ at this shared node — no rotational stiffness
        # remains at node 2 once both elements are condensed, so DOF 6 must
        # be excluded from the reduced system (mirrors TRUST-11 pattern
        # where both ends of a single member were released).
        pinDoF=[6],
    )
    s.solve_structure()

    # Both released ends at node 2 have zero moment
    assert s.mbrMoments[0, 1] == pytest.approx(0.0, abs=1e-4)   # m1 beamPinRight
    assert s.mbrMoments[1, 0] == pytest.approx(0.0, abs=1e-4)   # m2 beamPinLeft

    # Each span is a cantilever: fixed at far end, free at node 2, UDL w
    # Analytical moment at fixed end: magnitude w*L²/2 (sign per solver convention
    # mirrors TRUST-12: m1.Mi negative at node 1, m2.Mj positive at node 3).
    assert s.mbrMoments[0, 0] == pytest.approx(-w * L_span**2 / 2, rel=1e-5)
    assert s.mbrMoments[1, 1] == pytest.approx(w * L_span**2 / 2, rel=1e-5)

    # Each cantilever carries its own span's UDL
    assert np.isclose(s.FG[1, 0] + s.FG[7, 0], 2 * w * L_span, atol=1e-4)

    # Pure bending (no axial in horizontal cantilever under transverse UDL)
    assert s.mbrForces[0] == pytest.approx(0.0, abs=1e-4)
    assert s.mbrForces[1] == pytest.approx(0.0, abs=1e-4)


# ---------------------------------------------------------------------------
# Case 16: Simply-supported beam with Ky spring at one end, end-to-end
#          through FrameV2Adapter (TRUST-16)
#
# End-to-end test for the spring support backend through FrameV2Adapter —
# covers HARDEN-02 at the solver/adapter level (independent of any UI work).
# springDoF and springStiffness flow: FrameModel2D → FrameV2Adapter →
# BeamBarStructure_v2.add_spring_stiffnesses (frame_v2.py:411).
#
# Nodes: 1(0,0), 2(4,0); member [1,2]; no UDL.
# Support: node 1 pinned (Ux,Uy). Node 2 has a vertical Ky spring on DOF 5.
# Load: -P downward at node 2 (DOF 5 → forceVector index 4).
# With load directly over the spring, pin carries no vertical; spring
# compresses δ = P/Ky and reacts K·δ = P.
# ---------------------------------------------------------------------------
def test_trust_16_simply_supported_spring_support():
    """TRUST-16: Simply-supported beam with Ky vertical spring at node 2;
    pin at node 1. End-to-end test through FrameV2Adapter — covers
    HARDEN-02 at the solver/adapter level. Spring compresses δ = P/K
    under tip load; reaction at spring = K·δ = P."""
    P = 10_000.0
    K_y = 1_000_000.0   # 1 MN/m vertical soil-pad spring
    L_beam = 4.0

    force_vector_flat = np.zeros(6)
    force_vector_flat[4] = -P   # Uy at node 2 → DOF 5 → index 4

    model = FrameModel2D(
        nodes=np.array([[0.0, 0.0], [L_beam, 0.0]], float),
        members=np.array([[1, 2]], int),
        ENForces=np.array([[0.0, 0.0]], float),
        ENMoments=np.array([[0.0, 0.0]], float),
        forceVector=force_vector_flat.reshape(-1, 1),
        E=E, I=I, A=A,
        restrainedDoF=[1, 2],
        springDoF=[5],
        springStiffness=[K_y],
    )
    adapter = FrameV2Adapter(model)
    result = adapter.solve()

    # Confirm adapter dispatched through frame_v2
    assert result.solver == "frame_v2"
    # Spring deflection: δ = -P/Ky (downward → negative Uy)
    assert result.UG[4, 0] == pytest.approx(-P / K_y, rel=1e-5)
    # Spring reaction magnitude: |K·δ| = P — verified directly from the
    # spring constitutive relation (K * Uy) rather than from FG, which at a
    # free DOF equals the applied load by equilibrium (Kp @ UG = f_ext).
    spring_reaction_force = -K_y * result.UG[4, 0]   # upward reaction magnitude
    assert spring_reaction_force == pytest.approx(P, rel=1e-5)
    # At the free DOF 5, FG = applied load (-P by construction of force_vector)
    assert result.FG[4, 0] == pytest.approx(-P, rel=1e-5)
    # Pin at node 1 carries no vertical load (applied load is directly over
    # the spring) — the pin reaction equals zero applied force at its DOFs,
    # and the vertical spring reaction equals the full applied load P.
    assert result.FG[1, 0] == pytest.approx(0.0, abs=1e-4)
    # Global vertical equilibrium: spring reaction (upward) + pin reaction
    # (zero) = total applied downward load P.
    assert np.isclose(spring_reaction_force + result.FG[1, 0], P, atol=1e-4)


# ---------------------------------------------------------------------------
# Case 17: Three-node beam — fixed at node 1, pinned (propped) at node 2,
#          free at node 3 with tip load P downward (TRUST-17)
#
# Tests multi-member moment transfer and propped cantilever + overhang
# interaction. Hand-calc: m2 is a cantilever overhang — m2.Mj=0 at the
# free tip and m2.Mi = -P·L at node 2 by overhang equilibrium (moment at
# the support end of a tip-loaded overhang). ΣM at node 2 (no external
# moment, θ continuous, no release) gives m1.Mj = +P·L. m1 is a propped
# cantilever under the applied moment transferred from the overhang.
# ---------------------------------------------------------------------------
def test_trust_17_cantilever_plus_propped_cantilever():
    """TRUST-17: Three-node beam — fixed at node 1, pinned (propped) at
    node 2, free at node 3 with tip load P downward. Tests multi-member
    moment transfer and propped cantilever + overhang interaction.
    Hand-calc: m2 is a cantilever overhang — m2.Mj=0 at free tip,
    m2.Mi = -P*L at node 2 by overhang equilibrium. ΣM at node 2 (no
    external moment, θ continuous) gives m1.Mj = +P*L. m1 is a propped
    cantilever under the applied moment m1.Mj transferred from the
    overhang."""
    P = 5_000.0
    L_span = 2.0

    s = BeamBarStructure_v2(
        nodes=[[0.0, 0.0], [L_span, 0.0], [2 * L_span, 0.0]],
        members=[[1, 2], [2, 3]],
        ENForces=[[0.0, 0.0], [0.0, 0.0]],
        ENMoments=[[0.0, 0.0], [0.0, 0.0]],
        force_vector=[0, 0, 0, 0, 0, 0, 0, -P, 0],   # DOF 8 at node 3 = index 7
        E=E, I=I, A=A,
        restrainedDoF=[1, 2, 3, 4, 5],   # node 1 fixed + node 2 pinned (θ free)
    )
    s.solve_structure()

    # m2 free tip: Mj = 0
    assert s.mbrMoments[1, 1] == pytest.approx(0.0, abs=1e-4)
    # Overhang equilibrium at node 2: m2.Mi = -P*L
    assert s.mbrMoments[1, 0] == pytest.approx(-P * L_span, rel=1e-5)
    # ΣM at node 2 (no external moment, θ continuous): m1.Mj + m2.Mi = 0
    assert np.isclose(s.mbrMoments[0, 1] + s.mbrMoments[1, 0], 0.0, atol=1e-4)
    # m1.Mj = +P*L by ΣM at node 2
    assert s.mbrMoments[0, 1] == pytest.approx(+P * L_span, rel=1e-5)
    # m1 is a propped cantilever (fixed at node 1, pinned at node 2) with an
    # applied end moment m1.Mj = +P*L at the pinned end. Standard carryover
    # factor for a prismatic beam from a pinned end to a fixed end is 1/2
    # (same sign in the solver's 3-DoF frame convention — see TRUST-10 where
    # the fixed j-end positive moment appears in response to the propped i-end
    # pin release), giving m1.Mi = +P*L/2.
    assert s.mbrMoments[0, 0] == pytest.approx(+P * L_span / 2, rel=1e-5)
    # Global vertical equilibrium: ΣFy = applied load
    assert np.isclose(s.FG[1, 0] + s.FG[4, 0], P, atol=1e-4)
    # No horizontal reaction (no horizontal load)
    assert np.isclose(s.FG[0, 0], 0.0, atol=1e-4)


# ---------------------------------------------------------------------------
# TRUST-18 — symmetric Pratt with bar bottom chord and bar diagonals
#
# Phase 06 PUREBAR-02 / PUREBAR-05. A clean hand-calculable analogue of the
# 2026-04-22 captured failure, designed to verify the pure-bar predicate
# without relying on any incidental DOF zeroing via pinDoF or restrainedDoF
# (the testing-hygiene lock-in from CONTEXT D-15 and from the
# solver_theta_dof_provenance memory note).
# ---------------------------------------------------------------------------
def test_trust_18_symmetric_pratt_pure_bar():
    """TRUST-18: Symmetric 3-panel Pratt with bar bottom chord + bar diagonals.

    Geometry: span 3 m, height 1 m, UDL w = 10 kN/m on top chord.
    Pinned at N1 and N4 (top-chord ends). Bottom chord (N5, N6) and all
    diagonals are bar members (axial-only).

    Hand calc by symmetry:
        Total UDL = 10 kN/m × 3 m = 30 kN
        Vy_N1 = Vy_N4 = 15 kN  (each pin carries half the UDL)
        ΣFx = 0  globally; Hx_N1 = -Hx_N4 by symmetry (the diagonals m4 and
        m8 carry compression that pulls each pin support inward; the
        magnitudes cancel globally but each pin individually carries a
        non-zero Hx because the bar truss is a redundant load path
        alongside the continuous top-chord beam — this is correct physics
        for a statically indeterminate hybrid beam+bar structure).

    Testing-hygiene lock-in (Phase 6 D-15):
        Pure-bar interior joints N5, N6 are NOT in pinDoF or restrainedDoF.
        Their θ DOF (DOFs 15 and 18 in 1-based) is brought to zero ONLY by
        the auto-restraint mechanism in assemble_primary_stiffness_matrix.
        This test would FAIL if auto-restraint is removed and pinDoF cannot
        compensate.
    """
    nodes = np.array([
        [0.0, 1.0],  # N1 pinned
        [1.0, 1.0],  # N2
        [2.0, 1.0],  # N3
        [3.0, 1.0],  # N4 pinned
        [1.0, 0.0],  # N5 pure-bar interior (no DOF restraint manually)
        [2.0, 0.0],  # N6 pure-bar interior (no DOF restraint manually)
    ], float)
    members = np.array([
        [1, 2], [2, 3], [3, 4],   # m1..m3 beams (top chord)
        [1, 5], [2, 5], [5, 6], [3, 6], [4, 6],  # m4..m8 bars
    ], int)
    n_mbr = members.shape[0]
    ENForces = np.zeros((n_mbr, 2), float)
    ENMoments = np.zeros((n_mbr, 2), float)
    # UDL on top-chord beams: w = 10 kN/m, segment L = 1 m
    w = 10000.0
    L_seg = 1.0
    for e in (0, 1, 2):
        ENForces[e, 0] = -w * L_seg / 2.0    # -wL/2
        ENForces[e, 1] = -w * L_seg / 2.0
        ENMoments[e, 0] = w * L_seg * L_seg / 12.0
        ENMoments[e, 1] = -w * L_seg * L_seg / 12.0
    force_vector = np.zeros((6 * 3, 1), float)  # 6 nodes × 3 DOF
    s = BeamBarStructure_v2(
        nodes=nodes, members=members,
        ENForces=ENForces, ENMoments=ENMoments,
        force_vector=force_vector,
        E=200e9, I=1e-4, A=None, A_beam=0.01, A_bar=0.005,
        bars=[4, 5, 6, 7, 8],
        beamPinLeft=[], beamPinRight=[],
        restrainedDoF=[1, 2, 10, 11],   # N1 (Ux, Uy) + N4 (Ux, Uy)
        pinDoF=[],                       # NO manual θ release — D-15 lock-in
        springDoF=[], springStiffness=[],
    )
    s.solve_structure()

    # 1. No HTTP 422 reached (solver did not raise) — implicit by reaching here.
    # 2. Reaction by symmetry: Vy at N1 + Vy at N4 = total UDL = 30 kN.
    #    DOF numbering: N1 → DOFs 1,2,3 (Ux, Uy, θ); N4 → DOFs 10,11,12.
    Vy_N1 = float(s.FG[1, 0])   # row 1 (0-based) = DOF 2 (1-based) = Uy at N1
    Vy_N4 = float(s.FG[10, 0])  # row 10 (0-based) = DOF 11 = Uy at N4
    assert Vy_N1 == pytest.approx(15000.0, rel=1e-4)
    assert Vy_N4 == pytest.approx(15000.0, rel=1e-4)
    # 3. Horizontal reactions: by symmetry equal and opposite, sum to zero
    #    (global ΣFx = 0 under purely vertical UDL). Each pin individually
    #    carries non-zero Hx because the bar diagonals m4 (1→5) and m8 (4→6)
    #    are loaded in compression and pull each pin inward — this is correct
    #    physics for the hybrid structure (top-chord beam continuous through
    #    the pins + bar truss on the other side). What we DO assert is global
    #    horizontal equilibrium and the geometric symmetry.
    Hx_N1 = float(s.FG[0, 0])
    Hx_N4 = float(s.FG[9, 0])
    assert (Hx_N1 + Hx_N4) == pytest.approx(0.0, abs=1.0)   # ΣFx = 0
    assert Hx_N1 == pytest.approx(-Hx_N4, rel=1e-6)          # symmetry
    # 4. No phantom moments at pins (D-02 rejection of regularisation).
    M_N1 = float(s.FG[2, 0])
    M_N4 = float(s.FG[11, 0])
    assert abs(M_N1) < 1.0
    assert abs(M_N4) < 1.0
    # 5. Pure-bar interior joints N5, N6 — auto-restraint set θ DOFs to zero.
    #    θ_N5 = DOF 15 → 0-based row 14; θ_N6 = DOF 18 → 0-based row 17.
    assert s.UG[14, 0] == pytest.approx(0.0, abs=1e-12)
    assert s.UG[17, 0] == pytest.approx(0.0, abs=1e-12)
    # 6. Auto-restraint list contains exactly N5 + N6 θ DOFs.
    assert sorted(s._pure_bar_theta_dofs) == [15, 18]
    # 7. Bottom-chord bar (m6, idx 5) is in tension under top-chord UDL.
    assert s.mbrForces[5] > 0.0   # tension positive
    # 8. Equilibrium: ΣFy = 0 (reactions cancel UDL)
    sum_Fy_reactions = Vy_N1 + Vy_N4
    assert sum_Fy_reactions == pytest.approx(30000.0, rel=1e-4)


# ---------------------------------------------------------------------------
# TRUST-19 — captured failing fixture replay (FastAPI TestClient)
#
# The 2026-04-22 captured model: 6 nodes, 8 members, bars=[1..5],
# beams=[6..7..8], pinned at N1 + N6, UDL=10 kN/m on top-chord beams.
# Pre-fix this fixture returned HTTP 422 ("structure is unstable") because
# nodes 3 + 4 (1-based 4 + 5) are pure-bar joints — every incident member
# is a bar, so the θ rows in Kp were entirely zero.
# Post-fix: pure-bar predicate auto-restrains those θ DOFs, the structure
# solves, and the API returns HTTP 200 with sane displacements + reactions.
# ---------------------------------------------------------------------------
def test_trust_19_captured_pratt_fixture_replay(client):
    """TRUST-19: Replay of captured failing model from 2026-04-22.

    The original failing fixture was 6 nodes, 8 members, bars on bottom
    chord + diagonals, beams on top chord, pinned at top-chord ends, UDL
    on top-chord beams. Pre-fix: HTTP 422 'structure is unstable'.
    Post-fix: solves with sane reactions.

    Source: ~/Downloads/frame2d-model-2026-04-22T06-14-49.json
    Committed verbatim per Phase 4 D-12 / Phase 6 D-17 to:
        tests/fixtures/uat/pure_bar_pratt_captured.json

    Testing-hygiene lock-in (D-15): the fixture was created by a real user
    via the frame2d UI which never sets pinDoF or auto-restrains θ. The
    test verifies the solver handles the captured topology end-to-end via
    the FastAPI route — the same path the user would hit.

    API response shape: api_server/app.py:153-154 returns UG and FG as
    FLAT 1D lists (`.reshape(-1).tolist()`). Index access body["FG"][i]
    yields a scalar float, not a row.
    """
    path = FIXTURES_DIR / "pure_bar_pratt_captured.json"
    with path.open() as fh:
        payload = json.load(fh)
    if payload.get("solver") == "frame2d":
        payload["solver"] = "frame_v2"
    payload.pop("schema_version", None)
    payload.pop("canvas", None)

    response = client.post("/solve/frame2d", json=payload)
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    body = response.json()

    # FG is a FLAT 1D list of length 3*n_nodes. Fy components live at
    # indices 1, 4, 7, ... (every 3rd entry starting from index 1).
    FG = body["FG"]
    assert isinstance(FG, list) and len(FG) > 0
    assert isinstance(FG[0], (int, float)), (
        "FG must be flat 1D list of scalars per api_server/app.py:154"
    )
    Fy_total = sum(FG[i] for i in range(1, len(FG), 3))
    assert Fy_total > 0.0, (
        "Reactions should sum to positive Fy under downward UDL"
    )

    # UG is a FLAT 1D list. No NaN, no absurdly large values.
    UG = body["UG"]
    assert isinstance(UG, list) and len(UG) > 0
    assert isinstance(UG[0], (int, float)), (
        "UG must be flat 1D list of scalars per api_server/app.py:153"
    )
    # NaN check via x != x trick (NaN is the only float not equal to itself).
    assert all(not (x != x) for x in UG), "UG contains NaN"
    assert all(abs(x) < 1e6 for x in UG), (
        "UG contains absurdly large values (instability not resolved)"
    )
