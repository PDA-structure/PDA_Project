---
phase: 260418-vxi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/truss2d/index.html
  - ui/truss2d/script.js
autonomous: false
requirements: [DIAG-01]

must_haves:
  truths:
    - "A fixed red banner appears at the top of the page whenever a JS error fires in either UI"
    - "The banner shows the error message, the source file/line, and first 3 stack frames"
    - "The banner is dismissible via an ✕ button"
    - "When no error fires, both UIs look and behave identically to before (banner hidden)"
    - "Throwing an error from one of the 6 wrapped entry points (canvas click, inputScale input, saveModel, fileInput change, drawDeflected, draw) surfaces via the banner instead of failing silently"
  artifacts:
    - path: "ui/frame2d/index.html"
      provides: "Banner DOM node at top of <body>"
      contains: "id=\"errorBanner\""
    - path: "ui/frame2d/script.js"
      provides: "showError helper + global handlers + 6 try/catch wraps"
      contains: "function showError"
    - path: "ui/truss2d/index.html"
      provides: "Banner DOM node at top of <body>"
      contains: "id=\"errorBanner\""
    - path: "ui/truss2d/script.js"
      provides: "showError helper + global handlers + 6 try/catch wraps"
      contains: "function showError"
  key_links:
    - from: "window error / unhandledrejection events"
      to: "#errorBanner DOM element"
      via: "showError() function"
      pattern: "window\\.addEventListener\\('error'"
    - from: "try/catch wraps at 6 entry points"
      to: "showError()"
      via: "catch(err) { showError(...); throw err; }"
      pattern: "showError\\(err\\.message"
    - from: "#errorBannerClose button"
      to: "banner dismissal"
      via: "click listener setting display:none"
      pattern: "errorBannerClose"
---

<objective>
Add a dismissible on-page JavaScript error banner to both `ui/frame2d` and `ui/truss2d` so runtime errors surface to the user without requiring browser DevTools. This is a pure-diagnostic tool — the underlying bugs (truss2d "Add Load" silent failure and "Scale factor stuck after Solve") are NOT fixed here. Banner makes them visible so a follow-up fix task can target the actual error.

Purpose: User runs Safari where DevTools is not readily accessible. Without visible error reporting, regressions look like "nothing happens" instead of named exceptions.

Output: Two modified HTML files (banner element added) and two modified JS files (helper + global handlers + 6 try/catch wraps each). No new files. No CSS changes.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/todos/pending/2026-04-18-fix-truss2d-add-load-and-scale-input-regressions.md

# UI files being modified
@ui/frame2d/index.html
@ui/frame2d/script.js
@ui/truss2d/index.html
@ui/truss2d/script.js

<constraints>
- Safari compatibility: no optional chaining on `e.reason?.message` — use explicit `e.reason && e.reason.message`
- No new JS files, no new CSS files — inline styles on banner, helper function lives inside existing script.js
- Behaviour must be IDENTICAL to current when no error fires (additive-only)
- All catch blocks must re-throw (`throw err`) so the banner does not change error propagation
- frame2d and truss2d get symmetric treatment — duplicate the small helper rather than extracting
</constraints>

<entry_points_to_wrap>
In each of ui/frame2d/script.js and ui/truss2d/script.js, wrap these 6 call sites in try/catch:

1. `canvas.addEventListener('click', ...)` — main interaction handler (wrap the handler body)
2. `document.getElementById('inputScale').addEventListener('input', draw)` — wrap the `draw` call (use `() => { try { draw(); } catch (err) { showError(...); throw err; } }`)
3. `saveModel()` — wrap the entire function body
4. `document.getElementById('fileInput').addEventListener('change', ...)` — wrap the Load JSON handler body
5. `drawDeflected()` — wrap the entire function body (most likely culprit for "scale stuck" bug)
6. `draw()` — wrap the entire function body

Standard wrap pattern:
```js
try {
  // existing code unchanged
} catch (err) {
  showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
  throw err;
}
```

