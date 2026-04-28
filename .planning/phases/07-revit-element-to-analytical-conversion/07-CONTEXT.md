# Phase 7: Revit Element-to-Analytical Conversion - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Mode:** `--power` (15/15 questions answered, 0 free-text notes)

<domain>
## Phase Boundary

Engineers can convert user-selected physical Revit elements (columns, beams, bracings) into `AnalyticalMember` instances via a single pyRevit pushbutton (`Analytical.panel/ConvertToAnalytical.pushbutton/`), producing a well-formed analytical model that the Phase 8 Tier 2 exporter can consume.

**Repo target:** Sibling `CustomRevitExtension` at `~/Documents/CustomRevitExtension/PDA_customRevit.extension/` (pyRevit, IronPython 2.7, Revit 2025+; manual-copy Windows deploy — re-deploy via folder copy + pyRevit Reload, NOT git clone on host).

**Out of scope:** Slabs / foundations (`OST_Floors`, `OST_StructuralFoundation`) — deferred to v1.5+ Phase 15. Spring supports / pin-releases / loads — Phase 9. Tier 2 export — Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Selection & Input UX
- **D-01 (Q-01):** Hybrid input — if `uidoc.Selection` already contains valid elements at click time, use them; otherwise launch `uidoc.Selection.PickObjects` with the supported-category filter. Empty result from PickObjects → TaskDialog "No elements selected" and exit cleanly.
- **D-02 (Q-02):** Bracings are converted identically to beams (single conversion path through `Document.GenerateMembersFromSelection`), but the element's `StructuralType` (`Beam` / `Brace` / `Girder`) is captured in any logged metadata so Phase 8's Tier 2 exporter can route bracings to bar-style elements downstream if it chooses. No special pin-release on creation in Phase 7.

### Idempotency & Re-runs
- **D-03 (Q-03):** Already-converted elements are skipped (per REVIT-CONVERT-03 via `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId`) and reported on a **distinct summary line** — visually separated from genuine error skips. Engineer sees e.g. `converted: 2 | already-associated: 8 | skipped (errors): 0 | total: 10`. No "regenerate?" secondary prompt — too destructive of engineer's analytical edits.

### Configuration & Extensibility (Q-04 + Q-05 reconciliation — see [Specific Ideas](#specifics))
- **D-04:** Supported categories live as a **module-level dict registry** at the top of `script.py`:
  ```python
  SUPPORTED_CATEGORIES = {
      BuiltInCategory.OST_StructuralColumns: convert_member,
      BuiltInCategory.OST_StructuralFraming: convert_member,
  }
  ```
  Registry shape is in place from day one. Both v1.3 categories point to the **same** handler function (`convert_member`) — no per-category branching code yet. v1.5+ Phase 15 (slabs) adds `OST_Floors: convert_slab` and a new handler without touching the dispatch site.
- **D-05:** Honours REVIT-CONVERT-01's "configurable list, NOT hard-coded" by structure (the dict is the configuration surface) without taking on premature abstraction (CLAUDE.md hard rule).

