---
phase: 260515-vhr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/truss2d/script.js
  - CLAUDE.md
  - .planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md
  - .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md
autonomous: false
requirements:
  - QUICK-260515-vhr
must_haves:
  truths:
    - "Entering any truss2d support mode (pinned/rollerX/rollerY) auto-ticks chkSupports so a previously-invisible support becomes visible immediately"
    - "Entering the truss2d load mode (load) auto-ticks chkLoads so a previously-invisible load becomes visible immediately"
    - "draw() runs at the end of setMode() so the canvas refreshes without requiring a second user action"
    - "Entering a non-support, non-load mode (node, member, editNode, delete) does not modify chkSupports or chkLoads"
    - "CLAUDE.md UI conventions bullet reflects that truss2d now implements the same auto-enable pattern (no longer 'pending')"
    - "Follow-up todo `2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` is moved from pending/ to done/ with a resolution preface"
  artifacts:
    - path: "ui/truss2d/script.js"
      provides: "setMode() that auto-enables matching visibility checkbox + redraws"
      contains: "chkSupports"
    - path: "CLAUDE.md"
      provides: "UI conventions note updated to reflect truss2d completion"
      contains: "truss2d done 2026-05-15"
    - path: ".planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md"
      provides: "Moved todo with RESOLVED preface"
      contains: "RESOLVED 2026-05-15"
  key_links:
    - from: "setMode(m) in ui/truss2d/script.js"
      to: "document.getElementById('chkSupports') / chkLoads"
      via: ".checked = true assignment + draw() call"
      pattern: "chkSupports.*checked = true"
---

<objective>
Mirror the frame2d setMode visibility-auto-enable pattern (quick task 260504-ene, commit 3797fe2) into `ui/truss2d/script.js`. Closes the same latent silent-feedback foot-gun where clicking a support or load button with `chkSupports`/`chkLoads` unticked correctly mutates the state arrays but renders nothing.

Purpose: Converge truss2d's setMode behaviour with frame2d's so the two UIs share the same UX contract documented in CLAUDE.md. Closes the P3 follow-up todo planted alongside 260504-ene.

Output:
- Source fix in `ui/truss2d/script.js` setMode() (~10 lines including comment).
- CLAUDE.md UI conventions bullet updated — replaces "truss2d follow-up pending" with "truss2d done 2026-05-15".
- Pending follow-up todo moved to done/ with resolution preface; original body preserved.
- Manual UAT checkpoint (browser verification deferred to user).

Scope (constraints):
- `ui/truss2d/script.js` ONLY for source changes — NO solver_core, NO api_server, NO tests, NO frame2d touches.
- NO ui/truss2d/index.html changes (chkSupports/chkLoads already exist with correct IDs).
- Mirror exactly: same Set pattern, same `chkSupports`/`chkLoads` IDs, same `draw()` call at end.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@ui/truss2d/script.js
@ui/truss2d/index.html
@.planning/quick/260504-ene-auto-enable-chksupports-chkloads-when-en/260504-ene-PLAN.md
@.planning/quick/260504-ene-auto-enable-chksupports-chkloads-when-en/260504-ene-SUMMARY.md
@.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md

<interfaces>
<!-- Key code shapes already in the codebase. Use these directly — no exploration needed. -->

**Current setMode() in `ui/truss2d/script.js` (lines 90-97):**
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

