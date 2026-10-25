---
date: "2026-10-12T11:35:58+01:00"
branch: "main"
git_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
feature: "salience-tiers"
sequence: "002"
type: "handoff"
status: "complete"
session_started: "2026-10-12T10:50:51+01:00"
session_id: "01a12f85-a6b3-71f6-b0e7-6bd16fbc61bc"
interval_id: "21bc5d69-82a1-4b1e-ae98-74c48d80e093"
start_branch: "main"
start_commit: "e871e2fae8a243ab6e7c1abf70b5fd1b69534dd1"
related_artifacts: ["drift/salience-tiers/001-plan-silent-recording-and-deterministic-salience.md"]
next_session_profile: "implementation"
---

## Objective

Gate Drift's model-facing salience behind deterministic engagement signals while recording unconditionally, and attach Drift automatically when a repository appears in the launch directory after session start.

## Source Documents

- drift/salience-tiers/001-plan-silent-recording-and-deterministic-salience.md

## Status

- **Completed:** all nine plan tasks — schema, quiet context variant, re-probe, explicit-intent engagement, attach-time signals, work-based engagement, tiered/stable injection, tests, docs + changelog.
- **In progress:** nothing.
- **Not started:** nothing. The work is finished and verified; changes are uncommitted on `main` (baseline commit e871e2f).

Verification: `tsc --noEmit` clean; full suite 109/110 pass (116 incl. skips). Tests 37 and 86 each failed once under full-suite load and pass repeatedly in isolation — pre-existing environmental flakiness (real Pi spawns against an OneDrive-synced checkout), not regressions.

## What Changed

- `lib/state.ts: RecordData` — optional `engaged?: { at, reason }`, record-level only; `validEngagement()` wired into `Records.read()` validation; `beginTurn()` carries `engaged` across interval rotation; `adopt()` destructures `engaged` out of the snapshot spread (snapshot allowlist unchanged) and carries it to the fresh interval.
- `lib/state.ts: Records.engage()` — lock-held, hysteretic (first reason wins, never clears); `Records.engagedElsewhere()` — sibling-record scan where **bare siblings are no signal**; `Records.contextQuiet()` — the three-line quiet tier.
- `lib/artifacts.ts: hasArtifacts()` — conventional-artifact scan of the store, beside `syncIndex()`.
- `extensions/drift.ts: store()` — a probe that resolves undefined clears `ready` so later calls re-probe (guarded against stale resets); one-time `ui.notify` on mid-session attach; `attachSignals()` runs on every successful open.
- `extensions/drift.ts: checkpoint()` → `engageOnWork()` — engages when checkpoint files (minus `drift/`-prefixed) or commits are non-empty.
- `extensions/drift.ts: engageExplicit()` — wired into `/drift`, `drift-continue` input, `/drift-track-artifacts`, `/drift-changelog`, `/drift-auto-continue`, `/drift-land`, `/drift-worktree`; `records.engage()` inline in `drift_worktree` adopt and `drift_publish`.
- `extensions/drift.ts: worktreeAction()` — no-repo error now names the launch directory and says Drift re-probes on each use.
- `extensions/drift.ts` context handler — three tiers (inactive one-liner / `contextQuiet()` / full context with existing changelog+worktree additions); unchanged content returns no modification so the injected message keeps its position and timestamp.
- `tests/pi-runtime.test.ts` — fixture server's marker detection now excludes all three tier texts via a `lifecycle()` helper; the discovery test asserts quiet-first then engaged-after-work; new test "actual Pi attaches Drift quietly when a repository appears in the launch directory after start".
- `tests/drift.test.ts` — "engagement is hysteretic, validated, and carried across rotation and adoption"; "hasArtifacts detects only conventional artifacts in the store".
- `README.md` — tiered-context bullet and the inactive-outside-Git paragraph updated for automatic late attach.

## Codebase Context

- The fixture model server in `tests/pi-runtime.test.ts` finds its scripted marker by excluding context-bearing user messages. **Any new or reworded context tier text must be added to the `lifecycle()` helper there**, or the injected context becomes the marker and every scripted publication silently stops firing — the exact failure mode of the first full-suite run.
- `adopt()` spreads the active interval into the history snapshot; `validSnapshot` enforces a key allowlist, so any future record-level field must be destructured out of that spread or every later `read()` fails.
- `Records.read()` tolerates unknown record-level fields, so older extension builds read records carrying `engaged` without error.
- Engagement write ordering at a settled turn: checkpoint saves first, `engage` saves moments later in the same `exclusive` block — tests polling the record for checkpoint state should also wait for `engaged` (the discovery test now does).

## What Deviated from Plan

- **Model-initiated `drift_worktree status` does not engage** (adopt does; all user-typed commands do, including their status forms). The plan's default was "any invocation engages"; refined because the quiet context itself names `drift_worktree`, and a curious model calling `status` would self-escalate.
- **Sibling-record signal narrowed** to siblings showing engagement, receipts, completion, or history. Every session writes a record unconditionally, so the plan's "any sibling record" form would have escalated the second casual session in the same clone — defeating the feature's purpose for repeated-tourism folders.
- Test-harness sentinel fix (above) was necessary but unplanned.

## Open Questions

- The explicit-intent split (user status commands engage; model status calls don't) is a judgment call — flip either direction in `engageExplicit` call sites if field behavior argues otherwise.
- Quiet-line wording hasn't been observed in live transcripts yet; if models still react to it, tighten `Records.contextQuiet()`.

## Next Steps

None — work complete. To release: commit the working tree (code, tests, README, changelog fragment, regenerated CHANGELOG.md) and observe a casual clone-and-ask session in the field.
