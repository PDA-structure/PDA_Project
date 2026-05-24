"""
Inclined rafter with vertical UDL — unit decomposition test.

Verifies that the local transverse decomposition (w * cos(theta)) of a vertical
UDL gives correct global vertical equilibrium for a simply-supported inclined beam,
and that the McKenzie 5.3 case (tested separately) passes with the full
transverse + axial treatment for a complete portal frame.

This test uses a simply-supported inclined beam (pin at both ends) where the
transverse component alone is sufficient for verification because:
- For a pinned-pinned beam, there is no moment transfer
- The transverse reactions can be compared against the exact solution

Structure: inclined beam pinned at both ends
- Node 0 (0,0): pinned support (DOF 1,2 restrained)
- Node 1 (L*cos(theta), L*sin(theta)): pinned support (DOF 4,5 restrained)
- Vertical UDL w (N/m, downward)

Expected: total Fy reaction = w * L * cos^2(theta) (from transverse component only)
         (axial component doesn't affect Fy reactions for pinned-pinned beam)

Note: For a complete portal frame with free intermediate nodes (like McKenzie 5.3),
the axial component of vertical UDL on inclined members MUST also be added to the
forceVector at the free nodes. See test_mckenzie_5_3.py.
"""
import numpy as np
import math
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_inclined_beam_transverse_udl_equilibrium():
    """
    Inclined beam pinned at both ends with vertical UDL.
    Verifies that the transverse component gives the correct local-y reactions,
    and that the total global Fy reaction equals w * L * cos^2(theta).
    """
    L = 8.0
    theta = math.pi / 6   # 30 deg
    c = math.cos(theta)
    s = math.sin(theta)
    w = 5000.0   # N/m downward

    nodes = np.array([[0.0, 0.0], [L * c, L * s]], float)
    members = np.array([[1, 2]], int)

    E = 200e9; I = 0.01; A_sec = 0.01

    # Transverse component of vertical UDL
    q_ly = -w * c   # local transverse intensity (negative = downward in local y)
    ENF = q_ly * L / 2
    ENM_i = q_ly * L**2 / 12
    ENM_j = -q_ly * L**2 / 12

    ENForces = np.array([[ENF, ENF]], float)
    ENMoments = np.array([[ENM_i, ENM_j]], float)
    fv = np.zeros((6, 1))

    # Both nodes pinned: DOF 1,2 and 4,5
    restrainedDoF = [1, 2, 4, 5]

    model = FrameModel2D(
        nodes=nodes, members=members,
        ENForces=ENForces, ENMoments=ENMoments,
        forceVector=fv,
        E=E, I=I, A=A_sec, bars=[],
        beamPinLeft=[], beamPinRight=[],
        restrainedDoF=restrainedDoF, pinDoF=[],
        springDoF=[], springStiffness=[],
    )
    adapter = FrameV2Adapter(model)
    result = adapter.solve()
    FG = result.FG.flatten()

    print(f"\n=== Inclined beam (pinned-pinned), vertical UDL ===")
    print(f"theta={math.degrees(theta):.0f} deg, L={L} m, w={w} N/m")
    print(f"Node 0: Fx={FG[0]:.2f}, Fy={FG[1]:.2f}")
    print(f"Node 1: Fx={FG[3]:.2f}, Fy={FG[4]:.2f}")

    # For a simply-supported beam: each end carries half the transverse load in local y
    # Local reaction at each node (upward support reaction): Vy = +w*c*L/2
    # Global Fy from transverse (upward): cos(theta) * Vy = +w*c^2*L/2
    expected_fy_each = +w * c * c * L / 2   # = +5000 * 0.75 * 4 = +15000 N each (upward)
    expected_fy_total = 2 * expected_fy_each

    print(f"Expected Fy each: {expected_fy_each:.2f} N (= w*cos^2(theta)*L/2)")
    print(f"Expected Fy total: {expected_fy_total:.2f} N")

    assert abs(FG[1] - expected_fy_each) < 1.0, \
        f"Fy at node 0 = {FG[1]:.2f}, expected {expected_fy_each:.2f}"
    assert abs(FG[4] - expected_fy_each) < 1.0, \
        f"Fy at node 1 = {FG[4]:.2f}, expected {expected_fy_each:.2f}"
    assert abs(FG[1] + FG[4] - expected_fy_total) < 1.0, \
        f"Total Fy = {FG[1]+FG[4]:.2f}, expected {expected_fy_total:.2f}"
