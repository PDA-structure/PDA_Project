"""
Tests for the 2D frame/beam-bar solver (BeamBarStructure_v2).

Analytical reference cases:
  - Cantilever beam: tip deflection and rotation under point load
  - Fixed-fixed beam: midpoint deflection under UDL (via ENAs)
"""

import numpy as np
import pytest

from pda_analysis_software.solvers.frame_v2 import BeamBarStructure_v2
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter
from pda_analysis_software.models.frame2d_model import FrameModel2D


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
