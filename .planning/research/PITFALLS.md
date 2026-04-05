# Pitfalls Research

**Domain:** Structural Engineering FEM Solver — Extension to 3D Elements
**Researched:** 2026-04-05
**Confidence:** HIGH (based on direct codebase analysis + domain knowledge)

## Critical Pitfalls

### Pitfall 1: 3D Coordinate Transformation Degeneration

**What people do:** Use a fixed reference vector (e.g., global Y) in the cross-product to form local axes for all members — including vertical ones.

**Why it's wrong:** When a member is parallel to the reference vector, the cross-product produces a zero or near-zero vector, yielding NaN direction cosines. numpy propagates NaN silently — the stiffness matrix looks assembled but is garbage.

**Warning signs:** `nan` or `inf` in UG/FG; test with a vertical member (same x, y, different z) fails or produces NaN.

**Prevention strategy:**
1. Detect when member direction vector is parallel to reference vector (dot product ≈ ±1)
2. Switch to an alternate reference vector (e.g., global Z if reference is Y)
3. Add a mandatory vertical member test case before merging the 3D truss solver

**Phase:** 3D truss solver (Phase 3 or equivalent)

---

### Pitfall 2: DOF Indexing Drift Between Solver Types

**What people do:** Reuse DOF indexing code or test fixtures from the 2D frame solver (3 DOF/node: Ux, Uy, θ) when building the 3D truss solver (3 DOF/node: Ux, Uy, Uz).

**Why it's wrong:** Both solvers happen to have 3 DOF/node but with different physical meaning. Code that conflates solver types silently misinterprets results — a rotation θ treated as Uz produces wrong displacements with no error thrown.

**Warning signs:** Node displacements in the "wrong" direction; tests pass but values are physically incorrect.

**Prevention strategy:**
- Keep `TrussModel3D` as a separate dataclass — never share with `FrameModel2D`
- Name DOFs explicitly in test assertions: `assert UG[0] == expected_Ux_node0`
- Never import 3D truss fixtures from 2D frame test files

**Phase:** 3D truss solver and adapter

---

### Pitfall 3: Stiffness Matrix Assembly DOF Mapping Bug (Off-by-One)

**What people do:** Compute the global DOF index for node `i` as `3*i` (0-based) when the project convention is `3*i + 1` (1-based externally, converted to 0-based internally).

**Why it's wrong:** Off-by-one in the index formula scrambles element contributions across DOFs, producing a non-symmetric global stiffness matrix and wrong (but not NaN) results.

**Warning signs:** `K[i,j] != K[j,i]`; reaction forces don't balance applied loads; equilibrium check fails.

**Prevention strategy:**
1. Add a `assert np.allclose(K, K.T)` symmetry check in tests immediately after assembly
2. Add a global equilibrium check: `assert np.allclose(FG + applied_loads, 0, atol=1e-6)`
3. Follow the existing convention exactly: node `i` (0-indexed) → DOFs `[3*i, 3*i+1, 3*i+2]` (0-based array indices)

**Phase:** 3D truss solver — assembly step

---

### Pitfall 4: Existing `print()` Violation in truss2d.py

**What people do:** Leave `Truss.summarize_results()` (lines 122–140 in `truss2d.py`) which uses `print()` inside `solver_core`.

**Why it's wrong:** Violates the hard rule: "solver_core must have NO printing in the computation path." Adding a 3D truss solver alongside an already-violating 2D truss normalizes the pattern and leads to more print statements propagating into new solvers.

**Warning signs:** `summarize_results()` exists and uses `print()`; new developers model their 3D solver on truss2d.py and copy the pattern.

**Prevention strategy:**
1. Remove `summarize_results()` from `truss2d.py` before building the 3D solver
2. Return debug data via `meta` dict in AnalysisResult instead
3. Add a lint/grep check in CI: `grep -r "^[[:space:]]*print(" solver_core/` should return nothing

**Phase:** Test/trust phase (immediate — before any new solver work)

---

### Pitfall 5: Insufficient Analytical Test Coverage

**What people do:** Write 1–2 test cases per solver (e.g., one cantilever, one simple beam) and call it tested.

**Why it's wrong:** Structural engineers will not use an unverified solver. The current 10 tests cover basics but miss: UDL case, portal frame, bar members, pin releases, propped cantilever. For 3D, even fewer edge cases are covered by default. A bug in stiffness assembly can pass simple tests and fail on real structures.

