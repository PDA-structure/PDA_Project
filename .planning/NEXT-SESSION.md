# Next session — start here

**Saved:** 2026-06-27 (end of phase 999.2 session)

Paste the prompt below to begin. Context: this session shipped the **full load-combination
generator (phase 999.2)** through the GSD pipeline (discuss → UI-spec → research → plan →
execute, 5 waves, all browser-UAT-approved, verified 22/22, code-review clean) and **scoped
the compression handoff (SEED-005 Phase B)** for a future marimo_spike session. Both repos
pushed (pda_project @ 5ccf420, marimo_spike @ c29b321).

Chosen next focus: **improve load combinations** (NOT compression — that's parked for a
marimo_spike session; brief at `marimo_spike/.planning/notes/seed-005-phase-b-compression-handoff-scoping.md`).

---

## Prompt

> **Improve the load combinations feature (truss2d, pda_project phase 999.2 — built & shipped, origin/main @ 5ccf420).**
>
> First read for context:
> - memory: `loadcomb-critical-combination-traceability` (the locked design + differentiator)
> - memory: `project_next_session_priorities`
> - `.planning/phases/999.2-load-combination-generator/999.2-CONTEXT.md` (D-01..D-22, esp. the "Deferred Ideas" section)
> - `.planning/phases/999.2-load-combination-generator/999.2-REVIEW.md` (info items IN-01..IN-04)
>
> **What's already built:** solver_core `loads/` engine (code-pluggable packs, Eurocode UK; STR-ULS 6.10 + SLS-characteristic; superpose forces+displacement; provenance envelope), additive `POST /solve/truss2d/combinations`, truss2d UI (load-case table + natures Self weight/Dead/Imposed/Wind + imposed ψ₀ category, two-page TSD-style generator wizard, results selector per-case/per-combination/ENVELOPE, **per-member governing-combination traceability** + reverse-index canvas halo), export schema 1.2 carrying **factored governing NEd per member**. Quick-solve path + `/solve/truss2d` byte-identical.
>
> **Candidate improvements — TRIAGE these first and pick a batch:**
>
> **A) UI polish** (parked todos in `.planning/todos/pending/`, all from 999.2 UAT):
> - `2026-06-27-truss2d-load-case-colours-brighter.md` — brighter colour-by-nature palette
> - `2026-06-27-truss2d-reassign-load-to-different-case.md` — click a load, change its case on the spot
> - `2026-06-27-truss2d-load-case-panel-resizable-rightward.md` — resize case panel into canvas (frame2d results-tab style)
> - `2026-06-27-truss2d-generate-combination-box-resizable.md` — resizable wizard box (bottom-right)
> - `2026-06-27-truss2d-combination-term-to-case-mapping-by-nature.md` — key terms by `caseId` end-to-end (fixes same-nature limitation; = code-review IN-01)
>
> **B) Feature depth** (deferred stages from CONTEXT, in priority order):
> - **Wind uplift / favourable-permanent** (γ_G,inf=1.0, load reversal) + **EQU** family — the next staged stage; the place a truss genuinely misleads if skipped
> - SLS frequent / quasi-permanent (ψ₁/ψ₂)
> - 6.10a/6.10b equation set
> - **BS 5950 / BS 6399 code pack** (the code-pack seam is built — prove a 2nd pack), then ASCE 7 / NBR
>
> **C) Other:** capture any new ideas from using the feature.
>
> Start by asking me which track(s) to prioritise. Route small UI fixes through `/gsd-quick` (batch the resizable-panel + colour + wizard-box items); route wind-uplift / a new code pack through `/gsd-discuss-phase` (they touch the engine + UI). Honor the hard rules: solver_core no matplotlib/printing; `/solve/truss2d` byte-identical; new tests in separate files.

---

## Also parked (other tracks, not this session's focus)
- **Compression handoff (SEED-005 Phase B)** — marimo_spike work, scoped & ready: `marimo_spike/.planning/notes/seed-005-phase-b-compression-handoff-scoping.md` (manual-first; 4 small tasks; compression EC3 renderer already exists + validated). Start in the marimo_spike repo.
- 4 deferred calc-migration design checks: `beam_bs8110`, `beam_ec2`, `steel/beam`, `steel/column` (build-from-scratch, separate effort).
