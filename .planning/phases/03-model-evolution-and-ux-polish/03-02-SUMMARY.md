---
phase: 03-model-evolution-and-ux-polish
plan: 02
subsystem: ui
tags: [vanilla-js, canvas, frame2d, per-member, section-properties]

# Dependency graph
requires:
  - phase: 03-01
    provides: Union[float, List[float]] E/I/A in API and solver
provides:
  - Per-member E/I/A assignment via click-member prompts in frame2d UI
  - Section property calculator sidebar panel (rectangle, circle, I-section)
  - Payload builder sends lists when overrides exist, scalars otherwise
  - Blue override indicator on members with non-default properties
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - memberProps mode follows UDL click-member prompt pattern
    - anyOverride flag gates scalar vs list payload — avoids sending unnecessary lists
    - Override fields (E_override, I_override, A_override) initialised null on member creation

key-files:
  created: []
  modified:
    - ui/frame2d/index.html
    - ui/frame2d/script.js
    - ui/frame2d/style.css

key-decisions:
  - "calcSection() is pure JS — mirrors Python section_properties() formulas exactly (no API call needed)"
  - "anyOverride flag: if ANY member has an override, ALL members send list values (mix of override + global fallback)"
  - "Override indicator drawn as thick blue stroke (lineWidth=4, #3f51b5) over the member line"

patterns-established:
  - "Per-member UI: mode handler + findMemberAt + sequential prompts + draw() — follows UDL pattern"
  - "Payload resolution: anyOverride ? members.map(m => (m.X_override ?? global) * unit_conv) : global * unit_conv"

requirements-completed: [MODEL-01, MODEL-03]

# Metrics
duration: ~20min
completed: 2026-04-12
---

# Plan 03-02: Per-member E/I/A UI + Section Calculator

**Frame2d UI extended with click-member E/I/A override prompts, blue override indicator, and section property calculator sidebar — payload sends lists only when overrides are active**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-04-12
- **Tasks:** 2 + human-verify checkpoint (approved)
- **Files modified:** 3

## Accomplishments
- Section Calculator panel permanently visible in sidebar — rectangle, circle, and I-section, matching Python utility formulas
- Per-Member E/I/A mode: click any member → sequential prompts for E (GPa), I (cm⁴), A (cm²); blank = use global
- Members with overrides shown with thick blue (#3f51b5) outline on canvas
- Solve payload automatically sends scalar E/I/A when all global, lists when any member has an override
- Backward compatibility confirmed: solving with no overrides unchanged

## Task Commits

1. **Task 1 + Task 2 (combined)** — `360d2f3` (feat): section calculator + per-member mode

## Files Created/Modified
- `ui/frame2d/index.html` — Section Calculator panel, Per-Member E/I/A button
- `ui/frame2d/script.js` — calcSection(), memberProps mode handler, override indicator in drawMembers(), anyOverride payload builder, E/I/A_override fields on member objects
- `ui/frame2d/style.css` — sec-inputs, panel-label, download-link styles

## Decisions Made
- Section calculator is pure JS (no API call) — mirrors Python formulas exactly
- anyOverride flag means one override affects all members' payload format (scalar → list with global fallbacks)

## Deviations from Plan
Tasks 1 and 2 landed in a single commit (agent Bash access denied; orchestrator committed after edits complete).

## Issues Encountered
Transient support-adding UI glitch during checkpoint verification — resolved by page reload; no code change needed.

## Next Phase Readiness
Phase 03 all plans complete. Ready for phase verification.

---
*Phase: 03-model-evolution-and-ux-polish*
*Completed: 2026-04-12*
