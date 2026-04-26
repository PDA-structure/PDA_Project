# Architecture Patterns

**Domain:** PDA v1.3 — Revit Tier 2 + Results-Import + Grillage Solver
**Researched:** 2026-04-26
**Mode:** Architecture integration (subsequent milestone — existing pipeline must not change shape)
**Overall confidence:** HIGH (existing repo + sibling repo inspected directly; no novel ecosystem questions)

> Scope note: This file answers four integration questions about how three v1.3 features plug into existing patterns. It does NOT re-research the layered pipeline (Model → Adapter → Solver → AnalysisResult), the AnalysisEngine registry, or the snapshot regression gate — those are settled. See `.planning/PROJECT.md`, `CLAUDE.md`, `solver_core/src/pda_analysis_software/solvers/frame_v2.py`.

---

## Existing Pipeline (settled — do not modify)

```
[Model dataclass]   ← @dataclass, plain numpy arrays, NO logic
      │
      ▼
[Adapter]           ← validates request semantics; raises SolverDiagnosticError;
      │               translates Model → solver __init__ kwargs; returns AnalysisResult
      ▼
[Solver]            ← pure numpy FEM; no print, no matplotlib, no I/O;
      │               solve_structure() / solve() resets force_vector before re-applying ENA
      ▼
[AnalysisResult]    ← (solver, UG, FG, member_forces, member_shears, member_moments, meta)
      │
      ▼
[engine.solve(model, solver_name)]  ← single dispatch via AnalysisEngine registry
      │
      ▼
[FastAPI /solve/<name>]   ← Pydantic request → np.array → engine.solve → JSON-serialise
                            422 handler in api_server/app.py catches RuntimeError
                            (incl. SolverDiagnosticError → structured payload)
```

Reference files:
- `solver_core/src/pda_analysis_software/solvers/frame_v2.py:5-691` — solver template
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py:11-103` — adapter template
- `solver_core/src/pda_analysis_software/models/frame2d_model.py:5-25` — model template
- `api_server/app.py:54-63` — engine registration; `:97-179` — endpoint template
- `scripts/_snapshot_common.py:1-30` — snapshot plugin patches `BeamBarStructure_v2.solve_structure` and `Truss.solve`; new solvers need to be added to the patch list

---

## Feature 1 — Grillage Solver

### Component Boundaries

| Component | New / Modified | Path | Responsibility |
|-----------|----------------|------|----------------|
| `solvers/grillage.py` | NEW | `solver_core/src/pda_analysis_software/solvers/grillage.py` | `BeamGrillage` class — pure numpy FEM, 3 DOF/node (Uz, θx, θy), assembly, solve, recovery |
| `models/grillage_model.py` | NEW | `solver_core/src/pda_analysis_software/models/grillage_model.py` | `GrillageModel` dataclass — geometry, ENForces (vertical), ENTorsions, ENMoments, restraints, E, I, G, J |
| `adapters/grillage_adapters.py` | NEW | `solver_core/src/pda_analysis_software/adapters/grillage_adapters.py` | `GrillageAdapter` — validates G/J presence, translates to solver, returns `AnalysisResult` |
| `api_server/app.py` | MODIFIED | line ~63 | Add `engine.register("grillage", lambda model: GrillageAdapter(model))` |
| `api_server/app.py` | MODIFIED | new endpoint after line 209 | `POST /solve/grillage` + Pydantic `GrillageRequest` |
| `tests/test_grillage.py` | NEW | `tests/test_grillage.py` | analytical test cases (single beam under torsion + bending, simple grid) |
| `scripts/_snapshot_common.py` | MODIFIED | patch list ~line 30 | add `BeamGrillage.solve_structure` to monkey-patched list so grillage tests join the regression gate |
| `tests/snapshots/baseline/` | NEW BASELINES | `tests/snapshots/baseline/` | capture grillage snapshots BEFORE any later mutation (D-16 ordering rule) |
| `ui/grillage/` | OPTIONAL NEW | `ui/grillage/{index.html,style.css,script.js}` | plan-view canvas (X-Y) with vertical-load, support, torsion-spring tools — defer until solver+API stable |

### Data Flow Shape

**DOF convention (1-based public API, mirrors frame_v2):**
- 3 DOF per node: **Uz (vertical translation), θx (rotation about global X), θy (rotation about global Y)**
- DOF base for node `i` (0-indexed): `base = i * 3 + 1`
- Support → restrained DOFs:
  - fixed → `[base, base+1, base+2]` (Uz, θx, θy all locked)
  - simple support (vertical only) → `[base]` (Uz locked, both rotations free)
  - torsionally-restrained simple support → `[base, base+1]` or `[base, base+2]` depending on which axis the torsion is about
- Solvers convert to 0-based internally (same pattern as frame_v2 `_compute_geometry`)

**Why Uz/θx/θy not Ux/Uy/θ:** Grillage members are co-planar in plan (X-Y) and bend out-of-plane. Loads are vertical (global Z). In-plane (X-Y) translations are not part of the model — that's a frame, not a grillage. Confidence: HIGH (standard structural FEM convention; matches every grillage textbook).

**ENForces / ENMoments / ENTorsions analogues:**

| Frame_v2 field | Grillage analogue | Sign convention | Source of UDL contribution |
|----------------|-------------------|------------------|----------------------------|
| `ENForces (m,2)` — Vy at i, j | `ENForces (m,2)` — Vz at i, j | positive = downward | `[-wL/2, -wL/2]` for downward UDL `w` |
| `ENMoments (m,2)` — Mz at i, j (in-plane bending) | `ENMoments (m,2)` — bending moment about the local member axis perpendicular-to-vertical at i, j | sign matches frame_v2: positive at i, negative at j for downward UDL | `[+wL²/12, -wL²/12]` |
| (none) | `ENTorsions (m,2)` — torsional moment about member's longitudinal axis at i, j | typically zero for distributed vertical load on a straight member; non-zero when an eccentric load is modelled or when an end-moment is decomposed at a skewed connection | usually `[0, 0]` |

The third column (`ENTorsions`) IS the new degree-of-freedom and the only field that has no direct frame_v2 counterpart. Its global-frame projection onto θx and θy depends on the member's plan orientation and is computed inside the solver via the local-to-global transformation. Confidence: HIGH for the existence of the field; MEDIUM on the exact sign convention — recommend deriving from work-equivalent principle and asserting symmetry in test_grillage.py.

**Where torsional stiffness lives in the model dataclass:**

```python
@dataclass
class GrillageModel:
    nodes: np.ndarray             # (n, 2) — X, Y in metres (no Z; grillage is planar)
    members: np.ndarray           # (m, 2) — 1-based node-id pairs
    ENForces: np.ndarray          # (m, 2) — vertical equivalent forces [Vz_i, Vz_j]
    ENMoments: np.ndarray         # (m, 2) — bending equivalent moments [M_i, M_j]
    ENTorsions: np.ndarray        # (m, 2) — torsional equivalent moments [T_i, T_j]
    forceVector: np.ndarray       # (3n, 1) — global force vector
    E: Union[float, List[float]]  # Young's modulus, Pa
    I: Union[float, List[float]]  # second moment of area for bending, m⁴
    G: Union[float, List[float]]  # shear modulus, Pa            ← NEW vs frame
    J: Union[float, List[float]]  # torsional constant, m⁴       ← NEW vs frame
    restrainedDoF: List[int] = field(default_factory=list)  # 1-based
    pinDoF: List[int] = field(default_factory=list)
    springDoF: List[int] = field(default_factory=list)
    springStiffness: List[float] = field(default_factory=list)
