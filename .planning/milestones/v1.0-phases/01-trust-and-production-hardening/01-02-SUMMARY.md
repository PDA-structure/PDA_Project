---
plan: 01-02
phase: 01-trust-and-production-hardening
status: complete
completed: 2026-04-11
---

# Plan 01-02 Summary

## What was built
- Added 5 new analytical frame test cases (TRUST-03 through TRUST-07):
  - `test_udl_simply_supported_deflection`: UDL beam, reactions = wL/2, end rotation = wL³/24EI
  - `test_portal_frame_equilibrium`: inverted-V portal, horizontal reaction sum = applied lateral load
  - `test_bar_member_in_mixed_structure`: bar member has exactly zero shear and zero moment
  - `test_pin_release_beam_pin_right`: moment at pin-released j-end is zero
  - `test_propped_cantilever_udl`: prop reaction = 3wL/8 verified analytically
- Retrofitted global equilibrium assertions (`np.isclose`) to all 10 existing tests (TRUST-08)
- Total: 15 tests, all passing

## Key decisions / notes
- `beamPinRight` + free end requires `pinDoF=[theta_DOF]` — otherwise the condensed theta row/col has zero stiffness → singular matrix
- Bar elements (vertical) leave Ux and theta DOFs at the bar-end node without stiffness → those DOFs must be fully fixed or provided by other elements
- FG = Kp @ UG includes both reactions and applied loads, so `np.sum(FG)` is always 0. Equilibrium checks must target specific reaction DOFs only

## Requirements satisfied
- TRUST-03: UDL simply-supported beam analytical test
- TRUST-04: Portal frame equilibrium test
- TRUST-05: Bar member zero-shear/moment test
- TRUST-06: Pin release test
- TRUST-07: Propped cantilever analytical test
- TRUST-08: Global equilibrium assertion on every test
