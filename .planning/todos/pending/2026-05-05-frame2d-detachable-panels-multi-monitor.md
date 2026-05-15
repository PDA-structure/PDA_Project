---
created: 2026-05-05T21:55:00.000Z
updated: 2026-05-15
title: Frame2D detachable surfaces for multi-monitor workflow (panels OR canvas)
area: ui
files:
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/frame2d/style.css
---

## Problem

Modern engineers commonly use two or more monitors. The current frame2d UI confines everything — the canvas, the toolbar cards (including Display), and the Results sidebar — to a single browser window. Two workflow needs surface from this:

**Direction A — Panels-out, canvas stays primary.** User puts Results (and optionally Display) on a second screen, keeps the canvas maximised on the primary screen. Original 2026-05-05 ask, surfaced after `vhi` Display 2-column split landed.

**Direction B — Canvas-out, panels stay primary.** User keeps the toolbar + Results + Display on the primary monitor and drags the canvas/grid viewport to a second screen for more drawing real estate. Surfaced 2026-05-15 conversation about "make the grid/canvas section moveable".

Both directions share the same infrastructure (`window.open()` + cross-window state sync); the user-facing difference is which surface gets a "pop out" button. Treat as one piece of work with two configurations, not two separate todos.

Source conversations: 2026-05-05 (Direction A — after `vhi` Display 2-column split landed; user accepted the current layout as "good for now, better than it was" and explicitly asked to capture detachable panels); 2026-05-15 (Direction B — user asked how hard a moveable canvas/grid section would be).

## Solution (TBD — needs discussion phase)

This is a sizable feature, not a quick CSS tweak. It needs `/gsd-discuss-phase` or `/gsd-quick --discuss` to lock decisions before planning. Open questions:

### 1. Implementation approach

- **`window.open()` + BroadcastChannel API** — opens a child popup window for the panel, syncs state via BroadcastChannel (modern browsers, no polyfill). Plain web tech, no new dependencies.
- **`window.open()` + localStorage events** — older fallback; works in Safari which has historically lagged BroadcastChannel.
- **Same-tab "popout" mode** — flexbox restructures the panel into a fixed-position, draggable, resizable floating window the user can drag to a second monitor IF the browser supports cross-screen rendering (Window Management API in modern Chrome). Doesn't require popup permissions but isn't a "real" detachment.
- **Native window via Tauri/Electron wrapper** — out of scope for the web-first stack; defer to v2.0+.

### 2. Which surface is detachable? (covers both directions)

**Direction A — panels-out:**
- Just Results (sidebar from `v7c`) — primary Direction A use case
- Just Display card — secondary (the original 2026-05-05 reference was "Display + Results")
- Any/all toolbar cards — most flexible, most complex

**Direction B — canvas-out:**
- The `<canvas>` element + its overlay glyphs + the click/drag/zoom/pan handlers move to a child window
- Toolbar + Results stay in the main window; main window shows a placeholder ("Canvas detached →") with a "Reattach" button
- Click-to-add-node, member draw, support placement, load placement all need to fire from the detached window's canvas, which means the canvas's full event-listener stack relocates with it

**Decision:** pick ONE direction to ship first (Direction A is the smaller scope — the panels are pure-output surfaces and don't need to relocate event listeners for canvas drawing). Direction B can land afterwards reusing the same `window.open()` + sync plumbing.

### 3. State sync semantics

**Direction A (panels-out):**
- Drawing on canvas in the main window → results immediately update in the detached Results window. (Requires post-solve broadcast main → detached.)
- Display visibility toggles (chkSupports, chkBMD, etc.) in the detached Display window → canvas in main window updates. (Requires bi-directional sync.)

**Direction B (canvas-out):**
- Click-to-add-node / draw-member / place-support / place-load happen in the detached canvas window → state mutations broadcast back to main, where the toolbar buttons + Results react.
- Mode changes via toolbar buttons in main (Add Node, Pin, etc.) → detached canvas updates its `mode` variable, click handler dispatches accordingly. (Bi-directional, but the heavy data flow is *detached → main* this time.)
- Solve triggered from main's SOLVE button → request goes to API, response broadcast to detached canvas (so it can draw deflected shape, BMD, SFD overlays).

**Shared across both directions:**
- What happens if the detached window is closed mid-session — re-attach to main? Or just lose the detached state? (Recommendation: re-attach automatically on `unload`, preserve all state; user re-pops-out on demand.)
- What happens if the user reloads the main window with a detached child open — child window orphaned, force-close? (Recommendation: BroadcastChannel heartbeat, child auto-closes on missed beats.)

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

`/gsd-quick --discuss "frame2d detachable surface(s) — choose direction + ship first variant"` — surfaces gray areas (Direction A vs B, BroadcastChannel vs localStorage, which surface ships first, popup permission UX, what happens on close, heartbeat/orphan handling) and locks decisions before planning.

**Recommended sequencing once discussion runs:**
1. Ship Direction A — Results detachment (smallest scope, pure-output surface, no event-listener relocation).
2. Add Direction A — Display panel detachment (same plumbing, second consumer).
3. Ship Direction B — canvas detachment (reuses sync plumbing but has to relocate the click/drag handler stack).

Each ships as its own quick task. Step 1's plumbing should be designed to support steps 2+3 without rewrites (broadcast bus, state-shape contract, reattach handshake).
