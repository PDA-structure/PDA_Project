# Project Research Summary

**Project:** PDA Analysis Software — Structural Engineering FEM Solver SaaS
**Domain:** Python/numpy FEM solver core, FastAPI backend, vanilla JS browser UI
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

The PDA Analysis Software is a structural engineering finite-element-method solver platform with a working v1 baseline (2D truss + 2D frame solvers, FastAPI API, browser canvas UIs, 10 passing tests). The research question is not "how to build" but "what to build next and in what order." The established layered architecture — Model → Adapter → Solver → AnalysisResult — is sound and should be followed without deviation. The next milestone is not new capability; it is trust and polish: expand analytical test coverage, handle singular matrices gracefully, and add BMD/SFD diagram output. These three changes transform the tool from "developer prototype" into something a structural engineer can actually rely on.

The recommended approach for extending capability is: fix production blockers first (singular matrix HTTP 500, `print()` violation in truss2d.py), expand the test suite to 20+ cases with analytical reference verification, then add the 3D truss solver as a clean addition following the existing add-a-solver checklist. The 3D truss requires no new dependencies — pure numpy with direction cosine coordinate transformation — and validates the architecture's extension pattern before tackling the significantly more complex grillage solver. Per-member E/I/A properties are a prerequisite for grillage and should be treated as a discrete milestone with intentional API versioning strategy.

The key risks are: (1) the singular matrix 500 error is a production blocker that takes one hour to fix and should be done before any new solver work; (2) the 3D coordinate transformation has a known degeneration case (vertical members) that must be handled with an explicit reference-vector fallback and a mandatory vertical member test; (3) the grillage solver is significantly higher complexity than 3D truss and should only be started after the 3D truss validates the 3D extension pattern. Do not attempt grillage before per-member properties are in place — the uniform-section assumption makes grillage useless for real bridge decks.

---

## Key Findings

### Recommended Stack

