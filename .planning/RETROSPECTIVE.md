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

## Milestone: v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)

**Shipped:** 2026-04-26
**Phases:** 3 (4, 5, 6) | **Plans:** 10 | **Tasks:** 25 | **Quick tasks:** 1

### What Was Built

- 5 new analytical multi-member frame tests (TRUST-13..17) — portal frame, two-span continuous beam with pin release + UDL, mixed bilateral pin release, spring-supported simple beam, series cantilever / propped-cantilever
- Spring supports (Kx, Ky, Kθ) end-to-end in frame2d UI — toolbar, modal, coil-glyph rendering, type-discriminated JSON save/load, SI-unit payload, 11-step human UAT verified
- Canonical UAT harness — 5 human-authored fixtures via UI Save button, pytest TestClient harness with hand-calc asserts; surfaced and fixed two D-14 bugs in-phase
- pyRevit `ExportToPDA` pushbutton (sibling `CustomRevitExtension` repo) — drafting-view detail lines → canonical PDA JSON: view-type guard, 1mm Chebyshev endpoint merge, T-junction split, mid-span crossing detection, ft→m conversion, lexicographic node sort. Live UAT 6 fixtures + frame2d round-trip all PASS
- `frame_v2` pure-bar joint detection + θ-DOF auto-restraint via union into `restrainedDoF + pinDoF` extraction pipeline. Hybrid beam+bar models (Pratt/Warren-style trusses with continuous beam chords) now solve cleanly without HTTP 422
- `SolverDiagnosticError(RuntimeError)` typed exception module + adapter UDL-on-bar precondition + structured 422 payload (`detail`, `cause`, `offending_nodes`, `offending_members`) with backward-compat flat fallback (D-13)
- frame2d UI diagnostic overhaul — `validateBeforeSolve()` pre-solve scan with red-dot pure-bar markers, blocking banner for UDL-on-bar, structured-422 parsing replaces "Structure is unstable" with cause-suffixed status + canvas highlights of offending nodes/members
- Snapshot regression infrastructure — 56 baseline JSONs + pytest plugin enforces byte-identical solver output across all pre-existing tests; baseline captured BEFORE solver mutation (commit `93629a4` < `4356c70`) so git ordering proves no regression
- Bonus: pyRevit `ExportToPDA_Truss` pushbutton (truss2d round-trip), HUMAN-UAT passed

### What Worked

- **Snapshot baseline before mutation (D-16)** — capturing 35→56 JSONs of every existing pytest output BEFORE the solver edit, then asserting byte-identity afterwards, mechanically enforced the user's hard "don't damage the solver" constraint. Git commit ordering meant the gate could not be bypassed. This pattern is reusable for any future solver work.
- **Pure-bar θ-DOF as structural invariant, not regularisation (D-01, reject D-02)** — restraining θ at a joint where every incident member is axial-only is mechanically correct (no rotational DOF can be physically resisted), not a numerical hack like adding an ε-spring. The fix is correct in the limit and aesthetically simple.
- **Adapter-layer validation (D-06, D-18)** — UDL-on-bar rejection lives in `FrameV2Adapter.solve` BEFORE `BeamBarStructure_v2(...)`. Solver path stayed pure FEM; the silent drop at `frame_v2.py:376` is no longer reachable. CLAUDE.md "validation at boundaries" principle held.
- **Typed exception via RuntimeError subclass (D-09)** — `SolverDiagnosticError(RuntimeError)` was caught by the existing FastAPI handler without registering a new one. Single import path, no circular-import risk, forward-compatible `cause` taxonomy. The `isinstance OR hasattr('cause')` duck-type fallback in the handler is a small bit of future-proofing for cheap.
- **Phase reroute via audit Option B (2026-04-26)** — when the v1.2 audit surfaced that Tier 2 Revit work was orphaned and pure-bar joint robustness was higher-priority real-world tech debt, rescoping the milestone (Tier 2 → v1.3, pure-bar promoted from backlog 999.5) was much cheaper than slogging through Tier 2 to "complete" v1.2 nominally.
- **UI-contract tests as substitute for browser smoke testing in --auto mode** — three FastAPI TestClient tests asserting field-name parity (`detail`, `cause`, `offending_nodes`, `offending_members`) catch silent server-side renames that would regress the JS parser without test failure. Manual browser UAT documented in module docstring for any-time use.
- **Mirroring snapshot baseline for symmetric tests** — when the new UI-contract test exercised the same FEM path as TRUST-19 (same fixture, same API, same solver), copying TRUST-19's baseline JSON kept the gate honest without re-running full capture (which would have overwritten 35+ existing baselines).

