---
phase: 260504-ene
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/script.js
  - .planning/debug/frame2d-load-then-add-support.md
  - .planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md
  - .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md
  - CLAUDE.md
autonomous: false
requirements:
  - QUICK-260504-ene
must_haves:
  truths:
    - "Entering any support mode (fixed/pinned/rollerX/rollerY/spring) auto-ticks chkSupports so a previously-invisible support becomes visible immediately"
    - "Entering any load mode (loadX/loadY/loadMoment/udl) auto-ticks chkLoads so a previously-invisible load becomes visible immediately"
    - "draw() runs after the checkbox state changes so the canvas refreshes without requiring a second user action"
    - "The misdiagnosed long-running 'freeze after load' debug session is closed with the actual root cause documented"
    - "The UI conventions section of CLAUDE.md records the auto-enable behaviour as a project rule"
  artifacts:
    - path: "ui/frame2d/script.js"
      provides: "setMode() that auto-enables matching visibility checkbox + redraws"
      contains: "chkSupports"
    - path: ".planning/debug/frame2d-load-then-add-support.md"
      provides: "Closed debug session with status: resolved + Resolution section"
      contains: "status: resolved"
    - path: ".planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md"
      provides: "Moved todo with resolution note"
      contains: "Resolution"
    - path: "CLAUDE.md"
      provides: "UI conventions note about mode-entry auto-enabling visibility layer"
      contains: "auto-enables"
  key_links:
    - from: "setMode(m) in ui/frame2d/script.js"
      to: "document.getElementById('chkSupports') / chkLoads"
      via: ".checked = true assignment + draw() call"
      pattern: "chkSupports.*checked = true"
---

<objective>
Auto-enable the matching visibility checkbox (chkSupports / chkLoads) when the user enters a support or load mode in the frame2d UI, and call draw() so any previously-added but invisible glyphs render immediately.

Purpose: Closes the misdiagnosed "frame2D UI freezes after load" bug. Today's confirmed root cause was that supports/loads were correctly added to the data arrays but never rendered, because the visibility checkboxes were unchecked at click time. The fix removes the foot-gun by binding mode-entry to the matching visibility layer.

Output:
- Source fix in ui/frame2d/script.js setMode() (~6 lines).
- Debug session marked resolved with actual root cause documented.
- Todo moved from pending/ to done/ with resolution note.
- CLAUDE.md UI conventions section updated.
- Follow-up todo flagged for the same anti-pattern in ui/truss2d/script.js (out of scope here).
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@ui/frame2d/script.js
@ui/frame2d/index.html
@.planning/debug/frame2d-load-then-add-support.md
@.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md

<interfaces>
<!-- Key code shapes already in the codebase. Use these directly — no exploration needed. -->

Current setMode() in ui/frame2d/script.js (lines 108-115):
```js
function setMode(m) {
  mode = m;
  currentMemberStart = null;
  document.querySelectorAll('.tool-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('modeLabel').textContent = MODE_LABELS[m] || m;
}
```

Mode strings used by the support/load buttons (from index.html data-mode attributes + setMode callsites in script.js):
- Support modes: 'fixed', 'pinned', 'rollerX', 'rollerY', 'spring'
- Load modes:    'loadX', 'loadY', 'loadMoment', 'udl'

Visibility checkbox elements (index.html lines 142-147 — both default `checked`):
```html
<input type="checkbox" id="chkSupports" checked>
<input type="checkbox" id="chkLoads" checked>
```

Gating in draw() (script.js lines 729, 740-741):
```js
if (document.getElementById('chkLoads').checked) drawUDLs();
...
if (document.getElementById('chkSupports').checked) drawSupports();
if (document.getElementById('chkLoads').checked) drawNodeLoads();
```

draw() is the global redraw function — safe to call from setMode().
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-enable matching visibility checkbox in setMode()</name>
  <files>ui/frame2d/script.js</files>
  <action>