The core stack is fixed and correct: Python 3.10.11, numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2. No changes or upgrades are needed for the 3D truss or grillage milestones. The one missing test dependency is `httpx` (required by FastAPI's TestClient for API-level integration tests) — add this to dev dependencies now. `scipy` should not be added to solver_core; `np.linalg.solve` on dense systems is correct at structural engineering scale (hundreds of DOF). If scipy is ever needed, it should be imported inside an adapter, never inside a solver.

**Core technologies:**
- Python 3.10.11: runtime — already installed, required by pyproject.toml
- numpy 2.2.6: all FEM computation — sole solver_core dependency; dense linalg is correct at this scale
- FastAPI 0.135.0: HTTP API — already installed, current version
- Pydantic 2.12.5: request validation — v2 installed, required for FastAPI 0.100+
- uvicorn 0.41.0: ASGI server — already installed
- pytest 9.0.2: test runner — analytical verification pattern established
- httpx >=0.27: FastAPI TestClient backend — add to dev dependencies now (missing)

**What NOT to use:** scipy in solver_core (hard rule), matplotlib in solver_core (hard rule), numpy.matrix (deprecated), np.linalg.inv to solve systems (numerically inferior), frame_v1_legacy.py as a template.

### Expected Features

The research identifies a clear separation between "trust" features (low effort, high credibility impact) and "capability" features (higher effort, extends what can be solved). The biggest gap between current state and production credibility is not a missing solver — it is insufficient test coverage and missing visual output.

**Must have (table stakes):**
- Analytical test coverage expansion (UDL, portal frame, bar member, pin releases, propped cantilever) — engineers will not use an unverified solver; this is the cheapest credibility improvement available
- Singular matrix error handling — unstable structures currently return HTTP 500; must return a structured 422 with a clear user message
- BMD/SFD diagram in frame2d UI — raw displacement numbers are insufficient; Ftool's widespread university adoption is largely due to this single feature
- Member stress output (stress = F/A appended to AnalysisResult meta) — engineers always need stress, not just force
- 3D truss solver — listed as planned in PROJECT.MD; clean numpy extension following existing add-a-solver checklist

**Should have (competitive):**
- Section property calculator — standalone utility providing I and A from section geometry; enormous UX value, no FEM involvement
- Export results to JSON/CSV — engineers write reports; results must leave the browser
- Per-member E/I/A properties — required for any real structure beyond textbook examples; breaking API change needing versioning strategy

**Defer (v2+):**
- Load combinations — requires named load cases and persistence first
- Grillage solver — requires per-member properties (including torsional stiffness GJ); defer until 3D truss validates the 3D extension pattern
- Influence lines — high analytical value; defer until UI can handle parametric load display
- Named load cases / saved models — requires persistence layer (meaningful architectural addition)
- Blender integration — long-term SaaS differentiator; defer until API is stable and versioned
- Non-linear geometry (P-delta) — significant FEM scope increase; defer until linear elastic solvers are fully validated
- 3D frame solver (6 DOF/node) — an order of magnitude more complex than 3D truss; 3D truss is the correct stepping stone

### Architecture Approach

The existing layered architecture is correct and should not be changed. The registry pattern (`engine.register(name, factory)`) means new solvers can be added with zero changes to existing code. Each new solver follows a deterministic checklist: solver file → model dataclass → adapter → API endpoint → tests. The critical rule is that each solver gets its own Model dataclass — do not share between solver types even when DOF counts happen to match (3D truss and 2D frame both have 3 DOF/node but with different physical meaning). FEM geometry (direction cosines, member lengths) belongs in the solver, not the adapter. Grillage will require new model fields (J, G) and must be added to a new GrillageModel2D, never retrofitted into FrameModel2D.

**Major components:**
1. Model dataclass — declarative structure description, no logic; separate per solver type
2. Adapter — translates Model to solver args, calls solver, wraps output in AnalysisResult
3. Solver — pure FEM computation, numpy only, no I/O, no side-effects, stateless
4. AnalysisEngine — registry and single dispatch point; `register(name, factory)` + `solve(name, model)`
5. AnalysisResult — typed output container; `meta` dict absorbs solver-specific extras without schema changes
6. API endpoints — validate Pydantic models, dispatch to engine, return JSON; never call solvers directly
7. Visualization — leaf node; imports from solver_core, never imported by it

### Critical Pitfalls

1. **Singular matrix → HTTP 500** — wrap `np.linalg.solve` in try/except `LinAlgError` in the adapter; return structured 422 with `"structure is unstable or under-restrained"`. One-hour fix; production blocker.

2. **3D coordinate transformation degeneration (vertical members)** — when member direction is parallel to the reference vector, cross-product yields NaN direction cosines that propagate silently. Detect with dot product check and fall back to an alternate reference vector (e.g., global Z if Y is reference). Mandatory vertical member test case before merging.

3. **DOF indexing drift between solver types** — 3D truss and 2D frame both have 3 DOF/node but Ux/Uy/Uz vs Ux/Uy/θ. Keep TrussModel3D as a completely separate dataclass; name DOFs explicitly in test assertions; never share test fixtures.

4. **Stiffness assembly off-by-one** — node `i` (0-indexed) → DOFs `[3*i, 3*i+1, 3*i+2]` (0-based array indices). Add `assert np.allclose(K, K.T)` symmetry check and global equilibrium check in every test immediately after assembly.

5. **Per-member E/I/A as a breaking API change** — existing clients send scalar E/I/A; changing to lists breaks them silently. Use Pydantic union type (`Union[float, List[float]]`) with backward-compatible scalar broadcast, or version the endpoint. Plan the API versioning strategy before implementing.

6. **Existing print() violation in truss2d.py** — `summarize_results()` uses `print()` inside solver_core, violating the hard project rule. Remove it before building the 3D solver to avoid normalizing the pattern.

---

## Implications for Roadmap

Based on research, the work naturally groups into four phases ordered by dependency and risk.

### Phase 1: Trust and Production Hardening

**Rationale:** Three issues are production blockers that take hours to fix and have outsized impact on credibility: the singular matrix 500 error, the print() violation, and insufficient test coverage. These must be resolved before any new solver work. An engineer testing the tool and hitting a 500 on an under-restrained structure will not return.

**Delivers:** A tool structural engineers can trust and a development baseline without known violations.

**Addresses:**
- Singular matrix error handling → structured 422 response
- Remove `summarize_results()` / print() from truss2d.py
- Analytical test expansion: UDL simply-supported beam, portal frame equilibrium, bar member in mixed frame, pin releases, propped cantilever (target: 20+ tests)
- BMD/SFD diagram rendering in frame2d UI canvas
- Member stress output (stress = F/A in AnalysisResult meta)

**Avoids:** Pitfalls 4, 5, and 7 (print violation, test coverage, singular matrix 500)

### Phase 2: 3D Truss Solver

**Rationale:** 3D truss is the next planned capability, follows the add-a-solver checklist exactly, and requires no new dependencies. It validates the architecture's extension pattern before tackling grillage. The Phase 1 test suite expansion establishes the analytical verification discipline that the 3D truss tests must follow.

**Delivers:** A working `/solve/truss3d` endpoint with browser-testable results, 5+ analytical tests covering vertical members and 3D equilibrium.

**Uses:** Pure numpy (direction cosine transformation); follows existing add-a-solver checklist from CLAUDE.md.

**Implements:** truss3d.py solver, TrussModel3D dataclass, Truss3DAdapter, `/solve/truss3d` endpoint, test_truss3d.py.

**Avoids:** Pitfalls 1 (coordinate degeneration — mandatory vertical member test), 2 (DOF indexing drift — separate dataclass), 3 (assembly off-by-one — symmetry assert).

### Phase 3: Model Evolution and UX Polish

**Rationale:** Per-member E/I/A is required by grillage and makes the tool useful for real (non-textbook) structures. This phase must be planned carefully around API versioning — it is a breaking change. Section property calculator and export are lower-risk additions that complete the "professional tool" story established in Phase 1.

**Delivers:** Non-uniform structure support, result export capability, section property utility, explicit API versioning strategy.

**Addresses:**
- Per-member E/I/A properties (breaking change — API versioning required)
- Section property calculator (standalone utility)
- Export results to JSON/CSV
- Reaction force display and node/DOF numbering in UI

**Avoids:** Pitfall 8 (per-member breaking change — union type or /v2/ versioning planned here, not discovered mid-implementation).

### Phase 4: Grillage Solver

**Rationale:** Grillage requires per-member properties (Phase 3) and torsional stiffness (new GJ field in a new GrillageModel2D). It is a competitive differentiator — few accessible web tools offer grillage analysis. Only start after Phase 3 validates the per-member model architecture.

**Delivers:** Grillage solver for bridge decks and floor systems, `/solve/grillage` endpoint, UI (or API-only initial release).

**Implements:** grillage solver with GJ torsional stiffness, GrillageModel2D, GrillageAdapter, new endpoint.

**Avoids:** Pitfall 6 (UDL without transformation for inclined members — grillage members may be non-orthogonal).

### Phase Ordering Rationale

- Phase 1 before Phase 2: production blockers and test credibility must be resolved before adding new solver complexity. Building 3D truss on top of a test suite with 10 cases and a known print() violation would compound technical debt.
- Phase 2 before Phase 4: 3D truss validates the 3D extension pattern (direction cosines, 3D assembly) with low complexity. Grillage is the same extension pattern but with torsional DOF added. The 3D truss is the proof-of-concept that makes grillage lower risk.
- Phase 3 before Phase 4: grillage requires per-member properties. Implementing grillage without this would require non-uniform sections to be shoehorned into a uniform-section model, making the feature useless for real bridge decks.
- Load combinations, influence lines, Blender integration, and P-delta are deferred to v2+ — they each require prerequisites (persistence, stable API versioning, fully validated linear elastic solvers) that are not in place yet.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Model Evolution):** API versioning strategy needs explicit design decision — union types vs versioned endpoints vs deprecation policy. No established pattern in codebase yet.
- **Phase 4 (Grillage):** Torsional stiffness formulation (GJ/L terms, warping in open sections) needs validation against a reference text. The grillage stiffness matrix structure is more complex than a direct extension of the frame solver.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Trust and Hardening):** All tasks are fixes to existing code following patterns already in the codebase. No architectural unknowns.
- **Phase 2 (3D Truss):** Direction cosine transformation is textbook-standard (McGuire, Gallagher & Ziemian). ARCHITECTURE.md includes the complete core math. Degeneration handling is well-documented. No unknowns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack verified against installed packages; httpx requirement from official FastAPI docs; only scipy version is MEDIUM (not installed) |
| Features | MEDIUM-HIGH | Codebase analysis is HIGH; competitor feature comparison (SkyCiv, Ftool, PyNite) is MEDIUM — based on training knowledge, not live product pages |
| Architecture | HIGH | Based on direct codebase analysis; 3D truss math is textbook-standard; patterns explicitly verified against existing solvers |
| Pitfalls | HIGH | Print() violation confirmed in codebase; DOF indexing and transformation degeneration are well-known FEM implementation issues; API breaking change risk is structural |

