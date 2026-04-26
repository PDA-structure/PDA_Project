# Phase 6: frame_v2 — Pure-Bar Joint Robustness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 06-frame-v2-pure-bar-joint-robustness
**Areas discussed:** Scope (clarification), θ-DOF elimination strategy, UDL-on-bars policy, Diagnostics + 422 payload, Regression test design, Validation placement
**Mode:** Interactive start, then user delegated autonomous completion.

---

## Initial Gray Areas Presented

| Option | Description | Selected |
|--------|-------------|----------|
| θ-DOF elimination strategy | Implicit restraint vs explicit Ks drop vs detect+raise | (used during autonomous decisioning) |
| UDL-on-bars policy | Reject at API / silent convert / UI-only / combo | ✓ |
| Pre-solve diagnostics + 422 payload | UI scan / structured payload / both | (used during autonomous decisioning) |
| Regression test design | Captured fixture vs symmetric Pratt vs both | (used during autonomous decisioning) |

**User's initial selection:** UDL-on-bars policy only.

**Clarification raised by Claude:** the captured failing fixture (`~/Downloads/frame2d-model-2026-04-22T06-14-49.json`) does not actually trigger the UDL-on-bars bug — its UDL is on top-chord beams (members 5, 6, 7), and bars (members 1–5) carry no UDL. The 422 on that fixture comes from the pure-bar joint singularity at N2/N4, which is PUREBAR-01/02, not PUREBAR-03. Scoping the phase to UDL-only would leave the original blocker unfixed.

**User's hard constraint stated:** "I do not want us to damage our solver, which works apart from when we have bar and beam." → Encoded throughout CONTEXT.md as D-05 (no-regression guarantee), D-15 (testing hygiene), D-16 (snapshot-based no-regression test plan).

**User's delegation:** "I trust your recommendation. I need to go, can you do it without my assistance?" → Claude proceeded autonomously, locking in decisions consistent with the prior context, the user's hard constraint, and the testing-hygiene memory.

---

## θ-DOF Elimination Strategy (PUREBAR-01, PUREBAR-02)

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Implicit restraint (append pure-bar θ DOFs to restraint set in assembly) | Reuses proven `extract_structure_stiffness_matrix` pipeline; smallest code surface; predicate fires only for hybrid case (no regression to non-hybrid models); mechanically correct (a node with no rotational element has no DOF to constrain) | Requires careful predicate exclusions for `springDoF`/`pinDoF` overlap | ✓ |
| Explicit Ks row/col drop | More flexibility for future failure modes | More invasive; doesn't reuse the extraction pipeline; bigger blast radius | |
| Regularisation (tiny Kθ on diagonal) | One-line fix | User already proved on 2026-04-22 that this corrupts the load path (phantom moments, mixed-sign axial, spurious horizontals) — permanently off the table | |
| Detect + raise typed error | Predictable failure mode | Doesn't satisfy PUREBAR-02 ("hybrid models solve correctly") — would still 422 the captured fixture | |

**Recorded:** D-01, D-02, D-03, D-04, D-05.

---

## UDL-on-Bars Policy (PUREBAR-03)

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Reject at adapter with structured `SolverDiagnosticError` (cause="udl_on_bar") | Loud failure; prevents silent mis-modelling; correct architectural placement (CLAUDE.md: adapter owns translation/validation); typed error feeds structured 422 | None significant | ✓ |
| Silent convert to nodal forces (wL/2 each end) | Backward-compatible with current "silent skip" | Masks an engineering mistake the user almost certainly made (mis-typed member type) — loud failure is the right UX | |
| UI-only validation | Lightest touch | Solver / adapter still vulnerable to programmatic callers and external clients | |

**Recorded:** D-06, D-07, D-08.

---

## Diagnostics + 422 Payload (PUREBAR-04)

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Pre-solve UI scan + structured 422 payload (both) | UI catches issues pre-flight; structured payload covers cases UI didn't anticipate; consistent visual treatment for offending nodes/members | More surface to test, but each piece is small | ✓ |
| Structured 422 only | Single source of truth | User waits for round-trip to learn about issues that could be caught client-side | |
| Pre-solve UI scan only | Fast feedback | API still returns flat "structure is unstable" for any failure outside the UI's awareness | |

**Recorded:** D-09, D-10, D-11, D-12, D-13.

---

## Regression Test Design (PUREBAR-05)

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Captured fixture (TRUST-19) + symmetric Pratt analytical (TRUST-18) + UDL-on-bar rejection (TRUST-20) | Three complementary tests: replays the original failure, hand-verifiable analytical, exception-path coverage | Slightly more work than minimal coverage | ✓ |
| Captured fixture only | Smallest test footprint | No analytical verification — can't distinguish "fix worked" from "test happens to pass" | |
| Symmetric Pratt only | Hand-calc verifiable | Doesn't replay the user's actual reported failure | |

**Testing hygiene rule (locked):** TRUST-18/19/20 must verify correctness without relying on incidental DOF zeroing via `pinDoF` or `restrainedDoF` covering the auto-restrained θ DOFs. Source: memory `solver_theta_dof_provenance.md` (the prior pin-release multi-member bug was masked for weeks by exactly this trap).

**No-regression test plan (D-16):** snapshot all 43 existing tests' numerical outputs before/after; assert byte-identical (`np.allclose` tolerance) for every non-hybrid case. This is the executable form of the user's hard constraint.

**Recorded:** D-14, D-15, D-16, D-17.

---

## Validation Placement (Architecture)

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Layered (solver / adapter / API / UI) per CLAUDE.md | Each layer owns its concern; matches existing pattern; auditable | None | ✓ |
| All in solver | Single point | Violates CLAUDE.md ("no printing in solver"; pure FEM); concentrates blast radius | |
| All at API / UI | Skips solver invariants | Solver remains vulnerable to programmatic callers | |

**Recorded:** D-18.

---

## Claude's Discretion

- Exception class name (`SolverDiagnosticError` vs alternatives)
- Predicate caching strategy (recompute per assembly call by default)
- Pre-solve UI scan placement (inline vs separate function)
- Canvas highlight visual style (red dot, red outline, both)
- Pratt geometry exact parameters for TRUST-18 (span / panels / height)
- Structured-422 attribute names (`cause`, `offending_nodes`, `offending_members`)

## Deferred Ideas

- Generalised under-restraint diagnostics (future phase, forward-compatible with D-09)
- `frame_v2` θ-DOF provenance refactor (memory trigger: "third manifestation")
- `truss2d` ⇄ `frame_v2` unification (v2.0+ candidate)
- Persistent diagnostic logs / analytics
- UI help-anchor links for diagnostic messages
- Prescribed settlement BCs (carryover from Phase 4)
- Other April 22 todos (load types, continuous/partial UDL, dimension tool, member inspector) — not in scope; remain pending todos

---

*This log is for human / audit reference only. Decisions of record live in CONTEXT.md.*
