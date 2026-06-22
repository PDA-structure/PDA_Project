---
phase: quick-260622-rcm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/script.js
  - ui/truss2d/script.js
autonomous: false
requirements: [MISCLICK-HARDEN]
must_haves:
  truths:
    - "A clean left-click tap in node mode still places a node (zero friction)"
    - "A left-button click-drag (pointer moved > 3 px between mousedown and click) places NO node"
    - "Middle-mouse panning still works unchanged"
    - "Member-mode two-click member creation still works"
    - "A node placed outside the currently visible viewport still gets placed but raises a prominent status warning"
    - "A loose node (referenced by ZERO members) BLOCKS the solve with a red-highlighted node and an actionable status message naming the node(s) 1-based — the opaque API 'unstable/under-restrained' error is never reached"
    - "Two nodes within 0.05 m (50 mm) real-world distance WARN (highlight + named status) but DO NOT block the solve"
    - "The loose-node check runs FIRST and early-returns; the too-close warning is only surfaced when the solve is not already blocked"
    - "Both frame2d and truss2d behave identically for the above"
  artifacts:
    - path: "ui/frame2d/script.js"
      provides: "Left-button down-position tracking + global drag-threshold gate in click handler + off-canvas warning after node placement + loose-node (block) and too-close (warn) scans inside the existing validateBeforeSolve()"
    - path: "ui/truss2d/script.js"
      provides: "Mirrored drag-threshold gate + off-canvas warning + NEW offendingNodes state, NEW validateBeforeSolve() (loose-node block + too-close warn) hooked into solve(), and red-highlight of offendingNodes in drawNodes()"
  key_links:
    - from: "canvas mousedown (left button)"
      to: "canvas click handler"
      via: "recorded down position (clientX/clientY) compared against drag threshold"
      pattern: "clickDownX|_downX|button === 0"
    - from: "node placement branch (mode === 'node')"
      to: "setStatus warning"
      via: "screen-space viewport bounds test using view.scale/view.tx/view.ty and LOGICAL_W/LOGICAL_H"
      pattern: "setStatus\\("
    - from: "solve() entry"
      to: "validateBeforeSolve() loose-node + too-close scan"
      via: "incidence map over members; loose = node id absent from / empty in the map; too-close = Math.hypot(realX,realY) < 0.05"
      pattern: "validateBeforeSolve|incidence|Math.hypot"
    - from: "offendingNodes (0-based)"
      to: "red canvas highlight"
      via: "frame2d highlightNode(n, RED); truss2d red fill override in drawNodes()"
      pattern: "offendingNodes"
---

<objective>
Harden Add-Node mode in both solver UIs against accidental node placement, using the two guards the user has LOCKED:

1. **Drag-threshold guard** — a left-button click whose pointer moved more than 3 px (CSS/client pixels) between `mousedown` and `click` is treated as a drag/scrub and places nothing. Clean taps place a node as before (zero friction). Single-shot placement was explicitly rejected — the multi-node workflow is preserved.
2. **Off-canvas (place-but-warn) guard** — when a node IS placed via the node tool and it lands outside the currently visible viewport (given the active pan/zoom), still place it but raise a prominent `setStatus(msg, true)` warning so a stray off-screen node is noticed immediately instead of after Solve (the failure that wasted debug sessions 260528 / 260528-vzl).

EXTENSION (approved 2026-06-22) — a pre-solve "rogue node scan" in BOTH UIs:

3. **Loose-node scan → BLOCKS solve.** A loose/rogue node = a node in `nodes` referenced by ZERO members (absent from the incidence map, or has an empty incident-member list). This is the exact cause of the cryptic "API error: structure is unstable / under-restrained" — an orphan node contributes free DOFs with no stiffness → singular matrix. On detection: highlight the node(s) red, show an actionable `setStatus(msg, true)` naming them 1-based, and BLOCK the solve (return false), so the user never hits the opaque API error.
4. **Too-close / coincident-node scan → WARNS (does NOT block).** Any pair of nodes whose real-world distance `Math.hypot(n2.realX - n1.realX, n2.realY - n1.realY)` is below 0.05 m (50 mm): highlight both, show a named `setStatus` warning, but allow the solve to proceed.

