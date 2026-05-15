---
status: resolved_phantom
trigger: "truss2d UI — two regressions captured 2026-04-18 from Phase 3 plan 03-01 (Save/Load JSON, commit dabbe55). May or may not still reproduce — verify against current main first."
created: 2026-05-15
updated: 2026-05-15
resolved: 2026-05-15
slug: truss2d-load-scale-regressions
files_in_scope:
  - ui/truss2d/script.js
  - ui/truss2d/index.html
out_of_scope:
  - solver_core/
  - api_server/
  - tests/
  - ui/frame2d/
resolution:
  outcome: resolved_phantom
  evidence: User browser UAT 2026-05-15 against current main (HEAD ~2afd769) — both Regression 1 (Add Load silent fail) and Regression 2 (Scale input stuck) failed to reproduce. Confirmed phantom bugs against current HEAD.
  likely_silent_fix: Intervening commits between 2026-04-18 capture and 2026-05-15 verification hardened the relevant code paths. Most plausible contributors — 260418-vxi (try/catch wrapping + error banner machinery, landed same day as the original report), 317e69c (zoom/pan view transform — affects findNodeAt hit-radius), 71ede0f (260414-s3t — resetAll resets view + mode + panel state), 092fcb9 (260515-vhr-01 — setMode visibility-auto-enable + final draw() call). No single commit was a targeted fix; the cumulative effect of UI hygiene work appears to have closed both symptom paths.
  code_changes: none
---

# Truss2D — Add Load silent fail + Scale input stuck (RESOLVED PHANTOM)

## Resolution 2026-05-15

User browser UAT confirmed **both regressions no longer reproduce** against current HEAD. The 8-month-old report does not survive contact with current code. No fix required.

Per the Evidence section below, static analysis predicted this outcome — neither symptom had a code-level mechanism in current HEAD that could produce it. The browser UAT confirmed.

Closing as `resolved_phantom`. Companion todo `2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md` moved `pending → done/` with the same resolution narrative.

---



## Symptoms

### Regression 1 — Add Load silently fails

**Expected:** Reset All → add 2+ nodes → add a member → click "Add Load" toolbar button → click on a node. A `prompt()` should appear asking for load direction (x or y). After answering, a second `prompt()` should ask for magnitude. The load arrow glyph should then render at the clicked node.

**Actual (as of 2026-04-18 verification):** Nothing happens at all. No prompt dialog, no error alert, no console log. The state silently does NOT update — `loads[]` array stays empty.

### Regression 2 — Scale factor input "gets stuck" after Solve

**Expected:** Solve a structure successfully → change the "Scale factor" field (`#inputScale`, default value 100) → the displayed deflected-shape scale should update reactively in the canvas (this is wired via `oninput` → `draw()`).

**Actual (as of 2026-04-18 verification):** After a successful Solve, the input appears frozen / unresponsive. User cannot edit the value; reactive `draw()` doesn't fire on input.

## Reproduction status

**Original repro:** Phase 3 human verification, post-dabbe55 (`feat(03-01): add Save/Load JSON to truss2d UI`).

**Today's status:** UNVERIFIED. Several intervening commits touched `ui/truss2d/script.js` since 2026-04-18:
- `2f82b0a` 260418-vxi-02 — wrap entry points in try/catch (error banner)
- `cc99c20` 260418-vxi-01 — error banner + global handlers
- `0c67a4e` 03-03 — JSON result export download link
- `9d7fa1a` 03-03 — node label overlay + symbol size control
- `e64e496` quick-260503-b57 — switch to relative API_URL
- `71ede0f` 260414-s3t — resetAll resets view + mode + panel state
- `092fcb9` 260515-vhr-01 — setMode visibility-auto-enable (just landed)

**First action must be a fresh repro** against current main. Some of these commits (especially the try/catch wrapping in 260418-vxi) may have already hidden or partially fixed the symptoms — making this a debug session about a 8-month-old phantom bug.

