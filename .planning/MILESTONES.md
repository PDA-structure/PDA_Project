# Milestones: PDA Analysis Software

---

## v1.0 — 2D Solver Foundation

**Shipped:** 2026-04-18
**Phases:** 1–2 (6 plans total)
**Git range:** Initial commit → 2ef243f

### Delivered

Trusted, production-ready 2D structural analysis platform. Engineers can model 2D trusses and frames in the browser, solve via API, and receive accurate displacements, reactions, member forces, BMD, SFD, and stress results — with graceful error handling and exportable JSON results.

### Key Accomplishments

1. HTTP 422 on unstable/under-restrained structures (was HTTP 500)
2. All `print()` / `summarize_results()` removed from solver_core — hard rule enforced
3. Test suite expanded to 15 tests — 5 new analytical cases (UDL beam, portal frame, bar member, pin release, propped cantilever) with equilibrium assertions on all tests
4. BMD/SFD rendered on frame2d canvas via cubic Hermite interpolation with quartic UDL correction
5. Per-member E/I/A properties in FrameModel2D — backward-compatible scalar broadcast
6. Section property calculator (rectangle, circle, I-section) in frame2d sidebar — live update
7. JSON result export (timestamped download link) in both UIs
8. Horizontal UDL support with direction-cosine decomposition for inclined members

### Stats

- Phases: 2 | Plans: 6 | Quick tasks: 5
- LOC: ~5,300 (Python + JS + HTML + CSS)
- Timeline: 2026-04-05 → 2026-04-18 (13 days)
- Tests: 15 passing

### Archive

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) — full phase details
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) — requirements with final status

---

## v1.1 — Interchange and Grillage (Partial)

**Shipped Partial:** 2026-04-19
**Phases:** 3 (1 phase complete, Phase 4 Grillage deferred)
**Git range:** 2ef243f → 2dc028b

### Delivered

Canonical JSON interchange format across browser UIs, external importers, and the solver API. Engineers can save/load structures in both frame2d and truss2d UIs and round-trip through the solver without re-entering data. External importers built for Tekla Structural Designer (Excel) and Revit 2023+ (PyRevit).

### Key Accomplishments

1. Canonical JSON schema v1.0 — same shape for save, load, and solver API input
2. Frame2D and Truss2D UIs: Save/Load JSON buttons with full canvas state round-trip
3. FastAPI TestClient integration suite with canonical D-04 fixtures (8 tests, analytical checks)
4. Tekla Structural Designer Excel → canonical JSON CLI converter
5. Revit 2023+ PyRevit exporter (feet→metres, analytical model based)
6. Frame_v2 pin-release bug fixes (single-member ENA condensation + multi-member force recovery) — regressions caught via TRUST-09/10/11/12
7. Diagnostic JS error banner added to both UIs (Safari-visible without DevTools)

### Deferred

- **Phase 4: Grillage Solver** — moved to v1.3+ after pivot to 2D frame hardening + Revit-as-UI

### Stats

- Phases shipped: 1 (Phase 3) | Plans: 3 | Quick tasks: 3
- Tests: 37 passing (v1.0: 15 → v1.1: 37; +8 interchange, +9 Tekla converter, +5 pin-release regressions)
- Timeline: 2026-04-18 → 2026-04-19

### Archive

- [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) — phase details including deferred Grillage
- [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) — shipped + deferred requirements

---