Modify the existing `setMode(m)` function in `ui/frame2d/script.js` (currently lines 108-115). Add two `Set`-based mode groups and, after the existing body, set the matching visibility checkbox to `true` and call `draw()` so previously-added invisible glyphs appear immediately.

Replace the function body with:

```js
const SUPPORT_MODES = new Set(['fixed', 'pinned', 'rollerX', 'rollerY', 'spring']);
const LOAD_MODES    = new Set(['loadX', 'loadY', 'loadMoment', 'udl']);

function setMode(m) {
  mode = m;
  currentMemberStart = null;
  document.querySelectorAll('.tool-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('modeLabel').textContent = MODE_LABELS[m] || m;

  // Auto-enable the matching visibility layer so clicks always produce
  // visible feedback. Without this, supports/loads added with chkSupports/
  // chkLoads unchecked land in the data array but render nothing —
  // the symptom that caused the long-running misdiagnosed "freeze after
  // load" debug session (.planning/debug/frame2d-load-then-add-support.md).
  if (SUPPORT_MODES.has(m)) {
    document.getElementById('chkSupports').checked = true;
  } else if (LOAD_MODES.has(m)) {
    document.getElementById('chkLoads').checked = true;
  }
  draw();
}
```

Place the two `const` Set declarations immediately above `function setMode` (so they sit alongside `MODE_LABELS` at lines 96-106). Keep `MODE_LABELS` unchanged.

Notes / things NOT to change:
- Do NOT touch `drawSupports()` or `drawNodeLoads()` — the gating logic in `draw()` stays.
- Do NOT modify the canvas click handler (lines 117-310).
- Do NOT touch the Load JSON handler (lines 1729-1839) — earlier diagnosis suspected it; today's repro confirmed it is not the cause.
- Do NOT mirror this fix into `ui/truss2d/script.js` — it has the same anti-pattern but is out of scope; flag as a follow-up todo (Task 4).
- `draw()` is already wrapped in try/catch and is safe to call here. If `setMode` is called before the canvas / checkboxes exist (very early init), `getElementById` returns null and `.checked = true` would throw — verify by inspection that `setMode` callsites are all user-driven (button onclicks) which post-date DOM ready. (They are: every `setMode(...)` call originates from a `tool-btn[data-mode]` onclick attribute or from `resetAll()` which itself runs after DOMContentLoaded.)
  </action>
  <verify>
    <automated>node -e "const s = require('fs').readFileSync('ui/frame2d/script.js','utf8'); const ok = s.includes(\"SUPPORT_MODES = new Set(['fixed', 'pinned', 'rollerX', 'rollerY', 'spring'])\") && s.includes(\"LOAD_MODES    = new Set(['loadX', 'loadY', 'loadMoment', 'udl'])\") && s.includes(\"document.getElementById('chkSupports').checked = true\") && s.includes(\"document.getElementById('chkLoads').checked = true\") && /SUPPORT_MODES\.has\(m\)[\s\S]{0,200}draw\(\)/.test(s); if (!ok) { console.error('FAIL: setMode auto-enable wiring not found as specified'); process.exit(1); } console.log('PASS');"</automated>
  </verify>
  <done>
- setMode() in ui/frame2d/script.js contains both `SUPPORT_MODES` and `LOAD_MODES` Set definitions.
- Inside setMode(), branches set `chkSupports.checked = true` or `chkLoads.checked = true` based on the mode.
- `draw()` is called at the end of setMode().
- No other source files touched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Close debug session and move todo to done/</name>
  <files>.planning/debug/frame2d-load-then-add-support.md, .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md, .planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md</files>
  <action>
**Step 1 — Update debug session frontmatter and append a Resolution section.**

In `.planning/debug/frame2d-load-then-add-support.md`:

1. Change the frontmatter line `status: hypothesis-reached` to `status: resolved`.
2. Update `updated:` to `2026-05-04`.
3. Replace the existing `## Resolution` block (currently a code-block hypothesis at the end) with the following final Resolution section. Append it at the very end of the file (the existing "Constraints For This Session" section should remain — it documents how that session was scoped). Use this exact content:

