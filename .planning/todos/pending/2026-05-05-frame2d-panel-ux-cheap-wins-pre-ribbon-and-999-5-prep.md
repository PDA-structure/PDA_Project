---
created: 2026-05-05T19:58:26.177Z
title: Frame2D panel UX cheap wins — pre-ribbon and 999.5 prep
area: ui
files:
  - ui/frame2d/index.html
  - ui/frame2d/style.css
  - .planning/phases/999.5-frame2d-ribbon-hierarchy-ui/999.5-CONTEXT.md
related:
  - .planning/todos/pending/2026-05-04-frame2d-toolbar-wrap-improvement.md
---

## Problem

During the 2026-05-05 work-laptop UAT and ribbon-hierarchy CONTEXT capture session, several small UX improvements surfaced for the **current** horizontal-toolbar frame2d UI. Some are pure UX fixes (carry-overs from earlier UAT signals); others are intermediate steps that reduce future Phase 999.5 (ribbon hierarchy) execution work by establishing the structure now.

We don't want to lose these between now and when 999.5 is promoted from BACKLOG to active planning. Capture as a single bundled todo so they can be picked off in 1-2 quick tasks at the next opportunity.

### Items

**Bundle A — Pre-ribbon UX wins (existing horizontal toolbar):**

1. **Display section density** — open follow-up from 260504-nwi UAT close-out (logged in STATE.md last activity 2026-05-04): "Display section crowded — wants items stacked one-per-line with smaller text." Pure CSS, ~5 lines. Targets the `<details class="card">` for Display in `ui/frame2d/index.html` lines 140-179. Reduces font-size on `.checkbox-label` and ensures stacking via `display: flex; flex-direction: column` (or similar).

2. **rs3 toolbar wrap improvement** — already captured separately at `.planning/todos/pending/2026-05-04-frame2d-toolbar-wrap-improvement.md`. Tighter `.card { min-width }` + smaller `summary` text. ~5 lines CSS-only, escalation path is card consolidation if still cramped.

**Bundle B — Ribbon-prep cheap wins (intermediate steps that reduce Phase 999.5 work):**

3. **Promote MATERIAL PROPERTIES + SECTION CALCULATOR styling now** — they will be first-class tabs in the ribbon per Phase 999.5 CONTEXT.md D-02 (decision: promote both as tabs in the spike). Tightening their current panel styling now (margins, label alignment, input spacing in `ui/frame2d/style.css` `.panel-label`, `.sec-inputs`, `#secResults`) means less rework when ribbon ships. Currently they're inline forms inside `<details class="card">` panels; the work is small spacing/typography polish.

4. **Theme toggle relocation prep** — Phase 999.5 D-03 moves theme toggle to top-right of ribbon, outside tabs (Quick Access Toolbar pattern). Small intermediate step: wrap the existing `#themeToggle` button (lines 173-178 of `ui/frame2d/index.html`) in its own dedicated container `<div class="theme-toggle-wrapper">` today. When the ribbon migration happens, the work is "move the wrapper to the ribbon top-right" not "extract the toggle from inside Display." Zero behaviour change today.

5. **Display panel hybrid prep** — Phase 999.5 D-01 splits Display into "frequent toggles inline" + "advanced behind dialog launcher." Group the existing Display children into two visual sub-sections today: section A = checkboxes (chkSupports, chkLoads, chkDeflected, chkBMD, chkSFD, chkDiagLabels, chkNodeLabels), section B = number inputs (deflection scale, BMD/SFD scale, symbol size, label size) + theme toggle. When the ribbon migration happens, "move section B behind a dialog launcher" is a single wrap operation. Zero behaviour change today, only a `<div class="display-frequent">` and `<div class="display-advanced">` wrapper structure.

## Solution

**Suggested execution sequence:**

1. **First quick task — Bundle A** (`/gsd-quick`): items 1 + 2 together. Both pure CSS density tweaks targeting the current toolbar density. Should be ~10-line CSS diff total. Pre-condition: 260505-sq0 close-out approved (this builds on the same `ui/frame2d/style.css` token system).

2. **Second quick task — Bundle B** (`/gsd-quick`): items 3 + 4 + 5 together. All small structural HTML+CSS changes that preserve current behaviour but reorganise the markup so Phase 999.5 ribbon migration is shallow rather than a rewrite. Items 4 and 5 touch the same regions (Display panel + theme toggle currently nested inside it), so bundling reduces cognitive overhead.

**When to execute:** After 260505-sq0 (light-mode contrast pass) closes via Mac UAT tonight. Both bundles are small enough that they can be picked off as filler before/between Phase 7 Revit work resuming. Do NOT promote 999.5 from BACKLOG just to do these — keep 999.5's spike scope narrow per CONTEXT.md D-08; these prep items are intentionally smaller than ribbon migration itself.

**Constraints (carry over from rs3/sq0 patterns):**
- CSS + minimal HTML wrapper changes only — no JS changes
- No design tokens added — reuse existing `:root` palette
- No behaviour changes — every interactive element keeps its current `id`, `onclick`, `data-mode`, etc.
- pytest 61/61 must remain green (project-wide regression gate)
- Dark mode untouched (changes target light-mode tokens or are theme-agnostic structure-only)
- Truss2d explicitly out of scope (no token system; covered by separate larger backlog item per 260505-sq0 SUMMARY.md)

**Reference:** Phase 999.5 CONTEXT.md at `.planning/phases/999.5-frame2d-ribbon-hierarchy-ui/999.5-CONTEXT.md` — see D-01 (DISPLAY hybrid layout), D-02 (promote MATERIAL + SECTION CALCULATOR to tabs), D-03 (theme toggle to top-right outside tabs), D-08 (spike scope: visual + tab-switching only). Source conversation 2026-05-05 — captured before pausing for the day, after CONTEXT capture and 260505-sq0 executor work but before Mac UAT close-out.
