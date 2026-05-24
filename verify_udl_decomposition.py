#!/usr/bin/env python3
"""Quick verification: McKenzie 5.3 with correct vertical UDL decomposition."""
import sys
sys.path.insert(0, 'solver_core/src')

import numpy as np
import math
from pda_analysis_software.models.frame_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter

# Geometry
nodes = np.array([
    [0.0, 0.0],   # 0: A (fixed)
    [0.0, 6.0],   # 1: B
    [8.0, 9.0],   # 2: C (ridge, internal pin)
    [16.0, 6.0],  # 3: D
    [16.0, 0.0],  # 4: E (pin)
], float)

members = np.array([[1, 2], [2, 3], [3, 4], [4, 5]], int)

E, I, A = 200e9, 0.01, 0.01

# Member geometry helper
def geom(ni, nj):
    dx = nodes[nj, 0] - nodes[ni, 0]
    dy = nodes[nj, 1] - nodes[ni, 1]
    L = math.sqrt(dx**2 + dy**2)
    theta = math.atan2(dy, dx)
    return L, theta, math.cos(theta), math.sin(theta)

L_AB, theta_AB, c_AB, s_AB = geom(0, 1)
L_BC, theta_BC, c_BC, s_BC = geom(1, 2)
L_CD, theta_CD, c_CD, s_CD = geom(2, 3)
L_DE, theta_DE, c_DE, s_DE = geom(3, 4)

print(f"Member BC: L={L_BC:.3f}m, theta={math.degrees(theta_BC):.2f}°, cos={c_BC:.4f}, sin={s_BC:.4f}")
print(f"Member CD: L={L_CD:.3f}m, theta={math.degrees(theta_CD):.2f}°, cos={c_CD:.4f}, sin={s_CD:.4f}")

# Vertical UDL decomposition for inclined members
w_BC = 8000  # N/m vertical
w_BC_local = w_BC * c_BC  # local transverse component
ENF_BC_i = -(w_BC_local * L_BC) / 2
ENF_BC_j = -(w_BC_local * L_BC) / 2
ENM_BC_i = (w_BC_local * L_BC**2) / 12
ENM_BC_j = -(w_BC_local * L_BC**2) / 12

w_CD = 8000  # N/m vertical
w_CD_local = w_CD * c_CD
ENF_CD_i = -(w_CD_local * L_CD) / 2
ENF_CD_j = -(w_CD_local * L_CD) / 2
ENM_CD_i = (w_CD_local * L_CD**2) / 12
ENM_CD_j = -(w_CD_local * L_CD**2) / 12

print(f"\nBC vertical UDL 8kN/m:")
print(f"  Local transverse: {w_BC_local:.1f} N/m")
print(f"  ENForces: [{ENF_BC_i:.1f}, {ENF_BC_j:.1f}] N")
print(f"  ENMoments: [{ENM_BC_i:.1f}, {ENM_BC_j:.1f}] Nm")

ENForces = np.array([
    [0.0, 0.0],           # AB
    [ENF_BC_i, ENF_BC_j], # BC
    [ENF_CD_i, ENF_CD_j], # CD
    [0.0, 0.0],           # DE
], float)

ENMoments = np.array([
    [0.0, 0.0],
    [ENM_BC_i, ENM_BC_j],
    [ENM_CD_i, ENM_CD_j],
    [0.0, 0.0],
], float)

# Point loads
forceVector = np.zeros((15, 1))
forceVector[3, 0] = 6000
forceVector[4, 0] = -20000
forceVector[7, 0] = -40000
forceVector[10, 0] = -20000

# Horizontal UDL handling
wx_AB = 4000
fx_AB_each = wx_AB * L_AB / 2
mi_AB = -wx_AB * s_AB * L_AB**2 / 12
mj_AB = wx_AB * s_AB * L_AB**2 / 12

forceVector[0, 0] += fx_AB_each
forceVector[3, 0] += fx_AB_each
ENMoments[0, 0] += mi_AB
ENMoments[0, 1] += mj_AB

wx_DE = 2000
fx_DE_each = wx_DE * L_DE / 2
mi_DE = -wx_DE * s_DE * L_DE**2 / 12
mj_DE = wx_DE * s_DE * L_DE**2 / 12

forceVector[9, 0] += fx_DE_each
forceVector[12, 0] += fx_DE_each
ENMoments[3, 0] += mi_DE
ENMoments[3, 1] += mj_DE

print(f"\nHorizontal UDL on AB (4kN/m): fx_each={fx_AB_each:.1f}N, moments=[{mi_AB:.1f}, {mj_AB:.1f}]Nm")
print(f"Horizontal UDL on DE (2kN/m): fx_each={fx_DE_each:.1f}N, moments=[{mi_DE:.1f}, {mj_DE:.1f}]Nm")

# Supports and pins
restrainedDoF = [1, 2, 3, 13, 14]
beamPinRight = [2]

# Solve
model = FrameModel2D(
    nodes=nodes, members=members, ENForces=ENForces, ENMoments=ENMoments,
    forceVector=forceVector, E=E, I=I, A=A, bars=[], beamPinLeft=[],
    beamPinRight=beamPinRight, restrainedDoF=restrainedDoF, pinDoF=[],
    springDoF=[], springStiffness=[],
)

adapter = FrameV2Adapter(model)
result = adapter.solve()

FG = result.FG.flatten()

# Subtract horizontal UDL direct forces
FG[0] -= fx_AB_each
FG[3] -= fx_AB_each
FG[9] -= fx_DE_each
FG[12] -= fx_DE_each

# Extract reactions
Fx_A, Fy_A, Mz_A = FG[0], FG[1], FG[2]
Fx_E, Fy_E = FG[12], FG[13]

print("\n" + "="*50)
print("RESULTS (with correct UDL decomposition)")
print("="*50)
print(f"Node A: Fx={Fx_A/1000:.2f} kN, Fy={Fy_A/1000:.2f} kN, Mz={Mz_A/1000:.2f} kNm")
print(f"Node E: Fx={Fx_E/1000:.2f} kN, Fy={Fy_E/1000:.2f} kN")
print("\nExpected (McKenzie): A Fx=42, Fy=165, Mz=1120; E Fy=43")
print("Expected (Robot):    A Fx=42, Fy=171.53, Mz=1154.82; E Fy=45.18")
print("\nErrors vs Robot:")
print(f"  Fx_A: {abs(Fx_A/1000 - 42.0):.2f} kN ({abs(Fx_A/1000 - 42.0)/42.0*100:.1f}%)")
print(f"  Fy_A: {abs(Fy_A/1000 - 171.53):.2f} kN ({abs(Fy_A/1000 - 171.53)/171.53*100:.1f}%)")
print(f"  Mz_A: {abs(Mz_A/1000 - 1154.82):.2f} kNm ({abs(Mz_A/1000 - 1154.82)/1154.82*100:.1f}%)")
print(f"  Fy_E: {abs(Fy_E/1000 - 45.18):.2f} kN ({abs(Fy_E/1000 - 45.18)/45.18*100:.1f}%)")
