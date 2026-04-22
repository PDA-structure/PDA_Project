---
date: "2026-04-22 18:20"
type: design-question
status: open
promoted: false
---

# Design question: physical-member vs finite-element distinction

## Context

Raised 2026-04-22 in conversation after:

1. **Pure-bar joint instability bug** (todo: `2026-04-22-frame2d-pure-bar-joint-instability.md`) — splitting a bar at intermediate nodes creates pure-bar joints where θ has zero stiffness → singular Ks → HTTP 422
2. **Phase 5 Revit exporter review** — works well and as intended, but always splits detail lines at every intermediate node via T-junction detection (plan `05-02`)
3. **User question**: "is it worth sometime or all the time keeping the member spanning over more than one node?"

## The underlying modelling question

Large structural analysis tools (Tekla Structural Designer, Robot, SAP2000, ETABS, RAM) all distinguish:

- **Physical member** — the real-world beam / column / brace the engineer draws. One identity, one set of properties, one pair of end conditions, continuous span.
- **Analytical / finite elements** — the discretised pieces the solver uses. One physical member can mesh into N elements; the physical member's identity persists through meshing.

Our current pipeline (`frame_v2` + `frame2d` UI + Revit exporter) **does not** make this distinction. Every intermediate node becomes an element boundary during T-junction split. The UI treats each sub-element as its own member with its own E / I / A / type. Physical identity is lost as soon as the model is exported or drawn across an intermediate node.

## Why this matters now

Two concrete problems this causes:

1. **Pure-bar joints** — a bar spanning A→D with intermediate nodes B, C (where other bars attach) is split into bar(A-B), bar(B-C), bar(C-D). B and C now have only bar stiffness → zero θ contribution → 422. If the physical member bar(A-D) were preserved as one element, intermediate nodes B and C would not acquire θ DOFs *from this bar at all* — only from members that genuinely attach there.
2. **Member editing UX** (blocks `2026-04-22-frame2d-ui-member-inspector-and-edit.md`) — if the engineer clicks on "the top chord" expecting to edit I for the whole continuous beam, but the click selects only the 1 m sub-piece between two intermediate nodes, the experience is broken relative to commercial tools.

## Options

### Option A — Status quo
Keep current behaviour: every intermediate node splits the member. Accept the pure-bar limitation and fix it narrowly at the solver (detect pure-bar joints, eliminate/restrain θ). No physical-member concept introduced.

- ✅ No schema change, no exporter change
- ❌ UI selection still binds to sub-elements → inspector/edit UX is degraded vs commercial tools
- ❌ The Revit-to-solver round-trip still loses the physical-member identity that Revit itself has

### Option B — Parallel physical-member array in JSON schema
Add a `physical_members` array alongside the existing `members` array:

```json
{
  "physical_members": [
    { "id": "pm_1", "node_path": [1, 2, 3, 4, 5],
      "E": ..., "I": ..., "A": ..., "type": "beam" }
  ],
  "members": [ /* existing per-element records, each tagged with parent physical member */ ]
}
```

- Revit exporter emits one `physical_member` per detail line plus the discretised elements
- UI selection highlights the whole physical member; editing propagates to all children
- Solver still consumes per-element array — ignores `physical_members`

- ✅ Clean UX; clean Revit round-trip
- ❌ Schema change; save/load backwards-compatibility needed
- ❌ Solver gets no help with pure-bar problem unless combined with Option C or D

### Option C — Don't split bars; only split beams
Revit exporter refuses to split a bar-typed detail line at intermediate nodes. Bar stays single endpoint-to-endpoint; loads at intermediate nodes still enter via `forceVector` on those nodes.

- ✅ Simple; removes the pure-bar joint structural issue at its source
- ✅ No schema change
- ❌ Doesn't address the beam editing UX problem — beams still get split and lose identity in the UI
- ❌ What if an engineer draws a detail line meant to be a bar but crosses an intermediate beam joint? Exporter now has to decide whether to split or not based on member type, which must be known at export time.

### Option D — Solver-level element grouping
Solver accepts an optional `member_group` ID on each element. During assembly, elements sharing a group ID are treated as a single element for stiffness purposes (only group endpoints contribute Ks rows/cols); intermediate nodes on the group don't acquire θ DOF *from this group*.

- ✅ Most physically correct — the solver reconstructs the physical member at assembly time
- ✅ Optional metadata — backwards compatible for models without groupings
- ❌ Highest solver complexity; assembly logic changes
- ❌ Doesn't directly solve the UI selection problem unless the UI also reads `member_group`

## Open questions

- Does the value justify physical-member semantics across schema + solver + UI + exporter? Or is Option C (narrow bar-split fix) enough, with physical-member grouping reserved for a future milestone?
- If we introduce grouping, does it also affect load application? (e.g. a UDL specified on the physical member, auto-distributed to children)
- Backwards compatibility: can old saved JSON files still load?
- **Phase timing**: does this need to happen before Phase 6 Tier 2 (Revit Analytical Exporter Hardening)? If Tier 2 ships without it, the Revit export will bake the split-per-node convention deeper, making a later retrofit more expensive across Revit code, solver JSON, and UI simultaneously.

## Recommendation (for discussion)

**Short design session before Phase 6 Tier 2 plan-phase begins.** Pick one of:

- **C + A combined** — narrow-scope: stop splitting bars in the exporter, fix pure-bar at the solver. Ship v1.2 without physical-member identity. Schedule Option B/D for v1.3+.
- **B + C combined** — introduce physical_members in the schema AND stop splitting bars. Larger scope but fixes both UX and structural problems and locks the schema before Tier 2 bakes assumptions in.
- **Status quo for v1.2** — accept the limitations, fix pure-bar narrowly, defer the whole physical-member question to v1.4 alongside 3D work (where it's even more necessary).

Blocks: `2026-04-22-frame2d-ui-member-inspector-and-edit.md` execution; should be resolved before Phase 6 Tier 2 plan-phase.

## Next action

User + Claude discussion session to pick an option and record the decision. Then either update Phase 6 Tier 2 scope or promote a new phase (999.x-physical-member-model) into the backlog.
