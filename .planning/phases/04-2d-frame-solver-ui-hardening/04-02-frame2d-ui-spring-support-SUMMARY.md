---
phase: 04-2d-frame-solver-ui-hardening
plan: 02
subsystem: ui
tags: [frame2d, ui, spring-support, canvas, json-schema, save-load]

requires:
  - phase: 03-interchange-format-and-external-inputs
    provides: canonical frame2d JSON schema (canvas.supports, springDoF, springStiffness already on the model)
  - phase: 04-2d-frame-solver-ui-hardening
    provides: TRUST-16 analytical regression on FrameV2Adapter spring pipeline (Plan 04-01)
provides:
  - Spring toolbar button + modal in frame2d UI exposing translational (Kx, Ky) and rotational (Kθ) elastic supports
  - Canvas coil-glyph rendering per active spring axis with value-tag labels
  - Extended JSON schema (D-08): `canvas.supports[nodeId]` may now be a spring object `{type:'spring', Kx, Ky, Ktheta}` alongside legacy string-valued classic supports — fully backward compatible
  - SI unit conversion at the payload boundary: kN/m → N/m and kN·m/rad → N·m/rad (×1e3)
affects: [04-03 (UAT harness uses spring fixture), future Revit Tier 1 / Tier 2 (spring schema is now canonical)]

tech-stack:
  added: []
  patterns:
    - "Floating modal pattern (#springPanel) for support-with-parameters input — first non-modal-dialog form element in the frame2d UI"
    - "Shared `computeSpringPayload()` helper used by BOTH the Solve button payload builder AND the Save JSON serializer to guarantee a single source of truth for SI unit conversion"

key-files:
  created: []
  modified:
    - ui/frame2d/index.html
    - ui/frame2d/script.js
    - ui/frame2d/style.css

key-decisions:
  - "Spring replaces any classic support at the same node (D-05) — there is no `Spring + Pin` combined state; placing a spring removes any prior fixed/pin/roller glyph at that node, matching the structural-engineering intent that an elastic restraint and a rigid restraint at the same DOF are mutually exclusive"
  - "Blank-all submission = cancel (D-06) — at least one non-blank K is required to register a spring; blank-all closes the modal as a no-op rather than creating a degenerate zero-stiffness spring"
  - "JSON support storage is type-discriminated: classic supports remain plain strings ('fixed', 'pinned', 'rollerX', 'rollerY') for Phase 3 backward compatibility; spring supports use the discriminated object form `{type:'spring', Kx, Ky, Ktheta}` (D-08). Load logic checks `typeof support === 'object'` to dispatch."
  - "Pre-fill on edit (D-06): clicking the Spring button on an existing spring node reopens the modal with current values, not blank — supports iterative tuning during model setup"

patterns-established:
  - "Type-discriminated JSON for evolvable support schema — future support types (e.g. partial-fixity, elastic foundation) can be added as new `{type:..., ...}` object forms without breaking string-valued legacy files"
  - "Single shared payload helper for unit-converted DOF arrays — prevents the divergence bug class where Save and Solve would emit different SI conversions for the same UI input"

requirements-completed: [HARDEN-02]

duration: ~7m executor + ~30m human UAT
completed: 2026-04-19
---

# Phase 04 Plan 02: Frame2D UI Spring Support Summary

**Spring (Kx / Ky / Kθ) elastic-support input added to the frame2d browser UI: toolbar button, modal, coil-glyph canvas rendering, type-discriminated JSON save/load (backward compatible with Phase 3 string-valued supports), and SI-unit payload to /solve/frame2d — verified end-to-end by 11-step human UAT producing reaction = K·δ = 10 kN at Ky=1000 kN/m under -10 kN load.**

## Performance

