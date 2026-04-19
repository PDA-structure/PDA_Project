---
phase: 03-interchange-format-and-external-inputs
reviewed: 2026-04-18T13:08:41Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - converters/__init__.py
  - converters/tekla_to_pda.py
  - pyrevit_exporters/export_to_pda.py
  - requirements-dev.txt
  - tests/fixtures/sample_pda_frame2d.json
  - tests/fixtures/sample_pda_truss2d.json
  - tests/test_interchange.py
  - tests/test_tekla_converter.py
  - ui/frame2d/index.html
  - ui/frame2d/script.js
  - ui/truss2d/index.html
  - ui/truss2d/script.js
findings:
  critical: 0
  warning: 6
  info: 9
  total: 15
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-18T13:08:41Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 3 introduces the PDA interchange format (JSON schema v1.0) plus two external-input converters (Tekla Structural Designer Excel, pyRevit analytical-model exporter). Overall the layering is clean and the project rules are respected: `openpyxl` lives in `requirements-dev.txt` only (not in `solver_core`), no `matplotlib` or printing is introduced in the solver path, and the 1-based DOF convention is honoured in the emitted payloads.

The schema-shape tests and integration tests are solid — they POST the fixture JSON through the real FastAPI app and verify analytical cantilever / axial-bar solutions. No security issues were found (no `eval`, `exec`, or `innerHTML` sinks; no hardcoded secrets; JSON-only API traffic).

Main concerns are round-trip correctness and edge-case robustness in the UI save/load code:

- **Per-member E/I/A overrides are silently coerced to global scalar values on save.** When the user sets any override, the UI emits `E/I/A` as per-member arrays *without a `schema_version`-carried flag that the file uses units `Pa / m^4 / m^2`*, which is fine. But on **load** (both `ui/frame2d/script.js` and the Tekla converter), there is no round-trip path that converts those arrays back into `E_override` fields scaled to GPa / cm⁴ / cm² — the file's solver payload units and canvas units differ, and restoring relies on `canvas.memberOverrides` alone. This works today because the file always carries both, but the invariant is undocumented and brittle (WR-01).
- **The frame2d UDL-restore logic treats `wy === 0` as "missing" and falls back to the pre-existing member value.** If a user explicitly clears a UDL by setting it to 0, saves, then reloads, the load path re-applies any stale member-level UDL or leaves the field at `null`. This is a logic error in the nullish handling (WR-02).
- **`data.canvas.supports` is trusted without validating the nodeId keys point to existing nodes** — a corrupt or manually edited file could inject supports referencing nonexistent nodes (WR-03).
- **Deleting a member in `ui/truss2d/script.js` does not reindex member ids**, unlike the frame2d counterpart which calls `reindexMembers()`. Since truss2d members don't currently carry a persistent `id` field in state, this is only a latent bug — but the file format `canvas.members` does persist them with ids assigned by array position, so round-tripping after delete-then-save can lose that identity (WR-04).
- **`schema_version` is checked only as truthy, not for version compatibility.** A future v2.0 file loaded by a v1.0 UI would pass the check and silently misbehave (WR-05).
- **The Tekla converter treats first-match TSD IDs as authoritative** — if a TSD export contains duplicate node IDs (rare but not impossible in corrupt exports), the second occurrence silently overwrites `tsd_id_to_index[nid]` without warning, and the earlier node stays in the `nodes` list as an orphan (WR-06).

Info-level items cover minor DRY violations (duplicated restrainedDoF / forceVector logic between `solve()` and `saveModel()` in both UIs), magic numbers, and a couple of style nits.

## Warnings

### WR-01: E/I/A override round-trip relies on canvas.memberOverrides but writes per-member arrays to solve payload without a shape marker

