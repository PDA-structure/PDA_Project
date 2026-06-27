# Next session — start here

**Saved:** 2026-06-27 (end of SEED-005 Phase A session)

Paste the prompt below to begin. Context: this session shipped the calc migrations
(padstone/strip/load_buildup), truss2d per-member Area A + UX bundle, and the **full
SEED-005 Phase A tension solver→calc handoff** (export → import notebook → EC3 tension
sheets, validated against EN 1993 Ex 7.10). All pushed to both repos.

---

## Prompt

> **Next: scope and build load combinations (roadmap 999.2) for the truss2d → calc pipeline.** This is the locked next step after SEED-005 Phase A (tension handoff), which is done and pushed.
>
> First read memory `project_next_session_priorities` and `~/Documents/handcals/marimo_spike/.planning/notes/seed-005-solver-to-calc-handoff-scoping.md` for full context.
>
> **Goal:** let the user define unfactored characteristic load cases (Dead / Imposed) in truss2d and produce the ULS design force `NEd = 1.35·G + 1.5·Q` (EN 1990 6.10) that feeds the EC3 tension check.
>
> **Key facts already established:**
> - The truss is linear → load combinations are a **superposition layer** (solve each case → combine member forces; no solver-math change).
> - **Prerequisite:** truss2d loads are currently **untyped** (`{nodeId, direction, magnitude}`) — so this needs **load-typing (Dead/Imposed) in the UI + model, and solve-per-case**. That's the real work.
> - The `load_combination` provenance string is **already wired** through the export → calc slice → tension sheet; combinations just need to populate it dynamically (e.g. `"1.35·Gk + 1.5·Qk (EN 1990 6.10)"`) and produce the combined NEd.
> - Compression handoff (Phase B) comes **after** combinations.
>
> **Start with a scoping discussion** (this spans truss2d UI + model + solve + the combination layer + the export contract) before planning — surface where combinations are computed (recommend: at the force/export level, leveraging linearity) and how load cases are entered in the UI. Then route concrete build work through `/gsd-quick` per pda_project's GSD enforcement.

---

## Open from this session (optional, low priority)
- Real browser UAT of `report/import_solver.py` (marimo) — upload a truss2d export, assign grade, save, compile.
- truss2d `260627-gp1` export-JSON inspection — optional (handoff already proven end-to-end).
- 4 deferred calc-migration design checks: `beam_bs8110`, `beam_ec2`, `steel/beam`, `steel/column` (build-from-scratch, separate effort).
