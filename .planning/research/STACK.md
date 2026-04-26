# Stack Research

**Domain:** PDA v1.3 — Revit Tier 2 hardening + Results-Import + Grillage Solver
**Researched:** 2026-04-26
**Overall confidence:** HIGH for grillage path; HIGH for pyRevit/IronPython compat (verified against pyRevit release notes); MEDIUM-HIGH for Revit version-spread (verified against Autodesk API docs + Building Coder + revitapidocs.com news pages)

> NOTE: This is a subsequent-milestone research. The validated baseline stack (Python 3.10.11, numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2, httpx ≥0.27 for TestClient) is **fixed and not re-researched**. Below covers only what v1.3 adds or constrains.

---

## TL;DR — Stack Additions for v1.3

1. **Grillage solver: zero new runtime dependencies.** Stay on `numpy.linalg.solve` — same dense DOF scale (≤ a few hundred DOF for realistic decks), same pattern as `frame_v2`. Confirmed by D-09 / project Out-of-Scope rule. **Do NOT add scipy.**
2. **Revit Tier 2 + Results-Import: no new Python deps in `pda_project/`.** All Revit code lives in sibling `CustomRevitExtension` repo, runs inside Revit's pyRevit IronPython 2.7 engine — **no `pip install` step exists for that side**.
3. **Pin a "supported Revit versions" matrix:** Revit 2023, 2024, 2025. Three drift axes to handle in code, not in dependencies: (a) `ElementId.IntegerValue` → `ElementId.Value` 32→64-bit shift in 2024, (b) **.NET Framework 4.8 → .NET 8 in 2025**, (c) IronPython 2.7 loader regression observed on Revit 2025 with pyRevit 5.1 (resolved on later builds). **Recommend pyRevit ≥ 5.0 (latest stable on Windows host) and continue with IronPython 2.7 engine for v1.3.**
4. **Promote a tiny in-house helper module `pda_revit_utils.py`** inside the `CustomRevitExtension` repo (NOT a third-party dep) that wraps the three things that drift across Revit versions: ElementId access, unit conversion (ForgeTypeId-aware), and analytical-curve extraction. Replaces ad-hoc copy-paste from `pyrevit/lib/Snippets`.
5. **Optional dev-only addition for grillage tests:** `sympy ≥ 1.12` to verify torsion + bending coupled cases against closed-form solutions (already mentioned in v1.2 stack notes — not yet added; v1.3 grillage is the right time).

---

## Recommended Stack

### Core Technologies (existing — do not change)

| Technology | Version | Purpose | Why Keep |
|------------|---------|---------|----------|
| Python | 3.10.11 | solver_core + api_server runtime | Already in place; `pyproject.toml` constraint stable |
| numpy | 2.2.6 | All FEM (truss, frame, **grillage**) | Sole solver_core dependency. `np.linalg.solve` correct for dense systems at structural engineering scale. Grillage at typical sizes (~50–500 DOF) sits comfortably in dense-solve territory — adding scipy would violate D-09 / Out-of-Scope rule for marginal benefit |
| FastAPI | 0.135.0 | `/solve/grillage` endpoint | Just register a new endpoint; identical pattern to `/solve/frame2d` |
| Pydantic | 2.12.5 | Grillage request validation | Reuse the schema-mirror-as-API-input pattern (D from v1.1 canonical schema); add `GrillageRequest` model |
| uvicorn | 0.41.0 | ASGI server | Unchanged |
| pytest | 9.0.2 | Solver + adapter + API tests | Unchanged |
| httpx | ≥0.27 | FastAPI TestClient backend | Already added in v1.2 dev deps; required for `/solve/grillage` integration tests |

### Additions for v1.3