- **Duration:** ~7 min agent + ~30 min human UAT verification
- **Started:** 2026-04-19T15:13Z
- **Completed:** 2026-04-19T18:00Z (after human approval of all 11 UAT steps)
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- "〰 Spring" button in Supports toolbar group, mode-toggle behaviour matches existing Fixed/Pin/Roller buttons
- Floating spring panel (#springPanel) with Kx / Ky / Kθ inputs in user units (kN/m and kN·m/rad)
- Canvas coil glyphs (purple `#6a1b9a`): horizontal coil on -X for Kx, vertical coil below node for Ky, spiral arc for Kθ — each with value-tag label
- Save serializer emits spring objects `{type:'spring', Kx, Ky, Ktheta}` for spring nodes, plain strings for classic supports — D-08 schema honored
- Load deserializer accepts BOTH spring objects (new) AND plain strings (Phase 3) — backward compatible, verified against `tests/fixtures/sample_pda_frame2d.json`
- Solve payload populates `springDoF` (1-based DOF: base = nodeId×3+1; Kx→base, Ky→base+1, Kθ→base+2) and `springStiffness` (SI units, ×1e3 conversion) via shared `computeSpringPayload()` helper used by both the Solve and Save code paths
- Spring replaces classic support at the same node (D-05); modal pre-fills existing values for in-place editing (D-06)

## Task Commits

1. **Task 1: Add Spring toolbar button + spring modal HTML + CSS** — `fff1e78` (feat)
2. **Task 2: Wire spring mode in setMode/click handler, modal apply/cancel, payload builder, save, load** — `8d45270` (feat)
3. **Task 3: Human verification of spring UI behavior and save/load round-trip** — checkpoint:human-verify, all 11 steps approved by user (no commit; verification artifact)

**Worktree merge:** `11aa8bd` (chore: merge executor worktree)
**Plan metadata:** SUMMARY.md committed by orchestrator after merge.

## Files Created/Modified
- `ui/frame2d/index.html` — Spring button in Supports section + #springPanel modal markup with Kx/Ky/Kθ inputs and Apply/Cancel buttons (+29 lines)
- `ui/frame2d/script.js` — spring mode dispatcher, modal show/apply/cancel handlers, drawSupports coil-glyph rendering branch, computeSpringPayload() shared helper, save serializer object form, load deserializer dual-form acceptance, MODE_LABELS entry (+205 lines, -11 lines)
- `ui/frame2d/style.css` — modal container, coil-glyph supporting styles (+14 lines)

## Decisions Made
- **Spring replaces classic (D-05):** modeled at the application layer (drawSupports + supports map mutation) rather than blocking in the UI — placing any support of any type at a node overwrites any existing support. Avoids confusing "spring + pin at same DOF" states.
- **Type-discriminated JSON (D-08):** spring supports stored as `{type:'spring', ...}` objects, classic supports remain bare strings. Future support types can extend this discrimination without breaking Phase 3 files.
- **Shared payload helper:** the SI-unit conversion (kN/m → N/m via ×1e3) lives in a single `computeSpringPayload()` function called by both the Solve POST body and the Save JSON `springDoF`/`springStiffness` fields — prevents the divergence bug where Save and Solve might disagree on units after future edits.
- **Blank-all = cancel (D-06):** all-three-fields-blank submission closes the modal without registering a spring, matching the Cancel button's behaviour. Prevents the trap of creating a zero-stiffness spring (which would silently pass solve as a free DOF).

## Deviations from Plan

None — all three tasks executed as written; files modified match the plan's `files_modified` field exactly.

## Issues Encountered

None during agent execution. The agent paused cleanly at the Task 3 checkpoint and the orchestrator presented the 11-step UAT to the user; the user verified all 11 steps in browser with results matching expected values (reaction = 10 kN ±0.1%, Uy = -0.01 m, JSON schema matches the D-08 spec, Phase 3 backward compatibility loads `tests/fixtures/sample_pda_frame2d.json` cleanly, no console errors throughout).

## User Setup Required

None — UI-only change, no external services.

## Next Phase Readiness
- Spring schema is now canonical and round-trips through Save/Load — Plan 04-03 can author the `spring_support_beam.json` UAT fixture using the Save button
- The `computeSpringPayload()` helper is the single source of truth for SI conversion — any future fixture authored via Save will produce solver-correct payloads
- Backward compatibility with Phase 3 string-valued supports preserved — no migration needed for existing saved files

---
*Phase: 04-2d-frame-solver-ui-hardening*
*Completed: 2026-04-19*
