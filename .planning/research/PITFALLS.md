# Domain Pitfalls

**Domain:** PDA v1.3 — Revit Tier 2 + Results-Import + Grillage Solver
**Researched:** 2026-04-26
**Scope:** Pitfalls specific to *adding these three features to this specific codebase*. Generic FEM / generic Revit advice is excluded — the project has shipped 61 tests and a snapshot regression gate, so the pitfalls below assume that maturity. Where a pitfall is already mitigated by an existing safety net (snapshot gate, adapter-layer validation, structured 422), the pitfall section says so explicitly.

> **Supersedes** the 2026-04-05 PITFALLS.md (which targeted the 3D-truss extension scope). v1.3 has a different surface area: Revit cross-version drift, results round-trip durability, grillage DOF semantics. The earlier 3D pitfalls are deferred to v1.4+.

---

## Critical Pitfalls

> A pitfall is *critical* when it would cause one of:
> (a) silently wrong solver output that passes existing tests,
> (b) a roundtrip that loses identity between Revit elements and JSON ids (corrupting Results-Import forever),
> (c) a Revit API call that crashes only on one of 2023/24/25 — only discovered when an engineer in the field hits it.

### Pitfall C1: ElementId.IntegerValue silently truncates on Revit 2024+

**What goes wrong:** The existing `pyrevit_exporters/export_to_pda.py` uses no element ids today (it only emits geometry). Tier 2 hardening + Results-Import *must* emit a stable per-member id. The natural choice — `member.Id.IntegerValue` — was deprecated in Revit 2024 and **throws an `OverflowException` on element ids > 2^31** in workshared / large models. The 64-bit replacement is `member.Id.Value`, which does not exist on Revit 2023.

**Why it happens:** Revit 2024 switched ElementId from Int32 to Int64. Cloud-collaboration models and long-lived projects routinely cross the 2^31 boundary. A pyRevit script that compiles fine and works on small test models will throw at a customer site.

**Consequences:**
- Tier 2 export crashes mid-export on a real project — partial JSON written, engineer loses confidence.
- Results-Import lookup `doc.GetElement(ElementId(int(json_id)))` likewise throws on 2024+.
- IronPython hides the type mismatch until runtime: `ElementId(int(...))` succeeds in Revit 2023 with int32, fails in 2024 because the constructor expects `System.Int64`.

**Prevention:**
- Use a version-aware adapter at the Revit boundary, NOT inline calls. Centralise in one helper module in `PDA_customRevit.extension/`:
  ```python
  # eid_compat.py — pyRevit, IronPython 2.7
  import clr; clr.AddReference("System")
  from System import Int64
  from Autodesk.Revit.DB import ElementId

  def get_eid_value(elem_id):
      """Return the long integer value of an ElementId, version-safe."""
      v = getattr(elem_id, "Value", None)  # Revit 2024+
      if v is not None:
          return long(v) if 'long' in dir(__builtins__) else int(v)
      return int(elem_id.IntegerValue)     # Revit 2023

  def make_eid(int_value):
      """Construct an ElementId from a JSON integer, version-safe."""
      try:
          return ElementId(Int64(int_value))   # Revit 2024+
      except Exception:
          return ElementId(int(int_value))     # Revit 2023
  ```
- JSON schema: store ids as JSON numbers but document that they are 64-bit. JavaScript `Number` is 53-bit safe — for Revit ids near `2^53` (extremely unlikely but possible), serialise as **string** in JSON, not number. Use string form unconditionally for forward safety; round-trip through `int()` in pyRevit.

**Detection:**
- Pre-flight test: at extension load time, log the host Revit version and probe whether `ElementId(0).Value` exists. Wrap actual call sites with the helper.
- Add a UAT fixture **with a synthetic high-id model** (workshared with many element creates/deletes pushes ids past 2^31). Without it, this bug only surfaces in the field.

**Phase ownership:** REVIT-T2-01 (must include this helper from day one — Results-Import depends on it). UAT fixture: REVIT-T2-07.

**Confidence:** HIGH. Documented Revit 2024 breaking change; pyRevit issue #1796 confirms; Building Coder post documents the 64-bit transition.

---

### Pitfall C2: Tier 2 export emitting unstable ids breaks Results-Import permanently

**What goes wrong:** The cross-feature integration risk in this milestone. Three failure modes compound:

