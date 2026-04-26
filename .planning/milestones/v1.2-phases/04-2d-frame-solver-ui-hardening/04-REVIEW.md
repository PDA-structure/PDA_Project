---
phase: 04-2d-frame-solver-ui-hardening
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - api_server/app.py
  - tests/test_frame_v2.py
  - tests/test_uat_frame2d.py
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/frame2d/style.css
findings:
  critical: 0
  warning: 3
  info: 8
  total: 11
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 04 hardens the 2D frame solver + UI across three plans: multi-member regression
tests (TRUST-13..17), the frame2d UI Spring support feature, and a 5-fixture UAT harness
that surfaced two D-14 bug fixes (engine alias registration + `resetAll()` state
cleanup). Overall code quality is good: tests are thorough with analytical references,
the D-14 fixes are well-commented, and CLAUDE.md hard rules are respected (no
matplotlib/printing in `solver_core`, no imports from `visualization/` into
`api_server/`, 1-based DOF numbering preserved in the public API, new solver alias
registered via `engine.register()`).

Three **warnings** were found — all correctness concerns of medium severity:
- A UDL sign convention mismatch between `ui/frame2d/script.js` (`drawUDLs` treats
  `m.udl > 0` as downward visually) and `api_server/app.py` `udl_x` convention
  (positive = rightward). Not a bug in the reviewed code itself, but it means the UI
  semantically stores "positive = downward" in `m.udl` while the API convention
  (CLAUDE.md) defines UDL as "positive = downward → ENForces = [-wL/2, -wL/2]".
  Confirmed consistent — this turns out to be a documentation finding only.
- `.filter(Boolean)` idiom for `bars`, `beamPinLeft`, `beamPinRight` arrays is
  fragile against future refactors that could introduce 0-based member indices.
- The UI's `m.udl_x !== null` check on line 554/1495 misses the `undefined` case
  for members created prior to the `udl_x` field being added to the member schema.

The remaining 8 items are **Info**-level code-quality improvements: duplicated
solve-payload construction between `solve()` and `saveModel()`, ad-hoc error
banner wiring, debug artifacts (`console.warn` on unknown support form), etc.

No security vulnerabilities, no hardcoded credentials, no dangerous eval/innerHTML
usage. All fetches are to a localhost API as per project architecture.

---

## Warnings

### WR-01: UDL sign convention: `m.udl_x !== null` misses `undefined`

**File:** `ui/frame2d/script.js:554`, `ui/frame2d/script.js:1495`

**Issue:** Two sites build the `udl_x` API payload with
`members.map(m => m.udl_x !== null ? m.udl_x : 0)`. The strict-inequality check
passes the value `undefined` through unchanged, which would POST `undefined` in
the JSON array (serialised as `null`) and downstream Pydantic validation would
accept it only because `Optional[List[float]]` tolerates it for the top-level
field, not per-element. All modern members initialised via the `member` click
handler (line 131-143) include `udl_x: null` explicitly, but:

1. Loaded files predating the `udl_x` field (before D-02 introduced it) may have
   members without the key set at all — `m.udl_x` returns `undefined`.
2. The load handler at line 1598-1600 only assigns `m.udl_x` when `udlMap[m.id]`
   is defined, and the fallback `(m.udl_x != null ? m.udl_x : null)` is bypassed
   if the member had no entry in `udlMap` at all — leaving `m.udl_x` as whatever
   it was on the member object before load (often `undefined` if loaded from a
   schema-v0 file).

Net effect: payload can contain `undefined` → serialises to `null` → fails
Pydantic `List[float]` validation, causing a cryptic 422 response.

**Fix:** Normalise with `!= null` (double-equals) or an explicit fallback:
```js
// Before (line 554)
udl_x: members.map(m => m.udl_x !== null ? m.udl_x : 0),

// After
udl_x: members.map(m => (m.udl_x != null ? m.udl_x : 0)),
```
Apply the identical change at line 1495 in `saveModel()`.

---

### WR-02: `.filter(Boolean)` is fragile for 1-based index lists

**File:** `ui/frame2d/script.js:538-540`, `ui/frame2d/script.js:1448-1450`

