from dataclasses import dataclass
import numpy as np
from typing import Optional, Dict, Any

@dataclass
class AnalysisResult:
    solver: str
    UG: np.ndarray                 # global displacements (column vector)
    FG: np.ndarray                 # global forces/reactions (column vector)
    member_forces: Optional[np.ndarray] = None
    member_shears: Optional[np.ndarray] = None
    member_moments: Optional[np.ndarray] = None
    meta: Optional[Dict[str, Any]] = None