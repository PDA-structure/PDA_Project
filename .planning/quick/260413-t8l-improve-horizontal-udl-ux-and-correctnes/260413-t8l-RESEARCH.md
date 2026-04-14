# Quick Task 260413-t8l: Improve Horizontal UDL UX and Correctness — Research

**Researched:** 2026-04-13
**Domain:** Frame2D UI UX + FEM fixed-end force derivation for horizontal UDL
**Confidence:** HIGH (based on direct codebase read + standard FEM theory)

---

## Summary

Quick task 260413-rlh shipped a working horizontal UDL (w_x) feature. The todo flags three categories of follow-up: (1) UX — replace two sequential browser prompts with a single panel, (2) correctness — verify fixed-end force/moment assembly for inclined members, and (3) rendering — confirm arrow direction is right for non-axis-aligned members.

**Primary recommendation:** The FEM assembly is correct for axis-aligned members but wrong for inclined members. The arrow rendering has the same inclined-member gap. UX should match the per-member properties panel pattern already in the codebase.

---

## Correctness Analysis

### Current Assembly (what the code does) [VERIFIED: codebase read]

In `api_server/app.py` lines 89–94:

```python
# X-DOF: global indices base = node_idx * 3 + 0
fv[ni * 3 + 0] += -wx * L / 2      # X-DOF start node
fv[nj * 3 + 0] += -wx * L / 2      # X-DOF end node
en_moments[ei][0] += wx * L * L / 12
en_moments[ei][1] += -wx * L * L / 12
```

This hardcodes `w_x` as a **global-X** distributed load, applying equal forces to the X-DOF of both end nodes. The fixed-end moments (+wL²/12, -wL²/12) are identical to those from a vertical UDL on a horizontal beam — the same pattern as `m.udl` (w_y).

### What "w_x" Means — the Ambiguity [ASSUMED based on FEM standards]

Two possible physical meanings exist for "horizontal UDL":

| Convention | Meaning | Correct fixed-end forces |
|-----------|---------|--------------------------|
| **Global-X UDL** | Load per unit length acting in the global +X direction (wind on a vertical column) | For a vertical member (θ=90°): local axial = 0, local transverse = w_x — so: ENF = [-wx*L/2, -wx*L/2] in local Y, ENM = [wx*L²/12, -wx*L²/12] |
| **Local-transverse UDL** | Load per unit length perpendicular to the member axis | Always: ENF = [-w*L/2, -w*L/2] in local Y, ENM = [wL²/12, -wL²/12] |

For a **vertical column** (θ = 90°): w_x is a transverse load in local coordinates — the current assembly (adding to global X-DOF) happens to give the correct equivalent nodal forces for this case because the global X-DOF coincides with the local Y-DOF for a vertical member.

For an **inclined member** (θ ≠ 0°, ≠ 90°): the current code incorrectly adds the full load to the global X-DOF only. A load in the global X direction applied transversely to an inclined member must be projected onto both local X and local Y before computing fixed-end reactions. The correct approach:

```
theta = member orientation (atan2(dy, dx))
c = cos(theta), s = sin(theta)

Global X load per unit length = wx
Local axial component:   wx_local_axial = wx * c
Local transverse component: wx_local_transverse = -wx * s   (or +wx*s depending on sign convention)

ENF_local_Y_start = -wx_local_transverse * L / 2
ENF_local_Y_end   = -wx_local_transverse * L / 2
ENM_start         = +wx_local_transverse * L^2 / 12
ENM_end           = -wx_local_transverse * L^2 / 12
Axial contribution (local X): wx_local_axial * L / 2 added to axial DOFs
```

After transformation to global: `ENA_global = T.T @ ENA_local`.

**The current code skips this local-frame transformation entirely.** For axis-aligned members (θ = 0° horizontal beam or θ = 90° vertical column), the global-DOF shortcut happens to be correct or nearly correct. For θ = 45° members it will be wrong.

### Existing Vertical UDL Path for Comparison [VERIFIED: frame_v2.py lines 333–354]

The vertical UDL (w_y) takes the correct path: it writes `fyi`, `fyj` into `ENForces[e]`, and `apply_equivalent_nodal_actions()` in the solver computes `ENA_local = [0, fyi, mi, 0, fyj, mj]^T` then rotates to global via `T.T @ ENA_local`. The transformation is implicit in the solver's ENA method.

The w_x path bypasses this — it adds directly to the global `forceVector` without going through `ENForces`/solver ENA rotation. This is the root of the inclined-member correctness gap.

### Fix Strategy [ASSUMED pattern based on existing ENForces convention]

Option A — Extend ENForces to carry axial component: Add `ENForcesX` (per-member local-axial equivalent nodal forces). The solver's `apply_equivalent_nodal_actions` already builds `ENA_local = [0, fyi, mi, 0, fyj, mj]^T` — it would need to become `[fxi, fyi, mi, fxj, fyj, mj]^T`.

Option B — Do full decomposition server-side before forceVector injection: In `app.py`, project w_x into local frame, compute all 6 ENA components, rotate to global, add to `forceVector` directly. No solver changes needed. Simpler but duplicates transformation logic already in the solver.

Option B is lower-risk because it keeps solver unchanged and is self-contained in `app.py`.

---

## Rendering Analysis [VERIFIED: script.js lines 758–803]

Current `drawUDLs()` for w_x:
- Computes unit vector along member `(ux, uy)`.
- Perpendicular vector: `(-uy, ux)` (90° CCW rotation).
- Arrow direction flipped by `sign = udl_x > 0 ? 1 : -1`.

**For a vertical column (ux=0, uy=1):** perpendicular = (-1, 0), i.e., arrows point left/right in global X. This is visually correct for a horizontal wind load.

