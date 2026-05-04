---
status: resolved
trigger: "Frame2D UI freezes when user adds supports after loading a JSON model. Load-JSON in isolation works; build-from-scratch + add-support works. Only the load-then-add-support sequence freezes — clicks stop registering, Reset All does NOT recover, user must hard-close browser tab and restart uvicorn to recover. P2 per todo (workaround: build models from scratch). Source-of-truth todo: .planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md."
mode: diagnose-only
goal: find_root_cause_only
created: 2026-05-03
updated: 2026-05-04
---

## Symptoms

**Repro sequence:**
1. Open `ui/frame2d/index.html` in browser (uvicorn dev server running)
2. Use Load JSON control to load an existing frame model
3. Switch to support mode and click a node to add a support

**Observed:**
- UI freezes — canvas clicks stop registering, no support glyph drawn
- Reset All button has no effect after the freeze
- Recovery requires: hard-close browser tab + restart uvicorn

**Confirmed working (control cases):**
- Load JSON in isolation: parses + renders model correctly
- Build from scratch (no Load JSON) → add support: works correctly (this is the existing UAT path, which is why bug went unnoticed)

**Not yet captured:**
- Browser DevTools Console output during freeze (no errors yet seen by user — they were not running with DevTools open)
- Network tab state during freeze (any stuck fetch/WebSocket?)

## Reporter's Initial Hypotheses (in priority order, from todo)

1. **Stale state from Load JSON path.** Load-JSON overwrites nodes/members/loads/supports but may not reset the mode state machine (mode flag, partial-click state, selectedNodeIndex). Click handler hits a code path expecting Reset-All-shape state, hits infinite loop or sync throw → UI freezes.

2. **Coordinate origin mismatch.** First node placed sets `origin`; Load JSON may set nodes[] without setting origin (or with stale origin). Support-add click-to-node hit-test (8px tolerance) computes coords that never match any node → click silently ignored → state mutation lands inconsistent.

3. **Reset All not clearing everything.** If Reset All doesn't reset whatever Load JSON sets, user is stuck. Audit: enumerate vars Reset All touches vs vars Load JSON touches; gaps are suspects.

4. **Shared root cause with truss2d.** Sibling todo `2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md` describes structurally similar post-Save/Load regressions. Frame2D was forked from truss2d patterns; both bugs may share a state-management anti-pattern.

## Current Focus

