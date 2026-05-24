# Debug Summary: UDL on Inclined Members

## Issue
Frame2d solver gave incorrect reactions for McKenzie Problem 5.3 (portal frame with inclined rafters and vertical UDLs). Reactions were off by 43-58%, with moment off by 50x.

## Root Cause
The UI computed ENForces/ENMoments for vertical UDL (`m.udl`) without decomposing to local member coordinates. For inclined members, a **vertical (gravity) UDL** must be decomposed:

- **Local transverse component** = w × cos(θ)  
- **Local axial component** = w × sin(θ) (cancels in ENA for uniform loads)

The solver expects `ENForces` as **local transverse forces** (perpendicular to member), not global vertical forces.

### Example (McKenzie member BC)
- Member: 8 kN/m vertical UDL, L=8.544m, θ=20.56°
- **Before fix**: ENForces = [-(8000 × 8.544)/2, ...] = [-34176, -34176]  
  ❌ Incorrect — treats full vertical load as local transverse
- **After fix**: w_local = 8000 × cos(20.56°) = 7490.4 N/m  
  ENForces = [-(7490.4 × 8.544)/2, ...] = [-32000, -32000]  
  ✅ Correct — decomposes vertical to local transverse

## Fix Applied
**File**: `ui/frame2d/script.js`

1. Added `memberAngle(m)` helper function
2. Modified ENForces computation to apply cos(θ) decomposition:
   ```javascript
   const theta = memberAngle(m);
   const w_local = m.udl * Math.cos(theta);  // vertical UDL → local transverse
   return [-(w_local * L) / 2, -(w_local * L) / 2];
   ```
3. Same decomposition applied to ENMoments

## Verification

### Run standalone Python test
```bash
python verify_udl_decomposition.py
```
Expected output: Node A reactions should match Robot values (Fx=42kN, Fy=171.53kN, Mz=1154.82kNm).

### Test in UI
1. Open frame2d UI in browser
2. Load `/Users/catrinevans/Downloads/frame2d-model-2026-05-24T11-03-12.json`
3. Change node E (right) support from rollerY to pin
4. Solve
5. Compare Node A reactions with expected values

### Automated test
```bash
python -m pytest tests/test_mckenzie_5_3.py -v
```

## Files Changed
- `ui/frame2d/script.js` — added memberAngle helper, fixed ENForces/ENMoments
- `tests/test_mckenzie_5_3.py` — new analytical verification test
- `verify_udl_decomposition.py` — standalone verification script
- `.planning/debug/frame2d-udl-inclined-members.md` — debug session log

## Notes
- API horizontal UDL handling (api_server/app.py) is correct — no changes needed
- Truss2d UI does not have UDL functionality — no similar issue there
- This fix is critical for any structure with inclined members and gravity loads (portal frames, pitched roofs, etc.)
