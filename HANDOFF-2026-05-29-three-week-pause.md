# PDA Three-Project Handoff — 3-Week Pause

**Date:** 2026-05-29
**Resumes:** ~2026-06-19 (approximate)
**Author:** Claude session, captured during quick task 260529-7hw closing

---

## TL;DR — where each project stands

| Project | State | Next strategic move when back |
|---|---|---|
| **pda_project** (this repo, calc/FEM platform) | Phase 7 closed, **Phase 8 ready to enter** | `/gsd-discuss-phase 8` — Revit Tier 2 ExportToPDA hardening |
| **marimo_spike** (~/Documents/handcals/marimo_spike) | Stable, dogfooded; calc-sheet template system just landed | Open NOTES_FOR_CLAUDE.md, decide between calc library expansion vs report layout polish |
| **pda_documents** (~/Documents/pda_documents) | Phase 0 + Phase 1.0-1.3 complete; single-commit fresh repo | **Phase 1.4 — `templates/full_appraisal.docx`** (driven by imminent real-job need from May; verify still imminent) |

All three projects are on `main`, pushed clean, no uncommitted work blocking. You can step away without worrying about losing in-flight state.

---

## 1. pda_project — Structural FEM platform

### Where we are

- **Current focus:** Phase 8 (Revit Tier 2 — Analytical Exporter Hardening)
- **Phase 7 closed 2026-05-06.** 3/3 plans complete (revit-element-to-analytical conversion).
- **Just shipped (last 24h):**
  - Quick task `260528-vzl` — toolbar modernisation across both solver UIs. 39 buttons modernised total (25 frame2d + 14 truss2d). New `--spike-*` palette (charcoal-navy / warm taupe-grey / cream / neon-green active / signal-yellow Solve / burgundy danger) + engineering-glyph SVGs (I-beam, node-dot, fixed-support hatching, pinned triangle, roller, spring zigzag, load-arrow, curved-moment, UDL beam-with-arrows, pin-release open-circles, trash, undo, etc.). UAT approved.
  - Quick task `260529-7hw` — Material Properties self-weight modernisation. ρ (rho) toggle button replaces checkbox; density input gated. Followed by 3 layout fixes for the density label (final layout: "Density" / [7850] / "kg/m³" stacked, value-first engineering-spreadsheet pattern).
  - Debug session `frame2d-bmd-deflected-broken` opened and resolved as **user-error** (stray off-canvas node — captured as feedback memory `feedback_check_stray_offcanvas_node_first` for future sessions).

### Resume command

```
/gsd-discuss-phase 8
```

Then plan + execute per the standard GSD workflow.

### Critical Phase 8 context (re-read before starting)

Per memories:

- **`revit_phase5_export_uses_detail_lines_only`** — Phase 8 must read `AnalyticalMember` directly (`SectionTypeId`, `MaterialId`, `GetCurve()` for endpoints) and emit REAL section/material values into the JSON, NOT the DEFAULT_E/I/A constants used by Phase 5 Tier 1.
- **`revit_steel_analysis_info_inaccuracy`** — add validation against Eurocode/AISC catalogue values for steel sections, with diagnostics for divergence. Revit's steel section/material values are often technically present but practically wrong.
- **`project_revit_version_matrix_2025_forward`** — Revit 2025+ only. Skip ElementId 32-bit compat.
- **`revit_physical_to_analytical_api`** — canonical path is `AnalyticalMember.Create + AddAssociation`. `GenerateMembersFromSelection` does NOT exist.
- **`revit_addassociation_no_propagation`** — must explicitly assign `SectionTypeId + MaterialId` on `AnalyticalMember` after `AddAssociation` (Phase 7 UAT confirmed this gotcha).

Phase 8 is **mostly sibling-repo work** at `~/Documents/CustomRevitExtension/` (HEAD `75b7634`, origin/main in sync). Only additive change in pda_project is a Pydantic `revit_meta: Optional[dict]` passthrough on `Frame2DRequest`.

### Deferred / pending in pda_project

Pending todos in `.planning/todos/pending/` — 11 items, prioritised:

