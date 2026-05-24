"""
Test: McKenzie Problem 5.3 portal frame with inclined rafters and UDLs.

This test verifies the solver core with correctly decomposed UDL equivalent nodal actions.

Structure:
- Node A (0, 0): fixed support
- Node B (0, 6): left column top
- Node C (8, 9): ridge with internal pin (beamPinRight on member BC)
- Node D (16, 6): right column top
- Node E (16, 0): rollerY support (vertical restraint only)

Members:
- AB: left column (vertical, theta=90°)
- BC: left rafter (inclined, theta ≈ 20.56°)
- CD: right rafter (inclined, theta ≈ -20.56°)
- DE: right column (vertical downward, theta=-90°)

Loads:
- Point loads: 20kN down at B, 40kN down at C, 6kN right at B, 20kN down at D
- UDLs:
  - AB: 4 kN/m horizontal (rightward, global X)
  - BC: 8 kN/m vertical (downward, global -Y)
  - CD: 8 kN/m vertical (downward, global -Y)
  - DE: 2 kN/m horizontal (rightward, global X)

Expected reactions (McKenzie textbook, approx):
- Node A: Fx=42 kN, Fy=165 kN, Mz=1120 kNm
- Node E: Fy=43 kN

Expected reactions (Robot Structural Analysis, precise):
- Node A: Fx=42 kN, Fy=171.53 kN, Mz=1154.82 kNm
- Node E: Fy=45.18 kN

Convention notes:
- Our solver FG convention: negative Fx at A means the support pushes LEFT (reaction to rightward loads)
- Robot FX=-42 matches our FG[0]=-42000 (reaction opposes applied loads)
- ENForces sign: For a member at angle theta, a distributed load in local -y direction
  has ENForces = q_local_y * L / 2 where q_local_y is the signed local transverse intensity.
  For global-Y downward load on inclined member: q_local_y = -w * cos(theta)
  For global-X rightward load on any member: q_local_y = wx * (-sin(theta))
- ENMoments sign: ENMoments[i] = q_local_y * L^2 / 12 (positive q_local_y → positive ENM[i])
- Axial component of vertical UDL on inclined members must be added to forceVector directly
  (as there is no ENForces axial interface):
    q_axial = -w * sin(theta)
    Global force at each node: (q_axial * L/2 * cos(theta), q_axial * L/2 * sin(theta))
"""
import numpy as np
import math
import pytest
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def member_geom(nodes, ni, nj):
    """Return (L, theta, cos, sin) for member from 0-based node ni to nj."""
    dx = nodes[nj, 0] - nodes[ni, 0]
    dy = nodes[nj, 1] - nodes[ni, 1]
    L = math.sqrt(dx**2 + dy**2)
    theta = math.atan2(dy, dx)
    return L, theta, math.cos(theta), math.sin(theta)