1. **Export emits `IntegerValue` only.** Roundtrip works in-session but ids are not stable across Revit save/reopen for elements created via element groups, copy/paste, or worksharing reload.
2. **Export emits Revit ElementId as the JSON `member.id`.** When the model is edited (member deleted + redrawn), the new member has a *different* ElementId. Results-Import maps yesterday's solve onto the wrong element — silently. Engineer sees a beam annotated with a column's moment.
3. **Export emits 1-based array index as id.** Stable across the same export, but reorder-sensitive: any sort change in the iterator (Revit's `FilteredElementCollector` order is *not contractually stable*) breaks roundtrip.

**Why it happens:** The natural-feeling choice (use ElementId) is wrong because ElementIds are session-stable but not edit-stable. The tempting alternative (use array index) is export-stable but not edit-stable either.

**Consequences:** Results-Import that *appears* to work for the developer roundtrip-test, then silently mis-attributes results in production. This is the worst kind of bug — passes the "manual UAT round-trip" smoke test, fails on real workflows.

**Prevention:**
- **Emit a tuple key** in the JSON, not a single id. Each member gets:
  ```json
  {"id": <array_index>, "revit_eid": "<int64-as-string>", "revit_uid": "<UniqueId>"}
  ```
- `UniqueId` is a GUID-formatted string that **survives save/reopen and round-trips through copy** in Revit. It's the right key for "find this element again." `ElementId` is fast; `UniqueId` is durable. Use both: `ElementId` first (fast lookup via `doc.GetElement(id)`), fall back to `UniqueId` lookup (`doc.GetElement(uid)`) if the eid lookup returns null or a wrong-type element.
- Results-Import resolution order: `revit_uid` → `revit_eid` → fail with a structured error listing which JSON ids could not be resolved (mirroring the `offending_members` pattern from v1.2 D-13).
- **Order T2 export before Results-Import in the milestone.** Results-Import depends on the schema T2 emits — if the order flips, you lock in `revit_eid`-only and discover the durability gap mid-import phase.

**Detection:**
- Test fixture: export a model, save+reopen Revit, re-run export, diff the two JSONs. `revit_eid` may or may not match (acceptable). `revit_uid` must match for unedited members.
- Test fixture: export, delete one member, redraw it at the same coordinates, re-export. Old JSON's id no longer resolves to the new element — Results-Import must surface this as an "orphaned annotation" error, not silently drop or mis-attach.

**Phase ownership:** REVIT-T2-02 (schema decision). Results-Import phase depends on this — block it from starting until T2 emits the dual-key shape.

**Confidence:** HIGH for the UniqueId behaviour (Revit API documented). MEDIUM for the recommendation to dual-key — the alternative is to make the user's round-trip workflow constrained ("don't edit between export and import"), which is not a viable UX.

---

### Pitfall C3: Inheriting frame_v2 ENMoment sign convention into grillage

**What goes wrong:** The frame_v2 codebase has an established convention:
- 3 DOF/node = (Ux, Uy, θ) where θ is in-plane rotation about the *out-of-plane* z-axis.
- UDL on a beam: positive = downward (in-plane). ENMoments at member ends = `[wL²/12, -wL²/12]` (per `apply_equivalent_nodal_actions` in `frame_v2.py:393–415`).
- Hermite slope correction: `dy/dx = -solver_theta` (PROJECT.md, "Hermite theta sign").

A grillage element has 3 DOF/node = (Uz, θx, θy) where:
- Uz is out-of-plane vertical displacement.
- θx, θy are rotations *about in-plane axes*.
- A grillage UDL drives bending about the member's transverse local axis AND torsion about the member's longitudinal axis.

The frame ENMoment formula `[wL²/12, -wL²/12]` is for **in-plane bending of an in-plane beam under in-plane UDL**. Reusing it for grillage substitutes the wrong moment convention and the wrong axis.

**Why it happens:**
1. The grillage adapter copies from `FrameV2Adapter` because the layered architecture encourages it.
2. The new `GrillageModel.ENMoments` field has the same name and shape as `FrameModel2D.ENMoments`, so the calling code looks identical.
3. Existing tests (TRUST-13..17) all pass — they're frame tests, not grillage tests.
4. The snapshot gate enforces no drift in *existing* fixtures, but says nothing about new-fixture correctness.

**Consequences:** Grillage solver appears to work — symmetric loads give symmetric reactions, sums to zero, runs without error — but member moments and torsion are systematically wrong. This is exactly the "passes equilibrium check, fails analytical check" failure mode that v1.0 lessons (RETROSPECTIVE.md) flag as the highest-leverage bug class.

**Prevention:**
- **Do NOT reuse `frame_v2.py` as a copy-paste base.** Write `grillage.py` from a fresh derivation of the 6×6 grillage element stiffness matrix. The element local DOF order is `[Uz_i, θx_i, θy_i, Uz_j, θx_j, θy_j]` — different from frame's `[Ux_i, Uy_i, θ_i, Ux_j, Uy_j, θ_j]`. The local stiffness has **EI for bending about θy and GJ for torsion about θx** (different axis assignments per convention — pick one and write it down).
- **Hand-derive ENA for a single test case before any code.** The first test must be a propped cantilever with a single transverse UDL where the closed-form moments AND torsion are known. Snapshot it as TRUST-GRILL-01 and check by hand, not by re-running the solver.
- **Document the sign convention in the grillage solver docstring**, exactly as `frame_v2` does. State: which axis is θx vs θy, which sign is positive Uz (up or down), whether GJ contributes to which DOF, and how a positive UDL maps to ENForces / ENTorsions.
- **Equilibrium check pattern (carry over from v1.0):** for grillage, the meaningful check is `sum(reaction Uz) + sum(applied Uz loads) = 0` AND `sum(reaction θx) + sum(applied torsions) = 0` AND `sum(reaction θy) + sum(applied moments) = 0` — three equilibrium equations, not one. `sum(FG) == 0` is true by construction and meaningless (same lesson as v1.0 patterns).

**Detection:**
- Three-equation equilibrium assertion on every grillage test.
- At least one analytical case where bending and torsion are both non-zero (e.g. eccentrically-loaded simply-supported grillage edge member). Pure-bending and pure-torsion cases pass even if the cross-coupling sign is wrong.

**Phase ownership:** Grillage phase plan 1. Snapshot baseline must capture grillage tests **BEFORE** the solver edit (D-16 pattern carried over from v1.2).

**Confidence:** HIGH. This is exactly the "θ DOF provenance" risk from MEMORY.md (`solver_theta_dof_provenance.md`) generalised to a different DOF set.

---

### Pitfall C4: Pure-bar joint detection silently mis-fires on grillage

**What goes wrong:** v1.2 added `_pure_bar_theta_dofs` auto-restraint to `frame_v2`. The pattern is: "if every incident member is a bar, this joint has no rotational DOF that can be physically constrained — restrain θ." The predicate is mechanically correct for **frames**.

For grillage: a "pure-bar" concept doesn't translate. Every grillage element must support both bending and torsion — there's no axial-only grillage element. But the grillage adapter, copied from `FrameV2Adapter`, may import the predicate machinery. If the predicate evaluates to "all members at this joint have axial-only contribution" because of a different code path (e.g. zero GJ), it will auto-restrain θx or θy that the user actually wanted to leave free.

**Why it happens:** The pure-bar auto-restraint feature is documented as a **structural invariant** (D-01), but the invariant is frame-specific. If a developer reads `frame_v2.py` and copies the assemble method, they'll port the predicate, not the *reason* for the predicate.

**Consequences:** Grillage with a continuous member through an interior joint, no rotational support — solver auto-restrains the rotation, computed deflections are too small, computed reactions are wrong. Shows up as "this grillage feels too stiff" — much harder to spot than a NaN.

**Prevention:**
- Grillage solver does NOT inherit `_pure_bar_theta_dofs` machinery. The class hierarchy is intentionally flat (siblings, not parent/child) per the project's existing architecture (Truss2D and Frame_v2 are sibling solvers, not subclasses).
- Document explicitly in the grillage solver docstring: "There is no analogue of `_pure_bar_theta_dofs` in this solver. Every joint has well-defined Uz, θx, θy reactions if at least one member is incident."
- If a future grillage feature wants a similar auto-restraint (e.g. "pure-axial member" — though this is rare in grillage), it must be re-derived for grillage's DOFs and have its own predicate name.

**Detection:**
- Test: grillage with 2 collinear members meeting at an unsupported interior joint, transverse UDL on both. The interior θy and θx must be **non-zero in the solution** (continuous slope, no rigid hinge). If they come out zero, auto-restraint has crept in.

**Phase ownership:** Grillage phase plan 1 — explicit "no pure-bar machinery" comment in the new solver. Plan 2 — analytical test that would fail if auto-restraint crept in.

**Confidence:** HIGH. The risk is structural; the prevention is "do the obvious thing, but write it down so the next dev doesn't undo it."

---

## Moderate Pitfalls

### Pitfall M1: View-plane projection invoked on non-projection views

**What goes wrong:** Tier 2 spec says "project 3D analytical curves onto the active view's plane — but only if the view is plan/elevation/section." The active view in Revit can be any of: `View3D`, `ViewPlan`, `ViewSection`, `ViewSchedule`, `ViewDrafting`, sheet, legend, etc. Calling `view.SketchPlane` or `view.ViewDirection` on the wrong type either returns null or throws.

**Prevention:** Mirror the v1.2 Tier 1 view-type guard pattern (REVIT-T1-02 — `ExportToPDA` already has this). Whitelist of allowed `ViewType`: `FloorPlan`, `CeilingPlan`, `EngineeringPlan`, `Elevation`, `Section`, `AreaPlan`, `StructuralPlan`. If active view is anything else → forms.alert + early exit, do NOT silently fall back to "no projection."

**Detection:** Test case for each disallowed view type — confirm the export refuses with a clear error message, not a half-projected output.

**Phase ownership:** REVIT-T2-03.

**Confidence:** HIGH. Pattern already proven in v1.2.

---

### Pitfall M2: Family parameter scope variability swallows E/I/A silently

**What goes wrong:** As noted in the milestone context, E/I/A may be on the type, the family symbol, a section parameter, or absent. A naive `member.LookupParameter("E").AsDouble()` returns 0 (zero, not None) when the parameter is missing, and crashes with NullReferenceException when the parameter object is None. Zero E means zero stiffness, which means singular matrix or wildly wrong displacements — both visible failure modes, but "0.0" might also pass through to a downstream "use default" assumption and never surface.

**Prevention:**
- Multi-source parameter lookup helper:
  ```python
  def get_section_property(member, name, doc):
      """Try instance → type → symbol → section in order. Return (value, source) or (None, None)."""
      candidates = [
          ("instance", member),
          ("type",     doc.GetElement(member.GetTypeId())),
          # extend with symbol + section as needed
      ]
      for source_name, source in candidates:
          if source is None:
              continue
          p = source.LookupParameter(name)
          if p is None or not p.HasValue:
              continue
          v = p.AsDouble()
          if v == 0.0:
              continue   # treat 0 as "missing" — see C2/M2 rationale
          return v, source_name
      return None, None
  ```
- If the helper returns `None`: emit the JSON with the project default (200e9 / 1e-4 / 0.01 — same as Tier 1 today) AND record the source-of-truth in a per-member `meta.E_source = "default"` field. The Results-Import button can show "13 members used default E because no parameter was found" so the engineer knows to fix the family.
- Reject `0.0` as if it were missing — defensive against the silent-zero failure mode.

**Detection:** Test fixture with three families: (a) E on type, (b) E on instance, (c) E missing. All three round-trip. Defaults are flagged in the JSON, not silently substituted.

**Phase ownership:** REVIT-T2-04.

**Confidence:** MEDIUM. The lookup pattern is standard. The "where in the family hierarchy is E stored" question is genuinely model-dependent and the four-source fallback may not be exhaustive. Adding `meta.E_source` is the right hedge — it makes the unknown visible rather than hiding it.

---

### Pitfall M3: Transaction boundaries for Results-Import write-back

**What goes wrong:** Results-Import is a Revit-write operation: it sets parameters on AnalyticalMember elements (e.g. `pda_max_moment`, `pda_axial_force`). Three transaction failure modes:

1. **No transaction wrapper** — direct `param.Set()` outside a transaction throws `Autodesk.Revit.Exceptions.InvalidOperationException`.
2. **Read-only parameter** — built-in parameters like `STRUCTURAL_NUMBER_OF_STUDS` are read-only via API even though writable in the UI. A `param.Set()` call swallowed inside `pyrevit.revit.Transaction(swallow_errors=True)` (the pyRevit default for some patterns) yields a "success" message; nothing is written.
3. **Failure handler interaction** — pyRevit issue #2268 documents a transaction crash in Revit 2024 if a failure message is canceled mid-transaction. Affects partial-batch Results-Import.

**Prevention:**
- Use **shared parameters** (`SharedParameter` defined in a shared parameter file) for all PDA result fields, not built-in parameters. Shared parameters are always writable when bound to the right category. Bind once at extension install time via a setup pushbutton.
- Wrap the entire Results-Import in a single named Transaction (NOT TransactionGroup — keep it simple). Use explicit `Transaction.Start()` / `Commit()` / `RollBack()` rather than `with` macros, so failure modes are visible:
  ```python
  t = Transaction(doc, "PDA: Import Solver Results")
  t.Start()
  try:
      for jm in json_members:
          elem = resolve_member(jm)  # uses dual-key from C2
          if elem is None:
              skipped.append(jm["id"]); continue
          for pname, pval in jm["results"].items():
              p = elem.LookupParameter(pname)
              if p is None or p.IsReadOnly:
                  failed.append((jm["id"], pname)); continue
              p.Set(float(pval))
      t.Commit()
  except Exception:
      t.RollBack()
      raise
  ```
- Always check `param.IsReadOnly` BEFORE `param.Set()`. Surface the "couldn't write" cases in the post-import summary, same pattern as v1.2's structured 422 (`detail`, `cause`, `offending_members`).

**Detection:**
- Test fixture: model with one AnalyticalMember, results JSON references an unbound shared parameter. Import must not crash; must report the missing parameter clearly.
- Test fixture: model with a member whose result parameter is bound but `IsReadOnly` (e.g. bound to a calculated formula). Import must skip + report, not throw.

**Phase ownership:** Results-Import phase plan 1 (transaction setup) and plan 2 (parameter binding setup pushbutton).

**Confidence:** HIGH. Standard Revit transaction pattern; pyRevit issue #2268 documents the cancel-during-transaction crash.

---

### Pitfall M4: pyRevit ribbon stack column-count drift

**What goes wrong:** v1.3 will add at least three new pushbuttons: `ExportToPDA_Analytical` (Tier 2), `ImportPDAResults`, `Setup` (shared parameter binding). Per MEMORY.md (`pyrevit_stack_column_limit.md`), pyRevit ribbon stacks are limited to **3 columns max**. The existing extension already has `ExportToPDA` and `ExportToPDA_Truss`. Adding three more without rethinking layout will hit the cap.

**Prevention:**
- **Two panels**, not one: `Analytical.panel/` for the new analytical-model work, `Setup.panel/` for the parameter-binding pushbutton. The PROJECT.md already names this: "production-path migration to `Analytical.panel/StructuralAnalyticalModel.pushbutton/`."
- Reserve a layout sketch in REVIT-T2-06 plan: which buttons live in which panel, in what order. Don't decide layout mid-execution.

**Phase ownership:** REVIT-T2-06.

**Confidence:** HIGH. Documented in MEMORY.md from prior work.

---

### Pitfall M5: Manual-copy Windows deployment friction (recurring lesson)

**What goes wrong:** Per MEMORY.md (`revit_host_manual_copy_deployment.md`), the Windows Revit host uses **manual-copy** deployment for the pyRevit extension, not git-clone. New pushbuttons require:
1. Edit in `~/Documents/CustomRevitExtension/` on Mac.
2. `scp` / file-share to Windows host.
3. Copy folder into pyRevit extensions directory.
4. pyRevit Reload (or Revit restart for some changes).

If a developer (or `/gsd-execute-phase`) edits the Mac repo and tests via `git push`, nothing reaches the Windows Revit instance and the UAT silently runs against stale code. This is the same class of friction as v1.2's "pip install -e pinned to main repo, not worktree" problem (RETROSPECTIVE.md).

**Prevention:**
- Document the deployment step **inside each Revit phase plan**, not just in MEMORY.md. Plan checklist: "after Mac edit → scp → Windows copy → pyRevit Reload → verify the new button appears."
- Consider a sync script (`scripts/sync_revit_extension.sh`) that one-shots the Mac→Windows path. Not a v1.3 deliverable, but a candidate WR-task at milestone close.
- UAT cases should be human-stepped through the deploy-then-test cycle. Don't trust code review alone.

**Phase ownership:** Every Revit-touching plan in v1.3 must include the deploy step.

**Confidence:** HIGH. Recurring friction documented in two retrospectives now (v1.0 truss UI files, v1.2 worktree solver_core).

---

### Pitfall M6: Snapshot baseline must capture grillage tests BEFORE solver edit

**What goes wrong:** v1.2's D-16 pattern (capture baseline, commit, then edit solver) is the project's strongest defense against silent FEM regression. For grillage, "no regression" applies in two directions:
1. **No drift in the 56 existing baselines** when adding the grillage solver to the codebase.
2. **The new grillage tests get their own baselines**, also captured BEFORE any post-write tweaks to the grillage solver.

If grillage test JSONs are captured AFTER the first "fix a bug" commit on the grillage solver, the baseline encodes the bug. Future regression checks would happily preserve the bug.

**Prevention:**
- In the grillage phase plan: explicit ordering. Step 1 = write tests. Step 2 = run solver, capture snapshots. Step 3 = `git commit` baseline. Step 4 = any subsequent solver tweaks must keep the baseline byte-identical OR explicitly recapture (with an audit-trail commit message: "RECAPTURE: <reason>").
- Verify the baseline commit hash is **earlier** than any solver edits via `git log --oneline solver_core/src/pda_analysis_software/solvers/grillage.py` — same git-ordering guarantee as v1.2.
- Critically: the very first grillage tests must be **analytically verified** (closed-form check), not just snapshotted. Otherwise the baseline is "consistency, not correctness" — same warning as v1.0 retrospective.

**Phase ownership:** Grillage phase plan 1 (test-write) and plan 2 (baseline-capture-then-commit ordering).

**Confidence:** HIGH. Pattern is proven and documented as D-16.

---

### Pitfall M7: AnalyticalMember.GetCurve returns 3D, project-onto-2D needs view-plane awareness

**What goes wrong:** `AnalyticalMember.GetCurve()` returns the 3D curve in **project coordinates**. The current Tier 1 exporter (`pyrevit_exporters/export_to_pda.py:75–77`) just takes `GetEndPoint(0)` and `GetEndPoint(1)` and drops Z. This is correct only if the model is approximately planar. For an inclined beam in a section view, dropping Z gives the wrong projection.

The right answer: project onto the active view's plane via `view.SketchPlane.GetPlane()` and the `Plane.Project()` method, with a tolerance check that the original curve is "roughly in the plane." Beams that are not in-plane get rejected with `cause="member_out_of_view_plane"`, mirroring the structured-422 pattern.

**Prevention:**
- New helper `project_curve_to_view(curve, view, tol=0.05m)`:
  - Get view plane: `view.SketchPlane.GetPlane()` (works for ViewSection, ViewPlan; not for View3D — caught by M1's whitelist).
  - For each curve endpoint, compute distance to plane. If distance > tol, raise with structured cause.
  - Otherwise, project endpoints onto the plane, return 2D (u, v) coordinates in the view's local frame.
- 2D coordinate conversion: pick a stable u/v basis from the view plane normal. Document the orientation: "u = Right, v = Up in the view." Engineers viewing the round-trip JSON should recognise the layout.

**Detection:** Test fixture: a portal frame in a section view. Beams in plane → export. Add a member offset 200mm in the Z direction (out of section plane) → export rejects with `member_out_of_view_plane`, lists the offending member.

**Phase ownership:** REVIT-T2-03.

**Confidence:** MEDIUM. The Plane.Project / SketchPlane API works on Revit 2023+; per Building Coder posts on curve projection, the projection is documented. Specific tolerance choice (0.05m) is a guess — set by experiment with real models.

---

## Minor Pitfalls

### Pitfall m1: Grillage UI deferral

**What goes wrong:** The milestone scope is "grillage solver," not "grillage UI." Risk: a phase plan creeps into adding a `/ui/grillage/` browser folder by analogy with truss2d/frame2d, ballooning scope.

**Prevention:** Explicitly out-of-scope in the grillage phase plan. Solver + adapter + API endpoint + tests only. UI deferred to v1.4 (or never — grillage may stay an API-only solver since most users will drive it from external tools or scripts).

**Phase ownership:** Grillage phase plan, scope section.

**Confidence:** HIGH (scope hygiene, not technical).

---

### Pitfall m2: `frame_v2.py` `solve_member_actions` back-solve copy-paste hazard

**What goes wrong:** `frame_v2.solve_member_actions` (lines 521–625) has a delicate stiffness-only back-solve for released-end rotations: `u_b = -Kbb_inv @ (Kba @ u_a)`. The docstring is explicit that ENA must NOT be in this back-solve because `remove_equivalent_nodal_actions_from_member_actions` subtracts the **condensed** ENA afterwards. Copying this method into grillage and getting the back-solve right requires understanding why.

**Prevention:**
- Grillage: don't replicate. Grillage members don't have moment releases in the standard formulation (a grillage "release" would mean a torsional pin, which is a different beast and unlikely to be in scope for v1.3).
- If a future grillage feature wants pin releases: re-derive from scratch, including the local-stiffness condensation, and write a new docstring explaining the grillage-specific case. Don't port frame_v2's logic mechanically.

**Phase ownership:** Grillage phase plan 1 — explicit "no member-end-release support in v1.3 grillage" scope decision.

**Confidence:** HIGH (frame_v2 docstring is explicit; the bug class is well-understood from TRUST-09..12 fixes in v1.1).

---

### Pitfall m3: pyRevit forms.alert blocks UAT in --auto mode

**What goes wrong:** v1.2 Revit pushbuttons use `pyrevit.forms.alert` for user-visible warnings (view-type guard, no analytical members found). These are modal dialogs and **block** in any automated test harness. v1.3 Revit work adds more such alerts. There is no FastAPI TestClient analogue for Revit — UAT is human-driven by definition (RETROSPECTIVE.md "UI-contract tests as substitute for browser smoke testing in --auto mode"). But a CI runner attempting to drive Revit will hang on these alerts.

**Prevention:**
- Don't try to automate Revit. Accept that Revit-side UAT is human-paced.
- Where possible, replace alert with `script.get_logger().warning()` for non-blocking diagnostics. Reserve alerts for genuine "cannot proceed without your input."
- For the round-trip integrity test (export → solve → import), the Python solver/API side IS automatable via TestClient. The Revit-side click-to-export and click-to-import are UAT-only.

**Phase ownership:** Each Revit pushbutton plan — review alert vs logger usage.

**Confidence:** HIGH. Confirmed v1.2 UAT pattern.

---

### Pitfall m4: JSON schema_version bump vs. backward-compat

**What goes wrong:** v1.2 settled on `schema_version: "1.0"` (PROJECT.md key decision). Adding grillage `solver: "grillage"` and Tier 2 fields (`revit_uid`, `revit_eid`, `meta.E_source`) might be tempted into a `schema_version: "1.1"` bump. But the convention has been **additive, backward-compatible** changes (per RETROSPECTIVE.md cross-milestone trends).

**Prevention:**
- New fields: optional, default to absent. Existing v1.0 JSON files continue to load without error in the v1.3 UI.
- New solver value: `solver: "grillage"` is a new enum value, not a schema bump. Same shape, new dispatch.
- Resist `schema_version: "2.0"` until a genuinely incompatible change forces it. Each schema version doubles the test surface area.

**Phase ownership:** Tier 2 Plan REVIT-T2-02 (schema decision) — confirm additive.

**Confidence:** HIGH. Pattern proven across v1.0/v1.1/v1.2.

---

### Pitfall m5: Existing Tier 1 exporter uses removed `GetAnalyticalModel()` lineage in docstring

**What goes wrong:** `pyrevit_exporters/export_to_pda.py:9–13` claims "Revit 2023 or later (uses the AnalyticalMember API, not the removed `element.GetAnalyticalModel()` call from pre-2023 Revit)." The docstring is correct as of v1.1, but Tier 2 work might cargo-cult the docstring while the underlying API has shifted again in 2024 (ElementId Int64) and 2025 (.NET 8). A T2 file copied from T1 inherits a stale "supported versions" claim.

**Prevention:**
- Each Tier 2 pushbutton has its own `__doc__` block stating verified-supported Revit versions and what specifically was tested. Do not copy "Revit 2023 or later" verbatim — verify on each version explicitly.
- Add a CHANGELOG.md to the sibling repo capturing per-pushbutton version-tested matrix.

**Phase ownership:** REVIT-T2-07 (legacy retirement).

**Confidence:** HIGH (housekeeping, easy to skip).

---

## Phase-Specific Warnings

| Phase | Plan-Level Pitfall | Mitigation |
|-------|--------------------|------------|
| **Grillage Plan 1** (solver write) | C3, C4, m2, M6 | Hand-derive 6×6 stiffness; no `_pure_bar_theta_dofs` carry; no member-end-release; capture snapshots BEFORE first solver tweak |
| **Grillage Plan 2** (analytical tests) | C3, M6 | Three-equation equilibrium; one cross-coupled bending+torsion analytical case; baseline commit ordering |
| **Grillage Plan 3** (API endpoint) | m4, CF4 | Additive schema; `solver: "grillage"` enum value; adapter raises `SolverDiagnosticError` with new `cause` values (`length_zero`, `gj_invalid`, etc.) |
| **REVIT-T2-01** (eid_compat helper) | C1 | Centralised eid helper from day one; high-id UAT fixture |
| **REVIT-T2-02** (schema/id decision) | C2, m4, CF1 | Dual-key (`revit_eid` string + `revit_uid`) emitted for every member; additive schema; T2 schema lands BEFORE Results-Import starts |
| **REVIT-T2-03** (view-plane projection) | M1, M7 | Whitelist view types; `project_curve_to_view` helper with tolerance + structured rejection |
| **REVIT-T2-04** (E/I/A extraction) | M2 | Multi-source lookup helper; `meta.E_source` per member; reject 0.0 |
| **REVIT-T2-05** (loads/supports extraction) | M2 (analogous), C1 | Same multi-source pattern; 64-bit-safe id everywhere |
| **REVIT-T2-06** (panel migration) | M4, M5 | Two panels (Analytical, Setup); deploy-step in plan checklist |
| **REVIT-T2-07** (legacy retirement + UAT) | M5, m3, m5 | Manual-copy deployment in checklist; alerts → logger where non-blocking; per-pushbutton version-verified docstring |
| **Results-Import Plan 1** (transaction + lookup) | C1, C2, M3 | eid_compat helper; dual-key resolution with structured failure list; explicit Transaction Start/Commit/RollBack |
| **Results-Import Plan 2** (parameter binding setup) | M3 | Shared parameters bound at install time; `IsReadOnly` check before every `Set()` |
| **Results-Import Plan 3** (annotation UAT) | C2, m3 | Edit-then-reimport fixture proves dual-key durability; alert audit |

---

## Cross-Feature Pitfalls

These are pitfalls that **only emerge from feature interaction**, not from any single feature in isolation. They require explicit phase ordering or interface contracts.

### CF1: Results-Import built before Tier 2 emits stable ids → milestone-scale rework

**What goes wrong:** If Results-Import lands first (because it feels lighter than Tier 2 hardening), it locks in a single-key resolution scheme (`revit_eid` only). Then Tier 2, when it tries to add `revit_uid`, has to either break the Results-Import contract or live with the durability gap.

**Prevention:** Build Tier 2 schema (REVIT-T2-02) **first**. Results-Import phase cannot start until the JSON shape includes `revit_uid`. Treat the schema as the interface contract; no implementation begins until the contract is signed off.

**Phase ownership:** Roadmap-level ordering. Tier 2 → Results-Import → Grillage is the safest sequence; Grillage is independent and can run in parallel with either, if worktree-parallelisation is enabled.

**Confidence:** HIGH.

---

### CF2: Grillage solver_core scaffolding repeats v1.2's untracked-files friction

**What goes wrong:** RETROSPECTIVE.md v1.2 documents that `solver_core/src/pda_analysis_software/__init__.py`, `engine/`, `models/`, `results/` were untracked at the start of v1.2 and required mirroring into worktrees mid-execution. Grillage adds new files to `solvers/`, `models/`, `adapters/`. If those parent dirs are still in the same untracked state, the worktree-mirror friction recurs.

Verified at research time: `git status` shows `solver_core/src/pda_analysis_software/__init__.py`, `engine/`, `models/`, `results/`, plus various `__pycache__` and `.ipynb_checkpoints`, all still untracked.

**Prevention:** Before grillage Phase 1 starts, run `git status solver_core/` and commit any still-untracked scaffolding files. WR-task candidate at milestone open, not close.

**Phase ownership:** Pre-grillage prep step (could be a quick-task before Phase 1 starts).

**Confidence:** HIGH. Same lesson, third milestone.

---

### CF3: Schema version drift between solver_core and pyRevit extension

**What goes wrong:** The pyRevit extension lives in a sibling repo (`CustomRevitExtension`). It writes JSON with `schema_version: "1.0"`. When the solver_core JSON loader becomes v1.1-aware (additive fields), the pyRevit extension still emits `1.0`. If a developer adds a new required field (mistake — should be optional), pyRevit-emitted JSON breaks. Same risk in reverse: pyRevit emits a new field and the solver loader silently ignores it.

**Prevention:**
- One pinned compatibility test: a fixture in `pda_project/tests/` that loads a JSON literally copy-pasted from a pyRevit `print(json.dumps(...))` output, posts it through `/solve/frame2d` TestClient. If the pyRevit extension is updated, this fixture must be updated and the TestClient run must still pass. The fixture is the executable contract.
- Any field added to `schema_version 1.x` is **optional with a sensible default**. Document this in the schema decision (REVIT-T2-02).

**Phase ownership:** REVIT-T2-02 (decide), REVIT-T2-07 (round-trip UAT fixture).

**Confidence:** MEDIUM. The pinned-fixture pattern works but requires discipline; nothing forces the sibling repos to stay in sync mechanically.

---

### CF4: Adapter validation drift — grillage misses adapter-layer guard

**What goes wrong:** v1.2's D-18 pattern is "validation at adapter, not solver." `FrameV2Adapter` rejects UDL-on-bar, length mismatches, etc. before instantiating the solver. For grillage, a new `GrillageAdapter` is needed. If the pattern is silently dropped (because grillage tests don't initially have adversarial inputs), the solver becomes the validation surface — exactly what v1.2 moved away from.

**Prevention:**
- Grillage adapter must `raise SolverDiagnosticError(...)` for at least these cases at v1.3 ship:
  - Member with zero or negative length → `cause="length_zero"`
  - GJ ≤ 0 (would zero out torsional stiffness silently) → `cause="gj_invalid"`
  - Out-of-range DOF in `restrainedDoF` → `cause="dof_out_of_range"`
  - Empty `members` list → `cause="members_empty"`
- The structured 422 payload (D-13) flows through unchanged — the API exception handler doesn't know which solver raised. `cause` taxonomy stays unified.

**Phase ownership:** Grillage Plan 3 (API endpoint + adapter validation).

**Confidence:** HIGH. Pattern is established and the taxonomy is forward-compat.

---

### CF5: Snapshot regression scope — does it cover grillage automatically?

**What goes wrong:** The `conftest.py` pytest plugin auto-attaches to `solve_structure` / `solve` on existing solver classes. A new grillage solver class needs to be **registered with the plugin** or its tests will run without baseline capture. Silent failure mode: grillage tests pass but no JSON baselines exist, so future regressions aren't caught.

**Prevention:** Verify by inspection: after Phase 1 grillage solver lands, run `pytest tests/test_grillage.py -v` and confirm `.planning/snapshots/` (or wherever baselines live — see `scripts/capture_solver_snapshots.py`) gains JSON files. If not, the plugin's auto-attach logic needs an explicit grillage registration.

**Phase ownership:** Grillage Plan 2 — verification step at end of plan.

**Confidence:** MEDIUM. The exact mechanism of conftest.py wasn't read for this research; the warning is a "verify, don't assume."

---

### CF6: Tier 2 export JSON not validated by FastAPI TestClient before manual UAT

**What goes wrong:** The Tier 1 exporter has live UAT through frame2d UI but **no automated validation that exporter output passes the FastAPI request schema**. The same risk amplifies for Tier 2: it emits more fields (`revit_eid`, `revit_uid`, `meta.E_source`, supports, loads), and any one of them being shape-wrong (e.g. `revit_eid` as int instead of string) will pass UAT only because the engineer didn't notice the warning in the browser console.

**Prevention:**
- Add a `tests/test_revit_t2_fixture_roundtrip.py` that loads the **canonical pyRevit-emitted JSON** (one fixture per supported pattern) and POSTs it to `/solve/frame2d` via TestClient. Same pattern as v1.2's UAT harness, applied to Revit-emitted JSON.
- Each Tier 2 plan that adds a field to the exported JSON adds a fixture and a TestClient assertion. CF3 fixture-pinning extends to T2 specifically.

**Phase ownership:** REVIT-T2-07 (fixture + TestClient roundtrip test).

**Confidence:** HIGH. Direct extension of v1.2 UAT pattern.

---

## Sources

- Revit 2024 ElementId Int64 transition: [pyRevit issue #1796](https://github.com/pyrevitlabs/pyRevit/issues/1796), [Building Coder: 64 Bit Ids](https://thebuildingcoder.typepad.com/blog/2023/05/64-bit-ids-revit-and-revitlookup-updates.html), [Autodesk forum: IntegerValue (Int32) vs Value (Int64)](https://forums.autodesk.com/t5/revit-api-forum/revit-2024-elementid-integervalue-int32-vs-elementid-value-int64/td-p/11911934) — HIGH confidence, official + community confirmation
- Revit 2023 structural API overhaul: [Building Coder: TBC Samples 2023 and the New Structural API](https://thebuildingcoder.typepad.com/blog/2022/04/tbc-samples-2023-and-the-new-structural-api.html), [Revit API Docs 2023 changes](https://www.revitapidocs.com/2023/news) — HIGH confidence
- Revit 2025 .NET 8 requirement and pyRevit IronPython 2.7 / 3 compatibility: [pyRevit Architecture docs](https://docs.pyrevitlabs.io/architecture/), [pyRevit 5 + Revit 2025 + Cpython3 forum](https://discourse.pyrevitlabs.io/t/pyrevit-5-revit-2025-cpython3/7816), [pyRevit issue #2666](https://github.com/pyrevitlabs/pyRevit/issues/2666) — HIGH confidence on .NET 8 requirement; MEDIUM on CPython migration timeline
- pyRevit transaction patterns and read-only parameters: [pyRevit issue #2268 (transaction crash on cancel)](https://github.com/pyrevitlabs/pyRevit/issues/2268), [pyRevit transaction module docs](https://docs.pyrevitlabs.io/reference/pyrevit/revit/db/transaction/) — HIGH confidence
- AnalyticalMember.GetCurve / view projection: [Autodesk Help: Analytical Model](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Discipline_Specific_Functionality/Structural_Engineering/Revit_API_Revit_API_Developers_Guide_Discipline_Specific_Functionality_Structural_Engineering_Analytical_Model_html.html), [Building Coder: Curve Projection](https://thebuildingcoder.typepad.com/blog/2019/11/curve-projection-add-in-videos-da4r-detach-and-fbx.html) — MEDIUM confidence (API exists, tolerance choice is empirical)
- Grillage 6×6 stiffness with GJ torsion + sign convention: [IntechOpen chapter on Girder-Deck systems](https://www.intechopen.com/chapters/80422), [SteelConstruction.info beam bridges modelling](https://www.steelconstruction.info/Modelling_and_analysis_of_beam_bridges) — MEDIUM confidence (formulation is standard but axis-naming varies between texts; PDA must pick one and document)
- Project-internal sources (HIGH confidence — direct read):
  - `/Users/catrinevans/Documents/pda_project/.planning/PROJECT.md`
  - `/Users/catrinevans/Documents/pda_project/.planning/MILESTONES.md`
  - `/Users/catrinevans/Documents/pda_project/.planning/RETROSPECTIVE.md`
  - `/Users/catrinevans/Documents/pda_project/solver_core/src/pda_analysis_software/solvers/frame_v2.py`
  - `/Users/catrinevans/Documents/pda_project/pyrevit_exporters/export_to_pda.py`
  - `~/.claude/projects/-Users-catrinevans-Documents-pda-project/memory/MEMORY.md`
