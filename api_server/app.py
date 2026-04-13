import math
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Union
import numpy as np

from pda_analysis_software.engine.analysis_engine import AnalysisEngine
from pda_analysis_software.models.frame2d_model import FrameModel2D
from pda_analysis_software.models.truss2d_model import TrussModel2D
from pda_analysis_software.adapters.frame_adapters import FrameV2Adapter
from pda_analysis_software.adapters.truss_adapters import Truss2DAdapter

app = FastAPI(title="PDA Analysis Software API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    return JSONResponse(
        status_code=422,
        content={"detail": "structure is unstable or under-restrained"},
    )


# ---- register solvers once ----
engine = AnalysisEngine()
engine.register("frame_v2", lambda model: FrameV2Adapter(model))
engine.register("truss2d", lambda model: Truss2DAdapter(model))


@app.get("/health")
def health():
    return {"status": "ok", "solvers": engine.available_solvers()}


class Frame2DRequest(BaseModel):
    solver: str = "frame_v2"
    nodes: List[List[float]]
    members: List[List[int]]
    ENForces: List[List[float]]
    ENMoments: List[List[float]]
    forceVector: List[float]

    E: Union[float, List[float]]
    I: Union[float, List[float]]
    A: Optional[Union[float, List[float]]] = None
    A_beam: Optional[float] = None
    A_bar: Optional[float] = None

    bars: List[int] = []
    beamPinLeft: List[int] = []
    beamPinRight: List[int] = []
    pins: Optional[List[List[int]]] = None

    restrainedDoF: List[int] = []
    pinDoF: List[int] = []
    springDoF: List[int] = []
    springStiffness: List[float] = []
    udl_x: Optional[List[float]] = None   # one value per member, N/m, positive = left-to-right


@app.post("/solve/frame2d")
def solve_frame2d(req: Frame2DRequest):
    # --- Horizontal UDL (w_x) assembly ---
    # w_x contributes:
    #   X-DOF nodal forces: -w_x*L/2 at start node, -w_x*L/2 at end node
    #   Fixed-end moments: +w_x*L^2/12 at start, -w_x*L^2/12 at end
    fv = list(req.forceVector)          # mutable copy (flat, length = 3*n_nodes)
    en_moments = [list(row) for row in req.ENMoments]  # mutable copy

    if req.udl_x:
        nodes_arr = req.nodes           # list of [x,y]
        for ei, wx in enumerate(req.udl_x):
            if wx == 0.0:
                continue
            ni, nj = req.members[ei][0] - 1, req.members[ei][1] - 1   # 0-based node indices
            xi, yi = nodes_arr[ni]
            xj, yj = nodes_arr[nj]
            L = ((xj - xi) ** 2 + (yj - yi) ** 2) ** 0.5
            if L == 0:
                continue
            # Project global-X load into local member frame via direction cosines
            theta = math.atan2(yj - yi, xj - xi)
            c, s = math.cos(theta), math.sin(theta)

            # Local axial and transverse components of global-X distributed load
            wx_a = wx * c       # local axial force per unit length
            wx_t = -wx * s      # local transverse force per unit length

            # Fixed-end forces in LOCAL frame (6-component: [fx_i, fy_i, m_i, fx_j, fy_j, m_j])
            fx_i_loc = -wx_a * L / 2
            fy_i_loc = -wx_t * L / 2
            mi_loc   =  wx_t * L * L / 12
            fx_j_loc = -wx_a * L / 2
            fy_j_loc = -wx_t * L / 2
            mj_loc   = -wx_t * L * L / 12

            # Rotate to global: ENA_global = T^T @ ENA_local
            fx_i_g =  c * fx_i_loc - s * fy_i_loc
            fy_i_g =  s * fx_i_loc + c * fy_i_loc
            mi_g   =  mi_loc
            fx_j_g =  c * fx_j_loc - s * fy_j_loc
            fy_j_g =  s * fx_j_loc + c * fy_j_loc
            mj_g   =  mj_loc

            # Inject into global force vector (0-based flat index: node*3 + dof)
            fv[ni * 3 + 0] += fx_i_g
            fv[ni * 3 + 1] += fy_i_g
            fv[nj * 3 + 0] += fx_j_g
            fv[nj * 3 + 1] += fy_j_g
            # Moments go into en_moments (consumed by solver via ENMoments path)
            en_moments[ei][0] += mi_g
            en_moments[ei][1] += mj_g

    model = FrameModel2D(
        nodes=np.array(req.nodes, float),
        members=np.array(req.members, int),
        ENForces=np.array(req.ENForces, float),
        ENMoments=np.array(en_moments, float),
        forceVector=np.array(fv, float).reshape(-1, 1),
        E=req.E,
        I=req.I,
        A=req.A,
        A_beam=req.A_beam,
        A_bar=req.A_bar,
        bars=req.bars,
        beamPinLeft=req.beamPinLeft,
        beamPinRight=req.beamPinRight,
        pins=np.array(req.pins, int) if req.pins is not None else None,
        restrainedDoF=req.restrainedDoF,
        pinDoF=req.pinDoF,
        springDoF=req.springDoF,
        springStiffness=req.springStiffness,
    )

    result = engine.solve(model, solver_name=req.solver)

    # Return JSON-friendly lists
    return {
        "solver": result.solver,
        "UG": result.UG.reshape(-1).tolist(),
        "FG": result.FG.reshape(-1).tolist(),
        "member_forces": None if result.member_forces is None else result.member_forces.reshape(-1).tolist(),
        "member_shears": None if result.member_shears is None else result.member_shears.tolist(),
        "member_moments": None if result.member_moments is None else result.member_moments.tolist(),
        "meta": result.meta or {},
    }


class Truss2DRequest(BaseModel):
    solver: str = "truss2d"
    nodes: List[List[float]]
    members: List[List[int]]
    E: float
    A: float
    forceVector: List[float]
    restrainedDoF: List[int]


@app.post("/solve/truss2d")
def solve_truss2d(req: Truss2DRequest):
    model = TrussModel2D(
        nodes=np.array(req.nodes, float),
        members=np.array(req.members, int),
        E=req.E,
        A=req.A,
        forceVector=np.array(req.forceVector, float),
        restrainedDoF=req.restrainedDoF,
    )
    result = engine.solve(model, solver_name=req.solver)
    return {
        "solver": result.solver,
        "UG": result.UG.reshape(-1).tolist(),
        "FG": result.FG.reshape(-1).tolist(),
        "member_forces": None if result.member_forces is None else result.member_forces.reshape(-1).tolist(),
        "meta": result.meta or {},
    }