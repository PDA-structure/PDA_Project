---
phase: quick
plan: 260413-rlh
type: execute
wave: 1
depends_on: []
files_modified:
  - api_server/app.py
  - ui/frame2d/script.js
  - ui/frame2d/index.html
autonomous: true
requirements: []
must_haves:
  truths:
    - "User can click a member in UDL mode and enter a horizontal UDL (w_x) alongside the existing vertical UDL"
    - "Positive w_x acts left-to-right globally — a vertical column under positive w_x bends to the right"
    - "Equivalent nodal forces (-w_x*L/2 each end) and fixed-end moments (+w_x*L²/12 start, -w_x*L²/12 end) reach the solver"
    - "w_x is visible on canvas as horizontal arrows on the member"
    - "Solver produces correct results for a cantilever column with horizontal UDL"
  artifacts:
    - path: api_server/app.py
      provides: "udl_x optional field on Frame2DRequest; merged into ENForces X-DOF and ENMoments in solve_frame2d"
    - path: ui/frame2d/script.js
      provides: "udl_x per-member store; ENForces/ENMoments combined; drawUDLs renders horizontal arrows; payload includes udl_x"
    - path: ui/frame2d/index.html
      provides: "Horizontal UDL (kN/m) input label in UDL button tooltip (no HTML change needed; see notes)"
  key_links:
    - from: ui/frame2d/script.js (ENForces build)
      to: api_server/app.py (ENForces field)
      via: "fetch payload ENForces array — X-direction contributions added to existing Y-direction"
    - from: api_server/app.py
      to: solver_core FrameModel2D
      via: "ENForces numpy array row 0 = X, row 1 = Y — horizontal UDL adds to row 0"
---

<objective>
Add horizontal UDL (w_x) support to the frame2d solver stack: UI prompt, canvas rendering, API field, and force vector assembly.

Purpose: Engineers modelling wind-loaded columns or horizontal distributed loads (e.g. soil pressure on walls) need per-member horizontal UDL in addition to the existing vertical UDL.
Output: Clicking a member in UDL mode now prompts for both w_y (vertical, existing) and w_x (horizontal, new). The solver receives combined ENForces and ENMoments correctly.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Key patterns extracted from codebase. Executor should use these directly. -->

From ui/frame2d/script.js — member object shape:
```js
// Line 85-96: member push
{
  id, start, end,
  type: 'beam'|'bar',
  pinLeft: false, pinRight: false,
  udl: null,           // existing vertical UDL (N/m, + = downward)
  // ADD: udl_x: null  // horizontal UDL (N/m, + = left-to-right)
  E_override: null, I_override: null, A_override: null
}
```

From ui/frame2d/script.js — existing UDL prompt block (lines 128-140):
```js
} else if (mode === 'udl') {
  const mi = findMemberAt(px, py);
  if (mi !== null) {
    const m = members[mi];
    const current = m.udl !== null ? m.udl : '';
    const mag = parseFloat(prompt('UDL magnitude in N/m (positive = downward):', current || '10000'));
    if (!isNaN(mag)) {
      saveHistory();
      members[mi].udl = mag;
      results = null;
    }
  }
```

From ui/frame2d/script.js — ENForces/ENMoments build (lines 363-373):
```js
// ENForces [Fy_start, Fy_end] — vertical only today
const ENForces  = members.map(m => {
  if (!m.udl || m.type === 'bar') return [0, 0];
  const L = memberLengthReal(m);
  return [-(m.udl * L) / 2, -(m.udl * L) / 2];
});
const ENMoments = members.map(m => {
  if (!m.udl || m.type === 'bar') return [0, 0];
  const w = m.udl, L = memberLengthReal(m);
  return [w * L * L / 12, -(w * L * L) / 12];
});
```

From api_server/app.py — Frame2DRequest (lines 43-66):
```python
class Frame2DRequest(BaseModel):
    ENForces: List[List[float]]   # shape (n_members, 2) — [Fy_start, Fy_end]
    ENMoments: List[List[float]]  # shape (n_members, 2) — [M_start, M_end]
    forceVector: List[float]      # flat, length = 3*n_nodes
    # ... other fields
```

