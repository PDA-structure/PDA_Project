---
phase: 260505-tke
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/style.css
autonomous: false
requirements:
  - QUICK-260505-tke-A1
  - QUICK-260505-tke-A2
must_haves:
  truths:
    - "The Display card (`<details class=\"card\">` containing the 8 visibility checkboxes + 4 number inputs + theme toggle, lines 140-179 of `ui/frame2d/index.html`) renders its `.checkbox-label` items as a vertical column — one item per line — instead of inheriting the existing global `.checkbox-label { flex-direction: row !important }` row layout"
    - "Items inside the Display card use a smaller font-size (~11px) than the inherited base, keeping the now-stacked column compact vertically"
    - "Items inside the Display card use a tightened vertical gap (e.g. `gap: 4px` or smaller line-height/margin), so the stacked list reads as a compact list rather than a sprawl"
    - "The 4 number inputs / range slider inside the Display card (`#inputScale`, `#inputDiagramScale`, `#inputSymbolScale`, `#inputLabelScale`) and the `#themeToggle` button continue to render correctly within the now-tighter Display card — they are NOT broken by the density tweaks (their existing `.panel-section label` and `.panel-label` rules continue to apply, OR they receive matching tight-density rules if needed)"
    - "The `.card { min-width: 180px }` rule (line 188 of style.css from rs3) is reduced to `min-width: 140px` so cards stay on one row longer at narrower viewports — this is Item 2's wrap improvement"
    - "The `summary` element font-size is reduced from 11px to 10px (line 196 of style.css from nwi) to free horizontal space inside each collapsed card chevron-pill — this is Item 2's complementary tweak"
    - "The 9 OTHER `<details class=\"card\">` blocks (Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator) are NOT affected by the Display-specific density rules — they continue to render with their existing `.checkbox-label` row layout (chkSupports/chkLoads in those panels keep current behaviour)"
    - "The `.checkbox-label` rule that drives the Display stacking is scoped to the Display card specifically (e.g. via `#chkSupports` parent disclosure ID, or via a `.display-card .checkbox-label` qualifier with a hook class added — but per constraints HTML is NOT modified, so the scope must be derivable from the existing DOM without HTML changes; a structural CSS selector like `details.card:has(#chkDeflected) .checkbox-label` or an attribute-precise approach is used)"
    - "The 260505-sq0 baseline is preserved exactly: `--color-grid: #d4d8df` at line 20 stays unchanged; the `#udlPanel`/`#springPanel` token-driven CSS rules (lines 412-496 from commits 195ac08 + e15392f) are NOT modified"
    - "Zero changes to: `ui/frame2d/index.html` (HTML untouched per Bundle A constraint), `ui/frame2d/script.js`, `ui/truss2d/*`, `solver_core/`, `api_server/`, `tests/`, mode strings, save/load JSON format, hit-test math, the `[data-theme=\"dark\"]` override block, all `--canvas-*` tokens, all `--color-*` / `--space-*` / `--radius-*` / `--shadow-*` tokens, the `summary::before` chevron rule and `details[open] > summary::before { transform: rotate(90deg) }` rule (only the `summary` font-size value is touched, not its other properties)"
    - "No new design tokens added — all changes reuse the existing `:root` palette and spacing scale"
    - "Dark mode is theme-agnostic for these changes — sizing/layout tweaks don't reference colour values, so dark mode inherits automatically without new `[data-theme=\"dark\"]` overrides"
  artifacts:
    - path: "ui/frame2d/style.css"
      provides: "Two density tweaks applied to the existing rs3 horizontal-toolbar layout: (1) Display-card-specific override that forces `.checkbox-label` items into a vertical stacked column with smaller font-size and tighter gap; (2) global `.card { min-width: 180px }` reduced to 140px and `summary { font-size: 11px }` reduced to 10px, improving wrap behaviour at narrower viewports"
      contains: "min-width: 140px"
    - path: "ui/frame2d/index.html"
      provides: "UNCHANGED — HTML structure preserved per Bundle A constraint. Verifier MUST detect index.html as byte-identical to EXPECTED_BASE."
      contains: "<details class=\"card\" open>"
    - path: "ui/frame2d/script.js"
      provides: "UNCHANGED — byte-identical from EXPECTED_BASE through the plan."
      contains: "function setMode"
  key_links:
    - from: "Display card `<details class=\"card\">` containing 8 visibility checkboxes + 4 number inputs"
      to: "vertical stacked layout with ~11px font-size"
      via: "Scoped CSS rule using a structural selector (e.g. `details.card:has(#chkDeflected) .checkbox-label`) since HTML cannot be modified — overrides the global `.checkbox-label { flex-direction: row !important }` rule for this card only"
      pattern: "checkbox-label[^}]*flex-direction:\\s*column"
    - from: ".card rule in style.css (line 185-190 from rs3)"
      to: "min-width: 140px (was 180px)"
      via: "Single value change — fewer cards needed per row → cards stay on one row at narrower widths"
      pattern: "min-width:\\s*140px"
    - from: "summary rule in style.css (line 191-207 from nwi)"
      to: "font-size: 10px (was 11px)"
      via: "Single value change — tighter chevron-pill text frees horizontal space inside each collapsed card"
      pattern: "summary\\s*\\{[^}]*font-size:\\s*10px"
---

<objective>
Frame2D Bundle A — two CSS-only density tweaks for the existing rs3 horizontal-toolbar layout. **Single CSS file, single commit, one UAT checkpoint.**

**Item 1 — Display section density.** The Display card (`<details class="card">` at lines 140-179 of `ui/frame2d/index.html`) currently sprawls horizontally because the global `.checkbox-label { flex-direction: row !important; ... gap: 6px !important; cursor: pointer; }` rule (line 295 of `ui/frame2d/style.css`) was written when the panel was a vertical left rail. After rs3 flipped the panel to a horizontal wrap-row toolbar, that row-direction default makes the 8 visibility checkboxes inside Display sit side-by-side, eating horizontal space. We force vertical stacking + smaller font + tighter gap **for the Display card only** — leaving the 9 other cards' `.checkbox-label` items untouched (Show supports / Show loads etc. are inside Display already; chkSupports/chkLoads themselves are also inside Display, so they're swept up by Display's local override — no other card uses `.checkbox-label`). Carry-over from 260504-nwi UAT close: "Display section crowded — wants items stacked one-per-line with smaller text."