```

**Why G and J as separate fields, not derived:**
- `G` cannot be derived from `E` alone for arbitrary materials — for steel `G ≈ E/2.6`, but the engineer should provide it explicitly. For concrete/timber/aluminium the ratio differs. Hard-coding `E/2.6` at the adapter would silently produce wrong results for non-steel materials. Confidence: HIGH (basic mechanics of materials).
- `J` is a section property like `I` — engineer-supplied per member (allow `Union[float, List[float]]` to mirror `E`/`I` per-member pattern from frame_v2 v1.0 work).
- Per-member `G` is unusual but follows the established Union pattern at zero extra cost.

**Local stiffness matrix (6×6 per beam, equivalent to frame_v2 `_K_local_frame_6x6`):**

For a grillage member of length L along local x-axis, with Uz/θx/θy DOFs ordered `[Uz_i, θx_i, θy_i, Uz_j, θx_j, θy_j]`:

```
       | 12EI/L³    0       -6EI/L²    -12EI/L³    0       -6EI/L² |
       |   0      GJ/L         0          0      -GJ/L         0   |
K_l =  | -6EI/L²   0       4EI/L      6EI/L²      0       2EI/L   |
       |-12EI/L³   0       6EI/L²     12EI/L³     0       6EI/L²  |
       |   0     -GJ/L         0          0       GJ/L         0   |
       | -6EI/L²   0       2EI/L      6EI/L²      0       4EI/L   |