### Transactions & Error Handling
- **D-06 (Q-06):** Outer `TransactionGroup` named `"PDA: Convert to Analytical"` wraps per-element `Transaction` instances. Each element gets its own atomic transaction; a single failed element rolls back its own transaction only and the group continues. Engineer gets one clean undo step covering the whole batch.
- **D-07 (Q-07):** Skip-reason taxonomy is a **curated short enum** plus an `other-error` fallback that carries the raw exception message:
  - `already-associated` (non-error skip)
  - `unsupported-category`
  - `missing-location`
  - `missing-section`
  - `generation-failed` (used when `Document.GenerateMembersFromSelection` returns no analytical member for an element it didn't reject outright — see D-11)
  - `other-error` (carries raw `str(exc)` for diagnostic visibility)

### Diagnostic Output
- **D-08 (Q-08):** Two-surface diagnostic: a `TaskDialog` shows the summary `{converted, already-associated, skipped, total}` with expandable detail; the **pyRevit Output Window** (`script.get_output()`) prints a markdown table with **clickable element links** for each skip — engineer clicks "ID 12345" and Revit highlights it.
- **D-09 (Q-09):** TaskDialog is always shown, even on a fully-clean run (zero skips). Confirmation > silence — engineer should never wonder "did it actually do anything?"

### Property Preservation
- **D-10 (Q-10):** Trust `Document.GenerateMembersFromSelection` for the conversion call itself, but **post-creation read-back verify** every created `AnalyticalMember` has a non-null section and material. Members that come back with missing data are flagged as `missing-section` skip, the (orphaned) analytical member is removed within its transaction, and the physical element is reported in the summary.
- **D-11 (Q-11):** **REVIT-CONVERT-02 fallback descoped to v1.4+.** The requirement's `AnalyticalToPhysicalAssociationManager.AddAssociation` per-element fallback path is NOT implemented in Phase 7. Elements that `Document.GenerateMembersFromSelection` rejects are logged as `generation-failed`. Re-evaluate after Phase 7 UAT shows real-world skip rate; if v1.3 UAT models exercise the fallback edge case meaningfully, raise as Phase 7.x or fold into Phase 9 spring-support work. **This is a documented requirement softening, not a silent gap.**

### Testing & UAT
- **D-12 (Q-12):** **Three RVT UAT fixtures** authored on Mac, manual-copied to Windows host:
  1. Minimal frame — 4 columns + 2 beams + 1 diagonal brace (covers all 3 categories in one model)
  2. Multi-storey frame — 2 storeys, mixed beams + columns, exercises larger batch
  3. Idempotency re-run — same as fixture 1, but pre-converted: tests the already-associated path explicitly
  Engineer-judged pass/fail recorded in summary. No automated regression pushbutton in Phase 7 (deferred to v1.4+).
- **D-13 (Q-13):** Phase 7's exit gate runs the existing **Phase 5/v1.2 Tier 1 `ExportToPDA` pushbutton** on the converted analytical output for fixture 1 — confirming the analytical model is well-formed enough that the Tier 1 frame2d round-trip survives. Round-trip values match analytical reference within tolerance. (Honours roadmap success criterion 4 directly.)

### Plan Breakdown
- **D-14 (Q-14):** Three plans (matches ROADMAP "3 plans" commitment):
  - **Plan 7-01: Bundle + Selection + Category Filter** — `ConvertToAnalytical.pushbutton/` skeleton (`bundle.yaml`, `icon.png`, `script.py` shell), hybrid `uidoc.Selection` wiring, the `SUPPORTED_CATEGORIES` registry, empty-selection TaskDialog. No conversion calls yet.
  - **Plan 7-02: Conversion + Idempotency + Transactions** — `Document.GenerateMembersFromSelection` call inside `TransactionGroup` + per-element `Transaction`, idempotency pre-check via `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId`, post-creation read-back verification, skip-reason enum taxonomy.
  - **Plan 7-03: Diagnostics + UAT + Windows Deploy** — TaskDialog summary + pyRevit Output Window with clickable element links, three RVT fixtures committed to sibling repo, Phase 5 Tier 1 round-trip on fixture 1, Windows deploy verification (manual copy → pyRevit Reload → ribbon check).

### Code Organisation
- **D-15 (Q-15):** All Phase 7 logic stays **inline in `ConvertToAnalytical.pushbutton/script.py`** for v1.3. Do NOT extract helpers to `lib/Snippets/` yet. Phase 8 will introduce `_pda_export_common.py` when actual sharing materialises (Phase 8 spec already plans for it). YAGNI honoured — CLAUDE.md hard rule against premature abstraction.

### Claude's Discretion
- Exact `bundle.yaml` metadata (tooltip text, button title) — mirror existing PDA pushbutton conventions
- TaskDialog title / icon choice
- Output Window markdown formatting (column order, badge style)
- Error message phrasing for the `other-error` bucket
- Internal helper function names within `script.py`

</decisions>

<specifics>
## Specific Ideas

### Q-04 / Q-05 reconciliation (locked decision, not a gray area)
Q-04 picked the dispatch-table option (c); Q-05 picked YAGNI defer (a). Surface tension. Resolved by adopting the **registry shape** (a Python dict literal) without per-category code branching: both `OST_StructuralColumns` and `OST_StructuralFraming` map to the same `convert_member` function in v1.3. The dict *is* the configuration. v1.5+ adds keys + new handler functions without restructuring the call site. Keeps both decisions honoured: the registry is in place (Q-04) AND there is no premature per-category branching code (Q-05).

### Q-11 documented requirement softening (locked decision)
Q-11 chose to defer the `AddAssociation` fallback path despite REVIT-CONVERT-02 mandating it. The planner and Phase 8 must read this as: REVIT-CONVERT-02 is partially fulfilled in Phase 7. The primary path (`Document.GenerateMembersFromSelection`) is implemented; the fallback is logged as `generation-failed` and deferred to v1.4+. **This is the only requirement softening for Phase 7.** REQUIREMENTS.md REVIT-CONVERT-02 row should reflect "Partial — fallback descoped to v1.4+" status when Phase 7 closes. Re-raise if UAT fixtures exercise the edge case.

### Cross-phase coupling notes for the planner
- Phase 7 outputs analytical members. Phase 8 (Tier 2 exporter) reads them. Phase 7 success criterion 4 (Tier 1 round-trip) provides the smoke test that bridges the two — gives Phase 8 a known-good starting point.
- Bracings carry `StructuralType` metadata (D-02). Phase 8 may use this to route bracings to truss-style export. Phase 7 only needs to *capture* the StructuralType in any logged output, not act on it.
- The `revit_meta` block referenced in REVIT-T2-04 is a Phase 8 concern. Phase 7 does NOT emit `revit_meta` — it only creates analytical members in the Revit document.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements (PDA project)
- `.planning/ROADMAP.md` §"Phase 7: Revit Element-to-Analytical Conversion" — phase goal, depends-on, requirements list, 5 success criteria
- `.planning/REQUIREMENTS.md` §"Element-to-Analytical Conversion (REVIT-CONVERT)" — REVIT-CONVERT-01 through 04 (note: REVIT-CONVERT-02 fallback descoped per D-11)
- `.planning/STATE.md` — milestone v1.3 status, prior-phase decisions, ordering constraints

### Project conventions
- `CLAUDE.md` — repository hard rules (no matplotlib/printing in solver_core; sibling-repo work for Revit; YAGNI / no premature abstraction)
- `.planning/PROJECT.md` — long-term vision, Revit positioning

### Sibling repo (CustomRevitExtension)
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA.pushbutton/` — closest analog: existing pyRevit pushbutton (Phase 5 Tier 1 frame exporter). Mirror its `bundle.yaml` + `script.py` + `icon.png` structure.
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/PDA_Tools.tab/Analytical.panel/col1.stack/ExportToPDA_Truss.pushbutton/` — second analog from quick task 260423-a0q.
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_selection_func.py` — existing selection helper (read for current API style; do NOT extend in Phase 7 per D-15).
- `~/Documents/CustomRevitExtension/PDA_customRevit.extension/lib/Snippets/_units_conversion.py` — existing unit helper (read for IronPython 2.7 patterns).

### External / API references
- Revit API 2025: `Document.GenerateMembersFromSelection(ElementId[])` — primary conversion API. Returns `IList<ElementId>` of created `AnalyticalMember`s.
- Revit API 2025: `AnalyticalToPhysicalAssociationManager.GetAssociatedElementId(ElementId)` — idempotency check.
- Revit API 2025: `AnalyticalToPhysicalAssociationManager.AddAssociation(ElementId, ElementId)` — fallback path (DESCOPED in Phase 7 per D-11; DO NOT implement).
- pyRevit `script.get_output()` — Output Window for clickable element links: `output.linkify(element_id)`.
- pyRevit memory note (project): ribbon stacks max 3 columns; do NOT propose 4-across pushbutton layouts.
- LearnRevitAPI (Erik Frits) — practical pyRevit/Revit API reference, always include in Revit phase research per project memory.

### Memory references (auto-loaded into Claude's context — listed for human readers)
- `MEMORY/custom_revit_extension_repo.md` — sibling repo location and intent
- `MEMORY/revit_host_manual_copy_deployment.md` — Windows deploy is a manual folder copy + pyRevit Reload, NOT git clone
- `MEMORY/project_revit_version_matrix_2025_forward.md` — Revit 2025+ only; 2023/2024 dropped; skip ElementId 32-bit compat
- `MEMORY/pyrevit_stack_column_limit.md` — 3-column ribbon stack limit

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Existing PDA pushbutton bundles** (Phase 5 + quick task 260423-a0q): `ExportToPDA.pushbutton/`, `ExportToPDA_Truss.pushbutton/` provide the canonical bundle layout (`bundle.yaml` + `icon.png` + `script.py`). New `ConvertToAnalytical.pushbutton/` mirrors this structure.
- **`lib/Snippets/_selection_func.py`**: existing selection helper. Read it to understand IronPython 2.7 conventions; do NOT extend it in Phase 7 (D-15).
- **`lib/Snippets/_units_conversion.py`**: existing unit helper. Not directly used by Phase 7 (no unit-bearing fields converted at this stage), but a reference for IronPython 2.7 module style.

### Established Patterns
- **Pushbutton bundle pattern**: `Analytical.panel/col1.stack/<Name>.pushbutton/` with `bundle.yaml` + `script.py` + `icon.png`. Manual-copy deployment (NOT git clone on Windows host) — every new bundle requires explicit copy on the host.
- **TaskDialog summary at end of run**: established by Phase 5 / quick task 260423-a0q exporters. Phase 7 extends with the dual TaskDialog + Output Window pattern (D-08).
- **3-column max stack**: ribbon stack already has 5 buttons. New `ConvertToAnalytical.pushbutton/` either extends an existing stack to a new column position or sits in a new stack — planner decides based on current layout.

### Integration Points
- **Sibling repo only** for Phase 7 — no `pda_project/` changes (no FastAPI updates, no `solver_core` changes, no UI work).
- **Phase 5 Tier 1 round-trip** is the validation harness for D-13: existing `ExportToPDA.pushbutton/` runs against Phase 7's converted output to prove well-formedness. If Phase 5 has stable UAT fixtures, reuse them as the basis for Phase 7's fixture 1.
- **Phase 8 dependency**: Phase 8 expects analytical members to exist. Phase 7's exit gate (D-13) is what unlocks Phase 8 entry.

</code_context>

<deferred>
## Deferred Ideas

- **`AddAssociation` fallback path** (REVIT-CONVERT-02 partial fulfilment) — v1.4+ if UAT shows it's needed; otherwise fold into Phase 9.
- **Per-category handler split** (Q-04(c) full form) — v1.5+ Phase 15 when slabs/foundations need a different conversion path.
- **`lib/Snippets/` extraction** of selection-filter / category-handling logic — Phase 8 (already planned in Phase 8 spec as `_pda_export_common.py`).
- **Bracing-specific pin-release on creation** (Q-02(c)) — engineer can apply manually post-conversion; not a Phase 7 concern.
- **Automated regression pushbutton** in `TestCodes.panel/` (Q-12(c)) — v1.4+ if manual UAT cadence becomes a bottleneck.
- **"Regenerate already-converted?" secondary prompt** (Q-03(b)) — too destructive; not raised again unless engineer explicitly requests.
- **`OST_Floors` / `OST_StructuralFoundation` extension** — v1.5+ Phase 15 per SEED-001 (slab/floor load chasedown).

</deferred>

---

*Phase: 07-revit-element-to-analytical-conversion*
*Context gathered: 2026-04-28*
