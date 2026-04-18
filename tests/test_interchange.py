"""
Integration tests for the PDA interchange format (Phase 3).

Tests verify:
1. Fixture JSON files match the canonical schema (schema_version, solver, required fields)
2. Fixture JSON is solve-ready — can be POSTed to the API and returns correct analytical results
3. Canvas state is present for visual round-trip restoration
4. forceVector length matches n_nodes * dof_per_node for each solver

Analytical reference cases:
  - Frame2d cantilever: E=200e9, I=1e-4, L=1, F=-10000 -> Uy_tip = -FL^3/(3EI) approx -1.667e-4 m
  - Truss2d horizontal bar: E=200e9, A=0.01, L=1, F=1000 -> Ux_tip = FL/(EA) = 5e-7 m
"""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api_server.app import app


FIXTURES = Path(__file__).parent / "fixtures"
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures: load the canonical sample JSON files from disk
# ---------------------------------------------------------------------------
@pytest.fixture
def frame2d_model():
    with open(FIXTURES / "sample_pda_frame2d.json") as f:
        return json.load(f)


@pytest.fixture
def truss2d_model():
    with open(FIXTURES / "sample_pda_truss2d.json") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------
def test_frame2d_fixture_is_valid_json(frame2d_model):
    """Frame2d fixture is valid JSON with schema_version 1.0 and all required keys."""
    assert frame2d_model["schema_version"] == "1.0"
    assert frame2d_model["solver"] == "frame2d"

    required_keys = [
        "nodes",
        "members",
        "ENForces",
        "ENMoments",
        "forceVector",
        "E",
        "I",
        "restrainedDoF",
        "canvas",
    ]
    for key in required_keys:
        assert key in frame2d_model, f"frame2d fixture missing required key: {key}"


def test_truss2d_fixture_is_valid_json(truss2d_model):
    """Truss2d fixture is valid JSON with schema_version 1.0 and all required keys."""
    assert truss2d_model["schema_version"] == "1.0"
    assert truss2d_model["solver"] == "truss2d"

    required_keys = [
        "nodes",
        "members",
        "E",
        "A",
        "forceVector",
        "restrainedDoF",
        "canvas",
    ]
    for key in required_keys:
        assert key in truss2d_model, f"truss2d fixture missing required key: {key}"


# ---------------------------------------------------------------------------
# Solve-readiness tests — POST fixture JSON to the actual API and check results
# ---------------------------------------------------------------------------
def test_frame2d_fixture_is_solve_ready(frame2d_model):
    """Frame2d fixture POSTs cleanly to /solve/frame2d and returns correct cantilever tip Uy.

    Analytical: tip Uy = -FL^3/(3EI) with F = -10000 N, L = 1 m, E = 200e9, I = 1e-4
                       = -10000 * 1^3 / (3 * 200e9 * 1e-4)
                       = -1.6666...e-4 m
    """
    # Strip schema metadata and canvas; the rest is the solve payload.
    payload = {
        k: v for k, v in frame2d_model.items() if k not in ("schema_version", "canvas")
    }
    # File-level solver is the routing key "frame2d"; the API engine name is "frame_v2".
    payload["solver"] = "frame_v2"

    resp = client.post("/solve/frame2d", json=payload)
    assert resp.status_code == 200, f"Unexpected status {resp.status_code}: {resp.text}"

    result = resp.json()
    assert "UG" in result
    assert "member_moments" in result

    # UG is a flat list of length 3*n_nodes (frame2d). Index 4 == DOF 5 == node 2 Uy.
    expected_uy_tip = -10000.0 * 1.0 ** 3 / (3 * 200e9 * 1e-4)
    assert result["UG"][4] == pytest.approx(expected_uy_tip, rel=1e-6)


def test_truss2d_fixture_is_solve_ready(truss2d_model):
    """Truss2d fixture POSTs cleanly to /solve/truss2d and returns correct axial displacement.

    Analytical: Ux at node 2 = FL/(EA) with F = 1000 N, L = 1 m, E = 200e9, A = 0.01
                              = 1000 * 1 / (200e9 * 0.01) = 5e-7 m
    """
    payload = {
        k: v for k, v in truss2d_model.items() if k not in ("schema_version", "canvas")
    }
    # Truss file-level and engine solver names both happen to be "truss2d", but set
    # explicitly for clarity / parity with the frame2d test.
    payload["solver"] = "truss2d"

    resp = client.post("/solve/truss2d", json=payload)
    assert resp.status_code == 200, f"Unexpected status {resp.status_code}: {resp.text}"

    result = resp.json()
    assert "UG" in result
    assert "member_forces" in result

    # UG flat list of length 2*n_nodes (truss2d). Index 2 == DOF 3 == node 2 Ux.
    expected_ux_tip = 1000.0 * 1.0 / (200e9 * 0.01)
    assert result["UG"][2] == pytest.approx(expected_ux_tip, rel=1e-6)


# ---------------------------------------------------------------------------
# Canvas state tests — verify D-04 visual-round-trip shape is intact
# ---------------------------------------------------------------------------
def test_frame2d_fixture_has_canvas_state(frame2d_model):
    """Frame2d canvas section has origin, nodes, supports, and nodeLoads for full restore."""
    assert "canvas" in frame2d_model
    canvas = frame2d_model["canvas"]

    assert canvas["origin"] is not None, "origin must not be null — needed for pixel restore"
    assert len(canvas["nodes"]) == len(frame2d_model["nodes"])
    assert "supports" in canvas
    assert "nodeLoads" in canvas


def test_truss2d_fixture_has_canvas_state(truss2d_model):
    """Truss2d canvas section has origin, nodes, supports, and loads (not nodeLoads)."""
    assert "canvas" in truss2d_model
    canvas = truss2d_model["canvas"]

    assert canvas["origin"] is not None, "origin must not be null — needed for pixel restore"
    assert len(canvas["nodes"]) == len(truss2d_model["nodes"])
    assert "supports" in canvas
    # Truss2D uses 'loads' (per ui/truss2d/script.js saveHistory), NOT 'nodeLoads'.
    assert "loads" in canvas


# ---------------------------------------------------------------------------
# Force vector length consistency (Pitfall 5 in RESEARCH.md)
# ---------------------------------------------------------------------------
def test_force_vector_length_matches_nodes_frame2d(frame2d_model):
    """forceVector must have 3 entries per node for frame2d (Ux, Uy, theta)."""
    assert len(frame2d_model["forceVector"]) == len(frame2d_model["nodes"]) * 3


def test_force_vector_length_matches_nodes_truss2d(truss2d_model):
    """forceVector must have 2 entries per node for truss2d (Ux, Uy)."""
    assert len(truss2d_model["forceVector"]) == len(truss2d_model["nodes"]) * 2