Purpose: kill the high-frequency "accidental node on misclick" annoyance (pending todo 2026-05-23), the harder-to-diagnose "stray off-canvas node" class (memory `feedback_check_stray_offcanvas_node_first`), AND the opaque "unstable structure" API error caused by orphan/duplicate nodes.

Output: Edits to `ui/frame2d/script.js` and `ui/truss2d/script.js` only. No solver_core, no api_server, no tests, no HTML/CSS. No API/solver/Python changes — pure client-side pre-flight.
</objective>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- Both files share these exact patterns. Verified at planning time; line numbers may drift — search by symbol, not line. -->

Shared coordinate/transform model (identical in both files):
```javascript
let view = { scale: 1, tx: 0, ty: 0 };          // pan (tx/ty) + zoom (scale)
let isPanning = false, panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;

// LOGICAL_W / LOGICAL_H are the canvas's logical (CSS) width/height.
// Screen→world:
function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (LOGICAL_W / rect.width);
  const py = (clientY - rect.top)  * (LOGICAL_H / rect.height);
  return { x: (px - view.tx) / view.scale, y: (py - view.ty) / view.scale };
}
// Inverse (world→logical/screen):  screenX = worldX * view.scale + view.tx
//                                  screenY = worldY * view.scale + view.ty
// A point is inside the visible viewport iff
//   0 <= screenX <= LOGICAL_W  AND  0 <= screenY <= LOGICAL_H
```

Status channel (identical in both files):
```javascript
function setStatus(msg, isError = false) {
  const el = document.getElementById('solveStatus');
  el.textContent = msg;
  el.className = isError ? 'error' : (msg ? 'ok' : '');
}
```

Node model (identical in both files): `{ id, x, y, realX, realY }`. After `reindexNodes()`, `id` (0-based) == array index. User-facing node number is `id + 1`. `realX`/`realY` are metre coordinates; `x`/`y` are canvas-world pixels.

Node-placement branch (frame2d ~L243-257, truss2d ~L192-204 — same shape):
```javascript
canvas.addEventListener('click', e => {
  try {
  if (isPanning) return;
  let { x: px, y: py } = toWorld(e.clientX, e.clientY);
  if (mode === 'node') {
    saveHistory();
    px = Math.round(px / GRID) * GRID;   // snapped world coords
    py = Math.round(py / GRID) * GRID;
    if (origin === null) origin = { x: px, y: py };
    ...
    nodes.push({ id: nodes.length, x: px, y: py, realX, realY });
    results = null;
  } else if (mode === 'member') { ... clicks on existing nodes ... }
  ...
```

Panning mousedown (frame2d ~L3358, truss2d ~L1070): middle-button only
(`e.button === 1` in frame2d; `if (e.button !== 1) return;` in truss2d). Left button currently records nothing on mousedown — this is exactly the hook the drag-threshold guard adds.

<!-- ── ROGUE-SCAN scaffolding state (T4/T5) ── -->

frame2d ALREADY HAS the scaffolding (verified):
- Module vars `let offendingNodes = []; let offendingMembers = []; let pureBarNodeIds = [];` (~L136-138).
- `validateBeforeSolve()` (~L688) already resets these arrays, builds an incidence Map
  (`nodeId 0-based → [member array-idx]`), detects pure-bar joints + UDL-on-bar, and returns
  false to BLOCK (UDL-on-bar) or true. It is called at the top of `solve()` (~L766:
  `if (!validateBeforeSolve()) return;`).
