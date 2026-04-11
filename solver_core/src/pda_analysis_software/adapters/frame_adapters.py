import numpy as np
from pda_analysis_software.results.results import AnalysisResult
from pda_analysis_software.models.frame2d_model import FrameModel2D

from pda_analysis_software.solvers.frame_v2 import BeamBarStructure_v2
# If you want v1 too:
#from pda_analysis_software.solvers.frame_v1_legacy import BeamBarStructure
#from pda_analysis_software.solvers.truss2d import Truss

class FrameV2Adapter:
    def __init__(self, model: FrameModel2D):
        self.model = model

    def solve(self) -> AnalysisResult:
        s = BeamBarStructure_v2(
            nodes=self.model.nodes,
            members=self.model.members,
            ENForces=self.model.ENForces,
            ENMoments=self.model.ENMoments,
            force_vector=self.model.forceVector,
            E=self.model.E,
            I=self.model.I,
            A=self.model.A,
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

        # Determine effective area for stress calculation
        A_eff = self.model.A
        if A_eff is None:
            A_eff = self.model.A_beam if self.model.A_beam is not None else 1.0

        member_forces_arr = np.array(s.mbrForces, float) if s.mbrForces is not None else None
        member_stresses = member_forces_arr / A_eff if member_forces_arr is not None else None

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
                "member_stresses": member_stresses.tolist() if member_stresses is not None else None,
            },
        )