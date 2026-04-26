---
status: resolved
trigger: "truss2d UI rejects JSON from new ExportToPDA_Truss pyRevit pushbutton with alert: 'This file is for the frame2d solver and cannot be loaded here.'"
created: 2026-04-24
updated: 2026-04-24
resolved: 2026-04-24
slug: truss-json-solver-mismatch
---

# Debug: Truss JSON solver mismatch

## Symptoms

- **Expected:** truss2d browser UI loads the JSON produced by the new `ExportToPDA_Truss` pushbutton (commit 95d6748 in sibling CustomRevitExtension repo) and renders nodes/members.
- **Actual:** UI shows alert "This file is for the frame2d solver and cannot be loaded here." and refuses to load.
- **Error:** Alert triggered at `ui/truss2d/script.js:827–828` where `data.solver !== 'truss2d'`.
- **Timeline:** First-ever HUMAN-UAT attempt of the truss pushbutton (quick task 260423-a0q Task 2). The frame2d exporter / frame2d UI round-trip was verified in Phase 5.
- **Reproduction:**
  1. In Revit, click the `ExportToPDA_Truss` pushbutton.
  2. Save the emitted JSON (user saved as `~/Downloads/Drafting_1_pda.json`).
  3. Open `ui/truss2d/index.html` and attempt to load the JSON.
  4. Alert fires, load aborted.

## Current Focus

- **hypothesis:** CONFIRMED — the deployed pyRevit bundle on the Revit host machine is running the *frame* exporter code when the user clicks the truss pushbutton. The committed truss `script.py` (commit 95d6748) has never been deployed/reloaded on the Revit-host machine.
- **test:** Compare the rejected JSON against both committed scripts byte-level to determine which script produced it.
- **expecting:** Rejected JSON should match frame exporter shape exactly and differ from truss exporter shape on schema-shaping fields.
- **next_action:** User action required on Windows Revit host (re-sync + pyRevit reload, then re-test).
- **reasoning_checkpoint:**
- **tdd_checkpoint:**

## Evidence

