---
date: "2026-10-11T13:09:36+01:00"
branch: "main"
git_commit: "cc57146f22ba106856f8de7b58c9d5dfc923b1f4"
feature: "auto-continue"
sequence: "001"
type: "handoff"
status: "complete"
session_started: "2026-10-11T12:19:32+01:00"
session_id: "01a12ab0-798d-7599-a5b3-51221be2e20c"
interval_id: "d425f58a-3602-490c-9bf1-4f4b154fbb5f"
start_branch: "main"
start_commit: "cc57146f22ba106856f8de7b58c9d5dfc923b1f4"
related_artifacts: []
---

## Objective

Add a per-repository switch for Drift's automatic publish → compact → continue chain, with manual handoffs as the default: a profiled handoff is only published unless the repo opts in with `/drift-auto-continue on`.

## Source Documents

None — direct user request in-session; no prior research or plan artifact for this feature.

## Status

Complete. Implemented, documented, tested (unit + actual-Pi runtime), and committed together with the changelog fragment in this session.

- **Completed:** `autoContinue` config key (default off), `/drift-auto-continue on|off|status` command, publish-time gating, README commands table, host-overlay guidance, unit and runtime tests.
- **In progress / not started:** nothing.

## What Changed

- lib/state.ts — `DriftConfig.autoContinue` (absent = `false`), validated in `rawConfig()`, parsed in `driftConfig()`; new `setAutoContinue()` + `AutoContinueRequest` beside `updateConfig()`; `configShape` message extended.
- extensions/drift.ts — registers `/drift-auto-continue` (same pattern as `/drift-changelog`); `drift_publish` reads the Drift root's config once per handoff and queues the continuation only when `autoContinue === true`; otherwise the result text says nothing is queued and names `drift-continue <artifact>`. The land-conflict message only claims a continuation is "held" when the chain is on. `promptGuidelines` reworded: report the drift-continue command and stop by default.
- README.md — new "Commands (Pi)" section after Install listing every user command (`/drift`, bare `drift-continue`, `/drift-worktree`, `/drift-track-artifacts`, `/drift-changelog`, `/drift-auto-continue`, `/drift-land`); "Profile-directed continuation" rewritten as opt-in; Landing section now says continuation resumes "where `autoContinue` is on"; worktree Scope list includes the new command.
- skills/drift/hosts/pi.md — continuation section flipped to the manual default (report the drift-continue command, then stop; suggest the command rather than editing `.drift.json`); `execute.md` loop note conditioned on `autoContinue` on.
- tests/drift.test.ts — config test covers the off default, explicit `true`, `setAutoContinue` round-trip (status/on/off/idempotent) and rejection of non-boolean values.
- tests/pi-runtime.test.ts — new test "actual Pi leaves a profiled handoff manual by default and still honours drift-continue later" (no compaction entry, off-text in the tool result, later manual `drift-continue` still selects the profiled model). Chain-dependent tests now opt in with `"autoContinue": true`: land-then-continue, private-worktree continuation (worker `.drift.json` deepEquals updated to include the key), adoption-refused-while-queued, and the stale-skill three-handoff chain — doubling as proof the switch enables the chain.

## Codebase Context

- The config is read at publish time, so toggling mid-session affects the next handoff without reload. But a running extension keeps its loaded publisher: Pi sessions already open on this checkout (including the one that wrote this) still run the pre-change code until `/reload`.
- `agent_settled` only queues the compaction when `pendingContinuationPath` was set during publish, so no separate gate is needed there.
- Explicit `"autoContinue": true/false` is written on toggle (never deleted), matching `trackArtifacts` style; `updateConfig()` preserves the other fields.
- Test commands that worked: `node --experimental-strip-types --test tests/*.test.ts`; targeted: `--test-name-pattern "Drift configuration"` on tests/drift.test.ts and `--test-name-pattern "profiled"` on tests/pi-runtime.test.ts (5 runtime tests, all pass).
- Concurrent working-tree changes NOT authored by this thread and deliberately left uncommitted: package.json, package-lock.json, scripts/build-changelog.py, scripts/build-index.py, scripts/check-staleness.py, tsconfig.json (the measured baseline was clean; these appeared during the interval from outside this session).

## What Deviated from Plan

The first implementation defaulted the switch to on (preserving old behaviour); the user then asked for off as the default, so the gate, messages, docs and tests were flipped in the same session.

## Open Questions

None for this feature. The untouched concurrent files above are presumed the user's own in-flight work.

## Next Steps

1. Nothing remains for this feature. `/reload` any open Pi session on this checkout to pick up the new publisher behaviour.
2. If the concurrent package.json / scripts / tsconfig.json changes are yours, commit them separately; they are intentionally outside this feature's commit.
