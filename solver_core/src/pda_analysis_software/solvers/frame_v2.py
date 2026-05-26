import math
import numpy as np
import copy

class BeamBarStructure_v2:
    """2D beam/bar (frame/truss mix) solver with 3 DoF per node: [Ux, Uy, theta].

    Member types:
      - Frame/beam members (default): axial + bending (6x6 local)
      - Bar members (member numbers listed in `bars`): axial-only (4x4 embedded into Ux,Uy)

    Areas:
      - If A is provided (scalar): used for all members
      - If A_beam and A_bar provided: beam members use A_beam, bar members use A_bar

    Rotational releases on frame/beam members:
      - beamPinLeft  (member numbers with release at node i end rotation)
      - beamPinRight (member numbers with release at node j end rotation)

    Legacy compatibility:
      - Optional `pins` matrix (n_members,2), where 0 indicates a rotational release at that end.
      - Optional `orientations` and `lengths` (if None, computed from nodes).
      - `from_legacy(...)` classmethod matching your original call style.

    Workflow:
      - ENForces/ENMoments are treated as Equivalent Nodal Actions and added to the global force vector.
      - Springs add stiffness to Kp diagonal.
      - restrainedDoF + pinDoF are removed from Ks.
      - solve_structure() runs full pipeline.

    Important fix:
      - Prevents double-counting ENAs if solve_structure() is called multiple times by resetting
        force_vector to the original base vector at the start of each solve.

    Pure-bar joint handling
    -----------------------
    A *pure-bar joint* is a node where every incident member is in `bars`
    (axial-only). Such a joint has no rotational DOF that can be physically
    constrained — there is no rotational element to react against the θ
    moment equation. During stiffness assembly we detect these joints and
    record their θ DOFs in `self._pure_bar_theta_dofs`; the structure
    reduction step (`extract_structure_stiffness_matrix`) unions this list
    with the user-provided `restrainedDoF` / `pinDoF`, deleting the singular
    θ row/column from Ks. This is a structural-engineering invariant, not
    numerical regularisation: see PUREBAR-01..02 in
    .planning/REQUIREMENTS.md and the rejection of regularisation in
    .planning/phases/06-frame-v2-pure-bar-joint-robustness/06-CONTEXT.md (D-02).
    The auto-restraint defers to user intent: nodes whose θ DOF is already
    in `restrainedDoF`, `pinDoF`, or `springDoF` are NOT auto-restrained.
    """

    def __init__(
        self,
        nodes,
        members,
        ENForces,
        ENMoments,
        force_vector,
        E,
        I,
        A=None,              # old style: one area for everything
        A_beam=None,         # new style: beam area
        A_bar=None,          # new style: bar area
        bars=None,           # list of member numbers (1-based) that are bars
        beamPinLeft=None,    # list of beam member numbers pinned at left end
        beamPinRight=None,   # list of beam member numbers pinned at right end
        pins=None,           # optional legacy pins matrix (n_members,2) where 0 means pinned end
        springDoF=None,
        springStiffness=None,
        restrainedDoF=None,
        pinDoF=None,
        orientations=None,   # optional legacy: per-member orientation radians
        lengths=None,        # optional legacy: per-member length
    ):
        # ---- store primary inputs ----
        self.nodes = np.asarray(nodes, float)
        self.members = np.asarray(members, int)
        self.ENForces = np.asarray(ENForces, float)
        self.ENMoments = np.asarray(ENMoments, float)

        fv = np.asarray(force_vector, float).reshape(-1, 1)
        self.force_vector = fv
        self._force_vector_base = fv.copy()  # used to reset before each solve

        self.bars = set(bars or [])
        # Auto-restrained θ DOFs from pure-bar joint detection (1-based ints).
        # Populated by assemble_primary_stiffness_matrix(); consumed by
        # extract_structure_stiffness_matrix(). See class docstring for rationale.
        self._pure_bar_theta_dofs: list[int] = []
        self.beamPinLeft = set(beamPinLeft or [])
        self.beamPinRight = set(beamPinRight or [])

        self.springDoF = list(springDoF or [])
        self.springStiffness = list(springStiffness or [])
        self.restrainedDoF = list(restrainedDoF or [])
        self.pinDoF = list(pinDoF or [])

        # ---- basic validation ----
        if self.nodes.ndim != 2 or self.nodes.shape[1] != 2:
            raise ValueError("nodes must have shape (n_nodes, 2) = [x, y]")

        self.n_nodes = self.nodes.shape[0]
        self.nDoF = self.n_nodes * 3

        if self.force_vector.shape[0] != self.nDoF:
            raise ValueError(
                f"force_vector must have length 3*n_nodes = {self.nDoF}, got {self.force_vector.shape[0]}"
            )

        if self.members.ndim != 2 or self.members.shape[1] != 2:
            raise ValueError("members must have shape (n_members, 2) = [node_i, node_j]")

        self.n_members = self.members.shape[0]
        if self.n_members == 0:
            raise ValueError("members is empty")

        if self.members.min() < 1 or self.members.max() > self.n_nodes:
            raise ValueError("members contain node numbers outside 1..n_nodes")

        # ---- per-member E and I ----
        E_raw = E if isinstance(E, (list, np.ndarray)) else [float(E)] * self.n_members
        I_raw = I if isinstance(I, (list, np.ndarray)) else [float(I)] * self.n_members
        self.Em = np.asarray(E_raw, float)
        self.Im = np.asarray(I_raw, float)

        if self.ENForces.shape != (self.n_members, 2):
            raise ValueError(f"ENForces must have shape ({self.n_members}, 2)")
        if self.ENMoments.shape != (self.n_members, 2):
            raise ValueError(f"ENMoments must have shape ({self.n_members}, 2)")

        # validate dof lists are within range
        for d in (self.springDoF + self.restrainedDoF + self.pinDoF):
            if d < 1 or d > self.nDoF:
                raise ValueError(f"DoF {d} out of range 1..{self.nDoF}")

        # ---- legacy pins matrix support ----
        # pins[e,0]==0 => left release, pins[e,1]==0 => right release
        if pins is not None:
            pins = np.asarray(pins, int)
            if pins.shape != (self.n_members, 2):
                raise ValueError(f"pins must have shape ({self.n_members}, 2)")
            for e in range(self.n_members):
                m = e + 1
                if pins[e, 0] == 0:
                    self.beamPinLeft.add(m)
                if pins[e, 1] == 0:
                    self.beamPinRight.add(m)

        # ---- per-member areas ----
        self.Am = np.zeros(self.n_members, float)
        if A_beam is not None and A_bar is not None:
            A_beam = float(A_beam)
            A_bar = float(A_bar)
            for e in range(self.n_members):
                m = e + 1
                self.Am[e] = A_bar if (m in self.bars) else A_beam
        else:
            if A is None:
                raise ValueError("Provide either A (scalar) OR (A_beam and A_bar).")
            if isinstance(A, (list, np.ndarray)):
                self.Am[:] = np.asarray(A, float)
            else:
                self.Am[:] = float(A)

        # ---- geometry ----
        if orientations is None or lengths is None:
            self.orientations = np.zeros(self.n_members, float)
            self.lengths = np.zeros(self.n_members, float)
            self._compute_geometry()
        else:
            self.orientations = np.asarray(orientations, float).reshape(-1)
            self.lengths = np.asarray(lengths, float).reshape(-1)
            if self.orientations.size != self.n_members or self.lengths.size != self.n_members:
                raise ValueError("orientations and lengths must have length = number of members")

        # ---- matrices/results ----
        self.Kp = np.zeros((self.nDoF, self.nDoF), float)
        self.Ks = None
        self.U = None
        self.UG = None
        self.FG = None

        self.mbrForces = None
        self.mbrShears = None
        self.mbrMoments = None

        self._removed_index = None

    # ---------- legacy constructor ----------
    @classmethod
    def from_legacy(
        cls,
        nodes,
        members,
        ENForces,
        ENMoments,
        orientations,
        force_vector,
        lengths,
        E,
        A,
        I,
        pins,
        springDoF=None,
        springStiffness=None,
        restrainedDoF=None,
        pinDoF=None,
        bars=None,
        beamPinLeft=None,
        beamPinRight=None,
        A_beam=None,
        A_bar=None,
    ):
        return cls(
            nodes=nodes,
            members=members,
            ENForces=ENForces,
            ENMoments=ENMoments,
            force_vector=force_vector,
            E=E,
            I=I,
            A=A,
            A_beam=A_beam,
            A_bar=A_bar,
            bars=bars,
            beamPinLeft=beamPinLeft,
            beamPinRight=beamPinRight,
            pins=pins,
            springDoF=springDoF,
            springStiffness=springStiffness,
            restrainedDoF=restrainedDoF,
            pinDoF=pinDoF,
            orientations=orientations,
            lengths=lengths,
        )

    # ---------- geometry ----------
    def _compute_geometry(self):
        for e, (ni, nj) in enumerate(self.members):
            i = ni - 1
            j = nj - 1
            xi, yi = self.nodes[i]
            xj, yj = self.nodes[j]
            dx, dy = xj - xi, yj - yi
            L = float(math.hypot(dx, dy))
            if L <= 0:
                raise ValueError(f"Zero-length member {e+1} between nodes {ni} and {nj}")
            self.lengths[e] = L
            self.orientations[e] = math.atan2(dy, dx)

    # ---------- element stiffness ----------
    @staticmethod
    def _T_frame(c, s):
        return np.array(
            [
                [c, s, 0, 0, 0, 0],
                [-s, c, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0],
                [0, 0, 0, c, s, 0],
                [0, 0, 0, -s, c, 0],
                [0, 0, 0, 0, 0, 1],
            ],
            float,
        )

    @staticmethod
    def _K_local_frame_6x6(E, A, I, L):
        EA_L = E * A / L
        EI = E * I
        L2 = L * L
        L3 = L2 * L
        return np.array(
            [
                [EA_L, 0, 0, -EA_L, 0, 0],
                [0, 12 * EI / L3, -6 * EI / L2, 0, -12 * EI / L3, -6 * EI / L2],
                [0, -6 * EI / L2, 4 * EI / L, 0, 6 * EI / L2, 2 * EI / L],
                [-EA_L, 0, 0, EA_L, 0, 0],
                [0, -12 * EI / L3, 6 * EI / L2, 0, 12 * EI / L3, 6 * EI / L2],
                [0, -6 * EI / L2, 2 * EI / L, 0, 6 * EI / L2, 4 * EI / L],
            ],
            float,
        )

    @staticmethod
    def _condense_release(K, release_dofs):
        release_dofs = sorted(set(release_dofs))
        keep = [i for i in range(K.shape[0]) if i not in release_dofs]
        if not release_dofs:
            return K, keep

        Kaa = K[np.ix_(keep, keep)]
        Kab = K[np.ix_(keep, release_dofs)]
        Kba = K[np.ix_(release_dofs, keep)]
        Kbb = K[np.ix_(release_dofs, release_dofs)]

        try:
            Kbb_inv = np.linalg.inv(Kbb)
        except np.linalg.LinAlgError:
            Kbb_inv = np.linalg.pinv(Kbb)

        Kc = Kaa - Kab @ Kbb_inv @ Kba
        return Kc, keep

    def _element_frame_global(self, e, rel_i=False, rel_j=False):
        theta = self.orientations[e]
        L = self.lengths[e]
        c, s = math.cos(theta), math.sin(theta)

        A = self.Am[e]
        Kl = self._K_local_frame_6x6(self.Em[e], A, self.Im[e], L)
        T = self._T_frame(c, s)
        Kg = T.T @ Kl @ T

        release = []
        if rel_i:
            release.append(2)
        if rel_j:
            release.append(5)

        Kg_c, keep = self._condense_release(Kg, release)

        ni, nj = self.members[e]
        i = ni - 1
        j = nj - 1
        full_dof = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2]
        dof_kept = [full_dof[k] for k in keep]
        return Kg_c, dof_kept

    def _element_bar_global(self, e):
        theta = self.orientations[e]
        L = self.lengths[e]
        c, s = math.cos(theta), math.sin(theta)

        A = self.Am[e]
        k = self.Em[e] * A / L

        R = np.array([[c * c, c * s], [c * s, s * s]], float)
        Ke = k * np.block([[R, -R], [-R, R]])

        ni, nj = self.members[e]
        i = ni - 1
        j = nj - 1
        dof = [3 * i, 3 * i + 1, 3 * j, 3 * j + 1]
        return Ke, dof

    # ---------- loads (equivalent nodal actions) ----------
    def _condensed_ena_local(self, e, fyi, mi, fyj, mj):
        """Apply static condensation ``f_c = f_a - K_ab @ K_bb^{-1} @ f_b`` to the
        local 6-component ENA for member ``e``, zeroing released-DOF components.

        Uses the same ``_K_local_frame_6x6`` as assembly so the condensed ENA is
        consistent with the condensed element stiffness (``_condense_release``)
        used for that member. Returns a ``(6, 1)`` column vector in local axes
        ``[Nx_i, Vy_i, M_i, Nx_j, Vy_j, M_j]`` suitable for the existing
        ``T.T @ ENA_local`` global rotation step.
        """
        m = e + 1
        rel_i = m in self.beamPinLeft
        rel_j = m in self.beamPinRight

        f = np.array([[0.0, fyi, mi, 0.0, fyj, mj]]).T  # (6, 1)

        if not rel_i and not rel_j:
            return f

        release_dofs = []
        if rel_i:
            release_dofs.append(2)  # local M_i
        if rel_j:
            release_dofs.append(5)  # local M_j

        Kl = self._K_local_frame_6x6(self.Em[e], self.Am[e], self.Im[e], self.lengths[e])
        keep = [k for k in range(6) if k not in release_dofs]

        Kab = Kl[np.ix_(keep, release_dofs)]
        Kbb = Kl[np.ix_(release_dofs, release_dofs)]

        try:
            Kbb_inv = np.linalg.inv(Kbb)
        except np.linalg.LinAlgError:
            Kbb_inv = np.linalg.pinv(Kbb)

        f_a = f[keep, :]
        f_b = f[release_dofs, :]
        f_a_c = f_a - Kab @ Kbb_inv @ f_b

        out = np.zeros((6, 1), float)
        for idx, row in enumerate(keep):
            out[row, 0] = f_a_c[idx, 0]
        # released-DOF rows remain 0 by construction
        return out

    def apply_equivalent_nodal_actions(self):
        for e, (ni, nj) in enumerate(self.members):
            m = e + 1
            if m in self.bars:
                continue

            fyi, fyj = self.ENForces[e, 0], self.ENForces[e, 1]
            mi, mj = self.ENMoments[e, 0], self.ENMoments[e, 1]

            theta = self.orientations[e]
            c, s = math.cos(theta), math.sin(theta)
            T = self._T_frame(c, s)

            ENA_local = self._condensed_ena_local(e, fyi, mi, fyj, mj)
            ENA_global = T.T @ ENA_local

            i = ni - 1
            j = nj - 1
            ia = 3 * i
            ja = 3 * j

            self.force_vector[ia : ia + 3, 0] += ENA_global[0:3, 0]
            self.force_vector[ja : ja + 3, 0] += ENA_global[3:6, 0]

    # ---------- assembly ----------
    def assemble_primary_stiffness_matrix(self):
        self.Kp[:, :] = 0.0
        for e in range(self.n_members):
            m = e + 1
            if m in self.bars:
                Ke, dof = self._element_bar_global(e)
            else:
                rel_i = m in self.beamPinLeft
                rel_j = m in self.beamPinRight
                Ke, dof = self._element_frame_global(e, rel_i=rel_i, rel_j=rel_j)

            self.Kp[np.ix_(dof, dof)] += Ke

        # Pure-bar joint detection (PUREBAR-01, PUREBAR-02; CONTEXT D-01..D-05).
        # A joint where every incident member is a bar has no rotational DOF
        # that can be physically constrained — restraining its θ to zero is
        # mechanically correct, not regularisation. We collect those θ DOFs
        # here; extract_structure_stiffness_matrix unions them with the
        # user-provided restrainedDoF / pinDoF list, deleting the singular
        # row/col from Ks.
        #
        # Indexing convention:
        #   self.members[e] holds 1-based node ids (validated in __init__).
        #   The incidence dict is keyed by 0-based array index so the
        #   lookup loop `for n in range(self.n_nodes)` aligns directly.
        #   Emitted θ DOFs are 1-based via (n + 1) * 3, matching the
        #   restrainedDoF / pinDoF convention.
        #
        # Predicate exclusions (CONTEXT D-04): a node is NOT auto-restrained
        # if its θ DOF is already in restrainedDoF (covered), pinDoF (already
        # released), or springDoF (user explicitly added a Kθ rotational
        # spring — overrides auto-restraint).
        excluded = (
            set(self.restrainedDoF)
            | set(self.pinDoF)
            | set(self.springDoF)
        )
        per_node_incidence: dict[int, list[int]] = {}
        for e in range(self.n_members):
            ni = int(self.members[e][0])  # 1-based node id
            nj = int(self.members[e][1])  # 1-based node id
            per_node_incidence.setdefault(ni - 1, []).append(e + 1)  # key: 0-based
            per_node_incidence.setdefault(nj - 1, []).append(e + 1)
        pure_bar: list[int] = []
        for n in range(self.n_nodes):  # n is 0-based array index
            incident = per_node_incidence.get(n, [])
            if not incident:
                continue
            if all(m in self.bars for m in incident):
                theta_1b = (n + 1) * 3   # θ DOF in 1-based public API
                if theta_1b not in excluded:
                    pure_bar.append(theta_1b)
        self._pure_bar_theta_dofs = pure_bar

    def add_spring_stiffnesses(self):
        if not self.springDoF:
            return
        if len(self.springDoF) != len(self.springStiffness):
            raise ValueError("springDoF and springStiffness must have the same length.")
        for dof1, k in zip(self.springDoF, self.springStiffness):
            idx = dof1 - 1
            self.Kp[idx, idx] += float(k)

    def extract_structure_stiffness_matrix(self):
        removed_dof = self.restrainedDoF + self.pinDoF + self._pure_bar_theta_dofs
        removed_index = sorted({d - 1 for d in removed_dof})
        Ks = np.delete(self.Kp, removed_index, axis=0)
        Ks = np.delete(Ks, removed_index, axis=1)
        self.Ks = Ks
        self._removed_index = removed_index

    # ---------- solve ----------
    def solve_displacements(self):
        if self.Ks is None or self._removed_index is None:
            raise ValueError("Ks not extracted. Run extract_structure_stiffness_matrix() first.")

        f_red = np.delete(self.force_vector, self._removed_index, axis=0)
        try:
            u_red = np.linalg.solve(self.Ks, f_red)
        except np.linalg.LinAlgError as e:
            raise RuntimeError(
                "Singular stiffness matrix. Check supports/releases/bars connectivity."
            ) from e
        self.U = u_red

    def solve_reactions(self):
        if self.U is None:
            raise ValueError("Solve displacements first.")

        UG = np.zeros((self.nDoF, 1), float)
        removed = set(self._removed_index)
        c = 0
        for i in range(self.nDoF):
            if i in removed:
                UG[i, 0] = 0.0
            else:
                UG[i, 0] = self.U[c, 0]
                c += 1

        self.UG = UG
        self.FG = self.Kp @ self.UG

    # ---------- member actions ----------
    def solve_member_actions(self):
        """Recover per-member forces, shears, and moments from the global displacement vector.

        For members with rotational releases (beamPinLeft / beamPinRight) the released end
        rotation stored in UG is the global node rotation set by OTHER members attached at
        that node (via condensed assembly). It is NOT this member's own end rotation.
        Using it directly in ``f_local = Kl @ u_local`` contaminates all force components.

        Fix: back-solve the member's own released rotation from the stiffness-only condensation
        relation (load effects are handled separately by
        ``remove_equivalent_nodal_actions_from_member_actions``):

            K_ba @ u_a + K_bb @ u_b = 0  =>  u_b = -K_bb^{-1} K_ba u_a

        where u_a is the vector of the member's 5 kept local DOFs (obtained from UG via T)
        and u_b is the unknown released rotation. The corrected u_b replaces the contaminated
        value in u_local before applying the full 6x6 Kl. ENA effects are not included in
        the back-solve because ``remove_equivalent_nodal_actions_from_member_actions``
        subtracts the condensed ENA (not the original) afterwards, and the two must stay
        consistent: stiffness-based u_b + condensed-ENA subtraction = correct result.
        """
        if self.UG is None:
            raise ValueError("Global displacement UG not available. Solve reactions first.")

        self.mbrForces = np.zeros(self.n_members, float)
        self.mbrShears = np.zeros((self.n_members, 2), float)
        self.mbrMoments = np.zeros((self.n_members, 2), float)

        for e, (ni, nj) in enumerate(self.members):
            m = e + 1
            theta = self.orientations[e]
            L = self.lengths[e]
            c, s = math.cos(theta), math.sin(theta)

            i = ni - 1
            j = nj - 1

            if m in self.bars:
                dof = [3 * i, 3 * i + 1, 3 * j, 3 * j + 1]
                u = self.UG[dof, 0]
                ext = (-c * u[0] - s * u[1] + c * u[2] + s * u[3])
                self.mbrForces[e] = (self.Em[e] * self.Am[e] / L) * float(ext)
                continue

            A = self.Am[e]
            Kl = self._K_local_frame_6x6(self.Em[e], A, self.Im[e], L)
            T = self._T_frame(c, s)

            dof6 = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2]
            u_global = self.UG[dof6, 0].reshape(6, 1)
            u_local = T @ u_global  # (6,1): [Ux_i, Uy_i, θ_i, Ux_j, Uy_j, θ_j] in local frame

            rel_i = m in self.beamPinLeft
            rel_j = m in self.beamPinRight

            if rel_i or rel_j:
                # Identify which local DOF index is released: 2 (θ_i) or 5 (θ_j)
                release_dofs = []
                if rel_i:
                    release_dofs.append(2)
                if rel_j:
                    release_dofs.append(5)
                keep = [k for k in range(6) if k not in release_dofs]

                # Sub-blocks of local stiffness for stiffness-only back-substitution.
                # Do NOT include ENA in this back-solve: ENA effects are handled
                # consistently by remove_equivalent_nodal_actions_from_member_actions,
                # which subtracts the condensed ENA from the raw stiffness result.
                Kba = Kl[np.ix_(release_dofs, keep)]
                Kbb = Kl[np.ix_(release_dofs, release_dofs)]

                try:
                    Kbb_inv = np.linalg.inv(Kbb)
                except np.linalg.LinAlgError:
                    Kbb_inv = np.linalg.pinv(Kbb)

                # u_a: kept DOFs in local frame (from global UG — correct for all members)
                u_a = u_local[keep, :]

                # Back-solve this member's own released end rotation (stiffness only)
                u_b = -Kbb_inv @ (Kba @ u_a)

                # Reconstruct u_local with the member's own released rotation
                for idx, rdof in enumerate(release_dofs):
                    u_local[rdof, 0] = u_b[idx, 0]

            f_local = Kl @ u_local  # [Nx_i, Vy_i, Mi, Nx_j, Vy_j, Mj]

            self.mbrForces[e] = -float(f_local[0, 0])
            Vy_i = float(f_local[1, 0])
            Vy_j = float(f_local[4, 0])
            Mi = float(f_local[2, 0])
            Mj = float(f_local[5, 0])

            # Released end moment is zero by construction; enforce explicitly to
            # eliminate floating-point residual before ENA subtraction.
            if rel_i:
                Mi = 0.0
            if rel_j:
                Mj = 0.0

            self.mbrShears[e, 0] = Vy_i
            self.mbrShears[e, 1] = Vy_j
            self.mbrMoments[e, 0] = Mi
            self.mbrMoments[e, 1] = Mj

    # ---------- ENA removal ----------
    def remove_equivalent_nodal_actions_from_reactions(self):
        if self.FG is None:
            raise ValueError("FG not available. Solve reactions first.")

        for e, (ni, nj) in enumerate(self.members):
            m = e + 1
            if m in self.bars:
                continue

            fyi, fyj = self.ENForces[e, 0], self.ENForces[e, 1]
            mi, mj = self.ENMoments[e, 0], self.ENMoments[e, 1]

            theta = self.orientations[e]
            c, s = math.cos(theta), math.sin(theta)
            T = self._T_frame(c, s)

            ENA_local = self._condensed_ena_local(e, fyi, mi, fyj, mj)
            ENA_global = T.T @ ENA_local

            i = ni - 1
            j = nj - 1
            ia = 3 * i
            ja = 3 * j

            self.FG[ia : ia + 3, 0] -= ENA_global[0:3, 0]
            self.FG[ja : ja + 3, 0] -= ENA_global[3:6, 0]

    def remove_equivalent_nodal_actions_from_member_actions(self):
        if self.mbrShears is None or self.mbrMoments is None:
            raise ValueError("Member actions not solved yet.")

        for e in range(self.n_members):
            m = e + 1
            if m in self.bars:
                continue

            fyi, fyj = self.ENForces[e, 0], self.ENForces[e, 1]
            mi, mj = self.ENMoments[e, 0], self.ENMoments[e, 1]

            ena = self._condensed_ena_local(e, fyi, mi, fyj, mj).reshape(-1)
            self.mbrShears[e, 0]  -= ena[1]   # Vy_i
            self.mbrShears[e, 1]  -= ena[4]   # Vy_j
            self.mbrMoments[e, 0] -= ena[2]   # M_i
            self.mbrMoments[e, 1] -= ena[5]   # M_j

    # ---------- full pipeline ----------
    def solve_structure(self):
        # IMPORTANT: reset loads to base before re-applying ENAs
        self.force_vector = self._force_vector_base.copy()

        self.assemble_primary_stiffness_matrix()
        self.add_spring_stiffnesses()
        self.apply_equivalent_nodal_actions()
        self.extract_structure_stiffness_matrix()
        self.solve_displacements()
        self.solve_reactions()
        self.solve_member_actions()
        self.remove_equivalent_nodal_actions_from_reactions()
        self.remove_equivalent_nodal_actions_from_member_actions()

    # convenience alias
    def solve(self):
        self.solve_structure()
        return self
