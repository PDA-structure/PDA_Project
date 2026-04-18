# Phase 1: Trust and Production Hardening - Context

**Gathered:** 2026-04-05 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

The existing solvers are reliable enough for structural engineers to trust — errors are handled gracefully, the codebase has no known violations, and analytical correctness is verified across representative structural cases. This phase does NOT add new solvers or capabilities; it hardens and validates what's already built.

Requirements in scope: TRUST-01 through TRUST-11
</domain>

<decisions>
## Implementation Decisions

### Error Handling — Unstable Structures (TRUST-01)

- **D-01:** The `LinAlgError` propagation chain is already correct in the solvers and adapters. `frame_v2.py` (lines 388-392) and `truss2d.py` (lines 95-98) both wrap `np.linalg.solve` in try/except that raises `RuntimeError`. The fix belongs exclusively in `api_server/app.py`: catch `RuntimeError` (or use a FastAPI `@app.exception_handler(RuntimeError)`) and return `HTTPException(status_code=422, detail="structure is unstable or under-restrained")`. Do NOT add redundant try/except in the adapters.
- **D-02:** Use a FastAPI `@app.exception_handler(RuntimeError)` (DRY across both `/solve/truss2d` and `/solve/frame2d` endpoints) rather than per-endpoint try/except blocks.

### Print Violations (TRUST-02)

- **D-03:** Remove ALL `print()` calls from the entire `solver_core/` directory — this includes:
  - `truss2d.py` `summarize_results()` method (lines 122-140): delete the entire method
  - `frame_v2.py` `print_summary()` method (lines 537-573): delete the entire method
  - `frame_v1_legacy.py` (lines 684-724): remove print() calls (file stays for reference but print() calls go)
  - The TRUST-02 success criterion (`grep for print( in solver_core returns no matches`) has no file exclusion, so all three files must be clean.
- **D-04:** Do not replace the deleted methods with logging or any other output mechanism. Results are accessed via `AnalysisResult` fields, not printed. If debug info is needed, it goes in `meta` dict.

### Test Suite Expansion (TRUST-03–08)

- **D-05:** Add all five new analytical frame test cases to the existing `tests/test_frame_v2.py` file, following the established two-pattern approach (direct `BeamBarStructure_v2` + `FrameV2Adapter` pipeline test).
- **D-06:** UDL formula for the **simply-supported** beam midspan deflection is `5wL⁴/384EI` — NOT `wL⁴/384EI` (which is the fixed-fixed formula). Use `5wL⁴/384EI` for the TRUST-03 test.
- **D-07:** Every new test must include a global equilibrium assertion: `np.isclose(np.sum(result.FG) + total_applied_load, 0, atol=1e-6)`. This applies to all five new cases and should be retrofitted to the existing 5 frame tests to meet TRUST-08.
- **D-08:** Propped cantilever (TRUST-07) — prop reaction formula: `R_prop = 3EI·δ/L³` where δ is the applied end displacement, or for a UDL case: `R_prop = 3wL/8`. Use the UDL variant for consistency with TRUST-03 test style.
- **D-09:** Bar member test (TRUST-05) — create a simple frame with one beam and one bar (axial-only) member meeting at a node. Verify that bar carries only axial force (shear and moment at bar nodes ≈ 0).

### BMD/SFD Canvas Rendering (TRUST-09, TRUST-10)

- **D-10:** Draw BMD and SFD directly on the existing canvas in `ui/frame2d/script.js`, using the same coordinate mapping (`GRID`, `UNIT`, `origin`) already established. Do NOT add a second canvas element.
- **D-11:** For each member, compute moment/shear ordinates at start and end nodes from `member_moments[i]` and `member_shears[i]` in the results. Draw as filled polygons with perpendicular offsets in member-local coordinates, then transform to screen space using `Math.cos(angle)` and `Math.sin(angle)` derived from node positions.
- **D-12:** Toggle BMD and SFD independently via two new checkboxes in the frame2d UI sidebar, placed alongside the existing `chkDeflected` checkbox. Scale factor for diagram size should be auto-scaled to fit (e.g., max ordinate = 20% of member length in pixels).
- **D-13:** BMD convention: positive moment (sagging) draws on the tension face (below for horizontal members). SFD convention: positive shear draws on the right face.

### Member Stress Output (TRUST-11)

- **D-14:** Add member stress to `AnalysisResult.meta` dict in each adapter's `solve()` method, not in the solver itself. Format: `meta["member_stresses"] = member_forces / A` (numpy array, same length as `member_forces`). This applies to both `FrameV2Adapter` and `Truss2DAdapter`. No changes to `AnalysisResult` dataclass fields.
- **D-15:** For frame members, stress = `member_forces / A` (axial stress only). Bending stress is out of scope for this phase (requires section geometry beyond A).

### Claude's Discretion

