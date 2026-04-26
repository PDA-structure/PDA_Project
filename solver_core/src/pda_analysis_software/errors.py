"""Typed exceptions for solver / adapter / API diagnostic boundaries.

Subclasses RuntimeError so the existing FastAPI handler in api_server/app.py
catches them without registering a new handler. The handler reads the
structured attributes (cause, offending_nodes, offending_members, detail)
to produce a backward-compatible additive 422 payload (Phase 6 D-09, D-13).
"""

from __future__ import annotations


class SolverDiagnosticError(RuntimeError):
    """Structured solver/adapter failure carrying machine-readable cause + locus.

    Subclasses RuntimeError so the existing api_server exception handler
    (`@app.exception_handler(RuntimeError)`) catches it without changes;
    the handler reads `cause`, `offending_nodes`, `offending_members`,
    `detail` to upgrade the 422 payload (additive, backward-compatible).

    Parameters
    ----------
    detail : str
        Human-readable description of the failure.
    cause : str
        Machine-readable cause taxonomy. Known values:
        - "udl_on_bar" (Phase 6 PUREBAR-03 / D-06)
        - Future taxonomy values may be added without breaking existing
          consumers (D-13 — additive forward compatibility).
    offending_nodes : list[int], optional
        1-based node indices the failure attributes to.
    offending_members : list[int], optional
        1-based member indices the failure attributes to.
    """

    def __init__(
        self,
        detail: str,
        cause: str,
        offending_nodes: list[int] | None = None,
        offending_members: list[int] | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.cause = cause
        self.offending_nodes = list(offending_nodes or [])
        self.offending_members = list(offending_members or [])

    def __repr__(self) -> str:
        return (
            f"SolverDiagnosticError(detail={self.detail!r}, "
            f"cause={self.cause!r}, "
            f"offending_nodes={self.offending_nodes!r}, "
            f"offending_members={self.offending_members!r})"
        )