**File:** `ui/frame2d/script.js:1158-1167`, `ui/frame2d/script.js:1332-1342`
**Issue:** `saveModel()` emits `E`, `I`, `A` as per-member arrays (in Pa / m⁴ / m²) whenever any member has an override, and separately writes `canvas.memberOverrides` with the original GPa / cm⁴ / cm² values. On load, the UI reads `canvas.memberOverrides` only — it never inspects the solve-payload arrays. If `canvas.memberOverrides` is absent (e.g. a file produced by a future tool such as the Tekla converter with per-member E), the user's overrides are lost silently while `solve()` still uses the correct values. Worse, if the two are out of sync (manual JSON edit or schema drift), the displayed panel and the solve result diverge.
**Fix:** Document the invariant explicitly, or make the load path reconcile. Simplest reconciliation:
```js
// After restoring members from canvas, if canvas.memberOverrides is absent
// but top-level E/I/A are arrays, reconstruct overrides from them.
if (!(data.canvas && data.canvas.memberOverrides) && Array.isArray(data.E)) {
  const E_GPa_global = parseFloat(document.getElementById('inputE').value);
  members.forEach((m, i) => {
    const e_GPa = data.E[i] / 1e9;
    if (Math.abs(e_GPa - E_GPa_global) > 1e-9) m.E_override = e_GPa;
  });
  // same for I (1e-8) and A (1e-4)
}
```

### WR-02: UDL restore treats explicit 0 as "missing" and falls through to stale member value

**File:** `ui/frame2d/script.js:1325-1326`
**Issue:**
```js
m.udl = udlMap[m.id].wy !== undefined && udlMap[m.id].wy !== 0 ? udlMap[m.id].wy : (m.udl != null ? m.udl : null);
```
The `!== 0` guard means a user who saves a file with `wy: 0` (explicit clear) and then loads it will see whatever `m.udl` was already on the in-memory member (usually `null` — correct — but if the loaded `canvas.members` carried a nonzero `udl` from an earlier save of the same member, the zero is discarded). The current `saveModel()` filters 0 values out of `canvas.udl` entirely (line 1213 — only members with nonzero udl or udl_x are pushed), so this path is only reachable if the file was hand-edited, but the logic is still wrong and confusing.
**Fix:** Treat `wy === 0` as an explicit clear.
```js
m.udl   = udlMap[m.id].wy !== undefined ? (udlMap[m.id].wy || null) : null;
m.udl_x = udlMap[m.id].wx !== undefined ? (udlMap[m.id].wx || null) : null;
```
(Using `|| null` collapses both `0` and falsy to `null` which is the sentinel the rest of the code already uses.)

### WR-03: Load path does not validate canvas.supports.nodeId keys against nodes array

**File:** `ui/frame2d/script.js:1311-1315`, `ui/truss2d/script.js:774-778`
**Issue:** `Object.entries(sObj).map(([nodeId, type]) => ({ nodeId: parseInt(nodeId, 10), type }))` happily emits `{ nodeId: NaN, type: 'fixed' }` if the JSON contains a non-numeric key (e.g. `"abc"`), and it does not drop supports whose nodeId is out of range. Similarly, the subsequent `solve()` path will push DOFs like `base = NaN * 3 + 1` into `restrainedDoF`, which the API will then reject with a confusing error. A hand-edited or older-version file can produce this.
**Fix:** Validate after parsing:
```js
const validIds = new Set(nodes.map(n => n.id));
supports = Object.entries(sObj)
  .map(([nodeId, type]) => ({ nodeId: parseInt(nodeId, 10), type }))
  .filter(s => Number.isInteger(s.nodeId) && validIds.has(s.nodeId));
```
Apply the same defensive filter to `nodeLoads` / `loads` and to `canvas.udl[*].memberId` and `canvas.memberOverrides` keys.

### WR-04: truss2d delete-member path does not reindex member ids

