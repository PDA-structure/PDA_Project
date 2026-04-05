# Phase 1: Trust and Production Hardening - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-05
**Phase:** 01-trust-and-production-hardening
**Mode:** assumptions (--auto)
**Areas analyzed:** Error Handling, Print Violations, Test Suite Expansion, BMD/SFD Canvas Rendering, Member Stress Output

## Assumptions Presented

### Error Handling — Unstable Structures (TRUST-01)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Fix belongs in app.py (catch RuntimeError → 422), not adapters | Confident | frame_v2.py:388-392, truss2d.py:95-98 already raise RuntimeError; app.py has no exception handling |

### Print Violations (TRUST-02)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| All three files in solver_core/ must have print() removed (including frame_v1_legacy.py) | Likely | grep confirms print() in truss2d.py (lines 122-140), frame_v2.py (lines 537-573), frame_v1_legacy.py (lines 684-724); success criterion has no file exclusion |

### Test Suite Expansion (TRUST-03–08)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Add new cases to existing test_frame_v2.py (not a new file) | Likely | Existing test_frame_v2.py has clear two-pattern structure; keeping tests co-located is simpler |
| Simply-supported UDL deflection formula is 5wL⁴/384EI | Confident | Standard Euler-Bernoulli beam theory; fixed-fixed is wL⁴/384EI |

### BMD/SFD Canvas Rendering (TRUST-09, TRUST-10)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Draw on existing canvas with perpendicular offsets; same coordinate system | Confident | script.js drawDeflected() establishes pattern; member_moments/member_shears already in API response |
| Toggle via new checkboxes alongside chkDeflected | Confident | ui/frame2d/index.html has existing checkbox pattern |

### Member Stress Output (TRUST-11)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Add stress to AnalysisResult.meta in adapters; no AnalysisResult schema change | Confident | meta dict already used for n_nodes/n_members; results.py dataclass need not change |

## Corrections Made

No corrections — auto mode, all assumptions Confident/Likely, auto-proceeded to context capture.

## Auto-Resolved

- Print violations (TRUST-02): auto-selected "remove from all three files including frame_v1_legacy.py" — satisfies grep check as written
- Test suite (TRUST-03–08): auto-selected "add to existing test_frame_v2.py" — simpler, co-located
- BMD/SFD (TRUST-09, TRUST-10): auto-selected "single canvas, perpendicular offsets" — consistent with existing pattern

## External Research

None required — all decisions fully determined by codebase analysis.