**Item 2 — rs3 toolbar wrap improvement.** The rs3 spike shipped with `.card { min-width: 180px }` (line 188 of style.css) and `summary { font-size: 11px }` (line 196). At intermediate viewport widths the cards wrap to 2-3 rows earlier than ideal. Drop `min-width` to 140px and `summary` font-size to 10px — both ~5-character changes — to keep cards on one row longer. Carry-over from existing todo `.planning/todos/pending/2026-05-04-frame2d-toolbar-wrap-improvement.md`.

**Why bundled into one commit:** both items are pure CSS density tweaks targeting the same horizontal-toolbar layout, total diff is ~12-15 lines, and a single revert point keeps the rollback story clean. Matches the rs3 plan's shape (one auto commit + one UAT checkpoint).

Output:
- 1 atomic auto commit (CSS-only — `ui/frame2d/style.css`).
- 1 manual UAT checkpoint after the commit lands — the user inspects desktop full-screen + a narrower viewport (~1100-1300px) to confirm wrap improvement and Display density both look right.
- Zero changes to: `ui/frame2d/index.html`, `ui/frame2d/script.js`, `solver_core/`, `api_server/`, `tests/`, `ui/truss2d/`, save/load JSON format, mode strings, keyboard shortcuts, hit-test math.
- Single revertable commit: if either tweak is judged wrong, `git revert <hash>` returns the page to the post-sq0 baseline with zero collateral damage.

**260505-sq0 baseline preservation (binding):** the user explicitly called out that the just-landed sq0 work must NOT regress:
- `--color-grid: #d4d8df` (line 20) stays unchanged.
- The `#udlPanel`/`#springPanel` token-driven CSS rules (lines 412-496) stay unchanged.
- The diff gate in Task 1's verifier explicitly searches for the absence of any modification to those regions.
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
@.planning/quick/260504-rs3-frame2d-ui-followup-3-horizontal-toolbar/260504-rs3-PLAN.md
@.planning/quick/260504-rs3-frame2d-ui-followup-3-horizontal-toolbar/260504-rs3-SUMMARY.md
@.planning/quick/260504-nwi-frame2d-ui-followup-2-collapsible-right-/260504-nwi-SUMMARY.md
@.planning/quick/260505-sq0-light-mode-contrast-pass-udl-panel-reada/260505-sq0-PLAN.md
@.planning/todos/pending/2026-05-04-frame2d-toolbar-wrap-improvement.md
@.planning/todos/pending/2026-05-05-frame2d-panel-ux-cheap-wins-pre-ribbon-and-999-5-prep.md

<interfaces>
<!-- Concrete code shapes already present. Use these directly — no codebase exploration needed. -->

### Base commit for "script.js + index.html unchanged" verification

Pre-task base is HEAD `c3d1434` at plan-write time (the 260505-sq0 close-out commit). Verifier uses `EXPECTED_BASE` env var (orchestrator captures `git rev-parse HEAD` before spawning executor and exports it; falls back to literal `c3d1434` if unset). Record the actual captured hash in SUMMARY.md.

### File sizes (post-sq0, pre-tke)
- `ui/frame2d/style.css` — 560 lines
- `ui/frame2d/index.html` — 292 lines (UNCHANGED in this plan)
- `ui/frame2d/script.js` — 2170 lines (UNCHANGED in this plan)

### Current Display card structure (DO NOT MODIFY — this is the DOM the CSS targets)

From `ui/frame2d/index.html` lines 140-179:

```html
<details class="card" open>
  <summary>Display</summary>
  <label class="checkbox-label">
    <input type="checkbox" id="chkSupports" checked> Show supports
  </label>
  <label class="checkbox-label">
    <input type="checkbox" id="chkLoads" checked> Show loads
  </label>
  <label class="checkbox-label">
    <input type="checkbox" id="chkDeflected"> Show deflected shape
  </label>
  <label class="checkbox-label">
    <input type="checkbox" id="chkBMD" disabled> Show bending moment diagram
  </label>
  <label class="checkbox-label">
    <input type="checkbox" id="chkSFD" disabled> Show shear force diagram
  </label>
  <label class="checkbox-label">
    <input type="checkbox" id="chkDiagLabels"> Show diagram values
  </label>
  <label class="checkbox-label"><input type="checkbox" id="chkNodeLabels"> Node labels</label>
  <label>Deflection scale ×
    <input type="number" id="inputScale" value="100" min="1" step="10">
  </label>
  <label>BMD / SFD scale ×
    <input type="number" id="inputDiagramScale" value="1" min="0.1" step="0.5">
  </label>
  <label class="panel-label">Symbol size &times;
    <input type="number" id="inputSymbolScale" value="1.0" min="0.5" max="2.0" step="0.1">
  </label>
  <label class="panel-label">Label size &times;
    <input type="range" id="inputLabelScale" min="0.5" max="2.0" step="0.1" value="1.0">
  </label>
  <button class="tool-btn" id="themeToggle" type="button"
          title="Toggle light/dark theme"
          style="display:flex; align-items:center; justify-content:center; gap:6px; margin-top:6px;">
    <span id="themeToggleIcon">&#9790;</span>
    <span id="themeToggleLabel">Dark</span>
  </button>
</details>
```

Key observations:
- 7 of the children are `<label class="checkbox-label">` — these inherit the global `.checkbox-label { flex-direction: row !important }` rule.
- 2 children are bare `<label>` (no class) — `Deflection scale ×` and `BMD / SFD scale ×` — they inherit `.panel-section label { display: flex; flex-direction: column }` from line 280.
- 2 children use `<label class="panel-label">` — `Symbol size ×` and `Label size ×` — they inherit `.panel-label { display: flex; flex-direction: column }` from line 378.
- 1 child is the `#themeToggle` button with inline `style="display:flex; ..."`.
- The 2 bare `<label>` items + 2 `panel-label` items + theme toggle button already stack vertically because their respective rules use `flex-direction: column` already.
- **The problem is solely with the 7 `.checkbox-label` items** — they're forced row by the `!important` rule.

### Existing rules in `ui/frame2d/style.css` that this plan TARGETS

**Item 1 target — line 295:**

