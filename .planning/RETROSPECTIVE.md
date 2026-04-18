# Retrospective: PDA Analysis Software

---

## Milestone: v1.0 — 2D Solver Foundation

**Shipped:** 2026-04-18
**Phases:** 2 | **Plans:** 6 | **Quick tasks:** 5

### What Was Built

- HTTP 422 error handling for unstable structures (was HTTP 500)
- All print()/summarize_results() removed from solver_core — hard rule enforced clean
- Test suite expanded to 15 tests with 5 analytical cases and equilibrium assertions on all
- BMD/SFD rendered on frame2d canvas via cubic Hermite interpolation + quartic UDL correction
- Member stress (σ = F/A) in AnalysisResult meta and UI results table
- Per-member E/I/A in FrameModel2D — Union[float, List[float]], backward-compatible
- Section property calculator (rectangle, circle, I-section) in frame2d sidebar with live update
- JSON result export (timestamped Blob URL download) in both UIs
- Node label / DOF overlay toggle in frame2d
- Horizontal UDL support with direction-cosine decomposition for inclined members
- truss2d UI files committed to git for the first time
- Zoom/pan, node labels, display toggles, stress column in truss2d UI

### What Worked

- **Analytical test verification** — each new test proved correctness against a closed-form solution, not just consistency. Caught a sign convention subtlety in the equilibrium assertion approach early.
- **Quick task format** — small improvements (horizontal UDL, arrow direction fix, resetAll, zoom/pan) landed cleanly without disrupting the main phase execution.
- **Backward-compatibility via scalar broadcast** — per-member E/I/A as Union[float, List[float]] meant zero changes to existing tests or UI, which kept Phase 2 Plan 1 low-risk.
- **UAT as a gate** — the UAT file caught the skipped truss2d symbol scaler before closing Phase 2, which was then fixed in a quick task rather than buried.

### What Was Inefficient

- **truss2d UI files were untracked in git** — discovered mid-execution of Phase 2 Plan 3. Should have been committed at project initialisation. Required a workaround inside the plan execution.
- **Hermite cubic BMD underestimate** — the quartic correction was needed but wasn't anticipated in the plan. Required a fix pass after initial implementation.
- **STATE.md drift** — the state file fell behind actual progress during Phase 2 execution; required manual reconciliation at milestone close.

### Patterns Established

- `createDownloadLink(res)` — Blob URL with `revokeObjectURL` before each new solve for memory safety
- `getSymbolScale()` — reads input at call time; each drawing function multiplies hardcoded dimensions by scale factor
- Equilibrium assertion targets reaction DOFs specifically, not `sum(FG)` which is always 0 by construction
- `dy/dx = -solver_theta` — solver theta is positive clockwise; Hermite slope requires negation
- Quartic UDL correction: `-w*L^4/(24EI)*xi^2*(1-xi)^2` for accurate midspan BMD

### Key Lessons

- Commit UI files to git at project start — untracked files create friction mid-execution
- Equilibrium check design matters: `sum(FG) == 0` always; target reaction nodes explicitly
- Hermite shape functions need UDL correction for accurate BMD — worth testing against Navier series before shipping
- Phase scope kept tight (3 plans per phase) worked well — plans stayed executable in a single session

### Cost Observations

- Sessions: ~6 across 13 days
- Notable: Quick tasks were efficient — scoped fix, plan, execute, commit in one go

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 2 |
| Plans | 6 |
| Quick tasks | 5 |
| Tests at close | 15 |
| LOC at close | ~5,300 |
| Days | 13 |
