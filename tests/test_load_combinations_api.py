"""FastAPI TestClient tests for the additive /solve/truss2d/combinations endpoint (Phase 999.2 Plan 02).

Happy path + the five structured-422 input-validation guards, plus a no-regression
check that the existing /solve/truss2d route is untouched. Every happy-path body uses
the STABLE triangulated apex truss (nodes=[[0,0],[2,0],[1,1]], members=[[1,3],[2,3]],
restrainedDoF=[1,2,3,4], apex loads at nodeId=2) — a colinear three-node truss with a
transverse load is a singular mechanism and must never be used in a 200-status check.
"""

import json
import sys
from pathlib import Path

# Make api_server/app importable (mirrors the verify command in the plan).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api_server"))

from fastapi.testclient import TestClient  # noqa: E402
from app import app  # noqa: E402

client = TestClient(app)

# Stable, non-singular triangulated truss shared by all happy-path bodies.
STABLE_GEOM = {
    "nodes": [[0, 0], [2, 0], [1, 1]],
    "members": [[1, 3], [2, 3]],
    "E": 2e11,
    "A": 0.01,
    "restrainedDoF": [1, 2, 3, 4],
}


def _cases():
    return [
        {"id": "d", "name": "Dead", "nature": "Dead",
         "loads": [{"nodeId": 2, "direction": "y", "magnitude": -1000}]},
        {"id": "i", "name": "Imposed", "nature": "Imposed",
         "loads": [{"nodeId": 2, "direction": "y", "magnitude": -2000}]},
    ]


def test_happy_path_generate():
    body = {**STABLE_GEOM, "cases": _cases(),
            "generate": {"code": "eurocode_uk", "families": ["STR", "SLS"]}}
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 200, (r.status_code, r.text)
    j = r.json()
    # per_case with displacements (D-13 superposition basis)
    assert "per_case" in j and "displacements" in j["per_case"]["d"]
    assert len(j["per_case"]["d"]["member_forces"]) == 2
    # combinations with per-combination delta_max (D-13)
    assert len(j["combinations"]) >= 1
    assert "delta_max_m" in j["combinations"][0]
    assert "expression" in j["combinations"][0]
    # envelope with per-member governing-combo provenance (D-18/D-19)
    m0 = j["envelope"]["members"][0]
    assert "gov_tension" in m0 and "gov_compression" in m0
    assert "max_tension_N" in m0
    assert isinstance(j["envelope"]["combo_to_members"], dict)
    assert j["meta"]["n_cases_solved"] == 2


def test_happy_path_manual_combination():
    body = {**STABLE_GEOM, "cases": _cases(),
            "combinations": [{"name": "ULS-manual", "cls": "STR",
                              "terms": [{"caseId": "d", "factor": 1.35},
                                        {"caseId": "i", "factor": 1.5}]}]}
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 200, (r.status_code, r.text)
    j = r.json()
    assert j["combinations"][0]["name"] == "ULS-manual"
    assert len(j["combinations"][0]["member_forces"]) == 2


def test_422_unknown_case():
    body = {**STABLE_GEOM, "cases": _cases(),
            "combinations": [{"name": "bad", "cls": "STR",
                              "terms": [{"caseId": "does_not_exist", "factor": 1.35}]}]}
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 422, (r.status_code, r.text)
    assert r.json()["cause"] == "unknown_case"


def test_422_shape_mismatch():
    body = {**STABLE_GEOM, "cases": _cases()}
    body["A"] = [0.01, 0.02, 0.03]   # 3 values, only 2 members
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 422, (r.status_code, r.text)
    assert r.json()["cause"] == "shape_mismatch"


def test_422_non_finite_factor():
    # JSON has no finite-only literal for inf; a non-strict client emits the
    # `Infinity` token, which the server's json parser accepts (Python json.loads
    # allows it). Send the raw body via content= so the guard is actually exercised.
    body = {**STABLE_GEOM, "cases": _cases(),
            "combinations": [{"name": "inf", "cls": "STR",
                              "terms": [{"caseId": "d", "factor": float("inf")}]}]}
    raw = json.dumps(body)   # default allow_nan=True → emits the `Infinity` token
    r = client.post("/solve/truss2d/combinations", content=raw,
                    headers={"content-type": "application/json"})
    assert r.status_code == 422, (r.status_code, r.text)
    assert r.json()["cause"] == "non_finite_factor"


def test_422_unknown_category():
    cases = _cases()
    cases[1]["category"] = "warehouse"   # imposed case with bogus category
    body = {**STABLE_GEOM, "cases": cases,
            "generate": {"code": "eurocode_uk", "families": ["STR", "SLS"]}}
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 422, (r.status_code, r.text)
    assert r.json()["cause"] == "unknown_category"


def test_422_unknown_nature():
    cases = _cases()
    cases[0]["nature"] = "Earthquake"   # not a recognised Nature
    body = {**STABLE_GEOM, "cases": cases}
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 422, (r.status_code, r.text)
    assert r.json()["cause"] == "unknown_nature"


def test_422_no_loaded_cases():
    body = {**STABLE_GEOM,
            "cases": [{"id": "d", "name": "Dead", "nature": "Dead", "loads": []}]}
    r = client.post("/solve/truss2d/combinations", json=body)
    assert r.status_code == 422, (r.status_code, r.text)
    assert r.json()["cause"] == "no_loaded_cases"


def test_no_regression_existing_truss2d_endpoint():
    """The existing /solve/truss2d quick path still returns 200 with the same keys."""
    body = {
        "nodes": [[0, 0], [2, 0], [1, 1]],
        "members": [[1, 3], [2, 3]],
        "E": 2e11,
        "A": 0.01,
        "forceVector": [0, 0, 0, 0, 0, -1000],
        "restrainedDoF": [1, 2, 3, 4],
    }
    r = client.post("/solve/truss2d", json=body)
    assert r.status_code == 200, (r.status_code, r.text)
    j = r.json()
    for key in ("solver", "UG", "FG", "member_forces", "meta"):
        assert key in j, key
    assert j["solver"] == "truss2d"