```
hypothesis: Load JSON path leaves origin=null when the saved file has data.canvas.origin=null (legitimate edge case for an empty-canvas-origin save), AND it never re-runs setMode/clears panels/clears blob URL — but the most concrete defect is that Load JSON sets `nodes` from the saved JSON without re-establishing a coordinate `origin`. If origin is null, `syncPixelFromReal` is a no-op and `n.x/n.y` retain their values from the JSON. Hit-detection should still work. The likely freeze cause is a different gap: support-add reads `n.id` for `supports.filter(s => s.nodeId !== n.id)` and `supports.push({nodeId: n.id, ...})`. If id collisions exist between loaded supports[].nodeId and the loaded nodes[].id, behaviour is consistent. So far code reading does NOT reveal a definite freeze path. Need DevTools repro.
test: Read script.js fully (DONE). Build state-mutation matrix (DONE). Examine click-handler for support mode (DONE — looks safe, no obvious infinite loop). Look for sync exceptions in draw() chain (DONE — guarded by try/catch with showError).
expecting: A specific code path that turns into infinite loop or sync error after Load JSON. NOT FOUND from code reading alone.
next_action: User must reproduce with DevTools Console open and capture: (a) does Reset All confirm dialog appear? (b) any red errors during the support-click? (c) is `mode` actually set when user thinks they're in support mode?
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-03 — read full ui/frame2d/script.js (2078 lines), index.html, and ui/truss2d/script.js load handler for comparison.

- timestamp: 2026-05-03 — **State-mutation matrix built**.

  **Reset All sets/clears (lines 351-388):**
  - nodes, members, supports, nodeLoads → `[]`
  - origin, currentMemberStart, results → `null`
  - history → `[]`
  - `_udlActiveMemberIdx = null`
  - `_springActiveNodeId = null`
  - view → `{scale:1, tx:0, ty:0}`
  - **`isPanning = false`** + pan anchors (per the prior D-14 fix at 358-368)
  - `_lastBlobUrl` revoked + nulled
  - resultsPanel, udlPanel, springPanel → `display: none`
  - existing `.download-link` removed
  - `clearDiagramState()` called (BMD/SFD checkboxes off + disabled)
  - `setStatus('')`
  - `setMode('node')` — important: also clears `currentMemberStart` and updates active-button highlight
  - `updateSaveButtonState()`
  - `draw()`

  **Load JSON sets/clears (lines 1729-1839):**
  - origin → `data.canvas.origin || null`
  - nodes, members → restored from `data.canvas`
  - supports → rebuilt from object form
  - nodeLoads → `data.canvas.nodeLoads || []`
  - per-member: udl, udl_x, E_override, I_override, A_override (only if present in saved file)
  - `nodes.forEach(syncPixelFromReal)` — only effective if origin !== null
  - results → null
  - history → []
  - `_udlActiveMemberIdx = null`
  - currentMemberStart → null
  - resultsPanel → `display: none`
  - `clearDiagramState()` called
  - `updateSaveButtonState()`
  - `setStatus('', false)`
  - `draw()`

  **Variables Reset All clears that Load JSON does NOT clear:**
  1. **`_springActiveNodeId`** — left dangling
  2. **`view`** (zoom/pan) — persists from before load
  3. **`isPanning`, panStartX/Y/Tx/Ty** — NOT reset by Load JSON. If isPanning was stuck `true` before load, stays stuck after.
  4. **`_lastBlobUrl`** — not cleaned up
  5. **`udlPanel`, `springPanel`** display states — not hidden on load
  6. Existing `.download-link` element — not removed
  7. **`setMode('node')`** — NOT called. Mode persists from whatever the user was in before Load JSON. (This is actually fine — the user may legitimately want to load and then immediately add supports.)
  8. **`pureBarNodeIds`, `offendingNodes`, `offendingMembers`** (diagnostic overlays) — NOT cleared
  9. The error banner display state — not reset (errors from before load still visible)

- timestamp: 2026-05-03 — **Support-add click handler trace (lines 160-167)**.
  ```js
  } else if (['fixed', 'pinned', 'rollerX', 'rollerY'].includes(mode)) {
    const n = findNodeAt(px, py);
    if (n) {
      saveHistory();
      supports = supports.filter(s => s.nodeId !== n.id);
      supports.push({ nodeId: n.id, type: mode });
      results = null;
    }
  }
  ```
  **No infinite loop possible here.** If `findNodeAt` returns undefined (no node within 10px), nothing happens — click is silently ignored. If it finds a node, simple array filter+push, no recursion, no loop.

- timestamp: 2026-05-03 — **Click handler IS wrapped in try/catch (lines 119, 307-310)**:
  ```js
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
  ```
  Any sync exception in the click path will:
  - Display in the on-page error banner (id="errorBanner", #d32f2f red)
  - Be re-thrown so window.onerror also catches it
  - **The user would see a visible red error banner across the top of the page if this fires**

  Reporter notes "no console output yet" — but the on-page error banner is visible without DevTools. If user did not see a red banner during the freeze, then either no exception was thrown OR `showError` itself failed before paint.

- timestamp: 2026-05-03 — **`isPanning` stuck-true is a known/fixed cause class (D-14, lines 358-368)**. The prior fix added `isPanning = false` to `resetAll()` because middle-mouse pan releases outside canvas would leave `isPanning=true`, making every subsequent canvas click return early at line 120 (`if (isPanning) return;`). **Load JSON does NOT contain the equivalent reset.** If the user middle-clicks anywhere between landing on the page and clicking Load JSON, and the mouseup happens off-canvas, isPanning stays true through the load.

- timestamp: 2026-05-03 — **Reset All NOT recovering** is the key constraint. resetAll() is wired via `onclick="resetAll()"` in index.html. If clicking Reset All has zero effect, either:
  - (a) The JS event loop is stuck (infinite loop or pending sync work somewhere) — but the click handler only mutates simple arrays/numbers, no obvious source.
  - (b) The Reset All button is not receiving the click (DOM/CSS issue: another element on top, pointer-events:none, error-banner overlapping it).
  - (c) `confirm("Reset everything?")` returns false silently — would happen if the browser is set to suppress dialogs after multiple consecutive prompts (Chrome's "block more dialogs" feature). The first call uses native `confirm()`. If the user cancelled an earlier confirm/alert, Chrome may auto-suppress subsequent ones for that tab.

- timestamp: 2026-05-03 — **The error-banner overlap angle**. The errorBanner is `position:fixed; top:0; left:0; right:0; z-index:10000`. It only displays if showError() is called. If a load-time error sets the banner visible, **and** the banner is tall enough due to a stack trace, **and** the user's viewport is small, the banner could overlap the top toolbar — but Reset All is in the LEFT panel, not the top toolbar, so this shouldn't block Reset All.

- timestamp: 2026-05-03 — **No double-binding of event listeners**. All `addEventListener` calls are at module top-level (lines 19, 22, 32, 118, 340, 1531-1546, 1729, 1963, 1973, 1974, 1977, 1990, 2046, 2052, 2065, 2070). None are inside functions called by Load JSON.

- timestamp: 2026-05-03 — **Coordinate origin check (reporter hypothesis 2).** When saving, line 1692 saves `origin: origin ? { x: origin.x, y: origin.y } : null`. When loading, line 1759 restores `origin = data.canvas.origin || null`. If origin is null after load, `syncPixelFromReal` (line 452-456) returns early — but the original `n.x, n.y` from JSON are preserved (since `nodes = data.canvas.nodes` directly assigns the deserialized node objects). So hit-detection in `findNodeAt` (line 433-435, uses `n.x/n.y`) **does work** even when origin is null after load. **Reporter hypothesis 2 partially eliminated** — the origin null edge case alone does not break hit-detection for previously-placed nodes. It would only break a NEWLY-PLACED node after load (because adding a new node uses `if (origin === null) origin = { x: px, y: py }` — but support mode doesn't add new nodes, it only operates on existing ones).

- timestamp: 2026-05-03 — **truss2d sibling check (reporter hypothesis 4).** Looked at ui/truss2d/script.js Load JSON handler (lines 808-875). Same anti-pattern: also does NOT reset isPanning, does NOT call setMode, does NOT clear floating panels (truss2d has fewer panels). The two bugs DO share the same state-management anti-pattern: **Load JSON is not symmetric with Reset All — it clears persistent model state but leaves transient interaction state untouched.** The truss2d todo (2026-04-18) reports a different symptom (Add Load silently fails after Save/Load round-trip) but the same root pattern: post-load state is in a hybrid shape that some code paths can't handle.

## Eliminated Hypotheses

- **Hypothesis 2 (coordinate origin mismatch breaks hit-test on existing nodes):** ELIMINATED. Loaded node `x/y` are restored directly from JSON, independent of `origin`. `findNodeAt` operates on those pre-existing values. Origin only matters for placing NEW nodes (sets the placeholder for grid-snap reference) and for the live coordinate readout. Hit-test on existing nodes is independent of origin.

- **Infinite loop in support-add click branch:** ELIMINATED. Lines 160-167 are simple filter+push, no recursion, no loops. If freeze is "click does nothing" the click is being silently swallowed, not entering an infinite loop.

- **Double-binding of event listeners on Load:** ELIMINATED. All `addEventListener` calls are at module top-level. None are re-bound by Load JSON.

- **Sync exception in draw() during post-load redraw:** UNLIKELY. drawBMD/SFD/Deflected are guarded by `if (results)` and after-load `results=null`. drawNodes/Members/Supports iterate over loaded arrays defensively (`if (!n1 || !n2) return`). Any exception would surface in the page-level errorBanner (red bar across top) which the user has not reported seeing.

## Root Cause Report

### Confidence summary

**No single root cause can be confirmed from code reading alone.** The investigation found multiple state-management gaps in the Load JSON path but none of them, in isolation, definitively explains the "UI freezes AND Reset All does not recover" symptom from the symptom description.

The strongest candidates, ranked:

### Candidate A — `isPanning` stuck true through Load JSON (HYPOTHESISED, ~35% confidence)

- **CONFIRMED:** Load JSON does not reset `isPanning` (script.js lines 1729-1839 — no `isPanning =` anywhere in the load handler).
- **CONFIRMED:** Reset All DOES reset `isPanning` (script.js line 373, per the prior D-14 fix at lines 358-368).
- **CONFIRMED:** When `isPanning === true`, every canvas click returns early at line 120 (`if (isPanning) return;`) → support-add silently fails.
- **HYPOTHESISED:** The user happens to trigger middle-mouse pan release outside canvas at some point before Load JSON — possible but requires that specific user action.
- **PROBLEM with this candidate:** It does not explain why Reset All fails to recover, because Reset All DOES set `isPanning = false`. So if Reset All button click is reaching `resetAll()`, the second click on a node should work. Unless the user never confirms the "Reset everything?" dialog (e.g. they think Reset All should be one-click and dismiss it).

### Candidate B — Pointer events blocked by leftover `udlPanel`/`springPanel` (HYPOTHESISED, ~10% confidence)

- **CONFIRMED:** Load JSON does not hide udlPanel or springPanel (script.js lines 1729-1839).
- **CONFIRMED:** udlPanel/springPanel are `position:fixed` modals at the centre of the viewport.
- **HYPOTHESISED:** If a panel was open (visible) before Load JSON and the user clicks a node *under* the panel after load, the panel intercepts the click. But the panels are small; clicks on nodes outside their area still reach canvas.
- **PROBLEM:** Doesn't fit the symptom "all clicks freeze" — only clicks under the panel would be intercepted.

### Candidate C — Browser dialog suppression after Reset All confirm cancelled (HYPOTHESISED, ~25% confidence)

- **CONFIRMED:** `resetAll()` line 352 starts with `if (!confirm('Reset everything?')) return;`.
- **HYPOTHESISED:** Chrome/Firefox have a "Don't allow this site to prompt you again" feature that activates after the user dismisses multiple successive `confirm()` / `alert()` / `prompt()`. The frame2d UI uses many `prompt()` calls (loadX/Y/Moment, editNode, memberProps). If the user dismissed several, the browser may auto-cancel `confirm("Reset everything?")` → `resetAll` returns at line 352 and never resets anything.
- **This would explain "Reset All has no effect"** without requiring a JS hang.
- **VERIFICATION NEEDED:** User checks the browser address bar / dialog area for a "blocked" indicator, or tries Ctrl+F5 (hard refresh) to recover.

### Candidate D — Load JSON not clearing `_springActiveNodeId` + open springPanel sequence (HYPOTHESISED, ~10% confidence)

- **CONFIRMED:** `_springActiveNodeId` is not cleared by Load JSON (only `_udlActiveMemberIdx` is, line 1818).
- **HYPOTHESISED:** If the user had a spring panel open (and `_springActiveNodeId` set to some old node id) before Load JSON, then after load that id may not exist in the new nodes array. If the user then clicks Apply on the spring panel (which Load JSON didn't hide), the spring would be added with an orphan nodeId. But that's not "freeze on support-add".

### Candidate E — Some draw() pathway throwing repeatedly on post-load state (HYPOTHESISED, ~15% confidence)

- **HYPOTHESISED:** A loaded JSON has a member or node shape that's slightly off (e.g. an old-format file missing `udl_x`, an `id` that's a string instead of int, a member referencing a non-existent node), causing `draw()` to throw silently or repeatedly during the support-add → draw() cycle.
- **Each `draw()` throw IS caught by the outer try/catch and surfaces in the errorBanner**, which would be visible. So unless `showError` itself throws (e.g. errorBanner element is missing or detached), this would be visible.

### Candidate F — File picker side effect on the canvas event loop (HYPOTHESISED, low confidence ~5%)

- **HYPOTHESISED:** Native file picker dialogs in some browsers (especially Linux/Chrome combinations) leave the canvas in a state where `mousedown` events are queued but `mouseup` events are not delivered — leading to a desync. No code-level evidence; would need DevTools repro.

### Confidence breakdown

| Component | Status | Confidence |
|---|---|---|
| Load JSON does not reset isPanning | CONFIRMED | 100% (line-by-line) |
| Load JSON does not call setMode | CONFIRMED | 100% |
| Load JSON does not hide modal panels | CONFIRMED | 100% |
| Load JSON does not clear `_springActiveNodeId` | CONFIRMED | 100% |
| Hit-test on existing nodes works regardless of origin | CONFIRMED | 100% |
| Click handler has no infinite loop in support branch | CONFIRMED | 100% |
| Click handler is wrapped in try/catch with visible banner | CONFIRMED | 100% |
| Specific freeze-causing code path | NOT CONFIRMED from code reading | — |
| Reset All non-recovery cause | NOT CONFIRMED from code reading | — |

**Honest summary:** The Load JSON handler has multiple known asymmetries with Reset All, any of which could plausibly cascade into a "stuck" state. But code reading alone cannot pin down the single freeze cause without a runtime trace from the user.

## Eliminated hypotheses (from reporter's list)

- **#2 (coordinate origin mismatch):** Eliminated for hit-test on EXISTING nodes after load (`n.x/n.y` survive even if `origin` is null). Still partially relevant if the user's first action after load is to add a NEW node before adding support — that flow re-establishes origin via line 128.

- **#1 (mode state machine left in inconsistent shape):** Largely eliminated. The mode flag is a simple string and persists across load — no "partial-click state" exists for support mode. But `_springActiveNodeId` IS a partial-click state for spring mode that Load JSON doesn't clear (Candidate D).

## Proposed minimal fix (NOT applied — diagnose-only session)

**Direction: Make Load JSON symmetric with Reset All for transient state, and add the same `isPanning` safety net.**

In `ui/frame2d/script.js`, expand the Load JSON handler around line 1815-1820. Currently:

```js
// Reset solve results and history
results = null;
history = [];
_udlActiveMemberIdx = null;
currentMemberStart = null;
```

Proposed expansion (additions in italics in this report — actual change would be a contiguous block):

```js
// Reset solve results and history
results = null;
history = [];
_udlActiveMemberIdx = null;
_springActiveNodeId = null;            // NEW: match Reset All
currentMemberStart = null;

