---
plan: 01-01
phase: 01-trust-and-production-hardening
status: complete
completed: 2026-04-06
---

# Plan 01-01 Summary

## What was built
- Added global `RuntimeError` exception handler to `api_server/app.py` returning HTTP 422 with `{"detail": "structure is unstable or under-restrained"}` — fixes the HTTP 500 production blocker
- Removed `summarize_results()` from `truss2d.py` and `print_summary()` from `frame_v2.py` — eliminates hard rule violation (no print in solver_core)
- Removed all `print()` calls from `frame_v1_legacy.py`
- Added `member_stresses` (axial force / area) to both `FrameV2Adapter` and `Truss2DAdapter` meta dicts

## Key decisions / notes
- `beamPinRight` condenses the theta DOF from the element stiffness matrix — callers must also list the released theta in `pinDoF` to avoid singular matrix
- `bars=[n]` uses 1-based member numbering; bar elements leave Ux/theta DOFs at both ends without stiffness, so those DOFs must be restrained or supplied by other elements

## Requirements satisfied
- TRUST-01: HTTP 422 on unstable structures
- TRUST-02: Zero print() calls in solver_core
- TRUST-11: member_stresses in API response meta
