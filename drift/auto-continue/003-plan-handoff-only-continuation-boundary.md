---
date: "2026-10-19T21:17:10+01:00"
branch: "main"
git_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
feature: "auto-continue"
sequence: "003"
type: "plan"
status: "superseded"
superseded_by: "drift/auto-continue/004-plan-two-mode-continuation-drift-pickup-and-profiled-auto.md"
session_started: "2026-10-14T21:59:11+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "a08f00e6-3f51-44a8-bc20-6ab624f50b28"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
source_research: "drift/auto-continue/002-research-handoff-boundary-instead-of-compaction.md"
related_artifacts: ["drift/auto-continue/001-handoff-manual-default-and-switch.md"]
anchor_coverage: {"status":"partial","eligible":15,"captured":13,"skipped_count":2,"skipped_by_reason":{"file-not-found":2},"skipped":[{"reference":"dist/core/extensions/types.d.ts:768-800","reason":"file-not-found"},{"reference":"dist/core/agent-session.js:579-604","reason":"file-not-found"}]}
anchors: [{"path":"extensions/drift.ts","start":41,"end":42,"sha256":"9ef113241eaafeecc976c9f393167d220363160ac44514471403d973df2c62d1","context":["  let pendingContinuationPath: string | undefined;","  let continuationQueued = false;"]},{"path":"extensions/drift.ts","start":61,"end":64,"sha256":"e265cea77941ef2baf1f38522899ddfff732fe865f297f75b824c3adea745c1a","context":["      probedEmpty = false;","      continuationQueued = false;"]},{"path":"extensions/drift.ts","start":252,"end":284,"sha256":"b85ca033eba746827022cfce47e9b46654ed01bad7036add12f71b4ef1d17c8c","context":["  async function continueHandoff(args: string, ctx: ExtensionContext) {","  }"]},{"path":"extensions/drift.ts","start":386,"end":393,"sha256":"1145c741da3abdbd38c68b1d93b25723a6d408fa02e01cba6f391b6803b81aba","context":["  pi.on(\"input\", async (event, ctx) => {",""]},{"path":"extensions/drift.ts","start":470,"end":481,"sha256":"95f94b9339f511193deddcd4f93e29c8bfd2de9b2205357dbcec0544f6e12c3a","context":["  async function guardSummary(_event: unknown, ctx: ExtensionContext) {","  pi.on(\"session_before_tree\", guardSummary);"]},{"path":"extensions/drift.ts","start":483,"end":505,"sha256":"f58aa279fadc81b40a4c3231d3863ac129d8d9aaee08d9db31088478108126d5","context":["  pi.on(\"agent_settled\", async (_event, ctx) => {","  pi.on(\"session_shutdown\", async (event, ctx) => checkpoint(`detach:${event.reason}`, ctx));"]},{"path":"extensions/drift.ts","start":586,"end":594,"sha256":"73e7a9aa06f190b1666ac5fe6d257db3d6456d03f1950a74a2422f2da22469b4","context":["        }","          : profiled && !held ? `\\nAutomatic continuation is off (the default; /drift-auto-continue on enables it). Nothing is queued; the user decides when and where to continue with: drift-continue ${receipt.path}` : \"\";"]},{"path":"extensions/drift.ts","start":350,"end":350,"sha256":"a09387db13b5dc73604f5d64fb57f1253277fb86d02b18b6933d65bb5a05b001","context":["    description: \"Whether publishing a profiled handoff automatically compacts and continues in a fresh context window (off by default): on, off or status\",","    description: \"Whether publishing a profiled handoff automatically compacts and continues in a fresh context window (off by default): on, off or status\","]},{"path":"lib/state.ts","start":180,"end":180,"sha256":"abec49dc88795b14909f84e29af13bb017854899c4cef6872a411a57c7a9b499","context":["  /** Whether publishing a profiled handoff compacts and continues in a fresh context window itself. Off unless the repo opts in. */","  /** Whether publishing a profiled handoff compacts and continues in a fresh context window itself. Off unless the repo opts in. */"]},{"path":"tests/pi-runtime.test.ts","start":181,"end":181,"sha256":"79d1a8aca54d9ae03ea5af4cf594274543f6d484fa2b96157e35d01ee3fb4e24","context":["  await fs.writeFile(join(agent, \"settings.json\"), JSON.stringify({ packages: [root], defaultProvider: \"drift-fixture\", defaultModel: \"fixture\", defaultThinkingLevel: \"off\", quietStartup: true, enableInstallTelemetry: false, defaultProjectTrust: \"never\", compaction: { enabled: false, keepRecentTokens: 100, reserveTokens: 128 }, retry: { enabled: false } }));","  await fs.writeFile(join(agent, \"settings.json\"), JSON.stringify({ packages: [root], defaultProvider: \"drift-fixture\", defaultModel: \"fixture\", defaultThinkingLevel: \"off\", quietStartup: true, enableInstallTelemetry: false, defaultProjectTrust: \"never\", compaction: { enabled: false, keepRecentTokens: 100, reserveTokens: 128 }, retry: { enabled: false } }));"]},{"path":"README.md","start":67,"end":67,"sha256":"a09f36aac308ca859c7c630762ff5539ecccd1577ebba9b9e47ac6bb318ba692","context":["| `/drift-auto-continue on\\|off\\|status` | Whether publishing a profiled handoff automatically compacts and continues in a fresh context window. Off by default: you decide if a handoff goes into a new thread. ([details](docs/continuation.md)) |","| `/drift-auto-continue on\\|off\\|status` | Whether publishing a profiled handoff automatically compacts and continues in a fresh context window. Off by default: you decide if a handoff goes into a new thread. ([details](docs/continuation.md)) |"]},{"path":"docs/continuation.md","start":16,"end":24,"sha256":"fbc47e4e742b3be52b3afce731637cafe7dd49ed9d39705fde059b0cb620ffa5","context":["`/drift-auto-continue on` opts a repository in, recording `\"autoContinue\":",""]},{"path":"skills/drift/hosts/pi.md","start":39,"end":39,"sha256":"121e34605ed8c480b9d129fa87d3e9d9543389e570869b372266b5116a7b57e7","context":["For a handoff whose work remains (`in-progress`), by default a profiled handoff is only published: the tool result says nothing is queued; report the `drift-continue <artifact path>` command for the user to run when they choose, then stop. Where `.drift.json` sets `autoContinue: true` (`/drift-auto-continue on`), Pi queues the next fresh context window automatically after `drift_publish` succeeds; report that, and do not ask the user to copy/paste a continuation command. `/drift-auto-continue [on|off|status]` is a user command handled by the extension; suggest it rather than editing `.drift.json` yourself. After compaction, Pi uses `drift-continue` internally to validate the repository-local artifact, resolve its `next_session_profile` through the receiving machine's explicitly configured model map, select the mapped model and thinking level **before** inference, then follow the ordinary handoff workflow from the artifact's Next Steps. Missing/invalid profiles, unavailable models or failed authentication fail visibly without inference and leave the handoff available for manual recovery with `drift-continue <published artifact path>`. See the README for the local configuration format.","For a handoff whose work remains (`in-progress`), by default a profiled handoff is only published: the tool result says nothing is queued; report the `drift-continue <artifact path>` command for the user to run when they choose, then stop. Where `.drift.json` sets `autoContinue: true` (`/drift-auto-continue on`), Pi queues the next fresh context window automatically after `drift_publish` succeeds; report that, and do not ask the user to copy/paste a continuation command. `/drift-auto-continue [on|off|status]` is a user command handled by the extension; suggest it rather than editing `.drift.json` yourself. After compaction, Pi uses `drift-continue` internally to validate the repository-local artifact, resolve its `next_session_profile` through the receiving machine's explicitly configured model map, select the mapped model and thinking level **before** inference, then follow the ordinary handoff workflow from the artifact's Next Steps. Missing/invalid profiles, unavailable models or failed authentication fail visibly without inference and leave the handoff available for manual recovery with `drift-continue <published artifact path>`. See the README for the local configuration format."]}]
---

