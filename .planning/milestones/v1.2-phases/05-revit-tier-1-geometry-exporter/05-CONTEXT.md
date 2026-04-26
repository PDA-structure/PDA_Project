# Phase 5: Revit Tier 1 — Geometry Exporter - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<cross_repo_constraint>
## Cross-Repo Constraint (read first)

**Code work for this phase lives in a sibling repo:**
`/Users/catrinevans/Documents/CustomRevitExtension/` (pyRevit extension, IronPython 2.7, Revit 2023+).

Planning artifacts (this CONTEXT.md, the eventual PLAN.md, SUMMARY.md, VERIFICATION.md) stay in `pda_project/.planning/phases/05-revit-tier-1-geometry-exporter/` for continuity with ROADMAP.md and STATE.md.

Downstream agents MUST:
- Scout and read source from `CustomRevitExtension/PDA_customRevit.extension/`
- Commit Revit-side code changes in `CustomRevitExtension/` (that repo has its own git history)
- Commit only planning artifacts in `pda_project/`
- Verify the round-trip by loading the exported JSON in `pda_project/ui/frame2d/index.html`

</cross_repo_constraint>

<domain>
## Phase Boundary

A pyRevit button in `CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/` reads **detail lines** from the **active drafting view**, merges coincident endpoints within 1 mm, splits lines at T-junctions, emits canonical PDA JSON (schema v1.0) with `"solver": "frame2d"`, and writes the file via a standard Save-As dialog.

Supports, loads, and per-member property overrides are **out of scope** — the user adds those in the frame2d browser UI after loading the JSON. This phase delivers geometry + connectivity only. Tier 2 (Phase 6) extends the analytical-model exporter in the same extension with supports, loads, and hardening; Phase 5 does not touch that work.

</domain>

<decisions>
## Implementation Decisions

### Detail-line filtering (A1)

- **D-01:** Export **detail lines only** — straight `DetailLine` elements in the active drafting view. Arcs, splines, ellipses, and other `CurveElement` subtypes are silently skipped. Tier 1 has no curved-member concept in frame2d; rejecting non-lines prevents silent mis-representation.
- **D-02:** Accept **all line styles** — no line-style filter in Tier 1. Users are expected to keep drafting views clean; every detail line in the view (or selection) becomes a member.
- **D-03:** **Selection overrides** — if the user has detail lines pre-selected in the active drafting view, export only those. Otherwise export every detail line in the view. Idiomatic pyRevit pattern.
- **D-04:** Empty-view handling — if no detail lines match (or selection is empty *and* view has no detail lines), show a **TaskDialog warning** ("No detail lines found in active drafting view — draw some first.") and **do not write a file**. Prevents confusing empty JSON downstream.

### Node merging & T-junctions (A2)