From api_server/app.py — solve_frame2d builds FrameModel2D (lines 69-91):
```python
model = FrameModel2D(
    ENForces=np.array(req.ENForces, float),
    ENMoments=np.array(req.ENMoments, float),
    forceVector=np.array(req.forceVector, float).reshape(-1, 1),
    ...
)
```

From frame_adapters.py — adapter passes ENForces/ENMoments directly to BeamBarStructure_v2.
The solver (frame_v2.py) uses ENForces to populate the Y-DOF of the force vector, and ENMoments
for the rotational DOF. It does NOT have a separate ENForces_x field — the horizontal contribution
must be merged into ENForces before reaching the model.

IMPORTANT: ENForces shape is (n_members, 2) — one pair per member. The solver interprets row[i]
as [force_at_start_node_Y, force_at_end_node_Y]. Horizontal UDL contributes to the X-DOF of the
force vector, NOT through ENForces. See Task 1 action for the correct approach.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add udl_x to API and assemble force contributions server-side</name>
  <files>api_server/app.py</files>
  <action>
**Understanding the force assembly path first (read before editing):**

The frame_v2 solver assembles the global force vector from three sources:
1. `forceVector` (direct nodal loads) — 3*n_nodes flat array
2. `ENForces` — equivalent nodal Y-forces from UDL, shape (n_members, 2): [Fy_start, Fy_end]
3. `ENMoments` — equivalent nodal moments from UDL, shape (n_members, 2): [M_start, M_end]

ENForces feeds the Y-DOF; there is no ENForces_x in the model or solver. The correct approach for
horizontal UDL is: compute the X-DOF equivalent nodal forces and add them directly into `forceVector`
before the model is built. The fixed-end moments from horizontal UDL are identical in structure to
vertical UDL moments and belong in ENMoments (summed with any vertical UDL contribution).

**Changes to api_server/app.py:**

1. Add optional field to `Frame2DRequest`:
```python
udl_x: Optional[List[float]] = None   # one value per member, N/m, positive = left-to-right
```

2. In `solve_frame2d`, before building FrameModel2D, compute the horizontal UDL contributions
   and merge them into `forceVector` and `ENMoments`:

```python
# --- Horizontal UDL (w_x) assembly ---
# w_x contributes:
#   X-DOF nodal forces: -w_x*L/2 at start node, -w_x*L/2 at end node
#   Fixed-end moments: +w_x*L^2/12 at start, -w_x*L^2/12 at end
#   (same sign convention as vertical UDL moments)
fv = list(req.forceVector)          # mutable copy (flat, length = 3*n_nodes)
en_moments = [list(row) for row in req.ENMoments]  # mutable copy

if req.udl_x:
    nodes_arr = req.nodes           # list of [x,y]
    for ei, wx in enumerate(req.udl_x):
        if wx == 0.0:
            continue
        ni, nj = req.members[ei][0] - 1, req.members[ei][1] - 1   # 0-based node indices
        xi, yi = nodes_arr[ni]
        xj, yj = nodes_arr[nj]
        L = ((xj-xi)**2 + (yj-yi)**2) ** 0.5
        if L == 0:
            continue
        # X-DOF: global indices base = node_idx * 3 + 0 (0-based)
        fv[ni * 3 + 0] += -wx * L / 2
        fv[nj * 3 + 0] += -wx * L / 2
        # Moments (same DOF index [base+2] as vertical UDL):
        en_moments[ei][0] += wx * L * L / 12
        en_moments[ei][1] += -wx * L * L / 12
```

3. Build FrameModel2D using the updated `fv` and `en_moments`:
```python
forceVector=np.array(fv, float).reshape(-1, 1),
ENMoments=np.array(en_moments, float),
```
   Leave `ENForces` unchanged (it still carries only the vertical UDL Y-forces from the UI).

NOTE: `req.members` values are 1-based node indices (the UI sends 1-based). Subtract 1 for
0-based array indexing when computing node positions.
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && python -c "
from fastapi.testclient import TestClient
from api_server.app import app
c = TestClient(app)