def test_mckenzie_5_3():
    """McKenzie 5.3 portal frame — full UDL decomposition (transverse + axial)."""

    # --- Geometry ---
    nodes = np.array([
        [0.0,  0.0],   # 0: A (fixed)
        [0.0,  6.0],   # 1: B
        [8.0,  9.0],   # 2: C (ridge, internal pin on member BC)
        [16.0, 6.0],   # 3: D
        [16.0, 0.0],   # 4: E (rollerY)
    ], float)

    # 1-based node indices
    members = np.array([
        [1, 2],  # 0: AB
        [2, 3],  # 1: BC
        [3, 4],  # 2: CD
        [4, 5],  # 3: DE
    ], int)

    E = 200e9   # Pa
    I = 0.01    # m^4
    A = 0.01    # m^2

    L_AB, t_AB, c_AB, s_AB = member_geom(nodes, 0, 1)
    L_BC, t_BC, c_BC, s_BC = member_geom(nodes, 1, 2)
    L_CD, t_CD, c_CD, s_CD = member_geom(nodes, 2, 3)
    L_DE, t_DE, c_DE, s_DE = member_geom(nodes, 3, 4)

    assert abs(L_AB - 6.0) < 1e-9
    assert abs(L_BC - math.sqrt(73)) < 1e-9
    assert abs(L_CD - math.sqrt(73)) < 1e-9
    assert abs(L_DE - 6.0) < 1e-9

    # ---------------------------------------------------------------
    # ENForces / ENMoments from UDLs
    #
    # For horizontal UDL wx (global X, rightward) on any member:
    #   q_local_y = wx * (-sin(theta))   [projection of global X onto local y]
    #   ENForces_i = ENForces_j = q_local_y * L / 2
    #   ENMoments_i = q_local_y * L^2 / 12
    #   ENMoments_j = -q_local_y * L^2 / 12
    #
    # For vertical UDL wy (global Y downward = positive convention) on inclined member:
    #   TRANSVERSE: q_local_y = -wy * cos(theta)
    #   ENForces_i = ENForces_j = q_local_y * L / 2
    #   ENMoments_i = q_local_y * L^2 / 12
    #   ENMoments_j = -q_local_y * L^2 / 12
    #   AXIAL (added to forceVector at free nodes):
    #   q_axial = -wy * sin(theta)
    #   fv[node_i] += (q_axial * L/2) * (cos(theta), sin(theta))
    #   fv[node_j] += (q_axial * L/2) * (cos(theta), sin(theta))
    # ---------------------------------------------------------------

    # Member AB: horizontal UDL wx=4 kN/m (vertical member, t=90°)
    wx_AB = 4000.0
    q_AB_ly = wx_AB * (-s_AB)               # 4000 * (-1) = -4000
    ENF_AB = q_AB_ly * L_AB / 2             # -12000
    ENM_AB_i = q_AB_ly * L_AB**2 / 12      # -12000
    ENM_AB_j = -q_AB_ly * L_AB**2 / 12     # +12000

    # Member BC: vertical UDL wy=8 kN/m (inclined rafter, t≈+20.56°)
    wy_BC = 8000.0
    q_BC_ly = -wy_BC * c_BC                 # -8000 * cos(20.56°) ≈ -7490
    ENF_BC = q_BC_ly * L_BC / 2             # ≈ -32000
    ENM_BC_i = q_BC_ly * L_BC**2 / 12      # ≈ -45500
    ENM_BC_j = -q_BC_ly * L_BC**2 / 12     # ≈ +45500
    q_BC_ax = -wy_BC * s_BC                 # -8000 * sin(20.56°) ≈ -2809
    Nx_BC = q_BC_ax * L_BC / 2             # ≈ -12000 N (compressive axial each end)

    # Member CD: vertical UDL wy=8 kN/m (inclined rafter, t≈-20.56°)
    wy_CD = 8000.0
    q_CD_ly = -wy_CD * c_CD                 # ≈ -7490 (c_CD same magnitude as c_BC)
    ENF_CD = q_CD_ly * L_CD / 2             # ≈ -32000
    ENM_CD_i = q_CD_ly * L_CD**2 / 12
    ENM_CD_j = -q_CD_ly * L_CD**2 / 12
    q_CD_ax = -wy_CD * s_CD                 # -8000 * sin(-20.56°) ≈ +2809
    Nx_CD = q_CD_ax * L_CD / 2             # ≈ +12000 N (tensile axial each end)

    # Member DE: horizontal UDL wx=2 kN/m (vertical member going down, t=-90°)
    wx_DE = 2000.0
    q_DE_ly = wx_DE * (-s_DE)               # 2000 * (+1) = +2000
    ENF_DE = q_DE_ly * L_DE / 2             # +6000
    ENM_DE_i = q_DE_ly * L_DE**2 / 12      # +6000
    ENM_DE_j = -q_DE_ly * L_DE**2 / 12     # -6000

    ENForces = np.array([
        [ENF_AB,  ENF_AB],
        [ENF_BC,  ENF_BC],
        [ENF_CD,  ENF_CD],
        [ENF_DE,  ENF_DE],
    ], float)

    ENMoments = np.array([
        [ENM_AB_i, ENM_AB_j],
        [ENM_BC_i, ENM_BC_j],
        [ENM_CD_i, ENM_CD_j],
        [ENM_DE_i, ENM_DE_j],
    ], float)

    # ---------------------------------------------------------------
    # Force vector: point loads + axial components of vertical UDL
    # DOF layout: node i → indices 3i, 3i+1, 3i+2 (Fx, Fy, Mz) 0-based
    # ---------------------------------------------------------------
    fv = np.zeros((15, 1))

    # Point loads
    fv[3, 0] = 6000       # B: Fx = +6 kN
    fv[4, 0] = -20000     # B: Fy = -20 kN
    fv[7, 0] = -40000     # C: Fy = -40 kN
    fv[10, 0] = -20000    # D: Fy = -20 kN

    # Axial component of vertical UDL on BC: distributed along local x
    # Both nodes get (Nx_BC) * (local x unit vector) in global coords
    fv[3, 0] += Nx_BC * c_BC    # B: Fx from BC axial
    fv[4, 0] += Nx_BC * s_BC    # B: Fy from BC axial
    fv[6, 0] += Nx_BC * c_BC    # C: Fx from BC axial
    fv[7, 0] += Nx_BC * s_BC    # C: Fy from BC axial

    # Axial component of vertical UDL on CD
    fv[6, 0] += Nx_CD * c_CD    # C: Fx from CD axial
    fv[7, 0] += Nx_CD * s_CD    # C: Fy from CD axial
    fv[9, 0] += Nx_CD * c_CD    # D: Fx from CD axial
    fv[10, 0] += Nx_CD * s_CD   # D: Fy from CD axial

    # --- Supports ---
    # A (node 0): fixed → DOF 1,2,3 (1-based)
    # E (node 4): rollerY → DOF 14 only (vertical restraint, free horizontal)
    restrainedDoF = [1, 2, 3, 14]
    beamPinRight = [2]  # internal pin at C: release on BC (member 2, 1-based)

    # --- Solve ---
    model = FrameModel2D(
        nodes=nodes,
        members=members,
        ENForces=ENForces,
        ENMoments=ENMoments,
        forceVector=fv,
        E=E, I=I, A=A,
        bars=[],
        beamPinLeft=[],
        beamPinRight=beamPinRight,
        restrainedDoF=restrainedDoF,
        pinDoF=[],
        springDoF=[],
        springStiffness=[],
    )
    adapter = FrameV2Adapter(model)
    result = adapter.solve()
    FG = result.FG.flatten()

    # Node A: DOF 1,2,3 → 0-based indices 0,1,2
    # Node E: DOF 14 → 0-based index 13 (Fy_E)
    Fx_A = FG[0]
    Fy_A = FG[1]
    Mz_A = FG[2]
    Fy_E = FG[13]

    print("\n=== McKenzie 5.3 Results ===")
    print(f"Node A: Fx={Fx_A/1000:.2f} kN, Fy={Fy_A/1000:.2f} kN, Mz={Mz_A/1000:.2f} kNm")
    print(f"Node E: Fy={Fy_E/1000:.2f} kN")
    print("Expected (Robot): A Fx=-42, Fy=171.53, Mz=-1154.82; E Fy=45.18")

    # Tolerance 2% for small convention differences
    tol = 0.02
    assert abs(Fx_A/1000 - (-42.0)) / 42.0 < tol, \
        f"Fx_A = {Fx_A/1000:.3f} kN, expected -42 kN"
    assert abs(Fy_A/1000 - 171.53) / 171.53 < tol, \
        f"Fy_A = {Fy_A/1000:.3f} kN, expected 171.53 kN"
    assert abs(Mz_A/1000 - (-1154.82)) / 1154.82 < tol, \
        f"Mz_A = {Mz_A/1000:.3f} kNm, expected -1154.82 kNm"
    assert abs(Fy_E/1000 - 45.18) / 45.18 < tol, \
        f"Fy_E = {Fy_E/1000:.3f} kN, expected 45.18 kN"


if __name__ == "__main__":
    test_mckenzie_5_3()
