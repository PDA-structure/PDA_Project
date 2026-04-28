from dataclasses import dataclass
from typing import Optional, List, Union
import numpy as np

@dataclass
class FrameModel2D:
    nodes: np.ndarray
    members: np.ndarray
    ENForces: np.ndarray
    ENMoments: np.ndarray
    forceVector: np.ndarray

    E: Union[float, List[float]]
    I: Union[float, List[float]]

    # either:
    A: Optional[Union[float, List[float]]] = None
    # or:
    A_beam: Optional[float] = None
    A_bar: Optional[float] = None

    # member type/release controls
    bars: Optional[List[int]] = None
    beamPinLeft: Optional[List[int]] = None
    beamPinRight: Optional[List[int]] = None
    pins: Optional[np.ndarray] = None  # legacy

    # constraints
    restrainedDoF: Optional[List[int]] = None
    pinDoF: Optional[List[int]] = None

    # springs
    springDoF: Optional[List[int]] = None
    springStiffness: Optional[List[float]] = None