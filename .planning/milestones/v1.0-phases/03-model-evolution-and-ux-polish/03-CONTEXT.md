# Phase 3: Model Evolution and UX Polish - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

The frame2d solver accepts non-uniform member properties (per-member E/I/A), engineers have a section property calculator to get I and A from geometry, and solve results can be exported from the browser. Additionally, the frame2d UI gets a toggle-able node/DOF label overlay and symbol size controls.

Requirements in scope: MODEL-01 through MODEL-05, plus folded todo (UI symbol size scale).

Out of scope: truss2d per-member properties (deferred), bending stress output (deferred from Phase 1), 3D truss (Phase 2, deferred by user).
</domain>

<decisions>
## Implementation Decisions

### API Compatibility (MODEL-01, MODEL-02)

- **D-01:** Extend the Pydantic request model in `api_server/app.py` with union types in-place: `E: Union[float, List[float]]`, `I: Union[float, List[float]]`, `A: Union[float, List[float]]`. No new endpoint, no versioning — one endpoint, backward-compatible. Scalar input continues to work; list enables per-member.
- **D-02:** In `FrameV2Adapter`, broadcast scalar to list when the input is a float (e.g. `E_list = [E] * n_members` if `isinstance(E, float)`). The adapter owns this broadcast logic — the solver receives per-member arrays.
- **D-03:** Existing tests must pass without modification after the change (MODEL-02). The union type default for scalar E/I/A must behave identically to the current model.

### Per-Member UI Interaction (MODEL-01)

- **D-04:** Click a member to open its properties panel (same interaction as UDL assignment — "click-member UI like UDL" pattern from STATE.md). The panel shows E, I, A fields for that specific member. Setting a value on a specific member overrides the global default for that member only.
- **D-05:** Unset member properties fall back to the global E/I/A values entered in the main sidebar. The model serialised to JSON uses a float for globally-uniform members and a list only when at least one member has an override.

### Section Property Calculator (MODEL-03)

- **D-06:** A permanent sidebar panel (always visible in the frame2d UI sidebar) with: section type selector (rectangle, circle, I-section), dimension inputs for the selected type, and a "Calculate" button. Result shows I and A below the button.
- **D-07:** Section types and their inputs:
  - Rectangle: width `b` (mm), height `h` (mm) → `I = b·h³/12`, `A = b·h`
  - Circle: diameter `d` (mm) → `I = π·d⁴/64`, `A = π·d²/4`
  - I-section: flange width `b` (mm), total height `H` (mm), flange thickness `tf` (mm), web thickness `tw` (mm) → `I` and `A` from standard I-section formulas
- **D-08:** Units: dimensions entered in mm; output I in cm⁴, output A in cm² (matches the UI unit convention for the solver input fields). Calculator shows computed values — user can then manually enter them into the member's I and A fields.
- **D-09:** The section property formulas are implemented as a standalone pure Python function in `solver_core/src/pda_analysis_software/` (e.g., `utils/section_properties.py`) with no UI or API dependencies. The UI sidebar calls these formulas directly via the API or duplicates them in JS — either approach is fine at this scale.

### Result Export (MODEL-04)

- **D-10:** After a successful solve, a "Download results" link appears in the results panel of both the frame2d UI and the truss2d UI. Clicking it triggers a JSON file download.
- **D-11:** Export content: full AnalysisResult fields as returned by the API — `solver`, `UG`, `FG`, `member_forces`, `member_shears`, `member_moments`, `meta`. Arrays are serialised as lists (matching existing API response format). No extra human-friendly mapping needed.
- **D-12:** File name: `{solver}-results-{timestamp}.json` (e.g., `frame2d-results-20260412-143022.json`).

### Node Labels Overlay (MODEL-05)

- **D-13:** Toggle-able overlay in frame2d UI shows: node index (0-based, matching the `nodes` array) and the three DOF numbers (1-based, e.g. node 0 → DOFs 1, 2, 3; node 1 → DOFs 4, 5, 6). Displayed as a small label next to each node circle: `N0 [1,2,3]`.
- **D-14:** Toggle via a new checkbox in the sidebar alongside the existing deformed shape / BMD / SFD checkboxes. Label: "Node labels".
- **D-15:** Overlay is drawn on the canvas after the main structure render. Does not interfere with node click/drag interaction.

### UI Symbol Size Scale Control (Folded Todo)

- **D-16:** Add a slider or numeric input to the sidebar that scales the visual size of node circles, support triangles, and load arrows on the canvas. Applies to both frame2d and truss2d UIs. Default scale = 1.0 (current sizes). Range: 0.5× to 2.0×.