**Warning signs:** Test suite has <5 cases per solver; no portal frame test; no multi-member equilibrium test; no support reaction sum check.

**Prevention strategy:**
- 2D frame: add UDL case, portal frame, bar member, pin release, propped cantilever before extending the platform
- 3D truss: minimum 5 tests — single inclined bar, vertical member, horizontal plane truss (equilibrium check), 3D tetrahedron truss, multi-point load case
- Every test must assert: (1) key displacement values, (2) reaction sum equals applied load, (3) no NaN in results

**Phase:** Test/trust phase (immediate) + 3D truss solver

---

### Pitfall 6: UDL Sign Convention Without Transformation for Inclined Members

**What people do:** Apply the 2D horizontal-member ENA (equivalent nodal action) convention (`ENForces = [-wL/2, -wL/2]`, `ENMoments = [wL²/12, -wL²/12]`) to inclined frame members without applying the local-to-global transformation.

**Why it's wrong:** The UDL acts along the local member axis in local coordinates. Without transformation to global coordinates, the equivalent nodal forces are wrong for any non-horizontal member. Produces incorrect results silently — no matrix error, just wrong answers.

**Warning signs:** Inclined member with UDL shows wrong midspan deflection; moment diagram is unsymmetric for a symmetric inclined beam.

**Prevention strategy:**
1. In the frame adapter, always transform ENForces/ENMoments to global coordinates via the member transformation matrix before assembling into the global force vector
2. Test explicitly: inclined beam with UDL, compare against analytical solution from structural mechanics textbook

**Phase:** Frame UI/UX improvements phase + grillage solver

---

### Pitfall 7: Singular Matrix Not Handled at API Level

**What people do:** Let `np.linalg.solve` raise `LinAlgError` on an under-restrained structure, which bubbles up as HTTP 500.

**Why it's wrong:** A mechanism (unstable structure) is a valid modeling scenario — a user error, not a server error. HTTP 500 exposes a stack trace and breaks the UI error-handling path.

**Warning signs:** Removing all supports in the browser UI crashes the API with 500; browser shows no meaningful error message.

**Prevention strategy:**
1. Wrap `np.linalg.solve` in a try/except `np.linalg.LinAlgError` in the adapter's `solve()` method
2. Return a structured error as part of AnalysisResult (or raise a domain-specific exception caught at the API endpoint level)
3. API returns 422 with `{"error": "Singular stiffness matrix — structure is unstable or under-restrained"}`

**Phase:** Test/trust phase (immediate — one-hour fix, production blocker)

---

### Pitfall 8: Per-Member E/I/A as a Breaking API Change

**What people do:** Add per-member E/I/A to FrameModel2D by changing the scalar fields to lists, without versioning the API.

**Why it's wrong:** Existing clients (browser UIs, notebooks) send a scalar `E`. Changing to a list silently breaks them if not handled with a union type or API version bump.

**Warning signs:** Frame2d browser UI stops working after the model schema change; `E` field in Pydantic model is list but UI sends float.

**Prevention strategy:**
1. When adding per-member properties, use a Pydantic union type (`E: Union[float, List[float]]`) with backward-compatible coercion (scalar → broadcast to all members)
2. Or version the endpoint: `/v2/solve/frame2d` with new schema, keep `/solve/frame2d` for backward compatibility
3. Update browser UIs at the same time — do not leave them on the old schema

**Phase:** Model evolution phase (grillage prerequisite) — plan the API versioning strategy before implementing

---

## Summary Priority Matrix

| Pitfall | Risk | Fix Effort | Phase |
|---------|------|------------|-------|
| 3D coordinate transformation degeneration | HIGH | Medium | 3D truss |
| DOF indexing drift | HIGH | Low (separate dataclasses) | 3D truss |
| Stiffness assembly off-by-one | HIGH | Low (symmetry assert) | 3D truss |
| print() in truss2d.py | MEDIUM | Low (delete method) | Immediate |
| Insufficient test coverage | HIGH | Medium | Immediate + 3D truss |
| UDL without transformation | MEDIUM | Medium | Frame improvements |
| Singular matrix → HTTP 500 | HIGH | Low (try/except) | Immediate |
| Per-member E/I/A breaking change | MEDIUM | Medium | Grillage prereq |

---

*Pitfalls research for: PDA Analysis Software — 3D solver extension*
*Researched: 2026-04-05*
