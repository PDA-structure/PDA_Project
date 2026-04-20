# Phase 5: Revit Tier 1 — Geometry Exporter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 05-revit-tier-1-geometry-exporter
**Areas discussed:** Detail-line filtering, Node merging & T-junctions, Default properties + units, Output UX + error flow

---

## Detail-line filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Detail lines only | Straight DetailLine elements only; arcs/splines skipped | ✓ |
| Lines + arcs | Include detail arcs, decompose to single straight members | |
| Any CurveElement | Splines, ellipses, etc. (high silent-drop risk) | |

**User's choice:** Detail lines only (recommended)
**Notes:** Matches REVIT-T1-01 literally; frame2d has no curved-member concept.

| Option | Description | Selected |
|--------|-------------|----------|
| All line styles | Every detail line exported | ✓ |
| Single named style | Only lines with 'PDA-Member' style | |
| User picks style | Pre-run dropdown of styles in view | |

**User's choice:** All line styles (recommended)
**Notes:** Simplest MVP; user keeps drafting views clean.

| Option | Description | Selected |
|--------|-------------|----------|
| Selection overrides, else whole view | Pre-selected lines win; else export all | ✓ |
| Always whole view | Ignore selection | |
| Selection required | Block if nothing selected | |

**User's choice:** Selection overrides, else whole view (recommended)
**Notes:** Idiomatic pyRevit pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| TaskDialog warning, no file | "No lines found — draw some first" | ✓ |
| Write empty JSON anyway | Silent no-content export | |
| Auto-cancel silently | No user feedback | |

**User's choice:** TaskDialog warning, no file written (recommended)
**Notes:** Prevents confusing empty JSONs downstream.

---

## Node merging & T-junctions

| Option | Description | Selected |
|--------|-------------|----------|
| Split line B at T-node | New interior node shared by two members | ✓ |
| Leave unsplit, warn user | Report T-junctions in warnings | |
| Leave unsplit, silent | Rejected — causes disconnected model | |

**User's choice:** Split line B at the T-node (recommended)
**Notes:** Structurally correct; frame2d treats shared nodes as rigid joints.

| Option | Description | Selected |
|--------|-------------|----------|
| Leave unsplit, warn user | X-crossings usually visual not structural | ✓ |
| Always split at crossing | Create crossing node, 4 new members | |
| Leave unsplit, silent | Rejected — misleading when bracing expected | |

**User's choice:** Leave unsplit, warn user (recommended)
**Notes:** Crossings are usually visual overlaps (braces). User handles in UI if connection intended.

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded 1mm | Module-level constant TOLERANCE_M = 0.001 | ✓ |
| Exposed as top-level constant | Same, labelled for future tuning | |
| User prompt per export | Over-engineered for Tier 1 | |

**User's choice:** Hard-coded 1mm (recommended)
**Notes:** Matches REVIT-T1-03 literally; exposed as constant for future tunability.

| Option | Description | Selected |
|--------|-------------|----------|
| Sorted by (x,y) ascending | Reproducible across Revit sessions | ✓ |
| Revit element creation order | Non-reproducible | |
| Sorted by distance from origin | Less intuitive | |

**User's choice:** Sorted by (x, y) ascending (recommended)
**Notes:** Reproducible diffs, reliable tests.

---

## Default properties + units

| Option | Description | Selected |
|--------|-------------|----------|
| Match frame2d UI defaults | E=200 GPa, I=10000 cm⁴, A=100 cm² | ✓ |
| Neutral placeholders (E=1, I=1, A=1) | Force override | |
| Leave blank / omit | Rely on UI defaults on load | |

**User's choice:** Match frame2d UI defaults (recommended)
**Notes:** No surprise jump when user opens JSON in UI.

| Option | Description | Selected |
|--------|-------------|----------|
| Always uniform, user tunes in UI | Same E/I/A for every member | ✓ |
| Line-style → property map | Config JSON linking style to {E,I,A} | |
| Read Revit shared parameters | PDA_E, PDA_I, PDA_A per element | |

**User's choice:** Always uniform defaults (recommended)
**Notes:** Tier 2+ feature; Tier 1 stays simple.

| Option | Description | Selected |
|--------|-------------|----------|
| Revit internal XY | Drafting view's internal 2D coord plane | ✓ |
| Survey coordinates | Apply survey-point transform | |
| Normalise min to (0,0) | Shift bottom-left to origin | |

**User's choice:** Revit internal XY (recommended)
**Notes:** Simplest; frame2d UI handles arbitrary offsets via first-node-sets-origin.

| Option | Description | Selected |
|--------|-------------|----------|
| Always metres via UnitUtils | Use lib/Snippets/_units_conversion.py | ✓ |
| Respect Revit's active unit | Breaks canonical schema | |

**User's choice:** Always metres via UnitUtils.ConvertFromInternalUnits (recommended)
**Notes:** Matches REVIT-T1-04 literally; reuse existing lib helper.

---

## Output UX + error flow

| Option | Description | Selected |
|--------|-------------|----------|
| Save-As dialog | FileSaveDialog pre-populated with view name | ✓ |
| Auto-save to Documents/PDA/ | No dialog, fixed folder | |
| Copy JSON to clipboard | Novel but needs frame2d UI changes | |

**User's choice:** Save-As dialog (recommended)
**Notes:** Standard Windows conventions; user controls location.

| Option | Description | Selected |
|--------|-------------|----------|
| TaskDialog with counts + path | "Exported N nodes, M members to <path>" | ✓ |
| Dialog + 'Open in browser?' button | Auto-launch frame2d UI | |
| Status bar only | Minimal interruption | |

**User's choice:** TaskDialog with counts + path (recommended)
**Notes:** Clear success signal; user can find the file easily.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast on first violation | Stop at first failed check | ✓ |
| Aggregate errors in one dialog | List all problems at once | |
| Warn but export anyway | Dangerous for wrong-view-type | |

**User's choice:** Fail-fast on first violation (recommended)
**Notes:** Simpler to implement and debug in Tier 1.

| Option | Description | Selected |
|--------|-------------|----------|
| Warn pre-run, one-time per session | Dismissable "2D FRAMES ONLY" TaskDialog | ✓ |
| Warn every click | Satisfies spec but annoying | |
| Warn only on wrong view type | Misses REVIT-T1-02 intent | |

**User's choice:** Warn pre-run, one-time dismissable (recommended)
**Notes:** Satisfies REVIT-T1-02; session-scoped flag, no registry.

---

## Claude's Discretion

- Pushbutton directory name (e.g. `GeometryExport.pushbutton` vs `ExportToPDA.pushbutton`) — planner picks based on panel naming convention
- Button icon (32×32 PNG matching existing panel style)
- Script file layout (single `script.py` vs split), as long as `lib/Snippets/_units_conversion.py` is reused
- Exact TaskDialog wording and dialog implementation (`forms.alert()` vs `TaskDialog.Show()`)
- Zero-length line handling (skip silently vs warn) — planner default: silent skip

## Deferred Ideas

- Line-style → property mapping (Tier 2+)
- Survey coordinate support (future, if needed)
- Arc decomposition (future)
- Auto-launch frame2d UI post-export (Tier 2 UX polish)
- Per-export tolerance runtime prompt (module constant is sufficient)
- Prescribed settlement / Dirichlet BC (unrelated; carried over from Phase 4 D-02)
