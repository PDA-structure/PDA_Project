import numpy as np
from pda_analysis_software.results.results import AnalysisResult
from pda_analysis_software.models.frame2d_model import FrameModel2D

from pda_analysis_software.solvers.frame_v2 import BeamBarStructure_v2
from pda_analysis_software.errors import SolverDiagnosticError
# If you want v1 too:
#from pda_analysis_software.solvers.frame_v1_legacy import BeamBarStructure
#from pda_analysis_software.solvers.truss2d import Truss

class FrameV2Adapter:
    def __init__(self, model: FrameModel2D):
        self.model = model

    def solve(self) -> AnalysisResult:
        n = len(self.model.members)
        E_raw = self.model.E
        I_raw = self.model.I
        A_raw = self.model.A

        E_list = E_raw if isinstance(E_raw, list) else [float(E_raw)] * n
        I_list = I_raw if isinstance(I_raw, list) else [float(I_raw)] * n

        if A_raw is None:
            A_list = None
        elif isinstance(A_raw, list):
            A_list = A_raw
        else:
            A_list = [float(A_raw)] * n

        if len(E_list) != n or len(I_list) != n:
            raise ValueError(f"E/I list length must equal n_members={n}")
        if A_list is not None and len(A_list) != n:
            raise ValueError(f"A list length must equal n_members={n}")

        # Phase 6 PUREBAR-03 (D-06): reject UDL applied to bar members.
        # Bars are axial-only; equivalent nodal moments / transverse forces
        # cannot be applied. Pre-fix behaviour silently dropped them in
        # frame_v2.apply_equivalent_nodal_actions; we now reject loudly at
        # the adapter so the user gets actionable feedback rather than
        # a wrong-but-plausible result.
        udl_on_bar: list[int] = []
        for m in (self.model.bars or []):    # m is 1-based
            e = m - 1
            if e < 0 or e >= n:
                continue
            if (
                np.any(self.model.ENForces[e] != 0.0)
                or np.any(self.model.ENMoments[e] != 0.0)
            ):
                udl_on_bar.append(int(m))
        if udl_on_bar:
            raise SolverDiagnosticError(
                detail=(
                    f"UDL applied to bar member(s) {udl_on_bar} — "
                    f"bars are axial-only. Change the member type to "
                    f"'beam' or remove the UDL."
                ),
                cause="udl_on_bar",
                offending_members=udl_on_bar,
            )

        s = BeamBarStructure_v2(
            nodes=self.model.nodes,
            members=self.model.members,
            ENForces=self.model.ENForces,
            ENMoments=self.model.ENMoments,
            force_vector=self.model.forceVector,
            E=E_list,
            I=I_list,
            A=A_list,
            A_beam=self.model.A_beam,
            A_bar=self.model.A_bar,
            bars=self.model.bars,
            beamPinLeft=self.model.beamPinLeft,
            beamPinRight=self.model.beamPinRight,
            pins=self.model.pins,
            springDoF=self.model.springDoF,
            springStiffness=self.model.springStiffness,
            restrainedDoF=self.model.restrainedDoF,
            pinDoF=self.model.pinDoF,
        )

        s.solve_structure()

        A_eff_arr = np.array(s.Am, float)

        # Build (n_members, 2) axial force array: [N_i, N_j] per member.
        # The solver gives a single constant N per member (correct for the
        # point-load FEM model). When the model carries ENAxialForces —
        # the axial equivalent nodal forces from a distributed axial load
        # (e.g. vertical UDL decomposed onto an inclined member) — we
        # correct each end:
        #   N_i = N_avg + ENAx_i   (toward i-end, load accumulates)
        #   N_j = N_avg - ENAx_j   (toward j-end, load depletes)
        if s.mbrForces is not None:
            n_mbr = len(s.mbrForces)
            member_forces_arr = np.zeros((n_mbr, 2), float)
            ena = self.model.ENAxialForces
            for e in range(n_mbr):
                n_avg = float(s.mbrForces[e])
                if ena is not None and ena.shape[0] > e:
                    member_forces_arr[e, 0] = n_avg + float(ena[e, 0])
                    member_forces_arr[e, 1] = n_avg - float(ena[e, 1])
                else:
                    member_forces_arr[e, 0] = n_avg
                    member_forces_arr[e, 1] = n_avg
        else:
            member_forces_arr = None

        member_stresses = None
        if member_forces_arr is not None:
            member_stresses = (member_forces_arr / A_eff_arr[:, np.newaxis]).tolist()

        return AnalysisResult(
            solver="frame_v2",
            UG=np.array(s.UG, float),
            FG=np.array(s.FG, float),
            member_forces=member_forces_arr,
            member_shears=np.array(s.mbrShears, float) if s.mbrShears is not None else None,
            member_moments=np.array(s.mbrMoments, float) if s.mbrMoments is not None else None,
            meta={
                "n_nodes": int(s.n_nodes),
                "n_members": int(s.n_members),
                "member_stresses": member_stresses,
            },
        )