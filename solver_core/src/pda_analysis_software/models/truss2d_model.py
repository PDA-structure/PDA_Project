from dataclasses import dataclass
from typing import List, Optional
import numpy as np

@dataclass
class TrussModel2D:
    nodes: np.ndarray
    members: np.ndarray
    E: float
    A: float
    forceVector: np.ndarray
    restrainedDoF: List[int]