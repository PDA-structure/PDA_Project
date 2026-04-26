# Phase 4: 2D Frame Solver + UI Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 04-2d-frame-solver-ui-hardening
**Areas discussed:** Spring UI interaction, Spring visual + schema, Multi-member test list, UAT scope + bug handling

---

## Scope Clarification — Springs vs Prescribed Settlement

Before the gray-area selection, the user mentioned foundation settlement ("support C settles by 5 mm") as the motivating use case. Claude flagged a technical distinction: elastic spring support (stiffness K; what the solver already does) vs. prescribed displacement (known δ; a different FEM concept the solver does not yet support).

**Recommendation given:** Scope Phase 4 to elastic springs only (matches HARDEN-02 + existing solver backend). Defer prescribed settlement to a future phase as a new requirement.

**User's choice:** Accepted. "yes, Go with all four as-is" after the recommendation block.
**Notes:** Prescribed-settlement use case logged in Deferred Ideas for future work.

---

## Side clarification — Spring stiffness units

User asked whether Kx, Ky are linear stiffness and Kθ rotational.

**Answer given:** Yes. Kx, Ky in kN/m (SI: N/m). Kθ in kN·m/rad (SI: N·m/rad). Typical bearing-pad soil stiffness 10,000–100,000 kN/m per support. UI will convert kN→N on submit (×1e3), mirroring the existing GPa→Pa pattern.

---

## Spring UI Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Single "Spring" button + modal | One toolbar button, click node, modal with Kx/Ky/Kθ inputs; blank = free | ✓ |
| Three separate axis buttons | Kx / Ky / Kθ as distinct toolbar modes, each click-a-node-then-prompt | |
| Inline text prompt | No modal; click node → browser prompt() per axis | |
| Spring coexists with classic support | Allow fixed/pinned + spring on same node | |
| Spring replaces classic support | A node is either classic-supported or sprung, not both | ✓ |

**User's choice:** Single "Spring" button + modal; spring replaces any classic support on the node; at least one non-blank K required.
**Notes:** User asked Claude to recommend; recommendation was accepted as-is. Rationale: smallest UI surface, cleanest mental model, no DOF-overlap edge cases.

---

## Spring Visual + Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Per-axis zigzag coil + value tag | Draw coil per active K axis, label `Kx=10000 kN/m` | ✓ |
| Single generic spring glyph | One coil symbol with K values in a tooltip | |
| New top-level `springs` JSON key | Separate from `canvas.supports`, breaks Phase 3 schema | |
| Extend `canvas.supports` to accept object | Value is either string (existing) or `{type:"spring", Kx, Ky, Ktheta}` — backward-compat | ✓ |
| Bump schema_version to "1.1" | Flag the schema change explicitly | |
| Keep schema_version "1.0" (backward-compat) | No version bump; old files still load unchanged | ✓ |

**User's choice:** Per-axis zigzag coil + value tag; extend `canvas.supports` with an object form; no schema_version bump (backward-compat preserved).
**Notes:** Recommendation accepted without change. Phase 3 files continue to load without migration.

---

## Multi-member Test List

User did not select this area in the gray-area multi-select but asked Claude for a recommendation. Recommendation produced, accepted, captured as decision D-10.

| Test | Purpose | Selected |
|------|---------|----------|
| TRUST-13 Portal frame + pinned bases + UDL | ΣM=0 at beam-column joints | ✓ |
| TRUST-14 Two-span continuous + pinRight at shared node + UDL | Generalizes 260418-vcg to multi-span | ✓ |
| TRUST-15 Mixed pinLeft+pinRight at same shared node | Back-solve edge case | ✓ |
| TRUST-16 Spring-support beam | End-to-end HARDEN-02 test; reaction = K·δ | ✓ |
| TRUST-17 Cantilever + propped cantilever in series | Analytical combo case | ✓ |
| New file `tests/test_multi_member.py` | Separate module for multi-member cases | |
| Keep in `tests/test_frame_v2.py` | All frame regression tests in one place | ✓ |

**User's choice:** All five tests, appended to `tests/test_frame_v2.py`.
**Notes:** Pending todo `2026-04-19-multi-member-frame-solver-test-coverage.md` is folded into this scope.

---

## UAT Scope + Bug Handling

User did not select this area in the gray-area multi-select but asked Claude for a recommendation. Recommendation produced, accepted, captured as decisions D-12..D-14.

| Option | Description | Selected |
|--------|-------------|----------|
| JSON fixtures + `test_uat_frame2d.py` via TestClient | CI-runnable, reproducible, no browser needed | ✓ |
| Manual checklist + screenshots in a markdown file | Human-readable but not reproducible | |
| Informal tick-off in phase verification doc | Lightest weight; no CI safety net | |
| Fix UAT-discovered bugs in Phase 4 | This phase IS the bug sweep | ✓ |
| Defer bug fixes to quick-tasks | Keep Phase 4 purely additive | |
| Capture non-bug discoveries (UX/feature) as pending todos | Don't fold into phase scope | ✓ |

**User's choice:** JSON fixtures in `tests/fixtures/uat/` + `tests/test_uat_frame2d.py`; bugs fixed in-phase with regression tests; non-bug ideas captured as todos.
**Notes:** Each bug fix should be a separate commit with its regression test.

---

## Claude's Discretion

- Exact pixel geometry / styling of the spring coil symbol (wave count, amplitude, color) — match `drawSupports()` style
- Whether the spring modal uses `<dialog>` vs existing sidebar-panel pattern — whichever is most consistent with existing UDL / section-calculator modals
- Hand-calculated reference values for TRUST-16 and TRUST-17 — derive in the test docstring
- Whether to close the folded pending todo automatically when TRUST-13..17 turn green (yes — close at phase completion)

## Deferred Ideas

- Prescribed settlement support (nonzero Dirichlet BC) — user's original mental model; requires solver changes; new phase later.
- Soil stiffness presets / helper dropdown in the spring modal — UX nicety.
- Rotational spring presets for semi-rigid connection types — overlaps with 999.3 design-solver backlog.
