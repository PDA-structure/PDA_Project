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
from pda_analysis_software.errors import SolverDiagnosticError

app = FastAPI(title="PDA Analysis Software API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    # Phase 6 D-09 / D-13: if the exception is a SolverDiagnosticError
    # (or any RuntimeError subclass that exposes the structured attrs),
    # surface a structured 422 payload. Otherwise fall back to the flat
    # legacy payload — backward-compatible with all existing UI readers
    # that only inspect `detail`.
    if isinstance(exc, SolverDiagnosticError) or hasattr(exc, "cause"):
        return JSONResponse(
            status_code=422,
            content={
                "detail": getattr(exc, "detail", str(exc)),
                "cause": getattr(exc, "cause", None),
                "offending_nodes": list(
                    getattr(exc, "offending_nodes", []) or []
                ),
                "offending_members": list(
                    getattr(exc, "offending_members", []) or []
                ),
            },
        )
    return JSONResponse(
        status_code=422,
        content={"detail": "structure is unstable or under-restrained"},
    )


# ---- register solvers once ----
engine = AnalysisEngine()
engine.register("frame_v2", lambda model: FrameV2Adapter(model))
# D-14 bug fix (Phase 04 Plan 03, UAT-surfaced): accept "frame2d" as an alias
# for the "frame_v2" engine. The UI's Save button writes `solver: "frame2d"` as
# a file-routing key (see ui/frame2d/script.js:1463 saveModel). Before this
# fix, POSTing an unmodified saved JSON returned HTTP 500 via
# `ValueError: Unknown solver 'frame2d'` from the engine registry. Registering
# both keys to the same adapter lets callers use either name interchangeably.
engine.register("frame2d", lambda model: FrameV2Adapter(model))
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
    # Global-X load convention: wx (N/m) acts in the global +X direction regardless of member angle.
    # Consistent load vector for any orientation: fx = wx*L/2 at each node (global X), fy = 0.
    # Moments from the transverse component: mi = -wx*sin(θ)*L²/12, mj = +wx*sin(θ)*L²/12.
    # Direct fv contributions are subtracted from FG post-solve (mirrors solver's remove_ENA step).
    fv = list(req.forceVector)          # mutable copy (flat, length = 3*n_nodes)
    en_moments = [list(row) for row in req.ENMoments]  # mutable copy

    wx_fv_to_remove = []   # track direct-fv contributions for FG post-correction
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

            # Consistent load vector for global-X uniform load (wx N/m):
            # By the FEM work-equivalent principle, for ANY member orientation:
            #   Global-X force at each node = wx * L / 2  (never negative, independent of angle)
            #   Global-Y force at each node = 0
            # Moment from the transverse (local-y) component only:
            #   mi = -wx * sin(theta) * L² / 12  (same value in local and global frames)
            #   mj = +wx * sin(theta) * L² / 12
            theta = math.atan2(yj - yi, xj - xi)
            s = math.sin(theta)
            fx_each = wx * L / 2
            mi_g =  -wx * s * L * L / 12
            mj_g =   wx * s * L * L / 12

            fv[ni * 3 + 0] += fx_each
            fv[nj * 3 + 0] += fx_each
            en_moments[ei][0] += mi_g
            en_moments[ei][1] += mj_g

            # Record so we can subtract from FG after solve (mirrors remove_ENA pattern)
            wx_fv_to_remove.append((ni, nj, fx_each))

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

    # Subtract wx direct-fv contributions from FG (mirrors remove_equivalent_nodal_actions).
    # Forces added to fv are not auto-removed by the solver's ENA mechanism, so we do it here.
    for ni, nj, fx_each in wx_fv_to_remove:
        result.FG[ni * 3 + 0, 0] -= fx_each
        result.FG[nj * 3 + 0, 0] -= fx_each

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