// Clear transient interaction state — same precaution as Reset All
// (D-14 precedent at lines 358-388). isPanning may have been stuck true
// from a middle-mouse pan that released outside canvas — without this
// reset, every post-load canvas click returns early at the
// `if (isPanning) return;` guard on line 120.
isPanning = false;                                 // NEW
panStartX = 0; panStartY = 0;                       // NEW
panStartTx = 0; panStartTy = 0;                     // NEW

// Diagnostic overlay arrays — stale entries from before load reference
// node ids that may no longer exist in the new model.
pureBarNodeIds = [];                                // NEW
offendingNodes = [];                                // NEW
offendingMembers = [];                              // NEW

// Hide any open modal panels (user may have left UDL/Spring panel open
// from a previous session before clicking Load JSON).
document.getElementById('udlPanel').style.display = 'none';     // NEW
const sp = document.getElementById('springPanel');              // NEW
if (sp) sp.style.display = 'none';                              // NEW

// Clear the error banner — stale errors from before load are misleading.
const banner = document.getElementById('errorBanner');          // NEW
if (banner) banner.style.display = 'none';                      // NEW

// Revoke any leftover blob URL from a previous solve.
if (_lastBlobUrl) { URL.revokeObjectURL(_lastBlobUrl); _lastBlobUrl = null; }  // NEW

