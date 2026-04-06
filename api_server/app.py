from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
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

    E: float
    I: float
    A: Optional[float] = None
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


@app.post("/solve/frame2d")
def solve_frame2d(req: Frame2DRequest):
    model = FrameModel2D(
        nodes=np.array(req.nodes, float),
        members=np.array(req.members, int),
        ENForces=np.array(req.ENForces, float),
        ENMoments=np.array(req.ENMoments, float),
        forceVector=np.array(req.forceVector, float).reshape(-1, 1),
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