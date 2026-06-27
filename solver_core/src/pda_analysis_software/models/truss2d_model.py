from dataclasses import dataclass
from typing import List, Optional, Union
import numpy as np

@dataclass
class TrussModel2D:
    nodes: np.ndarray
    members: np.ndarray
    E: float
    A: Union[float, List[float], np.ndarray]  # scalar or per-member array
    forceVector: np.ndarray
    restrainedDoF: List[int]