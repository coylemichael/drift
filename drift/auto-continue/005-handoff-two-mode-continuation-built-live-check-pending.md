---
date: "2026-10-20T00:23:18+01:00"
branch: "main"
git_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
feature: "auto-continue"
sequence: "005"
type: "handoff"
status: "superseded"
superseded_by: "drift/auto-continue/006-handoff-continuation-always-nudges-and-falls-back-to-model-in-use.md"
session_started: "2026-10-14T21:59:11+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "a08f00e6-3f51-44a8-bc20-6ab624f50b28"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
source_research: "drift/auto-continue/002-research-handoff-boundary-instead-of-compaction.md"
related_artifacts: ["drift/auto-continue/004-plan-two-mode-continuation-drift-pickup-and-profiled-auto.md","drift/auto-continue/003-plan-handoff-only-continuation-boundary.md","drift/auto-continue/001-handoff-manual-default-and-switch.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"complete","eligible":1,"captured":1,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
anchors: [{"path":"docs/shared-files-plan.html","start":209,"end":209,"sha256":"ee99d161402f38204fdc070de9dc7f01427d8812c64b4992e720591fe85c9b69","context":["<p>Order in the automatic chain: publish handoff → land → compaction → <code>drift-continue</code>. A real conflict in a non-derived file, or the guard tripping, halts the chain there: the handoff stays published, the record is checkpointed, and the thread reports exactly what blocked. That is the same rule Drift applies to a pending user decision. Pushing is the one outward-facing act in this plan, so it follows the <code>trackArtifacts</code> pattern: one explicit line per repository, never inferred.</p>","<p>Order in the automatic chain: publish handoff → land → compaction → <code>drift-continue</code>. A real conflict in a non-derived file, or the guard tripping, halts the chain there: the handoff stays published, the record is checkpointed, and the thread reports exactly what blocked. That is the same rule Drift applies to a pending user decision. Pushing is the one outward-facing act in this plan, so it follows the <code>trackArtifacts</code> pattern: one explicit line per repository, never inferred.</p>"]}]
---

## Objective

Implement plan 004. Drift continuation works in two clear modes:
- **Manual:** `/drift` (or `/drift <file/link>`) picks up work on the user's selected model.
- **Automatic** (`/drift-auto-continue on`): each profiled handoff starts a fresh context window from the handoff alone (a retain-none boundary, with no LLM summary and no transcript tail), on the model the user's profile map assigns. That model is named in the status and publish messages.

## Source Documents

- drift/auto-continue/004-plan-two-mode-continuation-drift-pickup-and-profiled-auto.md (executed; `in-progress`)
- drift/auto-continue/002-research-handoff-boundary-instead-of-compaction.md
- drift/auto-continue/003-plan-handoff-only-continuation-boundary.md (superseded by 004)

## Status

- **Completed and verified:** plan steps 1–5 (boundary, manual-mode messages, profile/model naming, docs, tests).
  - `npm run typecheck` is clean.
  - `npm test`: 164 pass, 0 fail, 9 skipped.
- **In progress:** step 6, the live check.
  - Rig (Zed/ACP, session `01a13c39`) has been restarted and now runs this working-tree code. Its 2026-10-19 23:18Z publication of handoff 042 returned the new wording: "Handoff complete: there is no open work to continue. Nothing is queued."
  - 042 is a `complete` gate handoff, so correctly nothing was queued. The retain-none boundary has **not yet been observed live**. It needs the next `in-progress` profiled handoff in an `autoContinue` repo.
- **Not started:** completing plan 004 after the live check. Committing (not requested).

## What Changed

- extensions/drift.ts
  - **Boundary helper.** Module-level `handoffBoundary(artifact)`: the fixed note that is the only context a fresh window inherits.
  - **State.** New `boundaryAppended`, reset wherever `pendingContinuationPath` resets.
  - **Profile helpers.** `profileSources`, `profileNote` (for `/drift-auto-continue` while on) and `continuationTarget` (the "Next model: profile X → provider/model (thinking), from <file>" line in publish results).
  - **`continueHandoff`.** Now uses `profileSources`. Missing-profile, unavailable-model and auth errors name the file and add "run /drift <handoff> to pick it up on the model you have selected". The notify reads `Drift profile <name> → <provider/model> (thinking)`.
  - **`/drift-auto-continue` command.** Description reworded. When on, its message appends the profile list.
  - **New `agent_before_settle` handler.** It returns `[...event.entries, { type: "compaction", summary, firstKeptEntryId: null, details: { drift: "handoff-boundary", artifact } }]`. It skips when nothing is pending, a boundary was already appended, the record failed, or `event.context.pendingMessages` is non-empty.
  - **`agent_settled`.** No longer calls `ctx.compact`. It sends the internal `drift-continue <artifact>` only if the boundary was appended. Otherwise it clears the queue and warns "Run /drift <artifact> …".
  - **Wording.** The worktree status recovery text, promptGuidelines, the land-conflict text and the publish continuation texts were reworded:
    - **Closed:** "Nothing is queued."
    - **Queued:** "A fresh context window is queued from this handoff alone; no summary of this conversation is carried." plus the Next model line.
    - **Off or unprofiled:** "The user runs /drift … on the model they have selected."
- lib/routing.ts: new `modelProfileSources(repo, agentDir, trusted, dir)` (`{ files, defaultFile, profiles }`) and `describeProfile(name, profile)`.
- lib/state.ts: the `autoContinue` doc comment and `setAutoContinue` status/on/off texts (in `setAutoContinue`, ~lines 244-256) now describe the two modes. There are no `drift-continue`/compaction mentions.
- README.md, docs/continuation.md (rewritten: Manual pickup / Automatic continuation / Closed handoffs / Model profiles), docs/worktrees.md, skills/drift/hosts/pi.md:
  - two-mode wording;
  - the `drift-continue` row is removed from the README commands table;
  - `drift-continue` is mentioned only as the internal step.
  - Done by a worker sub-agent and reviewed.
- tests/pi-runtime.test.ts
  - **Auto-continue test.** It asserts:
    - the boundary is retain-none (`firstKeptEntryId === id`), `fromHook`, and carries the right details and summary;
    - exactly 2 requests happen before the continuation, so no summarizer runs;
    - the non-system context has no `PUBLISH_AUTO_HANDOFF` and no tool messages;
    - the publish result names the profile, model and file.
  - **Manual-default test.** It now asserts the "/drift … on the model they have selected" result and that `/drift` picks up on model `fixture` (no profile switch).
  - **Chain test.** It asserts both boundaries are retain-none. The adoption-test comment is updated.
- tests/drift.test.ts: `modelProfileSources`/`describeProfile` unit checks, and the new `setAutoContinue` texts.

## Codebase Context

- **Pi boundary API (installed Pi 1.2.0; introduced in 0.87.0).**
  - `agent_before_settle` handlers chain: return `entries: [...event.entries, draft]`, because a returned array replaces the previous one.
  - Compaction drafts are written by `appendCompaction(..., fromHook=true)`, with no LLM call and no `session_before_compact`.
  - `pi.sendUserMessage` during `agent_settled` is deferred until settlement ends (`agent-session.js` `_emitAgentSettled`), so the IIFE's `.catch` won't see later failures. `continueHandoff` notifies its own errors.
- **Test gotcha.** A continuation request's `messages` include the system prompt, which mentions `drift_publish`. Filter `role !== "system"` before asserting the old transcript is absent.
- **Commands that worked.**
  - `npm run typecheck`
  - `node --experimental-strip-types --test tests/drift.test.ts` (~40 s)
  - `npm test` (full suite including actual-Pi runtime tests)
  - Targeted: `node --experimental-strip-types --test --test-name-pattern "handoff-only context boundary|repeats handoff continuation|refuses adoption while a profiled" tests/pi-runtime.test.ts`
  - `npm run lint` fails here only because `ruff` is not installed. It lints Python scripts, and none were touched.
- **Rollout.** Pi loads Drift from this OneDrive checkout's working tree. Under Zed/ACP, restarting Zed reloads it; in the TUI, `/reload` does.
- **Live inspection of a session log.** Python over `~/.pi/agent/sessions/<cwd-dir>/<file>.jsonl`. Check for:
  - `compaction` entries: `fromHook`, `firstKeptEntryId == id`, `details`, and the absence of `usage`;
  - the first assistant `usage` after the entry;
  - the gap between the last message and the compaction.
- **Rig observations (2026-10-19).**
  - Handoffs 038–041 ran on the old code before the restart: LLM compaction, 46–54 s gaps, 37–65 kept entries, first request ≈ 52–57k tokens.
  - "We're ready to continue /drift" is plain chat, not a `/drift` pickup, because the command must start the message.
  - 042 declares `next_session_profile: "review"`, which is not in the user's map (research/planning/implementation). A future `in-progress` handoff naming it would now report "profile "review" is not configured …" at publish time.
- **Left as is.** `docs/shared-files-plan.html:209` still says "compaction → drift-continue" (historical design page). The `docs/continuation.md` example map still shows `claude-opus-5`, labelled as an example; the user's real map uses `claude-opus-5.5`.

## What Deviated from Plan

- **Manual-mode text.** It is also shown for unprofiled in-progress handoffs. When `autoContinue` is on but the handoff has no profile, it says "This handoff names no next_session_profile, so nothing is queued."
- **No-boundary fallback.** It warns rather than silently dropping.
- **pi.md.** It dropped the "older unprofiled handoff: core manual resume" sentence; `/drift <path>` covers every handoff.
- **Escape.** Behaviour after a published handoff is unchanged, per the user ("odd and not very agentic"); the open question is closed.

## Open Questions

- None blocking.
- Whether to commit now or after the live check is the user's call.

## Next Steps

1. **Live check.** At the next `in-progress` profiled handoff in an `autoContinue` repo (Rig's next chain, after Michael's 0.3 inspection and a new plan), confirm:
   - the publish result has "A fresh context window is queued from this handoff alone …" and "Next model: profile implementation → github-copilot/claude-opus-5.5 (high), from …drift-model-profiles.json";
   - the session log shows a `compaction` entry with `firstKeptEntryId` equal to its id, `fromHook: true`, `details.drift == "handoff-boundary"` and no `usage`;
   - continuation within seconds;
   - the first continuation request is small (system prompt + boundary note + continuation prompt).
   Optionally also run `/drift-auto-continue status` in a TUI session to see the profile list.
2. **If the check passes,** set plan 004 to `complete` and publish a `complete` handoff. No new changelog entry is needed; the fragment was recorded with this handoff.
3. **If it fails,** capture the log evidence and fix in `extensions/drift.ts` (`agent_before_settle`/`agent_settled`).
4. **Commit** the 9 changed files when the user asks.
