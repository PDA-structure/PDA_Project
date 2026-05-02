---
name: SEED-003 — extend PDA toward construction tech, starting with Quantity Take-off
type: project
trigger_when:
  - browser-based IFC import (Phase B) is working and stable
  - milestone targets non-structural users (QSs, contractors, BIM coordinators)
  - user signals desire to test the broader 'construction-tech platform' vision with a non-structural audience
planted_during: 5-year strategic exploration (gsd-explore) on 2026-04-29
planted_at: 2026-04-29
---

# SEED-003: Construction-tech extension — Quantity Take-off as the bridge

## The Idea

When PDA's browser-based 3D viewer and IFC import are solid, the next natural extension into the construction-tech space is a **VR/3D Quantity Take-off** module — *not* clash detection, *not* 4D simulation. QTO is chosen first because:

- **It's the most data-driven of the three construction ideas** — pure IFC properties + UI for selecting elements + export to Excel/CSV. No new geometric algorithms required.
- **It reuses the IFC import infrastructure** built in Phase B for PDA — minimal new platform work.
- **It's visually demonstrable in minutes** — click an element, see properties, add to a list, export. Easy to showcase.
- **Different audience** (QSs, contractors) — proves the platform serves more than structural engineers and broadens the commercial story.

## Where it lives

The original idea spec for QTO is at `~/Documents/pda_project2/Idea 2_VR Quantity Take-off Application/IDEA2_VR Quantity Take-off Application.md` and stays there as a **product concept**.

When this seed is promoted, the actual implementation work could live either:

- **In `pda_project`** as a sub-module sharing the IFC + browser-viewer stack (recommended — leverages shared infrastructure)
- **In `pda_project2`** as its own GSD project that imports the relevant pieces of `pda_project` as a library

This is a decision to make at promotion time, not now. The current strategic intent is that **PDA's infrastructure becomes the foundation** for QTO and other construction extensions, even if the product is sold/branded separately.

## What this seed is *not*

- Not a commitment to build VR Quantity Take-off — it's a placeholder for "when we extend toward construction, start here, in this order".
- Not a decision about the other two construction ideas (Clash Detection, 4D Simulation). Those remain in `pda_project2` and are out of scope for the PDA roadmap until further notice.

## Dependencies

- Phase B (IFC import) — strong dependency; QTO is essentially "IFC viewer + element-selection + export", so the IFC layer must work first.
- A Quest 3 / WebXR layer is **optional** for the first version — desktop-browser QTO is valuable on its own. VR is a "nice to have" for the showcase.

## Why not Clash Detection (Idea 1) or 4D Simulation (Idea 3) first?

- **Clash detection** is geometrically harder (intersection algorithms, tolerance handling, multi-discipline coordination) and the showcase wins less per unit of effort.
- **4D simulation** depends on programme parsing (Primavera P6, MS Project), AI/NLP for sequencing, and timeline UX — much larger scope, much later.
- **QTO** is the smallest viable construction extension that proves the platform thesis.
