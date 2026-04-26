"""Worktree-local conftest: forces this worktree's solver_core/src and api_server
to take precedence over any editable install pointing at the main repo path.

Without this override, ``import pda_analysis_software`` resolves via the
editable install's .pth file to the MAIN repo's solver_core (not this
worktree's), so any solver edit made in this worktree would be invisible to
pytest.

This file is only present in the worktree (untracked from the main branch's
perspective); it is removed automatically when the worktree is force-removed
by the parallel-execution orchestrator.
"""
import os
import sys

_WORKTREE_ROOT = os.path.dirname(os.path.abspath(__file__))
_WORKTREE_SOLVER_SRC = os.path.join(_WORKTREE_ROOT, "solver_core", "src")
_MAIN_SOLVER_SRC = "/Users/catrinevans/Documents/pda_project/solver_core/src"

# Remove the main-repo path if present so the worktree wins.
sys.path = [p for p in sys.path if p != _MAIN_SOLVER_SRC]
# Insert the worktree path FIRST.
if _WORKTREE_SOLVER_SRC not in sys.path:
    sys.path.insert(0, _WORKTREE_SOLVER_SRC)
# Add worktree root for api_server.* imports.
if _WORKTREE_ROOT not in sys.path:
    sys.path.insert(0, _WORKTREE_ROOT)

# Verify import resolves to worktree
import pda_analysis_software  # noqa: E402

assert _WORKTREE_SOLVER_SRC in pda_analysis_software.__file__, (
    f"conftest.py failed to override solver_core path; "
    f"pda_analysis_software resolved to: {pda_analysis_software.__file__}"
)
