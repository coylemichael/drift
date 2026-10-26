---
date: "2026-10-26T12:51:56+00:00"
branch: "main"
git_commit: "3e32c2536800e351914b1631bd25867b4e11d301"
feature: "auto-continue"
sequence: "006"
type: "handoff"
status: "superseded"
superseded_by: "drift/auto-continue/007-handoff-breakpoints-and-acceptance-criteria-stop-the-chain.md"
session_started: "2026-10-26T10:26:29+00:00"
session_id: "01a177bf-50cd-70ea-9236-6d96a8257206"
interval_id: "26ef03cf-fd14-414f-82f7-bbdbcf747877"
start_branch: "main"
start_commit: "3e32c2536800e351914b1631bd25867b4e11d301"
previous_handoff: "drift/auto-continue/005-handoff-two-mode-continuation-built-live-check-pending.md"
related_artifacts: ["drift/auto-continue/004-plan-two-mode-continuation-drift-pickup-and-profiled-auto.md"]
next_session_profile: "implementation"
anchor_coverage: {"status":"complete","eligible":1,"captured":1,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
anchors: [{"path":"docs/shared-files-plan.html","start":106,"end":106,"sha256":"1fb17a03f671b9ce01dea15e1b6e1b5b8d631b6f8cf1e0a771393e19cb7da305","context":["  <li><code>hosts/claude.md</code> and the skill carry the same one-line <code>git config</code> for hosts without the extension.</li>","  <li><code>hosts/claude.md</code> and the skill carry the same one-line <code>git config</code> for hosts without the extension.</li>"]}]
---

## Objective

Review and finish the uncommitted continuation changes: `/drift-model-override` (written in another thread), the 60% context handoff request, and the user's two follow-up rules from this session:
1. Drift always asks for a handoff once context passes 60%, whether or not auto-continue is on.
2. With no profile and no override set, continuation uses the model in use.

## Source Documents
- drift/auto-continue/004-plan-two-mode-continuation-drift-pickup-and-profiled-auto.md
- drift/auto-continue/005-handoff-two-mode-continuation-built-live-check-pending.md (superseded by this one; its live check is carried below)

## Status
- **Completed:** reviewed the other thread's override and nudge diff. Applied the two user rules, updated the wording in the docs, skill and extension text, and updated the tests. `npm test`: 145 pass, 0 fail, 4 skipped. The skipped tests need `pi-acp` in the test environment, or a file held open by an editor; they were skipped before this change too.
- **Not done:** nothing is committed. Typecheck not run: the repo has no `node_modules`, `tsc` is absent, and `npx tsc` refuses. The Pi API calls were checked by hand against `@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`. The live checks are not done.
- **Outside the repo (done):** the Zed adapter at `~/.local/share/pi-acp-context` predated `~/dotfiles/zed/pi-acp/extension-commands.patch`, so Zed rejected `/drift-auto-continue`. Re-running `~/dotfiles/zed/pi-acp/install.sh` applied `extension-commands` and `tool-titles` (142 adapter tests pass). The user confirmed the commands now work in Zed.

## What Changed
Uncommitted on `main` (= `origin/main` at 3e32c25; verified with `git fetch`, so no rebase is needed). The override and nudge code came from another thread; this session changed it as follows:
- `lib/routing.ts: readHandoffRoute()` — the `allowUnprofiled` parameter is removed. A handoff without `next_session_profile` now returns `{ path }` instead of throwing.
- `extensions/drift.ts: continueHandoff()` — model order is: pin, then the named profile (still fails visibly if unconfigured), then no `setModel`, keeping the model in use. Continuation happens in the same Pi session (compaction boundary in `agent_before_settle`, then `sendUserMessage("drift-continue …")` in `agent_settled`), so "in use" means "unchanged".
- `extensions/drift.ts: continuationTarget()` — the unprofiled, unpinned case now reports `Next model: the one in use, <provider/id> (<thinking>)`.
- `extensions/drift.ts: handoffNudge()` — the `autoContinue` gate is removed. The wording depends on mode: auto ("so a fresh context window continues the work"), manual ("then tell the user to run /drift"). A failure to read profiles no longer suppresses the nudge.
- `extensions/drift.ts` drift_publish `execute` — `autoContinue` no longer requires a profile or a pin. The "names no next_session_profile, so nothing is queued" branch is removed.
- Wording: `promptGuidelines`, the `/drift-auto-continue` description, `profileNote()`; `lib/state.ts: setAutoContinue()` messages and the `DriftConfig.autoContinue` doc ("each open handoff"); `docs/continuation.md`; `README.md` (command table adds `/drift-model-override`, plus the chain paragraph and decision-checkpoint line); `skills/drift/hosts/pi.md`; `skills/drift/SKILL.md`, `handoff.md`, `execute.md` (pending-decision rule, below).
- Tests: `tests/drift.test.ts` (unprofiled route resolves; new setAutoContinue text). `tests/pi-runtime.test.ts`:
  - The threshold test now runs with auto-continue off.
  - New test: an unprofiled handoff continues on `drift-fixture/fixture`.
  - The profiled-continuation tail now checks that a named but unconfigured profile still makes no request.
  - The chain test now expects 3 boundaries: the final unprofiled handoff continues once, then the chain stops. It captures the record before that continuation opens a new interval.

## Codebase Context
- The override is stored as `model`/`thinkingLevel` in `.drift.json`, validated by `lib/state.ts: rawConfig()`.
- `HANDOFF_AT = 0.6` lives in `extensions/drift.ts`. The note is appended in the `context` handler. The `turn_end` handler sends one steering message and re-arms below the threshold.
- This repo's `.drift.json` has `trackArtifacts` only, so auto-continue is off here and this handoff queues nothing.

## What Deviated from Plan
- Plan 004's "unprofiled handoff never auto-continues" rule no longer holds. Every open handoff continues when auto-continue is on.
- Because of that, the "omit the profile to keep the session waiting on a user decision" escape hatch is gone. The skill now says not to publish an open handoff while a decision is pending; ask and wait instead.

## Open Questions
- **Nudge with auto-continue off.** The user said 60% "should always be a thing", and I read that as covering manual mode too, so the model publishes and stops. Confirm with the user.
- **Stopping with auto-continue on.** An open handoff can't be published to wait for a user decision while auto-continue is on. Should there be a "stop" path, or is `/drift-auto-continue off` enough?
- **Untracked Claude-era artifacts.** `drift/claude-host/`, `drift/install-and-hooks/` and `drift/model-routing/` (Sep 12–14) were never in git or on origin and nothing references them. The user says Claude support is meant to be gone. Delete them (irreversible) or commit them? I left them untouched.
- **Stale plan doc.** `docs/shared-files-plan.html:106` still mentions `hosts/claude.md`. The other "claude" hits in the repo are model IDs.
- **Concurrent edits.** Another thread was working on `/drift-model-override`. Check `git diff` for overlapping edits before committing.

## Next Steps
1. Get the user's answers on the open questions, especially deleting the three untracked dirs and the manual-mode nudge.
2. `npm ci && npm run typecheck`, then `npm test`.
3. Commit when the user asks. Suggested split: `feat: /drift-model-override and 60% handoff request`, then `feat: continuation falls back to the model in use`.
4. Live check, carried over from handoff 005 and extended. In a repo with `/drift-auto-continue on`, in Zed after a thread restart:
   - a profiled handoff continues on its mapped model (005's list: publish text, a `compaction` entry with `fromHook: true` and `firstKeptEntryId` equal to its id, a small first request);
   - an unprofiled handoff continues on the model in use;
   - `/drift-model-override current` pins the model, and the next handoff reports "pinned";
   - passing 60% sends one "Drift: Context is …" steering message.
5. If all of that passes, set plan 004 to `complete` and publish a `complete` handoff.