- The incidence Map build (reuse it directly):
  ```javascript
  const incidence = new Map();
  members.forEach((m, idx) => {
    if (!incidence.has(m.start)) incidence.set(m.start, []);
    if (!incidence.has(m.end))   incidence.set(m.end,   []);
    incidence.get(m.start).push(idx);
    incidence.get(m.end).push(idx);
  });
  ```
- Red highlight already wired (~L1305): `offendingNodes.forEach(idx => { const n = nodes.find(nd => nd.id === idx); if (n) highlightNode(n, RED); });`. Pushing 0-based ids to `offendingNodes` + calling `draw()` is all that's needed to render red.

truss2d HAS NONE of the above (verified):
- NO `offendingNodes`, NO `validateBeforeSolve()`, NO diagnostic-overlay path.
- `solve()` (~L387) fetches directly after the E/A checks.
- `drawNodes()` (~L612) fills EVERY node with `cssVar('--canvas-node')` — no per-node colour override exists; the executor adds a red-fill branch for nodes whose id is in `offendingNodes`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: frame2d — both guards (drag-threshold gate + off-canvas warning)</name>
  <files>ui/frame2d/script.js</files>
  <action>
Two additive edits to ui/frame2d/script.js. Do NOT touch the solver path, save/load, or any other mode's data writes.

**(A) Left-button down-position tracking + drag-threshold gate.**

1. Near the pan-state declarations (`let isPanning = false, panStartX ...` ~L142), add module-scope vars to record where the most recent left-button press landed (in client/CSS pixels, so the 3 px threshold is a true screen distance independent of zoom):
   ```javascript
   const CLICK_DRAG_PX = 3;            // mirrors the 260523-i52 <summary> click-vs-drag threshold
   let clickDownX = null, clickDownY = null;
   ```

2. In the existing `canvas.addEventListener('mousedown', ...)` handler (the middle-mouse pan one, ~L3358), add a branch that records the down position for the LEFT button without disturbing the existing `e.button === 1` pan branch:
   ```javascript
   if (e.button === 0) { clickDownX = e.clientX; clickDownY = e.clientY; }
   ```
   Keep the `if (e.button === 1) { ... }` pan branch exactly as-is. Do not early-return before the left-button capture.

3. At the TOP of the `canvas.addEventListener('click', ...)` handler, right after the `if (isPanning) return;` line and BEFORE `toWorld(...)`, add a GLOBAL drag gate that early-returns when the pointer moved more than the threshold between mousedown and click:
   ```javascript
   if (clickDownX !== null) {
     const movedX = Math.abs(e.clientX - clickDownX);
     const movedY = Math.abs(e.clientY - clickDownY);
     clickDownX = null; clickDownY = null;   // consume — one mousedown per click
     if (movedX > CLICK_DRAG_PX || movedY > CLICK_DRAG_PX) return;  // drag/scrub → place nothing
   }
   ```
   Rationale for a GLOBAL gate (not just the node branch): it hardens every click-to-place mode (supports, loads, UDL) against the same sloppy-drag misclick, and it cannot break member mode — member mode clicks ON existing nodes, and a legitimate node tap stays well under 3 px. The `clickDownX !== null` guard lets any click without a recorded left-mousedown (synthetic/programmatic clicks) pass through unaffected. Middle-mouse pans never set clickDownX, so panning is untouched.

**(B) Off-canvas place-but-warn guard.**

Inside the `if (mode === 'node') { ... }` branch, AFTER `nodes.push(...)` and `results = null;`, add a viewport-bounds check using the snapped world coords `px`/`py` (which at that point hold the snapped values) and the inverse transform:
```javascript
const screenX = px * view.scale + view.tx;
const screenY = py * view.scale + view.ty;
if (screenX < 0 || screenX > LOGICAL_W || screenY < 0 || screenY > LOGICAL_H) {
  setStatus('Node ' + nodes.length + ' placed OFF-SCREEN (outside the visible area). Use Reset View to see it.', true);
}
```
This still PLACES the node (do not block — the user may have panned away deliberately) but flags it loudly. Use `nodes.length` (post-push count = 1-based id) so the message names the node the user can hunt for. Leave the existing `draw()` / status flow otherwise unchanged.
  </action>
  <verify>
