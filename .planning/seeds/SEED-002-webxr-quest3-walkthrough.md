---
name: SEED-002 — WebXR walkthrough of analysed structures via Quest 3 browser
type: project
trigger_when:
  - browser-based 3D viewer (Phase A) is working with solver results
  - IFC import (Phase B) is working so real BIM models can be loaded
  - milestone targets a public-facing showcase / demo / pitch deck
planted_during: 5-year strategic exploration (gsd-explore) on 2026-04-29
planted_at: 2026-04-29
---

# SEED-002: WebXR walkthrough of analysed structures via Quest 3 browser

## The Idea

Once PDA can render 3D solver results in the browser (Phase A) and load IFC models (Phase B), add a **WebXR mode** so a user can put on a Meta Quest 3, open a URL, and walk inside the analysed structure — see deformed shape at scale, look up at beam reactions, stand under a slab and see its deflection contour, etc.

This is the showcase moment that turns PDA from "another structural analysis tool" into something memorable.

## Why WebXR (not Unreal)

WebXR is a browser API that runs VR experiences directly in the Quest 3 (and other headsets') built-in browser. Critically:

- **No Unreal Engine, no Blueprint, no C++** — pure JavaScript on top of the existing Three.js / Babylon.js viewer.
- **No Windows machine required** — Mac development environment is fine.
- **No app store deployment** — user opens a URL, headset launches VR. Dev cycle is "save → refresh".
- **Same codebase as the desktop browser viewer** — minimal extra surface area to maintain.

This is the path that lets the prototype be built without crossing the chasm into native game-engine development.

## Trade-offs to be aware of

- **Visual fidelity** is lower than Unreal. For prototype/showcase this is fine; for premium production it may not be.
- **Performance ceiling** for very large models (>200k IFC elements) is lower in browser-side rendering. Manageable with culling / LOD strategies.
- **Multi-user collaboration** (which Idea 1 cares about) is harder in WebXR than in Unreal — possible via WebRTC + a session server, but more work.

If the dev-team era decides VR fidelity matters more than these constraints, the codebase can be ported to Unreal at that point. The WebXR prototype's job is to prove the concept and the workflow — not to be the final implementation.

## Minimum useful version

A user can:

1. Load a previously analysed Frame2D or Truss2D model (or an imported IFC model) in the browser.
2. Click a "View in VR" button.
3. Put on the Quest 3 and the headset's browser opens the same model in immersive mode.
4. Walk around / through the model at real scale.
5. See colour-coded results (axial force, bending moment, deflection) on members.
6. Read element properties by pointing at a member.

That's it for the seed. Multi-user, voice annotation, clash overlay, etc. are later concerns.

## Connection to construction-tech ideas

This is essentially a less ambitious cousin of `pda_project2/Idea 1 (VR Clash Detection)` — same WebXR foundation could later support clash-overlay between structural and architectural / MEP IFC models. But the **structural walkthrough is the natural first VR feature** for PDA, since structural is the discipline PDA already serves.

## Dependencies

- Phase A (Three.js viewer) — `.planning/todos/pending/2026-04-29-threejs-frame2d-3d-viewer.md`
- Phase B (IFC import) — not yet a todo
- Quest 3 hardware to test on
