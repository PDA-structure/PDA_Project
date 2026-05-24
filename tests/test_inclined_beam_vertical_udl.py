"""
Single inclined beam with vertical UDL - analytical verification.

Simple case: fixed-fixed inclined beam at 45° with vertical UDL.
We can verify this against standard beam formulas.

Structure: nodes at (0,0) and (L*cos45, L*sin45), both fixed
Load: w N/m downward (vertical, global -Y)
Length: L = 10m along the beam axis
Angle: θ = 45°

For a fixed-fixed beam with uniform transverse load q_transverse:
- Reactions: V = qL/2 at each end (transverse direction)
- Moments: M = qL²/12 at each end

But our load is GLOBAL vertical, so we need to:
1. Decompose to local components
2. Apply both transverse and axial ENAs
3. Verify equilibrium
"""
import numpy as np
import math
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter


def test_inclined_beam_vertical_udl_45deg():
    """Inclined beam at 45° with vertical UDL."""

    L = 10.0  # beam length along axis
    theta = math.pi / 4  # 45°
    c = math.cos(theta)  # 0.707
    s = math.sin(theta)  # 0.707

    # Nodes
    x1, y1 = 0.0, 0.0
    x2 = L * c  # 7.071
    y2 = L * s  # 7.071

    nodes = np.array([[x1, y1], [x2, y2]], float)
    members = np.array([[1, 2]], int)

    E = 200e9
    I = 0.01
    A = 0.01

    # Vertical UDL: w = 1000 N/m downward
    w = 1000

    # Decompose to local components
    # q_local_y (transverse) = w * cos(θ) = 1000 * 0.707 = 707 N/m
    # q_local_x (axial) = -w * sin(θ) = -1000 * 0.707 = -707 N/m (compressive)

    q_y = w * c
    q_x = -w * s

    # ENForces/ENMoments (transverse component only)
    ENF_i = -(q_y * L) / 2  # -3536 N
    ENF_j = -(q_y * L) / 2  # -3536 N
    ENM_i = (q_y * L**2) / 12  # 5893 N·m
    ENM_j = -(q_y * L**2) / 12  # -5893 N·m

    ENForces = np.array([[ENF_i, ENF_j]], float)
    ENMoments = np.array([[ENM_i, ENM_j]], float)

    # Axial component: add directly to forceVector in GLOBAL coords
    # For compressive distributed axial load, forces point toward each other
    # Node i: force along +local_x direction
    # Node j: force along -local_x direction
    f_axial = q_x * L / 2  # = -707 * 10 / 2 = -3536 N (magnitude)

    forceVector = np.zeros((6, 1))
    # Node i (index 0,1,2 for 0-based, but DOF 1,2,3 in 1-based)
    forceVector[0, 0] = f_axial * c  # Fx: along +local_x
    forceVector[1, 0] = f_axial * s  # Fy
    # Node j (index 3,4,5)
    forceVector[3, 0] = -f_axial * c  # Fx: along -local_x (opposite)
    forceVector[4, 0] = -f_axial * s  # Fy

    # Both ends fixed
    restrainedDoF = [1, 2, 3, 4, 5, 6]

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

    print(f"\n=== Inclined Beam 45° with Vertical UDL ===")
    print(f"Length L = {L} m, θ = 45°, w = {w} N/m (vertical)")
    print(f"\nLocal components:")
    print(f"  q_transverse = {q_y:.2f} N/m")
    print(f"  q_axial = {q_x:.2f} N/m")
    print(f"\nNode 0 reactions:")
    print(f"  Fx = {FG[0]:.2f} N")
    print(f"  Fy = {FG[1]:.2f} N")
    print(f"  Mz = {FG[2]:.2f} N·m")
    print(f"\nNode 1 reactions:")
    print(f"  Fx = {FG[3]:.2f} N")
    print(f"  Fy = {FG[4]:.2f} N")
    print(f"  Mz = {FG[5]:.2f} N·m")

    # Check equilibrium
    total_load_y = -w * L  # -10000 N (downward)
    total_reaction_y = FG[1] + FG[4]
    print(f"\nVertical equilibrium:")
    print(f"  Total vertical load = {total_load_y} N")
    print(f"  Total vertical reaction = {total_reaction_y:.2f} N")
    print(f"  Difference = {total_reaction_y + total_load_y:.2f} N")

    assert abs(total_reaction_y + total_load_y) < 1, "Vertical equilibrium violated"

    # Horizontal should be zero (symmetric load)
    total_reaction_x = FG[0] + FG[3]
    print(f"\nHorizontal equilibrium:")
    print(f"  Total horizontal reaction = {total_reaction_x:.2f} N (should be ~0)")
    assert abs(total_reaction_x) < 1, "Horizontal equilibrium violated"

    print("\n✓ Both equilibrium checks passed")


if __name__ == "__main__":
    test_inclined_beam_vertical_udl_45deg()
