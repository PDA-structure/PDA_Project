"""Physical load natures and their code-treatment action types.

D-02: Natures are code-agnostic PHYSICAL types. A load is tagged with a physical
nature ONCE; the active code pack interprets it (permanent vs variable, ψ factors).
Switching code/country re-generates combinations WITHOUT re-tagging any load.

Both enums are ``str``-valued so JSON serialisation stays string-clean and the enum
is designed to grow (later natures listed at the growth point — do NOT implement now).

Pure declarations: no numpy compute, no printing, no matplotlib (CLAUDE.md hard rule).
"""

from enum import Enum


class Nature(str, Enum):
    """Physical action natures (D-02)."""

    SELF_WEIGHT = "Self weight"   # D-04: placeholder nature; auto-compute deferred
    DEAD = "Dead"
    IMPOSED = "Imposed"
    WIND = "Wind"
    # growth point (do NOT implement now):
    #   SNOW, ROOF_IMPOSED, SERVICES, SEISMIC, TEMPERATURE, SETTLEMENT


class ActionType(str, Enum):
    """How the active code pack treats a nature (D-10 nature -> category)."""

    PERMANENT = "permanent"
    VARIABLE = "variable"