## Objective

Make Drift's automatic continuation start the next task from the published handoff alone: replace the LLM `ctx.compact()` call with a deterministic retain-none handoff boundary, so no summary of the old conversation and no retained transcript tail reach the next window.

## Source Research

- drift/auto-continue/002-research-handoff-boundary-instead-of-compaction.md

## Starting Point

Begin with step 1 (the extension boundary). It is the only behaviour change; steps 2–3 pin and describe it. Use the research's Option 1, which matches the user's stated intent that handoffs replace compaction. Options 2 (new Pi session per hop) and 3 (shrinking `keepRecentTokens`) are rejected; see Decisions.

## Key Files

- extensions/drift.ts:41-42 — `pendingContinuationPath` / `continuationQueued` state
- extensions/drift.ts:61-64 — state reset on session identity change
- extensions/drift.ts:252-284 — `continueHandoff`: profile → `setModel` before inference → continuation prompt (unchanged)
- extensions/drift.ts:386-393 — bare `drift-continue` input handler (unchanged)
- extensions/drift.ts:470-481 — `guardSummary` (keep; still guards user/threshold compaction)
- extensions/drift.ts:483-505 — `agent_settled` → `ctx.compact` → `drift-continue` (to replace)
- extensions/drift.ts:586-594 — publish-time queue decision and result text
- extensions/drift.ts:350, 489, 539, 574 — command description, comments, promptGuidelines wording
- lib/state.ts:180, 244-256 — `autoContinue` doc comment, status/toggle text
- tests/pi-runtime.test.ts:181 (fixture settings), 555-574, 1025-1055, 1173-1199 — runtime coverage to update
- README.md:67, 208; docs/continuation.md:16-24; skills/drift/hosts/pi.md:39 — user/agent-facing descriptions
- Installed Pi reference (outside repo): dist/core/extensions/types.d.ts:768-800 (`CompactionEntryDraft`, `agent_before_settle`), dist/core/agent-session.js:579-604, 1536-1558

