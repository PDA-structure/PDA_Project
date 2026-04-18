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
