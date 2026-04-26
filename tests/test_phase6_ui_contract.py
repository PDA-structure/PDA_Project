"""Phase 6 PUREBAR-04 — automated UI contract tests.

In ``--auto`` mode the manual browser smoke test from the original Phase 6
plan cannot run. These tests stand in by asserting that the API surfaces
every field the JS parser in ``ui/frame2d/script.js`` reads from the
response.

If a future change to ``api_server/app.py`` renames ``cause`` to
``failure_mode`` (or drops ``offending_members``), these tests fail
loudly and the UI parser in ``script.js`` can be updated to match —
same direction, no silent drift.

Manual UAT (NOT gating; run any time for a real visual check):

    1. ``uvicorn api_server.app:app --reload``
    2. Open ``ui/frame2d/index.html`` in a browser.
    3. Load ``tests/fixtures/uat/pure_bar_pratt_captured.json``.
       Expect: small red dots near pure-bar interior joints; informational
       (non-red) status text. Click Solve → "Solved ✓".
    4. Add UDL to a bar member; click Solve.
       Expect: red banner "UDL on bar member(s) N: bars are axial-only…",
       solve aborted client-side, member highlighted red.
    5. Build a model with no supports (genuinely under-restrained); click
       Solve. Expect: legacy flat error "API error: structure is unstable
       or under-restrained" — no [cause] suffix, proving D-13 backward
       compatibility.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api_server.app import app


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "uat"


@pytest.fixture(scope="module")
def client() -> TestClient:
    """FastAPI test client shared across all UI-contract tests."""
    return TestClient(app)


def test_ui_contract_udl_on_bar_payload_shape(client: TestClient) -> None:
    """API response must carry every field ``ui/frame2d/script.js`` reads.

    The JS parser in ``solve()``'s error branch (Plan 06-03 Task 2) reads:

        - ``err.detail``            → status message text
        - ``err.cause``             → status suffix ``[<cause>]``
        - ``err.offending_nodes``   → drawDiagnosticOverlays red rings
        - ``err.offending_members`` → drawDiagnosticOverlays red strokes

    All four field names are part of the UI contract. If any is renamed
    or dropped server-side, the UI silently regresses; this test catches
    that drift.
    """
    response = client.post("/solve/frame2d", json={
        "solver": "frame_v2",
        "nodes": [[0.0, 0.0], [1.0, 0.0]],
        "members": [[1, 2]],
        "ENForces": [[-5000.0, -5000.0]],   # UDL-equivalent on member 1
        "ENMoments": [[0.0, 0.0]],
        "forceVector": [0, 0, 0, 0, 0, 0],
        "E": 200e9, "I": 1e-4, "A": 0.01,
        "bars": [1],                         # member 1 is a bar
        "restrainedDoF": [1, 2, 3, 4, 5, 6],
    })
    assert response.status_code == 422, response.text
    body = response.json()

    # Every field the UI reads must be present and the right type.
    assert "detail" in body and isinstance(body["detail"], str)
    assert "cause" in body and body["cause"] == "udl_on_bar"
    assert "offending_members" in body and isinstance(body["offending_members"], list)
    assert 1 in body["offending_members"]
    assert "offending_nodes" in body and isinstance(body["offending_nodes"], list)


def test_ui_contract_pure_bar_fixture_solves(client: TestClient) -> None:
    """End-to-end: the captured failing fixture solves via the same route the UI hits.

    Pre-fix (2026-04-22 captured): HTTP 422 "structure is unstable".
    Post-fix (Plan 06-01 + 06-02): HTTP 200 with valid FG, UG, member_forces.

    This is a UI-contract test (lives in ``test_phase6_ui_contract.py``)
    because the UI's success path depends on this exact behaviour: load
    fixture, POST, render results. TRUST-19 in ``test_frame_v2.py``
    asserts the same; this duplicate is intentional — the UI contract is
    independent of the solver test surface (e.g. if TRUST-19 is moved or
    renamed, the UI contract here still guards the integration).
    """
    fixture_path = FIXTURES_DIR / "pure_bar_pratt_captured.json"
    assert fixture_path.exists(), (
        f"Fixture missing: {fixture_path}. Plan 06-01 Task 3 must commit it."
    )
    with fixture_path.open() as fh:
        payload = json.load(fh)

    # The saved UI file uses "solver": "frame2d" as a file-routing key.
    # The API engine registry knows both "frame2d" and "frame_v2" since
    # Phase 04 Plan 03 (D-14 alias) — but the UAT loader normalises to
    # "frame_v2" for clarity, mirroring tests/test_uat_frame2d.py.
    if payload.get("solver") == "frame2d":
        payload["solver"] = "frame_v2"
    payload.pop("schema_version", None)
    payload.pop("canvas", None)

    response = client.post("/solve/frame2d", json=payload)
    assert response.status_code == 200, (
        f"Expected 200 (post-fix), got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert "UG" in body and "FG" in body


def test_ui_contract_legacy_flat_payload_unchanged(client: TestClient) -> None:
    """Backward-compat (D-13): genuinely under-restrained models still emit
    the legacy flat payload that pre-Phase-6 UIs and external callers depend on.

    The UI's error branch reads ``err.detail || res.statusText`` first;
    structured fields are additive. If the API ever started omitting
    ``detail``, every legacy consumer would break. This test guards the
    backstop.
    """
    response = client.post("/solve/frame2d", json={
        "solver": "frame_v2",
        "nodes": [[0.0, 0.0], [1.0, 0.0]],
        "members": [[1, 2]],
        "ENForces": [[0.0, 0.0]],
        "ENMoments": [[0.0, 0.0]],
        "forceVector": [0, 0, -1000, 0, 0, 0],
        "E": 200e9, "I": 1e-4, "A": 0.01,
        "restrainedDoF": [],   # NO supports — singular Ks → solver re-raises RuntimeError
    })
    assert response.status_code == 422, response.text
    body = response.json()

    # `detail` is the one mandatory field for backward compat.
    assert "detail" in body and isinstance(body["detail"], str) and body["detail"]

    # If the structured handler matched, `cause` should NOT be 'udl_on_bar'
    # here — this is genuine instability, not UDL-on-bar.
    assert body.get("cause") != "udl_on_bar"
