---
phase: 260503-cf7
plan: 01
subsystem: deployment / dev-infra
tags: [tailscale, serve, fastapi, deploy, dev-infra]
dependency_graph:
  requires:
    - 260503-b57 (FastAPI single-origin: /ui mount + relative API_URL)
  provides:
    - persistent tailnet HTTPS proxy: https://catrins-imac.tail568b7e.ts.net/ -> http://127.0.0.1:8000
    - CLAUDE.md "API server" section runbook for tailscale serve
  affects:
    - CLAUDE.md (only repo file changed)
    - host-level: tailscaled serve config (persists across reboots)
tech_stack:
  added: []
  patterns:
    - tailscale serve --bg (persistent background HTTPS proxy, tailnet-only)
key_files:
  created: []
  modified:
    - CLAUDE.md
decisions:
  - Use `tailscale serve --bg 8000` (registered with tailscaled, persists across reboots) rather than a launchd plist for autostart — leaves uvicorn lifecycle in the user's hands while removing the network boundary
  - Tailnet-only — `tailscale funnel` (public internet) explicitly excluded; documented that way in CLAUDE.md
  - Document the URL pattern `<mac-name>.<tailnet>.ts.net` rather than hard-coding the user's specific hostname; show user's current value as an example only
metrics:
  duration_seconds: 213
  duration_human: "3.5 min"
  completed_date: "2026-05-03"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
  commits: 1
---

# Quick Task 260503-cf7: Configure Tailscale serve to expose FastAPI on the tailnet — Summary

Persistent tailnet HTTPS proxy `https://catrins-imac.tail568b7e.ts.net/` → `http://127.0.0.1:8000` is now registered with tailscaled (survives reboots); CLAUDE.md "API server" section gained a 6-line tailscale serve runbook.

## Persistent State Change (IMPORTANT)

`tailscale serve --bg 8000` is now registered with `tailscaled` and **will survive reboots**. This is a stateful host-level change — it is **NOT** captured in the git repo and **NOT** undone by `git revert`.

- **Inspect:** `tailscale serve status`
- **Undo (tear down all serve config — safe, idempotent):** `tailscale serve reset`
- **Equivalent verbose form of registration:** `tailscale serve --bg --https=443 http://127.0.0.1:8000`

## Working Tailnet URLs (current host)

When uvicorn is running on `127.0.0.1:8000`:
- `https://catrins-imac.tail568b7e.ts.net/health`
- `https://catrins-imac.tail568b7e.ts.net/ui/truss2d/index.html`
- `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html`
- `POST https://catrins-imac.tail568b7e.ts.net/solve/{truss2d,frame2d}` (also reachable, not curl-tested in this task)

## Task Breakdown

### Task 1: Configure tailscale serve --bg 8000 and verify end-to-end through tailnet URL

**Status:** Done.

- Pre-state confirmed: `tailscale serve status` returned "No serve config"; port 8000 free.
- Started uvicorn temporarily (PID 5065) since port 8000 was free.
- Local boot probe: `curl http://127.0.0.1:8000/health` returned `{"status":"ok","solvers":["frame2d","frame_v2","truss2d"]}`.
- Ran `tailscale serve --bg 8000` (exit 0).
- Ran 4 tailnet probes (see Verification Log below) — all passed.
- Stopped uvicorn cleanly; port 8000 released; `/tmp/cf7-uvicorn.log` and `/tmp/cf7-uvicorn.pid` removed.
- The tailscale serve config was deliberately **NOT** torn down — persistence is the goal.

**Commit:** None — host-level config change registered with tailscaled, not a repo artifact.

### Task 2: Append Tailscale runbook to CLAUDE.md "API server" section

**Status:** Done.

- Edited `CLAUDE.md`, anchored on the existing `/health` bullet (line 117). Added 6 lines after it, before the `## UI conventions` heading.
- Documents URL pattern `<mac-name>.<tailnet>.ts.net` with user's current host (`catrins-imac.tail568b7e.ts.net`) as an example.
- Includes start (`tailscale serve --bg 8000`), inspect (`tailscale serve status`), tear-down (`tailscale serve reset`).
- Single mention of `tailscale funnel` is the explicit "intentionally NOT used — tailnet-only" note.
- `git diff CLAUDE.md` confirmed: 6 additions only, all inside the `## API server` section.