**File:** `ui/truss2d/script.js:135-136`
**Issue:** Deleting a member in truss2d just splices the array:
```js
members.splice(mi, 1);
```
The frame2d UI calls `reindexMembers()` here (`ui/frame2d/script.js:228`) to keep `m.id` in sync with array index, so `canvas.members` written by `saveModel()` has consistent `{id: 0, 1, 2, ...}`. Truss2d members never receive an `id` field (lines 79, 138 push `{start, end}` objects only), so `JSON.parse(JSON.stringify(members))` at line 711 serializes them without ids — the "no id" case. When loaded, member order is preserved, so this happens to work, but it means `canvas.udl[*].memberId` / `canvas.memberOverrides` keys introduced for frame2d could not be copy-pasted into a truss2d file. It is inconsistent with the frame UI.
**Fix:** For consistency and future-proofing, add an `id` field to truss2d members at creation time and a `reindexMembers()` call on delete, matching frame2d:
```js
// on member creation (line 79)
members.push({ id: members.length, start: currentMemberStart.id, end: n.id });
// on delete (line 136)
members.splice(mi, 1);
members.forEach((m, i) => { m.id = i; });
```

### WR-05: schema_version checked for truthiness, not compatibility

**File:** `ui/frame2d/script.js:1290`, `ui/truss2d/script.js:753`
**Issue:**
```js
if (!data.schema_version || !data.solver || !data.nodes || !data.members) { ... }
```
A file with `schema_version: "2.0"` (future breaking change) passes this check and will silently be interpreted as v1.0. The research doc for phase 3 explicitly introduces a versioned interchange format; a version check is the whole point of shipping `schema_version`.
**Fix:**
```js
const SUPPORTED_SCHEMA_VERSIONS = ["1.0"];
if (!SUPPORTED_SCHEMA_VERSIONS.includes(data.schema_version)) {
  alert(`Unsupported schema_version: ${data.schema_version}. This UI supports ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}.`);
  e.target.value = '';
  return;
}
```
Apply the same change in both UIs.

### WR-06: Tekla converter silently overwrites duplicate TSD node IDs

**File:** `converters/tekla_to_pda.py:146-153`
**Issue:**
```python
for i, row in enumerate(node_rows):
    nid = _require_column(row, cmap["node_id"], i, cmap["nodes_sheet"])
    ...
    tsd_id_to_index[nid] = len(nodes)  # contiguous 0-based index
    nodes.append([float(x), float(y)])
```
If a TSD export has a duplicate `nid`, the second row replaces the mapping but the first row's coordinates remain in `nodes` as an orphan entry (any member referencing the duplicate id now points to the second occurrence, but the first occurrence inflates `n_nodes` and produces a ghost DOF). This is rare in valid TSD exports but happens with corrupt files.
**Fix:** Detect and fail loudly:
```python
if nid in tsd_id_to_index:
    raise ValueError(
        "Duplicate node ID {} at row {} (first seen earlier). "
        "Check the TSD export for corruption.".format(nid, i + 2)
    )
tsd_id_to_index[nid] = len(nodes)
nodes.append([float(x), float(y)])
```

## Info

### IN-01: `converters/__init__.py` is empty — add a short docstring

**File:** `converters/__init__.py:1`
**Issue:** The file has zero bytes. It works for package import purposes, but an empty `__init__.py` gives future readers no hint about what lives in `converters/`.
**Fix:** Add a one-line module docstring: `"""External-tool → PDA canonical JSON converters (Tekla Structural Designer Excel, etc.)."""`.

### IN-02: saveModel / solve duplicate restrainedDoF and forceVector construction

**File:** `ui/frame2d/script.js:357-373` vs `ui/frame2d/script.js:1170-1186`; `ui/truss2d/script.js:244-257` vs `ui/truss2d/script.js:676-689`
**Issue:** Both UIs contain near-identical blocks that translate `supports` → `restrainedDoF` and `loads/nodeLoads` → `forceVector` in both `solve()` and `saveModel()`. A future edit to support conventions (say, adding `rollerRotation`) will have to be made in two places per UI and will desynchronize the saved file from the solve payload.
**Fix:** Extract to a pure helper, e.g. `buildSolvePayload()` that returns `{ restrainedDoF, forceVector, ... }`, and call it from both `solve()` and `saveModel()`.

