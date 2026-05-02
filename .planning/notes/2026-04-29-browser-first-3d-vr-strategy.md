---
date: "2026-04-29"
title: "Strategic direction — browser-first 3D & VR for PDA, defer Unreal"
context: "5-year planning conversation (gsd-explore) about combining PDA structural analysis with three construction-tech ideas"
---

# Browser-first 3D & VR strategy for PDA

## TL;DR

PDA evolves into a **browser-based structural analysis + 3D visualisation + VR walkthrough** platform using Python (FastAPI, already in place) on the backend and Three.js / Babylon.js + WebXR on the frontend. **Unreal Engine, Blueprint, and C++ are deferred until the dev-team era** — they are not on the prototype path.

The three construction-tech ideas living in `~/Documents/pda_project2/` (VR Clash Detection, VR Quantity Take-off, 4D Construction Simulation) are treated as **extensions of PDA**, not separate products. The Quantity Take-off idea (Idea 2) is the most natural first extension and is captured separately as a seed; the other two (Clash Detection, 4D Simulation) remain in pda_project2 for now and will be revisited when PDA's 3D + IFC foundations are in place.

## Why this direction

The conversation surfaced several constraints that pointed strongly at browser-first:

- **User profile:** structural engineer learning Python, no Unreal / Blueprint / C++ experience, on Mac. Heavy native tooling is a cliff.
- **Mac vs Windows reality:** the entire BIM-to-VR pipeline (Revit, Navisworks, Datasmith, Meta XR Plugin, Quest Link) is Windows-first. WebXR side-steps all of it.
- **Goal is a showcaseable prototype**, not a production product. Time-to-first-impressive-demo matters more than long-term performance ceiling.
- **Eventual hire of a real dev team** — prototype's job is to communicate the vision and de-risk it, not to be the final stack.
- **Existing PDA assets are already browser-based** (FastAPI + HTML/JS UIs for Truss2D and Frame2D). Adding 3D fits the grain of what already works.

## Architectural picture

```
                       BROWSER (Three.js / Babylon.js + WebXR)
                              ▲
                              │ HTTP / JSON
                              ▼
                       FastAPI  (api_server/)
                              ▲
                              │
                              ▼
                       solver_core (truss2d, frame_v2)
                              +
                       IFC parsing layer (web-ifc or Python-side)
```

Single tech stack: **Python on the server, JavaScript/Three.js in the browser**. No Unreal, no Blueprint, no C++ until a dev team picks up the work and decides whether to keep the web stack or rebuild parts in a native engine for higher visual fidelity.

## Phased roadmap (informal — not yet REQUIREMENTS or ROADMAP entries)

- **Phase A — PDA 3D upgrade.** Add a Three.js viewer to the existing Frame2D UI. Render solver results (geometry, deformed shape, axial-force colouring, reaction arrows) in 3D. ~weeks. Captured as todo `2026-04-29-threejs-frame2d-3d-viewer.md`.
- **Phase B — IFC import.** Add `web-ifc` (browser-side) or IfcOpenShell (Python-side) to load real Revit/IFC models. Map IFC structural elements onto solver_core models. ~1–2 months.
- **Phase C — Construction extension (Quantity Take-off).** *Deferred.* Belongs to `pda_project2/Idea 2`, but reuses the IFC + 3D infrastructure built in Phase B. Captured as `SEED-003`.
- **Phase D — WebXR Quest 3 walkthrough.** VR view of analysed structures via the Quest 3 browser using WebXR — no Unreal needed. Captured as `SEED-002`.

## What this implicitly decides about "combine"

PDA + the three construction ideas become **one platform with shared infrastructure**:

- **Shared backend:** FastAPI + Python (solver_core, IFC parsing, future AI integration for Idea 3's programme parsing)
- **Shared frontend stack:** Three.js / Babylon.js + WebXR
- **Shared data spine:** structural model + IFC model + (eventually) construction programme data
- **PDA is the centre of gravity** because it has the unique structural-engineering depth that competitors can't easily replicate. The construction ideas plug into it.

## What is *not* decided here

- Whether Babylon.js or Three.js is the better choice (defer; both are viable; Three.js has the larger ecosystem and `web-ifc` works with it directly).
- Whether IFC parsing happens browser-side (`web-ifc`) or server-side (`IfcOpenShell` in Python). Probably both eventually — server-side for heavy queries, browser-side for visualisation.
- The shape of the eventual SaaS / commercial offering.
- Whether Idea 1 (Clash Detection) and Idea 3 (4D Simulation) ever come back to PDA or stay independent in `pda_project2`.

## Related artifacts

- `.planning/seeds/SEED-002-webxr-quest3-walkthrough.md` — Phase D (VR via Quest 3 browser)
- `.planning/seeds/SEED-003-construction-extension-via-quantity-takeoff.md` — Phase C (QTO as first construction extension)
- `.planning/todos/pending/2026-04-29-threejs-frame2d-3d-viewer.md` — Phase A (concrete first action)
- `~/Documents/pda_project2/` — where the three construction-tech ideas continue to live as standalone concepts
