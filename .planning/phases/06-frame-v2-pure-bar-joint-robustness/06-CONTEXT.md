# Phase 6: frame_v2 — Pure-Bar Joint Robustness - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `frame_v2` solve **hybrid beam+bar models** (e.g. Pratt/Warren-style trusses with a continuous beam top chord, bar bottom chord and bar diagonals) without returning HTTP 422 at joints where every incident member is a bar. Stop silently dropping UDL applied to bar members. Replace the generic "Structure is unstable" UI message with a specific, actionable diagnostic that names the offending node(s) / member(s).

**In scope (PUREBAR-01..05):**
- Detect pure-bar joints during stiffness assembly in `frame_v2.assemble_primary_stiffness_matrix`
- Eliminate the singular θ DOF at those joints via implicit restraint (re-using the existing `restrainedDoF` extraction pipeline)
- Reject UDL applied to bar members with a clear error (currently silently dropped at `frame_v2.py:376`)
- Surface joint-level diagnostics in the frame2d UI: pre-solve scan + structured 422 payload + canvas highlights
- Regression test using the captured failing fixture + a clean symmetric Pratt analogue with hand-calculable reactions

**Hard non-negotiable (carried from user constraint, 2026-04-26):**
- **ZERO behaviour change for non-hybrid models.** The existing 43 pytest cases (TRUST-01..17 + UAT-frame2d-01..05 + truss/frame v1 baselines) MUST pass unchanged after the fix. Any new code path is gated behind a predicate that is false for every pre-existing test.

**Not in scope:**
- Generalising to "Structure is unstable" detection beyond the pure-bar-joint and UDL-on-bar cases (genuine under-restraint diagnostics are a future polish; the structured 422 payload introduced here is forward-compatible).
- Changing `truss2d` solver — pure 2D trusses still go through `truss2d` (2 DOF/node) for now. `frame_v2` becomes capable of handling all-bar configs as a side-effect, but is not the recommended path.
- Refactoring θ-DOF provenance throughout `frame_v2` (memory: `solver_theta_dof_provenance.md` flags this as a future possibility but says "consider after a third manifestation"; this is the second).
- Prescribed-settlement boundary conditions (deferred from Phase 4, still deferred).

</domain>

<decisions>
## Implementation Decisions

### θ-DOF Elimination Strategy (PUREBAR-01, PUREBAR-02)