### IN-03: Magic number `100` for history cap should be a named constant

**File:** `ui/frame2d/script.js:249`, `ui/truss2d/script.js:157`
**Issue:** `if (history.length > 100) history.shift();` — the cap is duplicated and not documented.
**Fix:** `const HISTORY_LIMIT = 100;` at the top of each script, or (better) in a shared constants module if the project ever extracts one.

### IN-04: Default steel E/I/A in the Tekla converter duplicated with pyRevit exporter

**File:** `converters/tekla_to_pda.py:202-204`, `pyrevit_exporters/export_to_pda.py:92-94`
**Issue:** Both files hardcode `E = 200e9`, `I = 1e-4`, `A = 0.01` as "generic steel" fallbacks. If this changes (e.g. to match a project-standard default), two files must be touched.
**Fix:** Not worth extracting for two sites today, but leave a `# KEEP IN SYNC WITH converters/tekla_to_pda.py` comment in `pyrevit_exporters/export_to_pda.py` so the coupling is visible.

### IN-05: `_convert_E_to_Pa` silently passes unknown units through

**File:** `converters/tekla_to_pda.py:93-106`
**Issue:** The fallback path returns the value unscaled when the header matches none of kN/m², MPa, GPa, Pa. A mistyped column header (e.g. "E (kPa)" — not in the list) yields a value 1000× too small with no warning.
**Fix:** Log a warning (stderr is fine — this is a CLI) when falling through:
```python
import warnings
warnings.warn(f"Unrecognised E unit in header '{header_name}'; passing value through unscaled.")
```

### IN-06: `pyrevit_exporters/export_to_pda.py` runs at import time, no `if __name__ == "__main__"` guard

**File:** `pyrevit_exporters/export_to_pda.py:59-121`
**Issue:** The collector and side-effectful `forms.alert` / `forms.save_file` calls execute at module import. In the pyRevit context this is fine (the script IS the entry point), but it also means the file cannot be `import`-tested. Since the file's docstring says "Run this script from a pyRevit button", this is arguably intentional.
**Fix:** Accept as-is, but note in the docstring that the module is side-effectful at import. If any future test wants to exercise `get_or_add_node` or `xyz_to_metres` in isolation, wrap the runtime block in `if __revit__ is not None:` or similar.

### IN-07: `drawUDLs` has two separate `members.forEach` passes — minor code duplication

**File:** `ui/frame2d/script.js:721-811`
**Issue:** Vertical (`m.udl`) and horizontal (`m.udl_x`) UDL drawing are two separate loops with ~70% shared structure (compute `n1`/`n2`, arrow sign, steps). Not a bug, but a candidate for a shared `drawUDLArrows(m, component, color)` helper.
**Fix:** Optional refactor; leave for a later UX polish phase.

### IN-08: `test_force_vector_length_matches_nodes_*` asserts total length only

**File:** `tests/test_interchange.py:167-174`
**Issue:** The tests verify `len(forceVector) == n_nodes * dof_per_node`, which catches the "wrong DOF per node" pitfall. They don't verify that the non-zero entries are at the correct DOFs. This is acceptable at the schema level (the solve-readiness test catches actual correctness), but worth noting.
**Fix:** No action — the analytical `test_*_is_solve_ready` tests cover correctness end-to-end.

### IN-09: `_lastBlobUrl` is a module-level mutable (both UIs)

**File:** `ui/frame2d/script.js:9`, `ui/truss2d/script.js:9`
**Issue:** Ensures only one outstanding blob URL at a time, revoking the previous one before the new one is made. Works correctly, but the leading-underscore-for-private convention is Pythonic, not JS idiom. Since these files don't use modules, scope is a non-issue.
**Fix:** No action — accept as stylistic.

---

_Reviewed: 2026-04-18T13:08:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
