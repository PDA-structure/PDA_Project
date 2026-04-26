#!/usr/bin/env python3
"""Capture solver-output snapshots for the entire pytest suite.

This script is the executable form of Phase 6 D-05 / D-16: BEFORE any solver
mutation, run every existing test through pytest's normal fixture-resolution
machinery and record (UG, FG, member_forces, member_shears, member_moments)
for each ``BeamBarStructure_v2.solve_structure`` and ``Truss.solve``
invocation.

Output: one JSON file per collected test in ``tests/snapshots/baseline/``.
Tests that do not invoke a solver get a ``skipped: true`` placeholder so the
file count holds at >=25.

Usage:
    python scripts/capture_solver_snapshots.py

Exit codes:
    0 — all tests passed AND >=25 snapshots written
    1 — pytest exited non-zero OR snapshot count below threshold
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make sure we're running from the worktree root and using the worktree's
# solver_core. _snapshot_common does the sys.path massaging.
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))

from _snapshot_common import (  # noqa: E402
    SNAPSHOT_DIR,
    make_capture_plugin,
    write_snapshots,
)


def main() -> int:
    import pytest

    records: dict = {}
    plugin = make_capture_plugin(records)

    project_root = _HERE.parent
    rc = pytest.main(
        [str(project_root / "tests"), "-q", "--no-header"],
        plugins=[plugin],
    )

    if rc != 0:
        print(f"ERROR: pytest exited {rc}; aborting snapshot capture.", file=sys.stderr)
        return 1

    written = write_snapshots(records)
    print(f"Wrote {written} snapshot file(s) to {SNAPSHOT_DIR}")

    if written < 25:
        print(
            f"ERROR: only {written} snapshots written (need >=25). "
            "Did the test discovery walk every test_*.py file?",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