```

Note `θx` (torsion about local member axis) is **decoupled** from bending — that's the diagonal `[GJ/L, -GJ/L; -GJ/L, GJ/L]` block. Confidence: HIGH (Hibbeler / Megson, standard grillage formulation).

**Transformation T (6×6):** rotation of local axes onto global X-Y plan. For a member at angle θ in plan, the bending DOFs (Uz, θ-about-perpendicular) stay aligned with local; the torsion DOF (θ-about-longitudinal) projects onto global θx and θy via direction cosines `cos θ`, `sin θ`. Mirrors frame_v2 `_T_frame` in shape but operates on different DOF set. Confidence: MEDIUM — flag as an item to verify analytically in the first grillage test (single beam at 45° plan rotation).

**AnalysisResult mapping:**

| AnalysisResult field | Grillage population | Notes |
|-----------------------|---------------------|-------|
| `solver` | `"grillage"` | matches engine registration key |
| `UG` | `(3n, 1)` ndarray of [Uz, θx, θy] interleaved | mirrors frame_v2 layout |
| `FG` | `(3n, 1)` ndarray of [Vz, Mx, My] reactions | mirrors frame_v2 |
| `member_forces` | `None` | grillage has no axial force component (planar members under transverse load) |
| `member_shears` | `(m, 2)` — Vz_i, Vz_j | analogous to frame_v2 `mbrShears` |
| `member_moments` | `(m, 2)` — bending moment at each end | analogous to frame_v2 `mbrMoments` |
| `meta` | `{"n_nodes", "n_members", "member_torsions": [(T_i, T_j), ...]}` | torsion is grillage-specific; live in `meta` rather than expanding the AnalysisResult dataclass — keeps shape stable across solvers |

**Why torsion lives in `meta`, not as a new top-level AnalysisResult field:**
- AnalysisResult is the cross-solver contract. Truss has no torsion, frame has no torsion. Adding `member_torsions: ndarray | None` to the dataclass is a viable forward-compat move (matches the Union pattern), BUT the lower-risk choice is to keep AnalysisResult shape identical across v1.3 and put torsion in `meta` like `member_stresses` already lives there for frame_v2 (`adapters/frame_adapters.py:99-101`). Confidence: MEDIUM. Recommend `meta` for v1.3, defer the AnalysisResult shape change to v1.4 if a third solver also produces torsion (3D frame).

### Patterns to Follow

**1. Force-vector reset before re-solve.** `BeamGrillage.solve_structure()` MUST cache `_force_vector_base = forceVector.copy()` and reset before every `apply_equivalent_nodal_actions`. This is `frame_v2.py:83` and is the basis of being able to call solve repeatedly without double-counting ENAs. Already a hard rule (`CLAUDE.md` line 76).

**2. UDL-on-bar adapter rejection if grillage adds bar elements (it shouldn't initially).** v1.0 grillage scope is beam-only; defer bar elements indefinitely. Confidence: HIGH — adding bars to a grillage is an edge case; out-of-scope.

**3. Snapshot baseline BEFORE solver mutation (D-16).** New grillage tests must be captured as snapshot baselines on the same commit they ship — same git ordering as v1.2 D-16. This is enforced by `scripts/capture_solver_snapshots.py` + `verify_solver_snapshots.py`.

**4. Equilibrium assertion in test_grillage.py.** Sum reaction-DOF rows of FG (not all of FG — it's zero by construction). Match the pattern in `test_frame_v2.py`.

### Anti-Patterns to Avoid

**1. Don't combine bending and torsion in one ENMoments column.** Keep `ENMoments` (bending) and `ENTorsions` (torsion) as separate `(m, 2)` arrays. Mixing them makes the local-to-global transformation impossible to write cleanly and produces opaque sign-convention bugs.

**2. Don't auto-derive G from E.** As above — silently wrong for non-steel.

**3. Don't extend `BeamBarStructure_v2` to handle Uz.** It's a 2D frame solver; the DOF ordering is `[Ux, Uy, θ]`, not `[Uz, θx, θy]`. Trying to repurpose it would require renaming axes and fighting the `_T_frame`, `_K_local_frame_6x6` formulations. Greenfield class is cleaner.

---

## Feature 2 — Revit Tier 2 (StructuralAnalyticalModel pushbutton)

### Component Boundaries

| Component | New / Modified / Retired | Path | Responsibility |
|-----------|--------------------------|------|----------------|
| `pyrevit_exporters/export_to_pda.py` | RETIRED | this repo, line 1-122 | legacy pre-Tier-1 stub; superseded by T1 + T2 — delete or move to `archive/` |
| `StructuralAnalyticalModel.pushbutton/AnalyticalButton_script.py` | NEW (currently 0 bytes — scaffold exists) | sibling repo `Analytical.panel/col1.stack/StructuralAnalyticalModel.pushbutton/` | Tier 2 entry point — collects `AnalyticalMember` instances, projects onto active view's plane, builds canonical PDA JSON |
| `Loads.pushbutton/AnalyticalButton_script.py` | NEW (0 bytes) | sibling repo, same panel | extract loads from analytical model; populate `forceVector` + `ENForces`/`ENMoments` |
| `Supports.pushbutton/AnalyticalButton_script.py` | NEW (0 bytes) | sibling repo, same panel | extract `AnalyticalNode` boundary conditions; populate `restrainedDoF` + `pinDoF` + `springDoF` |
| `lib/Snippets/_pda_export_common.py` | NEW shared helper | sibling repo, `lib/Snippets/` | de-duplicate `_q4`, `_get_or_add_node`, `_merge_and_split`, `_build_json` shared between T1 (frame), T1 (truss), and T2 |
| `ExportToPDA.pushbutton/script.py` (Tier 1 frame) | MODIFIED | sibling repo | refactor to import shared helpers from new `_pda_export_common.py` |
| `ExportToPDA_Truss.pushbutton/script.py` (Tier 1 truss) | MODIFIED | sibling repo | same refactor |

### Helper-Sharing Decision: YES, Share

**Question:** Does the new Tier 2 exporter share helpers with the existing Tier 1 `ExportToPDA` pushbutton, or is it deliberately separate because it's a different data path?

**Answer:** Share — but only for the post-geometry stages.

**What's identical (must be shared):**
- `_q4(x)` — 4-decimal-place quantization for IronPython 2.7 JSON FP-noise mitigation. Currently duplicated verbatim in `ExportToPDA.pushbutton/script.py:56-69` AND `ExportToPDA_Truss.pushbutton/script.py:56-69`. Once Tier 2 ships there'll be three copies.
- `_get_or_add_node(pt, nodes, tol)` — Chebyshev 1mm endpoint merge. Identical in T1-frame and T1-truss.
- `_merge_and_split(segments)` — node dedup + T-junction split + crossing detection. T2 needs T-junction split too because Revit's `AnalyticalMember` instances can share or not share `AnalyticalNode`s depending on how the model was built.
- `_build_json(...)` — emits the canonical JSON with the `canvas.*` block. T2 will call a `_build_json` variant that adds the new `revit_meta` block (see Feature 3 below).
- `_sort_nodes_lexicographic(...)` — D-08 reproducibility.

**What's different (must NOT be shared):**
- **Data source:** T1 reads `DetailLine` instances from an active `ViewDrafting`; T2 reads `AnalyticalMember` instances via `FilteredElementCollector(doc).OfClass(AnalyticalMember).ToElements()` (already the call signature in the legacy `pyrevit_exporters/export_to_pda.py:59-61` — but now from a 3D `View` filtered against the view's `CutPlane`/`SketchPlane`, NOT a drafting view).
- **View-plane projection:** T2 requires projecting 3D analytical-member curves onto the active view plane (plan / elevation / section) and rejecting any member whose endpoints don't lie within ε of that plane. T1 has no projection — drafting-view endpoints are intrinsically 2D.
- **Section properties:** T2 should read `AnalyticalMember.SectionTypeId` → `FamilySymbol` → structural section parameters (`b`, `h`, `Ix`, `A`) and emit per-member overrides. T1 emits the global `DEFAULT_E/I/A`.
- **Supports/loads:** T2 reads `BoundaryConditions` and `PointLoad`/`LineLoad` elements. T1 emits empty arrays — supports/loads added in browser UI.

**Recommended shared module shape:** `lib/Snippets/_pda_export_common.py` exports:
```python
TOLERANCE_M, GRID_PX, ORIGIN_PX, DEFAULT_E, DEFAULT_I, DEFAULT_A   # constants
_q4(x)                                                              # quantization
_get_or_add_node(pt, nodes, tol)                                    # endpoint merge
_point_on_segment_interior(...)                                     # T-junction predicate
_segments_cross_interior(...)                                       # crossing detection
_merge_and_split(segments)                                          # full dedup pipeline
_sort_nodes_lexicographic(nodes, members)                           # D-08
_sanitise_filename(name)                                            # D-13
build_canvas_block(nodes_m, members_pairs_0based)                   # canvas.* dict builder
```

The three pushbuttons (`ExportToPDA` frame, `ExportToPDA_Truss` truss, `StructuralAnalyticalModel` T2) become thin orchestrators around their data-source-specific collection step + the shared post-geometry pipeline.

**Confidence: HIGH** — the duplication between the two Tier 1 scripts is mechanical; flake-out risk on T2 ships is exactly the kind of bug that stale-clone-copy duplication guarantees.

### Migration of Legacy `pyrevit_exporters/export_to_pda.py`

The legacy file in this repo (`pda_project/pyrevit_exporters/export_to_pda.py`) predates the Tier 1 work. Three differences from the production T1 script:
1. It targets `AnalyticalMember` (Tier 2 data path) — NOT `DetailLine` (Tier 1 data path).
2. It does not handle the `canvas.*` block — outputs a stub `canvas: {origin: None, nodes: [], members: [], supports: [], nodeLoads: []}` which the frame2d UI treats as "no canvas state".
3. It has no view-plane projection, no section-property extraction, no support/load extraction — bare-geometry only.

**Migration path:**
1. The existing legacy script is **the closest thing to a Tier 2 starting point** that exists. It demonstrates the `AnalyticalMember` collection pattern.
2. Move/port the Revit API call (`FilteredElementCollector(doc).OfClass(AnalyticalMember).ToElements()` from line 59-61) into the new sibling-repo `StructuralAnalyticalModel.pushbutton/AnalyticalButton_script.py` as the data-source step.
3. Wire it through the new `_pda_export_common._merge_and_split` + `build_canvas_block` (the post-geometry pipeline lifted from T1).
4. Layer on top: view-plane projection, section-property extraction (REVIT-T2-01..07).
5. Delete `pda_project/pyrevit_exporters/export_to_pda.py` (or move to `pda_project/archive/` with a README pointing at the sibling repo).

This is the "retirement" step in PROJECT.md's milestone description.

---

## Feature 3 — Revit Results-Import

### Component Boundaries

| Component | New / Modified | Path | Responsibility |
|-----------|----------------|------|----------------|
| `ImportFromPDA.pushbutton/AnalyticalButton_script.py` | NEW | sibling repo, `Analytical.panel/col1.stack/` (or new col2.stack — watch the 3-column-per-panel limit, see `pyrevit_stack_column_limit` user memory) | reads solver JSON output → maps node/member ids back to Revit AnalyticalMember instances → annotates with displacements/forces/moments |
| `_build_json` in `_pda_export_common.py` | MODIFIED | sibling repo `lib/Snippets/_pda_export_common.py` | emit `revit_meta` block on Tier 2 export only (NOT Tier 1 — see below) |
| Pydantic `Frame2DRequest` (and `GrillageRequest`) | MODIFIED | `api_server/app.py` | accept passthrough `revit_meta: Optional[dict] = None` field |
| `/solve/<name>` response builder | MODIFIED | `api_server/app.py` | echo `revit_meta` back into response if present (passthrough — solver doesn't read it) |

### Id-Mapping Establishment

**Question:** How is the JSON ↔ Revit-element id mapping established? Does Tier 1 need to start emitting Revit ElementIds (additive change), or is this for Tier 2 export → solve → import only?

**Answer:** Tier 2 ONLY. Tier 1 stays unchanged.

**Rationale:**

| Path | Source elements | Round-trip back to Revit makes sense? |
|------|-----------------|----------------------------------------|
| **Tier 1 — DetailLine drafting** | Sketched detail lines in a drafting view | NO. Detail lines are 2D annotation elements — there's no analytical model to annotate. Importing solver results back onto detail lines would be writing displacements onto sketch lines, which has no engineering meaning. |
| **Tier 2 — AnalyticalMember** | Real analytical members backed by physical beam/column families | YES. The whole point. Engineers want σ, M, deflection annotated on the analytical members they modelled. |

So the Results-Import path is **Tier 2 → /solve → Import** only. Tier 1 emits no Revit ElementIds; nobody reads them back.

**ID round-trip mechanism for Tier 2:**

The challenge: PDA's canonical JSON uses 0-based array indices for `nodes` and 1-based pairs for `members`. Revit identifies things by `ElementId` (a 64-bit integer wrapper) and `UniqueId` (a stable GUID). After solve, we need to know that `member_moments[3]` corresponds to Revit `AnalyticalMember` with `UniqueId="abc-123-..."`.

**Recommended approach: emit a `revit_meta` block on Tier 2 export. Solver passes it through unchanged.**

```json
{
  "schema_version": "1.0",
  "solver": "frame2d",
  "nodes": [[...], [...]],
  "members": [[1,2], [2,3], ...],
  ...

  "revit_meta": {
    "source": "revit_tier2",
    "revit_version": "2024",
    "exported_at": "2026-04-26T14:30:00Z",
    "view": {"id": 12345, "name": "Plan Level 0", "type": "ViewPlan"},
    "nodes": [
      {"index": 0, "analytical_node_unique_id": "abc-..."},
      {"index": 1, "analytical_node_unique_id": "def-..."}
    ],
    "members": [
      {"index": 0, "analytical_member_unique_id": "ghi-...", "section_family_symbol": "UB 305x165x40"},
      ...
    ]
  }
}
```

**Why `UniqueId` not `ElementId`:**
- `ElementId.IntegerValue` (or `ElementId.Value` in Revit 2024+) is **NOT stable across export/import** — it changes if the model is purged, transmitted via cloud worksharing, or copy-pasted. `UniqueId` is a GUID that survives these operations. Confidence: HIGH (Revit API docs, Erik Frits LearnRevitAPI references in user memory).
- The cost is negligible (one string per node/member added to the JSON).

**Why this is an additive change (passthrough only):**
- The solver knows nothing about Revit. `revit_meta` is opaque metadata.
- The solver/adapter must NOT read `revit_meta` for any decision — that would couple the solver to a specific UI source.
- `Frame2DRequest` (and `GrillageRequest`) gains an optional `revit_meta: Optional[dict] = None` field; the response echoes it back. That's it.
- Existing callers (Tekla converter, browser UI, T1 exporter) don't emit `revit_meta` — they get None and the field is ignored.

**Pseudocode for the import button:**

```python
# ImportFromPDA.pushbutton — IronPython 2.7
solver_json = json.load(open(solver_output_path))
revit_meta = solver_json.get("revit_meta")
if not revit_meta or revit_meta.get("source") != "revit_tier2":
    forms.alert("This solver output was not produced by Tier 2 export. "
                "Cannot map results back to analytical members.")
    return