# Vertical column: 2 nodes, 1 member, fixed at base, w_x = 1000 N/m, L = 3m
# Expected: Ux at top != 0, fixed-end moments = +/-1000*9/12 = +/-750 Nm
payload = {
    'nodes': [[0,0],[0,3]],
    'members': [[1,2]],
    'ENForces': [[0,0]],
    'ENMoments': [[0,0]],
    'forceVector': [0,0,0, 0,0,0],
    'E': 200e9, 'I': 1e-4, 'A': 1e-2,
    'restrainedDoF': [1,2,3],
    'udl_x': [1000.0]
}
r = c.post('/solve/frame2d', json=payload)
print('status:', r.status_code)
d = r.json()
UG = d['UG']
print('UG (Ux_top, Uy_top, theta_top):', UG[3], UG[4], UG[5])
assert r.status_code == 200, 'non-200 response'
assert abs(UG[3]) > 1e-10, 'Ux_top should be nonzero for horizontal UDL'
print('PASS: horizontal UDL produces nonzero horizontal displacement')
"
</automated>
  </verify>
  <done>POST /solve/frame2d with udl_x=[1000.0] on a 3m vertical column produces nonzero Ux at free end. Status 200. Missing udl_x field is backward-compatible (defaults to None, no change in behaviour).</done>
</task>

<task type="auto">
  <name>Task 2: Add udl_x to UI — prompt, storage, ENForces payload, canvas rendering</name>
  <files>ui/frame2d/script.js, ui/frame2d/index.html</files>
  <action>
**Four sub-changes in script.js:**

**A. Initialise udl_x on member creation (line ~92, inside the members.push({...}) block):**
Add `udl_x: null` alongside `udl: null`.

**B. Update the UDL prompt block (lines 128-140):**
Replace the single-prompt block with a two-prompt sequence:
```js
} else if (mode === 'udl') {
  const mi = findMemberAt(px, py);
  if (mi !== null) {
    const m = members[mi];
    const magY = parseFloat(prompt(
      'Vertical UDL w_y (N/m, positive = downward):', m.udl !== null ? m.udl : '10000'));
    if (!isNaN(magY)) {
      saveHistory();
      members[mi].udl = magY;
      results = null;
    }
    const magX = parseFloat(prompt(
      'Horizontal UDL w_x (N/m, positive = left-to-right, 0 to clear):', m.udl_x !== null ? m.udl_x : '0'));
    if (!isNaN(magX)) {
      members[mi].udl_x = magX === 0 ? null : magX;
      results = null;
    }
  }
```
Note: saveHistory() is only called once (before the first prompt) to keep undo atomic.

**C. Update the ENForces / ENMoments build in solve() (lines 363-373):**
The UI continues to send ENForces as vertical-only (the API handles horizontal contributions
server-side via udl_x). ENMoments also stays vertical-only on the client side. Simply add
`udl_x` to the payload:
```js
const payload = {
  ...                          // all existing fields unchanged
  udl_x: members.map(m => m.udl_x !== null ? m.udl_x : 0),
};
```
Add this inside the payload object alongside `ENForces`, `ENMoments`, etc.

**D. Update drawUDLs() to render horizontal arrows for w_x:**
After the existing vertical UDL rendering block, add rendering for horizontal UDL. Horizontal
arrows point left/right from the member. Use a different colour to distinguish (e.g. `#0288d1`
blue vs existing `#7b1fa2` purple for vertical).

