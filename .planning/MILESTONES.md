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

## v1.2 — 2D Frame Hardening + Revit-as-UI (MVP)

**Shipped:** 2026-04-26
**Phases:** 4–6 (10 plans total)
**Git range:** 2dc028b → 0df5511

### Delivered

The 2D frame solver hardened against multi-member topologies and pure-bar joint failures, plus a one-click pyRevit pushbutton (sibling `CustomRevitExtension` repo) that exports drafting-view detail lines as canonical PDA JSON for round-trip into the frame2d browser UI. Engineers can now draw a 2D structural layout in Revit and have it solving in the browser within a single click + a few support/load placements.

### Key Accomplishments

1. **Multi-member frame test coverage** — 5 new analytical cases (TRUST-13..17) covering portal frame, two-span continuous beam with pin release + UDL, mixed bilateral pin release, spring-supported simple beam, and series cantilever / propped-cantilever
2. **Spring supports end-to-end in frame2d UI** — toolbar button, modal, coil-glyph canvas rendering, type-discriminated JSON save/load (backward compatible with Phase 3 string supports), SI-unit payload — verified by 11-step human UAT
3. **Canonical UAT harness** — 5 human-authored fixtures + pytest harness through `/solve/frame2d` TestClient; surfaced and fixed two D-14 bugs (API solver-alias HTTP 500 + frame2d resetAll middle-mouse-pan state leak)
4. **Revit Tier 1 geometry exporter (sibling repo)** — pyRevit `ExportToPDA` pushbutton with view-type guard, 1mm Chebyshev endpoint merge, T-junction split, mid-span crossing detection, feet→metres conversion, lexicographic node sort. Live UAT: 6 fixtures + frame2d round-trip all PASS
5. **Pure-bar joint robustness** — `frame_v2.assemble_primary_stiffness_matrix` detects pure-bar joints during assembly; `_pure_bar_theta_dofs` union into existing extraction pipeline auto-restrains the orphan θ DOF; mixed beam+bar models (e.g. Pratt trusses with continuous beam chords) now solve cleanly
6. **Typed `SolverDiagnosticError` + structured 422 payload** — adapter rejects UDL-on-bar with `cause="udl_on_bar"` BEFORE solver runs; API exception handler returns `{detail, cause, offending_nodes, offending_members}` with backward-compat flat fallback (D-13)
7. **frame2d UI diagnostics overhaul** — pre-solve scan with red-dot pure-bar markers, blocking banner for UDL-on-bar, structured-422 parsing replaces generic "Structure is unstable" with cause-suffixed status + canvas highlights of offending nodes/members
8. **Snapshot regression infrastructure (D-16 user constraint)** — 56 baseline JSONs + pytest plugin enforces byte-identical solver output across all pre-existing tests; baseline captured BEFORE the solver edit (commit `93629a4` < `4356c70`) so git ordering proves no regression

### Bonus Scope

- Quick task 260423-a0q — pyRevit `ExportToPDA_Truss` pushbutton (sibling repo) for truss2d round-trip; built and HUMAN-UAT-passed but outside the formal v1.2 requirements list

### Deferred to v1.3+

- Revit Tier 2 — Analytical Exporter Hardening (REVIT-T2-01..07) — rescoped 2026-04-26 after audit reroute. Drafting-view exporter covers MVP; analytical-model extraction reconsidered for v1.3 with full Revit 2023/24/25 API risk picture
- Phase 6 tooling tech debt: WR-01..04 (snapshot script absolute path, UI client-side predicate parity, mkdir-at-import, unused param)

### Stats

- Phases: 3 (4, 5, 6) | Plans: 10 (3+4+3) | Tasks: 25 | Quick tasks: 1
- Tests: 61 passing (v1.1: 37 → v1.2: 61; +5 multi-member, +5 UAT, +5 spring, +8 pure-bar/UDL-on-bar, +3 UI-contract, +others)
- Snapshot regression baseline: 56 JSONs covering all pytest cases
- Timeline: 2026-04-19 → 2026-04-26 (7 days)
- Files changed: 150 | LOC delta: +20,261 / −154

### Archive

- [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) — full phase details
- [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) — 13 satisfied requirements + bonus scope + deferred items
- [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md) — audit verifying 13/13 requirements satisfied

---