| Library / Tool | Version | Scope | Purpose | Why Now |
|----------------|---------|-------|---------|---------|
| **(none for solver_core/api_server runtime)** | — | runtime | — | Grillage is a pure numpy addition. Adding any dep here would violate the project's "computation layer dependency-light" rule (PROJECT.md Constraints). **CONFIDENCE: HIGH** |
| `sympy` | ≥1.12 | **dev-only** (`tests/` env) | Closed-form verification for grillage analytical test cases (e.g. cantilever with torque + bending, simply-supported beam with eccentric point load) | Grillage analytical solutions are messier than 2D frame. Sympy lets us derive verification expressions once and assert against solver output, instead of hand-derivation per test. Mentioned (not added) in v1.2 stack; v1.3 grillage is the trigger. **CONFIDENCE: MEDIUM** — only add if the first 2–3 grillage analytical tests prove painful to derive by hand. |
| `pytest-cov` | ≥5.0 | **dev-only** | Coverage reporting; identifies untested adapter branches | Test count crosses 70+ in v1.3 (61 baseline + grillage tests). Coverage flags untested paths in the grillage adapter (UDL-on-bar-style validation, pin releases). **CONFIDENCE: MEDIUM** — defer if not painful. |

### Revit-side stack (sibling `CustomRevitExtension` repo — NOT `pda_project/`)

| Tool / Component | Version constraint | Purpose | Why |
|------------------|-------------------|---------|-----|
| Revit (host) | 2023, 2024, 2025 (supported matrix) | Host application | Existing legacy script declares "Revit 2023+". v1.3 must add explicit 2024 + 2025 verification. **CONFIDENCE: HIGH** — version matrix is the documented support window. |
| pyRevit | ≥ 5.0 (latest stable build on the Windows host) | Pushbutton runtime, `forms`, `script`, `output`, `coreutils` | pyRevit 5.x ships both IronPython 2.7.12 and CPython 3.12.3 engines side-by-side. Recommend pinning to the **latest stable v5** on the Windows host; do NOT use 5.1 release specifically due to IronPython 2.7 loader regression on Revit 2025 reported on the pyRevit forum. **CONFIDENCE: MEDIUM** (forum-reported, not in changelog yet) |
| IronPython | 2.7.12 (bundled with pyRevit) | Script engine for v1.3 buttons | Existing `export_to_pda.py` is IronPython 2.7. Migrating the Tier 2 + Results-Import buttons to CPython3 would be a **scope expansion**, not a hardening — defer. CPython3 in pyRevit is "still not fully supported" per pyRevit forum (Revit 2025 CPython3 broken on pyRevit 5.0). **CONFIDENCE: HIGH** — confirmed by pyRevit Discourse posts. |
| .NET runtime | 4.8 (Revit 2023/24) **AND** .NET 8 (Revit 2025+) | Underlying CLR | Revit 2025 is the .NET 8 cutover. **For pure pyRevit/IronPython scripts (no compiled add-in DLL), this is invisible** — pyRevit 5.x abstracts over both runtimes. Only relevant if we ever ship a compiled C# helper. **CONFIDENCE: HIGH** — Autodesk official .NET 8 migration guide is explicit. |
| Revit API namespaces touched | `Autodesk.Revit.DB`, `Autodesk.Revit.DB.Structure` | Element collection + analytical model | See "Revit API surface" section below. **CONFIDENCE: HIGH** — same surface as legacy script, plus structural members for Tier 2. |

### What stays the same (do NOT touch)

| Component | Why untouched |
|-----------|--------------|
| Vanilla JS canvas UIs | Grillage UI (if built) follows truss2d/frame2d pattern. No framework. |
| `solver_core` numpy-only rule | D-09 + PROJECT.md Out-of-Scope explicitly bans scipy. |
| `visualization/` lazy matplotlib | Grillage visualisation reuses BMD/SFD plotting helpers. |
| Snapshot regression gate (D-16) | Grillage gets its own baseline JSONs added BEFORE merge. Pattern unchanged. |

---

## Revit API surface — drift map across 2023 / 2024 / 2025

