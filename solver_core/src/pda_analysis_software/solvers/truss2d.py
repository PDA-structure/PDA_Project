import math
import numpy as np

class Truss:
    def __init__(self, nodes, members, E, A, forceVector, restrainedDoF):
        # --- store inputs ---
        self.nodes = np.asarray(nodes, float)
        self.members = np.asarray(members, int)
        self.E = E  # scalar or per-member array
        self.A = A  # scalar or per-member array
        fv = np.asarray(forceVector, float)
        self.forceVector = fv.reshape(-1)  # keep 1-D internally
        self.restrainedDoF = list(restrainedDoF)

        # --- normalize indexing / sizes ---
        # accept members as 1-based or 0-based; store 0-based internally
        self.members0 = self.members - 1 if self.members.min() == 1 else self.members.copy()
        self.n_nodes = self.nodes.shape[0]
        self.ndof = 2 * self.n_nodes

        assert self.forceVector.size == self.ndof, \
            f"forceVector length must be 2*n_nodes (= {self.ndof}), got {self.forceVector.size}"

        # convert restrained dof to 0-based
        self.restrained0 = sorted({d - 1 for d in self.restrainedDoF})
        for d in self.restrained0:
            if d < 0 or d >= self.ndof:
                raise ValueError(f"Restrained DoF {d+1} out of range 1..{self.ndof}")

        # allow scalar or per-member E/A
        self.E = np.asarray(self.E, float) if np.ndim(self.E) else float(self.E)
        self.A = np.asarray(self.A, float) if np.ndim(self.A) else float(self.A)

        # internals
        self.orientations = []
        self.lengths = []
        self.Kp = None
        self.Ks = None
        self.UG = None
        self.mbrForces = None

        # precompute geometry + stiffness
        self._compute_geometry()
        self._assemble_global_stiffness()

    # -------- helpers --------
    def _E(self, e):  # per-member or scalar
        return self.E[e] if isinstance(self.E, np.ndarray) else self.E

    def _A(self, e):
        return self.A[e] if isinstance(self.A, np.ndarray) else self.A

    def _compute_geometry(self):
        self.orientations.clear()
        self.lengths.clear()
        for (i, j) in self.members0:
            xi, yi = self.nodes[i]
            xj, yj = self.nodes[j]
            dx, dy = xj - xi, yj - yi
            L = float(np.hypot(dx, dy))
            if L <= 0.0:
                raise ValueError(f"Zero-length member between nodes {i+1} and {j+1}")
            self.lengths.append(L)
            self.orientations.append(math.atan2(dy, dx))

    def _assemble_global_stiffness(self):
        self.Kp = np.zeros((self.ndof, self.ndof), dtype=float)
        for e, (i, j) in enumerate(self.members0):
            c = math.cos(self.orientations[e]); s = math.sin(self.orientations[e])
            L = self.lengths[e]
            k = self._E(e) * self._A(e) / L
            # 2D truss, embedded in 2 dof/node model (ux, uy)
            Ke = k * np.array([
                [ c*c,  c*s, -c*c, -c*s],
                [ c*s,  s*s, -c*s, -s*s],
                [-c*c, -c*s,  c*c,  c*s],
                [-c*s, -s*s,  c*s,  s*s],
            ])
            dof = [2*i, 2*i+1, 2*j, 2*j+1]
            self.Kp[np.ix_(dof, dof)] += Ke

        # partition dofs
        self.fixed = np.array(self.restrained0, dtype=int)
        self.free  = np.setdiff1d(np.arange(self.ndof), self.fixed)

        # quick sanity check
        if self.free.size == 0:
            raise RuntimeError("All DoFs are restrained; nothing to solve.")
        # reduced stiffness for solve
        self.Ks = self.Kp[np.ix_(self.free, self.free)]

    # -------- solve & results --------
    def solve_displacements(self):
        f_red = self.forceVector[self.free]
        try:
            u_free = np.linalg.solve(self.Ks, f_red)
        except np.linalg.LinAlgError as e:
            raise RuntimeError("Singular stiffness matrix. Check supports/connectivity.") from e

        UG = np.zeros(self.ndof)
        UG[self.free] = u_free
        # fixed dofs assumed zero
        self.UG = UG.reshape(-1, 1)

    def solve_member_forces(self):
        if self.UG is None:
            raise ValueError("Run solve_displacements() first.")
        self.mbrForces = np.zeros(len(self.members0))
        for e, (i, j) in enumerate(self.members0):
            c = math.cos(self.orientations[e]); s = math.sin(self.orientations[e]); L = self.lengths[e]
            k = self._E(e) * self._A(e) / L
            u = np.array([self.UG[2*i,0], self.UG[2*i+1,0], self.UG[2*j,0], self.UG[2*j+1,0]])
            # axial projection (tension +)
            N = k * ( -c*u[0] - s*u[1] + c*u[2] + s*u[3] )
            self.mbrForces[e] = N

    def solve_reactions(self):
        if self.UG is None:
            raise ValueError("Run solve_displacements() first.")
        return self.Kp @ self.UG

    def get_member_axial_design_data(self):
        """
        Returns design-ready axial data per member:
        member_id (1-based), start node, end node,
        length (m), axial force NEd (N, tension +)
        """
        if self.mbrForces is None:
            raise ValueError("Run solve_member_forces() first.")
    
        data = []
        for e, (ni, nj) in enumerate(self.members):  # members are 1-based already
            data.append({
                "member_id": e + 1,
                "i": int(ni),
                "j": int(nj),
                "L": float(self.lengths[e]),
                "NEd": float(self.mbrForces[e]),  # N (tension +)
            })
        return data






