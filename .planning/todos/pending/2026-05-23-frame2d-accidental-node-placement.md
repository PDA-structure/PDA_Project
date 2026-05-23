# Frame2d & Truss2d — accidental node placement on canvas misclick

**Captured:** 2026-05-23 (during 260523-i52 UAT close-out)
**Surfaced by:** Browser UAT iteration on floating-panels work
**Scope:** UX hardening for both frame2d and truss2d node-placement modes

## Problem

Adding-node mode places a node on every canvas click, including accidental ones. If the user clicks the canvas while in node-add mode without intending to, a node appears and they have to undo or delete it manually.

This is high-frequency annoyance during exploratory model building — switching between Add Node mode and other modes carries the cost that any unintended click creates an artefact.

## Suggested directions (not locked — discuss in a future quick task)

1. **Click-and-drag-to-confirm:** require a small drag (e.g. > 3 px) before commit. Single click without drag = no-op. Same pattern that 260523-i52 used to separate "click" from "drag" on the float-panel `<summary>` headers.
2. **Confirmation hover:** mousedown shows a ghost node at the candidate position; mouseup commits ONLY if the cursor hasn't moved off the candidate position by more than a snap-threshold.
3. **Mode auto-exit on Esc / outside-click:** pressing Esc or clicking outside the canvas exits Add Node mode immediately. Reduces the window where misclicks become nodes.
4. **Visual prominence of active mode:** the Add Node button could carry a stronger "active" indicator (border glow, pulsing dot) so the user is constantly reminded that clicks will place nodes.
5. **Single-shot node placement:** clicking places one node, then the mode auto-exits. User has to re-click Add Node for the next placement. Most defensive option; could feel slow for users adding many nodes.

## Files in scope (when this is picked up)

- `ui/frame2d/script.js` — canvas mousedown/click handler for Add Node mode
- `ui/truss2d/script.js` — same pattern; mirror task once frame2d pattern lands

## Related

- 260523-i52 (floating panels) — used a 3 px drag threshold for `<summary>` to separate click-toggle from drag-move. Same idea could apply here.
- 260504-ene + 260515-vhr — mode-entry auto-enable-visibility pattern. This todo is about mode-exit / mode-discipline, complementary.

## Priority

Medium. Not blocking; annoyance-level frustration on misclicks. Pick up in a future session when other higher-priority items clear.