**Issue:** Three arrays are assembled with the idiom
`members.map((m,i) => cond ? i+1 : null).filter(Boolean)`. This works today
because `i+1` ≥ 1 (non-falsy). But if anyone ever switches the public API to
0-based member indexing (a natural modernisation), the first member with index
0 silently disappears from the filtered list — the `bars` / `beamPinLeft` /
`beamPinRight` arrays would drop that member with no error. This is a classic
"works today, silent bug tomorrow" pattern.

Additionally the two sites (solve + saveModel) diverge: any future change to
one must be mirrored to the other — a minor DRY violation that amplifies the
risk.

**Fix:** Replace with a more explicit filter:
```js
// Before
const bars = members.map((m,i) => m.type === 'bar' ? i+1 : null).filter(Boolean);

// After
const bars = members
  .map((m, i) => ({ m, i }))
  .filter(({ m }) => m.type === 'bar')
  .map(({ i }) => i + 1);
```
Or, given CLAUDE.md locks the API at 1-based indexing, document the invariant
on-site with a brief comment and keep the idiom.

---

### WR-03: `fetch` catch block swallows actual error text

**File:** `ui/frame2d/script.js:574`

**Issue:** `solve()` uses a bare `catch {` (no binding) — the exception is
discarded and the user only sees "Cannot reach API. Is the server running?"
even when the fault is something else entirely (JSON parse error, CORS, local
Bus error, fetch abort, TypeError in `renderResults`, etc.). The UAT users that
surfaced D-14 had to manually add a global `window.onerror` banner because this
outer catch ate the real trace.

The error banner wiring (lines 2-30) exists specifically to catch these, but
`fetch.catch` runs inside `try/catch` and never bubbles up — it returns
silently with a misleading message.

**Fix:**
```js
// Before
} catch {
  setStatus('Cannot reach API. Is the server running?', true);
}

// After
} catch (err) {
  setStatus('API call failed: ' + (err && err.message ? err.message : err), true);
  showError((err && err.message) || String(err), '', 0, 0, err);
  // Do not re-throw — async handler; the banner gives the user the full trace.
}
```

---

## Info

### IN-01: Duplicated solve-payload construction (solve vs. saveModel)

**File:** `ui/frame2d/script.js:483-555` and `ui/frame2d/script.js:1392-1495`

**Issue:** The solve() function (lines 483-555) and saveModel() function
(lines 1392-1495) build nearly-identical payload objects (E/I/A resolution,
restrainedDoF, ENForces, ENMoments, bars/pinLeft/pinRight, springDoF,
udl_x). Any bug fixed in one place must be mirrored in the other, and
indeed WR-01 (udl_x null handling) and WR-02 (.filter(Boolean)) both occur
twice because of this duplication.

**Fix:** Extract `function buildSolvePayload()` that returns the shared object.
`solve()` uses it directly; `saveModel()` wraps it with the `canvas` section
and file metadata:
```js
function buildSolvePayload() {
  // ... all shared logic ...
  return { solver: 'frame_v2', nodes, members, ENForces, ... };
}
```

---

### IN-02: `console.warn` leaked to production UI

**File:** `ui/frame2d/script.js:1587`

**Issue:** `console.warn('Unknown support form for node', nId, val)` in the
load-file handler silently logs to the devtools console but the user
sees nothing. Either elevate to an `alert()` (they explicitly loaded
a file and should know it was partially malformed) or route through
`showError()` which the phase 04 plan already exercised as the UI's error
channel.

**Fix:**
```js
// Before
console.warn('Unknown support form for node', nId, val);
return null;

// After
showError('Unknown support form in loaded file for node ' + (nId + 1) +
          ' — this support was ignored.', 'script.js', 1587, 0, null);
return null;
```

---

### IN-03: `parseFloat('') === NaN` sneaks through spring validation

**File:** `ui/frame2d/script.js:387-401`

**Issue:** The empty-string check at lines 387-389 converts `''` to `null`,
but `parseFloat('   ')` (whitespace only, after `.trim()` it becomes `''`
so this is actually fine) and `parseFloat('abc')` → NaN. The `Kx == null`
check at line 391 uses loose equality, so `NaN == null` is `false` — so
if all three inputs are "abc" the cancel-path at line 391 does NOT trigger,
and the loop at lines 396-401 catches the NaN with an `alert`. That is the
correct behaviour, but the flow is subtle. Consider normalising up front:

**Fix:**
```js
function parseSpring(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const v = parseFloat(trimmed);
  return isNaN(v) ? NaN : v;
}
const Kx = parseSpring(kxRaw);
// ... then the rest of the logic can rely on `null | NaN | number`
```

