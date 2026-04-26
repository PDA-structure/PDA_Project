# Milestone v1.3 Requirements

**Milestone:** v1.3 — Revit Tier 2 + Results-Import
**Status:** Active
**Created:** 2026-04-26
**Target host:** Revit 2025+ (2023/2024 dropped per user 2026-04-26)

## v1.3 Requirements

### Pre-Flight (PREP)

- [ ] **PREP-01**: Untracked `solver_core/src/pda_analysis_software/__init__.py`, `engine/`, `models/`, `results/`, plus `pyproject.toml` and `pda_analysis_software.egg-info/` are committed. Resolves recurring CF2 friction (worktree-mirror copy-paste hit v1.2 twice). Tracked as a quick-task before any v1.3 phase work begins.

### Element-to-Analytical Conversion (REVIT-CONVERT)

> Designed to leave room for v1.4+ expansion to slabs and floors with load chasedown (see `.planning/seeds/SEED-001-slab-floor-load-chasedown.md`). v1.3 handles **line elements only** (columns, beams, bracings); v1.4+ adds area elements (slabs, floors) with tributary-area / load-takedown logic.

- [ ] **REVIT-CONVERT-01**: pyRevit pushbutton at `Analytical.panel/ConvertToAnalytical.pushbutton/` (sibling repo) generates `AnalyticalMember` instances from user-selected physical elements (categories: `OST_StructuralColumns`, `OST_StructuralFraming` covering beams + bracings). Selection filter is a configurable list (NOT hard-coded categories) so v1.4+ can add `OST_Floors` / `OST_StructuralFoundation` without rewiring.
- [ ] **REVIT-CONVERT-02**: Use `Document.GenerateMembersFromSelection` (Revit 2023+ API) where available; fall back to per-element creation via `AnalyticalToPhysicalAssociationManager.AddAssociation` for cases the built-in skips. Preserves Revit's section / material / parameter associations to the physical element.
- [ ] **REVIT-CONVERT-03**: Idempotent — re-running the conversion on already-converted elements doesn't create duplicates. Detects existing analytical-physical associations via `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId` before attempting creation.
- [ ] **REVIT-CONVERT-04**: Diagnostic output — TaskDialog summary `{converted: N, skipped: M, total: N+M}` with skipped-element reasons (already-associated, unsupported category, missing physical-side data); doesn't fail whole batch on one bad element.

### Revit Tier 2 — Analytical Exporter Hardening (REVIT-T2)

- [ ] **REVIT-T2-01**: pyRevit pushbutton at `Analytical.panel/StructuralAnalyticalModel.pushbutton/` (sibling `CustomRevitExtension` repo) exports the active doc's analytical model as canonical PDA JSON. Refuses to run unless the active view is a plan, elevation, or section view (rejects `View3D`, `ViewSchedule` etc.). Targets Revit 2025 only (2023/2024 dropped).
- [ ] **REVIT-T2-02**: Shared geometry pipeline — refactor `_q4`, `_get_or_add_node`, `_merge_and_split`, `_sort_nodes_lexicographic`, `_sanitise_filename`, `build_canvas_block` into `Analytical.extension/lib/Snippets/_pda_export_common.py`. Tier 1 pushbuttons (`ExportToPDA`, `ExportToPDA_Truss`) refactored to import from it; v1.2 6-fixture UAT regressed clean.
- [ ] **REVIT-T2-03**: View-plane projection — `AnalyticalMember.GetCurve()` returns 3D; project onto active view's sketch plane via `view.SketchPlane.GetPlane().Project()`; reject members > 0.05m off-plane with structured error (`cause="member_out_of_view_plane"`).
- [ ] **REVIT-T2-04**: Section property extraction (E, I, A) via `AnalyticalToPhysicalAssociationManager` → physical `FamilySymbol` → `BuiltInParameter.STRUCTURAL_SECTION_*`; multi-source fallback (instance → type → symbol → labeled section) with `meta.E_source` per member recording which source supplied the value; rejects 0.0 as missing.
- [ ] **REVIT-T2-05**: Support extraction from `BoundaryConditions` — fixed → `restrainedDoF [base, base+1, base+2]`; pinned → `[base, base+1]`; rollerX → `[base]`; rollerY → `[base+1]`; matches frame_v2 conventions.
- [ ] **REVIT-T2-06**: Spring support extraction from `BoundaryConditions` translation/rotation stiffness parameters → `springDoF` / `springStiffness` arrays (uses v1.2 spring support pattern; differentiator).
- [ ] **REVIT-T2-07**: Pin-release detection from `AnalyticalMember.StartRelease` / `EndRelease` → `beamPinLeft` / `beamPinRight` arrays (differentiator).
- [ ] **REVIT-T2-08**: Load extraction from analytical `PointLoad` and `LineLoad` instances → `forceVector` (point loads) / `ENForces` and `ENMoments` (line loads); units converted via `UnitUtils.ConvertFromInternalUnits` + `UnitTypeId` (differentiator).
- [ ] **REVIT-T2-09**: `revit_meta` block emission — additive top-level field in canonical PDA JSON containing `{source, revit_version, exported_at, view, nodes[], members[]}`. Each member entry carries dual-key `{analytical_member_unique_id, revit_eid}` (UniqueId is GUID; ElementId is Int64 serialised as string for JS-safety). Solver/adapter MUST NOT read this field.
- [ ] **REVIT-T2-10**: Pydantic schema additive change — `Frame2DRequest` (and any future request models) gain `revit_meta: Optional[dict] = None`; FastAPI response builder echoes it back unchanged. Backward compatible: existing callers that don't set it see no change.
- [ ] **REVIT-T2-11**: Diagnostic output — export reports skipped members with reason; doesn't fail whole document on one bad member. Final TaskDialog shows summary `{exported: N, skipped: M, total: N+M}` plus skipped-member list (limit ~10 visible, full list in log).
- [ ] **REVIT-T2-12**: Legacy retirement — `pda_project/pyrevit_exporters/export_to_pda.py` removed (or moved to `archive/`); README references updated to point at the sibling-repo Tier 2 pushbutton; only one analytical-model export path exists.
- [ ] **REVIT-T2-13**: Round-trip UAT on Revit 2025 host — Tier 2 JSON loads in frame2d UI and solves end-to-end. At least 3 fixtures: simple beam, portal frame with mixed supports, multi-storey 2D frame. All match analytical reference values within tolerance.