**Commit:** `988c1ae` — `docs(260503-cf7): add tailscale serve runbook to CLAUDE.md API server section`

## Verification Log

### `tailscale serve status` after registration (literal output)

```
https://catrins-imac.tail568b7e.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8000
```

### Tailnet curl probes (all passed)

| Probe | Command | Result |
|------|---------|--------|
| 1 | `curl -fsS https://catrins-imac.tail568b7e.ts.net/health` | `{"status":"ok","solvers":["frame2d","frame_v2","truss2d"]}` (both `truss2d` and `frame2d` present) |
| 2 | `curl -fsS -o /dev/null -w "%{http_code}\n" https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html` | `200` |
| 3 | `curl -fsS -o /dev/null -w "%{http_code}\n" https://catrins-imac.tail568b7e.ts.net/ui/truss2d/index.html` | `200` |
| 4 | `curl -fsS https://catrins-imac.tail568b7e.ts.net/ui/frame2d/script.js \| grep -F "API_URL = ''"` | matched: `const API_URL = ''; // relative — UI is served from the same FastAPI process` (confirms b57 single-origin UI is being served via the tailnet proxy) |

### Plan automated checks

- Task 1: `tailscale serve status | grep -F "127.0.0.1:8000"` → `|-- / proxy http://127.0.0.1:8000` (match)
- Task 2: `grep -F "tailscale serve --bg 8000" CLAUDE.md` (match) + `grep -F "tailscale serve reset" CLAUDE.md` (match) + `grep -F "<mac-name>.<tailnet>.ts.net" CLAUDE.md` (match) + only-allowed `tailscale funnel` mention is the explicit "intentionally NOT used" note

### Source-tree integrity

`git status --short` after both tasks showed only:
- `?? .claude/` (untracked by project design — see commit 41e44e7 / STATE.md)
- `?? .planning/quick/260503-cf7-.../` (this task's planning artifacts)

No source/test changes. `pytest` not run (out of scope per plan: "no source changes").

## Files Changed

| File | Change | Commit |
|------|--------|--------|
| `CLAUDE.md` | +6 lines in `## API server` section (Tailscale runbook) | `988c1ae` |

**No** changes to `api_server/`, `ui/`, `solver_core/`, `tests/`, `visualization/`.

## Out of Scope (NOT done — by design)

- **Adding the Windows work laptop to the tailnet** — manual user step (install Tailscale, sign into the same Microsoft account / personal tailnet). Once done, the tailnet URLs in this summary become reachable from that machine.
- **launchd autostart for uvicorn** — uvicorn lifecycle remains user-controlled; `tailscale serve` is the only persistent piece.
- **App-level auth** — tailnet membership is the auth boundary.
- **`tailscale funnel`** — would expose the API to the public internet; explicitly excluded.
- **CORS changes** — `allow_origins=["*"]` is fine over a private tailnet.

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes triggered, no architectural decisions needed.

## Next Step Pointer

User installs Tailscale on the Windows work laptop and signs into the same Microsoft account → the tailnet URLs above become reachable from that machine. To use:

1. On the Mac: start uvicorn (`uvicorn api_server.app:app --host 127.0.0.1 --port 8000` from repo root, or `python api_server/run_server.py`).
2. From the Windows laptop (joined to the same tailnet): browse to `https://catrins-imac.tail568b7e.ts.net/ui/frame2d/index.html` (or `/ui/truss2d/index.html`).

## Self-Check: PASSED

- `CLAUDE.md` exists and contains the tailscale serve runbook (6 new lines): FOUND
- Commit `988c1ae` exists in `git log`: FOUND (`git log --oneline | grep 988c1ae` → `988c1ae docs(260503-cf7): add tailscale serve runbook to CLAUDE.md API server section`)
- `tailscale serve status` shows persistent `/ -> http://127.0.0.1:8000` mapping: FOUND
- No source-tree changes outside `CLAUDE.md`: VERIFIED via `git status --short`
