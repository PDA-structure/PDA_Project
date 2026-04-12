---
plan: 01-03
phase: 01-trust-and-production-hardening
status: complete
completed: 2026-04-11
---

# Plan 01-03 Summary

## What was built
- Added BMD/SFD toggle checkboxes (`chkBMD`, `chkSFD`) to the Display section — disabled before first solve, enabled after
- Implemented `drawBMD()` with cubic Hermite interpolation (20-point sampling) and quartic UDL correction for exact midspan deflection
- Implemented `drawSFD()` with linear interpolation between end shear values
- Implemented `drawDeflected()` using cubic Hermite shape functions with solver theta sign correction (`dy/dx = -solver_theta`)
- Added `clearDiagramState()` helper — resets/disables diagram checkboxes on Reset All and when results cleared
- Added `sigma (MPa)` column to Member Actions table, reading from `results.meta.member_stresses`
- Added BMD/SFD scale input (`inputDiagramScale`) and deflection scale input (`inputScale`)
- Added show/hide toggles for supports (`chkSupports`) and loads (`chkLoads`) — default checked

## Key decisions / notes
- Solver theta sign convention: positive = clockwise. Standard Hermite slope requires `dy/dx = -solver_theta`
- Cubic Hermite underestimates UDL midspan deflection by ~20% — quartic correction: `-w*L^4/(24EI)*xi^2*(1-xi)^2`
- BMD diagrams required multi-point interpolation (20 sample points) — straight-line between restrained nodes draws nothing visible for short members
- Drawing order: Grid → UDLs → Members → BMD → SFD → Deflected → Nodes → Supports → Loads

## Requirements satisfied
- TRUST-09: BMD rendered on canvas after solving with toggle checkbox
- TRUST-10: SFD rendered on canvas after solving with toggle checkbox
