# Feature Research

**Domain:** Structural engineering FEM solver SaaS — post-v1 milestone planning
**Researched:** 2026-04-05
**Confidence:** MEDIUM-HIGH (domain knowledge from established FEM tool ecosystems; web search unavailable, based on training knowledge of SAP2000, STAAD.Pro, SkyCiv, Ftool, OpenSees, PyNite, anastruct patterns)

---

## Context: What Already Exists (v1 Baseline)

- 2D truss solver (2 DOF/node), 2D frame/beam solver (3 DOF/node)
- Both exposed via FastAPI (`/solve/truss2d`, `/solve/frame2d`)
- Both have browser canvas UIs (vanilla JS)
- 10 passing pytest tests with analytical reference verification
- Strict layered architecture: Model → Adapter → Solver → AnalysisResult

The question is what to add to move from "working prototype" to "professional-grade tool."

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features structural engineers assume exist in any credible solver tool. Missing them signals the tool is a toy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Analytical test coverage for all solver types** | Engineers cannot trust a solver without verification against known solutions; every structural engineering textbook provides these | LOW | Currently 10 tests. Missing: UDL case, portal frame, bar member, pin releases, fixed-fixed beam, propped cantilever. This is the lowest-effort highest-trust feature. |
| **3D truss solver (3 DOF/node)** | Direct extension of 2D truss; structural engineering courses and real projects require 3D analysis. The existing architecture makes this a clean add. | MEDIUM | Follows existing add-a-solver checklist exactly. Pure numpy, coordinate transformation matrix is the key addition. |
| **Member stress output** | Force alone is incomplete; engineers need stress = F/A to check against material limits | LOW | Compute post-solve: `stress = member_forces / A`. Add to AnalysisResult or meta. Requires A per member in the truss model. |
| **Enumerated support types in UI** | Fixed, pinned, roller-X, roller-Y — currently frame UI implements these but truss UI likely needs consistency | LOW | UX parity between solvers is expected. |
| **Results display: bending moment diagram (BMD) and shear force diagram (SFD)** | The frame solver computes member_shears and member_moments; displaying a diagram is the minimum expected output format | MEDIUM | Currently only raw numbers returned. A canvas-drawn envelope is table stakes for frame tools. |
| **Error feedback on singular matrix (mechanism/unstable structure)** | Singular K matrix → numpy raises LinAlgError; the API currently returns a 500. Engineers expect a clear message: "structure is unstable, check supports." | LOW | Wrap np.linalg.solve in try/except, return structured error response. |
| **Reaction force display in UI** | Engineers verify equilibrium by checking reactions sum to applied loads. Currently FG is returned but UI display is unclear from code. | LOW | Sum of FG values should visibly confirm equilibrium in UI. |
| **Consistent DOF and node numbering display in UI** | Engineers need to know which DOF is constrained in their model. Currently grid coordinates are shown; DOF numbers are not. | LOW | Display node index and DOF numbers on canvas near each node. |
| **Export results (JSON or CSV)** | Engineers need to take results into reports or spreadsheets | LOW | Simple download of the AnalysisResult JSON. Already structured for this. |

### Differentiators (Competitive Advantage)

Features that distinguish this tool from ad-hoc scripts and textbook implementations. These align with the SaaS goal.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Grillage solver (2D plate/beam grid)** | Grillage analysis is common for bridge decks and floor systems; few accessible web tools offer this. Extends the frame solver to a grid of beams with torsional stiffness. | HIGH | Requires torsional DOF (GJ/L terms), different stiffness matrix structure. Major new solver. |
| **Influence lines** | For moving load problems (bridges, cranes), influence lines are essential. Shows how a response (reaction, moment, deflection) varies as a unit load traverses the structure. | HIGH | Solve repeatedly with load at each node position. Can be automated over the existing solvers without new solver code. |
| **Section property calculator** | Engineers input section geometry (rectangle, I-beam, hollow) and get E, I, A. Removes manual calculation and unit error risk. | LOW-MEDIUM | Standalone utility. Formulas are textbook. No FEM involved. Enormous UX value. |
| **Per-member E, I, A properties (non-uniform structures)** | Currently E and I are uniform across the structure. Real structures mix materials and sections. | MEDIUM | Solver refactor: store E[e], I[e], A[e] arrays instead of scalars. Breaks existing API contract — needs versioning. |
| **Load combinations** | Engineers run multiple load cases (dead, live, wind) and combine them with factors. Superposition is valid for linear elastic. | MEDIUM | Run solver N times with N load vectors; superpose results. API-level feature, not solver-level. |
| **Blender integration (long-term SaaS goal)** | Expose solver via API consumable from Blender Python; visualization in 3D viewport. Noted in PROJECT.md as long-term. | HIGH | Requires Blender addon development. The clean API makes this feasible; the work is on the Blender side. |
| **Named load cases and saved models** | Engineers iterate on designs; saving and reloading model state removes re-entry friction | MEDIUM | Requires persistence layer (SQLite or file store). Currently stateless. |
| **Non-linear geometry flag (P-delta)** | For slender columns and tall frames, geometric non-linearity matters. Professional tools offer a P-delta option. | HIGH | Requires iterative solver loop, geometric stiffness matrix. Significant FEM extension. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-meshing from CAD geometry** | Seems like a natural next step from drawing in the browser | Structural FEM is fundamentally node/member based, not continuous-mesh based. Auto-meshing leads to poorly-conditioned models that engineers don't understand. Frame/truss engineers work with discrete members, not meshes. | Keep node-and-member input model. Add snapping and grid alignment tools for UX instead. |
| **Real-time solve (solve on every input change)** | Feels responsive and modern | Solver is fast for small models, but for any non-trivial structure, solving on every keypress creates solver-spam and race conditions in the API. Engineers need deliberate solve actions. | Keep explicit solve button. Add a "quick check" mode for small models only. |
| **Material database (steel grades, concrete mixes)** | Saves looking up E values | Adds maintenance burden; material properties vary by standard (Eurocode, AISC, AS4100). A full material database becomes a compliance liability. | Provide reference tooltips or a section calculator with sensible defaults (E=200 GPa for steel). |
| **GUI property editor replacing canvas** | Form-based input seems more precise | The canvas drawing UI is the product's core differentiator vs API-only tools. Replacing it with forms removes the spatial intuition that makes structural tools usable. | Add a secondary properties panel that opens when an element is selected, rather than replacing the canvas. |
| **3D frame solver before 3D truss** | More capable = better | A 3D frame solver (6 DOF/node) is an order of magnitude more complex than a 3D truss (3 DOF/node). The coordinate transformation, local-to-global matrix, and torsion handling all compound. 3D truss is the correct stepping stone. | 3D truss first, then grillage, then 3D frame. |

