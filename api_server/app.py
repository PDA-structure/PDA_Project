import math
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
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


# ---- serve UIs as static files (Tailscale / Render-ready) ----
# Resolves to <repo_root>/ui/ — siblings: api_server/, ui/, solver_core/.
# Access: /ui/truss2d/index.html and /ui/frame2d/index.html.
class NoCacheStaticFiles(StaticFiles):
    """Serve UI assets with ``Cache-Control: no-cache`` so browsers always
    revalidate against the ETag/Last-Modified before reusing a cached copy.
    Revalidation is cheap (304 Not Modified when unchanged) but guarantees a
    changed script.js / style.css is picked up immediately — removing the
    "hard-refresh after every UI edit" foot-gun (see quick task 260622-rcm,
    where a cached script.js masked a working fix)."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


app.mount(
    "/ui",
    NoCacheStaticFiles(directory=str(Path(__file__).resolve().parent.parent / "ui")),
    name="ui",
)


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
    ENAxialForces: Optional[List[List[float]]] = None  # [Nx_i, Nx_j] per member, local coords


@app.post("/solve/frame2d")
def solve_frame2d(req: Frame2DRequest):
    # --- Horizontal UDL (w_x) assembly ---
    # Global-X load convention: wx (N/m) acts in the global +X direction regardless of member angle.
    #
    # Correct FEM treatment via ENForces/ENMoments only (no direct fv additions):
    #
    #   For a global-X distributed load wx (N/m) on a member at angle theta:
    #   1. Project onto local-y axis: q_local_y = wx * (-sin(theta))
    #      (local-y unit vector in global = [-sin(theta), cos(theta)])
    #   2. Fixed-end transverse forces (local): ENForces_i = ENForces_j = q_local_y * L / 2
    #   3. Fixed-end moments (local):  ENMoments_i = q_local_y * L^2 / 12
    #                                  ENMoments_j = -q_local_y * L^2 / 12
    #   4. The solver's T.T transformation converts these to global automatically.
    #      No direct forceVector additions are needed.
    #      No post-solve FG corrections are needed.
    #
    # Axial component of horizontal UDL on inclined members (wx*cos(theta)) is NOT handled
    # here because horizontal UDLs are only applied to vertical columns in typical frame models.
    # For the general case on inclined members with horizontal UDL, axial forces would also need
    # to be added to forceVector at the free nodes — but this is outside current scope.
    fv = list(req.forceVector)          # mutable copy (flat, length = 3*n_nodes)
    en_forces = [list(row) for row in req.ENForces]   # mutable copy
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

            theta = math.atan2(yj - yi, xj - xi)
            s = math.sin(theta)

            # Local-y component of global-X load
            q_local_y = wx * (-s)

            # Fixed-end transverse forces and moments (local coords)
            enf = q_local_y * L / 2
            enm_i = q_local_y * L * L / 12
            enm_j = -q_local_y * L * L / 12

            en_forces[ei][0] += enf
            en_forces[ei][1] += enf
            en_moments[ei][0] += enm_i
            en_moments[ei][1] += enm_j

    model = FrameModel2D(
        nodes=np.array(req.nodes, float),
        members=np.array(req.members, int),
        ENForces=np.array(en_forces, float),
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
        ENAxialForces=np.array(req.ENAxialForces, float) if req.ENAxialForces else None,
    )

    result = engine.solve(model, solver_name=req.solver)

    # Return JSON-friendly lists
    return {
        "solver": result.solver,
        "UG": result.UG.reshape(-1).tolist(),
        "FG": result.FG.reshape(-1).tolist(),
        "member_forces": None if result.member_forces is None else result.member_forces.tolist(),
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
