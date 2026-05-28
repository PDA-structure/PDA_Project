---
phase: quick-260528-vzl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ui/frame2d/index.html
  - ui/frame2d/style.css
autonomous: false
requirements:
  - SPIKE-VZL-01
must_haves:
  truths:
    - "The Add Member button renders with an inline SVG glyph (two filled node-dots connected by a thin line plus a small '+' badge), not the 🔗 emoji."
    - "At rest, the Add Member button shows a warm taupe-grey surface with cream-coloured glyph and label, plus a 1 px translucent border."
    - "Hovering the Add Member button produces a subtle lift (drop shadow) and a slightly brighter border, with no colour swap on the glyph."
    - "Clicking the Add Member button (so setMode('member') runs and 'active' class is added) turns the glyph and border neon green (#56E892) with a 1.5 px ring, and NO full background fill change."
    - "Keyboard focus on the Add Member button shows a visible neon-green focus outline."
    - "Every other toolbar button in frame2d still renders with its original emoji and existing .tool-btn styling — no visual change to ➕ Add Node, ▪ Fixed, ↓ Force Y, ▤ UDL, etc."
    - "Clicking Add Member still enters member-creation mode (data-mode='member' / onclick=\"setMode('member')\" unchanged) and clicking two existing nodes still creates a member — zero behaviour change."
    - "truss2d UI, solver_core, api_server, tests, and frame2d/script.js are untouched."
  artifacts:
    - path: "ui/frame2d/index.html"
      provides: "Add Member button markup with new SVG glyph + .tool-btn--spike class"
      contains: 'class="tool-btn tool-btn--spike"'
    - path: "ui/frame2d/style.css"
      provides: ".tool-btn--spike palette, states (rest/hover/focus-visible/active), and --spike-* CSS custom properties"
      contains: "--spike-accent-active"
  key_links:
    - from: "ui/frame2d/index.html (button)"
      to: "ui/frame2d/style.css (.tool-btn--spike)"
      via: "additive class on the Add Member button only"
      pattern: 'class="tool-btn tool-btn--spike"'
    - from: "existing setMode() JS in script.js"
      to: ".tool-btn--spike.active styling"
      via: "the same 'active' class JS already toggles on .tool-btn[data-mode]"
      pattern: '\.tool-btn--spike\.active'
    - from: "inline <svg>"
      to: "CSS-controlled colour"
      via: 'all paths use fill="currentColor" / stroke="currentColor"'
      pattern: 'currentColor'
---

<objective>
Spike a single modernised toolbar button on frame2d — the "Add Member" button — to validate a new glyph + colour palette before deciding whether to roll it out across the whole toolbar.

Purpose: Get real visual feedback on the proposed palette (charcoal-navy / warm taupe-grey / cream ink / neon-green active accent) and the inline-SVG node-pair glyph in the user's actual UI, side-by-side with the existing emoji buttons, with zero risk to the rest of frame2d.

Output: One restyled button on the frame2d toolbar with a new SVG glyph and an additive .tool-btn--spike class; nine other emoji buttons in the same toolbar for direct comparison; all behaviour (data-mode, onclick, setMode wiring, hit-testing, member creation) unchanged.
</objective>

<execution_context>
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/workflows/execute-plan.md
@/Users/catrinevans/Documents/pda_project/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@ui/frame2d/index.html
@ui/frame2d/style.css

<interfaces>
<!-- Key markers in the existing codebase the executor must integrate with — extracted so no codebase exploration is needed. -->

The Add Member button currently lives at ui/frame2d/index.html line 27 inside the Geometry <details class="card">:

```html
<button class="tool-btn" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">🔗 Add Member</button>
```

`setMode()` (in ui/frame2d/script.js — NOT modified by this plan) toggles an `active` class on the button whose `data-mode` matches the current mode. The existing rule that styles the active state is:

```css
.tool-btn.active { background: var(--color-accent); color: var(--color-on-accent); border-color: var(--color-accent); box-shadow: var(--shadow-sm); }
```

The spike must REPLACE the active-state visuals for `.tool-btn--spike` (Option A — accent on glyph + thin ring, NO background fill change). Higher specificity from `.tool-btn.tool-btn--spike.active` is sufficient — no `!important` needed since the spike selector has equal class count plus the modifier.

The existing `.tool-btn` resting rule (line 262) supplies `display: block`, `width: 100%`, `padding`, `margin-bottom`, `text-align: left`, `font-size: 11px`, `font-family: inherit`, plus the transition list. The spike class adds to / overrides only what's needed for the new palette — base layout properties inherit from `.tool-btn`.

Existing design tokens use the prefix `--color-*` / `--canvas-*` / `--space-*` / `--radius-*` / `--shadow-*` / `--font-*`. The new spike tokens MUST use the prefix `--spike-*` to avoid collision and to make it trivial to delete the spike after the decision lands.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Modernise Add Member button — SVG glyph + .tool-btn--spike palette</name>
  <files>ui/frame2d/index.html, ui/frame2d/style.css</files>
  <action>
