"""Data-driven design-code packs (single source of truth for partial + combination factors).

A code pack owns everything code-specific (D-10/D-11): the nature -> action-type mapping,
the partial factors gamma, and the combination factors psi. The Eurocode (EN 1990) UK NA
pack is the ONLY pack implemented this phase; the ``_REGISTRY`` + ``get_code_pack`` lookup
is the pluggability seam so BS 5950 / ASCE 7 / NBR packs plug in later by adding entries
with their own factor tables and generation strategy, emitting the SAME Combination shape
(no consumer changes).

D-07: factor values live ONLY here — the marimo calc platform and the UI both read these
via the engine, never re-implement them (no JS<->Python drift).

Imposed psi0 is a CATEGORY lookup (user decision locked 2026-06-27): the imposed nature
alone does not fix psi0 — Cat A-D/H (offices, floors, residential, roofs) use 0.7, Cat E
(storage) uses 1.0.

Pure declarations: no numpy compute, no printing, no matplotlib (CLAUDE.md hard rule).
"""

from dataclasses import dataclass, field
from typing import Callable, Dict, Optional

from .natures import Nature, ActionType

# Imposed psi0 by EN 1990 category (UK NA Table A1.1). Default category = "A-D/H".
PSI0_IMPOSED = {"A-D/H": 0.7, "E_storage": 1.0}
DEFAULT_IMPOSED_CATEGORY = "A-D/H"


@dataclass(frozen=True)
class CodePack:
    name: str
    nature_action: Dict[Nature, ActionType]
    gamma: Dict[str, float]
    psi0: Dict[Nature, float]                                 # psi0 for non-category variable natures (Wind, Snow)
    psi0_imposed: Dict[str, float] = field(default_factory=lambda: dict(PSI0_IMPOSED))  # imposed psi0 by category
    psi1: Dict[Nature, float] = field(default_factory=dict)   # forward-compat (SLS frequent) — carried, NOT used
    psi2: Dict[Nature, float] = field(default_factory=dict)   # forward-compat (SLS quasi-permanent) — carried, NOT used
    xi: float = 0.925                                         # UK NA 6.10a/b reduction — carried, NOT used this phase
    generate: Optional[Callable] = None                      # set via combinations.generate_for dispatch (kept clean)


EUROCODE_UK = CodePack(
    name="Eurocode (EN 1990) — UK NA",
    nature_action={
        Nature.SELF_WEIGHT: ActionType.PERMANENT,
        Nature.DEAD:        ActionType.PERMANENT,
        Nature.IMPOSED:     ActionType.VARIABLE,
        Nature.WIND:        ActionType.VARIABLE,
    },
    # UK NA Table NA.A1.2(B), Eq 6.10:
    gamma={"G_sup": 1.35, "G_inf": 1.0, "Q_sup": 1.5, "Q_inf": 0.0},
    # EN 1990 Table A1.1 (UK NA adopts): Wind = 0.6; Snow = 0.5 (carried). Imposed is category-driven (PSI0_IMPOSED).
    psi0={Nature.WIND: 0.6},
    psi0_imposed=dict(PSI0_IMPOSED),
    # forward-compat only (D-15 deferred families); values carried, NOT used:
    psi1={Nature.IMPOSED: 0.5, Nature.WIND: 0.2},
    psi2={Nature.IMPOSED: 0.3, Nature.WIND: 0.0},
)

_REGISTRY = {"eurocode_uk": EUROCODE_UK}


def get_code_pack(name: str) -> CodePack:
    if name not in _REGISTRY:
        raise ValueError(f"Unknown code pack '{name}'. Available: {sorted(_REGISTRY)}")
    return _REGISTRY[name]