This is the heart of the milestone risk. None of these require new Python packages, but they require **conditional code paths**.

### Surface used by v1.3 buttons

| API symbol | Namespace | Used in | First available |
|------------|-----------|---------|----------------|
| `FilteredElementCollector` | `Autodesk.Revit.DB` | All buttons | <2020 (stable) |
| `AnalyticalMember` | `Autodesk.Revit.DB.Structure` | Tier 2, Results-Import | **Revit 2023** (replaced pre-2023 `AnalyticalModel`) |
| `AnalyticalNode` | `Autodesk.Revit.DB.Structure` | Tier 2 (support extraction) | Revit 2023 |
| `AnalyticalToPhysicalAssociationManager` | `Autodesk.Revit.DB.Structure` | Tier 2 (back-link to physical for section family parameters) | Revit 2023 |
| `StructuralAsset` (via `Material.StructuralAssetId`) | `Autodesk.Revit.DB` | Tier 2 (E extraction) | <2020 (stable) |
| `Material.GetStructuralAsset()` / `PropertySetElement` | `Autodesk.Revit.DB` | Tier 2 (E lookup) | <2020 (stable) |
| `BuiltInParameter` family params (e.g. `STRUCTURAL_SECTION_AREA`, `STRUCTURAL_SECTION_COMMON_MOMENTOFINERTIASTRONGAXIS`) | `Autodesk.Revit.DB` | Tier 2 (A, I extraction from FamilySymbol of the physical element) | <2020 (stable) |
| `UnitUtils.ConvertFromInternalUnits(value, ForgeTypeId)` | `Autodesk.Revit.DB` | Tier 2 + Results-Import (unit conversion) | Revit 2021+ (`ForgeTypeId` API) |
| `View.SketchPlane` / `View.ViewDirection` | `Autodesk.Revit.DB` | Tier 2 view-plane projection | <2020 (stable) |
| `Transaction` | `Autodesk.Revit.DB` | Results-Import (writes annotations to model) | <2020 (stable) |
| `AnnotationSymbolType` / `IndependentTag` / `TextNote` | `Autodesk.Revit.DB` | Results-Import (annotate displacements/reactions) | <2020 (stable) |

### Drift axis 1 — Revit 2023: analytical-model rewrite (already absorbed by legacy script)

- Pre-2023: `element.GetAnalyticalModel()` returned an `AnalyticalModel` derived from a physical element automatically.
- **2023+: replaced by independent `AnalyticalMember` / `AnalyticalNode` elements.** Physical ↔ analytical link is mediated by `AnalyticalToPhysicalAssociationManager` (a static method off `Document`).
- **Impact on v1.3:** legacy script already targets the new API; Tier 2 just extends it. Section properties live on the *physical* element (FamilySymbol parameters), not on `AnalyticalMember` — so we **must traverse** `AnalyticalToPhysicalAssociationManager.GetAnalyticalToPhysicalAssociationManager(doc).GetAssociatedElementId(analyticalId)` to find the physical element, then read `BuiltInParameter.STRUCTURAL_SECTION_*` parameters. **CONFIDENCE: HIGH** — verified against revitapidocs.com 2023 docs + Building Coder.
- **Risk:** if the user has not associated their analytical members with physical elements, A/I/E extraction silently falls back to defaults. This needs a Tier 2 warning.

### Drift axis 2 — Revit 2024: ElementId 32→64-bit storage

- `ElementId.IntegerValue` (the property) **throws** in 2024 if the underlying value exceeds 32-bit. Replaced by `ElementId.Value` (64-bit `long`).
- `BuiltInCategory` enum's underlying type widened from `int` (32-bit) to `long` (64-bit). Pre-2024-compiled C# add-ins must be rebuilt.
- **Impact on v1.3:** the legacy script uses `FilteredElementCollector(...).OfClass(...)` and never calls `.IntegerValue` directly — **likely no immediate code change for current usage**. BUT if the new Tier 2 button reads parameter dictionaries keyed by `ElementId` (e.g. mapping analytical → physical), we must use `.Value` not `.IntegerValue`.
- **Recommended pattern:** wrap in helper `pda_revit_utils.element_id_value(eid)` that does `try: return eid.Value; except AttributeError: return eid.IntegerValue` — robust across 2023 (only `IntegerValue`) and 2024+ (only `Value`). **CONFIDENCE: HIGH** — verified against revitapidocs.com 2024 news + ricaun obsolete tracker + pyRevit issue #1796.

