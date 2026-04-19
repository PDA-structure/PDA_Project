# Phase 3: Interchange Format and External Inputs - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Engineers can save and load structures from the browser UIs (frame2d and truss2d). External tools (Tekla Structural Designer, Revit) can export to the same canonical JSON schema. The interchange format serves as both a persistence layer and a debugging/communication tool.

**In scope:** Save/load buttons in both UIs, canonical JSON schema design, Tekla Excel import converter, Revit PyRevit export script, schema documentation.

**Not in scope:** Grillage solver (Phase 4), load combinations, design code checking.

</domain>

<decisions>
## Implementation Decisions

### Canonical JSON Schema

- **D-01:** Schema is **solve-ready** — the file contains fields that mirror the API request payload exactly (`nodes`, `members`, `ENForces`, `ENMoments`, `forceVector`, `restrainedDoF`, `E`, `I`, `A`, `bars`, `beamPinLeft`, `beamPinRight`, `springDoF`, `springStiffness`, etc.). Loading a file and POSTing it to `/solve/frame2d` or `/solve/truss2d` must work without any field transformation.

- **D-02:** Schema includes **full canvas round-trip state** in a top-level `canvas` key. This stores the UI model state needed to restore visual decorators: supports as type strings (`"fixed"`, `"pinned"`, `"rollerX"`, `"rollerY"`), node loads as `{nodeId, direction, magnitude}`, UDL as `{memberId, wy, wx}`, per-member E/I/A overrides in UI units (GPa, cm⁴, cm²), and node coordinates in metres. On load, the canvas is fully restored — support symbols, load arrows, UDL markers all appear correctly.

- **D-03:** Top-level metadata fields: `schema_version: "1.0"` and `solver: "frame2d"` (or `"truss2d"`). The loader uses `solver` to route to the correct endpoint and validate that the file matches the current UI. Enables forward-compatible migration when the schema evolves.

- **D-04:** File structure summary:
  ```json
  {
    "schema_version": "1.0",
    "solver": "frame2d",
    // --- solve payload (mirrors Frame2DRequest / Truss2DRequest) ---
    "nodes": [[x, y], ...],
    "members": [[i, j], ...],
    "ENForces": [[fi, fj], ...],
    "ENMoments": [[mi, mj], ...],
    "forceVector": [...],
    "E": ..., "I": ..., "A": ...,
    "restrainedDoF": [...],
    "bars": [...], "beamPinLeft": [...], "beamPinRight": [...],
    "springDoF": [...], "springStiffness": [...],
    // --- canvas state (for visual round-trip) ---
    "canvas": {
      "supports": {"nodeId": "fixed"|"pinned"|"rollerX"|"rollerY", ...},
      "nodeLoads": [{"nodeId": N, "direction": "x"|"y"|"moment", "magnitude": M}, ...],
      "udl": [{"memberId": M, "wy": W, "wx": WX}, ...],
      "memberOverrides": {"memberId": {"E_GPa": ..., "I_cm4": ..., "A_cm2": ...}, ...}
    }
  }
  ```

### Save / Load UX

- **D-05:** **Save and Load are toolbar buttons** — added to the existing toolbar in both `frame2d/index.html` and `truss2d/index.html`, alongside the current mode buttons. Consistent placement, visible without scrolling.

- **D-06:** **Save** triggers an immediate download of a JSON blob, named `frame2d-model-{ISO timestamp}.json` (or `truss2d-model-...`). Same pattern as existing result export (`createDownloadLink`). No user prompt for filename.

- **D-07:** **Load** uses a `<input type="file" accept=".json">` hidden input triggered by the Load button click. On file select, reads the JSON and restores canvas state and solve payload. Before restoring, if the canvas is non-empty, shows a browser `confirm()` dialog: `"This will replace the current structure. Continue?"`. Load replaces everything on confirm; cancels silently on reject.

- **D-08:** After loading, the canvas is redrawn with restored nodes, members, supports, and load decorators. The structure is **not** auto-solved on load — user must click Solve explicitly.

### Claude's Discretion

- Exact toolbar button label and icon for Save/Load (e.g., "Save", "Load", or icons)
- Whether Save is disabled when canvas is empty
- Error handling for malformed or mismatched JSON files (e.g., loading a frame2d file in the truss2d UI)
- File format for Tekla Excel import (server-side vs standalone Python script) — not discussed; Claude to decide based on what's simpler to implement and test

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API Schema
- `api_server/app.py` — `Frame2DRequest` and `Truss2DRequest` Pydantic models define the exact solve payload fields; the interchange format must be a superset of these
- `solver_core/src/pda_analysis_software/models/frame2d_model.py` — `FrameModel2D` dataclass fields
- `solver_core/src/pda_analysis_software/models/truss2d_model.py` — `TrussModel2D` dataclass fields

### Existing UI Patterns
- `ui/frame2d/script.js` — existing result export pattern (`createDownloadLink`, Blob, `URL.createObjectURL`); `saveHistory()` deep-clone pattern; payload assembly before `/solve/frame2d` POST
- `ui/truss2d/script.js` — same patterns for truss2d
- `ui/frame2d/index.html` — existing toolbar structure for button placement
- `ui/truss2d/index.html` — existing toolbar structure

### Project Architecture
- `CLAUDE.md` — Hard rules: no matplotlib in solver_core, no new dependencies in solver_core, layered pipeline
- `.planning/PROJECT.md` — Phase 3 requirements and success criteria

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createDownloadLink(res)` in both `script.js` files — creates a Blob, `URL.createObjectURL`, appends an anchor to the results panel. The save function can follow this exact pattern with different content and filename.
- `saveHistory()` in both `script.js` files — deep-clones `nodes`, `members`, `supports`, `nodeLoads` (frame2d) or `loads` (truss2d). These objects are exactly what the `canvas` section of the save file needs.
- Payload assembly block in both `script.js` — the object built just before `fetch('/solve/...')` is the solve payload section of the save file.

### Established Patterns
- Toolbar buttons use `data-mode` attribute and `setMode()` toggle; Save/Load are stateless actions (not modes), so they need click handlers rather than `setMode()`.
- File input pattern: hidden `<input type="file">` triggered programmatically via `.click()` is standard vanilla JS.
- `confirm()` dialogs are already used in both UIs (e.g., delete confirmation).

### Integration Points
- Both UIs POST to `http://localhost:8000/solve/{solver}` — on load, the file's solve payload is ready to POST directly.
- Tekla/Revit converters must output a JSON file that matches `schema_version: "1.0"` with the correct `solver` field, so it can be loaded into the browser UI just like a saved file.

</code_context>

<specifics>
## Specific Ideas

No specific references beyond the existing UI patterns described above.

</specifics>

<deferred>
## Deferred Ideas

- **Tekla + Revit scope** — not discussed. User deferred this to Claude's discretion. Downstream agent should research what a Tekla Structural Designer Excel export typically contains and implement a reasonable server-side or CLI converter.
- **External converter deployment** (server-side vs standalone script) — not discussed. Claude to decide.

None from scope creep — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-interchange-format-and-external-inputs*
*Context gathered: 2026-04-18*