## Implementation Sequence

1. **Handoff boundary at `agent_before_settle` (extensions/drift.ts:483-505).**
   - Register `pi.on("agent_before_settle", …)`. Do nothing unless a continuation is pending, no boundary has been appended for it yet, and the record has no `failure`.
   - If `event.context.pendingMessages.length > 0`, append nothing: queued user input runs first with its context, and the boundary is appended at that run's settle. This matches today's `agent_settled` timing.
   - Otherwise return `{ entries: [...event.entries, { type: "compaction", summary, firstKeptEntryId: null, details: { drift: "handoff-boundary", artifact } }] }`. Never return `continue: true`, because the model must be switched by `drift-continue` before inference. Record which artifact got the boundary, in new state that is reset alongside the existing state at :61-64.
   - The `summary` is a fixed, short note, for example: "Drift handoff boundary. The previous work interval ended by publishing `<artifact>`. Its conversation is intentionally not carried forward; the handoff and the artifacts it references are the complete context for the next task."
   - In `agent_settled`, keep the checkpoint. If the boundary was appended for the pending artifact, set `continuationQueued` and send `drift-continue <artifact>` via `pi.sendUserMessage`, keeping the identity check and the existing error notify/reset.
   - If no boundary was appended, do not continue into the unbounded context. Clear the queue and notify that automatic continuation did not start, with the manual `drift-continue <artifact>` recovery in a fresh thread.
   - Remove the `ctx.compact` call.
   - Verify: `npm run typecheck`, then the runtime test from step 2.