## Original hypotheses (from todo, need verification)

1. **(a) Runtime exception from draw()** after the new Phase 3 code path mutates state in an unexpected way. → if true, would be caught by the 260418-vxi try/catch wrapping and would surface in the error banner; absence of banner today = either no exception OR exception thrown outside wrapped scope
2. **(b) Browser-cache issue** serving stale script. → unlikely now (8 months later); fresh repro will rule out
3. **(c) Subtle interaction with `updateSaveButtonState()`** inserted by dabbe55 into existing mutators (mutations to `nodes`, `members`, `loads`, `supports`) — possible that calling this function from inside a `prompt()` continuation breaks something

## Files to inspect first

- `ui/truss2d/script.js` — find the Add Load click handler (per todo, around lines 136-148; line numbers may have drifted)
- `ui/truss2d/script.js` — find `#inputScale` listener wiring and `draw()` dependency on scale
- `ui/truss2d/index.html` — confirm `#inputScale` element + handlers wired
- Commit dabbe55 — review what `updateSaveButtonState()` does and where it's called from
- Commit history of `addLoad` / `scale` / `inputScale` for any partial fixes since 2026-04-18

## Evidence

- timestamp: 2026-05-15 (static analysis, current HEAD 2afd769)
  source: ui/truss2d/script.js lines 150-162 (Add Load click handler)
  finding: |
    Click handler for `mode === 'load'` looks correct:
      const n = findNodeAt(px, py);
      if (n) {
        const dir = prompt('Direction (x or y):', 'y');
        if (!dir) return;
        const mag = parseFloat(prompt('Magnitude in N (negative = down/left):', '-10000'));
        if (!isNaN(mag)) { saveHistory(); loads.push({...}); }
      }
    The `prompt()` is gated on `findNodeAt` returning a truthy node. If the
    click misses (>10 world-units from any node), the whole block is
    silently skipped. No code path inside this block can throw silently —
    and the entire click handler is wrapped in try/catch (lines 115/201)
    with showError() AND rethrow, so any genuine runtime exception WOULD
    surface in the red error banner.

- timestamp: 2026-05-15 (static analysis)
  source: ui/truss2d/script.js line 256-258 (findNodeAt)
  finding: |
    findNodeAt uses `Math.hypot(n.x - x, n.y - y) < 10` in *world* coordinates.
    After commit 317e69c (zoom/pan) was introduced, the view transform
    (view.scale, view.tx, view.ty) means that at zoom levels other than 1.0
    the 10-unit world hit-radius translates to a different screen-pixel
    radius. Zoomed OUT (scale < 1.0), the effective on-screen hit radius
    SHRINKS — a click that visually overlaps the node can miss in world space.
    This is the most plausible explanation for "click does nothing" given
    that the original report was 4 months AFTER zoom/pan landed.

- timestamp: 2026-05-15 (static analysis)
  source: ui/truss2d/script.js line 727-734, ui/truss2d/index.html line 97-99
  finding: |
    `#inputScale` is a plain `<input type="number">` with no disabled/
    readonly attributes. The 'input' event listener is wired:
      document.getElementById('inputScale').addEventListener('input', function () {
        try { draw(); } catch (err) { showError(...); throw err; }
      });
    No JS code anywhere sets inputScale.disabled (only btnSave is ever
    disabled via updateSaveButtonState). No CSS pointer-events:none on
    #inputScale. The results-panel sits BELOW .workspace in the DOM with
    `border-top: 2px solid` — it cannot overlay the sidebar where
    #inputScale lives.

