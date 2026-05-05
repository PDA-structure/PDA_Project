# Roadmap: PDA Analysis Software

## Milestones

- ✅ **v1.0 — 2D Solver Foundation** — Phases 1–2 (shipped 2026-04-18)
- ✅ **v1.1 — Interchange and Grillage (Partial)** — Phase 3 (shipped 2026-04-19; Phase 4 Grillage deferred)
- ✅ **v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)** — Phases 4–6 (shipped 2026-04-26)
- 🟢 **v1.3 — Revit Tier 2 + Results-Import** — Phases 7–11 (active, started 2026-04-26)
- 📋 **v1.4 — 3D Solvers** — TBD phases (planned)
- 📋 **v1.5+ — Grillage + Slab/Floor Conversion** — TBD phases (planned)
- 📋 **v2.0+ — Advanced Solvers (Dynamics, Plate, Continuum, Cablenet)** — TBD phases (planned)

## Phases

<details>
<summary>✅ v1.0 — 2D Solver Foundation (Phases 1–2) — SHIPPED 2026-04-18</summary>

- [x] **Phase 1: Trust and Production Hardening** (3/3 plans) — completed 2026-04-11
  - HTTP 422 on unstable structures, print removal, 15 analytical tests, BMD/SFD canvas rendering, member stress output
- [x] **Phase 2: Model Evolution and UX Polish** (3/3 plans) — completed 2026-04-18
  - Per-member E/I/A, section property calculator, JSON result export, node label overlay, symbol size scaler

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.1 — Interchange and Grillage Partial (Phase 3) — SHIPPED 2026-04-19</summary>

- [x] **Phase 3: Interchange Format and External Inputs** (3/3 plans) — completed 2026-04-19
  - Canonical JSON schema, save/load in both browser UIs, Tekla Excel converter, Revit PyRevit exporter, FastAPI integration tests

Full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

<details>
<summary>✅ v1.2 — 2D Frame Hardening + Revit-as-UI (MVP) (Phases 4–6) — SHIPPED 2026-04-26</summary>

- [x] **Phase 4: 2D Frame Solver + UI Hardening** (3/3 plans) — completed 2026-04-20
  - Multi-member tests (TRUST-13..17), spring supports end-to-end in frame2d UI, 5-fixture UAT harness with hand-calc asserts
- [x] **Phase 5: Revit Tier 1 — Geometry Exporter** (4/4 plans) — completed 2026-04-21
  - pyRevit `ExportToPDA` pushbutton (sibling `CustomRevitExtension` repo): drafting-view detail lines → canonical PDA JSON, view-type guard, 1mm endpoint merge, T-junction split, ft→m conversion, live UAT 6 fixtures + round-trip
- [x] **Phase 6: frame_v2 — Pure-Bar Joint Robustness** (3/3 plans) — completed 2026-04-26
  - Pure-bar joint detection + θ-DOF auto-restraint, `SolverDiagnosticError` typed exception, structured 422 payload, frame2d UI pre-solve scan + canvas diagnostic overlays, 56-baseline snapshot regression gate

Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### 🟢 v1.3 — Revit Tier 2 + Results-Import (Active)

- [ ] **Phase 7: Revit Element-to-Analytical Conversion** (0/3 plans) — pyRevit pushbutton converts user-selected physical columns/beams/bracings to AnalyticalMembers; foundation for Tier 2 export
- [ ] **Phase 8: Revit Tier 2 — Analytical Exporter Hardening (Table Stakes + revit_meta)** (0/4 plans) — shared geometry pipeline, view-plane projection, section properties, supports, dual-key revit_meta emission, additive Pydantic passthrough, legacy retirement, round-trip UAT
- [ ] **Phase 9: Revit Tier 2 — Differentiators (Springs, Pin-Releases, Loads)** (0/3 plans) — extract spring supports, member end-releases, and analytical loads into the canonical JSON
- [ ] **Phase 10: Revit Results-Import — Table Stakes** (0/3 plans) — pyRevit pushbutton reads solver JSON; matches members via revit_meta dual-key; annotates members + reactions with TextNotes; transaction-safe + idempotent
- [ ] **Phase 11: Revit Results-Import — Differentiators (DirectShape Overlay, Quantity Selector, Color-Coding)** (0/3 plans) — user selects which result quantity to display; deformed-geometry DirectShape overlay; stress utilisation color-coding via view filter