Code inspection:
- `grep -n "CLICK_DRAG_PX\|clickDownX\|placed OFF-SCREEN" ui/frame2d/script.js` shows the new threshold const, down-position vars, and the warning string.
- Confirm the drag gate sits AFTER `if (isPanning) return;` and BEFORE `toWorld(` in the click handler, and that it early-returns (`return;`) on over-threshold movement.
- Confirm the `e.button === 1` pan branch in mousedown is byte-unchanged and the `e.button === 0` capture was added alongside it (not replacing it).
- Confirm the off-canvas test runs AFTER `nodes.push(...)` (node is placed, then warned).

Manual browser check (uvicorn running, /ui/frame2d/index.html):
1. Node mode: clean single tap → one node appears (zero friction preserved).
2. Node mode: press-move-~10px-release (left click-drag) → NO node appears.
3. Middle-mouse drag → still pans the canvas.
4. Member mode: click node A then node B → member still created.
5. Pan far so the grid origin is off-screen, then place a node where it lands outside the visible canvas → node is placed AND a red status warning naming the node appears. Reset View reveals it.
  </verify>
  <done>
Clean taps place nodes; left click-drags > 3 px place nothing; middle-mouse pan and member-mode two-click both unaffected; off-canvas node placement is allowed but raises a prominent red status warning. No changes outside ui/frame2d/script.js.
  </done>
  <note>ALREADY EXECUTED AND COMMITTED on main (commit 9e7030b). Do NOT re-touch.</note>
</task>

<task type="auto">
  <name>Task 2: truss2d — mirror both guards</name>
  <files>ui/truss2d/script.js</files>
  <action>
Apply the SAME two guards to ui/truss2d/script.js. The file shares the identical `view`/`toWorld`/`setStatus`/`isPanning` machinery and an identical node-placement branch, so the edits mirror Task 1 one-to-one. READ the truss2d handlers first and adapt to its exact line positions — do not blind-copy frame2d offsets.

**(A) Drag-threshold gate:**
1. Add `const CLICK_DRAG_PX = 3; let clickDownX = null, clickDownY = null;` near the truss2d pan-state declarations (`let isPanning = ...` ~L103).
2. In the truss2d pan `mousedown` handler (~L1070, which currently does `if (e.button !== 1) return;`): add a left-button capture that runs BEFORE that early-return, e.g. at the very top of the handler add `if (e.button === 0) { clickDownX = e.clientX; clickDownY = e.clientY; }` then leave the existing `if (e.button !== 1) return;` pan logic intact below it.
3. At the top of the truss2d `canvas.addEventListener('click', ...)` handler, after `if (isPanning) return;` and BEFORE `toWorld(...)`, add the identical consume-and-gate block.

**(B) Off-canvas warning:** inside truss2d's `if (mode === 'node') { ... }` branch, after `nodes.push(...)` and `results = null;`, add the identical screen-bounds test + `setStatus(..., true)` warning.

Truss2d differences to respect: 2 DOF/node, no beam/bar member typing, fewer modes. None of that affects these two guards.
  </action>
  <verify>
Code inspection:
- `grep -n "CLICK_DRAG_PX\|clickDownX\|placed OFF-SCREEN" ui/truss2d/script.js` shows the mirrored additions.
- Confirm the left-button capture was added without breaking the `if (e.button !== 1) return;` pan guard.
- Confirm the drag gate early-returns before `toWorld`/mode handling, and the off-canvas test runs after `nodes.push(...)`.

Manual browser check (/ui/truss2d/index.html): repeat the 5 frame2d checks.
  </verify>
  <done>