**Overall confidence:** HIGH

### Gaps to Address

- **Competitor feature currency:** The SkyCiv/Ftool feature comparison is based on training knowledge (as of August 2025). If competitive positioning matters for roadmap prioritization, verify current product pages before the grillage milestone.
- **scipy sparse solver threshold:** MEDIUM confidence on when sparse solving becomes beneficial (~5000 DOF). Not relevant for current milestones; revisit if model sizes grow significantly.
- **Grillage torsion formulation:** GJ/L stiffness terms for open sections (I-beams, channels) involve warping that the simple GJ/L model ignores. Adequate for solid rectangular sections and closed hollow sections. Needs confirmation of scope before grillage solver design.
- **UDL transformation for inclined members:** Current frame solver likely does not apply the local-to-global transformation for ENForces/ENMoments on inclined members. This should be confirmed and tested during Phase 1 test expansion, not deferred to grillage.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `/Users/catrinevans/Documents/pda_project/` — solver code, API, tests, models, adapters reviewed directly (April 2026)
- Installed package versions: numpy 2.2.6, FastAPI 0.135.0, Pydantic 2.12.5, uvicorn 0.41.0, pytest 9.0.2 — verified against environment
- Standard FEM textbook: McGuire, Gallagher & Ziemian — 3D truss stiffness derivation, direction cosine transformation
- CLAUDE.md: add-a-solver checklist, DOF conventions, hard rules (no printing, no matplotlib in solver_core)

### Secondary (MEDIUM confidence)
- FastAPI testing docs: TestClient / httpx requirement
- Structural FEM conventions: DOF numbering, stiffness matrix structure, ENA approach — textbook-standard
- Competitor feature sets: SAP2000, SkyCiv, Ftool, anastruct, PyNite — training knowledge, confidence MEDIUM; verify against current product pages if competitive positioning is a roadmap input

### Tertiary (LOW confidence)
- scipy sparse solver performance threshold (~5000 DOF): not validated in this environment; based on general FEM community practice

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
