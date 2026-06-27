"""Load-case / combination data model + generator + linear superposition + envelope.

This is the solver-agnostic combination engine (D-05/D-07): it consumes only per-case
member forces (and per-case displacements) and combines them by factors. Nothing here is
truss-specific, so frame2d and the future 3D solvers reuse it unchanged (D-22).

Core insight (D-09): for a fixed stiffness, both member force N and displacement UG are
linear in the applied load, so a combination is an exact weighted sum over cached per-case
results — no re-solve. Because UG is linear too, superpose_displacement combines per-case
UG vectors by the SAME factors, driving the SLS-characteristic delta_max check (D-13).

Pure numpy/python: no printing, no matplotlib, never imports visualization/ (CLAUDE.md).
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

import numpy as np

from .natures import Nature, ActionType
from .code_packs import CodePack, DEFAULT_IMPOSED_CATEGORY

# Action-type sentinels resolved once (avoids per-call enum attribute lookups).
_ACTION_PERMANENT = ActionType.PERMANENT
_ACTION_VARIABLE = ActionType.VARIABLE


# ---------------------------------------------------------------------------
# Data model (RESEARCH "Concrete dataclasses")
# ---------------------------------------------------------------------------
@dataclass
class LoadCase:
    id: str
    name: str
    nature: Nature
    loads: list = field(default_factory=list)   # [{nodeId,direction,magnitude}] — unfactored characteristic
    category: Optional[str] = None              # imposed psi0 category (only meaningful for Nature.IMPOSED); None -> default


@dataclass(frozen=True)
class CombinationTerm:
    case_id: str
    factor: float          # the ONLY place factors live (D-01)


@dataclass
class Combination:
    name: str              # "ULS-2"
    cls: str               # "STR" | "SLS"  (D-17; 'class' is reserved)
    terms: List[CombinationTerm]
    expression: str = ""   # "1.35·Dead + 1.5·Wind + 1.05·Imposed" (D-16/D-21)
    leading: str = ""      # "Wind" plain leading-action tag (D-16)


@dataclass
class EnvelopeMember:
    member: int            # 1-based
    max_tension: float     # N
    gov_tension: str       # combination name (D-18)
    max_compression: float # N (wired now; meaningful after deferred wind-uplift)
    gov_compression: str


@dataclass
class EnvelopeResult:
    members: List[EnvelopeMember]      # forward map member->combo (D-19)
    combo_to_members: Dict[str, list]  # reverse index combo->members (D-19)


# ---------------------------------------------------------------------------
# psi0 resolver (category-aware imposed)
# ---------------------------------------------------------------------------
def _psi0_for(case: LoadCase, pack: CodePack) -> float:
    """Resolve the accompanying psi0 for a variable case.

    Imposed is category-driven: Cat A-D/H -> 0.7 (default), Cat E storage -> 1.0.
    An unknown category raises KeyError, surfaced to the caller (Plan 02 maps to a
    structured 422 'unknown_category' — threat T-9992-16).
    """
    if case.nature == Nature.IMPOSED:
        cat = case.category or DEFAULT_IMPOSED_CATEGORY
        return pack.psi0_imposed[cat]
    return pack.psi0[case.nature]


# ---------------------------------------------------------------------------
# Generator (EN 1990 Eq 6.10 STR-ULS + SLS-characteristic)
# ---------------------------------------------------------------------------
def _expression(ordered_terms: Sequence[CombinationTerm], cases_by_id: Dict[str, LoadCase]) -> str:
    """Human-readable factored expression, e.g. '1.35·Dead + 1.5·Wind + 1.05·Imposed'."""
    parts = []
    for term in ordered_terms:
        symbol = cases_by_id[term.case_id].nature.value
        parts.append(f"{term.factor:g}·{symbol}")
    return " + ".join(parts)


def generate_eurocode(cases, pack: CodePack, families=("STR", "SLS")) -> List[Combination]:
    """Generate EN 1990 Eq 6.10 STR-ULS + SLS-characteristic combinations.

    - Cases with no loads are skipped (Pitfall 4 — a 'Wind leading' combo never appears
      when no wind loads exist).
    - STR: permanents at gamma G_sup; one variable leading at gamma Q_sup; every other
      variable accompanying at gamma Q_sup * psi0 (psi0 resolved per-case category).
      Degenerate Dead+Imposed -> single 1.35G+1.5Q row (D-12).
    - SLS-characteristic (D-13): all permanent gamma = 1.0; lead at 1.0; others at psi0.
    """
    cases_by_id = {c.id: c for c in cases}
    permanent = [c for c in cases if pack.nature_action[c.nature] == _ACTION_PERMANENT and c.loads]
    variable = [c for c in cases if pack.nature_action[c.nature] == _ACTION_VARIABLE and c.loads]

    combos: List[Combination] = []

    if "STR" in families:
        g_sup = pack.gamma["G_sup"]
        q_sup = pack.gamma["Q_sup"]
        if not variable:
            terms = [CombinationTerm(p.id, g_sup) for p in permanent]
            combos.append(Combination(
                name="ULS-1", cls="STR", terms=terms,
                expression=_expression(terms, cases_by_id), leading="",
            ))
        else:
            for k, lead in enumerate(variable, start=1):
                ordered = [CombinationTerm(p.id, g_sup) for p in permanent]
                ordered.append(CombinationTerm(lead.id, q_sup))
                for other in variable:
                    if other.id != lead.id:
                        ordered.append(CombinationTerm(other.id, q_sup * _psi0_for(other, pack)))
                combos.append(Combination(
                    name=f"ULS-{k}", cls="STR", terms=ordered,
                    expression=_expression(ordered, cases_by_id), leading=lead.nature.value,
                ))

    if "SLS" in families:
        if not variable:
            terms = [CombinationTerm(p.id, 1.0) for p in permanent]
            if terms:
                combos.append(Combination(
                    name="SLS-1", cls="SLS", terms=terms,
                    expression=_expression(terms, cases_by_id), leading="",
                ))
        else:
            for k, lead in enumerate(variable, start=1):
                ordered = [CombinationTerm(p.id, 1.0) for p in permanent]
                ordered.append(CombinationTerm(lead.id, 1.0))
                for other in variable:
                    if other.id != lead.id:
                        ordered.append(CombinationTerm(other.id, _psi0_for(other, pack)))
                combos.append(Combination(
                    name=f"SLS-{k}", cls="SLS", terms=ordered,
                    expression=_expression(ordered, cases_by_id), leading=lead.nature.value,
                ))

    return combos


def generate_for(pack: CodePack, cases, families=("STR", "SLS")) -> List[Combination]:
    """Dispatch to the pack's generation strategy (keeps the frozen pack clean).

    The Eurocode pack uses Eq 6.10 leading-action iteration. BS 5950 / ASCE 7 / NBR packs
    add their own branch here later, emitting the SAME Combination shape — no consumer change.
    """
    if pack.name.startswith("Eurocode"):
        return generate_eurocode(cases, pack, families)
    raise ValueError(f"No generation strategy for code pack '{pack.name}'")


# ---------------------------------------------------------------------------
# Superposition (forces + displacements) and envelope (provenance)
# ---------------------------------------------------------------------------
def superpose(combination: Combination, per_case_forces: Dict[str, np.ndarray], n_members: int) -> np.ndarray:
    """Sigma factor * per-case member forces. Missing/empty case contributes a zero vector."""
    N = np.zeros(n_members)
    for term in combination.terms:
        fc = per_case_forces.get(term.case_id)
        if fc is not None:
            N += term.factor * np.asarray(fc, float)
    return N


def superpose_displacement(combination: Combination, per_case_ug: Dict[str, np.ndarray], n_dof: int) -> np.ndarray:
    """Sigma factor * per-case displacement (UG) — same factors, on the displacement vectors (D-13).

    UG is linear in the applied load exactly like member force, so this is exact.
    Missing case contributes a zero vector.
    """
    U = np.zeros(n_dof)
    for term in combination.terms:
        uc = per_case_ug.get(term.case_id)
        if uc is not None:
            U += term.factor * np.asarray(uc, float).reshape(-1)
    return U


def delta_max(ug) -> float:
    """Worst absolute displacement component — the value that drives the SLS delta_max check (D-13)."""
    return float(np.max(np.abs(np.asarray(ug, float))))


def envelope(combinations, per_case_forces: Dict[str, np.ndarray], n_members: int) -> EnvelopeResult:
    """Provenance-carrying envelope: per-member governing combo + reverse index (D-18/D-19)."""
    if not combinations:
        return EnvelopeResult(members=[], combo_to_members={})

    names = [c.name for c in combinations]
    F = np.vstack([superpose(c, per_case_forces, n_members) for c in combinations])  # (n_combos, n_members)
    max_idx = np.argmax(F, axis=0)   # governing combo for max tension per member
    min_idx = np.argmin(F, axis=0)   # governing combo for max compression per member

    members: List[EnvelopeMember] = []
    combo_to_members: Dict[str, set] = {name: set() for name in names}
    for m in range(n_members):
        gov_t = names[int(max_idx[m])]
        gov_c = names[int(min_idx[m])]
        members.append(EnvelopeMember(
            member=m + 1,
            max_tension=float(F[max_idx[m], m]), gov_tension=gov_t,
            max_compression=float(F[min_idx[m], m]), gov_compression=gov_c,
        ))
        combo_to_members[gov_t].add(m + 1)
        combo_to_members[gov_c].add(m + 1)

    return EnvelopeResult(
        members=members,
        combo_to_members={name: sorted(s) for name, s in combo_to_members.items()},
    )
