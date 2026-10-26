---
date: "2026-10-26T22:52:41+00:00"
branch: "main"
git_commit: "c70cc698103f925527eeedcc29fe0a3b87b00037"
feature: "auto-continue"
sequence: "009"
type: "handoff"
status: "complete"
session_started: "2026-10-26T14:48:48+00:00"
session_id: "01a178af-79e0-72b3-9510-20be4e200641"
interval_id: "ae0d7cce-d45b-4fb1-b1a7-9430df8b0b1b"
start_branch: "main"
start_commit: "3e32c2536800e351914b1631bd25867b4e11d301"
related_artifacts: ["drift/auto-continue/008-handoff-target-warning-once-per-plan-and-unslopped.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"not-applicable","eligible":0,"captured":0,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
---

## Objective

Fix the blast_2.0 thread getting stuck after it published a handoff with auto-continue on. The fix is committed as `c70cc69` and the user confirmed it works live.

## Source Documents
- drift/auto-continue/008-handoff-target-warning-once-per-plan-and-unslopped.md is the other thread's open chain. This handoff does not supersede it. It resolves 008's first open question: the adoption test that failed was this thread's.

## Status
- **Completed:** root cause, fix, tests, live check by the user (qwen, blast_2.0 thread), and commit `c70cc69` on `main`. Not pushed.
- Tests: the fix alone on top of `3e32c25` passes `npm test` with 142 pass, 0 fail, 4 skipped. This was run in a temporary detached worktree that has since been removed. The full working tree, with the other threads' uncommitted 006 to 008 work included, passes with 147 pass, 0 fail, 4 skipped.

## What Changed
Commit `c70cc69` contains only this thread's hunks, staged from a patch built against HEAD:
- `extensions/drift.ts`, drift_publish `execute()`: returns `terminate: autoContinue`. A queued continuation now ends the publishing run after that tool batch, so the model gets no further turn.
- `extensions/drift.ts: worktreeAction()`: the refusal to adopt while a continuation is queued now reads "Handoff X is published and a fresh context window is queued from it; it starts when this turn ends. End your turn now…". The old text was "finish it before switching worktrees".
- `extensions/drift.ts`, `context` handler: the context note now says "Only when assigned a different linked worktree, call drift_worktree adopt…; the current one needs no adoption."
- `tests/pi-runtime.test.ts`:
  - The auto-continue test expects 1 request from the publishing run instead of 2.
  - The fixture `PUBLISH_AUTO_THEN_ADOPT` now publishes beside a `read`, so the batch does not terminate and the adopt refusal is still exercised. That test now matches the new message.

The working tree still holds the other threads' uncommitted 006 to 008 changes, including their own edits to `extensions/drift.ts` and `tests/pi-runtime.test.ts`. They were left unstaged.

## Codebase Context
- Root cause: the continuation can only start once the run settles (`agent_before_settle` appends the boundary, then `agent_settled` sends `drift-continue`). Nothing forced the run to end, so a model that kept calling tools stalled it forever.
- Evidence from the blast_2.0 session logs (`~/.pi/agent/sessions/--home-blackhand-projects-blast_2.0--/`):
  - qwen3.6-35b-a3b made 98 `drift_worktree` calls, nearly all refused adopts of the worktree it was already in.
  - claude-opus-5.5 made 0 `drift_worktree` calls across 8 publishes.
  - The trigger depends on the model. The stall was Drift's.
- `terminate` only takes effect when every result in the batch sets it (`pi-agent-core` `shouldTerminateToolBatch`). If publish shares a batch with another tool, the run continues, and the reworded refusal is the fallback.
- Pi loads Drift straight from `~/projects/drift` (`~/.pi/agent/settings.json` packages), so already-open threads need `/reload` to pick up the change.
- `~/projects/blast_2.0/.drift.json` sets a `/drift-model-override` of `spark/qwen3.6-35b-a3b` (high), set 2026-10-26 12:25. That is why the blast thread ran on qwen, not on the Opus the user expected.

## What Deviated from Plan
- No plan for this fix. A blanket `tool_call` block while a continuation is queued was rejected: it would also block a user message typed after the publish, which `agent_before_settle` deliberately lets run first.

## Open Questions
- blast_2.0's qwen override: keep it, clear it with `/drift-model-override off`, or override to Opus? Without an override, handoff 013's `research` profile maps to `github-copilot/gemini-3.8-flash`.

## Next Steps
1. The 008 thread can drop its "fix its adoption test" step: `npm test` is now 0 failures on the full tree.
2. Push `c70cc69` when the user asks.
