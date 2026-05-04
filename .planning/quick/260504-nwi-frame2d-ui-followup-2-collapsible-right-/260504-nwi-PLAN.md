---
phase: 260504-nwi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/index.html
  - ui/frame2d/style.css
autonomous: false
requirements:
  - QUICK-260504-nwi
must_haves:
  truths:
    - "Each headed section in the left-panel toolbar — Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display — has been converted from <section class=\"panel-section\"><h3>...</h3>... to <details class=\"card\" open><summary>...</summary>... so its header is clickable and toggles content visibility"
    - "All converted <details> elements default to OPEN on page load (preserves current behaviour — user collapses what they don't need; nothing is hidden by default)"
    - "Sections collapse / expand independently — multiple sections can be collapsed simultaneously, and collapsing one does NOT auto-collapse another (NOT a strict accordion)"
    - "The default browser disclosure marker (the right-pointing triangle) is hidden via summary { list-style: none; } + summary::-webkit-details-marker { display: none; } + summary::marker { display: none; } in style.css"
    - "A custom chevron is drawn via summary::before (or ::after) using a Unicode character or CSS-drawn shape, tokenised colour (var(--canvas-stroke) or var(--color-fg-muted)), pointing right when closed and rotated 90° down when open via details[open] > summary::before { transform: rotate(90deg); }"
    - "Chevron has a smooth transition: summary::before { transition: transform 0.2s ease; } AND a @media (prefers-reduced-motion: reduce) block disables that transition"
    - "Summary bar is the entire click target — full width of the card, padded, with a subtle hover background shift (cursor: pointer; padding inherits .card padding scale; hover uses an existing j8m token like var(--color-surface-hover) or similar)"
    - "ui/frame2d/script.js is UNCHANGED in this plan — git diff <BASE>..HEAD -- ui/frame2d/script.js shows zero diff at the end of Task 2 (and remains zero through Task 3 since Task 3 is human-verify only)"
    - "Zero behaviour change in: mode-string identifiers, panel positions (left rail), keyboard shortcuts, hit-test math, save/load JSON format, solver/API contracts, draw() / setMode() / drawBMD() / drawSFD() / drawGrid() / event listener block — none of those are touched (script.js diff = 0)"
    - "The two single-button sections at HTML lines ~181 (Reset View) and ~185 (SOLVE) are NOT converted to <details> — they have no <h3> heading to use as a clickable summary, and converting them would either require fabricating a heading (out of scope) or hiding the buttons (defeats the point)"
  artifacts:
    - path: "ui/frame2d/index.html"
      provides: "10 sections converted from <section class=\"panel-section\"> wrapping <h3> + content to <details class=\"card\" open> wrapping <summary> (containing the heading text) + content; the two single-button sections (Reset View, SOLVE) remain as <section class=\"panel-section\">"
      contains: "<details class=\"card\" open>"
    - path: "ui/frame2d/style.css"
      provides: "summary disclosure styling — hides default ::-webkit-details-marker and ::marker, makes summary a full-width clickable bar with hover state, draws a custom chevron via ::before/::after with rotation on details[open], wraps the chevron transform transition in a prefers-reduced-motion guard"
      contains: "details[open]"
  key_links:
    - from: "Each <details class=\"card\" open> in ui/frame2d/index.html"
      to: "<summary> child containing the section heading text (from the original <h3>)"
      via: "Native HTML <details>/<summary> elements — browser handles open/close state without JS"
      pattern: "<details class=\"card\" open>"
    - from: "summary element in ui/frame2d/style.css"
      to: "::-webkit-details-marker / ::marker pseudo-elements"
      via: "display: none; on both pseudos to hide the default disclosure triangle"
      pattern: "summary::-webkit-details-marker"
    - from: "details[open] > summary::before (or ::after) in ui/frame2d/style.css"
      to: "transform: rotate(90deg) for the open-state chevron orientation"
      via: "details[open] selector matching only when the card is expanded"
      pattern: "details\\[open\\]"
    - from: "summary::before transition in ui/frame2d/style.css"
      to: "@media (prefers-reduced-motion: reduce) override that sets transition: none"
      via: "media-query block scoped to summary::before"
      pattern: "@media \\(prefers-reduced-motion: reduce\\)"
---

<objective>
Frame2D UI followup-2: convert each headed section in the left-panel toolbar (Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display — 10 in total) into native HTML `<details class="card" open>` / `<summary>` collapsible cards, so the user can click any section header to collapse/expand it. All sections start expanded; multiple can be collapsed simultaneously (independent toggles, not a strict accordion). Pure HTML + CSS — zero JavaScript changes.