with Transaction(doc, "Import PDA results") as t:
    t.Start()
    for entry in revit_meta["members"]:
        idx = entry["index"]
        unique_id = entry["analytical_member_unique_id"]
        elem = doc.GetElement(unique_id)  # GUID lookup, not ElementId
        if elem is None:
            continue  # element deleted between export and import — skip
        # Annotate with solver result fields
        max_moment = max(abs(m) for m in solver_json["member_moments"][idx])
        # ... write to a shared parameter or attach as ExtensibleStorage
    t.Commit()
```

Confidence: HIGH on `doc.GetElement(uniqueId)` being the correct lookup; HIGH on the additive-passthrough pattern being the right scope decision.

### Where the `revit_meta` Field Is Built

**On Tier 2 export, AFTER the geometry pipeline runs:**

```python
# In StructuralAnalyticalModel.pushbutton (sibling repo)
nodes_m, members_pairs, _ = _merge_and_split(segments)
nodes_m, members_pairs = _sort_nodes_lexicographic(nodes_m, members_pairs)

# NEW: build revit_meta in parallel with the canonical JSON
revit_meta = {
    "source": "revit_tier2",
    "revit_version": str(rvt_year),
    "exported_at": _now_iso(),
    "view": {"id": view.Id.IntegerValue, "name": view.Name, "type": type(view).__name__},
    "nodes": _build_node_meta(nodes_m, analytical_node_lookup),
    "members": _build_member_meta(members_pairs, analytical_member_lookup),
}

