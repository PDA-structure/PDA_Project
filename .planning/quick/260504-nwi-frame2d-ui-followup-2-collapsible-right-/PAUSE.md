---
status: paused
paused_at: 2026-05-04
paused_after: plan-checker iteration 1
resumes_via: /gsd-quick resume frame2d-ui-followup-2-collapsible-right-
---

# nwi paused — state at pause

## What's done
- `260504-nwi-PLAN.md` written (10 sections identified for `<details>` conversion: Geometry, Supports, Node Loads, Member Loads, Member Properties, Edit, File, Material Properties, Section Calculator, Display — Reset View + SOLVE intentionally NOT converted, no headers).
- Plan-checker iteration 1 ran. Found 1 BLOCKER + 2 WARNINGS + 2 NITS.

## What's NOT done
- Plan-checker revision (iteration 2 not started)
- Executor not spawned
- Zero code changes
- No worktree created

## Outstanding plan-checker findings (must fix before execution resumes)

### BLOCKER B-01 (must fix)
Task 1 verify[2] and Task 2 verify[2] use pathspec `-- 'ui/frame2d/*'` which filters the diff BEFORE the grep gate runs. Result: a commit that touches `solver_core/`, `api_server/`, `tests/`, `ui/truss2d/`, or `ui/frame2d/script.js` would silently pass the safety check.

**Fix:** drop the pathspec filter from both verifiers — diff the full tree and require the changed-file list to equal exactly the expected single file:
```bash
CHANGED=$(git diff HEAD~1..HEAD --name-only)
if [ "$CHANGED" != "ui/frame2d/style.css" ]; then echo "FAIL: expected only ui/frame2d/style.css, got: $CHANGED"; exit 1; fi
```

### WARNING W-01
Task 2 verify[3] hardcodes base commit `1869d33` with a dead `BASE=` shell var, and uses `wc -l = 0` instead of the canonical `git diff --quiet`.

**Fix:** parameterise BASE properly + use canonical gate:
```bash
git diff --quiet "${BASE:-1869d33}..HEAD" -- ui/frame2d/script.js || { echo FAIL; exit 1; }
```

### WARNING W-02
Plan calls the panel "right-side" / "right rail" but `index.html:21` comments it `<!-- Left panel -->`. must_have #1 contains the self-contradictory phrase "right-side (left rail)".

**Fix:** pick one term, reconcile across objective + must_haves + success_criteria.

### NITS (skip-able)
- N-01: Task 1 verify[1] negative-lookahead regex is fragile to attribute ordering (low impact).
- N-02: Frontmatter has 10 truths but checker prompt expected 8 (mismatch in prompt, not plan).

## Resume sequence

When ready to resume:
1. Spawn gsd-planner in revision mode with the BLOCKER + 2 WARNINGS above.
2. Re-run gsd-plan-checker (iteration 2/2 — last iteration before force-proceed).
3. If it passes, capture HEAD as EXPECTED_BASE, spawn gsd-executor with worktree isolation.
4. Merge worktree → run verifier → STATE.md update → final commit.

The plan content itself is sound (10 sections correctly identified, scope is right, must_haves are derivable). Only the verifier scripts need tightening.

## Last known good baseline

Most recent commit before this task: `1869d33` (lti closeout). Frame2D session today landed 9 feature commits + 4 docs commits — all stable, all bisectable, all individually revertable via `git revert <hash>`.
