
- [ ] Frame2d toolbar background parity — change `.panel` from `var(--color-bg)` to `var(--color-surface)` to match truss2d's visual hierarchy (distinct surface vs page blend). User flagged 2026-05-26.
- [ ] Migrate all existing calc spikes to calc_sheet.py formatting (padstone, strip, beam_bs8110, beam_ec2, steel beam, steel column, load_buildup) — match the tension/compression PDF quality. Work in marimo_spike repo.
- [ ] Truss2d member properties Phase 1: per-member Area A in UI, sent to API, used in stress calc. Follow frame2d member properties pattern.
- [ ] Truss2d member properties Phase 2: material density per member (default steel 7850 kg/m³), auto-calculate self-weight UDL from A × density × g.