```js
// In drawUDLs(), after the forEach for vertical UDL (m.udl), add a second forEach:
members.forEach(m => {
  if (!m.udl_x) return;
  const n1 = nodes.find(n => n.id === m.start);
  const n2 = nodes.find(n => n.id === m.end);
  if (!n1 || !n2) return;

  const arrowLen = 20;
  const sign = m.udl_x > 0 ? 1 : -1;  // positive = rightward on canvas

  // dx, dy along member direction (unit vector)
  const dx = n2.x - n1.x, dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx/len, uy = dy/len;
  // perpendicular (90° CCW): (-uy, ux)
  const px = -uy, py2 = ux;

  const steps = Math.max(2, Math.floor(len / 22));
  ctx.strokeStyle = '#0288d1'; ctx.fillStyle = '#0288d1'; ctx.lineWidth = 1.5;

  // baseline line offset perpendicular to member
  ctx.beginPath();
  ctx.moveTo(n1.x + px * arrowLen * sign, n1.y + py2 * arrowLen * sign);
  ctx.lineTo(n2.x + px * arrowLen * sign, n2.y + py2 * arrowLen * sign);
  ctx.stroke();

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ax = n1.x + t*(n2.x - n1.x);
    const ay = n1.y + t*(n2.y - n1.y);
    ctx.beginPath();
    ctx.moveTo(ax + px * arrowLen * sign, ay + py2 * arrowLen * sign);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax + px * 8 * sign, ay + py2 * 8 * sign);
    ctx.lineTo(ax, ay);
    ctx.lineTo(ax - ux*4, ay - uy*4);
    ctx.fill();
  }

  const mx = (n1.x + n2.x) / 2;
  const my = (n1.y + n2.y) / 2;
  ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#01579b';
  ctx.fillText((Math.abs(m.udl_x)/1000).toFixed(1)+' kN/m', mx + px*arrowLen*sign*1.5, my + py2*arrowLen*sign*1.5);
});
```

**index.html:** No structural change required. The UDL button tooltip can optionally be updated to mention both axes:
- Line 58: change title to `"Apply uniform distributed load to a member (vertical and/or horizontal)"`.
This is a one-line change.

**Undo compatibility:** The `udl_x: null` field is added in members.push, so saveHistory()/restoreHistory() automatically capture it (they JSON-serialise the full members array).
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project && node -e "
// Static check: verify udl_x field and payload key exist in script.js
const fs = require('fs');
const src = fs.readFileSync('ui/frame2d/script.js', 'utf8');
const checks = [
  ['udl_x: null', 'member initialisation'],
  ['udl_x', 'payload field'],
  ['Horizontal UDL', 'horizontal prompt text'],
  ['0288d1', 'horizontal arrow colour'],
];
let pass = true;
checks.forEach(([needle, desc]) => {
  if (!src.includes(needle)) { console.error('MISSING:', desc, '('+needle+')'); pass = false; }
  else console.log('OK:', desc);
});
process.exit(pass ? 0 : 1);
"
</automated>
  </verify>
  <done>
- members.push includes udl_x: null
- UDL canvas click prompts for w_y then w_x
- solve() payload includes udl_x array
- drawUDLs renders horizontal arrows (blue) for members with udl_x != null
- index.html UDL button tooltip updated
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → API | udl_x values are user-supplied floats; malformed or extreme values cross here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rlh-01 | Tampering | Frame2DRequest.udl_x | accept | udl_x is Optional[List[float]]; Pydantic validates types; extreme float values (e.g. 1e20) are engineering user error, not a security concern — solver will return large but valid displacements |
| T-rlh-02 | Denial of Service | solve_frame2d udl_x loop | accept | Loop bounded by len(req.members) which is already bounded by the existing members/nodes lists — no new DoS surface |
</threat_model>

<verification>
1. API backward-compat: POST /solve/frame2d without udl_x field returns same result as before (None default, no code path taken).
2. Cantilever column test: 3m vertical column, fixed base, w_x = 1000 N/m → Ux at top ≈ wL⁴/(8EI). With E=200e9, I=1e-4, L=3: Ux = 1000*81/(8*200e9*1e-4) = 5.0625e-4 m = 0.506 mm. Verify with the python one-liner in Task 1.
3. Canvas: member with udl_x renders blue horizontal arrows perpendicular to member direction.
4. Vertical UDL (w_y) still works unchanged after Task 2 edits.
</verification>

<success_criteria>
- Horizontal UDL w_x reaches the solver and produces physically correct displacements
- Existing vertical UDL behaviour is unaffected
- UI prompts for both w_y and w_x when clicking a member in UDL mode
- Canvas displays blue horizontal arrows for members with w_x != 0
- API is backward-compatible (old clients omitting udl_x get identical results)
</success_criteria>

<output>
After completion, create `.planning/quick/260413-rlh-add-horizontal-udl-support-to-frame2d/260413-rlh-SUMMARY.md` using the summary template.
</output>