### Drift axis 3 — Revit 2025: .NET Framework 4.8 → .NET 8

- Revit 2025 builds on .NET 8 (modern .NET Core lineage), not .NET Framework 4.8. Compiled C# add-ins **must** be rebuilt with multi-targeting (e.g. `<TargetFrameworks>net48;net8.0-windows</TargetFrameworks>`).
- **Impact on v1.3 (pyRevit/IronPython only):** the .NET cutover is **invisible to IronPython scripts** — pyRevit's runtime layer wraps both 4.8 (Revit 2023/24) and net8 (Revit 2025+) IronPython engines, exposing the same Python API. We do not need to multi-target anything.
- **Caveat:** pyRevit 5.1 had an IronPython 2.7 loader regression specifically on Revit 2025 (reported on Discourse). **Do not pin to 5.1**; pin to either ≤ 5.0.x or ≥ 5.1.x with the fix verified on the Windows host. **CONFIDENCE: MEDIUM** — forum-reported. Verify on host before relying on a specific version.

### Drift axis 4 — UnitTypeId / ForgeTypeId stabilisation (Revit 2021+)

- The old `DisplayUnitType` enum is deprecated. Use `UnitTypeId.Meters`, `UnitTypeId.Newtons`, etc., as `ForgeTypeId` instances passed to `UnitUtils.ConvertFromInternalUnits`.
- **Impact on v1.3:** legacy script hard-codes `* 0.3048` for feet → metres. **Acceptable for length** (the conversion factor is exact and stable). But for forces (N) and moments (N·m) extracted in Results-Import, **prefer `UnitUtils.ConvertFromInternalUnits` with explicit `ForgeTypeId`** — Revit's internal unit for force is "kips", not Newtons, and the constant differs by unit. **CONFIDENCE: HIGH** — Autodesk official ForgeTypeId guide.

---

## Helper utilities — promote to in-house module

Looking at `pyrevit/lib/Snippets/` (and the wider `coreutils` / `forms` / `script` modules), there is **nothing we should adopt as a hard dependency** beyond the standard pyRevit imports we already use (`forms.alert`, `forms.save_file`, `script.get_output()`).

Instead, formalise three small helpers in a **new in-house module** in the sibling repo: `CustomRevitExtension/Analytical.extension/lib/pda_revit_utils.py`.

| Helper | Wraps drift axis | Body sketch |
|--------|------------------|-------------|
| `element_id_value(eid)` | 2024 ElementId 32→64-bit | `try: return eid.Value; except AttributeError: return eid.IntegerValue` |
| `feet_to_metres(xyz)` | Stable; centralise rounding | Returns `[round(xyz.X*0.3048,4), round(xyz.Y*0.3048,4)]` (already inlined in legacy script — extract) |
| `internal_to_si(value, kind)` | ForgeTypeId for forces/moments in Results-Import | `kind` ∈ {"length","force","moment","stress"}; uses `UnitUtils.ConvertFromInternalUnits` with `UnitTypeId.Meters` / `Newtons` / `NewtonMeters` / `Pascals` |
| `get_associated_physical(doc, analytical_id)` | 2023 association manager | Wraps the static manager call + handles unassociated case |
| `get_section_properties(physical_elem)` | Tier 2 section extraction | Reads `BuiltInParameter.STRUCTURAL_SECTION_*` from the FamilySymbol; returns `{"A": ..., "I": ..., "E": ...}` with `None` for missing |

