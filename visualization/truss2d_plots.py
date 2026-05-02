"""
Plotting utilities for 2D truss results.

Depends on matplotlib — only import this module in notebooks or UI code,
never inside solver_core or api_server.

Usage:
    from pda_analysis_software.solvers.truss2d import Truss
    from visualization.truss2d_plots import plot_initial_structure, plot_tension_compression

    t = Truss(...)
    t.solve_displacements()
    t.solve_member_forces()

    plot_initial_structure(t)
    plot_tension_compression(t)
"""

import math
import sys
import numpy as np


def _plot_supports(ax, truss):
    for dof in truss.restrainedDoF:
        node_index = (dof - 1) // 2
        is_horizontal = (dof - 1) % 2 == 0
        x, y = truss.nodes[node_index]
        dx, dy = (0.2, 0) if is_horizontal else (0, -0.2)
        ax.arrow(x, y, dx, dy, head_width=0.1, head_length=0.1, fc='green', ec='green')


def plot_initial_structure(truss):
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(12, 10))
    ax.set_aspect('equal')
    for (i1, j1) in truss.members:
        i, j = i1 - 1, j1 - 1
        xi, yi = truss.nodes[i]; xj, yj = truss.nodes[j]
        ax.plot([xi, xj], [yi, yj], 'k-', linewidth=1.5)
        mid_x, mid_y = (xi + xj) / 2, (yi + yj) / 2
        L = math.hypot(xj - xi, yj - yi); offset = 0.05 * L
        nx, ny = -(yj - yi), (xj - xi)
        norm = math.hypot(nx, ny); nx /= norm; ny /= norm
        if ny < 0: nx *= -1; ny *= -1
        label_x = mid_x + offset * nx; label_y = mid_y + offset * ny
        angle_deg = math.degrees(math.atan2(yj - yi, xj - xi)) % 180
        if angle_deg > 90: angle_deg -= 180
        ax.text(label_x, label_y, f'{i1}-{j1}', fontsize=9, rotation=angle_deg,
                color='darkblue', ha='center', va='bottom')

    support_nodes = set((dof - 1) // 2 for dof in truss.restrainedDoF)
    for i, (x, y) in enumerate(truss.nodes):
        node_color = 'green' if i in support_nodes else 'red'
        ax.plot(x, y, 'o', color=node_color)
        ax.text(x + 0.15, y + 0.15, f"{i + 1}", fontsize=10, color='black')
        fx, fy = truss.forceVector[2 * i], truss.forceVector[2 * i + 1]
        if abs(fx) > 1e-3 or abs(fy) > 1e-3:
            angle_rad = math.atan2(fy, fx)
            arrow_dx, arrow_dy = 0.3 * math.cos(angle_rad), 0.3 * math.sin(angle_rad)
            ax.arrow(x, y, arrow_dx, arrow_dy, head_width=0.08, head_length=0.1, fc='red', ec='red')
            text_y_offset = 0.5 * (np.max(truss.nodes[:, 1]) - np.min(truss.nodes[:, 1])) * 0.05
            ax.text(x, y + text_y_offset, f'{math.hypot(fx, fy) / 1000:.2f} kN',
                    fontsize=9, color='red', ha='center', va='bottom',
                    bbox=dict(facecolor='white', edgecolor='none', alpha=0.7, boxstyle='round,pad=0.3'))

    _plot_supports(ax, truss)
    x_min, y_min = np.min(truss.nodes, axis=0); x_max, y_max = np.max(truss.nodes, axis=0)
    x_margin = 0.3 * (x_max - x_min); y_margin = 0.3 * (y_max - y_min)
    ax.set_xlim(x_min - x_margin, x_max + x_margin); ax.set_ylim(y_min - y_margin, y_max + y_margin)
    ax.set_xlabel("Distance (m)"); ax.set_ylabel("Distance (m)")
    ax.set_title("Structure to Analyse"); ax.grid(True)
    plt.show()


def plot_tension_compression(truss):
    import matplotlib.pyplot as plt

    if truss.mbrForces is None:
        raise ValueError("Run solve_member_forces() first.")
    fig, ax = plt.subplots(figsize=(12, 10)); ax.set_aspect('equal')
    for n, (i1, j1) in enumerate(truss.members):
        i, j = i1 - 1, j1 - 1
        xi, yi = truss.nodes[i]; xj, yj = truss.nodes[j]
        force_kN = truss.mbrForces[n] / 1000.0
        if abs(truss.mbrForces[n]) < 1e-3:    color, linestyle = 'gray', '--'
        elif truss.mbrForces[n] > 0:           color, linestyle = 'blue', '-'
        else:                                  color, linestyle = 'red', '-'
        ax.plot([xi, xj], [yi, yj], color=color, linestyle=linestyle, linewidth=1.5)
        mid_x, mid_y = (xi + xj) / 2, (yi + yj) / 2
        L = math.hypot(xj - xi, yj - yi); text_offset = 0.05 * L
        nx, ny = -(yj - yi), (xj - xi); norm = math.hypot(nx, ny); nx /= norm; ny /= norm
        if ny < 0: nx *= -1; ny *= -1
        text_x = mid_x + text_offset * nx; text_y = mid_y + text_offset * ny
        angle_deg = math.degrees(math.atan2(yj - yi, xj - xi)) % 180
        if angle_deg > 90: angle_deg -= 180
        ax.text(text_x, text_y, f"{force_kN:.2f} kN", fontsize=8, color=color,
                ha='center', va='bottom', rotation=angle_deg)

    reactions = truss.solve_reactions()
    support_nodes = set((dof - 1) // 2 for dof in truss.restrainedDoF)
    for i, (x, y) in enumerate(truss.nodes):
        node_color = 'green' if i in support_nodes else 'black'
        ax.plot(x, y, 'o', color=node_color)
        ax.text(x + 0.05, y + 0.05, f"{i + 1}", fontsize=10, color='black')
        if i in support_nodes:
            fx = reactions[2 * i, 0] / 1000
            fy = reactions[2 * i + 1, 0] / 1000
            ax.text(x, y - 0.4, f"{fx:.2f} kN\n{fy:.2f} kN", fontsize=8,
                    bbox=dict(facecolor='white', alpha=0.6, boxstyle='round,pad=0.3'),
                    ha='center', va='top', color='green')

    _plot_supports(ax, truss)
    x_min, y_min = np.min(truss.nodes, axis=0); x_max, y_max = np.max(truss.nodes, axis=0)
    x_margin = 0.15 * (x_max - x_min); y_margin = 0.15 * (y_max - y_min)
    ax.set_xlim(x_min - x_margin, x_max + x_margin); ax.set_ylim(y_min - y_margin, y_max + y_margin)
    ax.set_xlabel("Distance (m)"); ax.set_ylabel("Distance (m)")
    ax.set_title("Tension/Compression Members with Forces"); ax.grid(True)
    plt.show()


def plot_deflected_shape(truss, scale=1.0):
    import matplotlib.pyplot as plt

    if truss.UG is None:
        raise ValueError("Run solve_displacements() first.")
    fig, ax = plt.subplots(figsize=(12, 10)); ax.set_aspect('equal')
    for (i1, j1) in truss.members:
        i, j = i1 - 1, j1 - 1
        xi, yi = truss.nodes[i]; xj, yj = truss.nodes[j]
        ia, ib = 2 * i, 2 * i + 1; ja, jb = 2 * j, 2 * j + 1
        ax.plot([xi, xj], [yi, yj], 'gray', linewidth=0.75)
        xi_def = xi + float(truss.UG[ia, 0]) * scale
        yi_def = yi + float(truss.UG[ib, 0]) * scale
        xj_def = xj + float(truss.UG[ja, 0]) * scale
        yj_def = yj + float(truss.UG[jb, 0]) * scale
        ax.plot([xi_def, xj_def], [yi_def, yj_def], 'r-', linewidth=1.5)

    for i, (x, y) in enumerate(truss.nodes):
        ux = float(truss.UG[2 * i, 0]) * scale
        uy = float(truss.UG[2 * i + 1, 0]) * scale
        def_x, def_y = x + ux, y + uy
        ax.plot(x, y, 'bo'); ax.text(x + 0.1, y + 0.1, f"{i + 1}", fontsize=10)
        disp_mm = math.hypot(ux, uy) * 1000
        ax.text(def_x, def_y + 0.1, f"{disp_mm:.2f} mm", fontsize=8, color='purple', ha='center')

    _plot_supports(ax, truss)
    x_min, y_min = np.min(truss.nodes, axis=0); x_max, y_max = np.max(truss.nodes, axis=0)
    x_margin = 0.1 * (x_max - x_min); y_margin = 0.1 * (y_max - y_min)
    ax.set_xlim(x_min - x_margin, x_max + x_margin); ax.set_ylim(y_min - y_margin, y_max + y_margin)
    ax.set_xlabel("Distance (m)"); ax.set_ylabel("Distance (m)")
    ax.set_title("Deflected Shape"); ax.grid(True)
    plt.show()


def animate_deformation(truss, scale=1.0, frames=20, interval=100):
    import matplotlib.pyplot as plt
    import matplotlib.animation as animation

    if truss.UG is None:
        raise ValueError("Run solve_displacements() first.")
    fig, ax = plt.subplots(figsize=(12, 10)); ax.set_aspect('equal')
    x_min, y_min = np.min(truss.nodes, axis=0); x_max, y_max = np.max(truss.nodes, axis=0)
    x_margin = 0.3 * (x_max - x_min); y_margin = 0.3 * (y_max - y_min)
    ax.set_xlim(x_min - x_margin, x_max + x_margin); ax.set_ylim(y_min - y_margin, y_max + y_margin)
    ax.set_xlabel("Distance (m)"); ax.set_ylabel("Distance (m)")
    ax.set_title("Animated Deformation"); ax.grid(True)

    for (i1, j1) in truss.members:
        i, j = i1 - 1, j1 - 1
        xi, yi = truss.nodes[i]; xj, yj = truss.nodes[j]
        ax.plot([xi, xj], [yi, yj], 'gray', linewidth=1, linestyle='--')

    _plot_supports(ax, truss)
    lines = [ax.plot([], [], 'r-', linewidth=2)[0] for _ in truss.members]

    def init():
        for line in lines: line.set_data([], [])
        return lines

    def update(frame):
        factor = frame / frames * scale
        for k, (i1, j1) in enumerate(truss.members):
            i, j = i1 - 1, j1 - 1
            xi, yi = truss.nodes[i]; xj, yj = truss.nodes[j]
            ia, ib = 2 * i, 2 * i + 1; ja, jb = 2 * j, 2 * j + 1
            xi_def = xi + float(truss.UG[ia, 0]) * factor
            yi_def = yi + float(truss.UG[ib, 0]) * factor
            xj_def = xj + float(truss.UG[ja, 0]) * factor
            yj_def = yj + float(truss.UG[jb, 0]) * factor
            lines[k].set_data([xi_def, xj_def], [yi_def, yj_def])
        return lines

    ani = animation.FuncAnimation(fig, update, frames=frames + 1,
                                   init_func=init, blit=False, interval=interval)
    plt.ion(); plt.show()
    return ani


def show_animation(ani):
    from IPython.display import HTML

    if ani is None:
        print("No animation provided.")
        return
    if 'ipykernel' in sys.modules:
        return HTML(ani.to_jshtml())
    else:
        print("Animation object ready. Use plt.show() to view it in this environment.")