2. **Runtime tests (tests/pi-runtime.test.ts). Depends on step 1.**
   - In 555-574: the `compaction` entry has `firstKeptEntryId === id`, `fromHook === true`, and a summary containing the artifact path. No provider request other than the profiled continuation is sent between publication and continuation, so there is no summarizer request. The continuation request's messages exclude the pre-boundary prompt `PUBLISH_AUTO_HANDOFF` and include the boundary note.
   - In 1173-1199: both compaction entries are retain-none, and each continuation request excludes earlier hops' prompts.
   - Update the comment at 1034. 576-593 and 595-666 must still see no compaction entry.
   - Optional, if the fixture can queue a follow-up during the publishing run: the follow-up runs with prior context and the boundary lands at the later settle.
   - Verify: `node --experimental-strip-types --test tests/pi-runtime.test.ts`.

3. **Wording and docs. Disjoint from steps 1–2 except extensions/drift.ts:350/539.**
   - Replace "compacts to a fresh context window" phrasing with "starts a fresh context window from the handoff (no summary of the previous conversation; raw history stays in the session file)". Apply this to extensions/drift.ts:350, 489, 539, 574; lib/state.ts:180, 247, 253; README.md:67, 208; docs/continuation.md:16-24; skills/drift/hosts/pi.md:39 ("After compaction" → "After the handoff boundary").
   - Grep tests/drift.test.ts for the asserted `setAutoContinue` strings and update them to match.
   - Verify: `npm test` and `npm run typecheck`.

4. **Full verification and live check.**
   - Run `npm test`, `npm run typecheck`, `npm run lint`.
   - After `/reload` in a session on an `autoContinue` repo (e.g. Rig), confirm on the next profiled handoff that:
     - the session log has a `compaction` entry with `firstKeptEntryId` equal to its own id, `fromHook: true` and no summarizer `usage`;
     - the first continuation request is roughly system prompt + boundary note + continuation prompt, with no 35–80 s summarizer gap.
   - Publish the completing handoff with a changelog entry (Changed): "Automatic continuation now starts the next task from the handoff alone: no LLM summary of the previous conversation and no retained transcript tail."

## Decisions & Constraints

- **Option 1 chosen:** a retain-none `CompactionEntryDraft` (`firstKeptEntryId: null`) at `agent_before_settle`, in the same Pi session.
  - It keeps one Pi session ID, Drift record, intercom identity and the existing `drift-continue` model selection.
  - `newSession` is command-only (deadlock risk from lifecycle handlers) and would change the session, record and intercom identity on every hop.
  - `CompactOptions` has no keep option, and `keepRecentTokens` is the user's setting, not Drift's.
- **No LLM call.** The boundary is deterministic text appended with `fromHook: true`, and `session_before_compact` does not fire for it.
- **Never continue on the old transcript.** If the boundary is missing, fall back to the visible manual recovery.
- **Unchanged:** profile resolution and model/thinking selection before inference (`continueHandoff`), the publish-time queue rules (profiled, not complete, not held), landing order, the adoption hold while queued, and `guardSummary` for user/threshold compaction.
- **Raw history is preserved.** The boundary hides it from model context only. Never delete session logs or Drift records.
- **Pi floor:** `agent_before_settle` and retain-none compaction arrived in Pi 0.87.0. The dev-dependency floor `^1.1.0` already covers them, so no bump is needed.
- **Rollout:** running sessions (e.g. Rig `01a13c39`) keep the old code until `/reload`.

## Open Questions

- **Manual `drift-continue`.** Should it also start a handoff-only boundary when typed into a thread with prior conversation? Not in scope: there is no boundary event before the first request of a new run, and the existing guidance is "run it in a fresh thread".
- **Aborted runs.** Should an aborted run (Escape) after a successful handoff still continue automatically? The plan keeps current behaviour (the outcome is ignored) unless the user decides otherwise.
