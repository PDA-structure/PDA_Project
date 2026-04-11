import numpy as np
from pda_analysis_software.results.results import AnalysisResult
from pda_analysis_software.models.truss2d_model import TrussModel2D

# IMPORTANT: change this import to match your actual truss class file/class name
from pda_analysis_software.solvers.truss2d import Truss


class Truss2DAdapter:
    def __init__(self, model: TrussModel2D):
        self.model = model

    def solve(self) -> AnalysisResult:
        t = Truss(
            nodes=self.model.nodes,
            members=self.model.members,
            E=self.model.E,
            A=self.model.A,
            forceVector=self.model.forceVector,
            restrainedDoF=self.model.restrainedDoF,
        )
        t.solve_displacements()
        t.solve_member_forces()
        FG = t.solve_reactions()

        member_forces_arr = np.array(t.mbrForces, float) if t.mbrForces is not None else None
        member_stresses = member_forces_arr / self.model.A if member_forces_arr is not None else None

        return AnalysisResult(
            solver="truss2d",
            UG=np.array(t.UG, float),
            FG=np.array(FG, float),
            member_forces=member_forces_arr,
            meta={
                "n_nodes": int(t.nodes.shape[0]),
                "n_members": int(len(t.members)),
                "member_stresses": member_stresses.tolist() if member_stresses is not None else None,
            },
        )