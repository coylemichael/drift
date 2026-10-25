---
date: "2026-10-13T09:55:45+01:00"
branch: "main"
git_commit: "88dd9b6ad7a49a6885c32a80382aa83f3f20f3c5"
feature: "worktree-scope"
sequence: "002"
type: "handoff"
status: "complete"
session_started: "2026-10-12T11:44:26+01:00"
session_id: "01a12f85-a6b3-71f6-b0e7-6bd16fbc61bc"
interval_id: "2ca30340-a298-439e-9923-6c9f831b0a0b"
start_branch: "main"
start_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
related_artifacts: ["drift/worktree-scope/001-handoff-explicit-worktree-adoption.md","drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md"]
next_session_profile: "implementation"
---

## Objective

Make `drift_worktree status` usable from strict-schema providers by treating a blank `path` argument as omitted.

## Source Documents

- drift/worktree-scope/001-handoff-explicit-worktree-adoption.md — the tool this fixes

## Status

- **Completed:** the fix, its test coverage, and verification. Work is finished.
- Field evidence (user-supplied transcripts, another repo's session): a model called `drift_worktree {action: "status", path: ""}`, was rejected with "status takes no path; use action: adopt…", retried identically, and failed again. Its thinking showed it had explicitly decided to send `{"action":"status"}` without `path` — and the emitted call still contained `path: ""`. Strict/structured tool-call modes on several providers require every schema property to be present, so an optional string can only be expressed as an empty string; the old `path !== undefined` check was a permanent brick wall for those providers.

## What Changed

- `extensions/drift.ts: worktreeAction()` — the status branch now treats a blank (empty/whitespace) `path` as omitted; the error for a genuinely non-blank path with status now says to omit it rather than pointing at adopt.
- `extensions/drift.ts` drift_worktree tool `path` description — "Omit or pass an empty string for status."
- `tests/pi-runtime.test.ts` — the `WORKTREE_STATUS` fixture now emits `path: ""`, so both worktree runtime tests exercise the strict-schema argument shape end to end.

This interval also carried the commit/push of the previous interval's published work (`88dd9b6`, salience-tiers; documented in drift/salience-tiers/002-handoff-tiers-implemented-and-verified.md) — no additional session state beyond that handoff.

## Codebase Context

- `drift_publish` already tolerated blank optional strings ("omit or use an empty string when none"; blank `related_artifacts` entries ignored) — `drift_worktree` now matches that convention. Any future optional string parameter on a Drift tool should treat `""` as absent from day one.
- The adopt branch's blank check (`!path?.trim()`) was already correct and is unchanged.

## What Deviated from Plan

Nothing — a single-cause fix, implemented as diagnosed.

## Open Questions

None.

## Next Steps

None — complete. Verification: `tsc --noEmit` clean; "actual Pi adopts a linked worktree as the active Drift root…" and "actual Pi keeps private artifacts in main…" both pass with the blank-path fixture.