### Revit Results-Import (REVIT-RI)

- [ ] **REVIT-RI-01**: pyRevit pushbutton at `Analytical.panel/ImportPDAResults.pushbutton/` (sibling repo) reads solver output JSON from a user-selected file (`forms.pick_file` filter `*.json`). Validates JSON schema before processing.
- [ ] **REVIT-RI-02**: Member matching via `revit_meta` dual-key — UniqueId-first lookup via `doc.GetElement(uid)`, ElementId fallback for in-session matches; unmatched members surface in a structured failure list. If JSON has no `revit_meta` (e.g. drafting-view Tier 1 export), pushbutton refuses to run with a clear "Tier 2 export required" message.
- [ ] **REVIT-RI-03**: Annotate analytical members with peak result via `TextNote.Create` at member midpoint (projected onto active view); annotation placement on active view only (no auto-creation of new views).
- [ ] **REVIT-RI-04**: Annotate supports with reaction values (Fx, Fy, Mz) via `TextNote.Create` at the support node's projected XY position on the active view.
- [ ] **REVIT-RI-05**: User selects which result quantity to display (peak axial / peak shear / peak moment / peak displacement / reaction) via TaskDialog with radio buttons before any annotation runs (differentiator).
- [ ] **REVIT-RI-06**: Idempotent re-import — annotations from prior import runs are detected (via shared `Comments` parameter or dedicated workset) and deleted before new annotations are placed. Re-running the pushbutton after model edits doesn't accumulate stale annotations.
- [ ] **REVIT-RI-07**: Transaction safety — single named `Transaction` with explicit `Start()` / `Commit()` / `RollBack()`; check `param.IsReadOnly` before any `Set()`; structured failure list on partial success (some members tagged, some skipped). No silent abandon-on-error.
- [ ] **REVIT-RI-08**: Unit-aware result formatting via `UnitFormatUtils.Format` so displayed values respect the project's unit settings (kN·m vs N·mm, etc.). Hard-coded unit suffixes are not acceptable.
- [ ] **REVIT-RI-09**: Deformed-geometry overlay via `DirectShape` — exaggeration factor user-selectable; cubic Hermite interpolation between displaced nodes (mirrors v1.0 frame2d UI BMD/SFD pattern); generated DirectShapes are read-only and separately deletable from the rest of the model (differentiator).
- [ ] **REVIT-RI-10**: Stress utilisation color-coding — view filter assigns colors by `σ / σ_yield` ratio bands (e.g. <0.5 green, 0.5–0.85 yellow, >0.85 red); user toggles on/off; doesn't permanently modify the model (differentiator).
- [ ] **REVIT-RI-11**: Setup pushbutton at `Setup.panel/BindSharedParameters.pushbutton/` (sibling repo) — runs once at extension install time to bind PDA shared parameters into the document. Avoids built-in parameter read-only surprises (M3 mitigation). Uses `Setup.panel/` not `Analytical.panel/` to respect pyRevit's 3-column-per-stack limit.

## Out of Scope (for v1.3)

