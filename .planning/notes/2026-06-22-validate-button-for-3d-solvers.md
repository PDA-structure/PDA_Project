---
date: "2026-06-22"
promoted: false
---

# Carry the pre-solve validation pattern into the 3D frame / 3D truss UIs

## Trigger

Surface this when building the **3D truss** and **3D frame** solvers and their UIs
(future roadmap — user's stated priority is 3D before grillage). Not actionable now;
the 3D solvers do not exist yet.

## Idea

When the 3D solver UIs are built, add an explicit **"Validate" button** (separate from
Solve) that runs the client-side model checks *before* dispatching a heavy solve, so the
user can sanity-check a large/heavy frame without paying for a full FEM round-trip that
may fail anyway.

This carries forward the 2D pattern landed in quick task **260622-rcm**
(`validateBeforeSolve()` in `ui/frame2d/script.js` + `ui/truss2d/script.js`):

- **Loose / rogue node scan** — node with zero incident members → BLOCK (the exact cause
  of the opaque API "structure is unstable / under-restrained" error). Give an actionable,
  node-numbered message + on-canvas red highlight instead.
- **Coincident / too-close node scan** — node pairs within tolerance (2D used 50 mm) → WARN.
- **3D-specific additions worth considering:** unrestrained / under-restrained DOF detection
  (3D has 3 or 6 DOF/node), rigid-body-mechanism detection, and out-of-plane stability checks
  — the failure modes a 2D scan can't see.

## Why a button (not just auto-on-Solve) for 3D

In 2D the auto-validation on Solve is enough — solves are fast (hundreds of DOF). In **3D**
the DOF count and solve cost climb sharply, so discovering a modelling error only *after* a
heavy solve is expensive. An explicit pre-solve Validate step is where this earns its keep.

## Origin

User idea raised 2026-06-22 right after the 2D rogue-node scan (260622-rcm) was confirmed
working. User asked to capture it as a note for the 3D work rather than build anything now.

Related: `.planning/notes/2026-04-22-frame2d-pure-bar-joint-instability.md`,
quick task `260622-rcm` SUMMARY, memory `feedback_check_stray_offcanvas_node_first`.
