---
title: "frame2d UI: click-to-select member inspector with live-editable properties"
status: pending
priority: P1
source: "promoted from /gsd-note batch 2026-04-22 (points 1b + 2)"
created: 2026-04-22
theme: ui
---

## Goal

User clicks on any member in the frame2d canvas (drawn directly, or imported from the Revit exporter via JSON load), the member highlights as selected, a property panel shows its current values, and the user can edit E, I, A, member type (beam/bar) and pin releases in place. Parity with Tekla Structural Designer / Robot Structural Analysis / SAP2000 member-selection workflow.

## Context

Requested 2026-04-22 as the single most-missed feature relative to commercial tools. Today, member properties are set at creation or via a bulk-edit dialog; post-creation editing requires deleting and re-drawing or hand-editing JSON. That blocks iteration on a model.

Two sub-features delivered as **phases of one todo**, not separate todos — they share the same selection state, hit-detection, and panel:

- **Phase 1 — Inspector (read-only)**: click → highlight → panel shows ID, length, E, I, A, type, pin releases
- **Phase 2 — Editable**: same panel, but E / I / A / type / releases become live-editable inputs

Source note: `.planning/notes/2026-04-22-frame2d-ui-improvements-batch.md` (Points 1b + 2)

## Scope

- Member hit detection already exists (point-to-line, 8 px tolerance per CLAUDE.md) — reuse directly
- Visual selection state (highlight colour + stroke emphasis)
- Works for members drawn directly AND members loaded from JSON — same in-memory model, no special case
- Edit path updates per-member E / I / A (already supported in model since Phase 2), member type (beam ↔ bar), beamPinLeft / beamPinRight
- Length and member ID are read-only — derived from node positions / assigned by model

## Open design questions

- **Panel layout** — pinned sidebar, floating panel over canvas, or modal?
- **Edit commit semantics** — live update on every keystroke, apply-on-blur, or explicit "Apply" button?
- **Multi-select** — out of scope for v1; capture as a future enhancement
- **Undo** — in scope? If yes, single-level or multi-level?
- **Validation** — reject E ≤ 0, I ≤ 0, A ≤ 0 with clear error? Clamp? Warn inline?
- **Member type change warning** — if a beam becomes a bar and that creates a pure-bar joint, warn at edit time (not just at solve time)?

## Dependencies / interactions

- **Point 3 design note** (`.planning/notes/2026-04-22-physical-vs-finite-element-member-model.md`) — the physical-vs-finite-element outcome directly affects what "a member" means when the user clicks. If we introduce physical-member grouping, clicking should select the whole physical member, not the sub-element. **Block this todo from execute-phase until Point 3 is decided.**
- Pure-bar joint todo (`2026-04-22-frame2d-pure-bar-joint-instability.md`) — member-type edit can create pure-bar joints; the UI warning defined there should fire on edit as well as pre-solve.

## Files likely in scope

- `ui/frame2d/script.js` — click handler, selection state, panel wiring, model update
- `ui/frame2d/index.html` — inspector panel markup
- `ui/frame2d/style.css` — selection highlight and panel layout
- Possibly `ui/truss2d/*` — mirror for truss-member editing (E, A, member type n/a)

## Acceptance Criteria

### Phase 1 — Inspector (read-only)

- [ ] Click on a member → visual highlight (selection colour / stroke emphasis)
- [ ] Click on empty canvas → selection clears
- [ ] Inspector panel shows: member ID, length (m, 3 dp), E, I, A, beam/bar type, pin releases
- [ ] Selection persists through pan / zoom / window resize
- [ ] Works for members drawn directly and members loaded from JSON (Revit export path)

### Phase 2 — Editable

- [ ] E, I, A editable number inputs with current value pre-filled
- [ ] Beam / bar toggle
- [ ] beamPinLeft / beamPinRight toggles
- [ ] Edit updates in-memory model; canvas redraws to reflect changes
- [ ] Save JSON captures edited values — round-trip test confirms
- [ ] Input validation: reject E ≤ 0, I ≤ 0, A ≤ 0 with inline error
- [ ] At least single-level undo for the most recent edit
- [ ] Warn when an edit creates a pure-bar joint (conditional on pure-bar fix path)