- Exact visual styling of BMD/SFD polygons (fill color, opacity, stroke weight)
- Whether BMD/SFD labels show peak values inline or in the results panel
- Exact tolerance value for equilibrium assertion (suggest `atol=1e-6` but Claude can adjust for numerical stability)
- Order of new test cases within `test_frame_v2.py`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §Trust and Production Hardening — TRUST-01 through TRUST-11 definitions and acceptance criteria
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (observable behaviors that must be true)

### Solver and adapter code
- `solver_core/src/pda_analysis_software/solvers/truss2d.py` — existing RuntimeError raising (lines 95-98), summarize_results() to delete (lines 122-140)
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — existing RuntimeError raising (lines 388-392), print_summary() to delete (lines 537-573)
- `solver_core/src/pda_analysis_software/solvers/frame_v1_legacy.py` — print() calls to remove (lines 684-724); file kept for reference
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` — add member stress to meta here
- `solver_core/src/pda_analysis_software/adapters/truss_adapters.py` — add member stress to meta here
- `solver_core/src/pda_analysis_software/results/results.py` — AnalysisResult dataclass (no changes needed)

### API
- `api_server/app.py` — add @app.exception_handler(RuntimeError) here; currently has no error handling

### Tests
- `tests/test_frame_v2.py` — add 5 new analytical cases here; follow existing pattern (lines 1-147)
- `tests/test_truss2d.py` — review for equilibrium assertion gaps; may need TRUST-08 retrofitting

### UI
- `ui/frame2d/script.js` — drawDeflected() pattern for canvas drawing; renderResults() for result access; chkDeflected for toggle pattern
- `ui/frame2d/index.html` — add new checkboxes for BMD/SFD toggle

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `drawDeflected()` in `ui/frame2d/script.js` — canvas drawing pattern for member-by-member iteration, coordinate mapping, ctx usage. BMD/SFD rendering follows same structure.
- `renderResults()` in `ui/frame2d/script.js` — already accesses `member_moments` and `member_shears` from API response. These values are available for diagram rendering.
- `BeamBarStructure_v2.solve_structure()` — already raises `RuntimeError("Singular stiffness matrix...")` when LinAlgError occurs. No solver changes needed.
- `Truss.solve_structure()` — similarly raises RuntimeError on singular matrix.
- Existing test fixture pattern in `test_frame_v2.py`: build model → call adapter → assert on `result.UG`, `result.FG`, `result.member_moments`. New tests follow this pattern plus equilibrium sum assertion.

### Established Patterns
- **Error propagation:** Solver raises RuntimeError → Adapter propagates → API must catch and return 422. Chain is: solver → adapter (no catch needed) → api_server/app.py (add exception_handler here).
- **meta dict:** `AnalysisResult.meta` is already used for `n_nodes` and `n_members`. New `member_stresses` array goes here following same pattern.
- **DOF convention:** 1-based in public API, 0-based internally. All existing tests use 1-based for `restrainedDoF`. New tests must follow same convention.
- **UDL model setup:** `ENForces = [-wL/2, -wL/2]`, `ENMoments = [wL²/12, -wL²/12]` per CLAUDE.md. UDL sign: positive = downward.
- **Canvas coordinate system:** `realX = (px - origin.x)/GRID`, `realY = (origin.y - py)/GRID`. First node sets origin. Scale correction via `scaleX = canvas.width / rect.width`.

### Integration Points
- `app.py` — add `@app.exception_handler(RuntimeError)` before route definitions; return `JSONResponse(status_code=422, content={"detail": "..."})`.
- `FrameV2Adapter.solve()` and `Truss2DAdapter.solve()` — append `member_stresses` to `meta` dict before returning `AnalysisResult`.
- `ui/frame2d/script.js` — `renderResults()` function updates UI after solve; add BMD/SFD draw calls here; add toggle checkboxes to HTML.
- `ui/frame2d/index.html` — sidebar panel already has checkbox for deformed shape; add two more for BMD and SFD.

</code_context>

<specifics>
## Specific Ideas

- The simply-supported beam UDL formula is `5wL⁴/384EI` — this is the analytically correct reference for TRUST-03. The existing ENForces/ENMoments convention (positive = downward) must be used consistently in the test setup.
- Exception handler approach (`@app.exception_handler`) is preferred over per-endpoint try/except — it covers both endpoints without duplication and any future endpoints automatically.
- The grep check for TRUST-02 must pass: `grep -r "print(" solver_core/` returns no matches. All three solver files must be clean.

</specifics>

<deferred>
## Deferred Ideas

- Bending stress output (σ = M·c/I) — requires section geometry (c = d/2) beyond what A provides; defer to Phase 3 (Model Evolution) when section properties are richer.
- Export of BMD/SFD as image — useful for reports; defer to Phase 3 result export work.
- BMD/SFD for truss2d UI — truss members carry only axial force, no moments/shears; not applicable.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-trust-and-production-hardening*
*Context gathered: 2026-04-05*
