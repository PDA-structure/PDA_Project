# Feature Research

**Domain:** PDA v1.3 — Revit Tier 2 + Results-Import + Grillage Solver
**Researched:** 2026-04-26
**Confidence:** MEDIUM-HIGH (HIGH on grillage FEM mechanics + existing solver_core integration; MEDIUM on Revit 2023→2025 API surface — verified breaking-change boundary at 2023, but per-version drift on AnalyticalMember property access requires runtime probing during execution)

---

## Scope Note

Three carry-over features. Each evaluated independently because they share almost no code path:

| Feature | Lives In | Depends On (Existing) |
|---------|----------|------------------------|
| **A. Revit Tier 2 — Analytical Exporter** | sibling `CustomRevitExtension/` repo (pyRevit, IronPython 2.7) | Canonical PDA JSON schema v1.0 (v1.1); `frame2d` UI round-trip (v1.2); `ExportToPDA` Tier 1 view-plane projection logic (v1.2) |
| **B. Revit Results-Import** | sibling `CustomRevitExtension/` repo (pyRevit, IronPython 2.7) | `AnalysisResult` JSON shape (v1.0 export); analytical-model element IDs from feature A; Revit `IndependentTag` / `TextNote` API |
| **C. Grillage Solver** | `solver_core` + `api_server` (+ optional `ui/grillage/`) | `AnalysisEngine` registry (v1.0); `AnalysisResult` dataclass (v1.0); `frame_v2` solver pattern; D-16 snapshot regression gate (v1.2); add-a-solver checklist |

---

## A. Revit Tier 2 — Analytical Exporter Hardening