### What Was Inefficient

- **Pre-existing untracked files in `solver_core/src/pda_analysis_software/`** — `__init__.py`, `engine/`, `models/`, `results/` are tracked-state-divergent (existing in main repo as untracked, not committed). Worktree-based execution required copying these into worktrees mid-plan to make `pytest` see solver edits, twice (Plans 06-02 and 06-03). Should have been committed at project start; same lesson as v1.0's truss2d UI untracked-files surprise.
- **Editable install pinned to main repo, not worktree** — `pip install -e` resolves `pda_analysis_software` to `/Users/catrinevans/Documents/pda_project/solver_core/src` regardless of which worktree was active. Required mirroring file edits to main repo via `cp` during executor runs. Friction was small but real and recurring.
- **Audit ran twice mid-milestone** (2026-04-24 + 2026-04-26) before final close — first surfaced orphaned Tier 2 requirements, second surfaced in-progress Phase 6 gaps. Necessary work, but a sign that mid-milestone scope changes need explicit acknowledgement (which Option B did) before audit is meaningful.
- **MILESTONES.md auto-generated entry was noisy** — the gsd-tools `milestone complete` extracted SUMMARY.md TL;DRs verbatim, including section headers like "Recommended UAT fixture" and "Verdict:" that aren't accomplishments. Required manual rewrite to match v1.0 / v1.1 entry style. Workflow improvement: tighten the accomplishment extractor.
- **Quick task 260423-a0q** (truss pyRevit pushbutton) was built opportunistically without being wired to a v1.2 requirement. Honest tracking required explicit "bonus scope" decision at milestone close. Not bad, but a reminder that ad-hoc scope adds bookkeeping later.

### Patterns Established

- **Snapshot-before-mutation regression gate** — `scripts/capture_solver_snapshots.py` + `scripts/verify_solver_snapshots.py` + `conftest.py` pytest plugin. Autouse fixture monkey-patches solver `solve_structure`/`solve` to dump UG/FG/member_forces/shears/moments to JSON. Captures every pytest case. Commit baseline BEFORE solver edit so git ordering enforces no-regression.
- **Per-node predicate as structural invariant** — `is_pure_bar_joint(n) := every incident member ∈ self.bars` is mechanically meaningful (joint has no rotational DOF that can be resisted), not numerical regularisation. Fix is exact, not approximate.
- **Typed `SolverDiagnosticError(RuntimeError)` with structured attrs (`detail`, `cause`, `offending_nodes`, `offending_members`)** — single import path, sibling of `adapters/`, no circular-import risk. FastAPI handler `isinstance OR hasattr('cause')` is forward-compat duck typing.
- **Adapter precondition-then-instantiate** — every shape/length/semantic check runs BEFORE `BeamBarStructure_v2(...)`. Failures raise typed exceptions that the API handler converts to 422. Solver only ever sees valid input.
- **Defensive `getattr(exc, 'cause', None)` and `Number.isInteger + range filter` on server-supplied indices** — malicious or buggy server cannot crash the API handler or drive the canvas out of bounds.
- **`validateBeforeSolve()` UI helper** — single function called at top of `solve()` (after E/I/A guards, before payload). Resets diagnostic state, runs predicates (pure-bar informational, UDL-on-bar blocking), returns false to early-exit. Future pre-flight checks (e.g. orphan member detection) extend in-place.
- **Pre-solve client predicate mirrors server predicate by construction** — `script.js` "every incident member has m.type === 'bar'" matches server-side `assemble_primary_stiffness_matrix` exactly. Server-UI contract parity is executable.
- **UI-contract FastAPI TestClient tests** — assert payload field names (`detail`, `cause`, `offending_nodes`, `offending_members`) so silent server-side renames fail tests, not browser session.
- **Worktree solver_core scaffolding workaround** — copy untracked `__init__.py` + `engine/`/`models/`/`results/` from main repo into worktree at executor start, mirror edits to main via `cp` during runs. Smell, not solution — the right fix is committing those files.