---

## Feature Dependencies

```
[3D Truss Solver]
    └──requires──> [3D coordinate transformation (numpy)]
    └──enhances──> [3D frame solver] (same transformation logic reused)

[BMD/SFD Diagram Display]
    └──requires──> [frame solver member_shears, member_moments already in AnalysisResult]
    └──requires──> [canvas rendering update in frame2d UI]

[Load Combinations]
    └──requires──> [per-load-case result storage]
    └──enhances──> [named load cases]

[Per-member E/I/A]
    └──conflicts──> [current uniform E/I API contract] (breaking change, needs versioning)
    └──required by──> [grillage solver] (mixed section properties across grid beams)

[Grillage Solver]
    └──requires──> [per-member E/I/A properties]
    └──requires──> [torsional stiffness (GJ)]
    └──enhances by──> [3D truss] (3D coordinate thinking already established)

[Influence Lines]
    └──requires──> [existing 2D frame or 2D truss solver working]
    └──requires──> [load iteration API or UI control]

[Named Load Cases / Saved Models]
    └──requires──> [persistence layer (DB or file store)]
    └──enables──> [load combinations]

[Section Property Calculator]
    └──independent──> (standalone utility, no solver dependency)
    └──enhances──> [per-member E/I/A] (provides the values to fill per-member fields)

[Singular Matrix Error Handling]
    └──independent──> (solver-level error wrapping, no dependencies)
    └──required by──> [production readiness]

[Member Stress Output]
    └──requires──> [member_forces already in AnalysisResult]
    └──requires──> [A per member in model]
```

### Dependency Notes

- **3D truss requires coordinate transformation:** The local-to-global transformation expands from 2D (2-component direction cosines) to 3D (3-component). All other solver logic is identical in structure to 2D truss.
- **Grillage requires per-member properties:** A grillage mixes beams of different spans and sections. A uniform-section assumption makes the feature useless for real bridge decks.
- **Per-member E/I/A conflicts with current API:** The Truss2DRequest and Frame2DRequest Pydantic models use scalar E, I, A. Changing to lists is a breaking API change. Either version the endpoint (`/v2/solve/frame2d`) or handle both scalar and list with a union type.
- **Named load cases requires persistence:** Currently the FastAPI server is fully stateless. Adding persistence (even SQLite) is a meaningful architectural addition.

---

## MVP Definition

Note: v1 (baseline) is already shipped. This section defines what the next milestone should deliver.

### Next Milestone — "v1.1: Trust and Polish" (Deliver Now)

Minimum needed to be credible to structural engineers beyond the developers themselves.

- [ ] **Analytical test coverage expansion** — UDL on simply-supported beam, portal frame equilibrium, bar member in mixed frame, pin releases at member ends. Target: 20+ tests. Reason: solver credibility.
- [ ] **Singular matrix error handling** — Wrap solve with structured error response. Reason: production robustness; currently returns 500 on unstable structures.
- [ ] **BMD/SFD diagram in frame2d UI** — Draw moment and shear envelopes on canvas after solve. Reason: raw numbers are insufficient for visual verification.
- [ ] **Member stress output** — `stress = F/A` appended to AnalysisResult meta. Reason: engineers always want stress, not just force.
- [ ] **3D truss solver** — Listed as active in PROJECT.md. Follows add-a-solver checklist exactly. Reason: extends capability dimension.