### A.1 Table Stakes (Engineers Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Read `AnalyticalMember` elements from active doc | Core difference from Tier 1 — Tier 1 reads detail lines, Tier 2 must read the actual analytical model | LOW | `FilteredElementCollector(doc).OfClass(AnalyticalMember)`. Class introduced in Revit 2023; absent in Revit ≤2022 — fail fast with explicit version-guard message |
| Extract member geometry (start, end XYZ in feet) | Bare minimum — no geometry, no model | LOW | `member.GetCurve()` returns `Line` for straight members; `.GetEndPoint(0/1)` gives XYZ. Reuse Tier 1's `feet → metres × 0.3048` + 4dp rounding |
| Project 3D coordinates onto active view plane | The defining "Tier 2 feature" — the user-stated requirement. Frame solver is 2D so 3D coords must collapse | MEDIUM | Reuse `ExportToPDA` Tier 1 view-plane projection. View kinds: `ViewPlan` (project Z out), `ViewSection` (project to view's right/up basis), `View3D` should be rejected with clear error |
| View-type guard | Tier 1 has it; engineers will assume Tier 2 has it too. Ambiguity causes silent garbage exports | LOW | Reuse Tier 1's guard; extend to reject `View3D` and `ViewSchedule` |
| Extract supports from analytical boundary conditions | Without supports there's nothing to solve; engineers expect the model to "just work" | MEDIUM | `BoundaryConditions` filtered by `HostElementId == member.Id`. Map `BoundaryConditionsType.Fixed/Pinned/Roller` → PDA `restrainedDoF` lists. Roller direction depends on view-plane axis — needs careful mapping |
| Extract section properties (E, I, A) | Engineers will be furious if they have to re-enter every section after export. The whole point of analytical-model export is the data lives in Revit | MEDIUM-HIGH | `member.GetSection()` → `StructuralSection` → `SectionShape`-derived properties. E from Material `PHY_MATERIAL_PARAM_YOUNG_MOD1`. Per-member values map cleanly to v1.0's `Union[float, List[float]]` |
| Revit 2023, 2024, 2025 compatibility | The user's stated requirement. Releases 2023+ all use the new analytical model — but minor API drift exists | MEDIUM | Single `AnalyticalMember`-class code path covers all three; per-version drift is mostly on property-name parameters, handled with try/except probes. **Don't pretend to support Revit ≤2022** — fail fast |
| Round-trip into `frame2d` UI | Carries over from Tier 1 — engineers expect "click button, see solver" not "click button, debug schema" | LOW | Output canonical JSON v1.0 — the UI already loads it |
| Unit conversion (feet → metres, ksi → Pa, in² → m²) | Revit's internal units are imperial; SI is non-negotiable for the solver. Silent unit bugs are catastrophic | LOW | Use `UnitUtils.ConvertFromInternalUnits(value, ForgeTypeId)` not hand-coded factors — survives Revit unit-system changes |
| Diagnostic output (skipped members, missing properties) | Engineers will ship a 200-member model and get back a 12-member JSON — they need to know why | LOW | TaskDialog or sidebar listing skipped elements with reason. Don't fail the whole export on one bad member |

### A.2 Differentiators (Useful, Not Required)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Extract loads from analytical loads (`PointLoad`, `LineLoad`) | Engineer drew supports + a UDL in Revit; importing them means zero re-entry in browser. Strong "wow" factor | MEDIUM | `FilteredElementCollector` of `LoadBase`-derived elements, host-by-element. PDA's UDL sign convention (positive = downward) needs explicit sign mapping from Revit's load axis convention |
| Resolve load combinations into per-member resultants | Avoids forcing user to re-enter dozens of factored loads. **Strongly differentiates from Tier 1** which can't do this at all | HIGH | Walk `LoadCombination` → `LoadCase` → factors; sum per-member contributions. Revit's load-combination API is awkward (NewLoadCase / NewLoadCombination factor-size constraints). Single combination only for v1.3 — multi-combo batch is v1.4+ |
| `AnalyticalToPhysicalAssociationManager` link in JSON output | JSON carries Revit element IDs alongside PDA node/member indices. Enables results-import (feature B) without re-parsing geometry | LOW | One extra `revit_element_id` field per member; transparent to the solver because it's metadata |
| Pin-release detection from analytical end releases | Revit analytical members have explicit `StartRelease` / `EndRelease`. PDA has `beamPinLeft/Right`. Direct mapping | LOW-MEDIUM | One-to-one map of release flags. Subtle: PDA only models moment-release in 2D; axial/shear releases must be flagged as unsupported with a clear error |
| Spring supports from analytical boundary conditions with stiffness | v1.2 added springs end-to-end in the UI; matching them at the Revit boundary closes the loop | MEDIUM | `BoundaryConditions.SetTranslationParameter` / `RotationParameter` give stiffness values. Map to PDA `springDoF` + `springStiffness` |
| Section-property fallback hierarchy | Revit sometimes has `I` but not `A`, or vice versa. Smart fallback from analytical → physical type → manual default keeps export usable on partially-defined models | LOW | Try AnalyticalMember section → physical FamilySymbol section → emit warning + use a labeled default. NEVER silently substitute zero |

### A.3 Anti-Features (Seems Good, Causes Problems)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Support Revit ≤2022 (legacy `AnalyticalModel`) | "Some firms still use 2022" | The legacy `AnalyticalModel` API was REMOVED in 2023 with no deprecation. Two separate code paths means double maintenance, double tests, double bug surface — for users who should be upgrading anyway | Hard version guard with friendly error: "Tier 2 requires Revit 2023+. Use Tier 1 (drafting-view) on older Revit." |
| Auto-translate 3D models into a 2D solve | "Revit is 3D, so handle 3D for me" | The frame solver is 2D — silently flattening a 3D portal frame produces nonsense forces. User has no way to know it's wrong | Reject `View3D`; require user to pick a plan/elevation/section. The view IS the projection plane, by design |
| Bidirectional sync (write displacement values back into Revit parameters) | "It would be amazing if it just updated Revit" | This is the v1.3 *Results-Import* feature (B), but conflated. Trying to make Tier 2 bidirectional creates a tangled exporter-importer-roundtrip class. Keep direction discipline: A is one-way out, B is one-way in | Keep A and B as separate pushbuttons, separate transactions, separate JSON files |
| "Smart" topology cleanup (auto-merge near-coincident nodes) | "Revit's analytical model has small gaps, please clean them up" | The Tier 1 `ExportToPDA` already has 1mm Chebyshev merge for detail lines. For analytical members, near-coincident endpoints usually indicate a *real Revit modeling error* — silently merging hides it | Surface the error: list endpoints that are 0 < d < tolerance apart, ask user to fix in Revit. Tier 2 should be a faithful translator, not a healer |
| Export every analytical-model property field | "Just dump everything, we'll filter later" | Bloats JSON, leaks Revit-version-specific fields the solver doesn't understand, and creates schema drift | Strict canonical JSON v1.0 schema. Optional `revit_meta` namespace for round-trip provenance only |
| Export to formats other than canonical PDA JSON (IFC, SAF, CIS/2) | "We have a Tekla user too" | v1.1 already established canonical JSON as the interchange. Adding more formats here multiplies test surface. SAF/IFC structural belong in a dedicated converter, not the Revit pushbutton | Single output: canonical PDA JSON. Other formats convert from JSON downstream |

### A.4 Complexity Estimate

**Overall: MEDIUM-HIGH.** Larger than Tier 1 (which was LOW). Three reasons: (i) `AnalyticalMember` API surface is broader and version-drifted across 2023/24/25; (ii) section-property + boundary-condition extraction each need their own filter/probe routines; (iii) the production-path migration to `Analytical.panel/StructuralAnalyticalModel.pushbutton/` plus legacy retirement is a non-trivial deployment dance on Windows manual-copy hosts.

---

## B. Revit Results-Import

### B.1 Table Stakes (Engineers Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Read solver output JSON | Bare minimum I/O | LOW | Reuse `AnalysisResult` JSON shape — v1.0 already has the export format |
| Match members back to Revit element IDs | Without a join key, you can't tell which Revit beam got which moment. **Hard dependency on feature A** writing `revit_element_id` into export JSON | LOW | If A.2 differentiator "association manager link" ships, this is a dictionary lookup. If it doesn't, this becomes HARD — fall back to geometry match (start/end XYZ within tolerance) |
| Tag analytical members with peak axial / shear / moment | "Annotate the model" is the user's stated workflow. Number-on-member is the most-asked structural-results display | MEDIUM | Two paths: (a) `IndependentTag` against a tag family that pulls a parameter — requires a parameter on AnalyticalMember; (b) `TextNote.Create` placed at member midpoint — simpler, less Revit-native. Recommend (b) for v1.3 — no family deployment dependency |
| Place reaction values at supports | Engineers always want reactions visible — usually checked first against load takedown | LOW | One `TextNote` per support node, value from `AnalysisResult.FG`. Place at the support node's projected XY in active view |
| Idempotent re-import (delete previous results before placing new ones) | Run solver, see results, change model, re-run — engineer expects clean overwrite, not 12 stacked text notes | LOW | Tag every results element with a shared `Comments` parameter or workset; `FilteredElementCollector` to delete before re-place |
| Active view = annotation view | Annotations appearing on the wrong sheet is a cardinal sin in Revit deliverables | LOW | Use `doc.ActiveView.Id` as the view for `IndependentTag.Create` / `TextNote.Create` |
| Unit display (kN, kNm, mm) with engineer-controlled formatting | Numbers in the wrong unit are worse than no numbers | LOW | Format using Revit's unit formatting (`UnitFormatUtils.Format`) so it respects project unit settings |
| Single-transaction wrap with Undo support | All Revit edits must be in `Transaction`. Engineer must be able to Ctrl+Z | LOW | Standard pyRevit pattern: `Transaction(doc, "PDA Results Import")` |

### B.2 Differentiators (Useful, Not Required)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Render deformed geometry as overlay (`DirectShape` with exaggeration factor) | Visual proof the structure deforms the way the engineer expects — catches sign-of-deflection errors that numbers don't | MEDIUM-HIGH | `DirectShape.CreateElement` with `OST_GenericModel` category. Build line geometry from `UG` displacements scaled by user factor (e.g. 100×). Cubic Hermite shape between nodes for accuracy on bent members. Reuse the v1.0 frame UI's Hermite logic where transferable |
| User-selectable result quantity (drop-down: M / V / N / σ / displacement) | One button, multiple result views — reduces button proliferation | LOW | Single TaskDialog with radio buttons. Re-runs the placement with the chosen quantity. Free if tagging is already parameterized |
| Color-code members by stress utilisation | Visual heat-map of the structure — fast overview of critical members | MEDIUM | Override member graphics in the active view via `SetElementOverrides` with color stops. Needs a stress threshold UI. Requires section properties already in the JSON |
| Place a results legend / scale bar | The deformation factor must be visible or numbers can be misread | LOW | Detail group with text — minimal effort once placement plumbing exists |
| Generate a new view ("Analysis Results — \[date\]") instead of mutating the active view | Keeps engineer's drawing views clean; results live on their own view | MEDIUM | `View3D.CreateIsometric` or `ViewPlan.Create` then place annotations there. Trade-off: harder to "see results in context of my drawing" |
| BMD / SFD diagram overlay (filled regions perpendicular to member) | Matches the v1.0 frame2d canvas BMD/SFD — engineers will expect parity once they've seen it in browser | HIGH | Detail line family per member, scaled by moment value, placed perpendicular to member axis. Depends on view orientation. Substantial geometry maths |

### B.3 Anti-Features (Seems Good, Causes Problems)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Modify analytical-member geometry to show deformation | "Just bend the actual member" | Mutates the engineer's source-of-truth model. Round-tripping to solver again gives garbage. Cannot be undone without losing other edits. Revit doesn't roundtrip displaced geometry cleanly | Use `DirectShape` overlay (read-only, separately deletable) — never mutate `AnalyticalMember` geometry |
| Auto-create design checks (capacity vs demand) | "While you're tagging, just check the section" | Code-checking is a separate problem domain (Eurocode/AISC/IS). Implementing it badly in a results-import button creates liability and false confidence | Out of scope for v1.3. Belongs in a dedicated "design check" milestone with proper code references |
| Push displacement values into shared parameters on analytical members | "It'd be neat to have the displacement on the member" | Pollutes the model permanently; shared parameters are project-wide and surveying who set them is impossible; results lose validity the moment the model changes but the parameter stays | Use annotation-only output. If parameter-write is ever needed, scope it as a separate explicit "freeze" button |
| "Live" auto-refresh on Revit model change | "It should just stay in sync" | Solver runs in browser/API; Revit can't poll. Implementing this requires Dynamo/Forge bridge — entirely off-architecture | One-shot import. Engineer re-runs solver, re-imports. Separation of concerns |
| Annotate every member with every result (force, shear, moment, stress, displacement) | "Show me everything" | Visual chaos — tag overlap renders the view unreadable. Engineers always squint and say "I just wanted the moment" | One quantity per import (B.2 differentiator above). Re-run for additional quantities |
| Render BMD as 3D extrusion (volumetric moment cloud) | Looks impressive in screenshots | Performance death on real models; engineers can't read the numbers off it; doesn't match how engineers actually consume BMDs | 2D detail-line BMD perpendicular to member, planar to the view |

### B.4 Complexity Estimate

**Overall: MEDIUM if scoped to tagging + reactions, MEDIUM-HIGH if deformed-geometry overlay is included.** Hard dependency: feature A must write `revit_element_id` per member into the export JSON. Without that, the geometry-match fallback adds substantial complexity for no payoff. **Recommend: ship tagging + reactions for v1.3, defer deformed overlay to a v1.3.x quick task or v1.4.**

---

## C. Grillage Solver

### C.1 Table Stakes (Engineers Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 3 DOF/node: Uz (vertical), θx (rotation about x), θy (rotation about y) | Definition of a grillage — anything less is a 2D frame in disguise | LOW | Mirrors `frame_v2`'s 3 DOF/node structure. Same `n*3` global vector size; different DOF semantics |
| Per-member EI (bending) AND GJ (torsional stiffness) | Torsion is THE differentiator vs frame_v2 — no torsion = no grillage | LOW | Element local stiffness has bending blocks + a torsion block. Standard textbook formulation (e.g. Hambly, *Bridge Deck Behaviour*) |
| Vertical point loads at nodes | Bare minimum loading | LOW | Load assembly identical to frame_v2 force-vector pattern |
| Vertical UDL on members | Bridge decks are dominated by distributed vertical loads (self-weight, deck slab, surfacing). Single most-used load type on a grillage | LOW-MEDIUM | Equivalent nodal forces + moments. PDA convention (positive = downward) extends naturally |
| Fixed and pinned supports | Bare minimum boundary conditions | LOW | Map to `restrainedDoF` lists in 1-based DOF numbering — exactly the pattern of `frame_v2` |
| FastAPI `/solve/grillage` endpoint | Promised in the milestone goal. Match `/solve/frame2d` shape exactly | LOW | Pydantic request model; reuse the `engine.register("grillage", ...)` registry pattern; reuse `AnalysisResult` for response |
| Analytical test cases with hand-calc verification | Project convention (D-04, frame_v2). Without analytical tests, the solver can't ship — the snapshot regression gate is necessary but not sufficient | MEDIUM | Minimum 3: (a) simple beam point load (degenerate grillage = beam-line), (b) two-beam grillage cross under central load — Hambly worked example, (c) pure torsion — single fixed-fixed beam with applied torque, GJ verification |
| Snapshot regression baseline (D-16) | v1.2 mechanically enforces no-regression for all solvers via byte-identical fixture comparison. Grillage must enter the same gate | LOW | Capture baseline JSONs BEFORE any solver edit lands; pytest plugin already exists |
| Member moments (Mx, My) and torsion (T) in `AnalysisResult` | Engineer needs both bending AND torsion to interpret a grillage. Shear too | LOW-MEDIUM | Extend `member_moments` to shape `(n_mbr, 2, 2)` for [start/end][Mx/My], or add a sibling `member_torsions` field. **Decide once, document the schema, don't churn it** |
| Equilibrium assertions (reaction-DOF sum, not sum(FG)) | Project convention (D-04). All tests assert it | LOW | Same pattern as frame_v2 tests |

### C.2 Differentiators (Useful, Not Required)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Skewed (non-orthogonal) grids | Bridge decks are routinely skewed (highway alignment vs abutment not at 90°). **Caveat:** literature shows orthogonal mesh is preferred even for skewed decks at large skew angles, because skew elements behave inaccurately. So "skewed grids" is more about *geometry input* than skew-specific FEM math | LOW (geometry input) | Members can be at any angle in the XY plane — same direction-cosine transform as frame_v2's inclined members. **Verdict: orthogonal-only is sufficient for v1.3 if "orthogonal" means "right angles". But arbitrary-angle members in the XY plane is essentially free and table-stakes** |
| Spring supports (vertical + rotational) | Bridge bearings are not idealised pins; they have measurable spring stiffness. Important for refined analysis | LOW | Direct extension of v1.2 frame2d spring supports — same `springDoF` / `springStiffness` pattern |
| Distributed torque on members | Less common but used for bridge curb / parapet eccentric loads | MEDIUM | New equivalent-nodal-load formulation. Defer unless requested — point torque at node covers most cases |
| Browser UI (`ui/grillage/`) | Discoverability — engineers find features they can click. Without a UI, grillage is effectively "API-only and invisible" | MEDIUM-HIGH | Plan-view canvas (XY) with grid; node placement; member draw; UDL; supports. **Major UX question: how to display Z-axis bending and torsion on a top-down view?** Color, symbol, separate sidebar table. Reuse frame2d canvas conventions (GRID=20px, origin from first node, etc.) |
| Influence-line / line-load tools | Bridge engineers are obsessed with influence lines and moving loads (HB, HA in UK; HL-93 in US) | HIGH | Out of scope for v1.3. Substantial scope creep — defer to v1.4+ as a dedicated milestone |
| Bridge-deck preset / wizard ("simply-supported skew bridge", "two-girder deck") | Engineers will load a preset, edit dimensions, and solve. Removes blank-page paralysis | MEDIUM | Pure UI/JSON-fixture work — no solver code. Differentiator if the UI ships; pointless if API-only |
| Pin releases (moment release at member ends, torsion release) | Frame_v2 has them; grillage parity expected by engineers familiar with frame_v2 | MEDIUM | Directly analogous to frame_v2 `beamPinLeft` / `beamPinRight`. Same condensation pattern. Adds three new test cases though |

### C.3 Anti-Features (Seems Good, Causes Problems)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Plate/shell elements ("just add plates for the deck slab") | "Real bridge analysis uses plates, not just beams" | Plate FEM is a different formulation — requires shape functions, Gauss integration, completely different stiffness assembly. Adding plates to grillage solver_core is a multi-week milestone, not a feature | Pure beam-grillage for v1.3. Plate elements are a v2.x dedicated milestone. Document the limitation: "PDA grillage is beam-only; deck slab modelled via transverse beam stiffness" |
| Auto-mesh generation (user gives outline + mesh density) | "I want to draw the deck outline and have it gridded" | Auto-meshing is a domain in itself; bad meshes give wrong answers; user has no control over critical mesh decisions (skew element direction, element aspect ratio) | Engineer specifies nodes + members explicitly. Browser UI provides snap-to-grid as the placement aid |
| Dynamic / modal analysis ("vibration modes for footbridges") | "We need natural frequencies for SLS check" | Eigenvalue solver requires `np.linalg.eig`/`eigh` — not in current stack. Mass matrix formulation is a parallel concern. Dynamic analysis is its own milestone | Static-only for v1.3. Dynamic analysis is v2.x with proper scope |
| Non-linear material (concrete cracking, plastic torsion) | "Real bridges crack" | Already explicitly Out of Scope in PROJECT.md. Different FEM formulation (iterative, tangent stiffness) | Linear elastic only. Document in `solver_core` as deliberate limitation |
| 3D-truss-style "grillage in 3D" (members not constrained to a plane) | "Just generalize to 3D" | That's a 3D space-frame solver, which is the v1.4 milestone scope. Lifting grillage to 3D blurs the v1.3/v1.4 boundary, doubles the test set, and risks shipping neither well | Strict 2D-planar grid for v1.3. 3D space frame is v1.4, separate milestone |
| Reuse `frame_v2` solver via "just rotate the coordinate system" | "Frame_v2 has 3 DOF/node, so does grillage, why write a new solver?" | The DOF semantics differ (frame: Ux/Uy/θ in plane, grillage: Uz/θx/θy out-of-plane), member stiffness has a torsion term frame_v2 doesn't, and the coordinate transform is different. Forcing reuse means contorting frame_v2 with conditional branches that break its existing tests | Separate `grillage.py` solver. Share the AnalysisResult dataclass, AnalysisEngine registry, adapter pattern — not the solver math |
| Browser UI before solver tests pass | "Engineers will want to see it" | A UI that calls a wrong solver is worse than no UI — it produces plausible-looking wrong numbers. v1.0/v1.1/v1.2 followed solver-first ordering for good reason | API + tests first, UI after. **API-only ship is acceptable for v1.3** if UI work threatens scope |

### C.4 Complexity Estimate

**Overall: MEDIUM (solver + API + tests).** **MEDIUM-HIGH if browser UI is included.**

Decomposition:
- Solver math (3 DOF/node, GJ, equivalent loads): **LOW-MEDIUM** — textbook FEM, mirrors `frame_v2` structure closely
- Model + adapter + engine registration + endpoint: **LOW** — follows the well-trodden add-a-solver checklist
- Test suite (3+ analytical cases, snapshot baselines, equilibrium asserts): **MEDIUM** — analytical hand-calcs for grillage cross loadings are non-trivial; Hambly worked examples are gold-standard
- Browser UI: **MEDIUM-HIGH** — XY canvas is straightforward, but UDL display + result rendering for Mx/My/T on a top-down view is a real UX problem

**Strong recommendation: ship API + tests for v1.3; defer UI to v1.3.x or v1.4.** Rationale:
1. Engineers can already drive grillage from notebooks / Tekla converter / hand-built JSON — UI is not a hard blocker
2. Grillage UI's display question (how to render Mx/My/T on a top-down plan view) is a substantive UX research item, not a routine UI port
3. Solver-first ordering caught real bugs in v1.0/v1.1/v1.2 — sequencing risk is real

---

## Feature Dependencies

```
[A. Revit Tier 2 Exporter]
    └──writes revit_element_id per member──>  [B. Results-Import]
    └──reuses Tier 1 view-plane projection──> [v1.2 ExportToPDA pushbutton]
    └──outputs canonical PDA JSON v1.0──>     [v1.1 frame2d round-trip]

[B. Revit Results-Import]
    └──reads AnalysisResult JSON──>           [v1.0 export format]
    └──places IndependentTag/TextNote──>      [Revit annotation API per version 2023/24/25]
    └──HARD DEPENDENCY──>                     [A.2 differentiator: revit_element_id]

[C. Grillage Solver]
    └──registers via engine.register──>       [v1.0 AnalysisEngine]
    └──returns AnalysisResult──>              [v1.0 dataclass — may need member_torsions field]
    └──tested via D-16 snapshot gate──>       [v1.2 pytest plugin + baseline JSONs]
    └──follows frame_v2 patterns──>           [v1.2 frame_v2 solver, pin-release, spring-support pattern]

[Optional: ui/grillage/]
    └──reuses canvas conventions──>           [v1.0 frame2d UI: GRID=20px, origin, scaleX]
    └──reuses save/load JSON──>               [v1.1 canonical JSON v1.0 schema]
    └──soft dependency──>                     [grillage solver shipping correctly first]
```

### Dependency Notes

- **A → B is a hard dependency** for join-key-based member matching. Without it, B falls back to geometry matching (start/end XYZ within tolerance) which adds substantial complexity. Recommendation: A.2 differentiator "AnalyticalToPhysicalAssociationManager link" is **promoted to A table-stakes** if B is in v1.3 scope.
- **C is fully independent of A and B.** Solver work doesn't touch Revit. This is good for parallelization — the grillage solver phase can run independently of the Revit phases.
- **C → ui/grillage/ is sequential**, not parallel. Browser UI must come after solver passes its tests, per project convention.
- **A and B should ship together or A first.** A alone is useful (engineer gets canonical JSON from Revit). B alone without A is broken (no join key, no element IDs to annotate). B without A first is not a meaningful release.

---

## MVP Definition (for v1.3)

### Launch With (v1.3)

- [ ] **A. Revit Tier 2 — Analytical Exporter** (table-stakes only): geometry, view-plane projection, supports, section properties (E/I/A), Revit 2023/24/25 compat, view-type guard, round-trip into frame2d, unit conversion via UnitUtils, diagnostic output, `revit_element_id` written to JSON
- [ ] **B. Revit Results-Import** (table-stakes only): JSON read, member matching via `revit_element_id`, tag analytical members with one user-selected quantity (M / V / N), reaction values at supports, idempotent re-import, active-view annotation, unit-aware formatting, transaction wrap
- [ ] **C. Grillage Solver** (API + tests): solver_core/solvers/grillage.py, GrillageModel dataclass, GrillageAdapter, engine.register("grillage", ...), `/solve/grillage` endpoint, 3+ analytical tests with equilibrium asserts, snapshot regression baseline captured BEFORE solver lands

### Add After Validation (v1.3.x)

- [ ] **A.2 differentiator: load extraction from analytical loads** — once the geometry+supports path is proven on real models, layer in load import
- [ ] **A.2 differentiator: pin-release detection** — clean, mechanical extension once releases come up in real engineer feedback
- [ ] **B.2 differentiator: deformed-geometry overlay via DirectShape** — once tagging is validated, overlay is the natural visual upgrade
- [ ] **B.2 differentiator: user-selectable result quantity (drop-down)** — small UX polish on the placement plumbing
- [ ] **C: browser UI ui/grillage/** — once the solver is trusted, add the discoverability surface

### Future Consideration (v1.4+)

- [ ] **A: load combination resolution** — defer until a single-combination workflow is validated; combination-resolution is a substantial own-feature
- [ ] **B: BMD/SFD diagram overlay** — geometry-heavy; unclear if engineers will use it over numbers
- [ ] **C: pin releases, distributed torque, bridge presets** — extensions that broaden grillage utility once the core is trusted
- [ ] **C: 3D space frame** — explicit v1.4 milestone, distinct from grillage
- [ ] Plate/shell elements, dynamic analysis, design checks — all explicitly out-of-scope for v1.3 and substantial future milestones in their own right

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| A: Revit Tier 2 geometry + supports + section props | HIGH | MEDIUM | P1 |
| A: Revit 2023/24/25 compatibility | HIGH | MEDIUM | P1 |
| A: revit_element_id in JSON output | HIGH (unblocks B) | LOW | P1 |
| A: load extraction from analytical loads | HIGH | MEDIUM | P2 |
| A: pin-release + spring-support extraction | MEDIUM | LOW-MEDIUM | P2 |
| A: load combination resolution | MEDIUM | HIGH | P3 |
| B: tag members with one quantity | HIGH | MEDIUM | P1 |
| B: reactions at supports | HIGH | LOW | P1 |
| B: idempotent re-import | HIGH | LOW | P1 |
| B: deformed-geometry overlay | MEDIUM-HIGH | MEDIUM-HIGH | P2 |
| B: result-quantity drop-down | MEDIUM | LOW | P2 |
| B: color-code by stress utilisation | MEDIUM | MEDIUM | P3 |
| C: solver math (3 DOF, GJ, UDL) | HIGH | LOW-MEDIUM | P1 |
| C: API endpoint + adapter | HIGH | LOW | P1 |
| C: 3+ analytical tests + snapshot baseline | HIGH (gate to ship) | MEDIUM | P1 |
| C: spring supports | MEDIUM | LOW | P2 |
| C: pin releases | MEDIUM | MEDIUM | P2 |
| C: browser UI ui/grillage/ | MEDIUM-HIGH | MEDIUM-HIGH | P2 (ship API-only first) |
| C: bridge-deck presets | MEDIUM | MEDIUM | P3 |
| C: influence lines / moving loads | HIGH (for bridges) | HIGH | P3 (v1.4+) |

**Priority key:**
- P1: Must have for v1.3 launch
- P2: Should have, ship in v1.3 or v1.3.x
- P3: Nice to have, v1.4+

---

## Question-by-Question Answers (Direct Recap for Roadmap)

**(a) Revit Tier 2 — minimum viable analytical export vs nice-to-have:**
Minimum viable = geometry + view-plane projection + supports + section properties (E/I/A) + Revit 2023/24/25 compat + JSON round-trip. **Load extraction from Revit loads is a DIFFERENTIATOR, not table stakes** — engineers will tolerate re-entering loads in the browser UI for v1.3, especially since loads are typically a smaller data set than geometry+supports+sections. **Load combination resolution is a P3 / v1.4 feature** — Revit's combination API is awkward (NewLoadCombination factor-size constraints, walking case→factor relationships) and a single-combination workflow validates the path first.

**(b) Results-Import — deformed geometry vs tag-the-members; new view vs annotate active view:**
Tag-the-members IS sufficient for v1.3 table stakes. Deformed-geometry overlay is a strong differentiator, but it's MEDIUM-HIGH complexity (DirectShape geometry, Hermite interpolation between nodes, exaggeration factor UX) — defer to v1.3.x. **Annotate the active view, do NOT auto-create a new view.** Engineers want to see results in the context of their drawing view (they picked it during export, after all). Idempotent re-import (delete-then-place) handles re-runs cleanly. Auto-creating a new view per import clutters the project browser fast.

**(c) Grillage — minimum test set, skewed grids, UI:**
Minimum test set = 3 analytical cases: (i) degenerate single-line beam under point load (verifies solver reduces to 1D Euler-Bernoulli), (ii) Hambly two-beam grillage cross under central load (THE canonical grillage verification), (iii) single fixed-fixed beam under applied torque (verifies GJ block). **Skewed grids: orthogonal is sufficient for v1.3** — but only if "orthogonal" means right angles between longitudinal and transverse members. Members at arbitrary angles in the XY plane is essentially free (same direction-cosine transform as frame_v2), and engineers will provide it implicitly via their JSON input. The literature actually supports orthogonal-mesh-only even for skewed decks because skew elements lose accuracy at large skew angles. **UI is not table stakes for v1.3** — API-only is acceptable. Engineers can drive via notebooks, the Tekla converter, or hand-built JSON. The grillage UI's hard problem is rendering Mx/My/T on a top-down view (color, symbol, sidebar table?) which is a UX research item in itself.

---

## Sources

- **Revit analytical-model API breaking changes (2023):** [Revit 2024 API — Analytical Model](https://help.autodesk.com/view/RVT/2024/ENU/?guid=Revit_API_Revit_API_Developers_Guide_Discipline_Specific_Functionality_Structural_Engineering_Analytical_Model_html), [The Building Coder — Revit 2024 API](https://thebuildingcoder.typepad.com/blog/2023/04/whats-new-in-the-revit-2024-api.html), [API Changes 2023](https://www.revitapidocs.com/2023/news?section=toc3) — confirm `AnalyticalModel` removed, replaced by `AnalyticalMember` / `AnalyticalPanel` / `AnalyticalToPhysicalAssociationManager` in 2023, no deprecation period
- **Revit load API:** [Revit Loads documentation](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-642E5AFE-C4B0-42B9-9098-1B21C65913B8.htm), [Autodesk — Auto Generation of Load Combinations](https://blogs.autodesk.com/revit/2021/01/22/automatic-generation-of-load-combinations-in-revit/) — confirm `NewLoadCase` / `NewLoadCombination` API surface, factor-size constraints
- **pyRevit IronPython for Revit 2025:** [pyRevit docs](https://docs.pyrevitlabs.io/), [pyRevit forums — Revit 2025](https://discourse.pyrevitlabs.io/t/pyrevit-2025-standard-edition/3357), [pyRevit on GitHub](https://github.com/pyrevitlabs/pyRevit) — confirm pyRevit 2025+ uses .NET 8
- **Revit annotation API:** [IndependentTag Class (2025)](https://www.revitapidocs.com/2025/e52073e2-9d98-6fb5-eb43-288cf9ed2e28.htm), [Tags overview (2025)](https://help.autodesk.com/view/RVT/2025/ENU/?guid=Revit_API_Revit_API_Developers_Guide_Revit_Geometric_Elements_Annotation_Elements_Tags_html), [pyRevit forum — Annotations / Tagmanian Devil](https://discourse.pyrevitlabs.io/t/annotations-tagmanian-devil/2347) — confirm `IndependentTag.Create` API + alternatives via `TextNote.Create`
- **Revit deformed-shape display:** [Analysis Results Display](http://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-A164161C-2C12-4A31-901C-1E7FEB576137.htm), [Structural Analysis Toolkit](https://apps.autodesk.com/RVT/en/Detail/Index?id=7354987843996725256) — confirm `AnalysisDisplayStyle` exists for deformed-shape rendering; engineers expect this from full analysis suites (Robot, SOFiSTiK)
- **Grillage analysis methodology:** [Modelling and analysis of beam bridges (SteelConstruction.info)](https://www.steelconstruction.info/Modelling_and_analysis_of_beam_bridges), [Grillage Analogy in Bridge Analysis (ResearchGate)](https://www.researchgate.net/publication/237189710_The_grillage_analogy_in_bridge_analysis), [Comparative study of Grillage method and FEM (ResearchGate)](https://www.researchgate.net/publication/258104277_Comparative_study_of_Grillage_method_and_Finite_Element_Method_of_RCC_Bridge_Deck), [Skew bridges computational methods](https://www.ijceronline.com/papers/Vol2_issue3/C023628636.pdf), [LUSAS Simple Grillage worked example](https://www.lusas.com/user_area/documentation/V18_0/worked_examples/Simple%20Grillage.pdf) — confirm 3 DOF/node + GJ formulation, orthogonal-mesh preference for skew decks, Hambly two-beam cross as canonical verification case
- **Grillage solver verification cases:** [Simple beam grillage (MDPI)](https://www.mdpi.com/1996-1944/16/4/1346), [AFGC wiki — Beam grillage analysis](https://wiki.afgc.asso.fr/books/finite-element-modeling-and-computations-in-the-field-of-civil-engineering/page/contribution-to-the-beam-grillage-analysis) — confirm Guyon-Massonet, Courbon, Cart-Fauchart as the established analytical reference methods
- **Existing PDA codebase:** `/Users/catrinevans/Documents/pda_project/.planning/PROJECT.md`, `/Users/catrinevans/Documents/pda_project/.planning/MILESTONES.md`, `/Users/catrinevans/Documents/pda_project/CLAUDE.md` — confirms v1.0/v1.1/v1.2 capabilities, AnalysisEngine registry, AnalysisResult dataclass, frame_v2 patterns, snapshot regression gate (D-16), Revit Tier 1 view-plane projection logic

---
*Feature research for: PDA v1.3 — Revit Tier 2 + Results-Import + Grillage Solver*
*Researched: 2026-04-26*
