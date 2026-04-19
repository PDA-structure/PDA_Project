# Phase 4: 2D Frame Solver + UI Hardening - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the existing 2D frame solver and UI by (1) adding multi-member regression test coverage for shared-node / mixed pin-release / UDL interactions, (2) exposing the already-implemented elastic spring supports (`springDoF`/`springStiffness`) in the frame2d browser UI, and (3) running a repeatable UAT across five canonical structural cases and fixing any bugs surfaced.

**In scope:** New multi-member pytest cases, a "Spring" support tool in the frame2d UI (Kx, Ky, Kθ), canvas round-trip for spring supports, JSON fixtures + UAT test harness, fixes for bugs discovered during UAT.

**Not in scope:** Prescribed-settlement boundary conditions (e.g. "support C settles 5 mm") — that is a different FEM concept (nonzero Dirichlet BC) requiring solver changes; deferred to a future phase. Grillage solver (v1.3+ Phase 7). Revit work (Phases 5–6).

</domain>

<decisions>
## Implementation Decisions

### Scope Clarification — Springs vs Settlement

- **D-01:** Phase 4 implements **elastic spring supports only** — user specifies a stiffness K and the support deflects by F/K under load. This matches the solver's existing `springDoF`/`springStiffness` backend and HARDEN-02 as written.
- **D-02:** **Prescribed settlement** (user specifies a known displacement, e.g. 5 mm, rather than a stiffness) is explicitly **deferred**. It needs a nonzero Dirichlet BC in the solver and is captured in Deferred Ideas for a future phase.

### Spring UI Interaction (HARDEN-02)

- **D-03:** Single **"Spring" toolbar button** added to the Supports group in `ui/frame2d/index.html`, alongside fixed / pinned / rollerX / rollerY. Button uses `data-mode="spring"` following the existing `setMode` pattern.
- **D-04:** Clicking a node in `spring` mode opens a **modal** with three inputs: `Kx` (kN/m), `Ky` (kN/m), `Kθ` (kN·m/rad). Blank = that DOF is free; no spring added for that axis. Unit conversions on submit: kN/m → N/m (×1e3), kN·m/rad → N·m/rad (×1e3) before building the solve payload.
- **D-05:** A spring **replaces** any existing classic support (fixed / pinned / rollerX / rollerY) at the target node. A node has either springs OR a classic support, never both. Keeps the mental model clean and avoids the edge case of a fixed DOF + spring on the same DOF.
- **D-06:** At least **one non-blank K value is required** to create the spring support; submitting with all three blank is treated as cancel. Editing an existing spring reopens the modal pre-filled with the current values.

### Spring Visual + Schema (HARDEN-02)