Notes for executor:
- In frame2d, the inputScale listener may currently be written inline differently — find it via grep for `inputScale` and wrap the draw call.
- In truss2d, `inputScale` is at line ~93 in index.html. The listener registration in script.js will need locating via grep.
- If a function does not exist in one UI (e.g. a draw helper missing), SKIP that wrap for that UI only and note in the summary. Do not invent code.
</entry_points_to_wrap>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add banner HTML + helper JS + global handlers to both UIs</name>
  <files>ui/frame2d/index.html, ui/frame2d/script.js, ui/truss2d/index.html, ui/truss2d/script.js</files>
  <action>
For BOTH `ui/frame2d/index.html` and `ui/truss2d/index.html`:

Insert the following banner element as the FIRST child of `<body>` (before `<header>`):

```html
<div id="errorBanner" style="display:none; position:fixed; top:0; left:0; right:0; z-index:10000; background:#d32f2f; color:white; padding:8px 40px 8px 12px; font-family:monospace; font-size:12px; line-height:1.4; white-space:pre-wrap; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
  <span id="errorBannerText"></span>
  <button id="errorBannerClose" type="button" style="position:absolute; top:4px; right:8px; background:transparent; color:white; border:1px solid rgba(255,255,255,0.5); border-radius:3px; cursor:pointer; padding:2px 8px;">✕</button>
</div>
```

For BOTH `ui/frame2d/script.js` and `ui/truss2d/script.js`:

Insert the following block at the VERY TOP of the file (before the `const API_URL = ...` line):

```js
// ── Error banner (diagnostic) ─────────────────────────────────────────────
function showError(msg, source, lineno, colno, error) {
  var banner = document.getElementById('errorBanner');
  var text   = document.getElementById('errorBannerText');
  if (!banner || !text) return;
  var shortSource = '';
  if (source) {
    var parts = String(source).split('/');
    shortSource = ' (' + parts[parts.length - 1] + ':' + (lineno || '?') + ':' + (colno || '?') + ')';
  }
  var stack = '';
  if (error && error.stack) {
    stack = '\n' + String(error.stack).split('\n').slice(0, 3).join('\n');
  }
  text.textContent = String(msg) + shortSource + stack;
  banner.style.display = 'block';
}

window.addEventListener('error', function (e) {
  showError(e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener('unhandledrejection', function (e) {
  var reasonMsg = 'Unhandled promise rejection: ';
  if (e.reason && e.reason.message) {
    reasonMsg += e.reason.message;
  } else {
    reasonMsg += String(e.reason);
  }
  showError(reasonMsg, '', 0, 0, e.reason);
});

document.addEventListener('DOMContentLoaded', function () {
  var closeBtn = document.getElementById('errorBannerClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var banner = document.getElementById('errorBanner');
      if (banner) banner.style.display = 'none';
    });
  }
});
```

Safari notes observed:
- Use `var` (not `const`/`let`) inside the helper for maximal compatibility — consistent with ES5 style
- Use `function (e) {}` not arrow functions for the event handlers
- Explicit `e.reason && e.reason.message` null-check (no optional chaining)
- Wrap the close-button wiring in `DOMContentLoaded` because the script.js tag is at end of `<body>`, so DOM will exist — but DOMContentLoaded is defensive in case a UI is later loaded via a different path