### Key Lessons

- **Capture regression baselines BEFORE the change you want to test against.** This is the single highest-leverage debugging technique for code that has implicit invariants (FEM solvers being a great example). Git ordering is your enforcement mechanism.
- **Validation at the adapter, not the solver.** "Solver path is pure FEM" plus "adapter raises typed exceptions before solver instantiation" gives you both correctness (no garbage in solver) and a single point for structured error reporting (API handler picks up RuntimeError subclasses).
- **Audit reroutes are cheaper than slogging through orphaned scope.** When v1.2 audit (2026-04-26) showed Tier 2 Revit was orphaned and pure-bar joint robustness was higher-priority debt, rescoping was an hour of paperwork. Trying to "complete" Tier 2 nominally would have been days.
- **Untracked files become recurring friction.** Same lesson v1.0 taught (truss2d UI files). Commit ambient runtime files at project start; the `pip install -e` editable-install path resolves to main repo regardless of worktree.
- **Per-cause UI taxonomy is forward-compatible.** Adding `under_restrained` or `ill_conditioned` to `cause` requires zero API or UI changes — just raise the typed exception with the new cause at the appropriate site. Future failure modes are cheap to surface.
- **Bonus scope needs an explicit close-out decision.** Quick tasks built opportunistically (260423-a0q) either get promoted to a requirement or recorded as bonus scope; ignoring them creates audit drift.

### Cost Observations

- Sessions: significant (multi-day, 4 phases worth of work landed in 7 elapsed days)
- Model mix: opus for planning + verification, sonnet for executors
- Notable efficiency: parallel wave execution (3 plans in Phase 6 ran in concurrent worktrees) compressed elapsed time substantially
- Notable inefficiency: orchestrator-written SUMMARY.md after executor stream-idle timeout in Plan 06-01 (work was complete, just metadata commit unfinished); no work lost but small orchestrator-spot-check overhead

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 | v1.2 |
|--------|------|------|------|
| Phases | 2 | 1 (1 deferred) | 3 |
| Plans | 6 | 3 | 10 |
| Quick tasks | 5 | 3 | 1 |
| Tests at close | 15 | 37 | 61 |
| Snapshot baselines | — | — | 56 |
| LOC at close | ~5,300 | ~7,100 | ~27,400 (incl. 20K+ planning artefacts + sibling-repo cross-refs) |
| Days | 13 | 1 | 7 |

### Recurring Themes

- **Untracked files create friction** — v1.0 (truss2d UI) and v1.2 (solver_core scaffolding). Commit ambient runtime files at project init.
- **Analytical / hand-calc verification beats consistency snapshots** when a closed-form solution exists. Equilibrium assertions on every test caught real bugs in v1.0; TRUST-18 hand-derived Pratt reactions in v1.2 served the same purpose. Snapshots are a complement (regression gate), not a substitute.
- **Backward-compatible additive changes** — Union types for per-member E/I/A (v1.0), object-form spring supports (v1.2), structured 422 payload alongside flat fallback (v1.2). Every addition stayed behind the prior API contract.
- **Quick tasks shrinking** — 5 in v1.0, 3 in v1.1, 1 in v1.2. Phases are absorbing more scope; quick tasks are reserved for genuinely off-roadmap fixes.
