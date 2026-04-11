"""
Tests for the 2D truss solver.

Analytical reference cases:
  - Single horizontal bar under axial load
  - Simple two-bar pinned truss under vertical load
"""

import numpy as np
import pytest

from pda_analysis_software.solvers.truss2d import Truss
from pda_analysis_software.adapters.truss_adapters import Truss2DAdapter
from pda_analysis_software.models.truss2d_model import TrussModel2D


# ---------------------------------------------------------------------------
# Case 1: Single horizontal bar, 1000 N axial tension
#
# Nodes:  1(0,0) -- 2(1,0)
# Fix:    DoF 1 (node1 x), DoF 2 (node1 y), DoF 4 (node2 y)
# Load:   1000 N in +x at node 2
#
# Expected:
#   UG[node2_x] = F*L / (E*A) = 1000*1 / (200e9 * 0.01) = 5e-7 m
#   member force = 1000 N (tension)
#   reactions:  node1_x = -1000 N, node1_y = 0, node2_y = 0
# ---------------------------------------------------------------------------
E = 200e9
A = 0.01
L = 1.0


@pytest.fixture
def horizontal_bar_truss():
    return Truss(
        nodes=[[0.0, 0.0], [L, 0.0]],
        members=[[1, 2]],
        E=E,
        A=A,
        forceVector=[0.0, 0.0, 1000.0, 0.0],
        restrainedDoF=[1, 2, 4],
    )


def test_truss_displacements(horizontal_bar_truss):
    t = horizontal_bar_truss
    t.solve_displacements()

    expected_u2x = 1000.0 * L / (E * A)  # 5e-7 m
    assert t.UG is not None
    assert t.UG.shape == (4, 1)
    assert t.UG[0, 0] == pytest.approx(0.0)       # node1 x — fixed
    assert t.UG[1, 0] == pytest.approx(0.0)       # node1 y — fixed
    assert t.UG[2, 0] == pytest.approx(expected_u2x, rel=1e-9)  # node2 x — free
    assert t.UG[3, 0] == pytest.approx(0.0)       # node2 y — fixed
    # Equilibrium: horizontal reaction at node1 = -applied load
    FG = t.solve_reactions()
    assert np.isclose(FG[0, 0] + 1000.0, 0, atol=1e-6)


def test_truss_member_forces(horizontal_bar_truss):
    t = horizontal_bar_truss
    t.solve_displacements()
    t.solve_member_forces()

    assert t.mbrForces is not None
    assert len(t.mbrForces) == 1
    assert t.mbrForces[0] == pytest.approx(1000.0, rel=1e-9)
    # Equilibrium: horizontal reaction at node1 = -applied load
    FG = t.solve_reactions()
    assert np.isclose(FG[0, 0] + 1000.0, 0, atol=1e-6)


def test_truss_reactions(horizontal_bar_truss):
    t = horizontal_bar_truss
    t.solve_displacements()
    FG = t.solve_reactions()

    assert FG[0, 0] == pytest.approx(-1000.0, rel=1e-9)  # node1 x reaction
    assert FG[1, 0] == pytest.approx(0.0, abs=1e-6)      # node1 y reaction
    assert FG[3, 0] == pytest.approx(0.0, abs=1e-6)      # node2 y reaction
    # Equilibrium: horizontal reaction at node1 = -applied load
    assert np.isclose(FG[0, 0] + 1000.0, 0, atol=1e-6)


def test_truss_adapter_pipeline():
    """Verify the full adapter pipeline (as called by the API) on the horizontal bar."""
    model = TrussModel2D(
        nodes=np.array([[0.0, 0.0], [L, 0.0]]),
        members=np.array([[1, 2]]),
        E=E,
        A=A,
        forceVector=np.array([0.0, 0.0, 1000.0, 0.0]),
        restrainedDoF=[1, 2, 4],
    )
    result = Truss2DAdapter(model).solve()

    expected_u2x = 1000.0 * L / (E * A)
    assert result.solver == "truss2d"
    assert result.UG[2, 0] == pytest.approx(expected_u2x, rel=1e-9)
    assert result.member_forces[0] == pytest.approx(1000.0, rel=1e-9)
    # Equilibrium: horizontal reaction at node1 = -applied load
    assert np.isclose(result.FG[0, 0] + 1000.0, 0, atol=1e-6)


# ---------------------------------------------------------------------------
# Case 2: Statically determinate two-bar truss under vertical load
#
# Nodes:  1(0,0), 2(2,0), 3(1,1)
# Members: 1-3, 2-3
# Fix:    node1 fully (DoF 1,2), node2 y-direction (DoF 4)
# Load:   -10000 N (downward) at node3 y-direction (DoF 6)
#
# Geometry:
#   member 1-3: angle = atan2(1,1) = 45 deg, L = sqrt(2)
#   member 2-3: angle = atan2(1,-1) = 135 deg, L = sqrt(2)
#
# By symmetry and equilibrium:
#   R1y = R2y = 5000 N (vertical reactions, upward)
#   Reaction at node1_x = 0, node2_x is free
#
# Member forces (axial):
#   Both members carry F/sin(45) / 2 = 5000 / sin(45) = 7071.07 N
#   Member 1-3: compression (force negative in i→j convention depends on sign)
#   Member 2-3: compression
#
# In this solver tension is positive. The vertical load -10000N requires
# the members to be in compression to provide upward support.
# ---------------------------------------------------------------------------
def test_two_bar_truss_equilibrium():
    # 3 nodes, 2 members: m + r = 2n → 2 + 4 = 6 ✓
    # Node 1 (0,0): pin (DoF 1,2); Node 2 (2,0): pin (DoF 3,4); Node 3 (1,1): free
    t = Truss(
        nodes=[[0.0, 0.0], [2.0, 0.0], [1.0, 1.0]],
        members=[[1, 3], [2, 3]],
        E=200e9,
        A=0.01,
        forceVector=[0.0, 0.0, 0.0, 0.0, 0.0, -10000.0],
        restrainedDoF=[1, 2, 3, 4],
    )
    t.solve_displacements()
    t.solve_member_forces()
    FG = t.solve_reactions()

    # Sum of vertical reactions must equal applied load magnitude
    R1y = FG[1, 0]  # node1 y-reaction (DoF 2)
    R2y = FG[3, 0]  # node2 y-reaction (DoF 4)
    assert R1y + R2y == pytest.approx(10000.0, rel=1e-6)

    # By symmetry, equal reactions
    assert R1y == pytest.approx(5000.0, rel=1e-6)
    assert R2y == pytest.approx(5000.0, rel=1e-6)

    # Both members carry the same axial load
    assert abs(t.mbrForces[0]) == pytest.approx(abs(t.mbrForces[1]), rel=1e-6)
    # Equilibrium: sum of vertical reactions = applied downward load
    assert np.isclose(FG[1, 0] + FG[3, 0] - 10000.0, 0, atol=1e-6)


import math