| Todo | Priority | Notes |
|---|---|---|
| `2026-05-23-frame2d-accidental-node-placement.md` | **Highest** (2 UAT incidents now) | Add-Node click-sensitivity. 5 suggested directions: 3 px click-vs-drag threshold, Esc to exit, single-shot placement, viewport guard, off-canvas warning. Recent UAT incident (260528) wasted a debug session — strongly justified |
| `2026-05-29-frame2d-material-vs-section-properties-split.md` | P2 | (a) Apply unit-below-input pattern to E/I/A labels; (b) split Material Properties card into Material (E, ρ) + Section/Geometric (I, A) — engineering convention |
| `2026-05-24-frame2d-global-local-load-coordinate-system.md` | P2 | Recent quick task that surfaced needs |
| `2026-04-22-frame2d-additional-load-and-action-types.md` | P2 | Point/triangular loads, settlement |
| `2026-04-22-frame2d-pure-bar-joint-instability.md` | P2 | Pure-bar joint detection (may already be addressed in Phase 6 PUREBAR-04) |
| `2026-04-22-frame2d-udl-continuous-and-partial.md` | P2 | UDL spanning multiple members |
| `2026-04-22-frame2d-ui-dimension-tool.md` | P2 | On-canvas dimension annotations |
| `2026-04-22-frame2d-ui-member-inspector-and-edit.md` | P2 | Member properties dialog |
| `2026-04-29-threejs-frame2d-3d-viewer.md` | P3 | Per memory `project_3d_ui_threejs_primary` — primary 3D UI strategy |
| `2026-05-05-frame2d-detachable-panels-multi-monitor.md` | P3 | Phase 999.5 prep |
| `2026-05-05-frame2d-panel-ux-cheap-wins-pre-ribbon-and-999-5-prep.md` | P3 | Phase 999.5 prep |
| `2026-04-13-blender-add-on-integration-with-solver-core.md` | P4 | Long-term cross-platform goal |

### Backlog (won't be triggered without explicit decision)

ROADMAP.md has 5 backlog phases (999.1–999.5):

- 999.1 Section Shape Drawing UI
- 999.2 Load Combination Generator — Eurocode + British Standard
- 999.3 Design Solver — Code Checking Against Eurocode / BS
- 999.4 Word Add-in for Calculation Sheets
- 999.5 Frame2D Ribbon Hierarchy UI (scope pivoted 2026-05-06 — see ROADMAP.md)

### What you might want to think about offline

1. **Phase 8 sequencing** — sibling-repo Revit work or pda_project parallel? Phase 8 in pda_project is small (Pydantic passthrough); main work is in CustomRevitExtension. Worth deciding whether you want a discuss-phase covering both repos or to handle each separately.
2. **Accidental-node-placement fix** — strong signal to put this BEFORE Phase 8 work. Two debug-session incidents in 2 weeks. Could land as a quick task in <1 hour.
3. **UI-vs-Revit balance** — pda_project has been heavy on UI modernisation lately. Per memory `project_2d_solver_remote_deployment_priority`, the next strategic move was supposed to be Tailscale-serve to enable Windows-laptop testing before more UI polish. Tailscale serve is already running per CLAUDE.md but real-use signal is the gate.

---

## 2. marimo_spike — Calc platform (Tedds replacement)

**Location:** `~/Documents/handcals/marimo_spike/`
**Public repo:** `PDA-structure/pda-calc-platform-spike`

### Where we are

Per recent commits (last week):

- **Just shipped (commit `f7b4dc5`):** Calc-sheet template system with CSS math rendering — major typography/layout upgrade for printed calc sheets.
- **Major work this month:**
  - Truss design templates landed — tension (EC3 §6.2.3, NEd/Nt,Rd = 0.7285 vs textbook 0.73) + compression (EC3 §6.3.1, NEd/Nb,Rd = 0.7722 vs textbook 0.77). Both validated against textbook examples. Math duplicated between marimo notebooks and PDF renderers per `calc_platform_compositor_architecture` memory (acceptable until 3rd consumer appears).
  - **Revit-style revision system** — C01/C02 letters, Document Control page as Page 1 after cover, revision-box accordion on every calc notebook, 24 commits.
  - **Save/compile UX overhaul** — `report/save.py` helper, load-first guard, `report/compile_ui.py` browser-based compile picker.
  - **Architectural fix** — letterhead-write stripped from calc notebooks; `report/project_meta.py` is now the single writer. Renderer registry + `calcs_order` sequence.