- **D-05:** **Split at T-junctions.** If line A's endpoint falls within 1 mm of line B's mid-span (not at B's endpoints), split B into two members sharing the new interior node. This produces structurally correct connectivity — the frame2d solver treats shared nodes as rigid joints, so T-junction moment/force transfer works automatically.
- **D-06:** **Warn on mid-span crossings (no split).** If lines A and B cross at an interior point of both (neither has an endpoint near the crossing), leave both unsplit and list the crossing in the post-export warnings section. Rationale: most X-crossings in structural drawings represent visually overlapping but disconnected members (e.g. braces passing behind each other); auto-splitting would be wrong more often than right. Let the user add a node via the frame2d UI if they meant it to be a connection.
- **D-07:** **Tolerance hard-coded at 1 mm.** Matches REVIT-T1-03 literally. Expose as a module-level constant `TOLERANCE_M = 0.001` near the top of the pushbutton script for future tunability at zero UX cost, but no runtime prompt.
- **D-08:** **Node numbering: sorted by (x, y) ascending** — node 1 is the bottom-left-most point, node 2 is next in lexicographic (x, y) order, etc. Reproducible across Revit sessions (same geometry always produces the same JSON); makes diffing fixtures sane; makes tests reliable.

### Default properties + units (A3)

- **D-09:** **Default E / I / A match the frame2d UI prefill values.** Exported JSON embeds `E = 200e9` (Pa), `I = 1e-4` (m⁴ = 10000 cm⁴), `A = 0.01` (m² = 100 cm²). No surprise jump when users open the file in the UI — the sidebar values stay consistent.
- **D-10:** **Always uniform defaults, no per-member mapping.** Every exported member receives the same E/I/A values. Users tune per-member in the frame2d UI (Phase 2 already supports per-member E/I/A as arrays). No Revit-line-style-to-property mapping in Tier 1; that's a Tier 2+ feature (reserved for `CustomRevitExtension/config/` configuration files in a future phase).
- **D-11:** **Coordinate system: Revit internal XY** of the detail-line endpoints, converted from feet to metres. Drafting views are conceptually 2D — internal coords == project coords for detail lines in them. Z is always dropped (REVIT-T1-04). No survey-point transforms, no origin normalisation — the frame2d UI already handles arbitrary origin offsets via its first-node-sets-origin logic.
- **D-12:** **Length units: always metres.** Use `UnitUtils.ConvertFromInternalUnits(value, UnitTypeId.Meters)` (Revit 2021+) or `DisplayUnitType.DUT_METERS` (pre-2021). The extension lib already has a helper at `lib/Snippets/_units_conversion.py` — **reuse it** rather than re-implementing. Output JSON coordinates are rounded to 4 decimal places (REVIT-T1-04). Revit's active project unit setting is ignored.

### Output UX + error flow (A4)

- **D-13:** **Save-As dialog for output destination.** Use Revit's `FileSaveDialog` pre-populated with default filename `<ActiveViewName>_pda.json` (sanitise spaces/slashes). User picks folder + name. No fixed-path auto-saves.
- **D-14:** **Success feedback: TaskDialog with counts + full path.** "Exported **N nodes, M members** to `<full path>`." Single OK button. Clear success signal; user can copy the path text to find the file.
- **D-15:** **Pre-run validation: fail-fast on first violation.** Validation order:
  1. Active view must be a `ViewDrafting` — if not, TaskDialog: "Active view must be a drafting view (found: <ViewType>)." → abort.
  2. At least one detail line must be in scope (selection or view) — if not, D-04 warning → abort.
  3. Z-coordinate check is implicit (drafting views are planar, XYZ.Z is always 0 for DetailLine endpoints) — document but do not add runtime guard.
- **D-16:** **"2D TRUSSES AND 2D FRAMES ONLY" warning — pre-run, once-per-session.** First click in a Revit session shows a TaskDialog: *"This exports detail-line geometry only. Supports and loads must be added in the frame2d browser UI. 2D TRUSSES AND 2D FRAMES ONLY."* with a "Don't show again this session" checkbox. Satisfies REVIT-T1-02 while staying out of the way. Persistence: session-scoped (module-level flag in the pushbutton script) — no registry / settings file.

### Claude's Discretion

- Exact pushbutton directory name (e.g. `GeometryExport.pushbutton` vs `ExportToPDA.pushbutton`) — choose whichever fits the existing `Analytical.panel/col1.stack/` naming pattern alongside `Loads`, `Supports`, `StructuralAnalyticalModel`.
- Button icon — 32x32 PNG; style to match the existing panel (look at `Loads.pushbutton/icon.png` / `Supports.pushbutton/icon.png` for visual consistency).
- Script structure — single `script.py` vs split into `script.py` + helpers. Single file is fine for MVP as long as it reuses `lib/Snippets/_units_conversion.py`.
- Exact TaskDialog wording and title — use pyRevit `forms.alert()` or `TaskDialog.Show()` — whichever is more consistent with the other Analytical.panel buttons.
- Handling of zero-length lines (start ≈ end within tolerance) — skip silently, or include in post-export warnings; the planner may default to silent skip.

### Folded Todos

None — no pending todos matched Phase 5 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-defining specs (this repo)
- `.planning/ROADMAP.md` §"Phase 5: Revit Tier 1 — Geometry Exporter" (lines 40–51) — goal, 5 success criteria, UI hint
- `.planning/REQUIREMENTS.md` §"Revit Tier 1 — Geometry Exporter (REVIT-T1)" — REVIT-T1-01 through REVIT-T1-05
- `.planning/STATE.md` §"Decisions" — confirms Phase 5 repo is `CustomRevitExtension`, pyRevit / IronPython 2.7 constraint

### Canonical JSON schema (Phase 3 baseline; DO NOT change the schema in this phase)
- `.planning/phases/03-interchange-format-and-external-inputs/03-CONTEXT.md` — Phase 3 save/load schema decisions D-01..D-04 (schema_version=1.0, top-level `solver` key, `canvas.supports` convention)
- `tests/fixtures/sample_pda_frame2d.json` — reference example of the Phase 3 schema (read this to confirm exact field names and types)
- `.planning/phases/04-2d-frame-solver-ui-hardening/04-CONTEXT.md` §D-08 — the `canvas.supports` object extension (type-discriminated). Phase 5 emits **empty** `restrainedDoF` / `canvas.supports`, so this is context only (exporter writes no supports).

### Target repo (where the code lives)
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/` — button goes here alongside existing Loads/Supports/StructuralAnalyticalModel buttons
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_units_conversion.py` — **REUSE** the `convert_internal_units()` helper (handles Revit 2021+ `UnitTypeId` and pre-2021 `DisplayUnitType`)
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_CoordinateConverterClass.py` — `PointConverter` class; available if survey-coord handling is ever needed (not used in Tier 1 per D-11)
- `/Users/catrinevans/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_selection_func.py` — for the D-03 "selection overrides" behaviour

### Integration target (where JSON gets loaded for verification)
- `ui/frame2d/index.html` + `ui/frame2d/script.js` — the Load button in the frame2d browser UI; the exported JSON MUST load here and solve after supports/loads are added (REVIT-T1-05)
- `api_server/app.py` — `/solve/frame2d` is the solver endpoint the UI calls after the user adds supports/loads

### Legacy exporter (to understand prior pattern; DO NOT modify or import)
- `pyrevit_exporters/export_to_pda.py` — the legacy analytical-model exporter. Kept for reference only; Phase 6 retires it. Phase 5 does NOT modify, extend, or copy from it — Tier 1 is a clean new exporter, scoped to drafting-view detail lines, not analytical members.

### Project rules
- `CLAUDE.md` §"Hard rules" — no matplotlib, no printing in solver_core path; not directly relevant here (no solver_core changes in this phase) but the exporter's JSON MUST match `Frame2DRequest` in `api_server/app.py` so the UI can solve.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (in `CustomRevitExtension/`)
- `lib/Snippets/_units_conversion.py` → `convert_internal_units(value, get_internal=False, units='m')` — handles Revit 2021+ (`UnitTypeId.Meters`) and pre-2021 (`DisplayUnitType.DUT_METERS`) automatically. Use this for **every** coordinate conversion in the exporter.
- `lib/Snippets/_selection_func.py` — pyRevit helpers for reading the current selection; used for D-03 selection-override behaviour.
- `lib/Snippets/_CoordinateConverterClass.py` — `PointConverter` class (internal / survey / project transforms). Not needed for Tier 1 per D-11 but available if a future phase ever wants survey-coord export.

### Established Patterns (sibling repo)
- pyRevit pushbutton layout: `<ButtonName>.pushbutton/` dir containing `script.py` + `icon.png` (32×32) + optional `bundle.yaml`. Existing buttons (Loads, Supports, StructuralAnalyticalModel, TEST1–3) all follow this pattern.
- Existing Revit imports: `from Autodesk.Revit.DB import *` then `uidoc = __revit__.ActiveUIDocument`, `doc = uidoc.Document`. Standard pyRevit idiom.
- IronPython 2.7 constraint: no f-strings, no type hints beyond `# type: (...)` comments, no Python-3-only syntax. Stick to `.format()` and string concat.

### Integration Points
- **Button location:** `PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/<NewButton>.pushbutton/` — new button goes here; no changes to existing buttons.
- **Output file consumer:** `pda_project/ui/frame2d/script.js` Load handler — JSON must conform to the Phase 3 schema exactly (`schema_version`, `solver`, `nodes`, `members`, etc.) so this loads and solves.
- **Downstream verification:** manually loading the exported JSON into the frame2d UI, adding supports/loads, clicking Solve (REVIT-T1-05 is a human-verifiable success criterion — expect a checkpoint or HUMAN-UAT.md in the plan).

### Creative Options Enabled
- Reusing existing `_units_conversion.py` means the exporter inherits Revit-version-agnostic unit handling for free.
- pyRevit's `forms.alert()` can be used for the D-14 success TaskDialog with minimal boilerplate compared to raw `TaskDialog.Show()`.
- The `PDA_Tools.tab` already has a sensible home (`Analytical.panel`) — no tab/panel restructuring needed.

</code_context>

<specifics>
## Specific Ideas

- **Reuse the existing lib snippets** (D-12 explicitly, D-03 implicitly) — the planner should not re-implement unit conversion or selection handling.
- **Mirror the Phase 3 Save-button JSON shape** — downstream agents should grep `ui/frame2d/script.js` for the Save function and read `tests/fixtures/sample_pda_frame2d.json` to confirm field names, types, and ordering. The exporter is effectively a server-side (Revit-side) counterpart to the UI Save button.

</specifics>

<deferred>
## Deferred Ideas

- **Line-style → property mapping** (e.g. `Beam-IPE200` implies a specific I): defer to Tier 2+. Requires a `config/line_style_properties.json` in the extension and template discipline. Capture as a future phase item.
- **Survey coordinate support**: defer. Tier 1 uses internal/project coords (D-11). The `PointConverter` class in `lib/Snippets/` is available when a future phase needs site-located export.
- **Arc decomposition**: defer — curved members need a polyline approximation strategy, frame2d solver has no arc concept, and structural drafting rarely uses arcs for members anyway.
- **Auto-launch frame2d browser UI after export** (D-14 "open in browser" option): defer. Tier 1 returns the file path in the success dialog; user manually loads. Coupling Revit-side code to the browser-UI repo can happen in Tier 2 or a separate UX phase.
- **Prescribed settlement / Dirichlet BC** (reminder from Phase 4 D-02): unrelated to Phase 5 scope; still deferred.
- **Per-export tolerance prompt**: defer. D-07 hard-codes 1 mm with a module-level constant for future tunability; a runtime prompt is over-engineered for Tier 1.

</deferred>

---

*Phase: 05-revit-tier-1-geometry-exporter*
*Context gathered: 2026-04-20*