### Explicitly excluded from Tier 2
- **Support for Revit 2023 + 2024** — user decision 2026-04-26: Revit 2025+ only; pre-2025 users must upgrade
- **Load combination resolution** (read `LoadCombination` instances and apply ψ factors) — separate problem domain (Eurocode/BS partial factors); aligns better with backlog 999.2 (Load Combination Generator); v1.4+
- **Bidirectional sync** (push solver displacements back as analytical-member tweaks) — conflates export and import; out by design
- **"Smart" topology cleanup** that merges near-coincident analytical nodes — those usually indicate real Revit modelling errors; surface, don't heal
- **Export to IFC / SAF / CIS-2** — canonical PDA JSON is the interchange; downstream converters consume it

### Explicitly excluded from Results-Import
- **Modify analytical-member geometry to show deformation** — mutates source-of-truth; round-trip back to solver gives garbage. DirectShape overlay (RI-09) is the correct alternative
- **Auto-create design checks** (capacity vs demand) — separate problem domain; aligns with backlog 999.3 (Design Solver); v2.x+
- **Push displacement values into shared parameters on analytical members permanently** — pollutes model; results lose validity the moment the model changes
- **"Live" auto-refresh** when solver re-runs — solver runs in browser/API; Revit can't poll
- **BMD as 3D extrusion** — performance death; not how engineers consume BMDs

### Deferred to v1.4+
- 3D truss / 3D frame solvers (v1.4)
- **Slab / floor analytical conversion + load chasedown** — `OST_Floors`, `OST_StructuralFoundation` extension to REVIT-CONVERT, plus tributary-area logic (1-way / 2-way slab → supporting beams; beam reactions → columns; column reactions → foundations). v1.4+, see `.planning/seeds/SEED-001-slab-floor-load-chasedown.md`. v1.3's CONVERT requirements explicitly designed to leave room for this expansion.
- Grillage solver (v1.5+ — user priority 2026-04-26: 3D solvers before grillage)
- pyRevit CPython3 migration (Revit 2025+IronPython 2.7 still works in pyRevit 5.0)

## Traceability

Phases continue numbering from v1.2 (last phase: 6) → v1.3 starts at Phase 7. Filled by roadmapper 2026-04-26.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PREP-01 | quick-task | Active |
| REVIT-CONVERT-01 | Phase 7 | Active |
| REVIT-CONVERT-02 | Phase 7 | Active |
| REVIT-CONVERT-03 | Phase 7 | Active |
| REVIT-CONVERT-04 | Phase 7 | Active |
| REVIT-T2-01 | Phase 8 | Active |
| REVIT-T2-02 | Phase 8 | Active |
| REVIT-T2-03 | Phase 8 | Active |
| REVIT-T2-04 | Phase 8 | Active |
| REVIT-T2-05 | Phase 8 | Active |
| REVIT-T2-06 | Phase 9 | Active |
| REVIT-T2-07 | Phase 9 | Active |
| REVIT-T2-08 | Phase 9 | Active |
| REVIT-T2-09 | Phase 8 | Active |
| REVIT-T2-10 | Phase 8 | Active |
| REVIT-T2-11 | Phase 8 | Active |
| REVIT-T2-12 | Phase 8 | Active |
| REVIT-T2-13 | Phase 8 | Active |
| REVIT-RI-01 | Phase 10 | Active |
| REVIT-RI-02 | Phase 10 | Active |
| REVIT-RI-03 | Phase 10 | Active |
| REVIT-RI-04 | Phase 10 | Active |
| REVIT-RI-05 | Phase 11 | Active |
| REVIT-RI-06 | Phase 10 | Active |
| REVIT-RI-07 | Phase 10 | Active |
| REVIT-RI-08 | Phase 10 | Active |
| REVIT-RI-09 | Phase 11 | Active |
| REVIT-RI-10 | Phase 11 | Active |
| REVIT-RI-11 | Phase 10 | Active |

_Total: 28 requirements (1 PREP quick-task, 4 CONVERT → Phase 7, 13 Tier 2 → Phases 8-9, 11 Results-Import → Phases 10-11). All 27 phase-mapped requirements assigned; PREP-01 tracked as quick-task. 100% coverage._

### Phase-to-requirement summary

| Phase | Count | Requirements |
|-------|-------|--------------|
| Phase 7 — Element-to-Analytical Conversion | 4 | CONVERT-01, CONVERT-02, CONVERT-03, CONVERT-04 |
| Phase 8 — Tier 2 Hardening + revit_meta | 10 | T2-01, T2-02, T2-03, T2-04, T2-05, T2-09, T2-10, T2-11, T2-12, T2-13 |
| Phase 9 — Tier 2 Differentiators | 3 | T2-06, T2-07, T2-08 |
| Phase 10 — Results-Import Table Stakes | 8 | RI-01, RI-02, RI-03, RI-04, RI-06, RI-07, RI-08, RI-11 |
| Phase 11 — Results-Import Differentiators | 3 | RI-05, RI-09, RI-10 |
| Quick-task | 1 | PREP-01 |
| **Total** | **29** | (28 unique reqs; PREP-01 listed once) |