**Quick-tasks tracked for v1.3:**
- [ ] PREP-01 — Commit untracked `solver_core/.../{__init__.py, engine/, models/, results/}`, `pyproject.toml`, `pda_analysis_software.egg-info/`. Resolves recurring CF2 worktree-mirror friction. Run before Phase 7 work begins.

### 📋 v1.4 — 3D Solvers (Planned)

- [ ] **Phase 12: 3D Truss Solver** — /solve/truss3d endpoint, direction-cosine transformation, 3 DOF/node, analytical tests
- [ ] **Phase 13: 3D Frame Solver** — /solve/frame3d endpoint, 6 DOF/node, Blender add-on UI

### 📋 v1.5+ — Grillage + Slab/Floor Conversion (Planned)

- [ ] **Phase 14: Grillage Solver** — /solve/grillage endpoint, torsional stiffness (separate G/J fields), 3 DOF/node (Uz, θx, θy), analytical tests including cross-coupled bending+torsion (was original v1.1 Phase 4; deferred from v1.3 per user 2026-04-26)
- [ ] **Phase 15: Slab/Floor Element-to-Analytical Conversion** — extends REVIT-CONVERT to OST_Floors, OST_StructuralFoundation; tributary-area / load-takedown logic (1-way / 2-way slab → supporting beams; beam reactions → columns; column reactions → foundations). See `.planning/seeds/SEED-001-slab-floor-load-chasedown.md`.

### 📋 v2.0+ — Advanced Solvers (Planned)

- [ ] **Phase 16: Structural Dynamics** — Modal analysis, natural frequencies, time-history response
- [ ] **Phase 17: Plate and Shell Structures** — 2D FEM plate/shell elements, membrane + bending
- [ ] **Phase 18: Continuum Structures (FEM)** — General 2D/3D continuum elements, stress fields
- [ ] **Phase 19: Non-linear Cablenet Structures** — Geometric non-linearity, tension-only members, iterative solver

## Phase Details

