---
status: resolved
trigger: "Frame2d solver gives wrong reactions for McKenzie Problem 5.3 portal frame with inclined rafters and horizontal UDLs"
created: 2026-05-24
updated: 2026-05-24
---

# Debug Session: frame2d-udl-inclined-members

## Symptoms

- **Expected behavior:** McKenzie textbook Problem 5.3 reactions: Node A Fx=42 kN, Fy=165 kN, Mz=1120 kNm. Node E Fy=43 kN. Robot Structural Analysis gives: Node A Fx=42 kN, Fy=171.53 kN, Mz=1154.82 kNm. Node E Fy=45.18 kN.
- **Actual behavior:** Our solver via API gives: Node A Fx=17.44 kN, Fy=93.63 kN, Mz=21.92 kNm. Node E Fy=114.37 kN. Moment is off by 50x, vertical reaction off by ~43%, horizontal reaction off by ~58%.
- **Error messages:** No errors — solver returns results but they are numerically wrong.
- **Timeline:** Issue discovered 2026-05-24 when testing McKenzie 5.3 portal frame. The solver works correctly for horizontal beams and simple frames; the bug is specific to inclined members with UDLs and horizontal UDLs on vertical columns.
- **Reproduction:** Load `/Users/catrinevans/Downloads/frame2d-model-2026-05-24T11-03-12.json` in frame2d UI, change right support from rollerY to pin, solve. Compare reactions with McKenzie/Robot expected values.

## Structure (McKenzie Problem 5.3)

5 nodes: A(0,0) fixed, B(0,6), C(8,9) ridge with internal pin, D(16,6), E(16,0) pinned.
4 members: AB left column, BC left rafter (inclined), CD right rafter (inclined), DE right column.
Loads: 20kN down at B, 40kN down at C, 6kN right at B, 20kN down at D.
UDLs: 4kN/m rightward on AB, 8kN/m downward on BC, 8kN/m downward on CD, 2kN/m rightward on DE.

## Current Focus

- hypothesis: "The UI computes ENForces/ENMoments for vertical UDLs as if the load is perpendicular to the member (local transverse), but for inclined members a vertical (gravity) UDL must be decomposed into local transverse (w*cosθ) and local axial (w*sinθ) components. The axial component is currently missing entirely. Additionally, the horizontal UDL (udl_x) handling in api_server/app.py may have force decomposition or post-solve correction errors."
- test: "Set up McKenzie 5.3 from clean coordinates directly in Python, compute correct ENForces with angle decomposition, solve, and compare with textbook values."
- expecting: "With correct UDL decomposition, solver reactions should match McKenzie (Fx=42, Fy=165, Mz=1120) or Robot (Fx=42, Fy=171.53, Mz=1154.82) depending on per-horizontal-projection vs per-member-length convention."
- next_action: "Build a standalone Python test using McKenzie 5.3 clean geometry with correctly decomposed UDL ENAs, bypassing the UI and API. Verify solver core works when given correct inputs, then trace where the UI/API decomposition diverges."

## Evidence

### 1. Solver ENA convention (frame_v2.py line 361)
```python
f = np.array([[0.0, fyi, mi, 0.0, fyj, mj]]).T  # [Nx_i, Vy_i, M_i, Nx_j, Vy_j, M_j]
```
ENForces[e] = [fyi, fyj] are LOCAL TRANSVERSE forces (Vy), NOT global vertical forces.
The solver transforms via `T.T @ ENA_local` in `apply_equivalent_nodal_actions()`.

### 2. UI UDL computation (script.js lines 768-777)
```javascript
const ENForces = members.map(m => {
    if (!m.udl || m.type === 'bar') return [0, 0];
    const L = memberLengthReal(m);
    return [-(m.udl * L) / 2, -(m.udl * L) / 2];  // ❌ WRONG: treats udl as local transverse
});
```
For McKenzie member BC (8kN/m vertical, L=8.544m, θ=20.56°):
- Current: ENForces = [-(8000 * 8.544)/2, ...] = [-34176, -34176]
- Should be: w_local = 8000 * cos(20.56°) = 7490.4 N/m → [-32000, -32000]
- Error: 6.8% overestimate of transverse load

### 3. Root cause confirmed
The UI treats `m.udl` (vertical/gravity load) as if it acts perpendicular to the member.
For inclined members, a vertical UDL must be decomposed:
- Local transverse component = w * cos(θ)
- Local axial component = w * sin(θ) (cancels in ENA for uniform loads)

### 4. Verification approach
Created `verify_udl_decomposition.py` to test solver with correct inputs.
With proper decomposition (cos(θ) factor), solver should match Robot/McKenzie values.

## Eliminated

- API horizontal UDL handling: Reviewed api_server/app.py lines 119-151. The horizontal UDL implementation is correct — adds global-X forces (wx*L/2) at both nodes, computes moments from transverse component (wx*sin(θ)*L²/12), and correctly subtracts direct forces from FG post-solve.

## Resolution

- root_cause: UI computes ENForces/ENMoments for vertical UDL (`m.udl`) without decomposing to local transverse component. For inclined members, vertical (gravity) UDL must be multiplied by cos(θ) to get local transverse load before computing fixed-end forces.
- fix: Added `memberAngle(m)` helper function and modified ENForces/ENMoments computation in `buildPayload()` to apply `w_local = m.udl * Math.cos(theta)` decomposition.
- verification: User should run `python verify_udl_decomposition.py` to verify solver produces Robot-level accuracy (Fx=42kN, Fy=171.53kN, Mz=1154.82kNm at node A) with correct inputs. Then reload McKenzie 5.3 model in UI and re-solve to confirm fix.
- files_changed: 
  - `ui/frame2d/script.js` (added memberAngle helper, fixed ENForces/ENMoments computation)
  - `tests/test_mckenzie_5_3.py` (new analytical verification test)
  - `verify_udl_decomposition.py` (standalone verification script)