```
## Resolution (2026-05-04)

**Actual root cause:** chkSupports / chkLoads visibility checkboxes were unchecked at click time. Support and load click handlers correctly mutated `supports` / `nodeLoads` arrays and called `draw()`, but `drawSupports()` and `drawNodeLoads()` are gated on the checkbox state (script.js lines 740-741), so no glyph was drawn. The UI was never frozen — clicks were registering and state was changing, but rendering was suppressed by user-controlled visibility flags.

**How confirmed:** User reproduced with Chrome DevTools Console open on 2026-05-04. After clicking in support mode, `supports.length` had incremented and `supports[supports.length-1]` showed the new entry, but the canvas showed nothing. `document.getElementById('chkSupports').checked` was `false`. Ticking it manually and re-running `draw()` made the support appear.

**Why all eight 2026-05-03 candidates (A-F) were wrong:** None of them — `isPanning` stuck true, browser dialog suppression, panel pointer-event blocking, `_springActiveNodeId` orphaning, draw() exceptions, file-picker side effects — were operative. The diagnose-only session over-fitted to the "freeze + Reset All does not recover" framing in the original todo. The actual symptom was "click does nothing visible" plus the user assuming Reset All didn't help because the post-Reset-All state also rendered nothing visible (Reset All clears the data arrays correctly, but the user had no glyph to see disappear). The Load JSON path is innocent.

**Fix applied:** `ui/frame2d/script.js` setMode() now auto-enables the matching visibility checkbox (chkSupports for support modes, chkLoads for load modes) and calls draw() so previously-added invisible glyphs become visible immediately. See quick task 260504-ene.

**Lesson for future debug sessions:** When the hypothesis "UI is frozen" is supplied by a non-developer reporter, validate the freeze itself before mining the state-management surface. "Click does nothing visible" can mean the click was processed and the visual layer is suppressed, not that the JS event loop is stuck. A quick Console probe of the data array before assuming a JS hang would have shortcut this.

**Sibling status:** ui/truss2d/script.js has the same anti-pattern (mode entry does not enable matching visibility layer). Tracked as a follow-up todo by quick task 260504-ene; not fixed in this session.

files_changed: ui/frame2d/script.js (setMode), CLAUDE.md (UI conventions note), this file (status + Resolution), .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md (moved + resolution note).
```

