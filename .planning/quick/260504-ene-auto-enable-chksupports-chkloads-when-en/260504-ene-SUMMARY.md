---
phase: 260504-ene
plan: 01
subsystem: ui
tags: [frame2d, ui, vanilla-js, debug-resolution, foot-gun-fix]

# Dependency graph
requires:
  - phase: 260503-cf7
    provides: tailscale-serve persistent tailnet proxy enables remote browser UAT of frame2d UI on Windows work-laptop
provides:
  - setMode() in ui/frame2d/script.js auto-enables matching visibility checkbox (chkSupports / chkLoads) and calls draw()
  - Closure of long-running misdiagnosed "frame2D UI freezes after Load JSON" debug session with actual root cause documented
  - CLAUDE.md UI conventions section codifies the auto-enable behaviour as a project rule
  - Pending follow-up todo for the same anti-pattern in ui/truss2d/script.js (P3, deferred)
affects: [frame2d-ui, truss2d-ui, debug-method, future-three.js-3d-viewer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode entry auto-enables matching visibility layer — UI visibility flags should never be able to silently suppress feedback for the mode the user is actively engaging"
    - "Lesson for future debug sessions: validate the freeze itself before mining state-management surface — 'click does nothing visible' can mean rendering is suppressed, not that the JS event loop is stuck"

key-files:
  created:
    - .planning/quick/260504-ene-auto-enable-chksupports-chkloads-when-en/260504-ene-SUMMARY.md
    - .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md
    - .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md
  modified:
    - ui/frame2d/script.js
    - .planning/debug/frame2d-load-then-add-support.md
    - CLAUDE.md
  removed:
    - .planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md

key-decisions:
  - "Foot-gun removal over user-education: bind mode entry to matching visibility layer rather than expect users to remember to tick the visibility checkbox before clicking"
  - "Codify the auto-enable as a UI convention in CLAUDE.md so the convergent pattern is enforced across truss2d and frame2d"
  - "Defer the truss2d sibling fix to a separate P3 todo rather than expanding scope of this single-edit quick task"

patterns-established:
  - "UI mode → visibility layer binding: any mode whose only visible feedback comes from a visibility-gated draw step must auto-enable that visibility layer in setMode()"
  - "Debug-session reframe: when a non-developer reporter says 'frozen', validate via Console probe of the data array before assuming JS hang"

requirements-completed: [QUICK-260504-ene]

# Metrics
duration: ~4 min (autonomous Tasks 1-3); manual UAT (Task 4) deferred to user
completed: 2026-05-04
---

# Phase 260504-ene Plan 01: Auto-enable chkSupports/chkLoads on mode entry — Summary

**setMode() in ui/frame2d/script.js auto-ticks the matching visibility checkbox (chkSupports for support modes, chkLoads for load modes) and calls draw() — closes the misdiagnosed "freeze after Load JSON" debug session by removing the silent-feedback foot-gun.**

## Performance

- **Duration:** ~4 min (Tasks 1-3 autonomous; Task 4 manual UAT pending)
- **Started:** 2026-05-04T09:37:20Z
- **Completed (Tasks 1-3):** 2026-05-04T09:40:53Z
- **Tasks:** 3 of 4 complete (Task 4 is checkpoint:human-verify — paused for user)
- **Files modified:** 6 (1 source, 5 docs/planning)

## Accomplishments

- `ui/frame2d/script.js` `setMode()` now auto-enables the matching visibility checkbox (chkSupports for fixed/pinned/rollerX/rollerY/spring; chkLoads for loadX/loadY/loadMoment/udl) and calls `draw()`. Two `Set` constants `SUPPORT_MODES` and `LOAD_MODES` placed immediately above the function.
- `.planning/debug/frame2d-load-then-add-support.md` marked `status: resolved`, frontmatter `updated: 2026-05-04`. Original placeholder Resolution code-block replaced with a final Resolution section documenting the actual root cause (visibility checkboxes unchecked at click time), why all 8 candidates A-F from the 2026-05-03 diagnose-only session were wrong, and the lesson for future debug sessions.
- Todo `2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` moved from `.planning/todos/pending/` to `.planning/todos/done/` with a top-of-file resolution preface; original frontmatter and body preserved.
- `CLAUDE.md` "UI conventions" section gains a bullet codifying mode-entry auto-enable behaviour as a project rule.
- New pending todo `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` (P3) captures the same latent anti-pattern in `ui/truss2d/script.js` for the next truss2d touch.

## Task Commits

Each task was committed atomically:

1. **Task 1: Auto-enable matching visibility checkbox in setMode()** — `3797fe2` (fix)
2. **Task 2: Close debug session and move todo to done/** — `970769b` (docs)
3. **Task 3: Add UI conventions note to CLAUDE.md and create truss2d follow-up todo** — `fd3f17a` (docs)
4. **Task 4: Manual UAT in browser** — checkpoint:human-verify, deferred to user (no commit)

**Plan metadata commit:** pending — orchestrator will commit SUMMARY.md + STATE.md after Task 4 UAT signed off.

## Files Created/Modified

- `ui/frame2d/script.js` — `SUPPORT_MODES` / `LOAD_MODES` Sets added; `setMode()` auto-enables matching checkbox + calls `draw()` (~15 lines added).
- `.planning/debug/frame2d-load-then-add-support.md` — frontmatter `status: resolved`, `updated: 2026-05-04`; placeholder Resolution code-block replaced with full Resolution section.
- `.planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` — moved from `pending/`, prefaced with RESOLVED block.
- `.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` — removed (rename to done/).
- `CLAUDE.md` — new bullet appended to "UI conventions (both truss2d and frame2d)" section.
- `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` — new P3 follow-up todo for the truss2d sibling.

## Decisions Made

- **Foot-gun removal vs user-education:** Bind mode entry to matching visibility layer in code rather than rely on users to remember to tick the visibility checkbox before clicking. Cost is ~6 lines; benefit is permanent removal of the silent-feedback failure mode.
- **Project rule, not local fix:** Codify the auto-enable behaviour as a UI convention in CLAUDE.md so the same pattern is enforced when truss2d catches up and when future UIs are added.
- **Scope discipline:** Truss2d has the same anti-pattern but is deferred to a separate P3 todo. The user explicitly wanted a single small edit landed first; expanding scope to mirror the fix into truss2d would have doubled the surface area without proportional risk reduction.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1-3 verifications all passed on first run.

## Issues Encountered

None during execution. Pre-existing untracked files (`.claude/`, `.planning/quick/260504-ene-...`, `.planning/debug/frame2d-load-then-add-support.md`) were already present before the worktree was started — they were correctly added during Task 2's commit (debug file) and will be added during the orchestrator's metadata commit (the plan + summary directory).

## Manual UAT Steps (Task 4 — checkpoint:human-verify)

**This step is paused for the user. Do not auto-approve — visual verification in the browser is required.**

### Pre-conditions

- API server running: from `pda_project/` run `uvicorn api_server.app:app --reload` (or use the existing tailnet-served instance via `https://catrins-imac.tail568b7e.ts.net/`).
- Worktree branch (containing this plan's commits) merged or checked out so `ui/frame2d/script.js` includes the new `setMode()` body.

### Verification steps

1. **Open the frame2d UI:** browse to `http://127.0.0.1:8000/ui/frame2d/index.html` (or the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`).
2. **Place two nodes** by clicking twice in Add Node mode.
3. **Untick the "Show supports" checkbox** in the Display panel on the left.
4. **Click the "Fixed" support button.** Expected:
   - The "Show supports" checkbox immediately re-ticks itself.
   - The mode label at the top of the canvas shows "Fixed Support".
5. **Click one of the placed nodes.** Expected: the fixed-support glyph appears at that node immediately. (Pre-fix: glyph would not appear because chkSupports was unchecked; user would have to manually re-tick it.)
6. **Untick "Show loads".** Click "Force Y", then click a node, enter a value in the prompt. Expected: chkLoads auto-ticks; arrow glyph appears. Repeat for "→ Force X" and "↺ Moment" — chkLoads stays ticked.
7. **Click "▤ UDL" (member loads section).** Expected: chkLoads is set to true (already was, from step 6) — verify it does not get unticked.
8. **Repeat with the previously-invisible-glyph case** — the bug-trigger that motivated this fix:
   - Untick "Show supports".
   - Click on a node in Fixed mode (clicking the button should auto-tick "Show supports", but to test the originally-reported sequence: tick it back off, click the node — pre-fix, the glyph would not appear; post-fix, you should never reach that state because clicking Fixed re-ticks the checkbox before the click handler runs).
9. **Negative check:** click "➕ Add Node" (a non-support, non-load mode). Expected: chkSupports / chkLoads are NOT modified by this mode entry.

### Resume signal

Type "approved" in the orchestrating session if all of the above match expectations. Otherwise describe what diverged.

## Next Phase Readiness

- Frame2D UI silent-feedback foot-gun closed; the load-then-add-support sequence reported in the original 2026-05-02 todo is now visually correct (subject to UAT confirmation in Task 4).
- Truss2d sibling fix tracked as a P3 pending todo; converging the two UIs is a clean follow-up that can be picked up on the next truss2d touch.
- Phase 7 (`revit-element-to-analytical-conversion`) remains paused awaiting Revit 2025 access — unaffected by this quick task.
- Three.js 3D viewer todo (`2026-04-29-threejs-frame2d-3d-viewer.md`) — this fix removes one piece of state-management debt from the frame2d UI surface, reducing the risk of carrying the foot-gun into 3D-viewer work.

## Self-Check: PASSED

- `ui/frame2d/script.js` — present, contains `SUPPORT_MODES = new Set([...])`, `LOAD_MODES    = new Set([...])`, and the `setMode()` body with `chkSupports.checked = true` / `chkLoads.checked = true` branches + final `draw()` call. Verified via Task 1 automated grep.
- `.planning/debug/frame2d-load-then-add-support.md` — present, frontmatter `status: resolved`, `updated: 2026-05-04`, contains `## Resolution (2026-05-04)`. Verified via Task 2 automated check.
- `.planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` — present, contains `RESOLVED 2026-05-04`. Verified via Task 2 automated check.
- `.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` — confirmed removed.
- `CLAUDE.md` — contains `Mode entry auto-enables the matching visibility layer`. Verified via Task 3 automated grep.
- `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` — present, contains `Mirror mode-entry-auto-enables-visibility fix to truss2d`. Verified via Task 3 automated check.
- Commits `3797fe2` (Task 1), `970769b` (Task 2), `fd3f17a` (Task 3) — all present in `git log`.

---
*Phase: 260504-ene-auto-enable-chksupports-chkloads-when-en*
*Completed: 2026-05-04 (Tasks 1-3 autonomous); Task 4 manual UAT pending*
