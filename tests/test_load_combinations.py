"""Analytical verification of the load-combination engine (solver_core/loads).

Mirrors the analytical-verification idiom of tests/test_truss2d.py (pytest.approx,
closed-form / independently-computed expected values). Every fixture is the STABLE,
triangulated two-bar pinned-apex truss from test_truss2d.py Case 2 so each per-case
solve is non-singular:

    nodes    = [[0,0], [2,0], [1,1]]
    members  = [[1,3], [2,3]]            (1-based)
    restrain = [1,2,3,4]                 (both base nodes pinned)
    loads    applied at the apex node 3 (0-based index 2)

All loads are unfactored characteristic values; factors only ever appear via the
generator / combination terms (D-01). Superposition always combines the solver's
tension-positive member_forces and the raw UG, never UI magnitudes (Pitfall 2).
"""

import numpy as np
import pytest

from pda_analysis_software.adapters.truss_adapters import Truss2DAdapter
from pda_analysis_software.models.truss2d_model import TrussModel2D
from pda_analysis_software.loads.natures import Nature
from pda_analysis_software.loads.code_packs import get_code_pack
from pda_analysis_software.loads.combinations import (
    LoadCase,
    CombinationTerm,
    Combination,
    generate_eurocode,
    superpose,
    superpose_displacement,
    delta_max,
    envelope,
)


# --- Stable two-bar pinned-apex truss fixture (test_truss2d.py Case 2 family) ---
E = 200e9
A = 0.01
NODES = np.array([[0.0, 0.0], [2.0, 0.0], [1.0, 1.0]])
MEMBERS = np.array([[1, 3], [2, 3]])
RESTRAINED = [1, 2, 3, 4]
N_NODES = 3
N_DOF = 6
N_MEMBERS = 2
APEX = 2  # 0-based node index for node 3

PACK = get_code_pack("eurocode_uk")


def _force_vector(loads):
    """Flat 2*nNodes force vector (same build as the truss solve path)."""
    fv = np.zeros(N_NODES * 2)
    for ld in loads:
        idx = ld["nodeId"] * 2 + (1 if ld["direction"] == "y" else 0)
        fv[idx] += ld["magnitude"]
    return fv


def _solve(loads):
    model = TrussModel2D(
        nodes=NODES, members=MEMBERS, E=E, A=A,
        forceVector=_force_vector(loads), restrainedDoF=RESTRAINED,
    )
    return Truss2DAdapter(model).solve()


def _solve_cases(cases):
    """Solve each non-empty case once; cache member_forces AND UG keyed by case id (D-09)."""
    per_case_forces, per_case_ug = {}, {}
    for c in cases:
        if not c.loads:
            continue
        r = _solve(c.loads)
        per_case_forces[c.id] = r.member_forces
        per_case_ug[c.id] = r.UG.reshape(-1)
    return per_case_forces, per_case_ug


def _dead():
    return LoadCase("d", "Dead", Nature.DEAD, [{"nodeId": APEX, "direction": "y", "magnitude": -10000.0}])


def _imposed(category=None):
    return LoadCase("i", "Imposed", Nature.IMPOSED,
                    [{"nodeId": APEX, "direction": "y", "magnitude": -5000.0}], category=category)


def _wind():
    return LoadCase("w", "Wind", Nature.WIND, [{"nodeId": APEX, "direction": "x", "magnitude": 3000.0}])


# ---------------------------------------------------------------------------
# Test 1 — Dead+Imposed degenerate single 1.35G+1.5Q row (D-12)
# ---------------------------------------------------------------------------
def test_dead_imposed_single_str_combo():
    dead, imp = _dead(), _imposed()
    per_case_forces, _ = _solve_cases([dead, imp])

    combos = generate_eurocode([dead, imp], PACK, ["STR"])
    assert len(combos) == 1
    assert combos[0].name == "ULS-1"
    assert {t.case_id: t.factor for t in combos[0].terms} == {"d": 1.35, "i": 1.5}

    got = superpose(combos[0], per_case_forces, N_MEMBERS)
    expected = 1.35 * per_case_forces["d"] + 1.5 * per_case_forces["i"]
    assert got == pytest.approx(expected, rel=1e-9)


# ---------------------------------------------------------------------------
# Test 2 — Dead+Imposed+Wind -> 2 STR combos + accompanying psi0 + expressions
# ---------------------------------------------------------------------------
def test_dead_imposed_wind_two_str_combos_and_expressions():
    cases = [_dead(), _imposed(), _wind()]
    combos = generate_eurocode(cases, PACK, ["STR"])
    assert len(combos) == 2

    by = {c.name: c for c in combos}
    f1 = {t.case_id: t.factor for t in by["ULS-1"].terms}
    f2 = {t.case_id: t.factor for t in by["ULS-2"].terms}

    assert by["ULS-1"].leading == "Imposed"
    assert by["ULS-2"].leading == "Wind"
    assert f1["i"] == pytest.approx(1.5)
    assert f1["w"] == pytest.approx(0.9)    # 1.5 * 0.6
    assert f2["w"] == pytest.approx(1.5)
    assert f2["i"] == pytest.approx(1.05)   # 1.5 * 0.7

    assert "0.9·Wind" in by["ULS-1"].expression
    assert "1.05·Imposed" in by["ULS-2"].expression