```css
.checkbox-label { flex-direction: row !important; align-items: center; gap: 6px !important; cursor: pointer; }
```

This is a global rule. We do NOT modify it directly (other cards may rely on it — e.g. if any other card later uses `.checkbox-label`, it should continue to inherit this row layout). Instead, we add a Display-card-scoped override that wins via specificity.

**Strategy for Display-only scope (HTML cannot change):**

Use the CSS `:has()` selector to identify the Display card by a unique child ID. The Display card is the only `<details class="card">` that contains `#chkDeflected` (or `#chkBMD`, `#chkSFD`, `#chkDiagLabels`, `#chkNodeLabels`, `#inputScale`, `#inputDiagramScale`, `#inputSymbolScale`, `#inputLabelScale`, or `#themeToggle`). Any of these is a unique-to-Display marker.

Recommended selector: `details.card:has(> summary + .checkbox-label #chkDeflected)` — but simpler and equivalent: `details.card:has(#chkDeflected)`.

Browser support for `:has()`: Safari 15.4+, Chrome 105+, Firefox 121+ (Dec 2023). All major desktop browsers have supported it for ≥18 months at the time of this plan (2026-05-05). User's UAT environments (Mac Safari + Windows-laptop browsers via Tailscale) all support it.

**Item 2 target — lines 185-190 (`.card, .panel-section` shared sizing rule from rs3):**

```css
.card,
.panel-section {
  flex: 0 1 auto;
  min-width: 180px;
  margin-bottom: 0;
}
```

Single value change: `min-width: 180px` → `min-width: 140px`.

**Item 2 target — lines 191-207 (`summary` rule from nwi):**

```css
summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-fg-faint);
  letter-spacing: 0.5px;
  margin: calc(-1 * var(--space-3));
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  user-select: none;
  transition: background 0.15s;
}
```

Single value change: `font-size: 11px` → `font-size: 10px`. All other properties UNCHANGED.

### Target rules after tke (additions only — existing rules unchanged except for the two values noted above)

**Item 2 — modify in place (line 188 `min-width` value, line 196 `font-size` value):**

```css
.card,
.panel-section {
  flex: 0 1 auto;
  min-width: 140px;          /* was 180px — wrap improvement */
  margin-bottom: 0;
}

summary {
  /* ...existing properties unchanged... */
  font-size: 10px;            /* was 11px — wrap improvement complement */
  /* ...existing properties unchanged... */
}
```

**Item 1 — append a NEW Display-scoped block. Recommended placement: immediately after the existing `.checkbox-label` rule at line 295, so the override sits next to the rule it overrides for readability.**

```css
/* ── Display card density (tke — Item 1) ──────────────────────
   Scoped via :has() to target only the Display <details class="card">,
   identified by its unique child #chkDeflected. Forces vertical stacking
   of .checkbox-label items, smaller font-size, tighter gap. The 9 other
   cards' .checkbox-label items (none currently exist outside Display,
   but the global rule remains intact for any future use) keep row layout.
*/
details.card:has(#chkDeflected) .checkbox-label {
  flex-direction: column !important;   /* override global row !important */
  align-items: flex-start;
  gap: 2px !important;                  /* tighter than global 6px !important */
  font-size: 11px;                      /* smaller than inherited 13px body */
  margin-bottom: 2px;
}

/* Match the bare <label> children (Deflection scale, BMD/SFD scale) +
   .panel-label children (Symbol size, Label size) to the same compact font-size,
   so the whole Display card reads as one tight stacked list. They already
   stack vertically via .panel-section label / .panel-label rules — only
   font-size + margin tightening needed here. */
details.card:has(#chkDeflected) > label,
details.card:has(#chkDeflected) > label.panel-label {
  font-size: 11px;
  margin-bottom: 2px;
}

details.card:has(#chkDeflected) > label input[type="number"],
details.card:has(#chkDeflected) > label.panel-label input[type="number"],
details.card:has(#chkDeflected) > label.panel-label input[type="range"] {
  font-size: 11px;
  padding: 2px 5px;                     /* tighter than inherited 4px 6px */
}
```

Notes on the Item 1 target:
- `details.card:has(#chkDeflected)` uniquely identifies the Display card (no other card contains `#chkDeflected`).
- `flex-direction: column !important` overrides the global `flex-direction: row !important` — both `!important`s, but the more specific selector (`details.card:has(#chkDeflected) .checkbox-label` is more specific than `.checkbox-label`) wins on specificity tie at the cascade-priority level.
- `gap: 2px !important` similarly overrides the global `gap: 6px !important`.
- `align-items: flex-start` (no `!important`) overrides the global `align-items: center` (no `!important`) — straightforward specificity win.
- `font-size: 11px` on `.checkbox-label` and on the bare-label / panel-label / number-input children gives the entire Display card a consistent compact look.
- `margin-bottom: 2px` on the labels tightens vertical spacing so the stacked list reads as a single tight block, not a sprawling column.
- `padding: 2px 5px` on the number inputs prevents them from looking oversized next to the now-smaller label text.
- `#themeToggle` button has its own inline `style="..."` — explicitly NOT touched here. It already renders correctly via the existing `.tool-btn` rule + its inline overrides. If user wants it tightened post-UAT, capture as follow-up.

### What `:has()` enables that other approaches don't

The constraint "no HTML changes" rules out adding a `class="display-card"` hook. Without `:has()`, the only DOM-distinguishing feature of the Display card is the IDs of its children — there's no way to "select the parent of an element with ID X" in pre-`:has()` CSS. `:has()` is exactly the parent-selector tool for this case.

Alternative approaches considered and rejected:
- **Modify the global `.checkbox-label` rule** — would affect any future card using `.checkbox-label`. Currently only Display uses it, but the global rule's existence implies generality. Keeping the global rule intact + adding a Display-scoped override is more defensive.
- **`details.card[open] > label.checkbox-label`** — would only work when the card is open, which is the default but not guaranteed if user collapses Display.
- **`details.card:nth-of-type(N) .checkbox-label`** where N is Display's index — fragile against any future card reordering.
- **CSS custom property cascade** — too clever, harder to reason about than a `:has()` selector.

`:has()` is the correct tool: it scopes by unique semantic content (`#chkDeflected` only exists in Display), it doesn't depend on order or open state, and it remains stable across future card additions/reorderings as long as `#chkDeflected` stays inside Display.

