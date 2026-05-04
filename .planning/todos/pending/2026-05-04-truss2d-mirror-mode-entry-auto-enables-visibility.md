---
created: 2026-05-04
priority: P3
source: quick-260504-ene
files_likely_affected:
  - ui/truss2d/script.js
---

# Mirror mode-entry-auto-enables-visibility fix to truss2d

Quick task 260504-ene fixed the frame2d UI's silent-feedback bug: clicks in support / load modes did nothing visible because the matching visibility checkbox (`chkSupports` / `chkLoads`) was unchecked. The fix lives in `ui/frame2d/script.js` `setMode()`.

`ui/truss2d/script.js` has the same anti-pattern. It was deliberately scoped out of 260504-ene because the user wanted a single small edit landed first. Repro path is the same shape: with `chkSupports` unchecked, click "Pin" / "Roller" → support is added to `supports[]` but no glyph appears.

## Fix shape (mirror of 260504-ene)

In `ui/truss2d/script.js`, locate `setMode(m)`. After the existing body, add:

```js
const SUPPORT_MODES = new Set([...truss2d support mode strings...]);
const LOAD_MODES    = new Set([...truss2d load mode strings...]);
if (SUPPORT_MODES.has(m)) {
  document.getElementById('chkSupports').checked = true;
} else if (LOAD_MODES.has(m)) {
  document.getElementById('chkLoads').checked = true;
}
draw();
```

The exact mode-string membership for truss2d differs (no spring, no UDL, no moment). Read the truss2d `MODE_LABELS` table and `data-mode` attributes in `ui/truss2d/index.html` first to enumerate them.

## Verification (manual UAT)

- Uncheck `chkSupports`, click a support button → checkbox auto-ticks; previously-added supports appear.
- Uncheck `chkLoads`, click a load button → checkbox auto-ticks; previously-added loads appear.

## Why P3

The frame2d fix is the primary user-facing remedy. truss2d has the same latent bug but the user is currently working in frame2d; convergence between the two UIs should happen on the next truss2d touch.
