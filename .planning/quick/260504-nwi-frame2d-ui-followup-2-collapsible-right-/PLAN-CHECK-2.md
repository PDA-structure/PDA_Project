# Plan-Checker iteration 2/2 — frame2d UI followup-2

**Verdict: PASS** — proceed to executor.

## Fix verification

### B-01 (BLOCKER) — fixed cleanly
Task 1 verify[2] (line 331) and Task 2 verify[2] (line 495) now both use:
```
CHANGED=$(git diff HEAD~1..HEAD --name-only | sort -u | tr '\n' ' ' | sed 's/ *$//')
if [ "$CHANGED" = "ui/frame2d/<file>" ]; then echo PASS; else echo "FAIL: got: $CHANGED"; exit 1; fi
```
The diff is captured BEFORE filtering, then exact-equality compared against the expected single-file string. Verified empirically in `/tmp`:
- Single-file commit (only `ui/frame2d/index.html`) → PASS
- Multi-file commit (added `solver_core/leak.py`) → FAIL with `got: solver_core/leak.py ui/frame2d/index.html`

The previous escape paths (solver_core/, api_server/, tests/, ui/truss2d/, ui/frame2d/script.js) are now all caught.

### W-01 (WARNING) — fixed cleanly
Task 2 verify[3] (line 496) now uses:
```
BASE="${EXPECTED_BASE:-1869d33}"
if git diff --quiet "$BASE..HEAD" -- ui/frame2d/script.js; then echo PASS; else echo FAIL; exit 1; fi
```
- Parameterised via env var with literal fallback (matches the orchestrator handoff described in `<interfaces>`).
- Uses canonical `git diff --quiet ... || FAIL` pattern (no more `wc -l = 0` cruft, no more dead `BASE=` shell var).
- Verified empirically in `/tmp`: clean tree → PASS, leak `console.log` into `script.js` → FAIL.

### W-02 (WARNING) — fixed cleanly
Confirmed via `grep -i "right rail\|right-rail\|right side\|right-side\|right panel"` → zero matches. All references to the panel use "left panel" or "left rail" consistently:
- Frontmatter must_have #1 (line 15): "left-panel toolbar"
- Objective (line 52, 54): "left-panel toolbar"
- Inventory header (line 89): "left panel"
- Task 1 action (line 250): "left panel"
- Task 1 commit message (line 327): "left-rail headed sections"
- Task 1 done bullet (line 334): "left-rail toolbar"
- Task 3 what-built (line 524): "left-rail headed section"
- Task 3 UAT step 3 (line 530): "left rail"
- success_criteria (line 604): "left-panel toolbar"

Remaining "right" occurrences in the file are all legitimate: chevron pointing right (decoration), CSS `margin-right`, "right corners" in summary border-radius commentary, and the directory path `260504-nwi-frame2d-ui-followup-2-collapsible-right-` (preserved from /gsd-quick slug — out of scope to rename).

## New issues introduced by edits — none found

Re-ran the dimension checks specifically focused on the edited regions:

| Dimension | Result |
|-----------|--------|
| Requirement coverage (QUICK-260504-nwi) | PASS — must_haves still cover the goal |
| Task completeness (files/action/verify/done) | PASS — Task 1, Task 2, Task 3 all complete |
| Dependency correctness | PASS — no deps, single plan, wave 1 |
| Key links planned | PASS — must_haves.key_links unchanged, all four links still present |
| Scope sanity | PASS — 2 auto tasks + 1 checkpoint, 2 files |
| Verification derivation | PASS — success_criteria items 1-11 each map to a frontmatter must_have or interface contract |
| Context compliance | PASS — locked decisions #1, #3, #4, #6, #7, #8 from the discussion are all reflected in must_haves and verify gates; deferred ideas (localStorage persistence, accordion mode) explicitly out of scope |
| CLAUDE.md compliance | PASS — visualization/leaf rule N/A (browser-side); script.js untouched (no solver/API change); no matplotlib in solver_core |

Bash-verified the new verifier scripts end-to-end in a scratch repo:
- Task 1 single-file gate: PASS on clean conversion, FAIL on `solver_core/leak.py` injection
- Task 1 node script: PASS on synthetic 10-details HTML
- Task 2 single-file gate: behaviourally identical to Task 1's gate
- Task 2 node script: PASS on synthetic CSS with all six rules + reduced-motion block
- Task 2 cross-plan script.js gate: PASS clean, FAIL on script.js mutation

## Pre-existing weaknesses NOT addressed (carried from iteration 1)

These are intentional skip-throughs from iteration 1, NOT new issues. Re-listed for transparency only:

- **N-01 (NIT, skipped):** Task 1 verify[1] negative-lookahead `<details class=\"card\"(?! open>)[^>]*>` is fragile to attribute reordering. The plan only ever writes `<details class="card" open>` (the action enforces this exact shape) so the regex is fine in practice. No action.
- **N-02 (NIT, skipped):** Frontmatter has 10 truths; the original prompt said "8". Plan-content choice — 10 is more thorough. No action.
- **Soft observation:** Task 2 verify[1] checks for `transition:` substring but pre-existing rules in `style.css` (lines 184, 241) already contain `transition:`. So the gate proves "some transition exists in the file" rather than "the chevron has a transition". The companion checks (`details[open]`, `transform: rotate(90deg)`, reduced-motion `transition: none`) collectively make a passing CSS file without chevron animation implausible. Acceptable.

## Summary

All three actionable findings from iteration 1 (B-01 + W-01 + W-02) landed cleanly. No new issues introduced. Verifier scripts were empirically tested in a scratch repo and behave correctly on both pass and fail cases. The plan content itself remains sound (locked decisions honoured, scope tight, must_haves derivable, two-commit + UAT structure intact).

PASS — fine to capture HEAD as `EXPECTED_BASE`, spawn the executor with worktree isolation, and proceed to merge + verifier + UAT.
