"""
Test: McKenzie Problem 5.3 portal frame with inclined rafters and UDLs.

This test verifies the solver core with correctly decomposed UDL equivalent nodal actions.

Structure:
- Node A (0, 0): fixed support
- Node B (0, 6): left column top
- Node C (8, 9): ridge with internal pin (beamPinRight on member BC)
- Node D (16, 6): right column top
- Node E (16, 0): pin support

Members:
- AB: left column (vertical)
- BC: left rafter (inclined, theta ≈ 20.56°)
- CD: right rafter (inclined, theta ≈ -20.56°)
- DE: right column (vertical, downward)

Loads:
- Point loads: 20kN down at B, 40kN down at C, 6kN right at B, 20kN down at D
- UDLs:
  - AB: 4 kN/m horizontal (rightward)
  - BC: 8 kN/m vertical (downward, gravity)
  - CD: 8 kN/m vertical (downward, gravity)
  - DE: 2 kN/m horizontal (rightward)

Expected reactions (McKenzie textbook):
- Node A: Fx=42 kN, Fy=165 kN, Mz=1120 kNm
- Node E: Fy=43 kN

Expected reactions (Robot Structural Analysis):
- Node A: Fx=42 kN, Fy=171.53 kN, Mz=1154.82 kNm
- Node E: Fy=45.18 kN
"""
import numpy as np
import math
import pytest
from pda_analysis_software.models.frame_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_mckenzie_5_3_vertical_udl_decomposition():
    """McKenzie 5.3 with correct vertical UDL decomposition for inclined members."""

    # Geometry (clean coordinates from McKenzie)
    nodes = np.array([
        [0.0, 0.0],   # 0: A (fixed)
        [0.0, 6.0],   # 1: B
        [8.0, 9.0],   # 2: C (ridge, internal pin)
        [16.0, 6.0],  # 3: D
        [16.0, 0.0],  # 4: E (pin)
    ], float)

    # Members (1-based node indices)
    members = np.array([
        [1, 2],  # AB: left column
        [2, 3],  # BC: left rafter
        [3, 4],  # CD: right rafter
        [4, 5],  # DE: right column
    ], int)

    # Material properties (assumed - McKenzie doesn't specify)
    E = 200e9  # Pa
    I = 0.01   # m^4
    A = 0.01   # m^2

    # Member geometry
    def member_geom(ni, nj):
        """Return L, theta, cos(theta), sin(theta) for member from ni to nj (0-based)."""
        dx = nodes[nj, 0] - nodes[ni, 0]
        dy = nodes[nj, 1] - nodes[ni, 1]
        L = math.sqrt(dx**2 + dy**2)
        theta = math.atan2(dy, dx)
        return L, theta, math.cos(theta), math.sin(theta)

    # Member 0 (AB): vertical, L=6m, theta=90°
    L_AB, theta_AB, c_AB, s_AB = member_geom(0, 1)
    assert abs(L_AB - 6.0) < 1e-9
    assert abs(theta_AB - math.pi/2) < 1e-9

    # Member 1 (BC): inclined, L=sqrt(73)≈8.544m, theta≈20.56°
    L_BC, theta_BC, c_BC, s_BC = member_geom(1, 2)
    assert abs(L_BC - math.sqrt(73)) < 1e-9

    # Member 2 (CD): inclined, L=sqrt(73)≈8.544m, theta≈-20.56°
    L_CD, theta_CD, c_CD, s_CD = member_geom(2, 3)
    assert abs(L_CD - math.sqrt(73)) < 1e-9

    # Member 3 (DE): vertical down, L=6m, theta=-90°
    L_DE, theta_DE, c_DE, s_DE = member_geom(3, 4)
    assert abs(L_DE - 6.0) < 1e-9
    assert abs(theta_DE - (-math.pi/2)) < 1e-9

    # --- UDL Equivalent Nodal Actions (ENA) ---
    # Key insight: For a VERTICAL (gravity) UDL on an inclined member,
    # the local transverse component = w * cos(theta)
    # the local axial component = w * sin(theta) (but cancels in ENA for uniform load)

    # Member 0 (AB): 4 kN/m HORIZONTAL (will be handled separately via udl_x)
    # ENForces/ENMoments = 0 for horizontal UDL (handled by API)

    # Member 1 (BC): 8 kN/m VERTICAL downward
    w_BC = 8000  # N/m (vertical)
    w_BC_local = w_BC * c_BC  # local transverse component
    ENF_BC_i = -(w_BC_local * L_BC) / 2
    ENF_BC_j = -(w_BC_local * L_BC) / 2
    ENM_BC_i = (w_BC_local * L_BC**2) / 12
    ENM_BC_j = -(w_BC_local * L_BC**2) / 12

    # Member 2 (CD): 8 kN/m VERTICAL downward
    w_CD = 8000  # N/m (vertical)
    w_CD_local = w_CD * c_CD  # local transverse component (same magnitude as BC due to symmetry)
    ENF_CD_i = -(w_CD_local * L_CD) / 2
    ENF_CD_j = -(w_CD_local * L_CD) / 2
    ENM_CD_i = (w_CD_local * L_CD**2) / 12
    ENM_CD_j = -(w_CD_local * L_CD**2) / 12

    # Member 3 (DE): 2 kN/m HORIZONTAL (will be handled separately via udl_x)
    # ENForces/ENMoments = 0 for horizontal UDL (handled by API)

    ENForces = np.array([
        [0.0, 0.0],           # AB (horizontal UDL handled separately)
        [ENF_BC_i, ENF_BC_j], # BC
        [ENF_CD_i, ENF_CD_j], # CD
        [0.0, 0.0],           # DE (horizontal UDL handled separately)
    ], float)

    ENMoments = np.array([
        [0.0, 0.0],             # AB
        [ENM_BC_i, ENM_BC_j],   # BC
        [ENM_CD_i, ENM_CD_j],   # CD
        [0.0, 0.0],             # DE
    ], float)

    # --- Point loads ---
    # DOF numbering: node i has DOF [3i+1, 3i+2, 3i+3] (1-based)
    # Node 0 (A): DOF 1,2,3
    # Node 1 (B): DOF 4,5,6
    # Node 2 (C): DOF 7,8,9
    # Node 3 (D): DOF 10,11,12
    # Node 4 (E): DOF 13,14,15

    forceVector = np.zeros((15, 1))
    forceVector[3, 0] = 6000    # Node 1 (B) Fx = 6 kN right
    forceVector[4, 0] = -20000  # Node 1 (B) Fy = 20 kN down
    forceVector[7, 0] = -40000  # Node 2 (C) Fy = 40 kN down
    forceVector[10, 0] = -20000 # Node 3 (D) Fy = 20 kN down

    # --- Horizontal UDL handling (mimic API behavior) ---
    # AB: 4 kN/m horizontal rightward
    wx_AB = 4000  # N/m
    fx_AB_each = wx_AB * L_AB / 2
    mi_AB = -wx_AB * s_AB * L_AB**2 / 12
    mj_AB = wx_AB * s_AB * L_AB**2 / 12

    forceVector[0, 0] += fx_AB_each  # Node 0 (A) Fx
    forceVector[3, 0] += fx_AB_each  # Node 1 (B) Fx
    ENMoments[0, 0] += mi_AB
    ENMoments[0, 1] += mj_AB

    # DE: 2 kN/m horizontal rightward
    wx_DE = 2000  # N/m
    fx_DE_each = wx_DE * L_DE / 2
    mi_DE = -wx_DE * s_DE * L_DE**2 / 12
    mj_DE = wx_DE * s_DE * L_DE**2 / 12

    forceVector[9, 0] += fx_DE_each   # Node 3 (D) Fx
    forceVector[12, 0] += fx_DE_each  # Node 4 (E) Fx
    ENMoments[3, 0] += mi_DE
    ENMoments[3, 1] += mj_DE

    # --- Supports ---
    # Node A (0): fixed → DOF 1,2,3
    # Node E (4): pin → DOF 13,14
    restrainedDoF = [1, 2, 3, 13, 14]

    # Internal pin at ridge (node C): beamPinRight on member BC (member 2, 1-based)
    beamPinRight = [2]

    # Build model
    model = FrameModel2D(
        nodes=nodes,
        members=members,
        ENForces=ENForces,
        ENMoments=ENMoments,
        forceVector=forceVector,
        E=E,
        I=I,
        A=A,
        bars=[],
        beamPinLeft=[],
        beamPinRight=beamPinRight,
        restrainedDoF=restrainedDoF,
        pinDoF=[],
        springDoF=[],
        springStiffness=[],
    )

    # Solve
    adapter = FrameV2Adapter(model)
    result = adapter.solve()

    # Extract reactions (global force vector FG)
    FG = result.FG.flatten()

    # Subtract horizontal UDL direct forces (mirrors API post-solve correction)
    FG[0] -= fx_AB_each   # Node 0 (A) Fx
    FG[3] -= fx_AB_each   # Node 1 (B) Fx
    FG[9] -= fx_DE_each   # Node 3 (D) Fx
    FG[12] -= fx_DE_each  # Node 4 (E) Fx

    # Node A reactions (DOF 1,2,3 → indices 0,1,2)
    Fx_A = FG[0]
    Fy_A = FG[1]
    Mz_A = FG[2]

    # Node E reactions (DOF 13,14 → indices 12,13)
    Fx_E = FG[12]
    Fy_E = FG[13]

    print("\n=== McKenzie 5.3 Results ===")
    print(f"Node A: Fx={Fx_A/1000:.2f} kN, Fy={Fy_A/1000:.2f} kN, Mz={Mz_A/1000:.2f} kNm")
    print(f"Node E: Fx={Fx_E/1000:.2f} kN, Fy={Fy_E/1000:.2f} kN")
    print("\nExpected (McKenzie): A Fx=42, Fy=165, Mz=1120; E Fy=43")
    print("Expected (Robot):    A Fx=42, Fy=171.53, Mz=1154.82; E Fy=45.18")

    # Verify against Robot values (more precise than hand calc)
    # Allow 5% tolerance for now (we may have UDL convention differences)
    assert abs(Fx_A/1000 - 42.0) / 42.0 < 0.05, f"Fx_A = {Fx_A/1000:.2f} kN, expected 42 kN"
    assert abs(Fy_A/1000 - 171.53) / 171.53 < 0.05, f"Fy_A = {Fy_A/1000:.2f} kN, expected 171.53 kN"
    assert abs(Mz_A/1000 - 1154.82) / 1154.82 < 0.05, f"Mz_A = {Mz_A/1000:.2f} kNm, expected 1154.82 kNm"
    assert abs(Fy_E/1000 - 45.18) / 45.18 < 0.05, f"Fy_E = {Fy_E/1000:.2f} kN, expected 45.18 kN"

    # Fx_E should be near zero (pin support allows horizontal movement)
    assert abs(Fx_E) < 100, f"Fx_E = {Fx_E/1000:.2f} kN, expected ~0 kN"


if __name__ == "__main__":
    test_mckenzie_5_3_vertical_udl_decomposition()