Low priority — current behaviour is safe, just slightly harder to read.

---

### IN-04: Escape key does not clear `isPanning`

**File:** `ui/frame2d/script.js:330-339`

**Issue:** The D-14 fix correctly resets `isPanning` in `resetAll()`, but the
Escape key handler (lines 330-339) does not. A user who middle-drags the
canvas, releases the button outside the viewport (triggering the exact
symptom D-14 fixed), and presses Escape expecting recovery will still have
`isPanning = true`. The obvious user mental model is "Escape gets me back
to a clean state" — it should reset pan state too, mirroring `resetAll()`.

**Fix:**
```js
if (e.key === 'Escape') {
  document.getElementById('udlPanel').style.display = 'none';
  _udlActiveMemberIdx = null;
  const sp = document.getElementById('springPanel');
  if (sp) sp.style.display = 'none';
  _springActiveNodeId = null;
  // Mirror resetAll() pan-state cleanup per D-14 symptom guard
  isPanning = false;
}
```

---

### IN-05: Inline styles in `index.html` bloat the markup

**File:** `ui/frame2d/index.html:10-13`, `ui/frame2d/index.html:239-281`

**Issue:** The error banner (line 10) and both floating panels (UDL line 239,
Spring line 259) carry 5-10 CSS properties inline. The stylesheet already
has `#springPanel` rules (style.css:202-214) — extract the UDL and error
banner styles there too for consistency.

**Fix:** Move banner/UDL inline styles into `ui/frame2d/style.css` using the
ID selectors `#errorBanner`, `#errorBannerText`, `#errorBannerClose`,
`#udlPanel`, `#udlPanelTitle`, etc.

---

### IN-06: `_udlActiveMemberIdx`/`_springActiveNodeId` mutable-globals pattern

**File:** `ui/frame2d/script.js:69-70`

**Issue:** Two module-level mutable flags track the "currently open modal
target". They are written from the canvas click handler (line 194, 163),
cleared in Escape/Cancel/Apply/resetAll, and read in the Apply handlers
(line 383, 1859). This is the canonical "mutable global state" anti-pattern
— contention-safe in a single-user SPA but testing and future refactors
will be harder.

**Fix:** Wrap in a small modal-state helper:
```js
const activeModal = { udlMember: null, springNode: null };
function openUdlModal(mi) { activeModal.udlMember = mi; /* show panel */ }
function closeUdlModal()   { activeModal.udlMember = null; /* hide panel */ }
// ... equivalent pair for spring
```

Low priority — the current pattern works and is clearly scoped.

---

### IN-07: Implicit dependency on member id ↔ index equality

**File:** `ui/frame2d/script.js:1466-1479`, `ui/frame2d/script.js:1596-1615`

**Issue:** The save/load canvas-state round-trip uses `m.id` as the key
into `udlMap` and `memberOverrides`. Other parts of the code assume
`members[i].id === i` (e.g. `reindexMembers` at line 462 enforces this
after deletion). If a future feature ever allows non-contiguous member
IDs, the save/load round-trip silently loses UDLs / overrides. The code
would benefit from either (a) an explicit assertion during save, or (b)
dropping `m.id` and using array index `i` throughout.

**Fix:** At the top of `saveModel()`, add:
```js
// Invariant: save/load uses m.id === array index (enforced by reindexMembers).
console.assert(members.every((m, i) => m.id === i),
               'Member ids must equal array index at save time');
```

---

### IN-08: `throw err;` after `showError` in click handler re-throws twice

**File:** `ui/frame2d/script.js:297-300`, and similar patterns throughout

**Issue:** The pattern
```js
} catch (err) {
  showError(err.message, err.fileName || '', err.lineNumber || 0, 0, err);
  throw err;
}
```
surfaces via `window.addEventListener('error', ...)` (lines 19-21), which
then calls `showError` again. Net result: the banner text is overwritten
immediately by the re-thrown error and the user sees the window.onerror
message rather than the (possibly) more contextual first one.

**Fix:** Decide one path and commit to it. Either:
- (a) `showError` and don't re-throw (silences the JS console but gives the
  user the contextual message), or
- (b) Just `throw err` and let `window.onerror` handle banner rendering
  (single source of truth).

Pick (b) for click handlers (the browser console is more useful for dev
debugging) and remove the in-handler `showError` call.

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