truss2d behaves identically to frame2d for all five checks. No changes outside ui/truss2d/script.js.
  </done>
  <note>ALREADY EXECUTED AND COMMITTED on main (commit 6071606). Do NOT re-touch.</note>
</task>

<task type="auto">
  <name>Task 4: frame2d — pre-solve rogue-node scan (loose blocks, too-close warns)</name>
  <files>ui/frame2d/script.js</files>
  <action>
Extend the EXISTING `validateBeforeSolve()` (~L688) in ui/frame2d/script.js. All scaffolding is already present — reuse the incidence Map it already builds, the existing `offendingNodes` array (0-based ids, already cleared at the top of the function ~L691 and already rendered as red rings via `highlightNode(n, RED)` at ~L1305), and `setStatus`. NO new module vars, NO new render code, NO API/solver changes.

**Ordering (LOCKED): loose-node check FIRST (block, early-return false). The too-close warning is only surfaced when not blocked. Do NOT aggregate multiple messages — one problem at a time is acceptable.** Place the new checks so they run on EVERY solve attempt. The existing UDL-on-bar block already early-returns false before this point; that's fine (either block message is acceptable when both conditions exist — do not over-engineer).

**(1) Loose-node scan → BLOCK.** Insert AFTER the incidence Map is built (the `members.forEach(...)` that populates `incidence`, ~L697-702) and BEFORE the existing pure-bar / UDL-on-bar logic — OR equivalently, anywhere after the incidence build but ensure it runs before `return true`. A node is loose if it is referenced by ZERO members:
```javascript
// Loose / rogue node scan (LOCKED 2026-06-22): a node referenced by ZERO
// members contributes free DOFs with no stiffness → singular matrix →
// opaque API "unstable / under-restrained". Block here with a clear message.
const loose = [];
nodes.forEach(n => {
  if (!incidence.has(n.id) || incidence.get(n.id).length === 0) loose.push(n.id);
});
if (loose.length > 0) {
  offendingNodes = loose;                       // 0-based → red rings via existing highlight
  const oneBased = loose.map(id => id + 1);
  const noun = loose.length === 1 ? 'Node' : 'Nodes';
  const verb = loose.length === 1 ? 'is' : 'are';
  setStatus(
    noun + ' ' + oneBased.join(', ') + ' ' + verb +
    ' not connected to any member — delete or connect before solving.',
    true
  );
  draw();                                        // render the red highlight
  return false;                                  // BLOCK solve
}
```

**(2) Too-close scan → WARN (no block).** Place this so it runs only when NOT blocked by a loose node (i.e. after the loose-node early-return, and it must not itself return false). Simplest: run it just before `return true;` at the end of `validateBeforeSolve()`. O(n²) pairwise over real-world metre coords, tolerance 0.05 m:
```javascript
// Too-close / coincident node scan (LOCKED 2026-06-22): warn, do NOT block.
const TOO_CLOSE_M = 0.05;   // 50 mm
const closePairs = [];
const closeIds = new Set();
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const d = Math.hypot(nodes[j].realX - nodes[i].realX, nodes[j].realY - nodes[i].realY);
    if (d < TOO_CLOSE_M) {
      closePairs.push((nodes[i].id + 1) + ' and ' + (nodes[j].id + 1));
      closeIds.add(nodes[i].id); closeIds.add(nodes[j].id);
    }
  }
}
if (closePairs.length > 0) {
  offendingNodes = Array.from(closeIds);         // highlight (warning colour = same red ring)
  setStatus(
    'Nodes ' + closePairs.join('; ') +
    ' are within 50 mm — possible duplicate; consider merging. Solving anyway.',
    false                                         // warning, NOT an error — solve proceeds
  );
  draw();
  // NO return — fall through to `return true;`
}
```
NOTE on interaction with the existing pure-bar informational `setStatus` (~L742): if a too-close warning fires, it may overwrite that pure-bar note (or vice-versa, depending on order). That is acceptable per the "one problem at a time" guidance — do not build multi-message aggregation. Ensure the too-close block sits close to `return true;` so its message is the last informational one shown when no block occurred.

