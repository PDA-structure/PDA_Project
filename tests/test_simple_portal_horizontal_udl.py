"""
Simple portal frame with only horizontal UDLs to isolate the issue.

Structure:
- Node A (0,0): fixed
- Node B (0,6): top left
- Node C (8,6): top right
- Node D (8,0): pin

Members:
- AB: left column
- BC: horizontal beam
- CD: right column

Loads:
- 4 kN/m horizontal on AB (rightward)
- 2 kN/m horizontal on CD (rightward)

No vertical UDLs, no inclined members, no internal pins.
This should be simple to verify by statics.
"""
import numpy as np
import math
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_simple_portal_horizontal_udl():
    """Simple portal frame with horizontal UDLs only."""

    nodes = np.array([
        [0.0, 0.0],  # 0: A (fixed)
        [0.0, 6.0],  # 1: B
        [8.0, 6.0],  # 2: C
        [8.0, 0.0],  # 3: D (pin)
    ], float)

    members = np.array([
        [1, 2],  # AB: left column
        [2, 3],  # BC: beam
        [3, 4],  # CD: right column
    ], int)

    E = 200e9
    I = 0.01
    A = 0.01

    # Member geometry
    L_AB = 6.0
    theta_AB = math.pi / 2  # vertical
    c_AB, s_AB = 0.0, 1.0

    L_BC = 8.0
    theta_BC = 0.0  # horizontal
    c_BC, s_BC = 1.0, 0.0

    L_CD = 6.0
    theta_CD = -math.pi / 2  # vertical down
    c_CD, s_CD = 0.0, -1.0

    # Horizontal UDLs using ENForces approach
    # AB: 4 kN/m rightward
    wx_AB = 4000
    q_AB_local_y = wx_AB * (-s_AB)  # = 4000 * (-1) = -4000
    ENF_AB_i = q_AB_local_y * L_AB / 2  # = -12000
    ENF_AB_j = q_AB_local_y * L_AB / 2  # = -12000
    ENM_AB_i = q_AB_local_y * L_AB**2 / 12  # = -12000
    ENM_AB_j = -q_AB_local_y * L_AB**2 / 12  # = +12000

    # BC: no UDL
    ENF_BC_i, ENF_BC_j = 0.0, 0.0
    ENM_BC_i, ENM_BC_j = 0.0, 0.0

    # CD: 2 kN/m rightward
    wx_CD = 2000
    q_CD_local_y = wx_CD * (-s_CD)  # = 2000 * (-(-1)) = +2000
    ENF_CD_i = q_CD_local_y * L_CD / 2  # = +6000
    ENF_CD_j = q_CD_local_y * L_CD / 2  # = +6000
    ENM_CD_i = q_CD_local_y * L_CD**2 / 12  # = +6000
    ENM_CD_j = -q_CD_local_y * L_CD**2 / 12  # = -6000

    ENForces = np.array([
        [ENF_AB_i, ENF_AB_j],
        [ENF_BC_i, ENF_BC_j],
        [ENF_CD_i, ENF_CD_j],
    ], float)

    ENMoments = np.array([
        [ENM_AB_i, ENM_AB_j],
        [ENM_BC_i, ENM_BC_j],
        [ENM_CD_i, ENM_CD_j],
    ], float)

    forceVector = np.zeros((12, 1))

    # Supports
    restrainedDoF = [1, 2, 3, 10, 11]  # A fixed, D pin

    model = FrameModel2D(
        nodes=nodes,
        members=members,
        ENForces=ENForces,
        ENMoments=ENMoments,
        forceVector=forceVector,
        E=E, I=I, A=A,
        bars=[],
        restrainedDoF=restrainedDoF,
    )

    adapter = FrameV2Adapter(model)
    result = adapter.solve()

    FG = result.FG.flatten()

    Fx_A = FG[0]
    Fy_A = FG[1]
    Mz_A = FG[2]
    Fx_D = FG[9]
    Fy_D = FG[10]

    print("\n=== Simple Portal with Horizontal UDL ===")
    print(f"Node A: Fx={Fx_A/1000:.2f} kN, Fy={Fy_A/1000:.2f} kN, Mz={Mz_A/1000:.2f} kNm")
    print(f"Node D: Fx={Fx_D/1000:.2f} kN, Fy={Fy_D/1000:.2f} kN")
    print(f"\nTotal horizontal load = {(wx_AB*L_AB + wx_CD*L_CD)/1000:.2f} kN")
    print(f"Horizontal equilibrium check: Fx_A + Fx_D = {(Fx_A + Fx_D)/1000:.2f} kN")

    # Check equilibrium (reactions oppose applied loads, so sum should be negative of total load)
    total_horiz_load = wx_AB * L_AB + wx_CD * L_CD  # 24000 + 12000 = 36000 N rightward
    assert abs((Fx_A + Fx_D) + total_horiz_load) < 1, f"Horizontal equilibrium violated"
    assert abs(Fy_A + Fy_D) < 1, f"Vertical equilibrium violated (no vertical loads)"

    print(f"\n✓ Horizontal equilibrium satisfied")
    print(f"✓ Vertical equilibrium satisfied")


if __name__ == "__main__":
    test_simple_portal_horizontal_udl()
