#!/usr/bin/env python3
"""Verify solver outputs match the captured baseline.

Runs the entire pytest suite (same pytest-plugin pattern as
``capture_solver_snapshots.py``) and compares each in-memory capture against
the on-disk baseline using ``np.allclose(rtol=1e-9, atol=1e-12)``.

Exit codes:
    0 — every captured field matches its baseline (within tolerance)
    1 — pytest failed OR any field mismatched OR baseline missing for a captured test

Usage:
    python scripts/verify_solver_snapshots.py
"""
from __future__ import annotations

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))

from _snapshot_common import (  # noqa: E402
    SNAPSHOT_DIR,
    compare_capture_to_baseline,
    make_verify_plugin,
)


def main() -> int:
    import pytest

    if not SNAPSHOT_DIR.exists():
        print(
            f"ERROR: baseline directory {SNAPSHOT_DIR} does not exist. "
            "Run scripts/capture_solver_snapshots.py first.",
            file=sys.stderr,
        )
        return 1

    records: dict = {}
    plugin = make_verify_plugin(records)

    project_root = _HERE.parent
    rc = pytest.main(
        [str(project_root / "tests"), "-q", "--no-header"],
        plugins=[plugin],
    )

    if rc != 0:
        print(f"ERROR: pytest exited {rc}; cannot verify snapshots.", file=sys.stderr)
        return 1

    # Walk every collected test and compare.
    issues: list[str] = []
    for nodeid, captures in records.items():
        issues.extend(compare_capture_to_baseline(nodeid, captures))

    if issues:
        print(f"FAIL: {len(issues)} mismatch(es) detected:", file=sys.stderr)
        for line in issues:
            print(f"  {line}", file=sys.stderr)
        return 1

    print(f"OK: all captured outputs match baseline ({len(records)} test(s) verified)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
