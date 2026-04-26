# Project Research Summary

**Project:** PDA Analysis Software
**Domain:** v1.3 — Revit Tier 2 (Analytical Exporter Hardening) + Revit Results-Import + Grillage Solver
**Researched:** 2026-04-26
**Confidence:** HIGH on grillage path and on the Revit-version drift map; MEDIUM on the Revit ↔ JSON id-durability scheme (dual-key UniqueId+ElementId is the right call but requires phase-level enforcement, not language-level enforcement)

> **This document is the single research input** consumed by requirements-definition and the roadmapper. The four detailed files (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md) are reference material; everything load-bearing for roadmap decisions is captured here.

---

## Executive Summary

v1.3 closes out three carry-over features that share almost no code surface but combine into one milestone: **Revit Tier 2 hardening** (a sibling-repo pyRevit pushbutton that exports the analytical model to canonical PDA JSON), **Revit Results-Import** (a sibling-repo pyRevit pushbutton that annotates the Revit analytical model with solver output), and the **Grillage Solver** (a 3-DOF/node planar grid FEM in `solver_core` with a new `/solve/grillage` endpoint). The four research files agree strongly on every load-bearing decision below — there is no internal disagreement to resolve.

The recommended approach: **zero new runtime dependencies on the `pda_project/` side**. Grillage is a pure-numpy addition that mirrors `frame_v2`'s structure (Model → Adapter → Solver → AnalysisResult), the new `/solve/grillage` endpoint mirrors `/solve/frame2d`, and the snapshot regression gate (D-16) extends mechanically. On the Revit side (sibling `CustomRevitExtension` repo) there is also no `pip install` — Revit work runs inside pyRevit's IronPython 2.7 engine. The single new shared module is **`lib/Snippets/_pda_export_common.py`** (also referenced as `pda_revit_utils.py` in STACK), which centralises three drift points: ElementId 32→64-bit access, ForgeTypeId-aware unit conversion, and the post-geometry pipeline (`_q4`, `_get_or_add_node`, `_merge_and_split`, `_sort_nodes_lexicographic`, `build_canvas_block`) currently duplicated across the two Tier 1 pushbuttons.

The four critical risks are: **(C1) ElementId.IntegerValue throws on Revit 2024+** for large-id models — must be wrapped in a version-aware helper from day one; **(C2) Tier 2 must emit dual-key (UniqueId + ElementId)** — UniqueId-only is durable across save/reopen/copy where ElementId is not, and Results-Import permanently breaks if T2 ships single-key; **(C3) grillage must NOT inherit `frame_v2`'s ENMoment sign convention or `_pure_bar_theta_dofs` machinery** — DOF semantics differ (Uz/θx/θy vs Ux/Uy/θ), so the sign convention is wrong by axis even when the formula looks right; **(C4) pure-bar joint detection must NOT carry into grillage** — every grillage element supports both bending and torsion, "pure-bar" doesn't translate, and a silent θx/θy auto-restraint produces "looks too stiff" results that pass equilibrium checks. All four are mitigated by phase-level enforcement (helper modules, schema decisions, hand-derived sign-convention docstrings, equilibrium checks on three equations not one) rather than by tooling.

---

## Key Findings

### Recommended Stack

**No new runtime dependencies.** The validated v1.2 baseline (Python 3.10.11, numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2, httpx ≥0.27 for TestClient) carries v1.3 unchanged. Grillage uses `numpy.linalg.solve` — same dense-solve pattern as `frame_v2`, same DOF scale (50–500 DOF for realistic decks). **Do NOT add scipy** (D-09 / Out-of-Scope).

**Optional dev-only (not yet committed):**
- `sympy ≥ 1.12` — closed-form verification for messy grillage analytical cases (only adopt if first 2–3 tests prove painful by hand)
- `pytest-cov ≥ 5.0` — coverage reporting; defer if not painful

**Revit-side (sibling `CustomRevitExtension` repo — manual-copy deploy on Windows):**
- Revit version matrix: **2023, 2024, 2025**
- pyRevit: **pin ≥ 5.0 latest stable; AVOID 5.1.x specifically** until verified on the Windows host (forum-reported IronPython 2.7 loader regression on Revit 2025)
- IronPython 2.7.12 — keep for v1.3; CPython3 migration deferred
- New shared module **`Analytical.extension/lib/Snippets/_pda_export_common.py`** — single file, no `pip`

