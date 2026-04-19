# Phase 3: Interchange Format and External Inputs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 03-interchange-format-and-external-inputs
**Areas discussed:** Canonical schema shape, Save/load UX

---

## Canonical Schema Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Solve-ready (mirrors API) | JSON mirrors API payload — ENForces/forceVector pre-computed, SI units. UI just serializes the payload it already builds. | ✓ |
| Source-of-truth (raw loads) | Stores UDL as w values, node loads as objects, supports as strings. Human-readable but needs conversion on load. | |
| Two-layer (both) | Includes both a raw model section and a solve_payload section. | |

**User's choice:** Solve-ready (mirrors API)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full round-trip | Save includes solve payload AND canvas state (supports as strings, load arrows, UDL w values, per-member overrides). Canvas fully restored on load. | ✓ |
| Solve payload only | Just the API-ready fields. Loads and solves correctly, but visual decorators not shown until re-drawn. | |

**User's choice:** Yes — full round-trip

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — schema_version + solver type | Top-level: { schema_version: "1.0", solver: "frame2d", ... }. Enables compatibility validation and forward migration. | ✓ |
| No versioning needed yet | Flat schema. Add versioning later if needed. | |

**User's choice:** Yes — schema_version + solver type

---

## Save/Load UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar buttons | Save and Load in the toolbar alongside mode buttons. | ✓ |
| Sidebar section | File section at the top of the sidebar. | |
| Keyboard shortcuts only | Ctrl+S / Ctrl+O, no visible buttons. | |

**User's choice:** Toolbar buttons

---

| Option | Description | Selected |
|--------|-------------|----------|
| Warn and replace | If canvas non-empty, confirm() dialog before replacing. | ✓ |
| Always replace silently | Load always clears and restores without warning. | |
| Merge / append | Add loaded nodes/members to existing canvas. | |

**User's choice:** Warn and replace

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-named with timestamp | frame2d-model-{ISO timestamp}.json. Same pattern as result export. | ✓ |
| User prompted for filename | Browser prompt() asks for name before download. | |

**User's choice:** Auto-named with timestamp

---

## Claude's Discretion

- Exact Save/Load button labels and icons
- Whether Save is disabled on empty canvas
- Error handling for malformed or mismatched JSON
- Tekla Excel converter deployment (server-side vs standalone CLI script)
- Revit PyRevit export scope and fields

## Deferred Ideas

- Tekla + Revit scope — user selected not to discuss; delegated to Claude
- External converter deployment — user selected not to discuss; delegated to Claude