This module:
- **Is NOT a Python package** (no `pip`, no `setup.py`). It is a single file under `Analytical.extension/lib/` per pyRevit's lib-extension pattern.
- Lives in the sibling `CustomRevitExtension` repo, not `pda_project`.
- Is imported in pushbutton scripts as `from pda_revit_utils import element_id_value, feet_to_metres, ...`.
- Is the canonical anti-drift surface — every Revit-version branch goes here, not in pushbutton scripts.

**CONFIDENCE: HIGH** that this is the right pattern (matches pyRevit's lib-extension docs); MEDIUM that the exact helper list is complete (will likely grow as Tier 2 is built).

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `numpy.linalg.solve` for grillage | `scipy.sparse.linalg.spsolve` | DOF count for realistic grillage (a single bridge deck or floor grid) sits in 50–500 range — well below the ~5000 DOF threshold where sparse becomes a win. Adding scipy violates D-09. **CONFIDENCE: HIGH** |
| `numpy.linalg.solve` | `numpy.linalg.lstsq` | `lstsq` masks structural modelling errors (under-restrained grillage should fail-fast → 422, not return a least-squares result). Keep `solve` + singular-matrix handling. **CONFIDENCE: HIGH** |
| IronPython 2.7 for v1.3 buttons | CPython3 (pyRevit `#! python3` shebang) | CPython3 in pyRevit 5.x is still flagged "not fully supported" on the pyRevit Discourse; Revit 2025 + pyRevit 5.0 + CPython3 was reported broken by users. Migrating from IPy2.7 → CPython3 is a separate hardening effort, not part of v1.3. **CONFIDENCE: HIGH** |
| In-house `pda_revit_utils.py` | Vendored copy of `pyrevit.coreutils` symbols | We use only ~5 functions; vendoring adds review surface and license tracking for no gain. A small bespoke module is cleaner. **CONFIDENCE: HIGH** |
| Full Revit 2023/24/25 support matrix | Drop Revit 2023 to simplify | 2023 is still in deployment at structural firms; project policy says "Revit 2023+". Keep all three. **CONFIDENCE: MEDIUM** — verify with Paolo if 2023 user base is small. |
| Compiled C# helper for performance-critical extraction | None | Tier 2 extraction runs once per export and reads N analytical members (typically <500). No performance need. Avoid the .NET 4.8 / .NET 8 multi-target burden. **CONFIDENCE: HIGH** |
| `pytest.approx` analytical cases for grillage | Snapshot baselines only | Grillage closed-form solutions exist for canonical cases (cantilever with torque, two-beam grid). Prefer analytical → proves correctness, not just consistency. Add snapshots ON TOP for regression. Same pattern as v1.2. **CONFIDENCE: HIGH** |
| `sympy` (dev-only, optional) | Hand-derived analytical solutions | Only adopt if the first 2–3 grillage analytical cases prove painful by hand. Default to manual + cross-checked references. **CONFIDENCE: MEDIUM** |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `scipy` in `solver_core` | Hard project rule (D-09 / Out-of-Scope). Adds Blender/Mac install complexity for no benefit at our DOF scale | `numpy.linalg.solve` |
| `matplotlib` in `solver_core` | Hard rule | Lazy import inside `visualization/` |
| `f"…"` strings or any Python 3.6+ syntax in pyRevit IronPython 2.7 buttons | IronPython 2.7 does not support f-strings, walrus operator, type hints, dataclasses | `str.format()` (legacy script already follows this) |
| `eid.IntegerValue` in Revit 2024+ buttons | Throws on 64-bit ElementIds | `pda_revit_utils.element_id_value(eid)` |
| `DisplayUnitType` enum for unit conversion | Deprecated; removed long-term | `UnitTypeId.X` (ForgeTypeId) + `UnitUtils.ConvertFromInternalUnits` |
| `element.GetAnalyticalModel()` | Removed in Revit 2023 | Iterate `AnalyticalMember` directly + use `AnalyticalToPhysicalAssociationManager` |
| pyRevit 5.1 specifically (Revit 2025 host) | IronPython 2.7 loader regression reported on Discourse | pyRevit ≥ 5.0 latest stable, verified on Windows host before pinning |
| Compiled C# add-in alongside pushbuttons (for v1.3) | Forces .NET 4.8 / .NET 8 multi-target build for Revit 2023 vs 2025 — no benefit | Pure pyRevit/IronPython scripts — pyRevit handles the runtime split |

---

## Grillage solver — specific stack notes

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Element DOF | 3 per node: Uz (vertical disp), θx (rotation about x), θy (rotation about y) | Standard planar-grillage convention; matches PROJECT.md milestone description |
| Element stiffness matrix | 6×6 (3 DOF × 2 nodes); separate bending (EI) block + torsion (GJ/L) block | Decoupled in local coordinates for a straight grillage member; coupling appears only via global transformation when members are not aligned with global X |
| Material/section inputs | `E`, `I`, `G`, `J` per member (or uniform); `G` derivable from `E` and `ν` (Poisson) if needed | Add `J` field to `GrillageModel2D` dataclass. `G` either explicit or computed from `E/(2(1+ν))` with `ν=0.3` default |
| Linear solver | `np.linalg.solve(Ks_reduced, f_reduced)` | Same as frame_v2; same DOF scale |
| Tests | At least one analytical case (cantilever with end torque + end point load), equilibrium assertion (sum of reaction-DOFs = applied), snapshot baseline | Same pattern as frame_v2 hardening; D-16 enforces |
| API endpoint | `POST /solve/grillage` with `GrillageRequest` Pydantic model | Same shape as `/solve/frame2d`; `GrillageAdapter` registered in engine via `engine.register("grillage", lambda m: GrillageAdapter(m))` |
| UI | Optional. If built, follows truss2d/frame2d canvas + grid pattern | Pure addition; no shared-state concerns |

**No new runtime deps. CONFIDENCE: HIGH.**

---

## Version Compatibility Matrix

| Component | Revit 2023 | Revit 2024 | Revit 2025 | Notes |
|-----------|-----------|-----------|-----------|-------|
| `AnalyticalMember` API | ✓ available | ✓ available | ✓ available | Stable since 2023 |
| `ElementId.Value` (64-bit) | ✗ use `.IntegerValue` | ✓ required | ✓ required | Wrap in helper |
| `ElementId.IntegerValue` | ✓ available | ⚠️ throws on >32-bit | ⚠️ throws on >32-bit | Avoid going forward |
| `ForgeTypeId` / `UnitTypeId` | ✓ available | ✓ available | ✓ available | Stable since 2021 |
| .NET runtime | 4.8 | 4.8 | 8.0 | pyRevit IronPython 2.7 abstracts |
| `AnalyticalToPhysicalAssociationManager` | ✓ available | ✓ available | ✓ available | Stable since 2023 |
| `Transaction` (for Results-Import writes) | ✓ stable | ✓ stable | ✓ stable | — |
| pyRevit 5.0.x | ✓ supported | ✓ supported | ⚠️ CPython3 broken (per forum); IronPython 2.7 OK | Pin IPy2.7 |
| pyRevit 5.1.x | ✓ supported | ✓ supported | ⚠️ IPy2.7 loader regression (per forum) | **Avoid 5.1 specifically** until verified on host |

---

## Installation

### `pda_project/` side (Mac dev + CI)

```bash
# No new runtime deps. Optional dev-only:
pip install --upgrade sympy>=1.12     # only if grillage analytical tests prove painful
pip install --upgrade pytest-cov>=5.0 # optional coverage reporting
```

Update `solver_core/pyproject.toml` only if `sympy` is added (in `[project.optional-dependencies]` `dev` extra; do NOT add to runtime deps).

### `CustomRevitExtension/` side (Windows host, manual-copy deploy)

No `pip install`. Verify on the Windows host:

```
1. Confirm pyRevit version: in Revit, pyRevit tab → Settings → check version banner
2. Pin recommended: latest pyRevit 5.x stable (avoid 5.1.x specifically; check Discourse before upgrading)
3. New `Analytical.extension/lib/pda_revit_utils.py` — created once, imported by all v1.3 pushbutton scripts
4. New pushbuttons:
   - Analytical.panel/StructuralAnalyticalModel.pushbutton/  (Tier 2 export)
   - Analytical.panel/ImportPDAResults.pushbutton/           (Results-Import)
5. Manual-copy deploy per existing project convention (memory: revit_host_manual_copy_deployment.md)
6. pyRevit Reload after each copy
```

---

## Sources

- [Autodesk Revit 2024 API: Analytical Model](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Discipline_Specific_Functionality/Structural_Engineering/Revit_API_Revit_API_Developers_Guide_Discipline_Specific_Functionality_Structural_Engineering_Analytical_Model_html.html)
- [revitapidocs.com — AnalyticalToPhysicalAssociationManager (2023)](https://www.revitapidocs.com/2023/0f7f395b-3f70-aa6e-e584-b70c11f767ad.htm)
- [revitapidocs.com — AnalyticalMember Class (2023)](https://www.revitapidocs.com/2023/57c87ac5-a82e-5c7e-2f06-6dbf1f697566.htm)
- [revitapidocs.com — API Changes 2023 (analytical model rewrite)](https://www.revitapidocs.com/2023/news?section=toc3)
- [revitapidocs.com — API Changes 2024 (ElementId 64-bit)](https://www.revitapidocs.com/2024/news)
- [pyRevit issue #1796 — Revit 2024 ElementId breaking change](https://github.com/pyrevitlabs/pyRevit/issues/1796)
- [Building Coder — TBC Samples 2023 and the New Structural API](https://thebuildingcoder.typepad.com/blog/2022/04/tbc-samples-2023-and-the-new-structural-api.html)
- [Autodesk — Migrating From .NET 4.8 to .NET 8 (Revit 2025)](https://help.autodesk.com/cloudhelp/2025/DEU/Revit-API/files/Revit_API_Developers_Guide/Introduction/Getting_Started/Using_the_Autodesk_Revit_API/Revit_API_Revit_API_Developers_Guide_Introduction_Getting_Started_Using_the_Autodesk_Revit_API_NET8_Update_html.html)
- [Kamil Korus — Revit 2025 API migration step-by-step](https://blog.kamilkorus.com/revit-2025-api-migration-step-by-step-guide-from-net-framework-to-net-8/)
- [pyRevit 5.1 IronPython 2.7 loader regression on Revit 2025 (Discourse)](https://discourse.pyrevitlabs.io/t/pyrevit-5-1-fails-loading-ironpython-2-7-on-revit-2025/9170)
- [pyRevit + Revit 2025 + CPython3 status (Discourse)](https://discourse.pyrevitlabs.io/t/pyrevit-5-revit-2025-cpython3/7816)
- [pyRevit releases (engine versions IronPython 2.7.12 + CPython 3.12.3)](https://github.com/pyrevitlabs/pyRevit/releases)
- [pyRevit coreutils reference](https://docs.pyrevitlabs.io/reference/pyrevit/coreutils/)
- [Boost Your BIM — ForgeTypeId in Revit 2022+](https://boostyourbim.wordpress.com/2021/04/15/revit-2022-whats-up-with-forgetypeid/)
- [ricaun — Revit API 2024 obsolete tracker](https://ricaun.com/revit-api-2024-obsolete/)
- Existing legacy script: `/Users/catrinevans/Documents/pda_project/pyrevit_exporters/export_to_pda.py` (verified to use `AnalyticalMember` + IronPython 2.7 conventions already)