Do NOT modify the UDL-on-bar or pure-bar logic, the solver payload, or any render code beyond the `draw()` calls above (the red-ring rendering for `offendingNodes` already exists).
  </action>
  <verify>
Code inspection:
- `grep -n "not connected to any member\|within 50 mm\|TOO_CLOSE_M\|Math.hypot" ui/frame2d/script.js` shows the loose-node block message, the too-close warning, the 0.05 tolerance, and the pairwise distance.
- Confirm the loose-node scan `return false`s (blocks) and sets `offendingNodes`, and that it runs after the incidence Map build.
- Confirm the too-close scan does NOT return false (falls through to `return true;`) and uses `realX`/`realY` (metres), not `x`/`y` (pixels).
- Confirm no edits outside `validateBeforeSolve()` except the existing red-highlight path is reused (no new render code).

Manual browser check (uvicorn running, /ui/frame2d/index.html):
1. Build a valid frame, then place ONE extra node connected to nothing → Solve → solve is BLOCKED, that node turns red, status names it 1-based ("Node N is not connected…"). The opaque API "unstable" error is NOT reached.
2. Connect or delete that node → Solve → proceeds normally.
3. Place two nodes within ~50 mm of each other (both connected into the structure) → Solve → a warning naming the pair appears, both nodes highlight, but the solve PROCEEDS and results render.
  </verify>
  <done>
A loose node blocks the solve with a red highlight and an actionable 1-based message (opaque API error never reached); a sub-50 mm node pair warns and highlights but the solve still completes. Loose check runs first and early-returns; too-close is warn-only. No changes outside ui/frame2d/script.js; no solver/API/Python touched.
  </done>
</task>

<task type="auto">
  <name>Task 5: truss2d — add validateBeforeSolve() with rogue-node scan (loose blocks, too-close warns)</name>
  <files>ui/truss2d/script.js</files>
  <action>
truss2d has NO scaffolding — there is no `validateBeforeSolve()`, no `offendingNodes`, no diagnostic-overlay render path. This task builds the minimal version: only the loose-node (block) + too-close (warn) checks. Do NOT copy frame2d's pure-bar / UDL-on-bar logic — truss2d has no bars/pins/UDL.

**(a) Module var.** Near the other top-level state (e.g. beside `let view = ...` ~L102 / `let isPanning ...` ~L103), add:
```javascript
let offendingNodes = [];   // 0-based node ids flagged by the pre-solve rogue scan
```

**(b) New `validateBeforeSolve()`.** Add a function (place it just above `async function solve()` ~L387). It builds an incidence map from `members` (which use `m.start`/`m.end`, 0-based node ids — confirm by reading the existing `members.map(m => [m.start + 1, m.end + 1])` payload at ~L419), runs the loose-node block then the too-close warn, mirroring T4's logic exactly:
```javascript
function validateBeforeSolve() {
  offendingNodes = [];

  // Incidence: nodeId (0-based) → count of incident members.
  const incidence = new Map();
  members.forEach(m => {
    if (!incidence.has(m.start)) incidence.set(m.start, []);
    if (!incidence.has(m.end))   incidence.set(m.end,   []);
    incidence.get(m.start).push(m);
    incidence.get(m.end).push(m);
  });

  // 1. Loose / rogue node → BLOCK (LOCKED 2026-06-22).
  const loose = [];
  nodes.forEach(n => {
    if (!incidence.has(n.id) || incidence.get(n.id).length === 0) loose.push(n.id);
  });
  if (loose.length > 0) {
    offendingNodes = loose;
    const oneBased = loose.map(id => id + 1);
    const noun = loose.length === 1 ? 'Node' : 'Nodes';
    const verb = loose.length === 1 ? 'is' : 'are';
    setStatus(
      noun + ' ' + oneBased.join(', ') + ' ' + verb +
      ' not connected to any member — delete or connect before solving.',
      true
    );
    draw();
    return false;   // BLOCK
  }

  // 2. Too-close / coincident → WARN, do NOT block (LOCKED 2026-06-22).
  const TOO_CLOSE_M = 0.05;   // 50 mm
  const closePairs = [];
  const closeIds = new Set();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[j].realX - nodes[i].realX, nodes[j].realY - nodes[i].realY);
      if (d < TOO_CLOSE_M) {
        closePairs.push((nodes[i].id + 1) + ' and ' + (nodes[j].id + 1));
        closeIds.add(nodes[i].id); closeIds.add(nodes[j].id);
      }
    }
  }
  if (closePairs.length > 0) {
    offendingNodes = Array.from(closeIds);
    setStatus(
      'Nodes ' + closePairs.join('; ') +
      ' are within 50 mm — possible duplicate; consider merging. Solving anyway.',
      false
    );
    draw();
  }

  return true;
}
```

