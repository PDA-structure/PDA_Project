from typing import Callable, Dict
from pda_analysis_software.results.results import AnalysisResult

class AnalysisEngine:
    """
    Registry-based solver selector.
    Keeps your project scalable: add new solvers without changing notebooks/UI.
    """

    def __init__(self):
        self._registry: Dict[str, Callable] = {}

    def register(self, name: str, factory: Callable):
        """
        factory(model) -> adapter instance with .solve() returning AnalysisResult
        """
        self._registry[name] = factory

    def available_solvers(self):
        return sorted(self._registry.keys())

    def solve(self, model, solver_name: str) -> AnalysisResult:
        if solver_name not in self._registry:
            raise ValueError(
                f"Unknown solver '{solver_name}'. Available: {self.available_solvers()}"
            )
        adapter = self._registry[solver_name](model)
        return adapter.solve()