Duplicate the helper verbatim in both script.js files — do NOT extract to a shared file (per constraint).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); ['ui/frame2d/index.html','ui/truss2d/index.html'].forEach(f=>{const c=fs.readFileSync(f,'utf8'); if(!c.includes('id=\"errorBanner\"')) throw new Error(f+' missing errorBanner'); if(!c.includes('id=\"errorBannerClose\"')) throw new Error(f+' missing close button');}); ['ui/frame2d/script.js','ui/truss2d/script.js'].forEach(f=>{const c=fs.readFileSync(f,'utf8'); if(!c.includes('function showError')) throw new Error(f+' missing showError'); if(!c.includes(\"addEventListener('error'\")) throw new Error(f+' missing window error handler'); if(!c.includes('unhandledrejection')) throw new Error(f+' missing rejection handler');}); console.log('OK');"</automated>
  </verify>
  <done>
Both index.html files have the `#errorBanner` element as the first body child. Both script.js files have `showError()`, `window.addEventListener('error', ...)`, `window.addEventListener('unhandledrejection', ...)`, and a `DOMContentLoaded` wiring for the close button — all at the very top of the file, before any existing code.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wrap 6 entry points in try/catch in both script.js files</name>
  <files>ui/frame2d/script.js, ui/truss2d/script.js</files>
  <action>
For BOTH `ui/frame2d/script.js` and `ui/truss2d/script.js`, locate each of the 6 entry points below and wrap per the pattern in `<entry_points_to_wrap>` above. For each wrap, the try block contains the existing code UNCHANGED; the catch block calls `showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err)` then re-throws with `throw err;`.

**Location strategy (use grep, do not guess):**

1. **canvas click handler** — grep for `canvas.addEventListener('click'` or `canvas.onclick`. Wrap the handler function body.

2. **inputScale input listener** — grep for `inputScale`. Look for `.addEventListener('input'` or similar. If the listener passes `draw` directly (e.g. `addEventListener('input', draw)`), replace with an inline wrapper: `addEventListener('input', function () { try { draw(); } catch (err) { showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err); throw err; } })`. If it already has a handler body, wrap the body.

3. **saveModel** — grep for `function saveModel` (or `saveModel = function`). Wrap the entire function body.

4. **fileInput change handler** — grep for `fileInput` and find the `'change'` listener. Wrap the handler body.

5. **drawDeflected** — grep for `function drawDeflected`. Wrap the entire function body. HIGH PRIORITY — this is the prime suspect for the "scale stuck" bug per the todo.

6. **draw** — grep for `function draw` (exact match, not `drawDeflected`). Wrap the entire function body.

**If a function is missing in one UI:**
- frame2d almost certainly has all 6. truss2d should too.
- If any one is genuinely absent (e.g. `drawDeflected` only defined conditionally), SKIP it in that UI and record the skip in the summary. Do not invent code.

**Rules, strict:**
- Code INSIDE the try block is byte-identical to before except for indentation. Do not refactor, do not rename, do not add early returns.
- Every catch MUST `throw err;` at the end.
- Do NOT wrap helper functions, utility functions, or the `showError` helper itself.
- Do NOT add try/catch inside inner functions that already sit inside a wrapped parent.

**Per-wrap sanity:** after each wrap, re-read the surrounding ~20 lines to confirm no syntax error (unbalanced braces, trailing comma issues from prior arrow-function signatures, etc.).

**Example transformation (inputScale inline case):**

Before:
```js
document.getElementById('inputScale').addEventListener('input', draw);
```

After:
```js
document.getElementById('inputScale').addEventListener('input', function () {
  try {
    draw();
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
});
```

**Example transformation (function body case — `saveModel`):**

Before:
```js
function saveModel() {
  const payload = { ... };
  // ... existing body ...
}
```

After:
```js
function saveModel() {
  try {
    const payload = { ... };
    // ... existing body unchanged ...
  } catch (err) {
    showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
    throw err;
  }
}
```
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); ['ui/frame2d/script.js','ui/truss2d/script.js'].forEach(f=>{const c=fs.readFileSync(f,'utf8'); const catches=(c.match(/showError\(err\.message/g)||[]).length; if(catches<5) throw new Error(f+' has only '+catches+' showError(err.message) catches, expected 5-6'); const throws=(c.match(/throw err;/g)||[]).length; if(throws<5) throw new Error(f+' has only '+throws+' throw err statements, expected 5-6'); new Function(c);}); console.log('OK');"</automated>
  </verify>
  <done>
Each script.js contains at least 5 `showError(err.message, ...)` catch sites (6 expected; 5 permitted only if one entry point is genuinely absent in that UI and the skip is documented). Each catch is followed by `throw err;`. Both files parse as valid JavaScript (via `new Function(source)` syntax check). No existing code logic changed — only wrapped.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify banner works in Safari</name>
  <files>ui/frame2d/index.html, ui/truss2d/index.html</files>
  <action>
CHECKPOINT — this task is verification only. Automated work is already complete. User serves the UIs locally and confirms the banner behaves correctly in Safari. See `<how-to-verify>` for steps.
  </action>
  <what-built>
Dismissible red error banner at top of both frame2d and truss2d UIs. Fires on any uncaught JS error. 6 suspect entry points explicitly wrapped so their errors surface. No behaviour change when no error fires.
  </what-built>
  <how-to-verify>
Serve the UIs locally and test in Safari (the user's actual browser):

1. From repo root, run: `python3 -m http.server 5500` (serve UI statics)
2. In Safari, open http://localhost:5500/ui/truss2d/ — confirm the page looks IDENTICAL to before (no red banner visible on load). Top of page should NOT have a red stripe.
3. Open http://localhost:5500/ui/frame2d/ — same check: identical to before, no red banner.
4. In truss2d: open Safari's Web Inspector (Develop menu → Show JavaScript Console) and run `throw new Error('test banner from truss2d')`. A red banner should appear at the top of the page with the message and stack trace. Click the ✕ button — banner should disappear.
5. Repeat step 4 in frame2d.
6. Reproduce the original truss2d bugs (the reason this banner exists):
   - Reset All → add 2 nodes → add a member → click "Add Load" → click on a node.
   - If the silent-failure bug still repros, the banner should now show the actual JS error. Record the message + stack verbatim in the summary — it unblocks the follow-up fix.
   - Solve a simple structure (2 nodes pinned, 1 horizontal member, 1 load) → after results appear, change the "Scale factor" field. If the input-stuck bug repros, the banner should show the throwing error.
7. Confirm no new console warnings or errors on page load in either UI (the banner code itself must not spam errors).
  </how-to-verify>
  <verify>Manual Safari test per how-to-verify steps 1-7</verify>
  <done>
Both UIs load cleanly (no banner on load). Thrown test error triggers banner in both UIs. ✕ dismisses banner. Original truss2d bugs (if they repro) now surface concrete error messages.
  </done>
  <resume-signal>
Type "approved" if:
- Both UIs load with NO banner visible (unchanged visual)
- Thrown test error triggers the banner in both UIs
- ✕ button dismisses the banner
- Reproducing the original bugs now shows a named error (or — if bugs no longer repro due to page refresh / clean state — note that and mark as "diagnostic ready for future recurrence")

Describe any issues if the banner misbehaves, fires on load, breaks the UI layout, or fails to capture the suspect errors.
  </resume-signal>
</task>

</tasks>

<verification>
1. Both `index.html` files contain `id="errorBanner"` and `id="errorBannerClose"` as first child of body.
2. Both `script.js` files contain `function showError`, `window.addEventListener('error'`, `window.addEventListener('unhandledrejection'`, and DOMContentLoaded wiring for the close button — all at the top of the file.
3. Both `script.js` files contain at least 5 `showError(err.message, ...)` call sites, each followed by `throw err;`.
4. Both `script.js` files parse as valid JavaScript.
5. Human-verified: banner appears on thrown error in Safari, dismisses on ✕, does not appear on clean page load.
6. Human-verified: reproducing the two original truss2d bugs surfaces a concrete error message.
</verification>

<success_criteria>
- Banner appears for any uncaught JS error in either UI (Safari-tested)
- Banner is dismissible
- No behavioural change when no error fires
- At minimum the 6 listed entry points are wrapped in try/catch that calls showError and re-throws
- No new CSS files, no new JS files — all additions are inline / in existing script.js files
- The original truss2d bugs either surface a visible error (enabling follow-up fix) or are confirmed non-reproducing on a clean page
</success_criteria>

<output>
After completion, create `.planning/quick/260418-vxi-add-error-banner-to-uis-for-diagnostic-v/260418-vxi-SUMMARY.md` including:
- Exact locations (file + line range) where each of the 12 wraps was placed (6 per UI)
- Any entry points that were SKIPPED because the function did not exist in that UI, with reason
- If the Safari test surfaced a concrete error for either of the original truss2d bugs: the full error message and stack trace (verbatim) — this unblocks the follow-up fix task
- Confirmation that the banner does NOT appear on clean page load in either UI
</output>