### Token context (already in place — no new tokens needed for either Item)

This plan adds NO new design tokens. All values are direct (`140px`, `10px`, `11px`, `2px`, `2px 5px`) since the existing token scale doesn't have these specific values and adding tokens just for two density tweaks is overengineering. If a future plan wants to systematise these as `--font-size-xxs: 10px` or similar, that's a bigger refactor.

### 260505-sq0 baseline preservation — explicit diff gate

The user flagged: "260505-sq0 baseline must NOT regress: `--color-grid: #d4d8df` (line 20) and the `#udlPanel`/`#springPanel` token-driven CSS rules from commits `195ac08`+`e15392f` are now part of the baseline; planner's diff gate should explicitly exclude any modification to those rules."

Explicit verification in Task 1's `<verify>`:
- Negative grep: `--color-grid:` value MUST equal `#d4d8df` post-tke (assert that line 20's value is unchanged).
- Negative diff: lines 412-496 (the `#udlPanel`/`#springPanel` block) MUST be byte-identical to the pre-tke base. Verifier uses `git diff "$EXPECTED_BASE..HEAD" -- ui/frame2d/style.css` and asserts no hunk touches lines 412-496 (or asserts the relevant pattern is still present and unchanged).

### CLAUDE.md hard rules that apply here

- visualization/ leaf invariant: not relevant — browser-side CSS work only.
- No mode-string change, no API change, no save/load format change: ENFORCED — task touches only style.css.
- Frame solver / FrameModel2D / 1-based DOF rules: not relevant — frontend-only.

### Safety contract (from j8m + lti + nwi + rs3 + sq0, must continue to hold)

This plan ONLY touches:
- `ui/frame2d/style.css` (single CSS commit — Item 1 + Item 2 density tweaks)

Forbidden in this plan:
- ANY change to `ui/frame2d/index.html` (HTML constraint binding)
- ANY change to `ui/frame2d/script.js` (JS constraint binding)
- ANY change to `ui/truss2d/*` (truss2d explicitly out of scope per user)
- ANY change to `solver_core/*`, `api_server/*`, `tests/*`
- ANY change to mode-string identifiers
- ANY change to save/load JSON format
- ANY change to hit-test math, `setMode()` behaviour, `draw()` ordering
- ANY change to keyboard shortcuts
- ANY change to the 10 `<details class="card" open>` blocks' inner content
- ANY change to the existing `--canvas-*` token system (lti)
- ANY change to the `[data-theme="dark"]` override block (lines 499-560)
- ANY change to any `--color-*` / `--space-*` / `--radius-*` / `--shadow-*` token value
- ANY change to the `#udlPanel` / `#springPanel` token-driven rules (lines 412-496 from sq0)
- ANY change to `--color-grid: #d4d8df` (line 20 from sq0)
- ANY new design tokens
- ANY new dark-mode overrides (changes are theme-agnostic sizing/layout)

</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1 (Commit 1): Apply Bundle A density tweaks — Display card stacking + .card min-width 140px + summary 10px</name>
  <files>ui/frame2d/style.css</files>
  <action>
**Goal:** make a single CSS-only commit to `ui/frame2d/style.css` that applies the two Bundle A density tweaks. Total diff: ~12-18 lines (one block added for Item 1, two single-value edits for Item 2). The Display card now stacks its checkbox items vertically with smaller text; the toolbar's cards use a smaller `min-width` and `summary` font-size so cards stay on one row at narrower viewports.

**Step 1 — Item 2a: change `.card, .panel-section { min-width: 180px }` to `min-width: 140px` (around line 188).**

Locate the `.card, .panel-section` rule (currently at lines 185-190 from rs3):

```css
/* ── Horizontal-toolbar sizing for cards + surviving sections (rs3) */
.card,
.panel-section {
  flex: 0 1 auto;
  min-width: 180px;
  margin-bottom: 0;
}
```

Change `min-width: 180px` to `min-width: 140px`. Leave the rest of the rule, the comment, and adjacent rules UNCHANGED.

**Step 2 — Item 2b: change `summary { font-size: 11px }` to `font-size: 10px` (around line 196).**

Locate the `summary` rule (currently at lines 191-207 from nwi):

```css
summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 11px;       /* ← change THIS line */
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-fg-faint);
  letter-spacing: 0.5px;
  margin: calc(-1 * var(--space-3));
  margin-bottom: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  user-select: none;
  transition: background 0.15s;
}
```

Change `font-size: 11px` to `font-size: 10px`. **Do NOT modify any other property** in the `summary` rule, and do NOT modify the `summary::-webkit-details-marker`, `summary::marker`, `summary:hover`, `summary::before`, or `details[open] > summary::before` rules that follow.

**Step 3 — Item 1: append the Display-scoped density block, AFTER the existing `.checkbox-label` rule (around line 295).**

Locate the `.checkbox-label` rule (currently line 295):

```css
.checkbox-label { flex-direction: row !important; align-items: center; gap: 6px !important; cursor: pointer; }
```

Append the following block immediately after this line (insert as new lines, do NOT replace the existing rule):

```css
/* ── Display card density (tke — Item 1) ──────────────────────
   Scoped via :has() to target only the Display <details class="card">,
   identified by its unique child #chkDeflected. Forces vertical stacking
   of .checkbox-label items, smaller font-size, tighter gap. The 9 other
   cards' .checkbox-label items (none currently exist outside Display,
   but the global rule remains intact for any future use) keep row layout.
*/
details.card:has(#chkDeflected) .checkbox-label {
  flex-direction: column !important;
  align-items: flex-start;
  gap: 2px !important;
  font-size: 11px;
  margin-bottom: 2px;
}

details.card:has(#chkDeflected) > label,
details.card:has(#chkDeflected) > label.panel-label {
  font-size: 11px;
  margin-bottom: 2px;
}

details.card:has(#chkDeflected) > label input[type="number"],
details.card:has(#chkDeflected) > label.panel-label input[type="number"],
details.card:has(#chkDeflected) > label.panel-label input[type="range"] {
  font-size: 11px;
  padding: 2px 5px;
}
```

**Step 4 — DO NOT touch any other rule.**

Specifically, DO NOT modify:
- The global `.checkbox-label` rule itself (line 295) — leave it intact for non-Display use.
- The `#chkSupports`/`#chkLoads`/`#chkDeflected`/etc input elements directly — only their parent `.checkbox-label` is targeted.
- Any rule outside the three pinpointed locations above.
- The `--color-grid: #d4d8df` definition (line 20) — sq0 baseline.
- The `#udlPanel` / `#springPanel` token-driven block (lines 412-496) — sq0 baseline.
- The `[data-theme="dark"]` override block (lines 499-560).
- Any `@font-face` block, `body`, `header`, reset rules.
- The `.workspace`, `.panel`, `.canvas-area`, `canvas`, `.results-panel`, `.results-grid`, `.results-table-wrap` rules.
- The `.tool-btn`, `.support-btn`, `.solve-btn`, `.support-tag` rules.
- The `.panel-section label`, `.panel-section input[type="number"]`, `.panel-label`, `.sec-inputs`, `.download-link` rules.
- Any `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--canvas-*` token definition.
- The `summary::-webkit-details-marker`, `summary::marker`, `summary:hover`, `summary::before`, `details[open] > summary::before`, `details[open] > summary`, `@media (prefers-reduced-motion: reduce)` rules from nwi.

**Step 5 — DO NOT modify ui/frame2d/index.html.**

The Bundle A constraint binds: HTML stays untouched. The Item 1 scoping mechanism is `:has(#chkDeflected)`, which works against the existing DOM without any HTML changes.

**Step 6 — DO NOT modify ui/frame2d/script.js.**

The Bundle A constraint binds: JS stays untouched.

**Step 7 — DO NOT add new design tokens.**

The values `140px`, `10px`, `11px`, `2px`, `2px 5px` are direct literals. Do not introduce `--font-size-xxs` or similar tokens — that's a separate refactor outside Bundle A's scope.

**Step 8 — DO NOT modify ui/truss2d/* anything.**

Truss2d is explicitly out of scope per user constraints (it has no token system; covered by separate larger backlog item).

**Why both items in one commit:**

- Both are CSS-only density tweaks targeting the rs3 horizontal-toolbar layout.
- Total diff is ~12-18 lines (small enough that a single commit is the right granularity).
- A single revert point (`git revert <hash>`) cleanly returns the page to the post-sq0 baseline if either tweak is judged wrong at UAT.
- Matches the rs3 plan's shape (one auto commit + one UAT checkpoint).

**Commit message (suggested):** `feat(quick-260505-tke): frame2d Bundle A — Display card density + toolbar wrap improvement`

Or if user prefers split commits, the executor MAY split into two atomic commits (Item 2 first, then Item 1) — both valid; planner's preference is single commit for the small total diff.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const css=fs.readFileSync('ui/frame2d/style.css','utf8');let fail=0;/* Item 2a: .card, .panel-section block must contain min-width: 140px */ const cardMatch=css.match(/\\.card,\\s*\\n\\s*\\.panel-section\\s*\\{[^}]*\\}/);if(!cardMatch){console.error('FAIL: .card, .panel-section shared rule not found');fail++;}else{if(!/min-width:\\s*140px/.test(cardMatch[0])){console.error('FAIL: .card, .panel-section block does not contain min-width: 140px. Block: '+cardMatch[0]);fail++;}if(/min-width:\\s*180px/.test(cardMatch[0])){console.error('FAIL: .card, .panel-section block STILL contains min-width: 180px (Item 2a not applied)');fail++;}}/* Item 2b: summary rule must contain font-size: 10px and NOT 11px */ const summaryMatch=css.match(/^summary\\s*\\{[^}]*\\}/m);if(!summaryMatch){console.error('FAIL: top-level summary rule not found');fail++;}else{if(!/font-size:\\s*10px/.test(summaryMatch[0])){console.error('FAIL: summary rule does not contain font-size: 10px. Block: '+summaryMatch[0]);fail++;}if(/font-size:\\s*11px/.test(summaryMatch[0])){console.error('FAIL: summary rule STILL contains font-size: 11px (Item 2b not applied)');fail++;}}/* Item 1: Display-scoped :has() block must exist */ if(!css.includes('details.card:has(#chkDeflected)')){console.error('FAIL: Display-scoped :has(#chkDeflected) selector not found (Item 1 not applied)');fail++;}if(!/details\\.card:has\\(#chkDeflected\\)\\s+\\.checkbox-label/.test(css)){console.error('FAIL: Display-scoped .checkbox-label override not found');fail++;}if(!/flex-direction:\\s*column\\s*!important/.test(css)){console.error('FAIL: Display-scoped flex-direction: column !important not found');fail++;}/* Global .checkbox-label rule MUST still exist intact (we appended, not replaced) */ if(!/\\.checkbox-label\\s*\\{\\s*flex-direction:\\s*row\\s*!important/.test(css)){console.error('FAIL: global .checkbox-label rule with flex-direction: row !important is missing — must be intact');fail++;}/* sq0 baseline: --color-grid: #d4d8df */ if(!/--color-grid:\\s*#d4d8df/.test(css)){console.error('FAIL: --color-grid: #d4d8df (sq0 baseline) is missing or modified');fail++;}/* sq0 baseline: #udlPanel border-color uses --color-info-border */ if(!/#udlPanel\\s*\\{[^}]*border:\\s*1px solid var\\(--color-info-border\\)/.test(css)){console.error('FAIL: #udlPanel border-color rule (sq0 baseline) is missing or modified');fail++;}/* sq0 baseline: #springPanel border-color uses --color-accent-spring-border */ if(!/#springPanel\\s*\\{[^}]*border:\\s*1px solid var\\(--color-accent-spring-border\\)/.test(css)){console.error('FAIL: #springPanel border-color rule (sq0 baseline) is missing or modified');fail++;}if(fail)process.exit(1);console.log('PASS: Item 1 (Display :has() density block) + Item 2a (min-width 140px) + Item 2b (summary 10px) all applied; global .checkbox-label intact; sq0 baseline preserved');"</automated>
    <automated>BASE="${EXPECTED_BASE:-c3d1434}"; CHANGED=$(git diff --name-only "$BASE..HEAD" | sort -u | tr '\n' ' ' | sed 's/ *$//'); if [ "$CHANGED" = "ui/frame2d/style.css" ]; then echo "PASS: only ui/frame2d/style.css changed across the plan from base $BASE"; else echo "FAIL: expected only ui/frame2d/style.css, got: $CHANGED"; git diff --name-only "$BASE..HEAD"; exit 1; fi</automated>
    <automated>BASE="${EXPECTED_BASE:-c3d1434}"; if git diff --quiet "$BASE..HEAD" -- ui/frame2d/script.js; then echo "PASS: ui/frame2d/script.js is byte-identical to base $BASE"; else echo "FAIL: ui/frame2d/script.js has changed from base $BASE — Bundle A forbids any script.js change"; git diff --stat "$BASE..HEAD" -- ui/frame2d/script.js; exit 1; fi</automated>
    <automated>BASE="${EXPECTED_BASE:-c3d1434}"; if git diff --quiet "$BASE..HEAD" -- ui/frame2d/index.html; then echo "PASS: ui/frame2d/index.html is byte-identical to base $BASE"; else echo "FAIL: ui/frame2d/index.html has changed from base $BASE — Bundle A forbids any index.html change"; git diff --stat "$BASE..HEAD" -- ui/frame2d/index.html; exit 1; fi</automated>
    <automated>BASE="${EXPECTED_BASE:-c3d1434}"; if git diff --quiet "$BASE..HEAD" -- ui/truss2d/; then echo "PASS: ui/truss2d/ is byte-identical to base $BASE (truss2d out of scope)"; else echo "FAIL: ui/truss2d/ has changes from base $BASE — Bundle A explicitly excludes truss2d"; git diff --stat "$BASE..HEAD" -- ui/truss2d/; exit 1; fi</automated>
    <automated>BASE="${EXPECTED_BASE:-c3d1434}"; if git diff --quiet "$BASE..HEAD" -- solver_core/ api_server/ tests/; then echo "PASS: solver_core/ + api_server/ + tests/ are byte-identical to base $BASE"; else echo "FAIL: protected directories have changes from base $BASE"; git diff --stat "$BASE..HEAD" -- solver_core/ api_server/ tests/; exit 1; fi</automated>
    <automated>cd /Users/catrinevans/Documents/pda_project && python -m pytest tests/ -q 2>&1 | tail -5</automated>
  </verify>
  <done>
- `ui/frame2d/style.css` `.card, .panel-section` rule has `min-width: 140px` (was 180px); `min-width: 180px` is no longer present anywhere in that block.
- `ui/frame2d/style.css` top-level `summary` rule has `font-size: 10px` (was 11px); `font-size: 11px` is no longer present in that specific rule (the value MAY still appear elsewhere in the file — e.g. inside the new Display-scoped block, that's fine; the verifier above checks the `summary` block specifically).
- `ui/frame2d/style.css` contains a new block scoped by `details.card:has(#chkDeflected)` with at least three sub-rules: `.checkbox-label` override (`flex-direction: column !important`, smaller gap, smaller font), `> label` / `> label.panel-label` font-size + margin-bottom override, and `> label input` font-size + padding override.
- The global `.checkbox-label { flex-direction: row !important; align-items: center; gap: 6px !important; cursor: pointer; }` rule is INTACT — verifier confirms it's still present.
- `--color-grid: #d4d8df` (sq0 baseline) is present and unchanged.
- `#udlPanel { border: 1px solid var(--color-info-border) ... }` (sq0 baseline) is present and unchanged.
- `#springPanel { border: 1px solid var(--color-accent-spring-border) ... }` (sq0 baseline) is present and unchanged.
- `git diff --name-only EXPECTED_BASE..HEAD` shows only `ui/frame2d/style.css`.
- `ui/frame2d/index.html` is byte-identical to EXPECTED_BASE (`c3d1434`).
- `ui/frame2d/script.js` is byte-identical to EXPECTED_BASE (`c3d1434`).
- `ui/truss2d/`, `solver_core/`, `api_server/`, `tests/` are all byte-identical to EXPECTED_BASE.
- `pytest tests/ -q` shows 61 passed.
- No new design tokens added.
- Atomic commit landed (or two atomic commits if executor chose to split — both shapes valid).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual UAT in browser — Display density + toolbar wrap improvement</name>
  <files>none — manual browser UAT, no files modified by this task</files>
  <action>Run the manual UAT script under `<how-to-verify>` in a browser. The auto commit applied both density tweaks; this task validates both visually + as a regression smoke. The user inspects desktop full-screen + a narrower viewport (~1100-1300px) since visual density is hard to verify programmatically.</action>
  <verify>Manual browser UAT: every step under `<how-to-verify>` passes (Display card stacks vertically with compact text, toolbar wraps later at narrower widths, all 10 cards still collapse/expand, cantilever solve regression, save/load JSON round-trip, dark theme, sq0 UDL/Spring panels still render correctly).</verify>
  <done>User types "approved" — or describes any divergence so an additional commit / revert can be made.</done>
  <what-built>
- 1 atomic commit on `main`, independently revertable (or 2 atomic commits if the executor chose to split — both valid).
- Modified files: `ui/frame2d/style.css` only.
- **Item 1 (Display density):** scoped CSS block using `details.card:has(#chkDeflected)` to override the global `.checkbox-label` row layout for the Display card only — items now stack vertically with `font-size: 11px`, `gap: 2px`, `margin-bottom: 2px`. The bare `<label>` and `.panel-label` children inside Display also get `font-size: 11px` + tightened margins; their number inputs get smaller padding. `#themeToggle` button is untouched (its inline style is preserved).
- **Item 2 (Toolbar wrap):** `.card, .panel-section { min-width: 180px → 140px }` and `summary { font-size: 11px → 10px }`. Cards stay on one row at narrower viewports; chevron text reads tighter inside each collapsed card.
- UNTOUCHED: `ui/frame2d/index.html`, `ui/frame2d/script.js`, `ui/truss2d/*`, `solver_core/`, `api_server/`, `tests/`, save/load JSON format, mode strings, keyboard shortcuts, hit-test math, `--color-grid: #d4d8df`, `#udlPanel`/`#springPanel` rules, `[data-theme="dark"]` overrides, all `--color-*` / `--space-*` / `--canvas-*` tokens.
- Behavioural changes: Display card visually denser (one item per line, smaller text); toolbar wraps later at narrower viewports.
- Single revert restores the post-sq0 baseline: `git revert <hash>` of this commit (or sequential reverts of the 2 commits if split) returns the page to commit `c3d1434` exactly.
  </what-built>
  <how-to-verify>
1. **Start the API server (if not already running):** `uvicorn api_server.app:app --reload` from `pda_project/`.
2. **Open the frame2d UI:** browse to `http://127.0.0.1:8000/ui/frame2d/index.html` (or the Tailscale URL `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`). Hard-reload to bypass any cached CSS (Cmd+Shift+R on macOS, Ctrl+Shift+R on Windows).

3. **Item 1 — Display card density (the carry-over from nwi UAT):**
   - Locate the Display card in the horizontal toolbar at the top of the page (it's the 10th card — after Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator).
   - Confirm it's expanded (the `<details>` is `open` by default).
   - **Stacking check:** all 7 checkbox labels (Show supports, Show loads, Show deflected shape, Show bending moment diagram, Show shear force diagram, Show diagram values, Node labels) should each occupy their OWN line — one per row. Before this commit, they spread sideways inside the card. After: they stack as a vertical list.
   - **Font-size check:** the checkbox label text + the bare-label text (Deflection scale ×, BMD / SFD scale ×) + the panel-label text (Symbol size ×, Label size ×) all read at ~11px — visibly smaller than the body's 13px default. The Display card should now look noticeably more compact than before.
   - **Number input check:** the 4 number inputs (Deflection scale, BMD/SFD scale, Symbol size, Label size — last is a range slider) render correctly inside their labels — text is readable, the slider thumb is interactive, no input is squished or oversized.
   - **Gap check:** the vertical spacing between stacked items is tight (~2-4px) — the list reads as a dense block, not a sparse column.
   - **Theme toggle button:** the `#themeToggle` button at the bottom of the Display card still renders correctly (it has its own inline `style="display:flex; ..."` which is untouched). Click it — theme should still flip light/dark.

4. **Item 2 — Toolbar wrap improvement (carry-over from rs3 todo):**
   - **At your normal viewport width (~1500-1900px on a typical monitor):** count the rows the toolbar occupies. Compare your impression to before this commit — it should occupy the same OR fewer rows (probably the same at ≥1700px, fewer at 1400-1700px).
   - **Resize the browser window to ~1300px wide:** does the toolbar fit on fewer rows than it did pre-tke? Expectation: at least one fewer row at 1300px because cards are now 140px min-width instead of 180px.
   - **Resize narrower (~1100px):** wrap behaviour should remain readable; horizontal scroll fallback (from rs3's `overflow-x: auto`) kicks in if needed.
   - **Resize wider:** toolbar should compact onto fewer rows.
   - **Chevron text legibility check:** the card titles (GEOMETRY, SUPPORTS, NODE LOADS, etc.) at 10px should still be clearly legible — uppercase text, letter-spacing, the existing `font-weight: 600` and `color: var(--color-fg-faint)` all remain.

5. **All 10 disclosure cards still collapse/expand (regression check on nwi):**
   - Click any card's summary header → that card's content collapses; the chevron rotates back to point right (▸).
   - Click again → expands; chevron rotates 90° down.
   - Confirm: multiple cards can be collapsed simultaneously.
   - Test at least 3 different cards (Geometry, Material Properties, Display).

6. **All toolbar buttons still trigger correct modes (regression check on script.js byte-equality):**
   - Click Geometry → ➕ Add Node → mode label at top of canvas reads "Add Node".
   - Click Supports → 📌 Pin → mode label reads the pre-tke value (script.js is unchanged so labels are identical).
   - Click Edit → 🗑 Delete → mode label changes.

7. **Build + solve a cantilever (full regression smoke):**
   - Place two nodes 5 m apart (e.g. (0,0) and (5,0)).
   - Connect them with a member.
   - Apply a fixed support at one end (Pinned support also OK for smoke).
   - Apply a downward 10 kN load at the free end (Force Y).
   - Click ▶ SOLVE.
   - Verify status reads "Solved ✓".
   - Verify member actions, reactions, and nodal displacements look correct.
   - Verify the `.results-panel` rendered correctly BELOW the canvas (unaffected by tke — it's outside `.workspace`).

8. **sq0 baseline regression — UDL + Spring panel (the user explicitly flagged this):**
   - Trigger the UDL panel: select a member then activate UDL mode (or use whatever flow currently brings up `#udlPanel`). The floating panel should render with the sq0 token-driven styling (light surface, blue border via `--color-info-border`, readable label text). Cancel without applying.
   - Trigger the Spring panel: activate spring support mode at a node. The `#springPanel` should render with purple border via `--color-accent-spring-border`. Cancel without applying.
   - **Both panels MUST render exactly as they did post-sq0.** If anything looks regressed (broken colours, hardcoded hex bleed-through, wrong border, wrong button styles), the tke commit accidentally regressed sq0 and must be fixed.

9. **Light/dark theme regression (lti):**
   - Click the ☀/☾ button in the Display card.
   - Toolbar background flips dark; cards and chevrons remain readable; all `--canvas-*` tokens flip per lti's system.
   - The Display card stacked items are still readable in dark mode (the new font-size: 11px rule is colour-agnostic, so dark mode inheritance is automatic — no new dark overrides were added).
   - Toggle back to light → still polished.

10. **Save / Load JSON regression:**
    - Click 💾 Save JSON in the File card — file downloads.
    - 🔄 Reset All in the Edit card.
    - Click 📂 Load JSON, pick the saved file → cantilever reappears with all properties intact.
    - ▶ SOLVE → same results as step 7.

11. **DevTools sanity check:**
    - Open DevTools → inspect any `.card` → computed `min-width: 140px` (was 180px).
    - Inspect a `summary` element → computed `font-size: 10px` (was 11px).
    - Inspect a `.checkbox-label` inside the Display card → computed `flex-direction: column` (overridden from global `row !important`).
    - Inspect a `.checkbox-label` inside a non-Display card if any exists (currently none do — only Display has `.checkbox-label` items) → if you find one, it should still be `flex-direction: row` per the global rule.

12. **Diff sanity (developer check, not user UAT):**
    - From a shell: `git diff c3d1434..HEAD -- ui/frame2d/script.js` — should produce ZERO output.
    - `git diff c3d1434..HEAD -- ui/frame2d/index.html` — should produce ZERO output.
    - `git diff c3d1434..HEAD -- ui/truss2d/` — should produce ZERO output.
    - `git diff --name-only c3d1434..HEAD` — should show ONLY `ui/frame2d/style.css`.
    - `git log --oneline c3d1434..HEAD -- ui/frame2d/` — should show 1 commit (or 2 if executor split Item 1 and Item 2).

13. **pytest smoke (developer check):**
    - `pytest tests/ -q` — 61/61 passed (no Python touched, but confirms nothing regressed).

**If any step diverges, describe what diverged.** Otherwise type "approved".

**Open question for the user (data point, not a blocker):** does the Display card now read as "compact and tight" rather than "crowded"? And does the toolbar wrap noticeably better at intermediate widths (~1300-1500px)? If either feels insufficient, escalation paths are captured in the existing todos (Item 1 escalates to Bundle B's `display-frequent`/`display-advanced` split; Item 2 escalates to card consolidation per the rs3 wrap-improvement todo).

**Rollback note (if something IS broken):** the single auto commit (or 2 if split) is the only code change. `git revert <hash>` (or sequential reverts) restores the post-sq0 baseline in full — no cascading reverts needed.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- Task 1 node script proves Item 1 + Item 2a + Item 2b are all applied: `details.card:has(#chkDeflected) .checkbox-label { flex-direction: column !important }` block exists; `.card, .panel-section` block contains `min-width: 140px` and NOT `min-width: 180px`; `summary` rule contains `font-size: 10px` and NOT `font-size: 11px`; the global `.checkbox-label { flex-direction: row !important }` rule is INTACT (we appended, not replaced).
- Task 1 sq0 baseline regression checks: `--color-grid: #d4d8df` is present; `#udlPanel` border-color rule using `var(--color-info-border)` is present; `#springPanel` border-color rule using `var(--color-accent-spring-border)` is present.
- Task 1 git-diff cross-plan checks prove only `ui/frame2d/style.css` changed; `ui/frame2d/script.js`, `ui/frame2d/index.html`, `ui/truss2d/`, `solver_core/`, `api_server/`, `tests/` are all byte-identical to EXPECTED_BASE (`c3d1434`).
- Task 1 pytest gate: `pytest tests/ -q` returns 61 passed.
- Task 2 manual UAT is the load-bearing functional verification — visual density is hard to verify programmatically, so the user inspects both desktop full-screen + a narrower (~1100-1300px) viewport.
</verification>

<success_criteria>
- The frame2d UI Display card renders its 7 `.checkbox-label` items as a vertical stacked list (one per row), with smaller text (~11px) and tighter gap (~2px). The 4 number inputs / range slider + theme toggle continue to render correctly within the now-tighter card.
- The toolbar's `.card` and `.panel-section` blocks use `min-width: 140px` (down from 180px) — at intermediate viewport widths (~1300-1500px), cards wrap to fewer rows than they did before tke.
- The `summary` chevron text uses `font-size: 10px` (down from 11px) — collapsed cards read tighter without sacrificing legibility.
- The 9 OTHER cards (Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator) are visually unchanged in their inner content — they only see the `min-width` and `summary` font-size shifts (Item 2), not the Display-scoped Item 1 rules.
- The 260505-sq0 baseline is preserved exactly: `--color-grid: #d4d8df` unchanged; `#udlPanel`/`#springPanel` token-driven CSS rules unchanged.
- Both light and dark themes look polished — Item 1's font-size + layout changes are colour-agnostic, so dark mode inherits automatically without new `[data-theme="dark"]` overrides.
- Zero JavaScript added: `ui/frame2d/script.js` is byte-identical to EXPECTED_BASE (`c3d1434`).
- Zero HTML changes: `ui/frame2d/index.html` is byte-identical to EXPECTED_BASE (`c3d1434`).
- Zero truss2d changes: `ui/truss2d/` is byte-identical to EXPECTED_BASE.
- Zero behaviour change in: mode strings, keyboard shortcuts, save/load JSON format, hit-test math, solver/API contracts, draw() / setMode() / drawBMD() / drawSFD() / drawGrid() / event listeners, canvas content, lti `--canvas-*` token system, nwi disclosure CSS rules + `summary::before` chevron, j8m design tokens, dark theme overrides.
- No new design tokens added.
- Single auto commit lands atomically and is fully revertable (or 2 atomic commits if executor split — both shapes valid; planner's preference is single commit).
- Manual UAT (Task 2) confirms full Display density + toolbar wrap data point + cantilever solve regression + save/load round-trip + theme toggle + sq0 panels still render correctly + 10 cards still collapse + pytest 61/61.
- pytest 61/61 green throughout.
</success_criteria>

<output>
After completion, create `.planning/quick/260505-tke-frame2d-bundle-a-display-section-density/260505-tke-SUMMARY.md` per the standard template, recording:
- The 1 auto commit hash (or 2 if split) + a one-line description of the CSS diff for each.
- The captured EXPECTED_BASE hash (orchestrator-supplied or fallback `c3d1434`).
- Confirmation that script.js, index.html, ui/truss2d/, solver_core/, api_server/, tests/ were byte-identical from EXPECTED_BASE through the plan.
- Confirmation that the 260505-sq0 baseline (`--color-grid: #d4d8df` + `#udlPanel`/`#springPanel` rules) was preserved.
- The Display density observation from UAT (does it now read "compact and tight"?).
- The toolbar wrap-behaviour observation from UAT (rows occupied at ~1500-1900px and at ~1100-1300px, before vs after).
- pytest result (61/61).
- Any deferred items raised at UAT (e.g. theme toggle could also be tightened, results-panel border misaligns with new toolbar, Bundle B promotion timing).
- Whether the user approved keeping both tweaks or requested revert/refinement of either.
- Pointer to the closed todos: mark `2026-05-04-frame2d-toolbar-wrap-improvement.md` as resolved-by-tke; mark Item 1 (Display density) of `2026-05-05-frame2d-panel-ux-cheap-wins-pre-ribbon-and-999-5-prep.md` as resolved-by-tke (Bundle B items 3+4+5 remain pending for the next quick task).
</output>
</content>
</invoke>