### Add After Validation (v1.2)

- [ ] **Section property calculator** — Standalone utility providing I, A from geometry. Trigger: users report friction from manual section lookup.
- [ ] **Export results to JSON/CSV** — Simple download from UI. Trigger: users need results in reports.
- [ ] **Per-member E/I/A properties** — Refactor models for non-uniform structures. Trigger: any real structure beyond textbook examples needs this.

### Future Consideration (v2+)

- [ ] **Load combinations** — Requires named load cases and persistence first. Defer until per-member properties are stable.
- [ ] **Grillage solver** — High complexity; requires per-member properties and torsional stiffness. Defer until 3D truss validates the 3D extension pattern.
- [ ] **Influence lines** — High analytical value, medium implementation complexity. Defer until UI can handle parametric load display.
- [ ] **Blender integration** — Long-term SaaS differentiator. Defer until API is stable and versioned.
- [ ] **Non-linear geometry (P-delta)** — Significant FEM scope increase. Defer until linear elastic solvers are fully validated.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Analytical test expansion | HIGH | LOW | P1 |
| Singular matrix error handling | HIGH | LOW | P1 |
| BMD/SFD diagram in UI | HIGH | MEDIUM | P1 |
| Member stress output | HIGH | LOW | P1 |
| 3D truss solver | MEDIUM | MEDIUM | P1 |
| Section property calculator | MEDIUM | LOW | P2 |
| Export results (JSON/CSV) | MEDIUM | LOW | P2 |
| Per-member E/I/A properties | HIGH | MEDIUM | P2 |
| Load combinations | HIGH | MEDIUM | P3 |
| Grillage solver | HIGH | HIGH | P3 |
| Influence lines | MEDIUM | MEDIUM | P3 |
| Named load cases / saved models | MEDIUM | HIGH | P3 |
| Blender integration | HIGH | HIGH | P3 |
| Non-linear geometry (P-delta) | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for next milestone
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Reference tools assessed: SAP2000 (commercial), SkyCiv (web SaaS), Ftool (educational, free), PyNite (Python OSS), anastruct (Python OSS), OpenSees (research-grade Python/Tcl).

| Feature | SkyCiv (web SaaS) | Ftool (educational) | PyNite/anastruct (OSS) | Our Approach |
|---------|-------------------|---------------------|------------------------|--------------|
| Solver types | 3D frame, 3D truss, plate, dynamic | 2D frame only | 2D/3D frame, plates | Start 2D, add 3D truss next |
| BMD/SFD diagrams | Yes, rendered in browser | Yes, core feature | Library output only | Add to frame2d UI as P1 |
| Per-member properties | Yes, full section library | Yes | Yes | Currently uniform only — needs refactor |
| Load combinations | Yes (with factors) | No | Manual | Defer to v2 |
| Error reporting | Clear modal messages | Minimal | Python exceptions | Currently HTTP 500 — needs structured errors |
| Test coverage | Internal (not exposed) | N/A | Analytical tests in README | Expand pytest suite as trust signal |
| Export | CSV, PDF, Excel | No | Manual | JSON export as first step |
| Section calculator | Full section library | No | No | Lightweight calculator as differentiator |

**Observation:** SkyCiv is the direct web SaaS comparator. Its differentiators are per-member properties and section library. Ftool's core value is the visual BMD/SFD diagram — notably, Ftool's diagram is what made it widely adopted in universities over command-line tools. This strongly supports BMD/SFD display as P1.

---

## What Makes This Production-Ready

Distilled from competitor analysis and domain knowledge:

1. **Solver trust** — Analytical verification tests against textbook solutions. Engineers will not use an unverified solver. More tests = more trust. This is the cheapest production-readiness improvement available.

2. **Graceful failure** — Unstable structures (mechanisms) produce singular stiffness matrices. A production tool returns a clear error, not a stack trace. Currently returns HTTP 500.

3. **Visual output** — Raw displacement numbers mean little to most engineers. A bending moment diagram drawn on the same canvas as the structure is the minimum visual output for a frame tool. Ftool's success is largely attributable to this single feature.

4. **Non-uniform cross-sections** — Any structure beyond a textbook problem uses different sections for columns vs beams. Without per-member properties, the tool cannot solve real engineering problems.

5. **Result export** — Engineers write reports. Results must be exportable out of the browser.

---

## Sources

- Domain knowledge: SAP2000, STAAD.Pro, SkyCiv, Ftool, anastruct, PyNite feature sets (training knowledge, confidence MEDIUM — verify against current product pages if critical)
- Codebase analysis: `/Users/catrinevans/Documents/pda_project/` — solver code, API, tests, models reviewed directly (HIGH confidence)
- PROJECT.md active requirements: 3D truss, grillage listed as planned; test expansion, UX improvements as next tasks (HIGH confidence)
- Structural FEM conventions: DOF numbering, stiffness matrix structure, ENA approach — textbook-standard (HIGH confidence)

---

*Feature research for: PDA Analysis Software — structural engineering FEM solver SaaS*
*Researched: 2026-04-05*
