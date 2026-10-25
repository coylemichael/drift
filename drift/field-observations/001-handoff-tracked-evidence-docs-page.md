---
date: "2026-10-13T10:03:09+01:00"
branch: "main"
git_commit: "b7a7a2c3faf8f7c91e2fd938dd929aad92deeb13"
feature: "field-observations"
sequence: "001"
type: "handoff"
status: "complete"
session_started: "2026-10-13T09:57:44+01:00"
session_id: "01a12f85-a6b3-71f6-b0e7-6bd16fbc61bc"
interval_id: "77b8fd38-f89d-4f17-bdfc-dc5c08916c2e"
start_branch: "main"
start_commit: "b7a7a2c3faf8f7c91e2fd938dd929aad92deeb13"
related_artifacts: ["drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md","drift/worktree-scope/002-handoff-status-tolerates-blank-path.md"]
next_session_profile: "implementation"
---

## Objective

Give field-testing evidence a tracked home that follows the repository: `docs/field-observations.md`, outside the private artifact store.

## Source Documents

- drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md — the open wording question this evidence feeds
- drift/worktree-scope/002-handoff-status-tolerates-blank-path.md — the strict-schema observation seeded into the page

## Status

- **Completed:** the page, its README link, and the seeded observations. Work is finished.
- The user chose a tracked `docs/` page over private research artifacts so the evidence travels with the repo. Raw per-batch observations may still become `salience-tiers` research artifacts when they drive a plan; the docs page is the durable, shareable ledger.

## What Changed

- `docs/field-observations.md` (new) — purpose, append-only rules (transcribe, record clean passes, no secrets), a defined entry format including the machine-measured `engaged.reason`, four seeded observations (pre-tiers late-attach failure; pre-tiers attention tax, six verbatim thinking quotes; post-tiers engaged repo behaving as designed; strict-schema blank-path evidence), and a pending-scenarios list for the planned clone tests.
- `README.md` — the tiered-context bullet now links to the page.

## Codebase Context

- Evidence about Drift's behavior must be recorded in this repo, never in the observed repos: publishing there would itself fire an attach-time engagement signal and contaminate the next quiet-tier test (observer effect).
- Each entry names the Drift build commit the observed session ran, since tier behavior differs across `e871e2f` → `88dd9b6` → `b7a7a2c`.

## What Deviated from Plan

Nothing planned formally; this records a user decision — tracked docs page rather than private artifacts — made after weighing both options.

## Open Questions

None here; the pending-scenarios list in the page itself is the live checklist.

## Next Steps

None — complete. Future observation batches append dated entries to the page; if a batch reveals a behavior change worth making, it becomes source evidence for a new plan.