payload = _build_json(nodes_m, members_pairs)
payload["revit_meta"] = revit_meta
```

`analytical_node_lookup` and `analytical_member_lookup` are dicts built during the data-source step (mapping the geometry endpoints emitted into `nodes_m` back to the originating `AnalyticalMember` / `AnalyticalNode` UniqueIds). This is the **non-trivial part of the mapping** — when `_merge_and_split` collapses two endpoints within 1mm, both originating UniqueIds must be retained (one node may correspond to multiple Revit nodes if they were modelled coincidently).

**Recommended: store as `{node_index: [list_of_unique_ids]}`** — preserves all source IDs even after merge. The import button picks the first UniqueId for annotation lookups; if it's been deleted, falls back to the second; etc.

Confidence: MEDIUM on the multi-UniqueId-per-node strategy — flag this as an integration question for the implementation phase. Single-UniqueId-per-node is simpler and works for 99% of cases (engineers don't typically model coincident analytical nodes).

---

## Suggested Phase Order — Build Grillage FIRST

**Recommendation: Grillage solver → Revit Tier 2 → Revit Results-Import.**

### Rationale

| Phase | Risk | Touches API contract? | Dependencies | Why this order |
|-------|------|----------------------|--------------|----------------|
| 1. Grillage Solver | LOW — pure additive in `solver_core` + `api_server`; mirrors frame_v2 pattern that's already proven; new `/solve/grillage` endpoint doesn't touch existing `/solve/frame2d` or `/solve/truss2d` | NO drift — adds new endpoint, doesn't modify existing | None | Lowest risk, no API drift, no cross-repo coordination, no IronPython 2.7 environment. Engineering team can work fully in CPython 3.10. Snapshot regression gate (D-16) extends mechanically. |
| 2. Revit Tier 2 (Analytical Exporter Hardening) | MEDIUM — IronPython 2.7 + Revit API version differences (2023/24/25); manual-copy deployment on Windows; no CI for the sibling repo; helper de-duplication is mechanical but touches three pushbuttons | NO drift on `/solve/*` — additive `revit_meta` field on requests is the only change | Independent of Grillage. Independent of Results-Import. Could ship before Grillage in parallel-team scenario, but blocks Results-Import. | Sibling repo + Windows host + manual deploy makes this slow; benefits from being post-grillage so the team is in a stable cadence before switching environments. |
| 3. Revit Results-Import | MEDIUM — Revit API for `BoundaryConditions`/parameter writes; Transaction handling; depends on `revit_meta` shape from T2 | YES — adds optional `revit_meta` passthrough field on `Frame2DRequest` (and `GrillageRequest`) | **REQUIRES Tier 2 to emit `revit_meta`** | Cannot be built without Tier 2 because there's no source of UniqueIds in Tier 1. |

### Why NOT Revit-First

The argument *for* Revit-first is "let the high-uncertainty cross-repo work prove out faster". Counter-arguments:

1. **API drift is more disruptive than feature ordering.** If Revit T2 ships first and discovers a needed change to the `/solve/frame2d` request shape, every existing test, fixture, and Tier 1 export breaks. Building grillage first puts the `/solve/grillage` endpoint and any cross-cutting Pydantic changes (the `revit_meta` field) on a clean foundation.

2. **Snapshot regression baseline must be established BEFORE solver mutation (D-16, hard rule).** Grillage tests need their baselines captured at commit time. Doing this *before* any cross-cutting change to `Frame2DRequest` keeps the gate honest.

3. **The grillage feature has been deferred since v1.1.** It's the only one of the three with shipped-but-undelivered customer expectation. Revit T2/Results-Import are extensions of the v1.2 Revit work — there's no comparable backlog age.

4. **Cross-repo coordination cost is amortised.** Once T2 and Results-Import both ship, they're typically iterated together — sibling-repo manual-copy deploy is painful per session, less painful per phase. Grouping them at the end of v1.3 keeps the painful deploy cycle in one window.

### Counter-Recommendation: Parallel Tracks

If the developer prefers, **Grillage and Tier 2 can run in parallel** because they touch disjoint files (solver_core vs sibling repo). Results-Import cannot start until T2 is at least at "emits `revit_meta`" stage. Sequentially: G → T2 → RI. In parallel: (G ‖ T2) → RI.

Confidence: HIGH on the dependency ordering (RI depends on T2). MEDIUM on the absolute G-before-T2 vs T2-before-G ordering — defensible either way; my recommendation is G-first, but a developer who finds Revit work more energising should feel free to invert.

---

## Patterns to Follow (cross-feature)

### Pattern 1: Adapter as the Validation Boundary
**What:** Semantic checks (G/J presence for grillage; `revit_meta` shape if present; UDL on bar) live in the adapter, not the solver.
**When:** Always. Solver stays pure FEM.
**Example:** `frame_adapters.py:42-61` — UDL-on-bar rejection raises `SolverDiagnosticError` with `cause`, `offending_members`. Grillage adapter should mirror this for missing-G-or-J: `raise SolverDiagnosticError(detail=..., cause="missing_torsional_properties", offending_members=[...])`.

### Pattern 2: Passthrough Metadata for UI-Specific Fields
**What:** `revit_meta` lives on the request/response but the solver never reads it. The API echoes it back unchanged.
**When:** When a UI needs to round-trip identity through the solve cycle without coupling the solver.
**Pattern:** `meta` field on `AnalysisResult` (`results/results.py`) — already does this for `member_stresses`. New: `revit_meta` on `Frame2DRequest` mirrors this idea at the request level.

### Pattern 3: Snapshot Baseline Capture BEFORE Solver Mutation
**What:** D-16 git ordering. Grillage tests + their baseline JSONs ship in the same commit.
**Why:** Mechanically prevents "solver was tweaked, baseline was regenerated, regression went undetected".
**Mechanism:** `scripts/_snapshot_common.py` patches solver `solve` methods; `scripts/capture_solver_snapshots.py` writes baselines; `scripts/verify_solver_snapshots.py` compares with `np.allclose(rtol=1e-9, atol=1e-12)`. Add `BeamGrillage.solve_structure` to the patch list.

### Pattern 4: Shared Helpers in `lib/Snippets/`
**What:** Code shared across pyRevit pushbuttons goes in `lib/Snippets/` with leading-underscore filenames.
**Existing examples:** `_units_conversion.py` (`convert_internal_units`), `_selection_func.py` (`get_selected_elements`).
**New:** `_pda_export_common.py` to host the `_q4`, `_get_or_add_node`, `_merge_and_split`, `_sort_nodes_lexicographic`, `_build_canvas_block` helpers currently duplicated across `ExportToPDA` and `ExportToPDA_Truss`, and to be consumed by `StructuralAnalyticalModel`.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Coupling the Solver to a UI Source
**What:** Solver reads `revit_meta` to make a decision (e.g. "if revit_meta.source == 'revit_tier2', use units in mm").
**Why bad:** Couples solver_core to one specific UI; breaks the layered pipeline; would force every other UI (Tekla converter, browser, future Blender) to either emulate the field or be second-class.
**Instead:** Solver is unit-agnostic (always SI). Adapter validates; UI converts at its boundary. `revit_meta` is opaque passthrough only.

### Anti-Pattern 2: Sharing Helpers Across Repos via Vendoring
**What:** Copy `_q4` from `_pda_export_common.py` (sibling repo) into `pyrevit_exporters/` (this repo) "to keep them in sync".
**Why bad:** Vendoring across repos drifts immediately; the function will diverge silently on the first one-side fix.
**Instead:** `pda_project/pyrevit_exporters/` is **retired** entirely. All Revit code lives in the sibling `CustomRevitExtension` repo. Cross-repo helper sharing is not needed because there are no Revit consumers in `pda_project/`.

### Anti-Pattern 3: ElementId.IntegerValue as the Stable Key
**What:** `revit_meta.members[i].element_id_int = mbr.Id.IntegerValue`.
**Why bad:** `IntegerValue` is not stable across worksharing/transmit/copy. Imports will silently miss elements after model migration.
**Instead:** `mbr.UniqueId` (GUID string). Slightly larger payload, fully stable.

### Anti-Pattern 4: Auto-Deriving G from E
**What:** Grillage adapter computes `G = E / 2.6` if user didn't provide G.
**Why bad:** Wrong for non-steel materials (concrete G ≈ E/2.4; timber ≈ E/16; aluminium ≈ E/2.65). Silent wrong answer.
**Instead:** Adapter raises `SolverDiagnosticError(cause="missing_torsional_properties")` if `G is None or J is None`.

### Anti-Pattern 5: Writing to AnalyticalMember Parameters Outside a Transaction
**What:** Results-Import button writes max_moment to a shared parameter without `with Transaction(doc, "..."):` wrapper.
**Why bad:** Revit will throw `Autodesk.Revit.Exceptions.InvalidOperationException`; user sees a stack trace.
**Instead:** Wrap all parameter writes in a single Transaction; commit on success or rollback on error.

---

## Scalability Considerations

| Concern | At 100 members | At 1000 members | At 10,000 members |
|---------|----------------|-----------------|--------------------|
| Grillage `np.linalg.solve` | <10ms | ~50ms | ~5s — still acceptable; dense solve fine per STACK.md |
| Grillage memory (3n × 3n stiffness) | 7 KB | 720 KB | 72 MB — last point where dense is OK; defer scipy.sparse to v1.5+ |
| Tier 2 export `_merge_and_split` (O(n²) crossings check) | <100ms | ~10s | unusable — flag as a v1.4 concern; add a spatial index (e.g. grid bucket) if needed |
| Results-Import `doc.GetElement(uniqueId)` lookups | negligible | negligible | <1s per 10k lookups in IronPython 2.7 |

Confidence: HIGH for solver scalability (matches STACK.md guidance). MEDIUM on the `_merge_and_split` O(n²) cost — Tier 1 has the same characteristic and hasn't been a problem on real drafting views.

---

## Sources

- `solver_core/src/pda_analysis_software/solvers/frame_v2.py:1-691` — primary solver pattern source (HIGH)
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py:1-103` — adapter pattern source (HIGH)
- `api_server/app.py:1-209` — engine registration + endpoint patterns (HIGH)
- `pyrevit_exporters/export_to_pda.py:1-122` — legacy `AnalyticalMember`-based exporter (HIGH for confirming Tier 2 starting point exists)
- `CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/script.py:1-490` — Tier 1 frame production exporter (HIGH for shared-helper analysis)
- `CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/script.py:1-80` — Tier 1 truss production exporter, near-duplicate of frame (HIGH)
- `CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/StructuralAnalyticalModel.pushbutton/AnalyticalButton_script.py` — empty 0-byte scaffold (HIGH — confirms Tier 2 needs to be written, not modified)
- `CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_units_conversion.py`, `_selection_func.py`, `_CoordinateConverterClass.py` — existing shared snippets (HIGH)
- `scripts/_snapshot_common.py:1-30`, `scripts/verify_solver_snapshots.py:1-40` — snapshot regression gate plugin pattern (HIGH)
- `tests/snapshots/baseline/` — 20 frame_v2 baseline JSONs confirm filename convention (HIGH)
- `.planning/PROJECT.md` — milestone framing, hard rules, key decisions (HIGH)
- User memory `pyrevit_stack_column_limit.md` — pyRevit ribbon stacks max 3 columns; relevant when adding Results-Import button to `Analytical.panel` (HIGH from user memory)
- User memory `revit_host_manual_copy_deployment.md` — Windows pyRevit deployment is manual copy + Reload, not git clone; affects developer workflow time-cost in phase ordering (HIGH from user memory)
- User memory `learnrevitapi_reference.md` — Erik Frits / LearnRevitAPI is the practical Revit-API reference for pushbutton dev — should be cited in T2 implementation phase research (HIGH from user memory)
- Standard grillage FEM formulation (Hibbeler, Megson, Przemieniecki) — DOF ordering, K_local for [Uz, θx, θy] (HIGH — undergraduate-level structural mechanics)
- Revit API documentation: `Element.UniqueId` is GUID-string and stable across workshare/transmit; `ElementId.IntegerValue` is not (HIGH — Revit API official docs, consistent with Erik Frits LearnRevitAPI guidance)
