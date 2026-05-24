"""
McKenzie 5.3 with ONLY transverse components (no axial from vertical UDL).
This isolates whether the ENForces transformation is working correctly.
"""
import numpy as np
import math
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_mckenzie_transverse_only():
    """McKenzie 5.3 with only transverse UDL components - no axial."""

    nodes = np.array([
        [0.0, 0.0],   # 0: A (fixed)
        [0.0, 6.0],   # 1: B
        [8.0, 9.0],   # 2: C (ridge, internal pin)
        [16.0, 6.0],  # 3: D
        [16.0, 0.0],  # 4: E (pin)
    ], float)

    members = np.array([
        [1, 2],  # AB
        [2, 3],  # BC
        [3, 4],  # CD
        [4, 5],  # DE
    ], int)

    E = 200e9
    I = 0.01
    A = 0.01

    def member_geom(ni, nj):
        dx = nodes[nj, 0] - nodes[ni, 0]
        dy = nodes[nj, 1] - nodes[ni, 1]
        L = math.sqrt(dx**2 + dy**2)
        theta = math.atan2(dy, dx)
        return L, theta, math.cos(theta), math.sin(theta)

    L_AB, theta_AB, c_AB, s_AB = member_geom(0, 1)
    L_BC, theta_BC, c_BC, s_BC = member_geom(1, 2)
    L_CD, theta_CD, c_CD, s_CD = member_geom(2, 3)
    L_DE, theta_DE, c_DE, s_DE = member_geom(3, 4)

    # Horizontal UDLs (ENForces approach)
    wx_AB = 4000
    q_AB_local_y = wx_AB * (-s_AB)
    ENF_AB_i = q_AB_local_y * L_AB / 2
    ENF_AB_j = q_AB_local_y * L_AB / 2
    ENM_AB_i = q_AB_local_y * L_AB**2 / 12
    ENM_AB_j = -q_AB_local_y * L_AB**2 / 12

    # Vertical UDLs (ONLY transverse component)
    w_BC = 8000
    w_BC_local_y = w_BC * c_BC  # transverse only
    ENF_BC_i = -(w_BC_local_y * L_BC) / 2
    ENF_BC_j = -(w_BC_local_y * L_BC) / 2
    ENM_BC_i = (w_BC_local_y * L_BC**2) / 12
    ENM_BC_j = -(w_BC_local_y * L_BC**2) / 12

    w_CD = 8000
    w_CD_local_y = w_CD * c_CD
    ENF_CD_i = -(w_CD_local_y * L_CD) / 2
    ENF_CD_j = -(w_CD_local_y * L_CD) / 2
    ENM_CD_i = (w_CD_local_y * L_CD**2) / 12
    ENM_CD_j = -(w_CD_local_y * L_CD**2) / 12

    wx_DE = 2000
    q_DE_local_y = wx_DE * (-s_DE)
    ENF_DE_i = q_DE_local_y * L_DE / 2
    ENF_DE_j = q_DE_local_y * L_DE / 2
    ENM_DE_i = q_DE_local_y * L_DE**2 / 12
    ENM_DE_j = -q_DE_local_y * L_DE**2 / 12

    ENForces = np.array([
        [ENF_AB_i, ENF_AB_j],
        [ENF_BC_i, ENF_BC_j],
        [ENF_CD_i, ENF_CD_j],
        [ENF_DE_i, ENF_DE_j],
    ], float)

    ENMoments = np.array([
        [ENM_AB_i, ENM_AB_j],
        [ENM_BC_i, ENM_BC_j],
        [ENM_CD_i, ENM_CD_j],
        [ENM_DE_i, ENM_DE_j],
    ], float)

    # Point loads ONLY (no axial UDL components)
    forceVector = np.zeros((15, 1))
    forceVector[3, 0] = 6000
    forceVector[4, 0] = -20000
    forceVector[7, 0] = -40000
    forceVector[10, 0] = -20000

    restrainedDoF = [1, 2, 3, 13, 14]
    beamPinRight = [2]

    model = FrameModel2D(
        nodes=nodes,
        members=members,
        ENForces=ENForces,
        ENMoments=ENMoments,
        forceVector=forceVector,
        E=E, I=I, A=A,
        bars=[],
        beamPinLeft=[],
        beamPinRight=beamPinRight,
        restrainedDoF=restrainedDoF,
    )

    adapter = FrameV2Adapter(model)
    result = adapter.solve()

    FG = result.FG.flatten()

    Fx_A = FG[0]
    Fy_A = FG[1]
    Mz_A = FG[2]
    Fx_E = FG[12]
    Fy_E = FG[13]

    print("\n=== McKenzie 5.3 (Transverse Only) ===")
    print(f"Node A: Fx={Fx_A/1000:.2f} kN, Fy={Fy_A/1000:.2f} kN, Mz={Mz_A/1000:.2f} kNm")
    print(f"Node E: Fx={Fx_E/1000:.2f} kN, Fy={Fy_E/1000:.2f} kN")
    print("\nExpected (Robot with axial):    A Fx=42, Fy=171.53, Mz=1154.82; E Fy=45.18")
    print("(This test omits axial components, so results will differ)")

    # Check equilibrium
    total_vert = 80000 + 2*8000*L_BC  # point loads + UDLs
    print(f"\nVertical equilibrium: Fy_A + Fy_E = {(Fy_A + Fy_E)/1000:.2f} kN, total load = {total_vert/1000:.2f} kN")


if __name__ == "__main__":
    test_mckenzie_transverse_only()