### Claude's Discretion

- Exact HTML/CSS layout of the section calculator sidebar panel
- Whether the section calculator JS duplicates the Python formulas or calls a new lightweight API endpoint
- Exact canvas rendering approach for the node label overlay (font size, offset from node circle)
- Slider vs. numeric input for symbol size control
- Whether `section_properties.py` lives in `solver_core` utils or is a separate module

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` §Model Evolution and UX Polish — MODEL-01 through MODEL-05 definitions and acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — success criteria (5 observable conditions that must be true)

### Model and adapter code
- `solver_core/src/pda_analysis_software/models/` — FrameModel2D dataclass to extend with Union types
- `solver_core/src/pda_analysis_software/adapters/frame_adapters.py` — FrameV2Adapter, owns per-member broadcast logic
- `solver_core/src/pda_analysis_software/adapters/truss_adapters.py` — Truss2DAdapter (no per-member changes, but export applies to truss2d UI)
- `solver_core/src/pda_analysis_software/results/results.py` — AnalysisResult dataclass (no field changes needed)

### API
- `api_server/app.py` — Pydantic Frame2DRequest model to update with Union types; existing /solve/frame2d endpoint

### UI — frame2d
- `ui/frame2d/script.js` — member click handling, UDL panel pattern, renderResults(), drawDeflected(), checkbox toggle pattern
- `ui/frame2d/index.html` — sidebar structure, existing checkboxes, results panel
- `ui/frame2d/style.css` — existing styling conventions

### UI — truss2d
- `ui/truss2d/script.js` — renderResults() and results panel (for export download link)
- `ui/truss2d/index.html` — results panel structure

### Tests
- `tests/test_frame_v2.py` — existing tests must continue to pass after union type change (MODEL-02 check)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Member click + properties panel pattern in `ui/frame2d/script.js` — existing UDL modal shows the click-member interaction pattern to follow for per-member E/I/A
- `renderResults()` in both UI script.js files — already accesses API response; add download link here
- `AnalysisResult` dataclass fields — already serialised to JSON by FastAPI; export just captures what the API already returns
- Checkbox toggle pattern (`chkDeflected`, `chkBMD`, `chkSFD`) — follow same pattern for "Node labels" toggle

### Established Patterns
- **Union types in Pydantic v2:** `from typing import Union, List`; Pydantic v2 handles `Union[float, List[float]]` cleanly with validator or `model_validator`
- **Adapter broadcast:** `[value] * n_members` to expand scalar → list; n_members derived from `len(model.members)`
- **Canvas draw order:** structure → deformed shape → BMD/SFD → overlays. Node label overlay follows same layering
- **Unit convention:** UI sends E in GPa (×1e9 in adapter), A in cm² (×1e-4), I in cm⁴ (×1e-8). Section calculator output in cm²/cm⁴ aligns with this.

### Integration Points
- `FrameV2Adapter.solve()` — add broadcast logic before passing to solver; solver receives float arrays, not Union types
- `api_server/app.py` Pydantic model — change `E: float` → `E: Union[float, List[float]]`; add field validator to handle broadcast at API boundary if needed
- `ui/frame2d/script.js` `renderResults()` — add "Download results" button/link after results rendered
- `ui/truss2d/script.js` `renderResults()` — same download link addition

</code_context>

<specifics>
## Specific Ideas

- Section calculator sidebar: "like a mini calculator always visible below the member properties" — permanent panel, not a modal. User calculates, then manually copies I/A into member fields.
- Export file naming: `{solver}-results-{timestamp}.json` — makes it clear which solver generated it.
- Node label format: `N0 [1,2,3]` — concise, shows node index and DOF range at a glance.
- Symbol size range: 0.5× to 2.0× — half to double current size, default 1.0.

</specifics>

<deferred>
## Deferred Ideas

- Bending stress output (σ = M·c/I) — carries over from Phase 1 deferred; section calculator now provides c = d/2 for circles, but I-section requires more geometry. Defer to a future phase once section types are validated.
- Per-member properties for truss2d — STATE.md says "truss2d later". Defer to Phase 4 or backlog.
- Export as CSV — useful for spreadsheet import; v2 requirement INT-02. Defer.
- Auto-populate member fields from calculator result — "click Calculate → auto-fills the active member's I and A". Useful UX, but adds coupling. Defer to see if manual copy is acceptable first.

### Reviewed Todos (not folded)
None — the one matching todo (UI symbol size scale control) was folded into scope.

</deferred>

---

*Phase: 03-model-evolution-and-ux-polish*
*Context gathered: 2026-04-12*
