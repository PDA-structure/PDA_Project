"""
Calibration test: vertical cantilever with horizontal UDL.

Purpose: Establish the correct ENForces/ENMoments sign convention for horizontal UDL
         before fixing the full McKenzie 5.3 test.

Structure:
- Cantilever: node 0 (0,0) fixed, node 1 (0,6) free
- Member: vertical, L=6m, theta=90°
- Load: wx=4000 N/m horizontal (rightward)

For theta=90°: cos(90)=0, sin(90)=1

Horizontal UDL on vertical member is ENTIRELY transverse in local coords.

Theory:
- Global load: wx (N/m) in +X direction
- Local transverse load: q_local_y = wx * (-sin(theta)) = 4000 * (-1) = -4000 N/m
  (negative because +X in global is -local_y for upward vertical member)
- ENForces (local transverse fixed-end forces):
  - fyi = q_local_y * L / 2 = -4000 * 6 / 2 = -12000 N
  - fyj = q_local_y * L / 2 = -12000 N
- ENMoments (local):
  - mi = q_local_y * L^2 / 12 = -4000 * 36 / 12 = -12000 N·m
  - mj = -q_local_y * L^2 / 12 = +12000 N·m

Transform to global using T.T @ [0, fyi, mi, 0, fyj, mj]:
- c=0, s=1
- Global Fx_i = -s * fyi = -1 * (-12000) = +12000 N (rightward)
- Global Fy_i = c * fyi = 0 * (-12000) = 0
- Global Mz_i = mi = -12000 N·m
- Global Fx_j = -s * fyj = -1 * (-12000) = +12000 N (rightward)
- Global Fy_j = c * fyj = 0
- Global Mz_j = mj = +12000 N·m

Expected end reaction at fixed node 0:
- Fx = -12000 N (leftward, balances the 12 kN rightward distributed load)
- Fy = 0
- Mz = +12000 N·m (balances moment from UDL)

Wait, let me recalculate the moment. For a cantilever with UDL:
- Total load = wx * L = 4000 * 6 = 24000 N (acts at centroid, L/2 from base)
- Moment at base = 24000 * 3 = 72000 N·m

But the ENA approach gives fixed-end moments that need to be summed with the moment
from the ENForces acting at distance. This is getting confusing.

Let me just run the solver and see what we get.
"""
import numpy as np
import math
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_vertical_cantilever_horizontal_udl():
    """Vertical cantilever with horizontal UDL using ENForces approach."""

    # Geometry
    nodes = np.array([
        [0.0, 0.0],  # 0: fixed base
        [0.0, 6.0],  # 1: free top
    ], float)

    members = np.array([[1, 2]], int)  # 1-based

    # Material
    E = 200e9  # Pa
    I = 0.01   # m^4
    A = 0.01   # m^2

    # Member geometry
    L = 6.0
    theta = math.pi / 2  # 90°
    c = math.cos(theta)  # 0
    s = math.sin(theta)  # 1

    # Horizontal UDL: wx = 4000 N/m rightward
    wx = 4000

    # Decompose to local transverse component
    q_local_y = wx * (-s)  # = 4000 * (-1) = -4000 N/m

    # ENForces (local transverse fixed-end forces)
    fyi = q_local_y * L / 2  # = -4000 * 6 / 2 = -12000
    fyj = q_local_y * L / 2  # = -12000

    # ENMoments (local)
    mi = q_local_y * L**2 / 12   # = -4000 * 36 / 12 = -12000
    mj = -q_local_y * L**2 / 12  # = +12000

    ENForces = np.array([[fyi, fyj]], float)
    ENMoments = np.array([[mi, mj]], float)

    # Force vector (no point loads)
    forceVector = np.zeros((6, 1))

    # Fixed support at node 0
    restrainedDoF = [1, 2, 3]

    # Build and solve
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
    UG = result.UG.flatten()

    print("\n=== Vertical Cantilever with Horizontal UDL ===")
    print(f"wx = {wx} N/m, L = {L} m")
    print(f"\nENForces = {ENForces}")
    print(f"ENMoments = {ENMoments}")
    print(f"\nReactions at node 0 (fixed):")
    print(f"  Fx = {FG[0]:.2f} N")
    print(f"  Fy = {FG[1]:.2f} N")
    print(f"  Mz = {FG[2]:.2f} N·m")
    print(f"\nDisplacements at node 1 (free):")
    print(f"  Ux = {UG[3]:.6f} m")
    print(f"  Uy = {UG[4]:.6f} m")
    print(f"  θ = {UG[5]:.6f} rad")

    # Expected reaction
    print(f"\nExpected reaction (statics):")
    print(f"  Fx = {-wx * L:.2f} N (balances distributed load)")
    print(f"  Fy = 0 N")
    print(f"  Mz = {wx * L * L / 2:.2f} N·m (moment from UDL about base)")

    # Verify
    assert abs(FG[0] - (-wx * L)) < 1e-6, f"Fx reaction mismatch"
    assert abs(FG[1]) < 1e-6, f"Fy should be zero"
    # Moment check depends on sign convention - let's see what we get
    print(f"\nMoment check: got {FG[2]:.2f}, expected {wx * L * L / 2:.2f}")


if __name__ == "__main__":
    test_vertical_cantilever_horizontal_udl()