- **D-07:** Canvas symbol for a spring is a short **zigzag coil drawn per active axis** — horizontal coil for Kx (drawn on the node's −x side), vertical coil for Ky (drawn below the node), small spiral arc for Kθ (drawn around the node). Plus a value tag label showing `Kx=10,000 kN/m` (etc.) near the node. Coils are only drawn for axes where K is non-blank.
- **D-08:** **Canonical JSON schema extension** — `canvas.supports[nodeId]` may now be either:
  - an existing string (`"fixed"`, `"pinned"`, `"rollerX"`, `"rollerY"`), OR
  - a spring object: `{"type": "spring", "Kx": number|null, "Ky": number|null, "Ktheta": number|null}` (K values stored in the UI's user-facing units: kN/m and kN·m/rad).
  Loaders detect which form is present and restore accordingly. **Backward-compatible** with Phase 3 files — no `schema_version` bump needed.
- **D-09:** On solve, the UI populates `springDoF` / `springStiffness` in the payload (currently hardcoded to `[]` at `ui/frame2d/script.js:445`). DOF indices computed from node ID + axis: `base = nodeId*3 + 1`; Kx→base, Ky→base+1, Kθ→base+2. Stiffness values passed in SI base units (N/m, N·m/rad).

### Multi-Member Test Coverage (HARDEN-01)

- **D-10:** Add **5 new tests (TRUST-13..17)** in `tests/test_frame_v2.py`, following the established pattern (global ΣFx/ΣFy equilibrium + node-level ΣM at shared nodes + M=0 at released ends + analytical comparison where possible):
  - **TRUST-13** — Portal frame with pinned column bases + UDL on beam; assert ΣM = 0 at each beam-column joint.
  - **TRUST-14** — Two-span continuous beam, `beamPinRight` on span 1 at shared interior node, UDL on span 1 only. Generalizes the 260418-vcg regression to a multi-span setup.
  - **TRUST-15** — Mixed `beamPinLeft` (span 2) + `beamPinRight` (span 1) at same shared interior node. Edge case for the `solve_member_actions` back-solve when both members at a node have released θ.
  - **TRUST-16** — Simply-supported beam with a Ky spring at one end; verify reaction = K·δ and equilibrium. Doubles as the end-to-end test for HARDEN-02 (model → adapter → solver → result).
  - **TRUST-17** — Cantilever + propped cantilever in series (two members, interior moment release, one pinned support + one roller). Analytical hand-calc comparison.
- **D-11:** All new tests live in the **existing `tests/test_frame_v2.py`** — do not create a new test file. Keeps all frame regression tests in one place.

### UAT Pass — 5 Canonical Cases (HARDEN-03)

- **D-12:** UAT is documented via **saved JSON fixtures** — one file per canonical case in `tests/fixtures/uat/` (`cantilever.json`, `simple_beam.json`, `portal_frame.json`, `continuous_pin_release.json`, `spring_support_beam.json`). Each fixture is produced by building the model in the frame2d UI, saving via the Phase 3 Save button, then committing the JSON.
- **D-13:** New test file **`tests/test_uat_frame2d.py`** loads each fixture, POSTs to `/solve/frame2d` via FastAPI `TestClient`, and asserts reactions and key displacements against hand-calculated reference values defined inline in the test. CI-runnable and reproducible; no browser needed to re-verify.
- **D-14:** **Bugs discovered during UAT → fix in Phase 4** with a dedicated regression test committed alongside the fix. This phase is explicitly the bug sweep. Non-bug discoveries (UX nits, feature ideas) are captured as pending todos, not folded into scope.

### Claude's Discretion

- Exact pixel geometry of the spring coil symbol (wave count, amplitude, color) — follow the existing support-symbol style in `drawSupports()`.
- Whether the spring modal uses a `<dialog>` element or the existing sidebar-panel pattern — whichever is more consistent with the UDL / section-calculator modals already in the UI.
- Hand-calculated reference values for TRUST-16 (spring) and TRUST-17 (cantilever+propped combo) — derive in the test docstring.
- Whether to fold the pending todo `2026-04-19-multi-member-frame-solver-test-coverage.md` into the completed set as soon as TRUST-13..17 are green (yes — mark it completed at phase close).

### Folded Todos

- **Multi-member frame solver test coverage** (`.planning/todos/pending/2026-04-19-multi-member-frame-solver-test-coverage.md`) — absorbed into HARDEN-01 via D-10. The todo's proposed 5-case list aligns with TRUST-13..17 above; the sympy / hand-derived analytical comparisons the todo suggests are captured by "analytical comparison where possible" in D-10.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Solver + Model (spring backend is already implemented; UI is the new surface)
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py` — `add_spring_stiffnesses()` method (lines 411–418) and `springDoF` / `springStiffness` init (lines 52–53, 73–74, 112). Assembly already calls `add_spring_stiffnesses()` at line 618.
- `solver_core/src/pda_analysis_software/models/frame2d_model.py` — `FrameModel2D` dataclass; `springDoF: Optional[List[int]]` and `springStiffness: Optional[List[float]]` already defined.
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` — `FrameV2Adapter` passes spring fields through to the solver.

### API Schema
- `api_server/app.py` — `Frame2DRequest` Pydantic model; the UI payload must match exactly.

### UI (integration point for HARDEN-02)
- `ui/frame2d/index.html` — Supports toolbar group (lines ~32–50) is where the Spring button is added.
- `ui/frame2d/script.js` — `setMode()` dispatcher, `supports` array, `drawSupports()` rendering, and the solve payload builder. The `springDoF: []` / `springStiffness: []` hardcode is at **line 445** (and at line 1304 for the Save function).

### Canonical JSON Schema (extended, not broken)
- `.planning/milestones/v1.1-phases/03-interchange-format-and-external-inputs/03-CONTEXT.md` — §D-01..D-04 define the Phase 3 save/load schema. D-02 specifies the `canvas.supports` string-type convention that this phase extends to accept spring objects.
- `tests/fixtures/sample_pda_frame2d.json` — reference example of the Phase 3 schema.

### Test Patterns (for TRUST-13..17)
- `tests/test_frame_v2.py` — existing TRUST-01..TRUST-12 establish the equilibrium-assertion + analytical-comparison pattern. TRUST-12 (lines ~546–596) is the closest analog for the new multi-member cases.

### Pending Todo Folded Into Scope
- `.planning/todos/pending/2026-04-19-multi-member-frame-solver-test-coverage.md` — the proposed test list; honoured via D-10.

### Requirements
- `.planning/REQUIREMENTS.md` — HARDEN-01, HARDEN-02, HARDEN-03.
- `.planning/ROADMAP.md` — Phase 4 section (lines ~111–122) defines the three success criteria.

### Project Guardrails
- `CLAUDE.md` — Hard rules: no matplotlib / no printing in `solver_core`; 1-based DOF in public API; add-a-solver checklist (relevant because HARDEN-02 touches the Model/Adapter/UI path, though no new solver is added).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Solver spring backend** (`frame_v2.py:411`) — `add_spring_stiffnesses()` is already wired into the assembly pipeline. Phase 4 does not touch the solver.
- **Frame model fields** (`frame2d_model.py:33–34`) — `springDoF` / `springStiffness` already on `FrameModel2D`. No dataclass change needed.
- **Support drawing pattern** (`ui/frame2d/script.js` `drawSupports()`) — existing fixed/pinned/roller glyphs. The spring coil symbol should live alongside these as a new branch.
- **Modal pattern** — UDL input and section-calculator popups in the frame2d UI are the visual reference for the spring modal.
- **FastAPI TestClient pattern** — already used in v1.1 Phase 3 interchange integration tests; reuse for `test_uat_frame2d.py`.

### Established Patterns
- **Support types as strings** in `canvas.supports` (Phase 3 D-02). Phase 4 extends this to also accept a spring object — backward-compatible with every Phase 3 saved file.
- **DOF indexing**: `base = nodeId*3 + 1` (1-based). Applies uniformly to springs (Kx→base, Ky→base+1, Kθ→base+2).
- **UI unit conversions** (E GPa→Pa ×1e9, A cm²→m² ×1e-4, I cm⁴→m⁴ ×1e-8). Add analogous: Kx/Ky kN/m→N/m ×1e3, Kθ kN·m/rad→N·m/rad ×1e3.
- **Test pattern** — all frame tests assert reaction-DOF equilibrium; TRUST-12 is the template for multi-member cases with shared interior nodes.

### Integration Points
- `ui/frame2d/index.html` toolbar — new `<button data-mode="spring">` button.
- `ui/frame2d/script.js:setMode()` — new `'spring'` branch that opens the modal.
- `ui/frame2d/script.js:~445, ~1304` — replace the hardcoded `springDoF: []` / `springStiffness: []` with real values derived from the `supports` array.
- `ui/frame2d/script.js:drawSupports()` — new case for spring node rendering.
- `tests/test_frame_v2.py` — five new `test_*` functions at the end of the file.
- `tests/test_uat_frame2d.py` + `tests/fixtures/uat/*.json` — new UAT harness.

</code_context>

<specifics>
## Specific Ideas

- User's mental reference for spring use case: **foundation settlement** (e.g. "support C settles 5 mm"). This was clarified during discussion — strictly, that is a prescribed-displacement problem, not a spring problem. Phase 4 gives the user a spring that approximates it (soil stiffness K ≈ expected load / expected settlement), and logs the dedicated prescribed-displacement feature as a deferred idea.
- Soil stiffness sanity range from discussion: 10,000–100,000 kN/m typical for bearing-pad foundations. UI should accept any positive value — no hard cap — but documentation / placeholder text should hint at this range.
- TRUST-14 / TRUST-15 are the most important new tests — they generalize the 260418-vcg pin-release + UDL regression to multi-member topologies. These should be written and reviewed first before the spring and cantilever-combo tests.

</specifics>

<deferred>
## Deferred Ideas

- **Prescribed settlement support** — user specifies a known displacement (e.g. 5 mm) at a node rather than a stiffness. Requires a nonzero Dirichlet BC in the solver (either penalty method or direct substitution). A new requirement + phase; natural fit for v1.3+ once Revit-as-UI milestone lands. Capture motivating example: "Support C settles by 5 mm — compute redistributed moments."
- **Soil stiffness presets / helper** — a dropdown of typical K values for common foundation/soil combinations. UX nicety, not essential. Log if users ask for it.
- **Rotational spring helper for partial fixity** — a Kθ preset library representing common connection types (e.g. semi-rigid steel connections). Design-code territory; overlaps with the backlog Phase 999.3 design-solver work.

### Reviewed Todos (not folded)
- None — the only matched pending todo (multi-member test coverage) was folded via D-10.

</deferred>

---

*Phase: 04-2d-frame-solver-ui-hardening*
*Context gathered: 2026-04-19*