### Phase 7: Revit Element-to-Analytical Conversion
**Goal**: Engineers can convert user-selected physical Revit elements (columns, beams, bracings) into AnalyticalMembers via a single pyRevit pushbutton, producing a well-formed analytical model that the Tier 2 exporter can consume.
**Repo target**: Sibling `CustomRevitExtension` (pyRevit, IronPython 2.7, Revit 2025+; manual-copy Windows deploy)
**Depends on**: Nothing (PREP-01 quick-task should be done first; sequencing-critical because Phase 8 Tier 2 export needs analytical members to read)
**Requirements**: REVIT-CONVERT-01, REVIT-CONVERT-02, REVIT-CONVERT-03, REVIT-CONVERT-04
**Success Criteria** (what must be TRUE):
  1. Engineer selects physical columns/beams/bracings in a Revit 2025+ project, clicks "ConvertToAnalytical" pushbutton in `Analytical.panel/`, and sees AnalyticalMember instances generated for each selected element with section/material/parameter associations preserved
  2. Re-running the pushbutton on already-converted elements does not create duplicates (idempotent via `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId` pre-check)
  3. Final TaskDialog summary reports `{converted: N, skipped: M, total: N+M}` with per-skip reasons (already-associated, unsupported category, missing physical-side data); a single bad element does not abort the whole batch
  4. The converted output passes the Phase 5/v1.2 Tier 1 frame2d round-trip smoke test (Revit's analytical model is well-formed enough that a downstream Tier 2 exporter — Phase 8 — can read it)
  5. Selection filter is a configurable list of categories (`OST_StructuralColumns`, `OST_StructuralFraming`) — NOT hard-coded — so v1.5+ Phase 15 can extend to `OST_Floors` / `OST_StructuralFoundation` without rewiring
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 07-01-PLAN.md — Bundle + Selection + Category Filter (skeleton: bundle.yaml, script.py shell, hybrid input, SUPPORTED_CATEGORIES registry, ISelectionFilter)
- [x] 07-02-PLAN.md — Conversion + Idempotency + Transactions (AnalyticalMember.Create + AddAssociation per D-11 reversal; TransactionGroup + per-element Tx; read-back verify; skip-reason taxonomy)
- [ ] 07-03-PLAN.md — Diagnostics + UAT + Windows Deploy (TaskDialog + Output Window with linkify; 3 RVT fixtures; UAT_RUNBOOK.md; Phase 5 Tier 1 round-trip; Windows manual-copy deploy)

### Phase 8: Revit Tier 2 — Analytical Exporter Hardening (Table Stakes + revit_meta)
**Goal**: Engineers can export a hardened canonical PDA JSON from a Revit 2025+ analytical model — including geometry, supports, section properties, and dual-key `revit_meta` for round-trip identity — and round-trip it back through the frame2d UI / `/solve/frame2d` endpoint without loss.
**Repo target**: Sibling `CustomRevitExtension` (primary) + `pda_project/api_server/app.py` (additive `revit_meta: Optional[dict]` Pydantic passthrough on `Frame2DRequest`)
**Depends on**: Phase 7 (analytical members must exist to be exported in UAT)
**Requirements**: REVIT-T2-01, REVIT-T2-02, REVIT-T2-03, REVIT-T2-04, REVIT-T2-05, REVIT-T2-09, REVIT-T2-10, REVIT-T2-11, REVIT-T2-12, REVIT-T2-13
**Success Criteria** (what must be TRUE):
  1. Engineer with an active plan/elevation/section view in Revit 2025+ clicks `Analytical.panel/StructuralAnalyticalModel.pushbutton` and gets a canonical PDA JSON file containing: geometry (members projected onto the active view's plane within tolerance), supports extracted from `BoundaryConditions`, section properties (E/I/A) with `meta.E_source` per member, and a top-level `revit_meta` block carrying dual-key (`analytical_member_unique_id` GUID + `revit_eid` Int64-as-string) for every member and node
  2. Tier 1 pushbuttons (`ExportToPDA`, `ExportToPDA_Truss`) refactored to import shared geometry helpers from `Analytical.extension/lib/Snippets/_pda_export_common.py`; v1.2 6-fixture UAT regresses byte-clean (no behavioural change for Tier 1 round-trips)
  3. The exported JSON loads in the frame2d UI and solves end-to-end against `/solve/frame2d` for at least 3 UAT fixtures on Revit 2025 host (simple beam, portal frame with mixed supports, multi-storey 2D frame); reaction values match analytical reference within tolerance
  4. The `Frame2DRequest` Pydantic model accepts the additive `revit_meta: Optional[dict] = None` field; the FastAPI response echoes it back unchanged; existing callers (browser UI, Tekla converter, Tier 1 exporters) that omit the field see no change
  5. Skipped-member diagnostics surface as a TaskDialog summary `{exported: N, skipped: M, total: N+M}` with per-skip reasons (e.g. `cause="member_out_of_view_plane"` for members > 0.05m off-plane); legacy `pda_project/pyrevit_exporters/export_to_pda.py` removed or moved to `archive/` so only one analytical-model export path exists
**Plans**: 4 plans
**UI hint**: yes

### Phase 9: Revit Tier 2 — Differentiators (Springs, Pin-Releases, Loads)
**Goal**: Engineers who modelled spring supports, analytical pin-releases, or analytical loads in Revit see those properties carried through into the canonical PDA JSON and respected by the solver — closing the gap between "geometry-only" and "full model" round-trip.
**Repo target**: Sibling `CustomRevitExtension` only (Tier 2 exporter extension; no `pda_project`-side changes)
**Depends on**: Phase 8 (extends the same Tier 2 pushbutton; relies on the shared geometry pipeline + revit_meta)
**Requirements**: REVIT-T2-06, REVIT-T2-07, REVIT-T2-08
**Success Criteria** (what must be TRUE):
  1. Engineer who has set translation/rotation stiffness on a `BoundaryConditions` element sees the resulting `springDoF` / `springStiffness` arrays populated in the exported JSON; the v1.2 frame2d spring-support pattern accepts the values unchanged
  2. Engineer who has set `AnalyticalMember.StartRelease` / `EndRelease` to release moment sees the corresponding member index appear in `beamPinLeft` / `beamPinRight` arrays in the exported JSON; the frame_v2 solver applies pin-release condensation correctly on the round-trip
  3. Engineer who has placed analytical `PointLoad` and `LineLoad` instances sees them converted to `forceVector` (point loads) and `ENForces` / `ENMoments` (line loads), with units converted from internal Revit units to SI via `UnitUtils.ConvertFromInternalUnits` + `UnitTypeId`
  4. Round-trip UAT: at least one fixture with combined springs + pin-releases + analytical UDL solves end-to-end against `/solve/frame2d` and matches analytical reference within tolerance
**Plans**: 3 plans
**UI hint**: yes

### Phase 10: Revit Results-Import — Table Stakes
**Goal**: Engineers can select a solver-output JSON file in Revit and have peak member results + reaction values appear as TextNotes on the analytical members and supports of the active view — closing the Revit round-trip loop.
**Repo target**: Sibling `CustomRevitExtension` only (new pushbuttons in `Analytical.panel/` + `Setup.panel/`); no `pda_project`-side changes
**Depends on**: Phase 8 (REQUIRES `revit_meta` dual-key to exist in the JSON — without it Phase 10 cannot match members back to Revit elements)
**Requirements**: REVIT-RI-01, REVIT-RI-02, REVIT-RI-03, REVIT-RI-04, REVIT-RI-06, REVIT-RI-07, REVIT-RI-08, REVIT-RI-11
**Success Criteria** (what must be TRUE):
  1. Engineer clicks `Analytical.panel/ImportPDAResults.pushbutton`, picks a solver JSON via `forms.pick_file`, and sees TextNotes appear on analytical members at midpoint (peak result) and at supports (Fx, Fy, Mz reaction values) on the active view — formatted in the project's unit settings via `UnitFormatUtils.Format`
  2. Pushbutton refuses to run with a clear "Tier 2 export required" message when the input JSON has no `revit_meta` (e.g. a drafting-view Tier 1 export); UniqueId-first lookup via `doc.GetElement(uid)` succeeds across Revit save/reopen, ElementId fallback handles in-session edits, and any unmatched members surface in a structured failure list
  3. Re-running the pushbutton after model edits is idempotent — annotations from prior import runs are detected and deleted before new annotations are placed; no stale annotations accumulate
  4. All Revit writes are wrapped in a single named `Transaction` with explicit `Start()` / `Commit()` / `RollBack()`; `param.IsReadOnly` is checked before any `Set()`; partial-success cases produce a structured failure list (some annotated, some skipped) — no silent abandon-on-error
  5. A separate `Setup.panel/BindSharedParameters.pushbutton` runs once at extension install time to bind PDA shared parameters into the document, side-stepping built-in-parameter read-only surprises (M3 mitigation)
**Plans**: 3 plans
**UI hint**: yes

### Phase 11: Revit Results-Import — Differentiators (DirectShape Overlay, Quantity Selector, Color-Coding)
**Goal**: Engineers reviewing solver results in Revit can choose which quantity to display, see deformed-geometry overlays as DirectShapes, and visually identify high-utilisation members via color-coding — without modifying the source-of-truth analytical model.
**Repo target**: Sibling `CustomRevitExtension` only (extends the Phase 10 ImportPDAResults pushbutton + adds view filter)
**Depends on**: Phase 10 (extends the same Results-Import pushbutton; relies on dual-key matching + transaction wrapper)
**Requirements**: REVIT-RI-05, REVIT-RI-09, REVIT-RI-10
**Success Criteria** (what must be TRUE):
  1. Before any annotation runs, engineer is presented with a TaskDialog with radio buttons selecting which result quantity to display (peak axial / peak shear / peak moment / peak displacement / reaction); subsequent annotations honour the selection
  2. Engineer can toggle a "deformed shape" overlay that creates `DirectShape` instances at a user-selectable exaggeration factor; cubic Hermite interpolation between displaced nodes mirrors the v1.0 frame2d UI BMD/SFD pattern; generated DirectShapes are read-only and separately deletable from the rest of the model
  3. Engineer can toggle stress utilisation color-coding via a view filter that assigns colors by `σ / σ_yield` ratio bands (e.g. <0.5 green, 0.5–0.85 yellow, >0.85 red); the filter does not permanently modify the model and can be turned off cleanly
  4. None of the differentiator features mutate `AnalyticalMember` geometry or push displacement values into shared parameters permanently — all visual feedback lives in DirectShapes / view filters / TextNotes that can be deleted
**Plans**: 3 plans
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Trust and Production Hardening | v1.0 | 3/3 | Complete | 2026-04-11 |
| 2. Model Evolution and UX Polish | v1.0 | 3/3 | Complete | 2026-04-18 |
| 3. Interchange Format and External Inputs | v1.1 | 3/3 | Complete | 2026-04-19 |
| 4. 2D Frame Solver + UI Hardening | v1.2 | 3/3 | Complete | 2026-04-20 |
| 5. Revit Tier 1 — Geometry Exporter | v1.2 | 4/4 | Complete | 2026-04-21 |
| 6. frame_v2 — Pure-Bar Joint Robustness | v1.2 | 3/3 | Complete | 2026-04-26 |
| 7. Revit Element-to-Analytical Conversion | v1.3 | 0/3 | Not started | - |
| 8. Revit Tier 2 — Hardening + revit_meta | v1.3 | 0/4 | Not started | - |
| 9. Revit Tier 2 — Differentiators | v1.3 | 0/3 | Not started | - |
| 10. Revit Results-Import — Table Stakes | v1.3 | 0/3 | Not started | - |
| 11. Revit Results-Import — Differentiators | v1.3 | 0/3 | Not started | - |
| 12. 3D Truss Solver | v1.4 | 0/TBD | Not started | - |
| 13. 3D Frame Solver | v1.4 | 0/TBD | Not started | - |
| 14. Grillage Solver | v1.5+ | 0/TBD | Not started | - |
| 15. Slab/Floor Conversion + Load Chasedown | v1.5+ | 0/TBD | Not started | - |
| 16. Structural Dynamics | v2.0+ | 0/TBD | Not started | - |
| 17. Plate and Shell Structures | v2.0+ | 0/TBD | Not started | - |
| 18. Continuum Structures (FEM) | v2.0+ | 0/TBD | Not started | - |
| 19. Non-linear Cablenet Structures | v2.0+ | 0/TBD | Not started | - |

## Backlog

### Phase 999.1: Section Shape Drawing UI (BACKLOG)

**Goal:** Engineer can draw an arbitrary polygon cross-section in a browser UI and receive computed section properties — cross-sectional area, second moment of area (Ixx, Iyy), elastic section modulus (Zxx, Zyy), and torsional properties (J, Cw). Computation uses the shoelace formula and parallel axis theorem. Extends and supersedes the basic section property calculator introduced in Phase 2.
**Context:** Identified 2026-04-18. Natural extension of Phase 2 Plan 2 (section property calculator). Small focused phase — UI for drawing + solver for properties. Should be sequenced after Phase 2 completes.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.2: Load Combination Generator — Eurocode and British Standard (BACKLOG)

**Goal:** Engineers can define actions (permanent, variable, wind, etc.) and generate ULS/SLS load combinations per EN 1990 and BS EN national annex. Combination generator produces load vectors that feed directly into the existing analysis solvers. Includes a UI for defining actions and selecting combination type, and a solver module that applies the correct ψ factors, partial factors, and combination expressions.
**Context:** Identified 2026-04-18. Fits naturally between analysis and design — upstream of any future design solver. Well-scoped: combination logic is deterministic and fully specified by the codes. Should be sequenced after interchange format (Phase 3) so combination outputs can be saved/loaded as part of a model file.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.3: Design Solver — Code Checking Against Eurocode / BS (BACKLOG)

**Goal:** A separate design module checks analysis results against structural design codes (EC3 for steel, EC2 for concrete, BS 5950 etc.), reporting pass/fail for each member across bending, shear, axial, combined loading, buckling, and lateral-torsional buckling checks. Interacts with the analysis engine via AnalysisResult — consumes displacements, reactions, and member forces.
**Context:** Identified 2026-04-18. Effectively a separate product stream — design code checking is a large, long-running effort (Tekla/SCIA/Robot spend years on this). Not a single phase; will need to be broken into sub-phases per material type and code. Captured here to preserve intent. Prerequisite: stable analysis engine (Phases 1–4 at minimum), load combination generator (999.2), and section property tool (999.1).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.4: Word Add-in for Calculation Sheets (BACKLOG)

**Goal:** A Microsoft Word add-in (Office JS API) consumes analysis and design results and formats them into structured calculation sheets in the style of Tekla Tedds for Word — section headings, input tables, result summaries, diagrams. Engineers can produce submission-ready calculations directly from the tool.
**Context:** Identified 2026-04-18. Completely separate technology stack from the current Python/FastAPI/JS platform — requires Microsoft Office JS API or VSTO. Commercially high-value but a large investment. Near-term alternative: an HTML/PDF calculation report generator within the current stack that produces Tedds-style output. Captured here to preserve intent. Prerequisite: stable analysis + design solver (999.3).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---

### Phase 999.5: Frame2D Ribbon Hierarchy UI (BACKLOG)

**Goal:** Replace the current horizontal floating toolbar in the frame2d browser UI with a Revit-style ribbon hierarchy: a single-line of tabs at the top of the screen (FILE, EDIT, GEOMETRY, SUPPORTS, NODE LOADS, MEMBER LOADS, MEMBER PROPERTIES, DISPLAY, SOLVE — with future room for MATERIAL PROPERTIES, SECTION CALCULATOR, LOAD COMBINATIONS), each revealing a panel of buttons grouped by function. Panel constraint: max 2 buttons stacked vertically per panel, growing left-to-right as more buttons are added. Frame2d only for the spike; truss2d catches up later.
**Context:** Identified 2026-05-05 from work-laptop UAT signal — current horizontal-wrap toolbar (rs3 spike, commit `9ef7eaa`) is approaching its density ceiling as v1.3 features (load combinations, section calculator, more support types) are about to be added. Establishing the tab→panel→button hierarchy now means: (a) it scales without re-layout when those features land, and (b) the mental model transfers cleanly to the eventual 3D / Revit-hosted UIs (Phase 12-13 Blender add-on, Phase 7-11 Revit pushbuttons), since Revit itself uses the same ribbon hierarchy. Sequenced AFTER v1.3 Revit milestone — UI modernisation waits for real-use signal, which is now arriving via work-laptop sessions.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
