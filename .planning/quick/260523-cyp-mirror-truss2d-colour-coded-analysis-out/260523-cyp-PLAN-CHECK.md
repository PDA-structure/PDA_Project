---
phase: quick-260523-cyp
plan: 01
verdict: PASS_WITH_WARNINGS
verified_by: gsd-plan-checker
verified: 2026-05-23
loops: 1
---

# Plan Check — 260523-cyp Mirror truss2d colour-coded analysis output to frame2d

## Verdict: PASS (with 3 non-blocking warnings)

The plan is **executable as-is**. All 7 locked decisions from CONTEXT.md are mapped to atomic tasks, all 7 UAT iterations from the parent task are folded into baseline (NOT deferred to follow-on), frame2d-specific concerns (Mz reactions, spring DOF mapping, dark-mode halo) are handled, and the scope contract is tight. The 5-task layout mirrors the parent task's natural execution rhythm with a clean foundation-first ordering (tokens → thickness → arrows+reactions → labels → legend+toggle).

The 3 warnings below are quality nits the executor should be aware of but they do NOT require revision before execution. They can be addressed live during UAT iteration.

---

## Dimension 1: Requirement Coverage — PASS

All 7 D-XX decisions from CONTEXT.md map to explicit task action steps:

| Decision | Covered by | Mechanism |
|---|---|---|
| D1 (legend top-right canvas-drawn) | Task 5 | `drawLegend()` with `setTransform(1,0,0,1,0,0)`, 4-row card |
| D2 (thickness 1.5→6 px by |axial|/max) | Task 2 | `maxAbsForce` normalisation + `1.5 + 4.5 * ratio` in drawMembers |
| D3 (reactions Fx/Fy/Mz at restrained DOFs) | Task 3 | `drawReactions()` iterates supports + DOF map per type |
| D4 (orange #ef6c00 / #ffb74d, NOT purple) | Task 1 | 3 new tokens in both `:root` and `[data-theme="dark"]` |
| D5 (drawNodeLoads refactor to apex-at-node) | Task 3 | Body replaced; routes Fx/Fy via drawForceArrow, moment via drawMomentArc(kind='load') |
| D6 (drawMemberLabel centroid-outward + halo + 9 px) | Task 4 | Module-level centroid + body replacement + strokeText halo |
| D7 (chkReactions toggle) | Task 5 | New checkbox + addEventListener + gates legend Reaction row |

PROJECT.md / CLAUDE.md cross-check: no requirements from CLAUDE.md hard rules apply that this plan would silently drop. Plan respects "visualization is always a leaf" (zero solver_core / api_server changes), 3-DOF frame convention (`base = i * 3`, `[Fx, Fy, Mz]`), and existing canvas conventions.

---

## Dimension 2: Task Completeness — PASS

All 5 tasks have files / action / verify / done blocks populated. Each `<verify>` contains an `<automated>` grep-based command appropriate for a visual-UI task (file/structure check, not behavioural — appropriate because this is presentation-layer work with no test harness available). Each `<done>` lists 4–8 measurable acceptance criteria.

Nyquist sampling: 5/5 tasks have `<automated>` checks (100% coverage); not E2E suites, not watch-mode; latency is acceptable (single grep). PASS.

---

## Dimension 3: Dependency Correctness — PASS

Single-plan task; `depends_on: []`. Task ordering is foundation-first:
- Task 1 (tokens) → consumed by Tasks 3 and 5
- Task 2 (thickness) → independent of all others
- Task 3 (drawForceArrow + drawReactions, wires draw()) → consumed by Task 5 (uses `chkR` defensively)
- Task 4 (drawMemberLabel) → independent, can land anywhere
- Task 5 (legend + checkbox) → consumes Tasks 1, 3

The forward-compatible gate `(!chkR || chkR.checked)` in Task 3 explicitly removes the Task 3→5 ordering constraint. No cycles, no future references.

---

## Dimension 4: Key Links Planned — PASS

The `must_haves.key_links` block (lines 102-130) lists 7 explicit wire-ups:
- draw() → drawMembers + drawNodeLoads + drawReactions + drawLegend (with regex `draw\(\)[\s\S]*drawMembers[\s\S]*drawReactions[\s\S]*drawLegend`)
- drawMembers → results.member_forces (via maxAbsForce)
- drawReactions → results.FG + supports[] including spring K* filter
- drawForceArrow shared by drawNodeLoads AND drawReactions
- drawLegend → chkReactions.checked
- drawMemberLabel → structure centroid
- chkReactions checkbox → draw() via addEventListener

All seven wirings have concrete implementing task steps. No artifacts created in isolation.

---

## Dimension 5: Scope Sanity — PASS

5 tasks, 3 files, estimated ~250–400 lines added across script.js / style.css / index.html. Task 3 is the largest (the "big architectural commit" — drawForceArrow + drawMomentArc + drawHaloedLabel + drawNodeLoads refactor + drawReactions + wire) but it's intentionally bundled because splitting would leave an inconsistent visual grammar mid-execution (some arrows apex-at-node, others not). The plan explicitly justifies this bundling at line 387.

Risk acknowledged but accepted: Task 3 is ~150 lines and touches the most behaviour. Recommend the executor commit Task 3 once all its sub-steps pass UAT, not after each sub-step.

5/5 tasks within budget. 3 files within budget.

---

## Dimension 6: Verification Derivation — PASS

`must_haves.truths` (lines 22-74) lists 40+ user-observable truths organised by decision:
- Pre-solve regression guards explicitly listed (lines 66-70) — covers byte-identical pre-solve behaviour requirement
- Scope contract truths (lines 72-74) — git diff confined to 3 files + pytest -q remains 61 passing
- Every truth is observable via the 3 UAT fixtures OR via `git diff` / `grep`

Pre-solve regression coverage: explicitly truthed at lines 66-70 ("Before any solve: no legend, no reaction arrows, no Mz arcs; members render at the existing uniform 2 px thickness…"). PASS.

---

## Dimension 7: Context Compliance — PASS

All 7 locked decisions implemented; no Deferred Ideas (BMD/SFD changes, member-actions table, pin-release styling, load combinations, T/C split, deflection feedback, analysis-folder export) appear in any task. Claude's Discretion areas respected:
- Arc-span 240° vs 270° → planner picked 240° reaction / 270° load (tunable at UAT)
- Legend "Bar member" row → omitted (planner chose force-only)
- Legend "Moment reaction" distinct row → single Reaction row (planner chose unified)
- `--canvas-legend-bg-*` tokens → inline-pick by data-theme (planner chose inline)
- BMD/SFD thickness scaling → NOT applied (planner respected this)

---

## Dimension 7b: Scope Reduction Detection — PASS

Searched all task `<action>` blocks for "v1", "v2", "simplified", "static for now", "hardcoded", "future enhancement", "placeholder", "basic version", "will be wired later", "stub", "not wired", "not connected":
- Task 5 step 5 mentions "redundant" gate but explicitly LEAVES it for defensive robustness — this is a refactor decision, not scope reduction
- No D-XX decision is silently reduced to a fraction of its full intent

No scope reduction detected.

---

## Dimension 8: Nyquist Compliance — N/A (no RESEARCH.md for quick task)

Skipped per the "skip if no RESEARCH.md" rule. Quick-task workflows don't generate a research artefact; the planning context lives in CONTEXT.md which has already been verified above.

---

## Dimension 9: Cross-Plan Data Contracts — PASS

Single plan, no cross-plan contracts. Internal data-shape contract verified:
- `results.FG` shape `(3n × 1)` with `base = nodeId * 3` and `[Fx, Fy, Mz]` ordering — matches solver_core/frame_v2.py
- Spring `Kx/Ky/Ktheta` with `null = free` semantics — verified against script.js line 110 and lines 457-459 (matches actual `parseFloat(raw)` → `null` if empty)
- Canvas Y-flip convention for positive Y world → -y canvas — matches existing drawNodeLoads pattern (script.js line 1170-1171)

---

## Dimension 10: CLAUDE.md Compliance — PASS

CLAUDE.md rules verified against plan:
- "solver_core must have NO matplotlib, NO printing" → plan explicitly excludes solver_core
- "Visualization is always a leaf" → all edits in ui/frame2d/ only
- "DOF numbering: 1-based in public API, solvers convert to 0-based" → plan uses 0-based `base = i * 3` (correct — this is JS reading the solver's array output, which is already 0-indexed at the JS layer)
- "All new solvers registered via engine.register" → N/A, no new solver
- "GSD Workflow Enforcement → use GSD entry points for edits" → in active GSD quick-task flow

---

## Source Code Reference Verification

| Plan claim | Actual location | Status |
|---|---|---|
| `drawMembers()` at line ~844 | line 844 | ✅ exact |
| `drawMemberLabel()` at line ~890 | line 890 | ✅ exact |
| `drawNodeLoads()` at line ~1160 | line 1160 | ✅ exact |
| `drawUDLs()` at line ~1229 | line 1229 | ✅ exact |
| `drawDeflected()` at line ~1345 | line 1345 | ✅ exact |
| `drawBMD()` / `drawSFD()` at ~1426 / 1530 | line 1426 / 1530 | ✅ exact |
| `cssVar()` helper exists | line 79 | ✅ exists |
| `BASE_LABEL_SIZE` constant | line 91 (= 10) | ✅ exists |
| `LABEL_FONT_FAMILY` constant | line 92 | ✅ exists |
| `labelScale` mutable | line 93 | ✅ exists |
| `getSymbolScale()` helper | line 98 | ✅ exists |
| `--canvas-tension` token at ~line 76 | line 76 | ✅ exact |
| `[data-theme="dark"]` block ~line 589 | line 558 | ⚠️ off by ~30 lines (see Warning 1) |
| `--canvas-zero` in dark block | line 607 | ✅ exists; insertion point claim "immediately after `--canvas-zero`" is fine |
| chkLoads / chkSupports / chkDeflected event listeners ~line 1618-1619 | lines 1618-1620 | ✅ exact |
| index.html Display card ~line 140 | line 140 (`<details class="card"><summary>Display</summary>`) | ✅ exact |
| `chkLoads` line 147-149 / `chkDeflected` line 150-152 | actual: chkLoads at 147-149, chkDeflected at 150-152 | ✅ exact |
| `drawMoments()` exists as separate function | **DOES NOT EXIST** | ⚠️ See Warning 2 |
| `drawLoads()` exists | **DOES NOT EXIST** — the function is `drawNodeLoads()` | ⚠️ See Warning 3 |

The plan correctly refers to `drawNodeLoads` (not `drawLoads`) throughout — the CONTEXT.md prompt's use of `drawLoads`/`drawMoments` was loose terminology. The PLAN.md author correctly read the source and references `drawNodeLoads` throughout. See Warnings.

---

## Warnings (3, non-blocking)

### Warning 1: Style.css line reference is off (590 → actual 558)

**Where:** Task 1, step 2 — "Locate the `[data-theme="dark"]` block (around line 589 — the dark-mode canvas-content cluster starts with `--canvas-stroke: #cfd6e0`)."

**Actual:** The `[data-theme="dark"]` block starts at line 558, not 589. The `--canvas-zero: #6f747c` insertion anchor is at line 607 (correct).

**Severity:** info — the executor will find the right place by searching for `[data-theme="dark"]` and `--canvas-zero`, both of which match. No revision needed.

### Warning 2: CONTEXT prompt mentions `drawMoments` as a separate function — it does not exist

**Where:** The verification prompt asks "does `drawMoments()` exist?" — answer: NO, moment-load rendering is the `else if (l.direction === 'moment')` branch INSIDE `drawNodeLoads()` at lines 1188-1212.

**Plan handling:** Task 3 correctly treats this as a branch refactor inside `drawNodeLoads()`, NOT as a separate function refactor. The plan's `drawMomentArc(node, value, color, labelColor, label, kind)` helper subsumes that branch and adds the `kind='reaction'` variant. Implementation is sound.

**Severity:** info — terminology mismatch between CONTEXT.md ("drawMoments") and source (branch of drawNodeLoads). Plan correctly maps to the actual source. No revision needed.

### Warning 3: Apex-at-node moment-LOAD refactor is a behaviour change for existing users

**Where:** Task 3, step 2 — "NOTE: this is a behaviour change for moment-load rendering (arrowhead now anchors via the helper's geometry; existing colours and arc-span 270° preserved via `kind='load'`)."

**Why it matters:** The plan explicitly accepts this as "scope creep" per CONTEXT D-5, but the existing moment-load arc rendering (lines 1188-1212) currently anchors the arc CENTRE at the node, not the arrowhead. After the refactor, the arrowhead lands at the node and the arc extends outward. This will visibly change every saved frame2d model containing a moment load, and the 7 UAT iterations from the parent task didn't exercise a moment LOAD specifically (because truss2d doesn't have moment loads).

**Mitigation:** The plan's Task 3 verify step 6 (line 652) catches this: "Refactor sanity: add a +5 kN load and a downward -5 kN load at the same node and confirm the existing green load arrows still render apex-at-node with the same pull-back; moment loads still render purple with arrowhead at the node." Visual UAT will catch any regression here. CONTEXT.md D-5 line 117 explicitly accepts this.

**Severity:** info — explicitly authorised in CONTEXT.md, explicitly verified in Task 3 UAT step. No revision needed; executor should pay extra attention to moment-load rendering during UAT.

---

## Atomicity / Independent Committability — PASS

Each task produces an independently-buildable, independently-revertable commit:
1. Task 1: 6-line CSS addition; UI unchanged visually (foundation only)
2. Task 2: drawMembers thickness; visible improvement on solve
3. Task 3: drawForceArrow + drawReactions + drawNodeLoads refactor + wire; the "big" commit; visible reactions on solve
4. Task 4: drawMemberLabel centroid-outward + halo + 9 px; visible label improvement
5. Task 5: drawLegend + chkReactions checkbox + wire; visible legend + toggle

The forward-compatible chkReactions gate in Task 3 (`!chkR || chkR.checked`) means Task 3 ships and works without Task 5 already present. No "atomic with another task" smells.

---

## Truth Observability — PASS

Every truth in `must_haves.truths` is observable through one of:
- Visual UAT with the 3 fixtures (cantilever, portal frame, continuous beam)
- `git diff` / `grep` / file inspection (for scope-contract truths)
- `pytest -q` (for regression-guard truth)

Examples:
- "After a solve, orange arrows appear at every restrained translational DOF" → portal-frame UAT
- "Toggling chkSupports OFF leaves reaction arrows / arcs visible" → step 5 in portal-frame UAT (line 651, 956)
- "git diff --stat shows changes confined to exactly three files" → final regression check (line 916)

No unverifiable truths detected.

---

## Pre-Solve Regression Guards — PASS

Explicitly listed at lines 66-70 of the plan:
- "Before any solve: no legend, no reaction arrows, no Mz arcs; members render at the existing uniform 2 px thickness with their default --canvas-stroke / --canvas-bar colours"
- "Before any solve: bar members still render dashed; per-member E/I/A overrides still render the 4 px blue outline; pin-release circles still render"
- "Before any solve: drawNodeLoads still renders green Fx/Fy arrows and purple moment-load arcs (just now via the shared apex-at-node helper)"
- "Before any solve: drawUDLs, drawSupports, drawDeflected, drawBMD, drawSFD, drawDiagnosticOverlays all render byte-equivalent to the pre-change state"

These are the four core regression guards required. PASS.

---

## Scope Contract — PASS

Lines 72-74 explicitly assert:
- "git diff --stat shows changes confined to exactly three files: ui/frame2d/script.js, ui/frame2d/style.css, ui/frame2d/index.html"
- "No edits to ui/truss2d/**, solver_core/**, api_server/**, tests/**"
- "pytest -q remains green (61 passing) before and after — no Python touched"

Final regression check at line 984 reaffirms.

---

## Summary

The plan is structurally sound, locked-decision compliant, scope-bounded, and ready for execution. The 3 warnings are informational and the executor will navigate them correctly during normal execution (style.css line number off-by-30, drawMoments terminology vs source naming, moment-load apex-at-node behaviour change explicitly authorised in CONTEXT D-5).

**Verdict: PASS — proceed to execution (paused until 2026-05-24 per user).**