- **D-01:** **Implicit-restraint approach.** Detect pure-bar joints during `assemble_primary_stiffness_matrix()`, collect their θ DOFs into a new internal list `self._pure_bar_theta_dofs` (1-based, matching the `restrainedDoF` convention), and union them with `restrainedDoF + pinDoF` in `extract_structure_stiffness_matrix()`. Result: the singular θ row/col is deleted from `Ks` exactly as a fixed-support DOF would be; UG[θ] = 0 by construction at those joints; reaction recovery via `Kp @ UG` produces zero reaction moment at those nodes (correct — there's no rotational element to react against).
- **D-02:** **Reject explicit Ks row/col drop, regularisation, and "detect + raise error".**
  - Explicit drop: more invasive, doesn't reuse the proven extraction pipeline that has been working since v1.0.
  - Regularisation (tiny Kθ diagonal): user already proved this corrupts the load path on 2026-04-22 — phantom moment at pinned supports, mixed-sign axial in beams, unjustified horizontal reactions. Off the table.
  - Detect-and-raise: would still 422 the captured fixture; fails PUREBAR-02.
- **D-03:** **Per-node predicate** `is_pure_bar_joint(n) := every member incident on node n is in self.bars`. Run once per `assemble_primary_stiffness_matrix()` call (assembly is O(n_members); caching adds invalidation risk for negligible gain).
- **D-04:** **Predicate exclusions — defer to user intent.** A node is NOT auto-restrained if EITHER:
  - Its θ DOF is already in `restrainedDoF` (e.g. fixed support — covered already; union dedup handles it).
  - Its θ DOF is in `pinDoF` (rotational release at support — already removed; union dedup).
  - Its θ DOF is in `springDoF` (user explicitly added a Kθ rotational spring — user intent overrides auto-restraint, even if Kθ is tiny). Adding restraint here would silently null the user's spring.
- **D-05:** **No-regression guarantee.** Pure-beam models have zero pure-bar joints (every member is in `bars=[]` ⇒ predicate false everywhere). Bar-only 2D trusses go through the separate `truss2d` solver, not `frame_v2`. The new code path activates *only* in the hybrid case that is currently broken — verifiable by running existing TRUST-01..17 + UAT tests before and after with byte-identical reactions/displacements/member forces.

### UDL-on-Bar Policy (PUREBAR-03)

- **D-06:** **Reject at adapter with structured error.** `FrameV2Adapter.solve()` (or a precondition method called from it) inspects `model.ENForces` and `model.ENMoments` per member; if a member index is in `model.bars` and any of its ENA values are non-zero, raise a typed exception (see D-09) with `cause="udl_on_bar"`, `offending_members=[m1, m2, ...]`, and a human-readable detail. CLAUDE.md places semantic translation in the adapter — this is exactly that.
- **D-07:** **Reject silent conversion to nodal forces.** Splitting wL/2 between end nodes would *work numerically* but masks the engineering question (the user thought they were applying a distributed load to a tension-only member — they almost certainly mis-typed the member type). Loud failure with a clear message is the right UX.
- **D-08:** **No solver-level guard added.** The adapter is the single point of validation for this case. Solver continues to skip bars in `apply_equivalent_nodal_actions` (current behaviour at `frame_v2.py:376`); the silent-drop is no longer reachable because the adapter blocks it upstream.

### Diagnostics + 422 Payload (PUREBAR-04)

- **D-09:** **New typed exception in adapter / API path.** Introduce `SolverDiagnosticError(RuntimeError)` (or attach `.cause`, `.offending_nodes`, `.offending_members`, `.detail` attrs to `RuntimeError`) raised by adapter / solver when a structured failure is identifiable. The existing `RuntimeError` exception handler in `api_server/app.py:25-30` is extended to inspect those attributes and return a structured JSON payload:
  ```json
  {
    "detail": "Pure-bar joint at node 4 — every incident member is a bar; θ DOF auto-restrained" | "UDL applied to bar member 3 — bars are axial-only",
    "cause": "pure_bar_joint" | "udl_on_bar" | "under_restrained" | "ill_conditioned",
    "offending_nodes": [4],
    "offending_members": [3]
  }
  ```
  When the exception has none of the structured attributes (e.g. unrelated `RuntimeError`), the handler falls back to the current flat `{"detail": "structure is unstable or under-restrained"}` payload — backward-compatible.
- **D-10:** **Pure-bar joints do not raise.** D-01 makes them solvable; the structured payload is reserved for genuinely-failing cases (UDL-on-bar, genuine under-restraint, ill-conditioning). The pre-solve UI scan (D-11) is where the user is informed about auto-restraint having occurred.
- **D-11:** **Pre-solve UI scan in `script.js`.** Before `fetch('/solve/frame2d')`, walk the `members` + `bars` arrays:
  - Compute per-node "every incident member is a bar?". Highlight matching joints with a small red dot + tooltip "Pure-bar joint — θ auto-restrained on solve".
  - Detect UDL on bar members. Highlight offending member in red + warning banner "UDL on bar member {N}: bars are axial-only. Change member type to 'beam' or remove UDL." This is **blocking** (Solve button disabled) since the API will reject anyway.
  - The pure-bar warning is **non-blocking** (informational only).
- **D-12:** **Generic-error replacement.** The UI's existing `setStatus('API error: ' + (err.detail || res.statusText), true)` (`script.js:566`) continues to work as a fallback. New behaviour: if the 422 payload has `cause`, render a richer status message, and if `offending_nodes` / `offending_members` are populated, highlight them on canvas with the same red-dot / red-line treatment used in the pre-solve scan (so the failure mode and pre-flight check share visual language).
- **D-13:** **Backward compatibility of 422 payload.** Existing UIs / callers that read only `detail` continue to work. New fields (`cause`, `offending_nodes`, `offending_members`) are additive.

### Regression Test Design (PUREBAR-05)

- **D-14:** **Two new analytical / verification tests + one rejection test.** All in `tests/test_frame_v2.py` following the established pattern (TRUST-XX numbering).
  - **TRUST-18 — symmetric Pratt with bar bottom chord and bar diagonals.** Hand-calculable: 4-panel Pratt, span L = 4 m, height h = 1 m, UDL w = 10 kN/m on top chord (3 beam segments), pinned supports at both top-chord ends, bottom chord + diagonals as bars. Reactions by symmetry: `Vy = wL/2 = 20 kN` at each pin, `Hx = 0`. Asserts: no HTTP 422; reactions match within tolerance; pure-bar interior joints (top-chord-to-diagonal and bottom-chord intermediate nodes) report `UG[θ] = 0`; no phantom moment at pins (`FG[θ_pin] ≈ 0`); top-chord beams show single-sign axial; bottom chord shows tension only.
  - **TRUST-19 — captured fixture replay.** Loads `~/Downloads/frame2d-model-2026-04-22T06-14-49.json` (committed into `tests/fixtures/uat/pure_bar_pratt_captured.json` for reproducibility). Asserts: solves without 422; reaction sum equals total applied UDL; no phantom moments at the pinned supports; sane axial signs in beams.
  - **TRUST-20 — UDL-on-bar adapter rejection.** Builds a minimal model with a UDL on a bar member; asserts adapter raises `SolverDiagnosticError` with `cause="udl_on_bar"` and the offending member index in `offending_members`. Also asserts the API endpoint returns 422 with the structured payload.
- **D-15:** **Testing hygiene — explicit lock-in.** TRUST-18 / TRUST-19 must verify correctness without relying on incidental DOF zeroing via `pinDoF` or `restrainedDoF` covering the auto-restrained θ DOFs. The assertion that distinguishes "fix worked" from "test happens to pass" is: pure-bar interior joints have no entry in user-provided `pinDoF` / `restrainedDoF`; only the auto-restraint mechanism brings their θ DOF to zero. (Memory: `solver_theta_dof_provenance.md` — the prior pin-release multi-member bug was masked for weeks by exactly this trap.)
- **D-16:** **No-regression test plan.** Before any solver change is made, capture current `member_forces`, `member_shears`, `member_moments`, `UG`, `FG` outputs for all 43 existing tests as JSON snapshots. After the change, re-run and assert byte-identical numerical outputs (with appropriate `np.allclose` tolerance for floating-point) for every non-hybrid test. This is the executable form of the user's hard constraint. Snapshots can be deleted once the suite is green if they bloat the repo, but the guarantee they enforce is documented in the phase summary.
- **D-17:** **Captured fixture is committed into `tests/fixtures/uat/`.** Phase 4 D-12 already established this pattern (`tests/fixtures/uat/*.json`). The pure-bar Pratt fixture lives alongside the existing five. Filename: `pure_bar_pratt_captured.json`. The original `~/Downloads/...` file is not the source of truth post-commit.

### Architecture / Validation Placement

- **D-18:** **Validation lives where CLAUDE.md puts it.**
  - **Solver** (`frame_v2.py`): pure-bar detection during assembly + θ-DOF restraint. No printing, no error-raising for the pure-bar case (handled internally).
  - **Adapter** (`FrameV2Adapter`): pre-solve translation-layer check for UDL-on-bar; raises `SolverDiagnosticError` (typed).
  - **API** (`app.py`): exception handler extended to surface `cause` / `offending_*` from the typed exception; falls back to current flat payload otherwise.
  - **UI** (`ui/frame2d/script.js`): pre-solve scan (informational pure-bar + blocking UDL-on-bar) + structured 422 parsing + canvas highlights.

### Claude's Discretion

- Exact name of the typed exception class (`SolverDiagnosticError` vs `StructuralValidationError` vs attaching attrs to plain `RuntimeError`) — pick whichever is cleanest after reading the existing exception-handling pattern.
- Cache vs recompute pure-bar predicate per assembly call — start with recompute (D-03) unless profiling shows it's hot.
- Pre-solve UI scan placement (inline at top of `solve()` vs separate function `validateBeforeSolve()`) — choose what reads cleanest.
- Canvas highlight visual style for offending joints/members (red dot, red outline, both?) — match existing support-symbol style in `drawSupports()`.
- Whether to add a UI hint button "Why was Solve disabled?" linking to a longer explanation, or just the inline banner text — banner alone is fine for MVP.
- Pratt geometry exact parameters (span 4 m vs 6 m, panel count 4 vs 3, height-to-span ratio) for TRUST-18 — pick whatever produces clean hand-calc numbers; document the derivation in the test docstring.
- Exception attribute names (`cause` vs `failure_mode`, `offending_nodes` vs `bad_nodes`) — be consistent and document in the docstring.

### Folded Todos

- **`2026-04-22-frame2d-pure-bar-joint-instability.md`** (P1, theme: solver) — fully absorbed into PUREBAR-01..05 via D-01..D-17. The todo's open acceptance criteria (detect pure-bar joints, analytical verification, testing hygiene, UDL-on-bar policy, UI warning, generic-error replacement) map 1:1 to the decisions above. Mark this todo `completed` at phase close.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-defining specs (this repo)
- `.planning/ROADMAP.md` §"Phase 6: frame_v2 — Pure-Bar Joint Robustness" (lines 150–164) — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` §"Solver Robustness — Pure-Bar Joints (PUREBAR)" (lines 24–29) — PUREBAR-01..05 acceptance criteria
- `.planning/STATE.md` §"Decisions" — Phase 6 repo is `pda_project` (not `CustomRevitExtension`)

### Solver + Adapter + API (where the code lives)
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — entire file is in scope. Specifically:
  - `assemble_primary_stiffness_matrix` (line 398) — where pure-bar detection + restraint hook lands
  - `extract_structure_stiffness_matrix` (line 420) — where the auto-restraint set unions with `restrainedDoF + pinDoF`
  - `apply_equivalent_nodal_actions` (line 373) — current bar-skip at line 376; the silent UDL drop becomes unreachable post-fix (adapter blocks it)
  - `_element_bar_global` (line 309) — bars contribute Ux/Uy stiffness only; this is the structural reason for the singularity
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` — `FrameV2Adapter`; new pre-solve UDL-on-bar check goes here
- `solver_core/src/pda_analysis_software/models/frame2d_model.py` — `FrameModel2D` dataclass (no changes expected)
- `api_server/app.py` — `Frame2DRequest` Pydantic model (line 51), exception handler (lines 25–30) extended for structured 422 payload, `/solve/frame2d` endpoint (line 77)

### UI (integration point for PUREBAR-04)
- `ui/frame2d/script.js` — solve handler around line 558; error path at line 564–566 (`setStatus('API error: ' + (err.detail || res.statusText), true)`); add pre-solve scan + structured 422 parsing + canvas highlight
- `ui/frame2d/index.html` — no schema changes expected; warning banner reuses existing `errorBanner` element (per Phase 1's diagnostic-banner pattern)
- `ui/frame2d/style.css` — may need a red-dot / red-outline class for offending joints

### Failing fixture (PUREBAR-05)
- `~/Downloads/frame2d-model-2026-04-22T06-14-49.json` — original captured failure (will be committed to `tests/fixtures/uat/pure_bar_pratt_captured.json` per D-17)
- 6 nodes, 8 members, bars=[1..5], beams=[6..7..8], pinned at N1 (DOFs 1,2) and N6 (DOFs 16,17), UDL=10 kN/m on top-chord beams, no pinDoF, no springs

### Active todo folded
- `.planning/todos/pending/2026-04-22-frame2d-pure-bar-joint-instability.md` — promoted into Phase 6 scope. Workaround-1 outcome (Kθ 1e-3 spring failed) documented; D-02 explicitly rejects regularisation.

### Prior phase context (for pattern reuse and decision precedent)
- `.planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md` — D-12 (UAT fixtures live in `tests/fixtures/uat/`), D-13 (TestClient pattern for `tests/test_uat_frame2d.py`), D-14 (bug fixes ship with regression tests in-phase)
- `.planning/phases/03-interchange-format-and-external-inputs/` — canonical JSON schema, fixture conventions

### Memory (cross-session knowledge)
- `~/.claude/projects/-Users-catrinevans-Documents-pda-project/memory/solver_theta_dof_provenance.md` — testing-hygiene rule (D-15) and brittleness narrative (Phase 6 is the second manifestation; refactor flagged for "third"). Memory is 3 days old — Phase 6 implementation will refresh / extend it.

### Debug session reference
- `.planning/debug/frame-v2-pin-release-multi.md` — the 2026-04-19 pin-release multi-member investigation (resolved, commit 2dc028b). Same θ-DOF provenance family as Phase 6; back-solve technique used there is referenced for context but not directly reused (different mechanism — that fix recovered an unknown rotation; Phase 6 eliminates a missing rotation).

### Project guardrails
- `CLAUDE.md` — Hard rules: no matplotlib, no printing in `solver_core`; 1-based DOF in public API; layered pipeline (Model → Adapter → Solver → AnalysisResult); validation at boundaries (adapter, API, UI), pure FEM in solver
- `.planning/PROJECT.md` §"Constraints" — same rules echoed; layered architecture is non-negotiable

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`extract_structure_stiffness_matrix`** (`frame_v2.py:420`) already deletes a sorted, deduplicated set of DOF rows/cols from `Kp`. Pure-bar auto-restraint plugs in by extending `removed_dof = self.restrainedDoF + self.pinDoF` to include `self._pure_bar_theta_dofs`. Zero new logic — reuse the proven extraction path.
- **`solve_displacements`** (`frame_v2.py:429`) catches `np.linalg.LinAlgError` and re-raises as `RuntimeError("Singular stiffness matrix...")`. The exception-handler in `app.py` converts it to flat 422. Path is already wired; only the payload shape changes (D-09).
- **`_force_vector_base` reset** (`frame_v2.py:67, 615`) — confirms the solver's idempotency on multiple `solve()` calls. Pure-bar predicate computation in assembly is safe under repeated calls.
- **FastAPI `TestClient` pattern** — already used in `tests/test_uat_frame2d.py` (Phase 4); reuse for TRUST-20's API-level rejection assertion.
- **UAT fixture format** (`tests/fixtures/uat/*.json`) — Phase 4 D-12 established this; D-17 reuses verbatim.
- **`drawSupports()` / canvas symbol pattern** (`script.js`) — Phase 4 spring-coil glyphs; reuse the same drawing primitives for red-dot offending-joint highlights.
- **`errorBanner` UI primitive** (`script.js:2-15`, established Phase 1) — already wired for diagnostic display; reuse for pre-solve warnings (PUREBAR-04).

### Established Patterns

- **Validation at boundaries** (CLAUDE.md): solver is pure FEM, adapters translate, API validates schema (Pydantic) + raises structured exceptions, UI does pre-flight + post-flight checks. D-18 places PUREBAR-03 validation in the adapter, consistent with Phase 4 D-09 (DOF-base computation in adapter).
- **DOF indexing** (1-based public, 0-based internal): pure-bar predicate output `self._pure_bar_theta_dofs` follows the `restrainedDoF` convention — 1-based, list of ints. The θ DOF for node `n` (0-based) is `3*n + 3` (1-based) which equals `(n+1) * 3`.
- **Test pattern** (`tests/test_frame_v2.py`): all frame tests assert global ΣFx/ΣFy + per-node ΣM at shared nodes + analytical comparison where possible. TRUST-12 / TRUST-13..17 are the closest analogues for TRUST-18..20.
- **Backward-compatible API extension** (Phase 4 D-08 for spring schema, Phase 4 D-14 for solver alias): same playbook applies for D-09's structured 422 payload — additive fields, existing readers continue to work.

### Integration Points

- `solver_core/.../solvers/frame_v2.py:398` (`assemble_primary_stiffness_matrix`) — add pure-bar detection
- `solver_core/.../solvers/frame_v2.py:420` (`extract_structure_stiffness_matrix`) — union auto-restraint set
- `solver_core/.../adapters/frame_adapters.py` — `FrameV2Adapter.solve()` precondition for UDL-on-bar
- `api_server/app.py:25-30` — exception handler returns structured 422 when typed exception is raised
- `ui/frame2d/script.js:~445` (payload build) and `:558-577` (solve handler / error display) — pre-solve scan + structured 422 parsing
- `tests/test_frame_v2.py` (end of file) — TRUST-18, TRUST-19, TRUST-20
- `tests/fixtures/uat/pure_bar_pratt_captured.json` — new fixture committed from `~/Downloads/...`

### Creative Options Enabled by Existing Architecture

- The `_pure_bar_theta_dofs` list is a tiny, well-bounded extension to the existing restraint pipeline — auditable, easy to log, easy to revert if anything goes wrong.
- The structured-422 payload is forward-compatible with future failure modes (genuine under-restraint, ill-conditioning) — a `cause` taxonomy can grow without breaking existing parsers.
- Because pure-bar detection runs in assembly (already O(n_members)), and union dedup already exists, the new code adds <30 lines to `frame_v2.py` and ~10 lines to the adapter. Small surface = small regression risk.

</code_context>

<specifics>
## Specific Ideas

- **User's framing of the constraint** (2026-04-26): "*I do not want us to damage our solver, which works apart from when we have bar and beam.*" → encoded as D-05 (no-regression guarantee), D-15 (testing-hygiene lock-in), and D-16 (snapshot-based no-regression test plan). The hard guarantee is: every existing test produces byte-identical (within `np.allclose` tolerance) numerical output before and after the fix.
- **User's prior empirical work** (2026-04-22, todo file): tested Kθ = 1e-3 spring workaround and observed phantom moments at pinned supports + mixed-sign axial in beams + spurious horizontal reactions. This is encoded as D-02 — regularisation is permanently off the table for this phase.
- **Memory carry** (`solver_theta_dof_provenance.md`, 3 days old): "tests must NOT depend on incidental DOF zeroing via pinDoF, restrainedDoF, or any DOF mask". Encoded as D-15. Memory will be re-verified post-implementation; if a third θ-DOF brittleness manifestation surfaces during execution, the memory's "consider a refactor" trigger fires and we surface it as a deferred phase candidate.
- **Hand-calc geometry hint for TRUST-18:** symmetric Pratt with span 4 m, height 1 m, 4 panels — pinned at both top-chord ends gives reactions Vy = 20 kN each by symmetry under 10 kN/m UDL. Top-chord moments by continuous-beam analysis with hinged-equivalent at panel points (analytical derivation goes in the test docstring).
- **The pure-bar predicate is a structural-engineering invariant, not a numerical hack.** A joint where every member is axial-only has, by definition, no rotational degree of freedom that can be physically constrained. Restraining its θ to zero is mechanically correct, not a workaround. Document this in the solver docstring so future readers don't mistake it for regularisation.

</specifics>

<deferred>
## Deferred Ideas

- **Generalised "Structure is unstable" diagnostics.** Phase 6 only handles two known failure modes (pure-bar joint, UDL-on-bar). A future phase could extend the structured-422 payload's `cause` taxonomy to cover genuine under-restraint (e.g. "Node N is under-restrained — only Ux constrained, Uy and θ free") and ill-conditioning. Forward-compatible with D-09's payload shape.
- **`frame_v2` θ-DOF provenance refactor.** Memory `solver_theta_dof_provenance.md` notes this as the second manifestation of θ-DOF brittleness; if a third surfaces during Phase 6 execution or later, a structural refactor (explicit per-DOF provenance tracking during assembly) becomes worth the cost. Defer until then.
- **`truss2d` retirement / unification with `frame_v2`.** Now that `frame_v2` will handle all-bar configs cleanly via D-01, in principle `truss2d` could be reduced to a thin alias. NOT in scope for v1.2 — `truss2d` is mature, faster (2 DOF/node), and battle-tested. Capture as a v2.0+ unification candidate.
- **Pre-solve diagnostics for genuine under-restraint** (UI). Phase 6's pre-solve scan only flags pure-bar joints + UDL-on-bar. A fuller pre-solve pass (every node has at least one non-trivial DOF coverage, no orphan members, etc.) is a future UI/UX enhancement.
- **Validation rule presets** (UI hint dictionary). When the UI flags an issue, link to a help anchor explaining why and how to fix. Defer — banner text is enough for MVP.
- **Persistent diagnostic logs.** A future feature could record failed-solve cases (cause, geometry, what the user changed before re-solving) for analytics. Not now.
- **Prescribed settlement** (carryover from Phase 4 D-02): still deferred. Unrelated to Phase 6 scope.

### Reviewed Todos (not folded)

- None — `2026-04-22-frame2d-pure-bar-joint-instability.md` is fully folded via D-01..D-17. Other April 22 todos (`frame2d-additional-load-and-action-types`, `frame2d-udl-continuous-and-partial`, `frame2d-ui-dimension-tool`, `frame2d-ui-member-inspector-and-edit`) are not in Phase 6 scope (they're feature additions, not the targeted robustness fix).

</deferred>

---

*Phase: 06-frame-v2-pure-bar-joint-robustness*
*Context gathered: 2026-04-26 (autonomous completion delegated by user)*
