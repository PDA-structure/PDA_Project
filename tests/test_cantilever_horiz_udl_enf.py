"""
Simplest test: vertical cantilever with horizontal UDL using ENForces ONLY.
Compare with the calibration test which uses the same setup.
"""
import numpy as np
import math
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_cantilever_horizontal_udl_enf_only():
    """Vertical cantilever with horizontal UDL via ENForces."""

    nodes = np.array([[0.0, 0.0], [0.0, 6.0]], float)
    members = np.array([[1, 2]], int)

    E = 200e9
    I = 0.01
    A = 0.01

    L = 6.0
    theta = math.pi / 2
    c, s = 0.0, 1.0

    wx = 4000  # N/m rightward

    # Horizontal UDL via ENForces
    q_local_y = wx * (-s)  # = -4000
    ENF_i = q_local_y * L / 2  # = -12000
    ENF_j = q_local_y * L / 2  # = -12000
    ENM_i = q_local_y * L**2 / 12  # = -12000
    ENM_j = -q_local_y * L**2 / 12  # = +12000

    ENForces = np.array([[ENF_i, ENF_j]], float)
    ENMoments = np.array([[ENM_i, ENM_j]], float)

    forceVector = np.zeros((6, 1))  # NO direct forces
    restrainedDoF = [1, 2, 3]

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

    print("\n=== Cantilever with Horizontal UDL (ENForces ONLY) ===")
    print(f"wx = {wx} N/m, L = {L} m")
    print(f"\nReactions at node 0 (fixed):")
    print(f"  Fx = {FG[0]:.2f} N")
    print(f"  Fy = {FG[1]:.2f} N")
    print(f"  Mz = {FG[2]:.2f} N·m")

    # Expected from calibration test
    print(f"\nExpected (from calibration test):")
    print(f"  Fx = -24000.00 N")
    print(f"  Fy = 0.00 N")
    print(f"  Mz = -72000.00 N·m")

    # Check
    assert abs(FG[0] - (-24000)) < 1, f"Fx mismatch: {FG[0]}"
    assert abs(FG[1]) < 1, f"Fy should be zero: {FG[1]}"
    assert abs(FG[2] - (-72000)) < 1, f"Mz mismatch: {FG[2]}"

    print("\n✓ All checks passed - ENForces approach works!")


if __name__ == "__main__":
    test_cantilever_horizontal_udl_enf_only()