# ---------------------------------------------------------------------------
# Test 3 — SLS-characteristic gamma=1.0 + displacement linearity (D-13)
# ---------------------------------------------------------------------------
def test_sls_characteristic_and_displacement_linearity():
    dead, imp, wind = _dead(), _imposed(), _wind()
    cases = [dead, imp, wind]
    _, per_case_ug = _solve_cases(cases)

    sls = generate_eurocode(cases, PACK, ["SLS"])
    assert len(sls) == 2
    sls1 = {c.name: c for c in sls}["SLS-1"]   # Imposed leading
    factors = {t.case_id: t.factor for t in sls1.terms}
    assert factors["d"] == pytest.approx(1.0)
    assert factors["i"] == pytest.approx(1.0)
    assert factors["w"] == pytest.approx(0.6)

    # Direct combined-load solve of the SLS-1 factored force vector.
    combined = (
        1.0 * _force_vector(dead.loads)
        + 1.0 * _force_vector(imp.loads)
        + 0.6 * _force_vector(wind.loads)
    )
    direct = Truss2DAdapter(TrussModel2D(
        nodes=NODES, members=MEMBERS, E=E, A=A,
        forceVector=combined, restrainedDoF=RESTRAINED,
    )).solve()

    superposed_u = superpose_displacement(sls1, per_case_ug, N_DOF)
    assert superposed_u == pytest.approx(direct.UG.reshape(-1), rel=1e-9)
    assert delta_max(superposed_u) == pytest.approx(delta_max(direct.UG), rel=1e-9)


# ---------------------------------------------------------------------------
# Test 4 — force superposition == direct combined-load solve (linearity, D-09)
# ---------------------------------------------------------------------------
def test_force_superposition_equals_direct_solve():
    dead, imp = _dead(), _imposed()
    per_case_forces, _ = _solve_cases([dead, imp])
    combos = generate_eurocode([dead, imp], PACK, ["STR"])

    combined = 1.35 * _force_vector(dead.loads) + 1.5 * _force_vector(imp.loads)
    direct = Truss2DAdapter(TrussModel2D(
        nodes=NODES, members=MEMBERS, E=E, A=A,
        forceVector=combined, restrainedDoF=RESTRAINED,
    )).solve()

    superposed = superpose(combos[0], per_case_forces, N_MEMBERS)
    assert superposed == pytest.approx(direct.member_forces, rel=1e-9)


# ---------------------------------------------------------------------------
# Test 5 — provenance envelope: governing combo + reverse index (D-18/D-19)
# ---------------------------------------------------------------------------
def test_envelope_governing_combo_and_reverse_index():
    cases = [_dead(), _imposed(), _wind()]
    per_case_forces, _ = _solve_cases(cases)
    combos = generate_eurocode(cases, PACK, ["STR"])

    env = envelope(combos, per_case_forces, N_MEMBERS)

    # Independent oracle: argmax over the per-combo superposed forces per member.
    names = [c.name for c in combos]
    F = np.vstack([superpose(c, per_case_forces, N_MEMBERS) for c in combos])
    for m in range(N_MEMBERS):
        expected_gov = names[int(np.argmax(F[:, m]))]
        assert env.members[m].gov_tension == expected_gov
        assert (m + 1) in env.combo_to_members[expected_gov]
        # forward force matches the oracle max
        assert env.members[m].max_tension == pytest.approx(float(F[:, m].max()), rel=1e-9)


# ---------------------------------------------------------------------------
# Test 6 — empty case skipped from generation + zero contribution (Pitfall 4)
# ---------------------------------------------------------------------------
def test_empty_case_skipped_and_zero_contribution():
    dead, imp = _dead(), _imposed()
    empty_wind = LoadCase("w", "Wind", Nature.WIND, [])

    combos = generate_eurocode([dead, imp, empty_wind], PACK, ["STR"])
    assert len(combos) == 1                                  # no Wind-leading combo
    assert all(c.leading != "Wind" for c in combos)
    assert all(all(t.case_id != "w" for t in c.terms) for c in combos)

    # Missing case contributes a zero vector (ghost term adds nothing).
    per_case_forces, _ = _solve_cases([dead, imp])           # no 'w' key
    combo = Combination("X", "STR", [CombinationTerm("d", 1.0), CombinationTerm("ghost", 2.0)])
    got = superpose(combo, per_case_forces, N_MEMBERS)
    assert got == pytest.approx(1.0 * per_case_forces["d"], rel=1e-9)


# ---------------------------------------------------------------------------
# Test 7 — Cat E storage imposed psi0 = 1.0 vs default A-D/H = 0.7
# ---------------------------------------------------------------------------
def test_cat_e_storage_psi0_one_vs_default():
    # Default A-D/H imposed accompanying a leading Wind -> 1.5 * 0.7 = 1.05
    default_combos = generate_eurocode([_dead(), _imposed(), _wind()], PACK, ["STR"])
    f_default = {t.case_id: t.factor for t in {c.name: c for c in default_combos}["ULS-2"].terms}
    assert f_default["i"] == pytest.approx(1.05)

    # Cat E storage imposed accompanying a leading Wind -> 1.5 * 1.0 = 1.5
    storage_combos = generate_eurocode([_dead(), _imposed(category="E_storage"), _wind()], PACK, ["STR"])
    f_storage = {t.case_id: t.factor for t in {c.name: c for c in storage_combos}["ULS-2"].terms}
    assert f_storage["i"] == pytest.approx(1.5)