- timestamp: 2026-04-24 — Read `/Users/catrinevans/Downloads/Drafting_1_pda.json` (the rejected file). Confirmed:
  - Line 139: `"solver": "frame2d"` — UI gate rejects on this field.
  - Line 846–883: `forceVector` contains **36 zeros** for 12 nodes → 3 DOF/node → frame-shaped, not truss (would be 24).
  - Lines 578–683: `ENMoments` present (26 pairs, frame-only field per CLAUDE.md).
  - Lines 739–844: `ENForces` present (26 pairs, frame-only field).
  - Lines 108, 110, 684, 737, 738: `beamPinRight`, `bars`, `beamPinLeft`, `restrainedDoF`, `springStiffness` all present as empty arrays (frame-shaped schema).
  - Canvas member type: `"type": "beam"` (frame field; truss wouldn't emit this).
  - Conclusion: the rejected file is a **complete frame2d payload**, not a truss2d payload with a wrong tag.
- timestamp: 2026-04-24 — Grepped `ExportToPDA_Truss.pushbutton/script.py` in the CustomRevitExtension git repo (HEAD=95d6748): line 378 is `"solver": "truss2d",` — the only `solver:` assignment. No frame2d code paths found. Suggests the deployed runtime is NOT executing this file.
- timestamp: 2026-04-24 — User confirmed (via AskUserQuestion) they clicked `ExportToPDA_Truss` in Revit, not the frame exporter. First-ever UAT attempt — no prior successful runs to regression-compare against.
- timestamp: 2026-04-24 — Inspected both `ExportToPDA_Truss.pushbutton/` and `ExportToPDA.pushbutton/` bundle directories. Both contain only `bundle.yaml`, `icon.png`, `script.py`. Neither `bundle.yaml` contains a `script:` override directive — pyRevit will load the default `script.py` in each folder. Bundle wiring is correct on the source-of-truth repo.
- timestamp: 2026-04-24 — Compared schema-shaping fields:
  - Frame script (`ExportToPDA.pushbutton/script.py`) emits: `"solver": "frame2d"`, `forceVector = [0]*(n_nodes*3)`, `ENForces`, `ENMoments`, `bars`, `beamPinLeft`, `beamPinRight`, `springStiffness`, canvas member `"type": "beam"`.
  - Truss script (`ExportToPDA_Truss.pushbutton/script.py`) emits: `"solver": "truss2d"`, `forceVector = [0]*(n_nodes*2)`, `restrainedDoF`, canvas member `{start, end}` only (no `type`).
  - The rejected JSON matches the frame script output **byte-for-byte in shape**: 3-DOF forceVector, ENForces+ENMoments present, bars/beamPinLeft/beamPinRight/springStiffness keys present, canvas members carry `"type": "beam"`.
  - Conclusion: the code that produced `Drafting_1_pda.json` is the frame exporter. The truss bundle's `script.py` was NOT executed.
- timestamp: 2026-04-24 — Git history for truss pushbutton in CustomRevitExtension: single commit `95d6748` authored 2026-04-23. No local uncommitted edits. The file on disk at `/Users/catrinevans/Documents/CustomRevitExtension/.../ExportToPDA_Truss.pushbutton/script.py` is 469 lines, matches committed head.
- timestamp: 2026-04-24 — Clarification: Windows Revit host pulls pushbuttons via **manual folder copy**, not a git clone. The new `ExportToPDA_Truss.pushbutton/` folder had never been copied across — the ribbon button clicked on Windows was actually the `ExportToPDA` (frame) button, which also explains the frame-shaped JSON output.
- timestamp: 2026-04-24 — User downloaded `script.py`, `bundle.yaml`, `icon.png` from GitHub `PDA-structure/CustomRevitExtension@95d6748` via `raw.githubusercontent.com` URLs, placed them in the Windows `...\col1.stack\ExportToPDA_Truss.pushbutton\` folder, and reloaded pyRevit. Re-exported and loaded into `ui/truss2d/index.html` — **UI accepted the JSON (no alert, model loaded).** HUMAN-UAT Task 2 of quick-task 260423-a0q passed.

## Eliminated

- hypothesis: User accidentally clicked the frame pushbutton instead of the truss one
  reason: User explicitly confirmed clicking `ExportToPDA_Truss`. (Still possible the ribbon shows two near-identical buttons and the click landed wrong — keep as fallback if bundle inspection comes up clean.)

- hypothesis: The UI's solver gate is over-zealous and rejecting a valid truss payload
  reason: The rejected JSON is shape-equivalent to frame2d (3 DOF/node forceVector, ENMoments present). The UI is correctly rejecting a frame-shaped file.

- hypothesis: bundle.yaml mis-wires script path (e.g. points at the frame script)
  reason: Inspected both `bundle.yaml` files. Neither contains a `script:` override directive. pyRevit's default is `script.py` in the same folder. Bundle wiring is correct.

- hypothesis: The committed truss `script.py` has a latent bug that emits frame-shaped JSON
  reason: Truss script line 378 hardcodes `"solver": "truss2d"`, line 385 emits `"forceVector": [0] * (n_nodes * 2)` (2 DOF), and does not emit `ENForces`/`ENMoments`/`bars`/`beamPinLeft/Right`/`springStiffness`. The only way its output can look like the rejected JSON is if the file was never executed.

## Resolution

- **root_cause:** The Revit-host (Windows) machine is running the frame exporter's `script.py` when the user clicks the `ExportToPDA_Truss` pushbutton. This is a deploy/sync failure, not a code bug. The committed truss script (commit 95d6748) is correct and emits valid truss2d JSON; but that script is not present (or is stale / shadowed) in the pyRevit-loaded extension folder on the Revit host. Likely sub-causes: (a) user pulled commit 95d6748 on Mac but the Windows host is on an older checkout of CustomRevitExtension; (b) pyRevit was not reloaded after pull, so the ribbon still reflects the pre-truss-button state and the clicked button routes to the frame script; (c) the Windows pyRevit extension folder is a one-shot filesystem copy (not a live git clone) that was never re-synced; (d) the `ExportToPDA_Truss` ribbon button on the Windows host was manually duplicated from the frame button and its bundle folder content was never replaced.
- **fix (APPLIED 2026-04-24):** User downloaded the three files (`script.py`, `bundle.yaml`, `icon.png`) from GitHub `PDA-structure/CustomRevitExtension@95d6748` via `raw.githubusercontent.com` URLs, placed them in the Windows `...\col1.stack\ExportToPDA_Truss.pushbutton\` folder (which previously did not exist on that host), and reloaded pyRevit. Truss pushbutton now emits truss2d-shaped JSON and the truss2d UI accepts the load. Original recommended steps below preserved for reference:
  1. On the Windows Revit host, verify the `CustomRevitExtension` checkout is at commit `95d6748` or later (`git log -1 --oneline`). If not, `git pull` (or re-copy) so that `...ExportToPDA_Truss.pushbutton/script.py` exists and matches the Mac-side file byte-for-byte.
  2. Confirm `...ExportToPDA_Truss.pushbutton/script.py` line 378 reads `"solver": "truss2d",` on the Windows host specifically.
  3. In Revit, run pyRevit → Reload (pyRevit tab → ⚙ → Reload) to force bundle re-discovery and clear any IronPython bytecode cache.
  4. Re-run the Truss export on the same drafting view and re-open the emitted JSON in `ui/truss2d/index.html`.
  5. If step 4 still produces `"solver": "frame2d"`, diagnostic: add a one-line `print("TRUSS BUTTON RAN", __file__)` at the top of the Windows-side `ExportToPDA_Truss.pushbutton/script.py`, click the ribbon button, and check the pyRevit output window. If the print does not appear, the ribbon button on that host is wired to a different `script.py` — inspect the pyRevit Extensions folder (`%APPDATA%\pyRevit\Extensions\` or the custom path configured in pyRevit settings) to find which folder Revit is actually loading and whether it matches the git checkout.
- **verification:** After remediation, emitted JSON should satisfy: `data.solver === "truss2d"`, `forceVector.length === nodes.length * 2`, and should NOT contain keys `ENForces`, `ENMoments`, `bars`, `beamPinLeft`, `beamPinRight`, `springStiffness`. The truss2d UI (`ui/truss2d/index.html`) must load it without alert and render the nodes/members.
- **files_changed:** None. No code change required in `pda_project` or `CustomRevitExtension`. The committed artifacts are correct; only the Windows-host deployment is stale.
