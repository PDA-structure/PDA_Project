# Phase 3: Model Evolution and UX Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-12
**Phase:** 03-model-evolution-and-ux-polish
**Mode:** discuss
**Areas discussed:** API compatibility, Section calculator UX, Export content, Node labels overlay, UI symbol size (todo folded)

## Gray Areas Presented

| Area | Question | Selected |
|------|----------|----------|
| API compatibility | Union type in-place vs. new versioned endpoint vs. new field names | Union type in-place |
| Section calculator UX | Modal from member panel vs. sidebar panel vs. Python utility only | Sidebar panel always visible |
| Export content | Full AnalysisResult fields vs. human-friendly summary vs. both | Full AnalysisResult fields |
| Node labels overlay | Node numbers + DOF numbers vs. node numbers only vs. node+DOF labels+member numbers | Node numbers + DOF numbers |

## Todos Cross-Referenced

| Todo | Score | Decision |
|------|-------|----------|
| UI symbol size scale control for frame2d and truss2d | 0.9 | Folded into Phase 3 scope |

## Prior Context Applied

From STATE.md (already decided before this session):
- frame2d first, truss2d later for per-member properties
- per-member I and A with global fallback defaults; click-member UI like UDL
- API versioning strategy was flagged for explicit decision → resolved as Union type in-place

From Phase 1 CONTEXT.md (deferred ideas carried forward):
- Bending stress output deferred to Phase 3 → kept deferred (out of Phase 3 scope)
- Export of BMD/SFD as image deferred to Phase 3 → kept deferred (out of Phase 3 scope)

## Corrections Made

No corrections — all selected options were first-choice (recommended).