**(c) Hook into `solve()`.** In `solve()` (~L387), AFTER the existing guards (the `< 2 nodes` / `< 1 member` / `< 1 support` checks and the E/A `parseFloat` validation, ~L388-395) and BEFORE building the payload (~L416), add:
```javascript
if (!validateBeforeSolve()) return;
```

**(d) Red-highlight `offendingNodes` in the node render path.** truss2d's `drawNodes()` (~L612) fills every node with `cssVar('--canvas-node')` and has NO per-node colour override. Add a red override for offending nodes. Inside the `nodes.forEach(n => { ... })` loop, replace the unconditional fill with a conditional:
```javascript
ctx.fillStyle = offendingNodes.includes(n.id) ? '#e53935' : cssVar('--canvas-node');
```
Use the same red literal the project uses elsewhere if one is defined (check for a `RED` const or a `--canvas-*` error colour; frame2d uses a `RED` constant — if truss2d has no equivalent, the `#e53935` literal is acceptable and matches the warning intent). Keep the rest of `drawNodes()` (radius, node-id labels) unchanged.

Reset `offendingNodes` on a fresh successful solve if truss2d clears other transient state there (optional — `validateBeforeSolve()` already resets it at the top of every attempt, so stale highlights clear on the next Solve regardless). Do NOT touch the truss2d solver payload, save/load, or member logic.
  </action>
  <verify>
Code inspection:
- `grep -n "validateBeforeSolve\|offendingNodes\|not connected to any member\|within 50 mm\|TOO_CLOSE_M" ui/truss2d/script.js` shows the new function, the module var, the block + warn messages, and the tolerance.
- Confirm `if (!validateBeforeSolve()) return;` sits in `solve()` after the count/E/A guards and before the payload build / fetch.
- Confirm `drawNodes()` fills offending nodes red and all others with the normal node colour.
- Confirm the too-close scan uses `realX`/`realY` (metres) and does NOT return false; the loose scan returns false.
- Confirm NO pure-bar / UDL-on-bar logic was copied from frame2d.

Manual browser check (/ui/truss2d/index.html):
1. Build a valid truss, place ONE extra unconnected node → Solve → BLOCKED, node turns red, status names it 1-based, opaque API "unstable" error not reached.
2. Connect/delete it → Solve → proceeds.
3. Place two nodes within ~50 mm (both connected) → Solve → warning names the pair, both highlight, solve still completes and results render.
  </verify>
  <done>
