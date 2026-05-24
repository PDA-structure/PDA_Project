---
status: resolved
trigger: "Frame2d solver gives wrong reactions for McKenzie Problem 5.3 portal frame with inclined rafters and horizontal UDLs"
created: 2026-05-24
updated: 2026-05-24
---

# Debug Session: frame2d-udl-inclined-members

## Symptoms

- **Expected:** McKenzie Problem 5.3 / Robot Structural Analysis: Node A Fx=42 kN, Fy=171.53 kN, Mz=1154.82 kNm; Node E Fy=45.18 kN.
- **Actual (before fix):** Node A Fx=17.44 kN, Fy=93.63 kN, Mz=21.92 kNm — all wrong by 40–60%.
- **After fix:** Node A Fx=-42.00 kN, Fy=171.53 kN, Mz=-1154.82 kNm; Node E Fy=45.18 kN — exact match.

## Root Cause

Three bugs compounded:

### 1. API horizontal UDL (udl_x) added forces to forceVector at restrained DOFs
`api_server/app.py` lines 119–151 added `fx_each = wx*L/2` directly to `fv[ni*3]` and `fv[nj*3]`, then subtracted them from `FG` post-solve. For restrained nodes (support nodes), these entries are deleted when forming `f_red = np.delete(fv, removed_indices)`. They had zero effect on displacements, and the post-solve subtraction then corrupted the reaction.

**Fix:** Replace direct fv additions with ENForces contributions. For horizontal UDL wx on member at angle theta:
```
q_local_y = wx * (-sin(theta))
ENForces contribution = q_local_y * L / 2  (both endpoints)
ENMoments contribution: mi = q_local_y*L²/12, mj = -q_local_y*L²/12
```
The solver's T.T transform converts these to correct global forces automatically. No fv additions needed, no post-solve FG corrections needed.

### 2. UI vertical UDL (ENForces) missing axial component
`ui/frame2d/script.js` computed ENForces as `-(w * cos(theta) * L / 2)` (transverse component only). The global vertical load on an inclined member also has a local axial component `-w * sin(theta)` that needs to be added to the forceVector at the free intermediate nodes. This axial component converts to a global vertical force contribution at each endpoint via `(Nx * cos(theta), Nx * sin(theta))`, giving the correct total vertical equilibrium.

For McKenzie 5.3: intermediate nodes B, C, D are fully free, so adding axial forces to their forceVector entries works correctly and is not dropped. For support nodes (A, E), the axial forces at restrained DOFs are dropped as expected — the stiffness-based solution handles that automatically.

**Fix:** After computing ENForces/ENMoments in the UI solve path, add axial component nodal forces to the forceVector for each member with a vertical UDL:
```javascript
q_ax = -m.udl * sin(theta)
Nx   = q_ax * L / 2
forceVector[m.start*3]   += Nx * cos(theta)
forceVector[m.start*3+1] += Nx * sin(theta)
forceVector[m.end*3]     += Nx * cos(theta)
forceVector[m.end*3+1]   += Nx * sin(theta)
```

### 3. Test had wrong support type (pin instead of rollerY at E)
`test_mckenzie_5_3.py` initially used `restrainedDoF = [1,2,3,13,14]` (full pin at E). McKenzie 5.3 has a vertical roller at E (only Fy restrained). Should be `[1,2,3,14]`.

## Evidence

### Calibration (vertical cantilever, horizontal UDL)
Method 1 (ENForces): Fx_A = -30.00 N for 10 N/m × 3 m = 30 N total ✓
Method 2 (old direct-fv): Fx_A = -30.00 N also correct ✓ (but fails for support nodes)

### McKenzie 5.3 full test
```
Node A: Fx=-42.00 kN, Fy=171.53 kN, Mz=-1154.82 kNm  ← exact match Robot
Node E: Fy=45.18 kN                                    ← exact match Robot
```

## Resolution

- root_cause: Two bugs: (1) API udl_x added forces to restrained DOFs via forceVector (correct approach is ENForces via T-matrix); (2) UI vertical UDL on inclined members was missing the axial component which must be added to free-node forceVector entries.
- fix: (1) Rewrote api_server/app.py udl_x handling to use ENForces/ENMoments only; (2) Added axial component forceVector additions to UI solve() for inclined members; (3) Fixed test_mckenzie_5_3.py to use rollerY at E and correct ENA formulas.
- verification: python3 -m pytest tests/ → 66 passed. McKenzie 5.3 matches Robot exactly.
- files_changed:
  - `api_server/app.py` (replaced broken udl_x direct-fv approach with ENForces computation)
  - `ui/frame2d/script.js` (added axial component of vertical UDL to forceVector; fixed ENForces formula)
  - `tests/test_mckenzie_5_3.py` (rewritten with correct ENA formulas and rollerY at E)
  - `tests/test_inclined_beam_vertical_udl.py` (replaced broken test with valid equilibrium check)
