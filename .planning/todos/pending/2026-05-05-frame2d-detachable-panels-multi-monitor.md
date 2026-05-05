---
created: 2026-05-05T21:55:00.000Z
title: Frame2D detachable panels for multi-monitor workflow (Display + Results)
area: ui
files:
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/frame2d/style.css
---

## Problem

Modern engineers commonly use two or more monitors. The current frame2d UI confines all panels (toolbar cards including Display, plus the Results sidebar) to the same browser window as the canvas. A user with a second screen cannot put the Results table on that screen while keeping the canvas/grid maximised on the primary screen.

Source conversation 2026-05-05 — surfaced after `vhi` Display 2-column split landed. User accepted the current layout as "good for now, better than it was" but explicitly asked to capture multi-monitor detachable panels as a future improvement.

## Solution (TBD — needs discussion phase)

This is a sizable feature, not a quick CSS tweak. It needs `/gsd-discuss-phase` or `/gsd-quick --discuss` to lock decisions before planning. Open questions:

### 1. Implementation approach

- **`window.open()` + BroadcastChannel API** — opens a child popup window for the panel, syncs state via BroadcastChannel (modern browsers, no polyfill). Plain web tech, no new dependencies.
- **`window.open()` + localStorage events** — older fallback; works in Safari which has historically lagged BroadcastChannel.
- **Same-tab "popout" mode** — flexbox restructures the panel into a fixed-position, draggable, resizable floating window the user can drag to a second monitor IF the browser supports cross-screen rendering (Window Management API in modern Chrome). Doesn't require popup permissions but isn't a "real" detachment.
- **Native window via Tauri/Electron wrapper** — out of scope for the web-first stack; defer to v2.0+.

### 2. Which panels are detachable?

- Just Results (sidebar from `v7c`) — primary use case
- Just Display card — secondary (the user's specific reference was "Display + Results")
- Any/all toolbar cards — most flexible, most complex
- Pick one and start small

### 3. State sync semantics

- Drawing on canvas in the main window → results immediately update in the detached window? (Requires post-solve broadcast.)
- Display visibility toggles (chkSupports, chkBMD, etc.) in the detached window → canvas in main window updates? (Requires bi-directional sync.)
- What happens if the detached window is closed mid-session — re-attach to main? Or just lose the detached state?

### 4. Permission UX

- Browsers block popups unless triggered by direct user gesture — a "Pop out Results" button click is fine, but auto-detach on page load isn't.
- How does the user know detachment is possible — prominent UI cue, or hidden in a Display preference?

### 5. Interaction with Phase 999.5 ribbon hierarchy

- The ribbon plan (Phase 999.5) restructures the toolbar entirely. Detachable panels should be designed AFTER ribbon ships — otherwise we'd build detachment for a layout that's about to be replaced.
- Detachable Results sidebar (from v7c) is largely independent of the ribbon — could be done sooner.

## When to revisit

- After Phase 999.5 ribbon hierarchy lands (so we don't design detachment for a deprecated layout)
- OR sooner if user explicitly wants Results detachment as a standalone feature (independent of toolbar refactor)

## Suggested entry point when picking up

`/gsd-quick --discuss "frame2d Results sidebar detachment to second screen"` — surfaces gray areas (BroadcastChannel vs localStorage, popup permission UX, what happens on close) and locks decisions before planning. Plan then becomes a single quick task or small phase depending on scope chosen.