### What's pending

**Planted seeds** (in `.planning/seeds/`):

- `front-matter-and-cover-improvements.md`
- `front-matter-buttons-redesign.md`
- `remote-access-from-work-laptop.md` — Tailscale setup for Windows-laptop testing
- `truss-analysis-export-richness.md`

**No pending todos** — clean state.

### Open questions from the last session-end note

- **"Where is my pdf?" workflow** — user has dropped `state.json` files in `~/Downloads/` but the compile_report.py expects a project folder. Either move state.json into `projects/<job>/` first, or accept the Downloads pattern. Worth deciding.
- **Multi-instance calcs** (200 padstones) need a key-naming convention. Not pressing until you hit it.
- **Calc-engine extraction** — math currently duplicated between marimo notebooks (using forallpeople) and PDF renderers (using plain floats). Refactor when a 3rd consumer appears.
- **calcs_order UI** in `project_meta.py` — currently typed into JSON by hand. UI needed.

### What you might want to think about offline

1. **Calc library expansion priority** — per `NOTES_FOR_CLAUDE.md` 2026-05-12 entry, the next batch user wanted:
   - Loading buildups library (dead roof, dead floor, residential / office / educational / industrial make-ups)
   - Foundation calcs (strip, pad)
   - Masonry check with concentrated loadings + padstone distribution
   - Compile against existing calc packages and validate format
2. **Report layout polish** — per 2026-05-12 entry, "front page and format layout as the output it is as important as the calculation validation"
3. **Loading buildup multiplication symbols** — user wanted `x` or `*` as multiplication for load buildup (2026-05-16 idea note)
4. **iLovePDF-style compositor** — memory `calc_platform_compositor_architecture` already captured this; 4-layer decoupling of per-calc compute from report assembly. `report/page.py` is layer 1 (live). Supersedes SEED-006.

### Resume command

```
cd ~/Documents/handcals/marimo_spike && claude
```

First action when back: read `NOTES_FOR_CLAUDE.md` (mandatory per memory `calc_platform_session_notes_handoff`).

---

## 3. pda_documents — Structural documents automation

**Location:** `~/Documents/pda_documents/`
**Status:** New repo, single commit `a105e13`.

### Where we are

Per `RESUME.md`:

- ✅ **Phase 0 complete** — substrate locked, all 5 open questions answered, 8 reports analysed
- ✅ **Phases 1.0–1.3 complete** — uv + Python 3.12 env, schema, fixed_text.yaml, 4 inspection-type openings, synthetic Property A fixture
- ✅ **Sanitisation pass** — all repo-tracked docs scrubbed (112 substitutions across 3 files)
- ✅ **DRA workstream agreed** — parallel to appraisals
- ⏭️ **Phase 1.4 next** — `templates/full_appraisal.docx`

### Locked decisions (don't relitigate)

| Decision | Choice |
|---|---|
| v1 document type | Appraisal reports (letter + full) |
| Stack | marimo + python-docx + docxtpl + files (NO PySide6, NO SQLAlchemy yet) |
| Storage | Files + frontmatter + JSON sidecars |
| Python env | uv + Python 3.12 |
| Sign-off | Qualifications only, no name, no company |
| Disclaimer (full appraisal) | 7-line bulleted version |
| Background heading (letter) | Always include by default |
| Date canonical format | `13 January 2026` (no ordinal, no day-of-week) |
| Multi-property reports | Single primary + free-text `additional_properties_mentioned` |
| DRA as parallel workstream | Yes — `library/dras/` alongside `library/appraisal/` |

### Imminent real-job context (TIME-CHECK NEEDED)