See `.planning/research/STACK.md` for full version-compatibility matrix and source citations.

### Expected Features (per v1.3 feature)

#### A. Revit Tier 2 — Analytical Exporter Hardening — **Complexity MEDIUM-HIGH**

**Table stakes (must ship in v1.3):**
- Read `AnalyticalMember` from active doc (Revit 2023+; fail fast on 2022)
- Extract member geometry (start/end XYZ, feet → metres × 0.3048, 4dp rounding)
- View-plane projection from active plan/elevation/section view (reject `View3D`, `ViewSchedule`)
- View-type guard (mirror Tier 1 pattern)
- Extract supports from `BoundaryConditions` (fixed/pinned/roller → `restrainedDoF`)
- Extract section properties (E, I, A) via `AnalyticalToPhysicalAssociationManager` → physical FamilySymbol → `BuiltInParameter.STRUCTURAL_SECTION_*`
- Revit 2023/24/25 compatibility (single `AnalyticalMember` code path; per-version drift via helper module)
- Round-trip into frame2d UI (canonical JSON v1.0 — already supported)
- Unit conversion via `UnitUtils.ConvertFromInternalUnits` + `UnitTypeId`
- Diagnostic output (skipped members + reason; don't fail whole export on one bad member)
- **Emit `revit_meta` block in JSON output** (dual-key per member: `analytical_member_unique_id` + `revit_eid` — promoted from differentiator to table-stakes because Results-Import depends on it)

**Differentiators (v1.3 if scope allows):**
- Load extraction from analytical loads (`PointLoad`, `LineLoad`)
- Pin-release detection from `AnalyticalMember.StartRelease` / `EndRelease`
- Spring supports from `BoundaryConditions` translation/rotation parameters
- Section-property fallback hierarchy (analytical → physical type → labeled default; never silent zero)

**Anti-features:** Support Revit ≤2022; auto-translate 3D→2D; bidirectional sync; smart topology cleanup; export every analytical-model field; export to IFC/SAF/CIS/2.

#### B. Revit Results-Import — **Complexity MEDIUM**

**Hard dependency:** A must emit `revit_meta` with dual-key. Without it, B falls back to geometry matching (substantial complexity for no payoff).

**Table stakes:**
- Read solver output JSON (reuse `AnalysisResult` JSON shape from v1.0 export)
- Match members back to Revit elements via `revit_meta` (UniqueId-first via `doc.GetElement(uid)`, ElementId fallback)
- Tag analytical members with peak axial / shear / moment (`TextNote.Create` at member midpoint)
- Place reaction values at supports (`TextNote.Create` at support node's projected XY)
- Idempotent re-import (delete previous results before placing new — shared `Comments` parameter or workset)
- Active view = annotation view (don't auto-create new views)
- Unit-aware formatting via `UnitFormatUtils.Format`
- Single-transaction wrap with explicit `Start()/Commit()/RollBack()`

**Differentiators (v1.3 if scope allows):** Deformed-geometry overlay via `DirectShape`; user-selectable result quantity; color-code by stress utilisation; results legend.

**Anti-features:** Modify analytical-member geometry; auto-create design checks; permanently push displacement values into shared parameters; "live" auto-refresh; annotate every member with every result; BMD as 3D extrusion.

#### C. Grillage Solver — **Complexity MEDIUM** (API + tests). MEDIUM-HIGH with browser UI.

**Strong recommendation: ship API + tests for v1.3; defer UI to v1.3.x or v1.4.** UX problem of "render Mx/My/T on top-down plan view" is a substantive UX research item.

**Table stakes:**
- 3 DOF/node: **Uz (vertical), θx (rotation about global X), θy (rotation about global Y)** — different DOF semantics from frame_v2's `[Ux, Uy, θ]`
- Per-member EI (bending) AND GJ (torsion) — **separate `G` and `J` fields** in `GrillageModel`; do NOT auto-derive G from E
- Vertical point loads at nodes
- Vertical UDL on members (positive = downward)
- Fixed and pinned supports (1-based DOF numbering, frame_v2 pattern)
- FastAPI `POST /solve/grillage` with Pydantic `GrillageRequest` (additive `revit_meta: Optional[dict] = None`)
- 3+ analytical test cases with hand-calc verification + **three-equation equilibrium asserts** (Uz, θx, θy)
  - (a) Single beam under point load (degenerate to 1D Euler-Bernoulli)
  - (b) Hambly two-beam grillage cross under central load (canonical verification)
  - (c) Single fixed-fixed beam under applied torque (GJ block verification)
  - **Plus one cross-coupled bending+torsion case** (eccentrically-loaded edge member)
- Snapshot regression baseline (D-16) — captured BEFORE any solver tweak
- AnalysisResult mapping: `member_shears (m,2)`, `member_moments (m,2)` (bending), `meta["member_torsions"] (m,2)` — keep AnalysisResult shape stable across solvers

**Differentiators (v1.3.x or v1.4):** Spring supports; pin releases; skewed/non-orthogonal grids; browser UI; bridge-deck presets; distributed torque.

**Anti-features:** Plate/shell elements; auto-mesh; dynamic/modal; non-linear material; 3D space-frame; reuse frame_v2 via "just rotate coordinate system"; browser UI before solver tests pass.

### Architecture Approach

**The layered pipeline (Model → Adapter → Solver → AnalysisResult → API) does NOT change shape in v1.3.** All three features are pure additions.

**Major new components:**

1. **`solver_core/.../solvers/grillage.py`** (NEW) — `BeamGrillage` class, pure numpy FEM, 3 DOF/node (Uz, θx, θy), 6×6 local stiffness with decoupled GJ torsion block. **Hand-derived from scratch — NOT copy-pasted from frame_v2.**

2. **`solver_core/.../models/grillage_model.py`** (NEW) — `GrillageModel` dataclass with `nodes (n,2)`, `members (m,2)`, `ENForces (m,2)` (vertical), `ENMoments (m,2)` (bending), `ENTorsions (m,2)` (NEW — separate field from ENMoments), `forceVector`, `E`, `I`, `G`, `J` as `Union[float, List[float]]`, `restrainedDoF`/`pinDoF`/`springDoF`/`springStiffness`.

3. **`solver_core/.../adapters/grillage_adapters.py`** (NEW) — `GrillageAdapter`, validates G/J presence (raise `SolverDiagnosticError(cause="missing_torsional_properties")` if missing/≤0), length checks, DOF range checks. Returns `AnalysisResult` with `solver="grillage"`.

4. **`api_server/app.py`** (MODIFIED) — register `engine.register("grillage", lambda m: GrillageAdapter(m))`; add `POST /solve/grillage` with `GrillageRequest`; **add optional `revit_meta: Optional[dict] = None` to `Frame2DRequest` AND `GrillageRequest`**; echo back in response (passthrough).

5. **`scripts/_snapshot_common.py`** (MODIFIED) — add `BeamGrillage.solve_structure` to monkey-patch list. **Verify after Phase 1 lands** (CF5 silent failure mode).

6. **`tests/test_grillage.py`** + **`tests/snapshots/baseline/`** (NEW) — 3+ analytical tests with hand-calc + three-equation equilibrium asserts; baselines captured BEFORE solver mutation (D-16).

7. **Sibling repo: `Analytical.extension/lib/Snippets/_pda_export_common.py`** (NEW) — shared post-geometry pipeline lifted from the two Tier 1 pushbuttons + new helpers (`element_id_value`, `feet_to_metres`, `internal_to_si`, `get_associated_physical`, `get_section_properties`). Both Tier 1 pushbuttons refactored to import. Tier 2 imports. `pda_project/pyrevit_exporters/export_to_pda.py` **retired** (move to `archive/` or delete).

8. **Sibling repo: new pushbuttons** — `Analytical.panel/StructuralAnalyticalModel.pushbutton/` (Tier 2 — currently 0-byte scaffold), `Analytical.panel/ImportPDAResults.pushbutton/` (Results-Import), `Setup.panel/` for shared-parameter binding (avoids 3-column-per-stack pyRevit limit).

**The `revit_meta` block (additive, passthrough):**
```json
{
  "schema_version": "1.0",
  "solver": "frame2d",
  "nodes": [...], "members": [...],
  "revit_meta": {
    "source": "revit_tier2",
    "revit_version": "2024",
    "exported_at": "2026-04-26T14:30:00Z",
    "view": {"id": 12345, "name": "Plan Level 0", "type": "ViewPlan"},
    "nodes": [{"index": 0, "analytical_node_unique_id": "abc-..."}, ...],
    "members": [{"index": 0, "analytical_member_unique_id": "ghi-...", "revit_eid": "12345", "section_family_symbol": "UB 305x165x40"}, ...]
  }
}
```
- `schema_version` stays at `"1.0"` (additive)
- Tier 1 (drafting-view) does NOT emit `revit_meta` — no analytical model to round-trip
- Solver/adapter MUST NOT read `revit_meta` — coupling solver_core to a UI source is the cardinal anti-pattern

See `.planning/research/ARCHITECTURE.md` for full component breakdown, the 6×6 grillage local stiffness derivation, and the helper-sharing analysis.

### Critical Pitfalls

> Top 4 from `.planning/research/PITFALLS.md`. Mitigated by phase-level enforcement, not by tooling.

1. **C1: `ElementId.IntegerValue` throws `OverflowException` on Revit 2024+ for ids > 2³¹** — wrap every ElementId access in centralised `element_id_value(eid)` helper from day one. Add UAT fixture using a synthetic high-id model. **Phase ownership: REVIT-T2-01.**

2. **C2: Tier 2 emitting unstable ids breaks Results-Import permanently** — `ElementId.IntegerValue` is session-stable but NOT edit-stable. **Mitigation: emit dual-key `{revit_uid: <UniqueId GUID>, revit_eid: <Int64-as-string>}` per member.** Resolution order in import: `revit_uid` → `revit_eid` → structured-422-style failure list. **Order T2 schema decision (REVIT-T2-02) BEFORE Results-Import phase starts.** **Phase ownership: REVIT-T2-02.**

3. **C3: Inheriting frame_v2's ENMoment sign convention into grillage produces silently wrong moments and torsion** — frame_v2 has `[Ux, Uy, θ]` in-plane; grillage has `[Uz, θx, θy]` out-of-plane PLUS torsion. **Mitigation: hand-derive 6×6 grillage element stiffness from scratch; document sign convention in solver docstring; first analytical test hand-checked, includes cross-coupled bending+torsion case; equilibrium check is THREE equations.** **Phase ownership: Grillage Plan 1 + Plan 2.**

4. **C4: Pure-bar joint detection silently mis-fires on grillage** — frame_v2 pattern doesn't translate (every grillage element supports both bending and torsion). Silent failure: solver auto-restrains θx/θy that user wanted free; passes equilibrium. **Mitigation: grillage solver does NOT inherit `_pure_bar_theta_dofs` machinery; flat class hierarchy (siblings, not parent/child); explicit "no pure-bar machinery" comment; analytical test with two collinear members at unsupported interior joint asserts `θx, θy ≠ 0`.** **Phase ownership: Grillage Plan 1.**

**Moderate pitfalls** (full list in PITFALLS.md):
- M1: View-plane projection on non-projection views — whitelist `ViewType` (Tier 1 pattern)
- M2: Family parameter scope variability swallows E/I/A — multi-source lookup with `meta.E_source` per member; reject 0.0 as missing
- M3: Transaction boundaries for Results-Import — explicit `Start/Commit/RollBack`, check `param.IsReadOnly` before `Set()`, use shared parameters not built-in
- M4: pyRevit ribbon stack 3-column limit — split into two panels (Analytical + Setup)
- M5: Manual-copy Windows deployment friction — every Revit phase plan must include deploy step
- M6: Snapshot baseline ordering (D-16) — capture grillage baselines BEFORE any solver tweak; verify commit-hash ordering
- M7: `AnalyticalMember.GetCurve()` returns 3D — project onto active view's plane; reject members > 0.05m off plane

**Cross-feature pitfalls:**
- CF1: Results-Import built before T2 emits stable ids → milestone-scale rework — **enforce ordering: T2 schema first**
- CF2: Untracked solver_core scaffolding files recur as worktree-mirror friction — **commit as pre-grillage prep step**
- CF3: Schema version drift between solver_core and pyRevit extension — **pinned compat test: pyRevit-emitted JSON fixture posted via TestClient**
- CF4: Adapter validation drift — grillage adapter must `raise SolverDiagnosticError` for `length_zero`, `gj_invalid`, `dof_out_of_range`, `members_empty`
- CF5: Snapshot plugin auto-attach — verify after grillage solver lands that baselines are captured
- CF6: Tier 2 JSON not validated against FastAPI request schema — add `tests/test_revit_t2_fixture_roundtrip.py` with canonical pyRevit-emitted JSON fixtures

---

## Implications for Roadmap

### Suggested Phase Order: Grillage → Tier 2 → Results-Import (with optional Grillage ‖ Tier 2 parallel split)

All four research files agree on this ordering.

### Phase 1: Grillage Solver (API + tests; UI deferred)

**Rationale:** Lowest risk (pure-additive in `solver_core` + `api_server`), no API drift, no cross-repo coordination, no IronPython 2.7. Snapshot baselines must be established BEFORE any cross-cutting Pydantic change so D-16 stays honest. Grillage has been deferred since v1.1 — only one of the three with shipped-but-undelivered customer expectation.

**Delivers:**
- `solver_core/.../solvers/grillage.py`, `models/grillage_model.py`, `adapters/grillage_adapters.py`
- `api_server/app.py` updates (engine registration + `POST /solve/grillage` + `GrillageRequest`)
- `tests/test_grillage.py` (3+ analytical tests, three-equation equilibrium, cross-coupled case)
- `tests/snapshots/baseline/` grillage baselines (BEFORE solver tweaks)
- `scripts/_snapshot_common.py` patch-list updated

**Pre-phase prep:** Commit untracked `solver_core/.../{__init__.py, engine/, models/, results/}` (CF2; verified untracked at research time).

### Phase 2: Revit Tier 2 — Analytical Exporter Hardening

**Rationale:** Sibling repo + Windows host + manual-copy deploy makes this slow; benefits from being post-grillage. Schema decision (REVIT-T2-02) gates Phase 3. Helper module is mechanical de-duplication.

**Delivers:**
- Sibling repo `Analytical.extension/lib/Snippets/_pda_export_common.py`
- Sibling repo `Analytical.panel/StructuralAnalyticalModel.pushbutton/AnalyticalButton_script.py` (currently 0-byte)
- Tier 1 pushbuttons refactored to import from shared module
- `pda_project/pyrevit_exporters/export_to_pda.py` retired
- `pda_project/api_server/app.py` — `Frame2DRequest`/`GrillageRequest` gain optional `revit_meta`; passthrough echo
- `pda_project/tests/test_revit_t2_fixture_roundtrip.py` with pyRevit-emitted JSON fixtures

**Sub-phases (REVIT-T2-01..07):**
- T2-01: `eid_compat` helper + high-id UAT fixture (C1)
- T2-02: schema decision + dual-key emission (C2; CF1 ordering gate)
- T2-03: view-plane projection (M1, M7)
- T2-04: E/I/A multi-source lookup + `meta.E_source` (M2)
- T2-05: loads/supports extraction
- T2-06: panel migration — two panels (M4)
- T2-07: legacy retirement + UAT (M5, m3, m5, CF3, CF6)

### Phase 3: Revit Results-Import

**Rationale:** Hard dependency on Phase 2's `revit_meta`. Closes the Revit round-trip loop.

**Delivers:**
- Sibling repo `Analytical.panel/ImportPDAResults.pushbutton/`
- Sibling repo `Setup.panel/` shared-parameter binding pushbutton (M3)
- Test fixtures: edit-then-reimport (proves dual-key durability), unbound-shared-parameter, read-only-parameter

**Sub-phases:**
- RI-Plan-1: Transaction setup + dual-key resolution + structured failure listing (C1, C2, M3)
- RI-Plan-2: Parameter binding setup pushbutton (M3)
- RI-Plan-3: Annotation UAT (edit-then-reimport fixture; alert audit) (C2, m3)

### Optional: Phase 1 ‖ Phase 2 Parallel Split

**If multiple developers/worktrees available:** Grillage and Tier 2 touch disjoint files; they can run in parallel. Results-Import (Phase 3) cannot start until T2 is at "emits `revit_meta`" stage. So:
- Sequentially: G → T2 → RI
- In parallel: (G ‖ T2) → RI

### Phase Ordering Rationale (Aggregated)

- **Dependency-driven:** Results-Import depends on Tier 2's `revit_meta` schema (CF1). Tier 2 and Grillage are independent.
- **Risk-driven:** Grillage is lowest-risk → start there. Sibling repo + Windows manual-copy is slow → batch Revit work after.
- **D-16-driven:** Baselines must be established BEFORE cross-cutting Pydantic changes.
- **Customer-expectation-driven:** Grillage has shipped-but-undelivered backlog from v1.1.

### Research Flags

**Phases likely needing deeper research during planning:**
- Phase 1, Plan 1: 6×6 transformation T at 45° plan rotation (MEDIUM); `meta["member_torsions"]` vs new top-level field
- Phase 2, REVIT-T2-02: dual-key emission shape (MEDIUM); multi-UniqueId-per-node strategy
- Phase 2, REVIT-T2-04: four-source E/I/A fallback exhaustiveness on real models
- Phase 2, REVIT-T2-07: pyRevit version verification on Windows host
- Phase 3, RI-Plan-1: pyRevit issue #2268 reproducibility on host build

**Phases with standard patterns (skip deeper research):**
- Phase 1, Plan 3: API endpoint + adapter validation (mechanical extension of frame_v2)
- Phase 1, snapshot baseline capture (D-16 mechanically proven)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All deps verified against installed environment; Revit version drift verified against Autodesk docs + revitapidocs.com + Building Coder + pyRevit issue tracker. MEDIUM only on pyRevit 5.1.x regression — verify on Windows host. |
| Features | MEDIUM-HIGH | HIGH on grillage FEM mechanics + existing solver_core integration. MEDIUM on Revit 2023→2025 API surface — per-version drift on `AnalyticalMember` property access requires runtime probing. |
| Architecture | HIGH | Existing repo + sibling repo inspected directly. MEDIUM on exact 6×6 grillage transformation T and on multi-UniqueId-per-node strategy. |
| Pitfalls | HIGH | C1+C2+M3 verified against Revit API docs + pyRevit issue tracker. C3+C4 are direct generalisations of v1.0 θ-DOF lesson + v1.2 pure-bar work. M2/M7 are MEDIUM (empirical tolerance). |

**Overall confidence: HIGH for the path; MEDIUM for the unknowns deferred to phase-level enforcement.**

### Gaps to Address

1. **Multi-UniqueId-per-node strategy** when `_merge_and_split` collapses endpoints within 1mm. **Resolution: flag during REVIT-T2-02; default to single-UniqueId, escalate to list-form only if a real model triggers it.**
2. **`AnalyticalMember.GetCurve()` projection tolerance.** **Resolution: REVIT-T2-03 plan should include "tolerance calibration" against the 6 v1.2 UAT fixtures + a synthetic out-of-plane fixture.**
3. **`member_torsions` placement: `meta` vs new top-level AnalysisResult field.** **Resolution: ship in `meta`; revisit in v1.4 if 3D frame also produces torsion.**
4. **pyRevit version pin.** **Resolution: verify on Windows host as REVIT-T2-01 first step; document in pushbutton CHANGELOG.md.**
5. **Whether grillage UI ships in v1.3 or v1.3.x.** **Resolution: flag explicitly in roadmap as a scope checkpoint at Phase 1 close. Default: defer.**

### Open Questions for the User

1. **Confirm pyRevit version on Windows host.** What does Settings → version banner show?
2. **Confirm Revit 2023 user base.** If 2023 user base is small, dropping to 2024+ would simplify ElementId compat. **Default: keep all three.**
3. **Grillage UI in v1.3 or defer?** **Default: API-only for v1.3.**
4. **Optional dev-only deps (`sympy`, `pytest-cov`) — adopt now?** **Default: defer; add to PROJECT.md TODO.**
5. **Pre-grillage prep (commit untracked solver_core scaffolding) — separate quick-task or fold into Phase 1?** **Default: fold into Phase 1 prep.**

---

## Sources

### Primary (HIGH confidence)

**Project-internal (direct reads):**
- `.planning/PROJECT.md` — milestone framing, hard rules, key decisions
- `.planning/MILESTONES.md` — v1.0/v1.1/v1.2 outcomes
- `.planning/RETROSPECTIVE.md` — recurring friction (CF2, M5)
- `CLAUDE.md` — solver conventions, layered architecture rules
- `solver_core/.../solvers/frame_v2.py` — solver template
- `solver_core/.../adapters/frame_adapters.py` — adapter template
- `api_server/app.py` — engine registration + endpoint patterns
- `scripts/_snapshot_common.py` — snapshot plugin patch list
- `pyrevit_exporters/export_to_pda.py` — legacy exporter (retiring)
- Sibling repo: `ExportToPDA.pushbutton/script.py`, `ExportToPDA_Truss.pushbutton/script.py`, empty `StructuralAnalyticalModel.pushbutton/`, existing `lib/Snippets/`

**Revit API breaking changes (HIGH confidence):**
- [revitapidocs.com — API Changes 2023](https://www.revitapidocs.com/2023/news?section=toc3)
- [revitapidocs.com — API Changes 2024](https://www.revitapidocs.com/2024/news)
- [Autodesk — Migrating From .NET 4.8 to .NET 8 (Revit 2025)](https://help.autodesk.com/cloudhelp/2025/DEU/Revit-API/files/Revit_API_Developers_Guide/Introduction/Getting_Started/Using_the_Autodesk_Revit_API/Revit_API_Revit_API_Developers_Guide_Introduction_Getting_Started_Using_the_Autodesk_Revit_API_NET8_Update_html.html)
- [pyRevit issue #1796 — Revit 2024 ElementId breaking change](https://github.com/pyrevitlabs/pyRevit/issues/1796)
- [Building Coder — TBC Samples 2023 New Structural API](https://thebuildingcoder.typepad.com/blog/2022/04/tbc-samples-2023-and-the-new-structural-api.html)
- [Building Coder — 64 Bit Ids](https://thebuildingcoder.typepad.com/blog/2023/05/64-bit-ids-revit-and-revitlookup-updates.html)

**Stack baseline:** numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2 — verified against installed environment.

### Secondary (MEDIUM confidence)

- [pyRevit 5.1 IronPython 2.7 loader regression on Revit 2025 (Discourse)](https://discourse.pyrevitlabs.io/t/pyrevit-5-1-fails-loading-ironpython-2-7-on-revit-2025/9170)
- [pyRevit + Revit 2025 + CPython3 (Discourse)](https://discourse.pyrevitlabs.io/t/pyrevit-5-revit-2025-cpython3/7816)
- [pyRevit issue #2268 — Transaction crash on cancel](https://github.com/pyrevitlabs/pyRevit/issues/2268)
- [Boost Your BIM — ForgeTypeId in Revit 2022+](https://boostyourbim.wordpress.com/2021/04/15/revit-2022-whats-up-with-forgetypeid/)
- [ricaun — Revit API 2024 obsolete tracker](https://ricaun.com/revit-api-2024-obsolete/)
- Grillage methodology: [SteelConstruction.info](https://www.steelconstruction.info/Modelling_and_analysis_of_beam_bridges), [LUSAS Simple Grillage](https://www.lusas.com/user_area/documentation/V18_0/worked_examples/Simple%20Grillage.pdf), [IntechOpen Girder-Deck](https://www.intechopen.com/chapters/80422)
- Revit annotation: [IndependentTag (2025)](https://www.revitapidocs.com/2025/e52073e2-9d98-6fb5-eb43-288cf9ed2e28.htm)

### Tertiary (LOW confidence — needs validation in execution)

- pyRevit version pinning recommendation — verify on Windows host as REVIT-T2-01 prep step
- View-plane projection tolerance (0.05m) — calibrate against real models in REVIT-T2-03
- Multi-UniqueId-per-node strategy — validate in REVIT-T2-02; default single-UniqueId

---

*Research synthesised: 2026-04-26*
*Ready for requirements-definition + roadmap: yes*
