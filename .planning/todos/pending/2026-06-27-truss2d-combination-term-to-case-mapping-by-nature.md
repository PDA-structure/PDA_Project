---
created: 2026-06-27T00:00:00.000Z
title: Combination term→case mapping is order-based when cases share a nature
area: ui
priority: medium
files:
  - ui/truss2d/script.js
---

## Problem

In the phase 999.2-04 combination generator/table, a combination term maps to a load
case by NATURE order. When two or more load cases share the SAME nature (e.g. two
separate "Imposed" cases), the term→case mapping falls back to order-based resolution,
which can mis-associate a factor with the wrong same-nature case. Setups where every
case has a DISTINCT nature (Dead / Imposed / Wind — the common case and the 999.2 UAT
scenario) are exact and unaffected.

Flagged by the executor during phase 999.2-04 as a known limitation.

## Solution

Make term→case mapping reference an explicit, stable `caseId` rather than nature order,
so multiple cases of the same nature each resolve to the correct case. The combination
data shape already keys terms by `caseId` (`terms:[{caseId, factor}]`) — audit the
generator + superpose/recombine paths to ensure `caseId` is used end-to-end (generation,
preview, table edit, envelope) instead of any nature-ordered lookup. Add a test with two
same-nature cases to lock it.

## Notes

Non-blocking; surfaced at 999.2-04 browser UAT. Relates to
[[loadcomb-critical-combination-traceability]]. Should be fixed before multi-case-per-nature
workflows (e.g. patterned imposed loads, multiple wind directions) are common, and carried
to frame2d/3D.