ATOMIC two-file change. Land in a single commit because the HTML references a class and an SVG that only render correctly once the CSS lands too.

A) ui/frame2d/style.css — add the spike palette and the modifier class.

  A1) In the existing `:root { ... }` block (ends at line 94, just after `--canvas-label-size: 10px;`), append a clearly-fenced "Spike — Add Member button (260528-vzl)" section adding these custom properties EXACTLY:
      --spike-bg: #1E2228;
      --spike-surface: #3A3735;
      --spike-ink: #EAE6D8;
      --spike-accent-active: #56E892;
      --spike-accent-primary: #F5C82E;   /* reserved — not used in this spike */
      --spike-accent-danger: #A8323A;    /* reserved — not used in this spike */
      --spike-border: rgba(234, 230, 216, 0.12);

      Add a short comment noting the two reserved tokens are intentionally unused in this spike and exist so the palette is observable in DevTools alongside the active accent.

  A2) Immediately after the existing `.tool-btn.active { ... }` / `.tool-btn.danger { ... }` rules block (around line 281–283), add a new fenced section "── Spike modifier: .tool-btn--spike (260528-vzl) ────────────" with these rules:

      `.tool-btn--spike` (resting):
        background: var(--spike-surface);
        color: var(--spike-ink);
        border: 1px solid var(--spike-border);
        border-radius: var(--radius-sm);    /* match base .tool-btn radius */
        /* Layout inherits from .tool-btn (display: block / width / padding / margin / text-align / font-size / font-family / transition). Do NOT redeclare those. */
        display: inline-flex;
        align-items: center;
        gap: 6px;

      `.tool-btn--spike .spike-glyph` (sizes the inline SVG):
        width: 16px;
        height: 16px;
        flex: 0 0 16px;
        color: currentColor;   /* SVG paths use currentColor so this propagates */

      `.tool-btn--spike:hover`:
        background: var(--spike-surface);                  /* keep surface — lift is shadow + border, not colour swap */
        border-color: rgba(234, 230, 216, 0.24);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.30);

      `.tool-btn--spike:focus-visible`:
        outline: 2px solid var(--spike-accent-active);
        outline-offset: 2px;

      `.tool-btn--spike.active` (Option A — accent on glyph + ring, NOT background):
        background: var(--spike-surface);                  /* explicit: NO fill change */
        color: var(--spike-accent-active);                 /* label + currentColor glyph both turn neon green */
        border: 1.5px solid var(--spike-accent-active);
        box-shadow: var(--shadow-sm);

      `.tool-btn--spike.active:hover`:
        background: var(--spike-surface);                  /* prevent any base hover background creeping back in */
        border-color: var(--spike-accent-active);

      DO NOT add `!important` anywhere. DO NOT touch the existing `.tool-btn`, `.tool-btn:hover`, `.tool-btn:active`, `.tool-btn.active`, `.tool-btn.danger` rules. DO NOT add a dark-theme override block (`[data-theme="dark"] .tool-btn--spike { ... }`) — the spike palette is theme-independent by design; that's part of what the user is evaluating.

B) ui/frame2d/index.html — replace ONLY the Add Member button (line 27).

  Current line 27:
    <button class="tool-btn" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">🔗 Add Member</button>

  Replace with (preserve data-mode, onclick, title VERBATIM — these wire to setMode() in script.js):

    <button class="tool-btn tool-btn--spike" data-mode="member" onclick="setMode('member')" title="Click two nodes to connect them">
      <svg class="spike-glyph" viewBox="0 0 18 18" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <!-- member line: bottom-left node-dot to top-right node-dot -->
        <line x1="4" y1="14" x2="14" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <!-- two node-dots (filled circles) at the line endpoints -->
        <circle cx="4" cy="14" r="2.5" fill="currentColor"/>
        <circle cx="14" cy="4" r="2.5" fill="currentColor"/>
        <!-- small "+" badge in the top-right corner, slightly offset from the top-right node-dot -->
        <line x1="15.5" y1="13.5" x2="15.5" y2="17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="13.5" y1="15.5" x2="17.5" y2="15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Add Member
    </button>

  Notes for executor:
    - The "+" badge sits visually OUTSIDE the line endpoints (centred near 15.5, 15.5) and uses two crossed strokes inside a 4px box. The viewBox is 18×18 with 0.5 px overflow tolerance at the bottom-right — this is intentional so the badge reads as a separate emblem, not as part of the member-end node. The SVG element itself is 16 × 16 in CSS (set in A2), and `overflow: visible` is the default for inline SVG so the badge still renders.
    - Every path uses currentColor — colour is owned 100% by CSS via the `color` property on `.tool-btn--spike` (resting → cream; .active → neon green).
    - aria-hidden="true" + focusable="false" so screen readers and keyboard nav still announce only the button's text "Add Member".

DO NOT touch any other button in index.html. DO NOT touch ui/truss2d/. DO NOT touch ui/frame2d/script.js, sections.js, label-manager.js. DO NOT touch solver_core/, api_server/, tests/, visualization/. DO NOT change data-mode, onclick, or title on the Add Member button. DO NOT add new event listeners.