Note: current setMode does NOT call draw() at end (distinct from frame2d's current state). The fix adds that draw() call as part of the mirror.

**Truss2d MODE_LABELS (script.js lines 84-88):**
```js
const MODE_LABELS = {
  node: 'Add Node', member: 'Add Member',
  pinned: 'Pinned Support', rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  load: 'Add Load', editNode: 'Edit Node', delete: 'Delete',
};
```

**Truss2d mode-string membership (confirmed from MODE_LABELS + index.html data-mode attributes):**
- Support modes (3): `'pinned'`, `'rollerX'`, `'rollerY'`
  - NO `'fixed'` (truss2d is 2 DOF/node — no rotational restraint, no fixed end)
  - NO `'spring'` (frame-only feature)
- Load mode (1): `'load'`
  - SINGULAR — truss2d has one combined "Add Load" button whose handler `prompt()`s for direction x/y inline (script.js lines 136-148)
  - NO `'loadX'`/`'loadY'`/`'loadMoment'`/`'udl'` (frame-only mode strings)

**Truss2d index.html visibility checkboxes (lines 89, 92 — both default `checked` with `onchange="draw()"`):**
```html
<input type="checkbox" id="chkSupports" checked onchange="draw()"> Show supports
<input type="checkbox" id="chkLoads" checked onchange="draw()"> Show loads
```

Same IDs as frame2d — no DOM rename needed.

**Gating in truss2d draw() (script.js lines 350-351):**
```js
if (document.getElementById('chkSupports')?.checked) drawSupports();
if (document.getElementById('chkLoads')?.checked) drawLoads();
```

draw() is the global redraw function — safe to call from setMode(). Already wrapped in try/catch (lines 342, 354-357).

**Current CLAUDE.md UI conventions bullet (line 135):**
```
- Mode entry auto-enables the matching visibility layer: support modes (fixed/pinned/rollerX/rollerY/spring) tick `chkSupports`, load modes (loadX/loadY/loadMoment/udl) tick `chkLoads`, and `draw()` is called so previously-added invisible glyphs become visible immediately. Implemented in `setMode()`. Closes the long-standing "click does nothing visible" foot-gun (debug session `.planning/debug/frame2d-load-then-add-support.md`). frame2d done 2026-05-04 (quick 260504-ene); truss2d follow-up pending.
```

The bullet already documents BOTH UIs' mode strings in the parenthetical but ends with "truss2d follow-up pending". Update needed: change closing phrase to reflect truss2d completion.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-enable matching visibility checkbox in truss2d setMode()</name>
  <files>ui/truss2d/script.js</files>
  <action>
Modify `setMode(m)` in `ui/truss2d/script.js` (currently lines 90-97) to mirror the frame2d 260504-ene fix. Add two `Set`-based mode groups immediately above the function (alongside `MODE_LABELS`), and at the end of the function body set the matching visibility checkbox to `true` and call `draw()`.

**Replace lines 84-97** (the `MODE_LABELS` const + `setMode` function) with:

```js
const MODE_LABELS = {
  node: 'Add Node', member: 'Add Member',
  pinned: 'Pinned Support', rollerX: 'Roller (X fixed)', rollerY: 'Roller (Y fixed)',
  load: 'Add Load', editNode: 'Edit Node', delete: 'Delete',
};

const SUPPORT_MODES = new Set(['pinned', 'rollerX', 'rollerY']);
const LOAD_MODES    = new Set(['load']);

function setMode(m) {
  mode = m;
  currentMemberStart = null;
  document.querySelectorAll('.tool-btn[data-mode]').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === m)
  );
  document.getElementById('modeLabel').textContent = MODE_LABELS[m] || m;

  // Auto-enable the matching visibility layer so clicks always produce
  // visible feedback. Without this, supports/loads added with chkSupports/
  // chkLoads unchecked land in the data array but render nothing.
  // Mirrors the frame2d fix from quick task 260504-ene (commit 3797fe2).
  if (SUPPORT_MODES.has(m)) {
    document.getElementById('chkSupports').checked = true;
  } else if (LOAD_MODES.has(m)) {
    document.getElementById('chkLoads').checked = true;
  }
  draw();
}
```

**Truss2d mode-string membership rationale (verified against `ui/truss2d/script.js` lines 84-88 + `ui/truss2d/index.html` data-mode attributes lines 31-50):**
- Support modes: `'pinned'`, `'rollerX'`, `'rollerY'` — these are the three support buttons in index.html. No `'fixed'` (truss 2 DOF/node has no rotational restraint) and no `'spring'` (frame-only feature).
- Load mode: `'load'` (singular) — truss2d has one combined "Add Load" button; the click handler at lines 136-148 prompts for direction (x or y) and magnitude inline. There is no separate `loadX`/`loadY`/`loadMoment`/`udl` (those are frame2d-only).

**Things NOT to change:**
- Do NOT touch `drawSupports()`, `drawLoads()`, or any other render path.
- Do NOT touch `drawGrid()` (line 360 has `ctx.strokeStyle = '#eee'` — a separate sq0-deferred concern, explicitly out of scope here).
- Do NOT modify the canvas click handler (lines 100-191) or the Load JSON handler (lines 808-875).
- Do NOT touch frame2d at all.
- Do NOT modify `ui/truss2d/index.html` — `chkSupports` and `chkLoads` already exist with correct IDs.

**Init-time safety:** `setMode('node')` is called at the end of script.js (line 974) which is after DOMContentLoaded order (script tag at index.html line 152, after the body). At that call time `chkSupports`/`chkLoads` exist and `node` is not in either Set, so the auto-enable branches are skipped and `draw()` runs. This mirrors the frame2d call ordering and is verified safe by inspection.
  </action>
  <verify>
    <automated>node -e "const s = require('fs').readFileSync('ui/truss2d/script.js','utf8'); const ok = s.includes(\"SUPPORT_MODES = new Set(['pinned', 'rollerX', 'rollerY'])\") && s.includes(\"LOAD_MODES    = new Set(['load'])\") && s.includes(\"document.getElementById('chkSupports').checked = true\") && s.includes(\"document.getElementById('chkLoads').checked = true\") && /SUPPORT_MODES\.has\(m\)[\s\S]{0,300}draw\(\)/.test(s) && !s.includes(\"'fixed'\") && !s.includes(\"'spring'\") && !s.includes(\"'loadX'\") && !s.includes(\"'loadMoment'\") && !s.includes(\"'udl'\"); if (!ok) { console.error('FAIL: truss2d setMode auto-enable wiring not found as specified, or frame2d-only mode strings leaked in'); process.exit(1); } console.log('PASS');"</automated>
  </verify>
  <done>
- `ui/truss2d/script.js` contains `SUPPORT_MODES = new Set(['pinned', 'rollerX', 'rollerY'])` and `LOAD_MODES = new Set(['load'])` immediately above `setMode`.
- Inside `setMode()`, branches set `chkSupports.checked = true` or `chkLoads.checked = true` based on the mode.
- `draw()` is called at the end of `setMode()`.
- No frame2d mode strings (`'fixed'`, `'spring'`, `'loadX'`, `'loadY'`, `'loadMoment'`, `'udl'`) leak into truss2d.
- No other source files touched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update CLAUDE.md and close the follow-up todo</name>
  <files>CLAUDE.md, .planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md, .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md</files>
  <action>
**Step 1 — Update the CLAUDE.md "UI conventions" bullet.**

In `/Users/catrinevans/Documents/pda_project/CLAUDE.md`, find line 135 (the bullet beginning with `- Mode entry auto-enables the matching visibility layer`). Replace ONLY the trailing phrase:

Current ending:
```
... frame2d done 2026-05-04 (quick 260504-ene); truss2d follow-up pending.
```

New ending:
```
... frame2d done 2026-05-04 (quick 260504-ene); truss2d done 2026-05-15 (quick 260515-vhr).
```

The rest of the bullet (mode-string parenthetical, behaviour description, debug-session reference) stays unchanged. Do NOT touch any other CLAUDE.md content.

**Step 2 — Move the pending todo to done/ with a resolution preface.**

1. Ensure `.planning/todos/done/` exists (`mkdir -p` if needed).
2. Read `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md`.
3. Write `.planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` with the following content — a new top-of-file RESOLVED block, then the original file content unchanged below:

```
> **RESOLVED 2026-05-15** (quick task 260515-vhr)
>
> Mirror of the frame2d setMode visibility-auto-enable pattern landed in `ui/truss2d/script.js`. Truss2d-specific mode-string sets:
> - `SUPPORT_MODES = new Set(['pinned', 'rollerX', 'rollerY'])` (no 'fixed', no 'spring' — truss has 2 DOF/node)
> - `LOAD_MODES = new Set(['load'])` (singular — truss2d uses one combined "Add Load" button that prompts inline for direction)
>
> Both UIs now share the same UX contract: clicking a support or load button auto-ticks the matching visibility checkbox and triggers a redraw so previously-invisible glyphs render immediately.
>
> Precedent: `.planning/quick/260504-ene-auto-enable-chksupports-chkloads-when-en/` (frame2d, commit 3797fe2).

---

```

Then append the **unchanged original content** of `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` after the `---` separator.

4. Delete `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` using `rm` (only after the done/ copy is written and verified).
  </action>
  <verify>
    <automated>grep -q "truss2d done 2026-05-15 (quick 260515-vhr)" CLAUDE.md && ! grep -q "truss2d follow-up pending" CLAUDE.md && test -f .planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md && ! test -f .planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md && grep -q "RESOLVED 2026-05-15" .planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md && grep -q "Mirror mode-entry-auto-enables-visibility fix to truss2d" .planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md && echo PASS</automated>
  </verify>
  <done>
- CLAUDE.md UI conventions bullet ends with "truss2d done 2026-05-15 (quick 260515-vhr)." (no "pending" phrase remaining).
- `.planning/todos/done/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` exists with RESOLVED preface + original body.
- `.planning/todos/pending/2026-05-04-truss2d-mirror-mode-entry-auto-enables-visibility.md` no longer exists.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual UAT in browser (truss2d)</name>
  <what-built>
- `setMode()` in `ui/truss2d/script.js` now auto-enables `chkSupports` (for pinned/rollerX/rollerY modes) or `chkLoads` (for the singular `load` mode) and calls `draw()`.
- CLAUDE.md UI conventions bullet updated — replaces "truss2d follow-up pending" with "truss2d done 2026-05-15 (quick 260515-vhr)".
- Follow-up todo moved to `.planning/todos/done/` with RESOLVED preface.
  </what-built>
  <how-to-verify>
1. **Start the API server (if not already running):** `uvicorn api_server.app:app --reload` from `pda_project/`.
2. **Open the truss2d UI:** browse to `http://127.0.0.1:8000/ui/truss2d/index.html` (or via the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/truss2d/index.html`).
3. **Place two nodes** by clicking twice in Add Node mode.
4. **Untick the "Show supports" checkbox** in the Display panel on the left.
5. **Click the "📌 Pin" support button.** Expected:
   - The "Show supports" checkbox immediately re-ticks itself.
   - The mode label shows "Pinned Support".
6. **Click one of the placed nodes.** Expected: the pin glyph appears immediately at that node. (Pre-fix: glyph would not appear; user would have to manually re-tick chkSupports.)
7. **Test the two roller modes:** untick "Show supports" again, click "🛞 Roller (↔ free | Y fixed)" — chkSupports auto-ticks. Repeat with "🛞 Roller (↕ free | X fixed)".
8. **Untick "Show loads".** Click "📥 Add Load", then click a node. The prompt asks for direction (x or y) and magnitude. Enter values. Expected: chkLoads auto-ticks when the Add Load button is pressed (BEFORE the node click + prompt); the load arrow glyph appears after the prompt completes.
9. **Negative check 1 — Add Node:** click "➕ Add Node" mode button. Expected: chkSupports / chkLoads are NOT modified by this mode entry (it is neither a support nor a load mode).
10. **Negative check 2 — Add Member, Edit Node, Delete:** click "🔗 Add Member", "✏️ Edit Node", and "🗑 Delete" in turn. For each, confirm chkSupports / chkLoads are NOT auto-ticked (they should retain whatever state the user last set them to).

If any of the above behaviours diverge from expectations, describe what diverged. Otherwise type "approved".
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Task 1 automated grep proves the truss2d source change landed with the right Sets and wiring, AND that no frame2d-only mode strings leaked in (negative-check via `! includes`).
- Task 2 automated check proves CLAUDE.md was updated (positive grep for new phrase, negative grep for old "pending" phrase) and the follow-up todo was correctly moved with the RESOLVED preface AND original content preserved.
- Task 3 manual UAT confirms the fix delivers the user-visible behaviour change in the browser — same verification shape as 260504-ene Task 4 but on the truss2d UI.
- No automated browser tests exist for this codebase by design (vanilla JS, no build step). Task 3 is the load-bearing UAT step.
- No solver_core, api_server, or test changes — pytest run not required, but suite remains green (61/61) as no Python touched.
</verification>

<success_criteria>
- Clicking any truss2d support button (pinned / rollerX / rollerY) auto-ticks chkSupports and triggers a redraw.
- Clicking truss2d's "Add Load" button auto-ticks chkLoads and triggers a redraw.
- Previously-added supports / loads that were invisible (because the user had unticked the visibility checkbox before adding them) become visible the moment the user enters a matching mode again.
- Non-support, non-load modes (node, member, editNode, delete) do NOT modify the visibility checkboxes.
- CLAUDE.md "UI conventions" section reflects truss2d's completion (no remaining "pending" phrase for this convergence).
- The P3 follow-up todo planted alongside 260504-ene is closed (moved to done/ with resolution preface).
- No changes to: drawSupports(), drawLoads(), drawGrid(), the Load JSON handler, ui/truss2d/index.html, ui/frame2d/* (frame2d UNTOUCHED), or any solver_core / api_server / tests code.
- Truss2d and frame2d now share the same setMode UX contract.
</success_criteria>

<output>
After completion, create `.planning/quick/260515-vhr-mirror-frame2d-setmode-visibility-auto-e/260515-vhr-SUMMARY.md` per the standard template.
</output>