**For an inclined member (θ=45°, ux=0.707, uy=0.707):** perpendicular = (-0.707, 0.707), arrows point up-left/down-right. This represents a load perpendicular to the member axis (local transverse), NOT a global-X load. So the visual is inconsistent with the physics when the load is intended as global-X.

**Decision needed (UX design choice):** Must decide whether w_x means global-X load (wind) or local-transverse load (perpendicular to member). The rendering and assembly must agree.

Recommendation: Define w_x as **global-X** (the wind-load use case that motivated the feature). Update rendering to draw arrows in the global X direction (horizontal lines with arrowheads), not perpendicular to the member. This is consistent with how structural engineering tools (e.g., STAAD, Robot) show global-direction distributed loads.

---

## UX Analysis [VERIFIED: script.js lines 130–146]

Current flow in UDL mode (click member):
1. `prompt('Vertical UDL w_y...')` — browser modal
2. `prompt('Horizontal UDL w_x...')` — second browser modal

**Problems:**
- Two sequential blocking prompts — clunky UX, can't see the member while entering values.
- No way to clear w_y without re-entering (must type 0, but 0 is special-cased only for w_x).
- Inconsistent with the per-member property editor pattern.

**Existing pattern to follow [VERIFIED: script.js — per-member properties panel]:**

The per-member E/I/A editor uses a floating `<div id="memberPropsPanel">` or similar inline panel. Check for that:

```
memberPropsPanel or similar inline panel
```

The per-member props pattern (click member → open sidebar/panel pre-populated with current values → OK/Cancel) should be reused for UDL input. Both w_y and w_x should be in a single panel with:
- Clear labels: "w_y (N/m, + = downward)" and "w_x (N/m, + = rightward)"
- Clear button (set to 0)
- Member highlighted/selected while panel is open

---

## Common Pitfalls

### Pitfall 1: Inclined-Member Fixed-End Moment Sign
For a global-X load on an inclined member, the fixed-end moments in local coordinates depend on the local transverse projection. If you compute ENMoments in global coordinates and add them directly, you'll get wrong signs for members sloping down-right vs up-right.

**Prevention:** Always work in local coordinates: decompose, compute local FEF, then transform T.T @ local_vector.

### Pitfall 2: BMD Correction for Horizontal UDL
The current `drawBMD()` adds the UDL moment correction:
```js
if (m.udl && m.type !== 'bar') M += m.udl * L_m * L_m / 2 * xi * (1-xi);
```
This parabolic correction is for a **vertical UDL on a horizontal beam**. For w_x on an inclined member, the moment distribution from horizontal load will have a different profile. The BMD will be incorrect unless the correction is updated or the load is decomposed correctly at the source.

**Prevention:** The cleanest fix is to ensure the solver absorbs w_x through ENForces/ENMoments (not directly into forceVector) so that `member_moments` already contains the correct result. The BMD rendering can then use `member_moments` directly without needing to reconstruct the distributed load effect.

### Pitfall 3: Clearing Zero Values
Current code: `members[mi].udl_x = magX === 0 ? null : magX`
But for w_y: `members[mi].udl = magY` (no null-on-zero). If a user enters 0 for w_y, the member retains a zero udl value and the ENForces computation `if (!m.udl || m.type === 'bar')` will treat 0 as falsy — but `drawUDLs` uses `if (!m.udl) return` which also catches 0. Consistent null-on-zero for both fields would be cleaner.

---

## Architecture Decision Required

Before implementing, decide:

**Is w_x a global-X distributed load or a local-transverse distributed load?**

| Choice | Typical use case | Assembly | Rendering |
|--------|-----------------|----------|-----------|
| Global-X | Wind on a frame | Project onto local frame, compute FEF, transform back to global | Horizontal arrows (global X direction) |
| Local-transverse | Beam on inclined roof | Use directly as transverse FEF | Perpendicular-to-member arrows |

The current code renders as local-transverse (perpendicular arrows) but assembles as global-X (adds to X-DOF). **These are inconsistent.** Pick one and make both assembly and rendering match.

**Recommendation:** Global-X convention (matches the "wind load on column" motivation). Change rendering to horizontal arrows. Fix assembly for inclined members.

---

## Files to Change

| File | Change |
|------|--------|
| `api_server/app.py` | Fix w_x assembly for inclined members — project onto local frame, use T.T transformation |
| `ui/frame2d/script.js` | Replace two-prompt UDL input with single panel; fix drawUDLs arrow direction for w_x |
| `ui/frame2d/index.html` | Panel HTML if not inline in script.js |

The solver (`frame_v2.py`) and adapter (`frame_adapters.py`) do **not** need changes if Option B (server-side full projection in app.py) is chosen.

---

## Open Questions

1. **Global-X vs local-transverse convention** — must be decided before implementation. Determines both rendering and assembly approach.
2. **UI panel pattern** — does the per-member properties panel pattern (from Phase 3) use a floating div, a sidebar, or inline prompt replacement? Read the Phase 3 UI code to confirm the exact pattern before building the UDL panel to match it.

---

## Sources

- `api_server/app.py` lines 71–94 — horizontal UDL assembly [VERIFIED]
- `solver_core/.../frame_v2.py` lines 327–354 — ENA application with T.T rotation [VERIFIED]
- `ui/frame2d/script.js` lines 130–146 (UDL prompt), 716–803 (drawUDLs) [VERIFIED]
- `.planning/quick/260413-rlh-add-horizontal-udl-support-to-frame2d/260413-rlh-SUMMARY.md` — prior task decisions [VERIFIED]
- `.planning/todos/pending/2026-04-13-improve-horizontal-udl-ux-and-correctness-in-frame2d.md` — task scope [VERIFIED]
- Standard FEM beam theory (fixed-end forces for distributed loads) [ASSUMED — widely established]