`RESUME.md` from 2026-05-14 says "User has a real job landing in the next few days". That was **15 days ago**. When you return after 3 weeks (~2026-06-19), that job is either done, in progress, or rescheduled. **Verify status before assuming Phase 1.4 priority still applies.**

### Phase plan (per RESUME.md)

| Phase | Goal | Status |
|---|---|---|
| **0** Foundation | Lock substrate from real examples | ✅ DONE |
| **1.0–1.3** Environment + library substrate | uv setup, schema, canonical text, openings, fixture | ✅ DONE |
| **1.4–1.5** Templates | `templates/letter.docx` and `templates/full_appraisal.docx` | ⏭️ NEXT — full appraisal first |
| **1.6–1.7** Notebooks | `notebooks/01_letter.py` and `notebooks/02_full_appraisal.py` | After 1.4–1.5 |
| **1.8** Real-job use | Use v1 on imminent real job → DRA recommendations woven in | Days away from RESUME.md |
| **2** Clause + defect library | Extract reusables from real use + 8 historical reports | After 1.8 |
| **3** Second doc type | Fee proposals reusing library | Later |
| **4** Retrieval | Embedding index — only when corpus ≥ ~10 docs | Later |
| **5** LLM drafting | RAG against retrieved comparators (BYOK pattern likely) | Much later |

### Resume command

```
cd ~/Documents/pda_documents && claude
```

First action when back: read `HANDOFF.md` then `RESUME.md`. Verify real-job priority is still current.

---

## Cross-cutting decisions / shared context

### The three projects relate as:

```
pda_project          (calc engine + browser UI + Revit pushbutton)
       │
       ├─── shares project metadata schema with ───►  pda_documents
       │     (job_no, address, client, drawings_register)
       │
       └─── will eventually integrate as ───►        marimo_spike
             design_core/checks/ + calc_templates/
             (per memory calc_platform_integration_strategy:
              parallel-build for now, integrate when 3-4 templates
              + real-project use signals)
```

### Memory entries that span projects

Per your `MEMORY.md` index, the following are cross-cutting and worth re-reading before resuming:

- `project_roadmap_vision` — 10-phase roadmap, interchange format strategy
- `calc_platform_integration_strategy` — parallel-build pda_project + marimo_spike; sequencing recommendation (Tailscale → real-project → SEED-005 → expand → report)
- `calc_platform_workflow_vision` — end-to-end workflow (loading→combos→analysis→design→foundations→title→compiled doc); thesis is workflow integration
- `calc_platform_two_ux_modes` — reactive marimo for design exploration; input-form + run-button for one-shot quick checks
- `calc_platform_pedagogical_transparency` — show all class limits and intermediate steps; transparency is the platform's edge over Tedds
- `feedback_check_stray_offcanvas_node_first` (NEW) — for "diagram looks wrong after solve" reports in either solver UI, first ask about stray off-canvas nodes
- `feedback_check_render_toggle_first` — for "click does nothing visible" reports in canvas UIs

---

## Recommended priority order when you return

Assuming nothing changes during the 3-week pause and the real job hasn't shifted things:

### Week 1 back

1. **pda_documents Phase 1.4** — `templates/full_appraisal.docx` IF the real job is still landing (verify first). This blocks revenue-adjacent work.
2. **pda_project accidental-node-placement fix** — quick task, <1 hour, prevents another debug-session loss.
3. **Open NOTES_FOR_CLAUDE.md in marimo_spike** — there may have been pending session-end items you want to pick up.

### Week 2 back

4. **pda_project Phase 8** — Revit Tier 2 ExportToPDA hardening. `/gsd-discuss-phase 8` to start.
5. **marimo_spike calc library expansion** — loading buildups (residential/office/educational/industrial), foundation calcs (strip/pad), masonry/padstone (per 2026-05-12 list).

### Week 3 back

6. **pda_project Material vs Section Properties split** — small UX cleanup todo from 260529-7hw.
7. **marimo_spike report layout polish** — front page + format layout, per 2026-05-12 note.

### When something changes:

- If the real job lands and uses appraisals first → pivot to pda_documents Phase 1.4-1.8 fully.
- If client signals a Revit integration need → pivot to pda_project Phase 8 first.
- If you want a calc-platform-and-pda_project bridge moment → marimo_spike SEED-005 (`from_solver_result`) is the integration seam.

---

## Where to find this document

This file lives at `~/Documents/pda_project/HANDOFF-2026-05-29-three-week-pause.md` and is **untracked by git** (intentional — it's a take-away note, not a permanent project artifact). If you want to keep it around, either git-add it or move it somewhere outside the repo.

Optionally print to PDF for offline reading.

---

## State verification at handoff — DO BEFORE STEPPING AWAY

Verified 2026-05-29:

| Project | Branch | Clean? | Pushed? | Action needed before pause |
|---|---|---|---|---|
| pda_project | main | ✅ clean (only this handoff file untracked) | ✅ up to date with origin/main | None — optionally git-add this handoff doc |
| marimo_spike | (verify branch) | ⚠️ **2 modified files + 7 untracked items** | ❌ **5 commits ahead of origin/main** | **Commit + push before leaving** (see below) |
| pda_documents | (verify branch) | ⚠️ 1 untracked file (`read_this_note.py`) | ⚠️ **No remote configured** | Decide if this repo should have a GitHub remote before stepping away |

### Pre-pause cleanup checklist (do this before you leave)

#### marimo_spike (~/Documents/handcals/marimo_spike)

Uncommitted work that will be there when you return:
- `NOTES_FOR_CLAUDE.md` — **+68 lines** of session notes (probably worth keeping — the file IS the cross-session handoff channel)
- `report/render_calc_pdf.py` — **+115/-19 lines** (significant; review what this is before pause)
- 7 untracked items: `.planning/seeds/remote-access-from-work-laptop.md`, `projects/example/*.state.json` (5 state files), `report/katex/`

Plus **5 unpushed commits** to `origin` (`PDA-structure/pda-calc-platform-spike`):
- `cacb76b` chore: update truss textbook state with clean export image
- `f7b4dc5` feat(report): calc-sheet template system with CSS math rendering
- `4337d4e` session-notes: end-of-session handoff (2026-05-17 15:00)
- `e62c417` plan: bring revision-system todo status up to date
- `ee64fcc` plan: seed truss analysis export richness (visual + tables + feedback)

**Recommended action** (about 15 minutes):

```bash
cd ~/Documents/handcals/marimo_spike
# 1. Review uncommitted changes — decide what's keep-and-commit vs discard
git diff NOTES_FOR_CLAUDE.md
git diff report/render_calc_pdf.py
# 2. Decide on state.json files — these may be in-progress drive-tests
#    or stale; check before committing
ls -la projects/example/*.state.json
# 3. Decide on report/katex/ — likely a KaTeX install for math rendering;
#    might be appropriate to .gitignore OR commit depending on dependency
#    posture
ls report/katex/ | head
# 4. Commit what's keepable + push
# 5. Push the 5 commits already on local main
git push origin main
```

If you don't want to think about this now: at minimum `git push origin main` so the 5 pending commits aren't lost if your local machine dies.

#### pda_documents (~/Documents/pda_documents)

**No git remote configured.** If you want this repo backed up to GitHub during the 3 weeks away:

```bash
cd ~/Documents/pda_documents
# Check current state
git remote -v   # confirms no remote
# Create a remote (private repo recommended given report content)
# Either via gh CLI:
gh repo create PDA-structure/pda-documents --private --source=. --push
# Or manually create on github.com first, then:
# git remote add origin git@github.com:PDA-structure/pda-documents.git
# git push -u origin main
```

Single untracked `read_this_note.py` — probably session-handoff scaffolding; review and either commit or .gitignore.

#### pda_project (this repo)

Optional — git-add this handoff doc if you want it to survive the next clean:

```bash
cd ~/Documents/pda_project
git add HANDOFF-2026-05-29-three-week-pause.md
git commit -m "docs: 3-week pause handoff covering all three PDA projects"
git push origin main
```

Otherwise it'll just sit untracked until something cleans it up.

---

Enjoy the break. When you're back: this file, then `STATE.md` in each repo, in that order.
