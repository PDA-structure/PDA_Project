---
title: "frame2d: split Material Properties into Material + Section/Geometric Properties cards"
status: pending
priority: P2
source: "captured during quick task 260529-7hw UAT (self-weight ρ toggle modernisation)"
created: 2026-05-29
theme: ui
---

## Goal

Two related improvements to the frame2d Material Properties card, captured together because they touch the same area but ship best in sequence.

### Part 1 — visual consistency: unit-below-input pattern for E, I, A labels

The Density input was restructured in quick task 260529-7hw to:

```
Density          ← label (11px)
[ 7850 ]         ← input
kg/m³            ← unit annotation (9px, muted)
```

Apply the same pattern to the three labels above it for visual consistency across the whole Material Properties card:

- `E (GPa)` → label "E", input, unit "GPa"
- `I (cm⁴)` → label "I", input, unit "cm⁴"
- `A (cm²)` → label "A", input, unit "cm²"

This is purely cosmetic — no JS, no schema, no behaviour change. Single CSS class (could reuse `.density-gated` shorn of its gating rules, or introduce a new `.field-with-unit` class). Atomic commit.

### Part 2 — structural refactor: split Material from Section/Geometric Properties

Engineering convention separates:

- **Material properties** — intrinsic to the material, independent of cross-section shape: E (Young's modulus), ρ (density), ν (Poisson's ratio), fy (yield), G (shear modulus)
- **Section properties** — depend on the cross-section shape, independent of material: A (area), I (second moment of area), J (torsion constant), section moduli, plastic moduli

Currently the frame2d Material Properties card holds E, I, A, and ρ together. The user surfaced this as structurally incorrect during 260529-7hw UAT: "I and A is more member geometric properties rather than material so we will need to shift at some point and the correct tab or buttons".

Split the existing single card into two:

**Material Properties** (smaller card):
- E (GPa)
- ρ toggle button + Density (kg/m³)

**Section Properties** (new card, sits below Material Properties):
- I (cm⁴)
- A (cm²)

The existing **Per-Member E/I/A** button in the Member Properties card overrides these globals per member — no change to that behaviour, just relabel as "Per-Member overrides" if needed since it now spans two cards' worth of fields.

This also connects to the existing **Section Catalog** dropdown (sections.js, SCI P363 UKB/UKC) — when a catalog section is picked, it currently overrides I and A. After the split, the catalog logically belongs in the Section Properties card.

## Scope

| Part | Files | Lines | Risk |
|---|---|---|---|
| Part 1 (visual) | `ui/frame2d/{index.html, style.css}` | ~15 | Low — pure CSS/HTML |
| Part 2 (structural) | `ui/frame2d/{index.html, script.js, style.css}` | ~30 | Medium — moves `<input id="inputI">` and `<input id="inputA">` between parent cards; need to verify `getElementById` reads keep working (they will — DOM-position-independent), and that the floating-panel state machine doesn't barf on the new card |

Both parts should preserve:
- `id="inputE"`, `id="inputI"`, `id="inputA"`, `id="inputDensity"` — JS reads these by id, not by DOM position
- `id="chkSelfWeight"` — hidden checkbox from 260529-7hw stays
- Per-Member E/I/A override system in script.js
- Section catalog dropdown wiring

Save/Load JSON schema does NOT change — same fields, same shape. Only the UI card boundaries shift.

## Sequencing

Recommend Part 1 first (cheap, low-risk, builds visual confidence). Part 2 after, as a standalone discuss-plan-execute cycle since it touches the floating-panel state machine and the Section Catalog dropdown wiring.

## Related

- Quick task 260529-7hw (self-weight ρ toggle modernisation) — direct parent
- Quick task 260528-vzl (toolbar modernisation across both solver UIs) — established the `.tool-btn--spike` pattern
- Section catalog (sections.js, SCI P363 UKB/UKC) — landed in HiDPI commit f85e2a9
- Per-Member E/I/A button — `data-mode="memberProps"` in frame2d Member Properties card
- Truss2d has only E and A in its Material Properties (truss is axial-only, no I) — for parity, truss2d may want a similar split too, but lower priority since the card is already small