Leave the rest of the file (Symptoms, Reporter's Initial Hypotheses, Current Focus, Evidence, Eliminated Hypotheses, Root Cause Report, Proposed minimal fix, Open questions, Constraints) unchanged — they form the historical investigation record.

**Step 2 — Move the pending todo to done/ with a resolution preface.**

1. Create the directory `.planning/todos/done/` if it does not already exist (`mkdir -p`).
2. Read the existing `.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md`.
3. Write a new file at `.planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` whose content is:
   - A new **top-of-file** resolution block (before the original frontmatter) with this content:

```
> **RESOLVED 2026-05-04** (quick task 260504-ene)
>
> Actual root cause: chkSupports / chkLoads visibility checkboxes unchecked at click time. Supports/loads were correctly being added to the data arrays but `drawSupports()` / `drawNodeLoads()` were skipped because of the visibility gate in `draw()` (ui/frame2d/script.js:740-741). The UI was never frozen — rendering was suppressed.
>
> Fix: setMode() in ui/frame2d/script.js now auto-enables the matching visibility checkbox and calls draw(). Sibling truss2d UI has the same anti-pattern; tracked as a follow-up todo.
>
> Debug session: `.planning/debug/frame2d-load-then-add-support.md` (status: resolved).

```
   - Followed by the original file content **unchanged** (preserve the original frontmatter and body — they are the historical record).
4. Delete `.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` using the Bash `rm` command (only after the done/ copy has been written).
  </action>
  <verify>
    <automated>test -f .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md && ! test -f .planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md && grep -q "RESOLVED 2026-05-04" .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md && grep -q "^status: resolved" .planning/debug/frame2d-load-then-add-support.md && grep -q "## Resolution (2026-05-04)" .planning/debug/frame2d-load-then-add-support.md && echo PASS</automated>
  </verify>
  <done>
- `.planning/debug/frame2d-load-then-add-support.md` frontmatter has `status: resolved` and `updated: 2026-05-04`.
- A `## Resolution (2026-05-04)` section is appended to that file documenting the real root cause.
- `.planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` exists with the resolution block preceding the original content.
- `.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md` no longer exists.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add UI conventions note to CLAUDE.md and create truss2d follow-up todo</name>
  <files>CLAUDE.md, .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md</files>
  <action>
**Step 1 — Append to the "UI conventions" section in CLAUDE.md.**

In `/Users/catrinevans/Documents/pda_project/CLAUDE.md`, find the section beginning `## UI conventions (both truss2d and frame2d)`. Add a new bullet at the end of the existing bullet list (before the next `##` heading):

```
- Mode entry auto-enables the matching visibility layer: support modes (fixed/pinned/rollerX/rollerY/spring) tick `chkSupports`, load modes (loadX/loadY/loadMoment/udl) tick `chkLoads`, and `draw()` is called so previously-added invisible glyphs become visible immediately. Implemented in `setMode()`. Closes the long-standing "click does nothing visible" foot-gun (debug session `.planning/debug/frame2d-load-then-add-support.md`). frame2d done 2026-05-04 (quick 260504-ene); truss2d follow-up pending.
```

Do NOT touch any other section of CLAUDE.md.

**Step 2 — Create a follow-up todo for the truss2d sibling.**

Create `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` with this content:

```
---
created: 2026-05-04
priority: P3
source: quick-260504-ene
files_likely_affected:
  - ui/truss2d/script.js
---

# Mirror mode-entry-auto-enables-visibility fix to truss2d

Quick task 260504-ene fixed the frame2d UI's silent-feedback bug: clicks in support / load modes did nothing visible because the matching visibility checkbox (`chkSupports` / `chkLoads`) was unchecked. The fix lives in `ui/frame2d/script.js` `setMode()`.

`ui/truss2d/script.js` has the same anti-pattern. It was deliberately scoped out of 260504-ene because the user wanted a single small edit landed first. Repro path is the same shape: with `chkSupports` unchecked, click "Pin" / "Roller" → support is added to `supports[]` but no glyph appears.

## Fix shape (mirror of 260504-ene)

In `ui/truss2d/script.js`, locate `setMode(m)`. After the existing body, add:

```js
const SUPPORT_MODES = new Set([...truss2d support mode strings...]);
const LOAD_MODES    = new Set([...truss2d load mode strings...]);
if (SUPPORT_MODES.has(m)) {
  document.getElementById('chkSupports').checked = true;
} else if (LOAD_MODES.has(m)) {
  document.getElementById('chkLoads').checked = true;
}
draw();
```

The exact mode-string membership for truss2d differs (no spring, no UDL, no moment). Read the truss2d `MODE_LABELS` table and `data-mode` attributes in `ui/truss2d/index.html` first to enumerate them.

## Verification (manual UAT)

- Uncheck `chkSupports`, click a support button → checkbox auto-ticks; previously-added supports appear.
- Uncheck `chkLoads`, click a load button → checkbox auto-ticks; previously-added loads appear.

## Why P3

The frame2d fix is the primary user-facing remedy. truss2d has the same latent bug but the user is currently working in frame2d; convergence between the two UIs should happen on the next truss2d touch.
```
  </action>
  <verify>
    <automated>grep -q "Mode entry auto-enables the matching visibility layer" CLAUDE.md && test -f .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md && grep -q "Mirror mode-entry-auto-enables-visibility fix to truss2d" .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md && echo PASS</automated>
  </verify>
  <done>
- CLAUDE.md "UI conventions" section has a new bullet documenting the mode-entry auto-enable behaviour.
- A new pending todo exists at `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` describing the truss2d follow-up.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Manual UAT in browser</name>
  <what-built>
- `setMode()` in `ui/frame2d/script.js` now auto-enables `chkSupports` (for fixed/pinned/rollerX/rollerY/spring modes) or `chkLoads` (for loadX/loadY/loadMoment/udl modes) and calls `draw()`.
- Debug session `.planning/debug/frame2d-load-then-add-support.md` marked resolved with the real root cause documented.
- Todo moved to `.planning/todos/done/`.
- CLAUDE.md UI conventions section updated.
- truss2d follow-up todo created in `.planning/todos/pending/`.
  </what-built>
  <how-to-verify>
1. **Start the API server (if not already running):** `uvicorn api_server.app:app --reload` from `pda_project/`.
2. **Open the frame2d UI:** browse to `http://127.0.0.1:8000/ui/frame2d/index.html` (or via the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`).
3. **Place two nodes** by clicking twice in Add Node mode.
4. **Untick the "Show supports" checkbox** in the Display panel on the left.
5. **Click the "Fixed" support button.** Expected:
   - The "Show supports" checkbox immediately re-ticks itself.
   - The mode label at the top of the canvas shows "Fixed Support".
6. **Click one of the placed nodes.** Expected: the fixed-support glyph appears at that node immediately. (Pre-fix: glyph would not appear because chkSupports was unchecked; user would have to manually re-tick it.)
7. **Untick "Show loads".** Click "Force Y", then click a node, enter a value in the prompt. Expected: chkLoads auto-ticks; arrow glyph appears. Repeat for "→ Force X" and "↺ Moment" — chkLoads stays ticked.
8. **Click "▤ UDL" (member loads section).** Expected: chkLoads is set to true (already was, from step 7) — verify it does not get unticked.
9. **Repeat with the previously-invisible-glyph case** — the bug-trigger that motivated this fix:
   - Untick "Show supports".
   - Click on a node in Fixed mode (clicking the button should auto-tick "Show supports", but to test the originally-reported sequence: tick it back off, click the node — pre-fix, the glyph would not appear; post-fix, you should never reach that state because clicking Fixed re-ticks the checkbox before the click handler runs).
10. **Negative check:** click "➕ Add Node" (a non-support, non-load mode). Expected: chkSupports / chkLoads are NOT modified by this mode entry.

If any of the above behaviours diverge, describe what diverged. Otherwise type "approved".
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Task 1 automated grep proves the source change landed with the right wiring.
- Task 2 automated check proves the debug session is marked resolved and the todo moved.
- Task 3 automated check proves the CLAUDE.md note and follow-up todo exist.
- Task 4 manual UAT confirms the fix delivers the user-visible behaviour change in the browser.
- No automated browser tests exist for this codebase by design (vanilla JS, no build step) — Task 4 is the load-bearing verification step.
</verification>

<success_criteria>
- Clicking any support button in frame2d auto-ticks chkSupports and triggers a redraw.
- Clicking any load button in frame2d auto-ticks chkLoads and triggers a redraw.
- Previously-added supports / loads that were invisible (because the user had unticked the visibility checkbox before adding them) become visible the moment the user enters a matching mode again.
- The misdiagnosed debug session is closed with the actual root cause on record so the same wrong-diagnosis chain is not repeated.
- The truss2d sibling fix is captured as a separate pending todo for the next time truss2d is touched.
- CLAUDE.md UI conventions section codifies the auto-enable behaviour as a project rule.
- No changes to: drawSupports(), drawNodeLoads(), the Load JSON handler, ui/truss2d/script.js, or any solver_core / api_server / tests code.
</success_criteria>

<output>
After completion, create `.planning/quick/260504-ene-auto-enable-chksupports-chkloads-when-en/260504-ene-SUMMARY.md` per the standard template.
</output>