Commit as ONE atomic commit. Suggested message:
  feat(frame2d-ui): spike modernised Add Member button — SVG glyph + .tool-btn--spike palette (260528-vzl)
  </action>
  <verify>
    <automated>cd /Users/catrinevans/Documents/pda_project &amp;&amp; grep -c 'tool-btn--spike' ui/frame2d/index.html | grep -qx 1 &amp;&amp; grep -q '\-\-spike-accent-active' ui/frame2d/style.css &amp;&amp; grep -q '\.tool-btn--spike\.active' ui/frame2d/style.css &amp;&amp; grep -q 'class="spike-glyph"' ui/frame2d/index.html &amp;&amp; grep -cE 'currentColor' ui/frame2d/index.html | awk '$1 &gt;= 4 {exit 0} {exit 1}' &amp;&amp; ! grep -q '🔗 Add Member' ui/frame2d/index.html &amp;&amp; git diff --name-only HEAD | sort | diff - &lt;(printf 'ui/frame2d/index.html\nui/frame2d/style.css\n') &amp;&amp; cd solver_core &amp;&amp; python -m pytest -q ../tests/</automated>
    <human-verify>
      Start the API server: `uvicorn api_server.app:app --reload` from pda_project/
      Open http://127.0.0.1:8000/ui/frame2d/index.html in the browser.
      Click "▸ Geometry" to expand the Geometry card.
      Confirm:
        1. ➕ Add Node still shows the emoji and the original styling (control).
        2. ✏️ Edit Node still shows its emoji and the original styling (control).
        3. The middle button (Add Member) shows: a small SVG of two filled dots connected by a thin diagonal line with a "+" badge top-right, followed by the text "Add Member". No 🔗 emoji.
        4. At rest: warm taupe-grey button background, cream-coloured glyph + text, thin translucent border.
        5. Hover Add Member: subtle drop shadow appears, border brightens slightly, glyph stays cream (no colour swap on hover — colour only changes on active).
        6. Click Add Member: glyph turns neon green (#56E892), border turns neon green and thickens to 1.5 px, label text turns neon green, background STAYS warm taupe-grey (no fill change). Mode indicator at top of canvas reads "Add Member".
        7. Tab to the button with the keyboard: a neon-green focus ring appears outside the button.
        8. Click two existing nodes on the canvas — a member is drawn between them as before (behaviour unchanged).
        9. Open all other toolbar cards (Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Display) — none of those buttons have changed visually.
        10. Toggle the theme (☾/☀ button at the bottom of the Display card) — the Add Member spike button keeps its dark taupe surface in both light and dark themes (intentional — the spike palette is theme-independent).
    </human-verify>
  </verify>
  <done>
    - `git diff --name-only HEAD` returns exactly two paths: `ui/frame2d/index.html` and `ui/frame2d/style.css`.
    - pytest 61/61 green (no solver/test surface touched).
    - The Add Member button renders the inline SVG glyph (no 🔗 emoji anywhere in index.html for that button).
    - At rest the button surface is `--spike-surface` (#3A3735) and glyph + label are `--spike-ink` (#EAE6D8); when `.active` is on, glyph + label + border are `--spike-accent-active` (#56E892) and the background is still `--spike-surface`.
    - Focus-visible shows a neon-green outline.
    - Clicking the button still calls `setMode('member')`; clicking two nodes still creates a member.
    - Nine other emoji buttons (Add Node, Edit Node, Fixed, Pin, Roller×2, Spring, Force X, Force Y, Moment, etc.) are visually unchanged.
    - Zero changes under ui/truss2d/, solver_core/, api_server/, tests/, visualization/.
    - User has approved the spike at human-verify step 6 (the active-state moment is the whole point of the spike).
  </done>
</task>

</tasks>

<verification>
- Diff scope: exactly two files (`ui/frame2d/index.html`, `ui/frame2d/style.css`).
- pytest: 61/61 green.
- Browser UAT (human-verify 1-10 above) passed.
- Scope contract held: zero changes outside the two files; no JS touched; no truss2d touched.
</verification>

<success_criteria>
- One restyled toolbar button visible side-by-side with nine unchanged emoji buttons on the frame2d toolbar.
- New `--spike-*` palette tokens defined at `:root`, inspectable in DevTools.
- New `.tool-btn--spike` modifier class scoped to the single button — additive, deletable without touching anything else.
- Active state delivers Option A: accent on glyph + thin border ring, no full background fill change.
- Member-creation behaviour entirely unchanged.
- User has enough signal to decide: roll the palette out across the toolbar, iterate on glyph/colour, or discard the spike.
</success_criteria>

<output>
After completion, create `.planning/quick/260528-vzl-spike-modernised-add-member-button-in-fr/260528-vzl-SUMMARY.md` summarising what shipped, the single commit hash, the user's UAT verdict, and (if known) the follow-up decision: roll out / iterate / discard.
</output>