truss2d gains a `validateBeforeSolve()` that blocks on loose nodes (red highlight + actionable 1-based message, opaque API error never reached) and warns on sub-50 mm pairs without blocking; `solve()` calls it before fetching; `drawNodes()` renders offending nodes red. Behaviour matches frame2d's rogue scan. No changes outside ui/truss2d/script.js; no solver/API/Python touched.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
Both guards AND the new rogue-node scan in both UIs:
1. Left-button drag-threshold gate (>3 px move between mousedown and click suppresses the click). [T1/T2 — already committed]
2. Off-canvas place-but-warn for nodes placed outside the visible viewport. [T1/T2 — already committed]
3. Pre-solve loose-node scan that BLOCKS the solve (red highlight + actionable named message) when a node is connected to zero members. [T4 frame2d, T5 truss2d]
4. Pre-solve too-close scan that WARNS (highlight + named message) but lets the solve proceed when two nodes are within 50 mm. [T4 frame2d, T5 truss2d]
Frame2d and truss2d are mirrored.
  </what-built>
  <how-to-verify>
Start the API server (`uvicorn api_server.app:app --reload` from pda_project/), then for EACH UI
(`http://127.0.0.1:8000/ui/frame2d/index.html` and `.../ui/truss2d/index.html`):

Misclick guards (already committed — sanity re-check):
  1. Add Node → clean single tap → exactly one node appears (no added friction).
  2. Add Node → press, drag ~10 px, release → NO node appears.
  3. Middle-mouse-button drag → canvas pans normally.
  4. Member mode → click node A, click node B → member created.
  5. Pan until the origin is off-screen, Add Node so it lands outside the visible canvas → node IS placed and a red status warning names it; Reset View reveals it.

Rogue-node scan (NEW — primary focus):
  6. Build a valid, solvable structure, then add ONE extra node connected to nothing → Solve →
     the solve is BLOCKED, that node turns red, and the status names it 1-based
     ("Node N is not connected to any member — delete or connect before solving."). The opaque
     API "unstable / under-restrained" error must NOT appear.
  7. Delete or connect that loose node → Solve → proceeds and results render normally.
  8. Place two nodes within ~50 mm of each other (both wired into the structure) → Solve →
     a warning names the pair ("Nodes X and Y are within 50 mm…"), both nodes highlight, and the
     solve PROCEEDS to results (NOT blocked).

Confirm both UIs pass all eight.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any guard that misbehaves (e.g. clean taps swallowed, pan breaking, off-canvas warning not firing, a loose node NOT blocking, or a too-close pair wrongly blocking the solve).</resume-signal>
</task>

</tasks>

<verification>
- `grep -n "CLICK_DRAG_PX\|clickDownX\|placed OFF-SCREEN" ui/frame2d/script.js ui/truss2d/script.js` returns matching additions in both files.
- `grep -n "not connected to any member\|within 50 mm\|validateBeforeSolve\|offendingNodes" ui/frame2d/script.js ui/truss2d/script.js` returns the rogue-scan logic in both files (frame2d extends the existing function; truss2d defines a new one).
- No diff outside the two UI script files: `git diff --name-only` lists only `ui/frame2d/script.js` and `ui/truss2d/script.js`.
- pytest still green (no Python touched): `pytest -q` (sanity; should be unchanged from baseline).
</verification>

<success_criteria>
- Clean left-click taps in node mode place a node with zero added friction (multi-node workflow preserved).
- Left-button click-drags moving > 3 px (client px) place no node, in both UIs.
- Middle-mouse panning and member-mode two-click creation are unaffected in both UIs.
- A node placed outside the visible viewport is still placed but triggers a prominent red `setStatus` warning naming the node.
- A loose node (zero incident members) BLOCKS the solve in both UIs, highlights red, and shows an actionable 1-based message — the opaque API "unstable / under-restrained" error is never reached.
- A node pair within 50 mm WARNS (highlight + named message) in both UIs but the solve still proceeds.
- The loose-node check runs first and early-returns; the too-close check is warn-only.
- Scope contract held: only `ui/frame2d/script.js` and `ui/truss2d/script.js` changed. No HTML/CSS/Python/API.
</success_criteria>

<output>
After completion, create `.planning/quick/260622-rcm-frame2d-truss2d-add-node-misclick-harden/260622-rcm-SUMMARY.md`
</output>
</content>
</invoke>
