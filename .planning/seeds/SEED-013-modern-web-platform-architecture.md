# SEED-013: Modern Web Platform Architecture — Tech Stack Evolution

**Planted:** 2026-05-25
**Trigger:** When building 3D solvers (v1.4+), SaaS dashboard, or multi-user features
**Source:** Google AI blueprint review + PDA project architectural analysis

## Context

Google AI proposed a "Pro SaaS" blueprint (Next.js + TypeScript + Tailwind + shadcn/ui + Supabase + Vercel + Three.js/Wasm). Reviewed against our actual codebase and roadmap. Most of the stack is premature for single-canvas solver tools, but several design principles and specific technologies are worth adopting at the right time.

## What to steal now (small CSS/font changes, no architecture shift)

1. **Monospace font for numerical values** — JetBrains Mono or SF Mono for force labels, reaction labels, coordinate display, results tables. Fixed-width prevents layout shifting and improves column alignment. Add as `--font-mono` CSS variable alongside existing Inter.
2. **Deeper dark mode palette** — richer charcoal tones (`#0D1117`, `#121214` range) for frame2d canvas background and panel surfaces. Current dark mode works but could feel more premium.
3. **Backdrop blur on floating panels** — `backdrop-filter: blur(8px)` + semi-transparent background on the floating cards (260523-i52). One CSS line, instant modern feel.
4. **Micro-animations** — `transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1)` on checkbox toggles, panel float/dock, solve button state changes. Snappy, not sluggish.
5. **Bento grid refinement** — thin 1px slate borders on panel cards, rounded corners already in place, tighten spacing for higher information density.

## What to adopt for 3D solvers (v1.4 Three.js milestone)

- **Three.js** — already decided per memory `project_3d_ui_threejs_primary`. Wireframe viewer first, then interactive node/member selection, then results overlay (deformed shape, force diagrams as 3D tubes).
- **React Three Fiber** — only if we adopt React for the UI chrome. Otherwise use Three.js directly with vanilla JS (same pattern as our 2D canvas).
- **WebAssembly solver** — when 3D frame DOF count exceeds ~5000, move the matrix solver from Python/numpy API round-trip to client-side Wasm. Options: (a) Rust→Wasm custom solver, (b) numpy via Pyodide. Benchmark before committing — the API round-trip may be fast enough for structural engineering scales.
- **OrbitControls + raycasting** — Three.js built-ins for 3D pan/zoom/rotate + node/member click selection. Our 2D pan/zoom patterns (view.scale, view.tx/ty) translate to OrbitControls naturally.

## What to adopt for SaaS dashboard (v2.0+)

- **Next.js + TypeScript** — when we need multi-page routing (project list, user settings, billing, shared models). Not for single-canvas solver tools.
- **Tailwind CSS** — when starting a fresh dashboard UI. Don't retrofit onto existing frame2d/truss2d CSS variable system — the two can coexist (canvas uses custom tokens, dashboard uses Tailwind).
- **shadcn/ui** — accessible component primitives for dashboard modals, dropdowns, tabs. Requires React.
- **Supabase** — when we need user accounts + saved projects + real-time collaboration. Replaces our current JSON file state storage. PostgreSQL with Row Level Security for multi-tenant isolation.
- **Vercel** — if we adopt Next.js. Otherwise Render/Railway for Python FastAPI deployment.

## What NOT to adopt

- **React for 2D canvas UIs** — vanilla JS + Canvas2D is working, fast to iterate, zero build step. Migration would be 2-3 weeks per UI with no new capability. Keep as-is.
- **TypeScript for existing code** — adds build steps we don't have. The edit→refresh cycle has zero friction. Consider only for new greenfield modules.
- **Supabase now** — we don't have users, accounts, or shared state. JSON files are fine for single-engineer use.
- **Recharts/ApexCharts** — our canvas-drawn diagrams (BMD/SFD/AFD) are more appropriate for structural engineering than generic charting libraries. Keep custom canvas rendering.

## Recommended evolution timeline

| Milestone | Stack changes |
|-----------|--------------|
| **v1.4 (3D truss)** | + Three.js (vanilla JS), + JetBrains Mono for values, + deeper dark mode, + backdrop blur |
| **v1.5 (3D frame)** | + Wasm solver option (benchmark first), + OrbitControls patterns |
| **v2.0 (SaaS)** | + Next.js + TypeScript + Tailwind + shadcn/ui for dashboard, + Supabase for auth/storage, + Vercel hosting |
| **v2.x (collab)** | + Supabase real-time for shared models, + WebSocket for live collaboration |

## Related seeds/memories

- `project_3d_ui_threejs_primary` — 3D UI decision (three.js browser-based, Blender deferred)
- `project_solver_priority_3d_before_grillage` — 3D truss/frame before grillage
- `SEED-005-solver-to-calc-factory-pattern` — solver↔calc seam (relevant to Wasm migration)
- `SEED-006-compiled-project-report-system` — compositor architecture (stays Python-side)
