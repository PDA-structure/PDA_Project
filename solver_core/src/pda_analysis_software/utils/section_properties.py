"""
Section property calculator for common cross-section shapes.

Dimensions are expected in mm; output I is in cm4 and A is in cm2.
"""
import math
from typing import Tuple


def section_properties(section_type: str, **dims) -> Tuple[float, float]:
    """Calculate second moment of area (I) and cross-sectional area (A) for a given section.

    Parameters
    ----------
    section_type : str
        One of 'rectangle', 'circle', 'i_section'.
    **dims : float
        Dimension keyword arguments (in mm):
        - rectangle: b (width), h (height)
        - circle: d (diameter)
        - i_section: b (flange width), H (total height), tf (flange thickness), tw (web thickness)

    Returns
    -------
    Tuple[float, float]
        (I_cm4, A_cm2) — second moment of area in cm4 and area in cm2.

    Raises
    ------
    ValueError
        If section_type is not recognised.
    """
    if section_type == 'rectangle':
        b = dims['b']
        h = dims['h']
        I_mm4 = b * h**3 / 12
        A_mm2 = b * h

    elif section_type == 'circle':
        d = dims['d']
        I_mm4 = math.pi * d**4 / 64
        A_mm2 = math.pi * d**2 / 4

    elif section_type == 'i_section':
        b = dims['b']
        H = dims['H']
        tf = dims['tf']
        tw = dims['tw']
        hw = H - 2 * tf
        I_mm4 = b * H**3 / 12 - (b - tw) * hw**3 / 12
        A_mm2 = 2 * b * tf + tw * hw

    else:
        raise ValueError(
            f"Unknown section type '{section_type}'. "
            f"Supported types: 'rectangle', 'circle', 'i_section'."
        )

    I_cm4 = I_mm4 / 1e4
    A_cm2 = A_mm2 / 100

    return I_cm4, A_cm2