- timestamp: 2026-05-15 (static analysis)
  source: ui/truss2d/script.js line 355-372 (draw)
  finding: |
    draw() is wrapped in try/catch + showError + rethrow. If draw() were
    throwing on every inputScale 'input' event, the error banner would
    appear instantly. Original 2026-04-18 report says no error banner —
    which means either (a) the banner machinery wasn't yet in place
    (cc99c20 + cf the try/catch wraps landed SAME day, possibly AFTER the
    report) OR (b) the symptom never involved an exception.
    Verified: cc99c20 ("add error banner") and 2f82b0a ("wrap 6 entry
    points in try/catch") both landed 2026-04-18. The regression was
    captured 2026-04-18. Sequencing unclear without exact timestamps —
    so the report may pre-date the banner machinery.

- timestamp: 2026-05-15 (static analysis)
  source: ui/truss2d/script.js line 738-741 (updateSaveButtonState)
  finding: |
    updateSaveButtonState() only does: `btn.disabled = nodes.length === 0`.
    It is called AFTER all mode handlers in the click block (line 199),
    AFTER any prompt() has returned. It cannot interfere with prompt()
    being invoked. Hypothesis (c) from the original todo (subtle interaction
    with updateSaveButtonState) is structurally implausible.

## Current Focus

**hypothesis:** Both regressions are likely PHANTOM bugs against current HEAD (2afd769):
- Regression 1 (Add Load silent fail) — most likely a UX miss: user clicked
  outside the 10-world-unit hit radius, possibly aggravated by zoom level.
  The 260418-vxi try/catch + error banner machinery added the same day as the
  report would have surfaced any genuine exception. The current code path is
  clean and self-consistent.
- Regression 2 (Scale input stuck) — no mechanism in current code can disable
  or block this input. CSS has no overlay/pointer-events trap. JS never
  touches `inputScale.disabled`. The listener is straightforward `draw()` in
  try/catch.

**test:** Per orchestrator instruction, fresh browser repro is MANDATORY before
any code change. I cannot perform browser interaction from this agent. The
user must open `https://catrins-imac.tail568b7e.ts.net/ui/truss2d/index.html`
and follow both repro recipes against current main (HEAD 2afd769).

**expecting:** Both regressions will NO-REPRO. If they do reproduce, the open-
banner state at the moment of the failure (or absence of it) will instantly
narrow the diagnosis.

**next_action:** Hand back to user for UAT. Do NOT modify ui/truss2d/script.js
or ui/truss2d/index.html — static analysis found no causative code defect.

## Resolution

**root_cause:** UNDETERMINED via static analysis alone. Best evidence-based
hypothesis: both 2026-04-18 reports were transient/environmental
(stale-cached script, off-target click, browser quirk) rather than genuine
code defects. The current code paths for both Add Load and the Scale input
are clean, defensive (try/catch + error banner), and structurally correct.

If a real defect exists, it is NOT visible in static review and will require
a live repro with browser dev-tools open (console + Network tab + element
inspector on #inputScale) to confirm.

**fix:** NOT APPLIED — no code change made. Awaiting fresh repro from user
before any modification per orchestrator instruction. If user reproduces
either symptom, the next investigation cycle should capture:
1. Console output at the moment of failure (any uncaught errors? any
   `showError` red banner content?)
2. Current view zoom level (`window.view` in DevTools console) when Add
   Load misses — to verify hit-radius vs view.scale theory.
3. DOM inspection of `#inputScale` when "stuck" — is `disabled=true`?
   `readonly`? Is anything overlaying it? Does focus reach the input
   (click → `document.activeElement`)?
4. Whether the entire `<aside class="panel">` is non-interactive or only
   the scale input.

## Out of scope

- solver_core, api_server, tests — pure UI regression
- frame2d — different file, different bugs
- ui/truss2d/style.css — purely visual, unrelated to event-handler bugs

## Constraints

- No solver/api/test changes
- Preserve recent 260515-vhr-01 work in `ui/truss2d/script.js` (don't rewind setMode)
- Mirror the testing-hygiene from STATE.md decisions (no DOF zeroing relied on — but this is UI, not solver, so likely n/a)

## Resume signal

When session manager hands back: pause for user UAT in browser (Tailscale URL) before committing any fix.