This is **option 6.1** from the 2026-05-04 j8m UAT followup discussion (chosen over option 6.2's horizontal toolbar because it preserves layout grain and is lower risk). It addresses the user's complaint that the left-panel toolbar has too many sections stacked vertically and requires scrolling to reach the lower ones.

Purpose: dramatically shorten the panel when the user only needs a few sections, without removing or renaming anything. Native `<details>`/`<summary>` gives us browser-handled open/close state, accessibility (screen readers announce as button + region), keyboard support (Space/Enter), and zero JS risk.

Output:
- 2 atomic auto commits (HTML conversion; CSS disclosure styling).
- 1 manual UAT checkpoint after the 2 commits land.
- Zero changes to: `ui/frame2d/script.js`, `solver_core/`, `api_server/`, `tests/`, `ui/truss2d/`, save/load JSON format, mode strings, keyboard shortcuts, hit-test math.
- Each commit is independently revertable: if the chevron styling looks wrong, revert Task 2 alone and the page still works (just with browser-default triangles).
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@ui/frame2d/index.html
@ui/frame2d/style.css
@.planning/quick/260504-j8m-frame2d-ui-cosmetic-modernisation-tailsc/260504-j8m-PLAN.md
@.planning/quick/260504-lti-frame2d-ui-followup-1-dark-mode-canvas-c/260504-lti-PLAN.md

<interfaces>
<!-- Concrete code shapes already present. Use these directly — no codebase exploration needed. -->

### Base commit for "script.js unchanged" verification
The base commit before Task 1 lands is HEAD `1869d33` (or whatever HEAD resolves to at execute time). Task 2's verifier compares against this base via the `EXPECTED_BASE` env var (with `1869d33` as a fallback default — see Task 2 verify[3]). The orchestrator MUST capture `git rev-parse HEAD` before spawning the executor and export it as `EXPECTED_BASE` so the verifier diffs against the real pre-task base; if the env var is unset, the verifier falls back to the literal `1869d33`. Record the captured hash in SUMMARY.md.

### File sizes (post-lti, before nwi)
- `ui/frame2d/index.html` — 297 lines
- `ui/frame2d/style.css` — 405 lines (post-lti with `--canvas-*` tokens + `[data-theme="dark"]` overrides + `--canvas-label-size` etc. all in place)
- `ui/frame2d/script.js` — UNCHANGED in this plan, but for reference: ~2200 lines post-lti

### Inventory of <section class="panel-section"> blocks in ui/frame2d/index.html (12 total — left panel)

| Line | Heading text | Convert to <details>? |
|------|--------------|------------------------|
| 24   | Geometry | YES (Task 1) |
| 30   | Supports | YES (Task 1) |
| 59   | Node Loads | YES (Task 1) |
| 66   | Member Loads | YES (Task 1) |
| 71   | Member Properties | YES (Task 1) |
| 79   | Edit | YES (Task 1) |
| 87   | File | YES (Task 1) |
| 98   | Material Properties | YES (Task 1) |
| 111  | Section Calculator | YES (Task 1) |
| 140  | Display | YES (Task 1) |
| 181  | (no heading — single Reset View button) | NO — leave as `<section class="panel-section">` |
| 185  | (no heading — single SOLVE button + #solveStatus) | NO — leave as `<section class="panel-section">` |

10 conversions total. Spec threshold is ≥7. Comfortable headroom.

### Existing structure to convert (representative — Geometry section, lines 24-28)

```html
<section class="panel-section">
  <h3>Geometry</h3>
  <button class="tool-btn" data-mode="node"   onclick="setMode('node')"   title="Click canvas to place a node">➕ Add Node</button>
  <button class="tool-btn" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">🔗 Add Member</button>
</section>
```

### Target structure after Task 1 (Geometry example)

```html
<details class="card" open>
  <summary>Geometry</summary>
  <button class="tool-btn" data-mode="node"   onclick="setMode('node')"   title="Click canvas to place a node">➕ Add Node</button>
  <button class="tool-btn" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">🔗 Add Member</button>
</details>
```

Notes on the conversion:
- The wrapper element changes from `<section class="panel-section">` to `<details class="card" open>`.
- The `<h3>Geometry</h3>` becomes `<summary>Geometry</summary>` — drop the `<h3>` tag entirely (not nested inside `<summary>`). Reason: keeps the diff minimal and avoids any default `<h3>` browser margins/padding interfering with the summary click-target. CSS will style `summary` to look like the old `<h3>` (small, uppercase, muted colour).
- All inner content (buttons, labels, inputs) stays exactly as-is.
- The `class` is `card` (not `panel-section`) — we're aligning with the j8m commit `af00755` "card-based grouping" terminology mentioned in the task brief. CSS in Task 2 will use `.card` selector for the new disclosure styling. The existing `.panel-section` rules in style.css continue to apply ONLY to the two non-converted sections at lines 181 and 185. We do NOT delete `.panel-section` rules.

### Existing CSS rules already in style.css that influence this work

Lines 155-170 (post-j8m):
```css
.panel-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow-sm);
}
.panel-section h3 {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-fg-faint);
  letter-spacing: 0.5px;
  margin-bottom: var(--space-2);
}
```

Task 2 will add a parallel `.card` block that mirrors `.panel-section` (so the new `<details class="card">` cards visually match the surviving `<section class="panel-section">` cards), plus `summary` rules. Implementation choice: mirror the panel-section rules onto `.card` directly (DRY-violating duplication is fine for a 6-line block; alternatively, change selectors to `.panel-section, .card` if the executor prefers). Either works.

### Tokens available for chevron + hover states (already in style.css :root + dark overrides post-lti)

| Token | Light value | Dark value | Suggested use |
|-------|-------------|------------|---------------|
| `--color-fg-faint` | `#888888` | `#8a9099` | chevron stroke colour (matches existing h3 colour — disclosure feels native) |
| `--color-fg-muted` | `#555555` | `#b0b5bd` | alternative chevron colour, slightly stronger |
| `--canvas-stroke` | `#1a2744` (aliases `--color-accent`) | `#cfd6e0` | brand-accent chevron — bolder |
| `--color-surface-hover` | `#e8eaf6` | `#2a313c` | summary hover background |
| `--color-surface-alt` | `#f5f5f5` | `#2c333d` | alternative subtler hover |

Recommendation: chevron colour = `var(--color-fg-faint)` to match the existing summary text colour (subtle, native-feeling). Hover background = `var(--color-surface-hover)`. Executor may pick alternatives if visual judgement differs.

### Chevron implementation choice (Task 2)

Two viable approaches:

**A. Unicode chevron (simpler, recommended):**
```css
summary::before {
  content: '\25B8';                    /* ▸ U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE */
  display: inline-block;
  margin-right: var(--space-2);
  color: var(--color-fg-faint);
  transition: transform 0.2s ease;
  transform-origin: 50% 50%;
}
details[open] > summary::before {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: reduce) {
  summary::before { transition: none; }
}
```

**B. CSS-drawn triangle (full vector control, no font-rendering risk):**
```css
summary::before {
  content: '';
  display: inline-block;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid var(--color-fg-faint);
  margin-right: var(--space-2);
  vertical-align: middle;
  transition: transform 0.2s ease;
  transform-origin: 50% 50%;
}
details[open] > summary::before {
  transform: rotate(90deg);
}
@media (prefers-reduced-motion: reduce) {
  summary::before { transition: none; }
}
```

Either passes the verifier (which only checks for `details[open]`, the marker-hiding rules, and the `prefers-reduced-motion` block). Pick A unless the user has a font that renders ▸ poorly. Inter renders it cleanly.

### CLAUDE.md hard rules that apply here
- visualization/ leaf invariant: not relevant — browser-side HTML/CSS work.
- No mode-string change, no API change, no save/load format change: ENFORCED — task touches only HTML markup + CSS, never script.js.
- The "frame solver / FrameModel2D / 1-based DOF" rules are not relevant — frontend-only.

### CLAUDE.md hard rules that do NOT apply here
- Solver, adapter, API, test conventions are all out of scope.

### Safety contract (from j8m + lti, must continue to hold)

This plan ONLY touches:
- `ui/frame2d/index.html` (Task 1: 10 `<section class="panel-section"><h3>...</h3>...</section>` blocks → `<details class="card" open><summary>...</summary>...</details>`)
- `ui/frame2d/style.css` (Task 2: summary marker hiding, chevron, transitions, hover, optional `.card` mirror of `.panel-section` rules)

Forbidden in this plan:
- ANY change to `ui/frame2d/script.js`
- ANY change to `ui/truss2d/*`
- ANY change to `solver_core/*`, `api_server/*`, `tests/*`
- ANY change to mode-string identifiers (`'node'`, `'member'`, `'fixed'`, etc.)
- ANY change to save/load JSON format
- ANY change to hit-test math, `setMode()` behaviour, `draw()` ordering
- ANY change to keyboard shortcuts
- The `<button>` and `<input>` elements inside each converted section MUST be byte-for-byte identical to the pre-conversion contents — only the wrapper element (`<section class="panel-section">` → `<details class="card" open>`) and the heading element (`<h3>X</h3>` → `<summary>X</summary>`) change.

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Commit 1): Convert headed panel sections to <details class="card" open> / <summary></name>
  <files>ui/frame2d/index.html</files>
  <action>
**Goal:** convert exactly 10 `<section class="panel-section">` blocks in the left panel (those with an `<h3>` heading child) into native HTML5 `<details class="card" open>` / `<summary>` disclosures. The 2 sections without `<h3>` headings (Reset View at line ~181, SOLVE at line ~185) are LEFT UNCHANGED. After this commit, the page works — clicking any section header collapses/expands the section — but the disclosure marker is the browser default (a right-pointing triangle prepended to the summary text). Task 2 fixes the cosmetics.

**Step 1 — Identify the 10 sections to convert.**

In `ui/frame2d/index.html`, find each `<section class="panel-section">` that contains an `<h3>` as its first child element. Per the inventory in `<interfaces>`, these are at approximate lines:
- 24 (Geometry)
- 30 (Supports)
- 59 (Node Loads)
- 66 (Member Loads)
- 71 (Member Properties)
- 79 (Edit)
- 87 (File)
- 98 (Material Properties)
- 111 (Section Calculator)
- 140 (Display)

The two sections WITHOUT `<h3>` (lines ~181 and ~185 — Reset View and SOLVE single-button sections) MUST NOT be converted in this commit. Leave them as `<section class="panel-section">`.

**Step 2 — Apply the conversion to each of the 10 sections.**

For each, change:
- Opening tag: `<section class="panel-section">` → `<details class="card" open>`
- The `<h3>HeadingText</h3>` line: replace with `<summary>HeadingText</summary>` (drop the `<h3>` element entirely; the heading text is the body of `<summary>`, no `<h3>` nesting)
- Closing tag: `</section>` → `</details>`
- ALL OTHER CONTENT inside the section stays byte-for-byte identical — every `<button>`, `<label>`, `<input>`, `<select>`, `<div>` is copied across unchanged. No id changes. No onclick changes. No `data-mode` changes. No reordering.

**Worked example — Geometry section (currently lines 24-28):**

Before:
```html
<section class="panel-section">
  <h3>Geometry</h3>
  <button class="tool-btn" data-mode="node"   onclick="setMode('node')"   title="Click canvas to place a node">➕ Add Node</button>
  <button class="tool-btn" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">🔗 Add Member</button>
</section>
```

After:
```html
<details class="card" open>
  <summary>Geometry</summary>
  <button class="tool-btn" data-mode="node"   onclick="setMode('node')"   title="Click canvas to place a node">➕ Add Node</button>
  <button class="tool-btn" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">🔗 Add Member</button>
</details>
```

Apply the same shape to all 10 sections. Indentation may be preserved or re-flowed by the editor — the verifier doesn't care about whitespace, only about element counts and `open` attribute presence.

**Step 3 — DO NOT touch script.js, style.css, or any other file.**

This commit is HTML-only. The verifier in this task explicitly checks that `git diff <BASE>..HEAD` shows changes ONLY to `ui/frame2d/index.html`.

**Step 4 — DO NOT add any JavaScript.**

No `<script>` tags. No event listeners. No persistence logic. The browser handles all open/close state via the native `<details>` element.

**Step 5 — DO NOT remove the `open` attribute on any of the 10 converted `<details>` elements.**

The locked decision is: all sections start expanded on page load (preserves current behaviour). Every `<details class="card">` MUST have `open` immediately after `card`.

**Why this works without CSS changes:**

After this commit lands, you can open the page and:
- Click any section heading text → the browser's default disclosure mechanism collapses/expands the section
- The browser draws a small right-pointing triangle to the left of each summary text (browser default — looks unstyled compared to the rest of the j8m polish, but is functional)
- Multiple sections collapse independently (native `<details>` is not a strict accordion)
- All buttons, inputs, and controls inside each section continue to work because they're untouched

Task 2 styles the disclosure to match the j8m / lti aesthetic — but Task 1 is already a useful, shippable improvement.

**Things NOT to change in this commit:**
- The two unheaded sections at lines ~181 and ~185 (Reset View, SOLVE) stay as `<section class="panel-section">`.
- script.js — zero edits.
- style.css — zero edits.
- Any other file in the repo — zero edits.
- The `<aside class="panel">` wrapper that contains all sections — zero edits.

**Commit message (suggested):** `feat(quick-260504-nwi): convert frame2d left-rail headed sections to <details>/<summary>`
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const html = fs.readFileSync('ui/frame2d/index.html','utf8'); const detailsCount = (html.match(/<details class=\"card\" open>/g) || []).length; if (detailsCount < 7) { console.error('FAIL: expected at least 7 <details class=\"card\" open> elements, found '+detailsCount); process.exit(1); } if (detailsCount !== 10) { console.error('WARN: expected 10 <details class=\"card\" open> elements (per inventory), found '+detailsCount+' — check whether all headed sections were converted'); /* not a hard fail; threshold is 7 */ } const summaryCount = (html.match(/<summary[>\\s]/g) || []).length; if (summaryCount < detailsCount) { console.error('FAIL: <summary> count ('+summaryCount+') is less than <details> count ('+detailsCount+')'); process.exit(1); } /* Negative grep: every <details class=\"card\"> must have open */ const detailsWithoutOpen = html.match(/<details class=\"card\"(?! open>)[^>]*>/g) || []; if (detailsWithoutOpen.length > 0) { console.error('FAIL: found '+detailsWithoutOpen.length+' <details class=\"card\"> without open attribute:'); detailsWithoutOpen.forEach(m => console.error('  '+m)); process.exit(1); } /* No <h3> remains inside any converted section (heading text is now in <summary>) — h3 outside <details> is fine */ /* Negative check: ensure no JS was added in this task — there should still be exactly one <script src=\"script.js\"> reference */ const scriptTags = (html.match(/<script\\b[^>]*>/g) || []).length; if (scriptTags !== 1) { console.error('FAIL: expected exactly 1 <script> tag, found '+scriptTags+' — Task 1 must not add JS'); process.exit(1); } console.log('PASS: '+detailsCount+' <details class=\"card\" open> elements, '+summaryCount+' <summary> elements, all <details> have open attribute, single <script> tag');"</automated>
    <automated>CHANGED=$(git diff HEAD~1..HEAD --name-only | sort -u | tr '\n' ' ' | sed 's/ *$//'); if [ "$CHANGED" = "ui/frame2d/index.html" ]; then echo "PASS: only ui/frame2d/index.html changed in this commit"; else echo "FAIL: expected only ui/frame2d/index.html, got: $CHANGED"; git diff HEAD~1..HEAD --name-only; exit 1; fi</automated>
  </verify>
  <done>
- 10 `<details class="card" open>` elements exist in `ui/frame2d/index.html` (one per headed section in the left-rail toolbar).
- Each `<details>` has a corresponding `<summary>` child as its first element, containing the section heading text.
- All `<details class="card">` carry the `open` attribute (no exceptions).
- The two unheaded sections (Reset View, SOLVE) remain as `<section class="panel-section">`.
- `git diff` for this commit shows changes ONLY to `ui/frame2d/index.html`.
- `ui/frame2d/script.js` and `ui/frame2d/style.css` are byte-identical to the parent commit (verified by negative diff).
- No `<script>` tags added; no event listeners introduced.
- Page loads correctly: clicking any section heading collapses/expands the section using browser-default disclosure styling (cosmetics fixed in Task 2).
- Atomic commit landed.
  </done>
</task>

<task type="auto">
  <name>Task 2 (Commit 2): Style summary disclosure — hide default marker, custom chevron, smooth rotation, reduced-motion guard</name>
  <files>ui/frame2d/style.css</files>
  <action>
**Goal:** make the new `<details>` / `<summary>` disclosures look intentional and on-brand. Hide the default browser triangle, draw a custom chevron via `summary::before`, rotate it 90° on `details[open]`, transition the rotation smoothly, and disable the transition under `prefers-reduced-motion: reduce`. Also ensure the `<details class="card">` cards visually match the existing `<section class="panel-section">` cards from j8m/lti.

**Step 1 — Add a `.card` rule that mirrors `.panel-section` (so the converted cards keep the j8m card aesthetic).**

Append to `ui/frame2d/style.css` (in the panel section CSS region near `.panel-section`):

```css
/* ── Collapsible card disclosure (nwi) ─────────────────────── */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow-sm);
}
```

(Alternatively, the executor MAY change the existing `.panel-section { ... }` selector to `.panel-section, .card { ... }` to DRY up the rules. Either works. The verifier only checks for the disclosure-specific rules below.)

**Step 2 — Hide the default disclosure markers.**

Add (still in the same region):

```css
summary {
  list-style: none;       /* Firefox + standards */
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-fg-faint);
  letter-spacing: 0.5px;
  margin: calc(-1 * var(--space-3));   /* extend click-target to full card padding */
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  user-select: none;
  transition: background 0.15s;
}
summary::-webkit-details-marker {
  display: none;          /* Safari / older Chromium */
}
summary::marker {
  display: none;          /* Firefox standards path */
}
summary:hover {
  background: var(--color-surface-hover);
}
details[open] > summary {
  margin-bottom: var(--space-2);
}
```

The negative `margin: calc(-1 * var(--space-3))` + matching `padding: var(--space-3)` trick makes the summary bar bleed to the card's outer edges so the entire bar — full width, full padding — is clickable, matching the locked decision "Summary bar is the entire click target — full width, padded, with hover state". The bottom border-radius is dropped to `0 0` so the summary bar can sit flush against the card body when expanded; the card's outer `border-radius: var(--radius-md)` still rounds the bottom corners of the card itself.

If the negative-margin trick produces visual artefacts in any browser, the executor may instead use a plain `padding-block: var(--space-2)` on summary without the negative margin and accept that the click target stops at the inner edge of the card padding. The hard requirement from the locked decisions is the hover state and pointer cursor — full-bleed click area is a strong preference, not a verifier gate.

**Step 3 — Custom chevron via `summary::before`.**

Recommended: Unicode triangle (option A from `<interfaces>`).

```css
summary::before {
  content: '\25B8';        /* ▸ U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE */
  display: inline-block;
  margin-right: var(--space-2);
  color: var(--color-fg-faint);
  font-size: 10px;
  line-height: 1;
  transition: transform 0.2s ease;
  transform-origin: 50% 50%;
}
details[open] > summary::before {
  transform: rotate(90deg);
}
```

If Unicode rendering proves inconsistent across the user's browsers, swap for the CSS-drawn triangle (option B from `<interfaces>`):

```css
summary::before {
  content: '';
  display: inline-block;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid var(--color-fg-faint);
  margin-right: var(--space-2);
  vertical-align: middle;
  transition: transform 0.2s ease;
  transform-origin: 25% 50%;
}
details[open] > summary::before {
  transform: rotate(90deg);
}
```

Verifier accepts either — it only checks the existence of `details[open]` selector with a `transform: rotate(90deg)` rule and the marker-hiding rules.

**Step 4 — Reduced-motion guard.**

Add at the END of the new disclosure block (or anywhere in the file — order doesn't matter for media queries):

```css
@media (prefers-reduced-motion: reduce) {
  summary::before {
    transition: none;
  }
  summary {
    transition: none;
  }
}
```

This honours the user's OS-level preference if they have requested reduced motion.

**Step 5 — Verify dark-theme inheritance.**

Because the chevron colour and hover background reference existing j8m tokens (`--color-fg-faint` and `--color-surface-hover`), they automatically pick up the dark-theme overrides defined in the `[data-theme="dark"]` block (lines 343-404 post-lti). No new dark-theme rules are required for this work.

If, on visual inspection, the chevron is too dim in dark mode (`--color-fg-faint: #8a9099` may be very subtle), the executor MAY add a one-line dark override:
```css
[data-theme="dark"] summary::before { color: var(--color-fg-muted); }
```
Optional — not required by the verifier.

**Step 6 — DO NOT touch any other file.**

This commit is CSS-only. The verifier in this task checks that `git diff <BASE>..HEAD` shows changes ONLY to `ui/frame2d/style.css` for this commit (BASE = parent of this commit, which is Task 1's commit).

**Things NOT to change in this commit:**
- index.html — zero edits (Task 1 owned that).
- script.js — zero edits (forbidden in this entire plan).
- Any non-disclosure-related CSS rule (don't refactor, don't reflow — only ADD the new rules and optionally generalise `.panel-section` selector to `.panel-section, .card`).
- `--canvas-*` tokens — zero edits.
- `[data-theme="dark"]` block — zero edits (the chevron inherits via tokens).

**Commit message (suggested):** `style(quick-260504-nwi): hide default <details> marker + custom chevron + smooth rotation + reduced-motion guard`
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const css = fs.readFileSync('ui/frame2d/style.css','utf8'); const checks = [['summary::-webkit-details-marker', 'hides Safari/older-Chromium default marker'], ['summary::marker', 'hides Firefox standards-path marker'], ['details[open]', 'has details[open] selector for open-state styling'], ['transform: rotate(90deg)', 'rotates chevron 90deg when open'], ['transition:', 'has at least one transition for smooth animation'], ['@media (prefers-reduced-motion: reduce)', 'guards animation behind reduced-motion media query']]; let fail = 0; checks.forEach(([needle, label]) => { if (!css.includes(needle)) { console.error('FAIL: '+label+' (needle: '+JSON.stringify(needle)+') not found in style.css'); fail++; } }); /* Verify the reduced-motion block contains a transition rule (i.e. it actually disables motion) */ const rmIdx = css.indexOf('@media (prefers-reduced-motion: reduce)'); if (rmIdx >= 0) { const tail = css.slice(rmIdx, rmIdx + 600); if (!/transition\\s*:\\s*none/.test(tail)) { console.error('FAIL: @media (prefers-reduced-motion: reduce) block does not contain a \"transition: none\" rule'); fail++; } } if (fail) process.exit(1); console.log('PASS: marker hidden, details[open] rotation, transition + reduced-motion guard all present');"</automated>
    <automated>CHANGED=$(git diff HEAD~1..HEAD --name-only | sort -u | tr '\n' ' ' | sed 's/ *$//'); if [ "$CHANGED" = "ui/frame2d/style.css" ]; then echo "PASS: only ui/frame2d/style.css changed in this commit"; else echo "FAIL: expected only ui/frame2d/style.css, got: $CHANGED"; git diff HEAD~1..HEAD --name-only; exit 1; fi</automated>
    <automated>BASE="${EXPECTED_BASE:-1869d33}"; if git diff --quiet "$BASE..HEAD" -- ui/frame2d/script.js; then echo "PASS: ui/frame2d/script.js is unchanged from base $BASE"; else echo "FAIL: ui/frame2d/script.js has changed from base $BASE — this plan forbids any script.js change"; git diff --stat "$BASE..HEAD" -- ui/frame2d/script.js; exit 1; fi</automated>
  </verify>
  <done>
- `ui/frame2d/style.css` contains rules that hide the default disclosure marker (`summary::-webkit-details-marker { display: none; }` and `summary::marker { display: none; }`).
- A `summary` rule sets `cursor: pointer`, padding, hover background using j8m/lti tokens (`var(--color-surface-hover)` or equivalent), and `list-style: none`.
- A `summary::before` (or `::after`) pseudo-element draws a custom chevron (Unicode `▸` or CSS-drawn triangle) using a tokenised colour.
- A `details[open] > summary::before` (or `::after`) rule applies `transform: rotate(90deg)` so the chevron points down when the card is open.
- The chevron pseudo-element has a `transition: transform 0.2s ease` (or similar) for smooth rotation.
- A `@media (prefers-reduced-motion: reduce)` block disables the chevron transition (sets `transition: none` on `summary::before` and/or `summary`).
- A `.card` rule (either as a new selector or as `.panel-section, .card` shared rule) gives the converted disclosures the same background/border/radius/shadow/padding/margin as the existing `.panel-section` cards — visually consistent with the j8m baseline.
- `git diff` for this commit shows changes ONLY to `ui/frame2d/style.css`.
- `ui/frame2d/script.js` is byte-identical to the base commit (`1869d33`) — zero diff over the entire plan.
- Atomic commit landed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual UAT in browser (after both commits)</name>
  <files>none — this is a manual browser UAT checkpoint, no files modified by this task</files>
  <action>Run the manual UAT script under <how-to-verify> in a browser. The 2 preceding auto commits made the actual code changes; this task only validates them visually + functionally. No code is written by this task.</action>
  <verify>Manual browser UAT: every step under <how-to-verify> passes (default-expanded sections, click-to-collapse, custom chevron rotation, prefers-reduced-motion guard, hover state, no default browser triangle visible, every toolbar button still works, cantilever solve regression, save/load round-trip, theme toggle, dark-mode polish, script.js byte-equality).</verify>
  <done>User types "approved" — or describes any divergence so an additional commit / revert can be made.</done>
  <what-built>
- 2 atomic commits on `main`, each independently revertable:
  1. (Task 1) HTML conversion: 10 headed `<section class="panel-section">` blocks → `<details class="card" open>` / `<summary>`. Two unheaded sections (Reset View, SOLVE) left as-is.
  2. (Task 2) CSS disclosure styling: hide default marker, custom chevron via `summary::before` (Unicode `▸` or CSS triangle), `details[open] > summary::before { transform: rotate(90deg) }`, smooth 0.2s transition, `@media (prefers-reduced-motion: reduce)` guard, full-width clickable summary with hover background.
- Modified files: `ui/frame2d/index.html` (Task 1), `ui/frame2d/style.css` (Task 2).
- UNTOUCHED: `ui/frame2d/script.js`, `solver_core/`, `api_server/`, `tests/`, `ui/truss2d/`.
- Behavioural changes: every left-rail headed section is now collapsible by clicking its header; chevron rotates smoothly; multiple sections can collapse independently; default state is all-expanded.
  </what-built>
  <how-to-verify>
1. **Start the API server (if not already running):** `uvicorn api_server.app:app --reload` from `pda_project/`.
2. **Open the frame2d UI:** browse to `http://127.0.0.1:8000/ui/frame2d/index.html` (or the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`).
3. **Initial state — all expanded (locked decision #3):**
   - On first load, every section in the left rail is fully visible (Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display).
   - Each section header shows a custom chevron (▸ or triangle) pointing DOWN (rotated 90° from the closed orientation, since the section is open).
   - The Reset View button and the SOLVE button (the two unheaded sections at the bottom) appear as before — no chevron, no collapse behaviour.
4. **Click each section header to collapse — independent toggles (locked decision #4):**
   - Click "Geometry" header → section collapses, chevron rotates back to point right (▸).
   - Click "Supports" header → section collapses independently. Geometry stays collapsed.
   - Click "Geometry" header again → expands. Supports stays collapsed.
   - Confirm: at any time, multiple sections can be collapsed simultaneously (NOT a strict accordion).
5. **Smooth chevron transition (locked decision #6):**
   - Watch carefully when clicking — the chevron rotation animation should be visible (~0.2s).
   - If your OS has "Reduce motion" enabled (macOS: System Settings → Accessibility → Display → Reduce motion; Windows: Settings → Accessibility → Visual effects → Animation effects OFF), the rotation should snap instantly with no animation. Test this by toggling the OS setting and reloading.
6. **Hover state (locked decision #8):**
   - Hover over any summary header → background subtly shifts to a lighter shade.
   - Cursor becomes a pointer.
   - The entire bar (full width of the card, full padding) is clickable — clicking any whitespace on the summary line toggles the section, not just the heading text.
7. **No default browser disclosure triangle visible (locked decision #7):**
   - The browser's native right-pointing triangle (the disclosure marker that appears by default) MUST NOT be visible. Only your custom chevron is present.
   - Inspect a `<summary>` element in DevTools → confirm `summary::-webkit-details-marker` has `display: none` (Safari/Chromium) and `summary::marker` has `display: none` (Firefox).
8. **Functional regression check — every toolbar button still works:**
   - Expand all sections.
   - Click each tool button in turn and confirm the mode label at the top of the canvas updates correctly:
     - Geometry: ➕ Add Node, 🔗 Add Member
     - Supports: ▪ Fixed, 📌 Pin, 🛞 Roller (X and Y), 〰 Spring
     - Node Loads: → Force X, ↓ Force Y, ↺ Moment
     - Member Loads: ▤ UDL
     - Member Properties: ⇌ Beam / Bar, ◎ Pin — Left end, ◎ Pin — Right end, ⊞ Per-Member E/I/A
     - Edit: ✏️ Edit Node, ↩️ Undo, 🗑 Delete, 🔄 Reset All
     - File: 💾 Save JSON, 📂 Load JSON
   - Each click should produce the same mode label and behaviour as before nwi landed — no mode strings have changed (script.js is unchanged).
9. **Functional regression — Display panel inputs:**
   - Toggle "Show supports" → on/off → glyphs disappear/reappear on canvas.
   - Toggle theme via the ☀/☾ button (still inside the now-collapsible Display section) → light/dark flips correctly.
   - Move "Label size ×" slider → canvas labels resize live (lti behaviour preserved).
10. **Build a regression test structure (cantilever):**
    - Place two nodes 5 m apart, connect with a member, fix one end, apply a downward 10 kN load to the free end.
    - Click ▶ SOLVE.
    - Verify: status shows "Solved ✓"; Member Actions M_i ≈ 50 kNm at fixed end, V at fixed end ≈ 10 kN; Reactions Y ≈ 10 kN.
    - Tick "Show bending moment diagram" → BMD polygon appears.
    - Tick "Show diagram values" → numeric labels appear.
    - All j8m + lti behaviour preserved.
11. **Save / Load JSON regression:**
    - Click 💾 Save JSON — file downloads.
    - 🔄 Reset All.
    - Click 📂 Load JSON, pick the saved file → cantilever reappears with all properties intact.
    - ▶ SOLVE → same results as step 10.
12. **Dark theme polish check:**
    - Toggle to dark theme.
    - All converted disclosures: chevron is visible against the dark background, hover state is subtle but visible, summary text is readable.
    - Toggle a few sections collapsed → still looks polished in dark.
    - Toggle back to light → still polished.
13. **Diff sanity (developer check, not user UAT — but worth eyeballing):**
    - From a shell: `git diff 1869d33..HEAD -- ui/frame2d/script.js` — should produce ZERO output.
    - `git log --oneline 1869d33..HEAD -- ui/frame2d/` — should show exactly 2 commits (Task 1 and Task 2).

**If any step diverges, describe what diverged.** Otherwise type "approved".

**Rollback note (if something IS broken):** each of the 2 commits is independently revertable. `git revert <hash>` of just Task 2 reverts the styling and falls back to the browser-default disclosure triangle (Task 1's collapsing behaviour is preserved). `git revert <hash>` of just Task 1 (after reverting Task 2) reverts the HTML conversion and the page returns to non-collapsible sections.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Task 1 node script proves ≥7 (target 10) `<details class="card" open>` elements exist with matching `<summary>` count, every `<details class="card">` carries the `open` attribute, no JS was added.
- Task 1 git-diff check proves only `ui/frame2d/index.html` changed in that commit.
- Task 2 node script proves marker hiding (`summary::-webkit-details-marker { display: none }` + `summary::marker { display: none }`), the `details[open]` selector exists with a `transform: rotate(90deg)` rule, a transition declaration is present, AND a `@media (prefers-reduced-motion: reduce)` block exists with a `transition: none` rule inside it.
- Task 2 git-diff check proves only `ui/frame2d/style.css` changed in that commit.
- Task 2 cross-plan diff check proves `git diff 1869d33..HEAD -- ui/frame2d/script.js` is empty (zero lines) — must_have #7 enforced. If `1869d33` is not the base at execute time, substitute the actual base commit hash recorded at the start of execution.
- Task 3 manual UAT is the load-bearing functional verification: vanilla HTML/CSS / no build step / no automated browser tests in this repo by design.
- pytest 61/61 green is implicit (no Python source touched). Quick sanity: `pytest tests/ -q` should still pass — nothing changed in the solver path.
</verification>

<success_criteria>
- The frame2d UI left-panel toolbar has 10 collapsible cards: Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display.
- Each card defaults to OPEN on page load (preserves current behaviour — locked decision #3).
- Clicking any card's summary bar toggles its content visibility, with a smooth ~0.2s chevron rotation animation (or instant if `prefers-reduced-motion: reduce`).
- Multiple cards can be collapsed simultaneously — independent toggles, not a strict accordion (locked decision #4).
- The browser's default disclosure triangle is hidden; only the custom chevron is visible.
- Hover state on the summary bar provides visual feedback (cursor pointer + subtle background shift) — locked decision #8.
- The two unheaded sections (Reset View, SOLVE) are unchanged — they remain `<section class="panel-section">` (no header to collapse).
- Both light and dark themes look polished — chevron and hover background pick up dark overrides via existing j8m tokens.
- Zero JavaScript added: `ui/frame2d/script.js` is byte-identical to the base commit at the end of the plan (locked decision #1 — "near-zero JS, browser handles state").
- Zero behaviour change in: mode strings, panel position, keyboard shortcuts, save/load JSON format, hit-test math, solver/API contracts, draw() / setMode() / drawBMD() / drawSFD() / drawGrid() / event listeners.
- All 2 auto commits land atomically and are independently revertable.
- Manual UAT (Task 3) confirms full toolbar smoke + cantilever solve regression + save/load round-trip + theme toggle + reduced-motion behaviour.
</success_criteria>

<output>
After completion, create `.planning/quick/260504-nwi-frame2d-ui-followup-2-collapsible-right-/260504-nwi-SUMMARY.md` per the standard template, recording the 2 commit hashes, the chevron implementation chosen (Unicode vs CSS triangle), any deferred items (e.g. localStorage persistence intentionally deferred per locked decision #5), and noting that the script.js byte-equality invariant held throughout.
</output>
</content>
</invoke>