// Reset mode to 'node' so the post-load state matches a fresh page —
// also restyles the active button highlight in the toolbar.
setMode('node');                                    // NEW (debatable; see Risk)
```

The truss2d Load JSON handler at `ui/truss2d/script.js:808-875` should receive the same treatment — same anti-pattern, same fix shape — to address todo `2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md` in parallel.

### Why this is the minimal fix even though no single cause is confirmed

The shotgun approach is justified because:
1. Each missing reset is independently a bug per the principle "Load JSON should leave the page in a state equivalent to (Reset All → load model)."
2. The prior D-14 fix established the precedent: `isPanning` stuck true is a real freeze mode that has been observed before in this codebase. Not protecting Load JSON against it is an oversight.
3. Cost of the fix is ~10 lines, no risk of over-correction (none of the resets can break a working state).

### Risk assessment

- **`setMode('node')` after load:** debatable. If the user clicked Load JSON expecting to immediately keep their previous mode (e.g. they were in support mode, loaded a model, want to add a support), forcing back to `node` is a small UX regression. Mitigation: skip `setMode('node')` and only reset transient flags. The bug is about state, not mode — and mode-flag is a simple string with no partial state.
- **Hiding udlPanel/springPanel:** safe — if they were open with no in-flight edit, hiding them just dismisses the panel. The active-id flags are cleared in the same block.
- **Resetting `view`:** NOT proposed. Zoom/pan should persist across load (the user may have zoomed in to look at a specific area before loading a related model).
- **Resetting `isPanning`:** safe — the only state lost is "user is currently middle-dragging" which is unlikely during a file-picker flow.
- **Sibling truss2d fix:** must apply the same shape to ui/truss2d/script.js to keep the two UIs converged. Diverging now will compound future bugs.

### Open questions for runtime verification

When the user is back at their Mac:

1. **Reproduce with Chrome DevTools Console open.** Log the contents of the Console tab when the freeze occurs — note any red errors, warnings, or "Promise rejection" entries.

2. **Check the on-page error banner.** Is there a red bar across the top of the page during the freeze? If yes, capture the text — that names the line that threw.

3. **Click Reset All during the freeze. Does the "Reset everything?" confirm dialog appear?**
   - **If YES** — `resetAll()` is running but somehow not recovering. This points to JS state outside `resetAll()`'s scope, or a re-trigger of the bug condition immediately after.
   - **If NO** — either the click is not reaching `resetAll()` (DOM/CSS issue) or the browser is suppressing the confirm dialog (Candidate C). Check for a "Block more dialogs" indicator in the address bar.

4. **In the Console during freeze, type:** `isPanning` and press Enter. If it logs `true`, Candidate A is confirmed.

5. **In the Console during freeze, type:** `mode` and press Enter. Confirm it's actually `'fixed'` / `'pinned'` / etc. as the user expects. If it's something else, the click handler is in the wrong branch.

6. **In the Console during freeze, type:** `nodes.length` and `nodes[0]` to confirm the loaded nodes have valid `x`, `y`, `id` properties matching what the click handler expects.

7. **In the Console during freeze, type:** `document.getElementById('udlPanel').style.display` and same for `'springPanel'`. If either is `'block'`, Candidate B is in play.

8. **Network tab:** during the freeze, is any fetch in pending state? The Frame2D UI only fetches `/solve/frame2d` on solve. If there's a stuck fetch, that's a separate problem.

9. **Hard refresh (Ctrl+F5) test.** Is hard refresh sufficient to recover, or does the user genuinely need to restart uvicorn? If hard refresh works, the "restart uvicorn" step in the user's recovery procedure is superstition — not part of the bug.

## Constraints For This Session

- DIAGNOSE-ONLY: do not modify any source file, do not commit anything
- No browser-launching attempts (user is away from Mac during this run)
- Must produce written hypothesis with confidence breakdown (CONFIRMED vs HYPOTHESISED, % confidence) before user returns
- If hypothesis cannot be reached from code reading alone, say so explicitly — that is a valid stopping point, user will reproduce with DevTools open later
- Propose smallest fix at the end, but DO NOT apply it

## Resolution (2026-05-04)

**Actual root cause:** chkSupports / chkLoads visibility checkboxes were unchecked at click time. Support and load click handlers correctly mutated `supports` / `nodeLoads` arrays and called `draw()`, but `drawSupports()` and `drawNodeLoads()` are gated on the checkbox state (script.js lines 740-741), so no glyph was drawn. The UI was never frozen — clicks were registering and state was changing, but rendering was suppressed by user-controlled visibility flags.

**How confirmed:** User reproduced with Chrome DevTools Console open on 2026-05-04. After clicking in support mode, `supports.length` had incremented and `supports[supports.length-1]` showed the new entry, but the canvas showed nothing. `document.getElementById('chkSupports').checked` was `false`. Ticking it manually and re-running `draw()` made the support appear.

**Why all eight 2026-05-03 candidates (A-F) were wrong:** None of them — `isPanning` stuck true, browser dialog suppression, panel pointer-event blocking, `_springActiveNodeId` orphaning, draw() exceptions, file-picker side effects — were operative. The diagnose-only session over-fitted to the "freeze + Reset All does not recover" framing in the original todo. The actual symptom was "click does nothing visible" plus the user assuming Reset All didn't help because the post-Reset-All state also rendered nothing visible (Reset All clears the data arrays correctly, but the user had no glyph to see disappear). The Load JSON path is innocent.

**Fix applied:** `ui/frame2d/script.js` setMode() now auto-enables the matching visibility checkbox (chkSupports for support modes, chkLoads for load modes) and calls draw() so previously-added invisible glyphs become visible immediately. See quick task 260504-ene.

**Lesson for future debug sessions:** When the hypothesis "UI is frozen" is supplied by a non-developer reporter, validate the freeze itself before mining the state-management surface. "Click does nothing visible" can mean the click was processed and the visual layer is suppressed, not that the JS event loop is stuck. A quick Console probe of the data array before assuming a JS hang would have shortcut this.

**Sibling status:** ui/truss2d/script.js has the same anti-pattern (mode entry does not enable matching visibility layer). Tracked as a follow-up todo by quick task 260504-ene; not fixed in this session.

files_changed: ui/frame2d/script.js (setMode), CLAUDE.md (UI conventions note), this file (status + Resolution), .planning/todos/done/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md (moved + resolution note).
