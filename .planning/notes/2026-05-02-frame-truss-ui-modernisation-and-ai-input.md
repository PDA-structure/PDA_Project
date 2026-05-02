---
date: "2026-05-02"
title: "Frame2D / Truss2D UI modernisation and AI-assisted input methods"
context: "Conversation with user 2026-05-02 after Phase 7 fix verified — user wants engineer-friendly modernisation of the existing JS UIs, prioritising results-display polish, plus exploration of AI vision and iPad drawing as alternative input methods."
related:
  - .planning/notes/2026-04-29-browser-first-3d-vr-strategy.md
  - .planning/todos/pending/2026-04-29-threejs-frame2d-3d-viewer.md
  - .planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md
---

# Frame2D / Truss2D UI modernisation and AI-assisted input methods

## TL;DR

Three improvement tracks were discussed for the existing browser UIs (`ui/frame2d/`, `ui/truss2d/`):

1. **Modern look + UX for results display** — start here. SVG migration, design tokens, hover-to-inspect, animated deformed-shape, dark mode. Days-of-work effort, immediate visible win when talking to engineers.
2. **AI image-to-model import** — engineer drops a photo or screenshot of a hand-sketched / textbook truss-frame; Claude vision returns canonical PDA JSON. ~1-week prototype using `claude-opus-4-7` or `claude-sonnet-4-6` with structured tool-use output. Highest "wow" factor for engineer demos.
3. **iPad / pen drawing input** — touch-hardened web UI with stylus support and grid snapping. Stop short of free-form sketch recognition (research project); free-form sketches go through the AI image path instead.

**Suggested ordering:**

| # | Track | Reason for ordering |
|---|---|---|
| 0 | Fix frame2d load-JSON-then-add-support freeze (existing todo `2026-05-02-...freezes...`) | Any "load-then-edit" UX (including AI import) inherits this bug if not cleared first |
| 1 | Modern results display (SVG + design tokens + hover inspector + animated deformed-shape) | Lowest risk, highest visible payoff per engineer/customer demo |
| 2 | Claude vision image-to-model import | Biggest demo "wow"; depends on (0) being solved because the import flow is "load JSON" under the hood |
| 3 | iPad touch hardening | Iterative; don't tackle sketch-recognition until vision path is proven |

This note captures the discussion. Each track will be promoted to its own todo / phase when triggered.

## Why now

- User has been demoing the UIs to engineers and is collecting first-impression feedback. The vanilla-CSS Canvas look reads as "engineer prototype", which doesn't match the long-term SaaS positioning in PROJECT.md.
- The Phase 7 ConvertToAnalytical bug got resolved today — Revit-side work is paused awaiting Windows/Revit access until next session, which frees Mac-side capacity for browser work.
- The existing `2026-04-29-browser-first-3d-vr-strategy.md` already commits to a browser-first architecture (Three.js, WebXR, Babylon.js as the long-term frontend) — these UI modernisation tracks are short-term confidence-building moves that reuse that grain.
- An iPad drawing flow + AI image import are exactly the kind of "demo to a structural engineer in a meeting" features that move PDA from "another FEM solver" to "a tool engineers want on their iPad", which matters for the eventual SaaS pitch.

## Track 1 — Modern look + UX for results display

### Visual polish (low effort, high payoff)

- **Replace Canvas with SVG** for the results layer. Sharper at any zoom, supports CSS transitions, members become real DOM nodes (hover/click without manual point-to-line distance hit-detection per `CLAUDE.md` §UI conventions). The 8-px tolerance hit test in current `script.js` becomes pointer events on `<line>` elements.
- **Design tokens** — small palette (1 accent for tension, 1 for compression, 1 for supports, 1 for loads), consistent stroke weights, rounded line caps. Default-CSS look is what reads as "old".
- **Typography** — system default → clean sans (Inter, IBM Plex Sans), with tabular figures for force values so columns of numbers align.
- **Dark mode** — CSS-variable-based theme switch. Trivial to add; engineers reviewing models for hours appreciate it.

### Information design upgrades

- **Force diagrams as overlays** — thin tension/compression bars *alongside* members rather than tiny inline text labels.
- **Hover-to-inspect panel** — click/hover a member, side panel shows axial / shear / moment / length / section / E·I in a clean table. Replaces the "scroll through Output Window" UX the runbook currently relies on.
- **Animated deformed-shape slider** — drag a scale slider, structure deforms smoothly via CSS transitions or `requestAnimationFrame`. Currently the deformed shape is a static overlay.
- **Reaction-force arrows drawn proportional to magnitude** — not just labeled. Magnitude is communicated by length, not by reading a number.
- **Colour-coded utilisation on members** (deferred) — green/amber/red by stress utilisation. Requires a code-check engine; v1.5+ territory. Mentioned because the colour scheme should be designed *now* so a future code-check engine can plug in.

### Framework decision

- Keep vanilla JS + SVG if Frame2D / Truss2D stay as single-page tools. This matches the current `ui/<solver>/` pattern in `CLAUDE.md` and incurs zero framework debt.
- **If** the UI ever grows to multiple load cases / side panels with forms / undo-redo / multi-page navigation, **SolidJS or Svelte** are the candidates worth evaluating. Both are closer to vanilla JS than React and won't fight existing CLAUDE.md conventions. **Do not** introduce React unless and until the UI grows past one canvas + one toolbar.

## Track 2 — AI image-to-model import (Claude vision)

### Approach

Engineer drops a photo / screenshot / scanned PDF of a hand-sketched or textbook truss/frame; the system returns canonical PDA JSON ready to load in `ui/frame2d/` or `ui/truss2d/`.

**Tech path:**

- Claude API with vision input (`claude-opus-4-7` or `claude-sonnet-4-6` depending on accuracy/cost trade-off — start with Sonnet, escalate to Opus only if accuracy is insufficient).
- Structured output via tool-use: define a tool whose schema *is* the PDA canonical JSON shape (nodes, members, supports, loads, sections). The model fills the schema; we get well-formed JSON without parsing free-form text.
- Prompt-cache the schema + few-shot examples so per-image cost stays low at scale.
- Add `POST /import/from-image` endpoint to `api_server/`. Keep it behind a feature flag — vision import is exploratory until proven on real engineer images.

### Acceptance bar

- "Engineer can refine the result by clicking" — NOT "perfect first pass". Even 70% accuracy on hand sketches is a giant time-saver vs. typing nodes from scratch.
- The refinement flow is the same load-then-edit path that has the freeze bug today (todo `2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md`). Fix that bug first or this feature inherits the same pain.

### Effort estimate

- Backend route + Claude SDK plumbing + tool schema: 2–3 days
- Frontend "drop image here" upload control + preview + JSON preview/edit: 2 days
- Real-image evaluation set + prompt iteration: 2 days
- Total: ~1 week prototype

### Open questions (defer to plan-phase)

- What's the canonical PDA JSON schema's stability story? Vision import is a downstream consumer; schema churn breaks it. Worth a versioned schema with a `schema_version` field if not already present.
- Eval dataset: where do real engineer hand-sketches come from? User can supply some from past projects; supplement with textbook diagrams.
- Cost ceiling: budget per-import is a UX decision (free / paid tier). Worth deciding at plan time.

## Track 3 — iPad / pen drawing input

### What's easy

Touch-harden the existing web UI for iPad/Apple Pencil usage:

- Pinch-zoom + two-finger pan on the canvas/SVG
- Larger tap targets (current support/load buttons are mouse-sized)
- Stylus mode that snaps strokes to a 1 m grid (per CLAUDE.md UI conventions: GRID=20 px, UNIT=1 m)
- Pressure / hover handling for Apple Pencil where possible

The iPad UI is the **same** SPA, served by the same FastAPI backend, hardened for touch. No native iOS app.

### What's hard (defer)

Free-form sketch → geometry interpretation:
- When does a wobbly hand-drawn line become a beam?
- When do two near-touching strokes become the same node?
- When does a triangle of strokes become three members + three nodes vs. a single closed shape?

This is a research problem, not an engineering problem. Don't tackle it in v1.3 or v1.4.

### Pragmatic v1 path

- iPad supports the same tap/drag interactions as the mouse UI: tap to place a node, drag from node to node to place a member, tap a node and select support type from a popup.
- For free-form sketching, route through Track 2: the engineer draws on the iPad's Notes app, takes a screenshot, drops it into the AI vision importer. Same pipeline, no new sketch-recognition code.

### Effort estimate

- Touch event hardening + tap-target sizing: 2 days
- Stylus mode + grid snap: 1 day
- iPad-specific layout (toolbar position, panel collapse): 1 day
- Total: ~half a week, dependent on Track 1 SVG migration being done first (touch events are simpler on SVG than Canvas).

## Cross-references and follow-ups

- **Bug to clear before any of this:** `.planning/todos/pending/2026-05-02-frame2d-ui-freezes-when-adding-supports-after-loading-json.md`
- **Existing 3D-viewer todo (parallel track, gated to v1.4):** `.planning/todos/pending/2026-04-29-threejs-frame2d-3d-viewer.md` — Three.js viewer is the v1.4 entry point; the modernisation work in Track 1 above should be designed to coexist (toggle 2D ↔ 3D modes, share the design-token palette).
- **Parent strategy:** `.planning/notes/2026-04-29-browser-first-3d-vr-strategy.md` — overall browser-first commitment, IFC import (Phase B) and WebXR (Phase D / SEED-002) sit downstream of all three tracks above.
- **Promotion path:** when each track is ready to start, it gets promoted to either a phase plan (`/gsd-add-phase`) or a quick task (`/gsd-quick`). Track 1 (results display modernisation) is the most likely first promotion — sized for a phase, not a quick task.

## Decisions captured (locked unless explicitly revisited)

- **Results display first, input methods second.** Results-display polish is what engineers see in a demo. Input methods only matter if the engineer is willing to use the tool — and that gate is lowered by results polish.
- **No React.** Vanilla JS + SVG; SolidJS / Svelte considered only if state grows past current scope.
- **AI image import goes through Claude vision with structured tool-use output**, not custom OCR + line-detection. Rationale: maintainability + accuracy — prompt iteration scales better than CV pipeline maintenance for a ~team-of-one project.
- **iPad means "the same web UI, hardened"**, not a native iOS app. Native iOS is dev-team-era work.
- **Free-form sketch recognition is out of scope** for v1.x. Engineer-drawn sketches route through the AI image importer; explicit tap-to-place is the interaction model on iPad.
