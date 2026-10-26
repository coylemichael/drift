---
date: "2026-10-19T21:29:09+01:00"
branch: "main"
git_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
feature: "auto-continue"
sequence: "004"
type: "plan"
status: "complete"
session_started: "2026-10-14T21:59:11+01:00"
session_id: "01a13c36-3c70-7052-9825-2ca6aeedb072"
interval_id: "a08f00e6-3f51-44a8-bc20-6ab624f50b28"
start_branch: "main"
start_commit: "5e09cf167a06fe596a420c798b852d34f26de984"
source_research: "drift/auto-continue/002-research-handoff-boundary-instead-of-compaction.md"
related_artifacts: ["drift/auto-continue/001-handoff-manual-default-and-switch.md","drift/auto-continue/003-plan-handoff-only-continuation-boundary.md"]
anchor_coverage: {"status":"complete","eligible":18,"captured":18,"skipped_count":0,"skipped_by_reason":{},"skipped":[]}
anchors: [{"path":"extensions/drift.ts","start":41,"end":42,"sha256":"9ef113241eaafeecc976c9f393167d220363160ac44514471403d973df2c62d1","context":["  let pendingContinuationPath: string | undefined;","  let continuationQueued = false;"]},{"path":"extensions/drift.ts","start":233,"end":233,"sha256":"725f05654a5c1816b8b7bf0358e60d628dd13399e88dc4a0da3287da5a36f4f1","context":["    if (pendingContinuationPath) lines.push(`Continuation queued for ${pendingContinuationPath}; worktree switching is held. If delivery stalled, run drift-continue ${pendingContinuationPath} to recover it, or reload to clear the in-memory queue. The artifact is retained.`);","    if (pendingContinuationPath) lines.push(`Continuation queued for ${pendingContinuationPath}; worktree switching is held. If delivery stalled, run drift-continue ${pendingContinuationPath} to recover it, or reload to clear the in-memory queue. The artifact is retained.`);"]},{"path":"extensions/drift.ts","start":252,"end":284,"sha256":"b85ca033eba746827022cfce47e9b46654ed01bad7036add12f71b4ef1d17c8c","context":["  async function continueHandoff(args: string, ctx: ExtensionContext) {","  }"]},{"path":"extensions/drift.ts","start":349,"end":363,"sha256":"7896af4e2854f49dc6b5f194d28591a32c4b5358cf1ceb564d7d81e0aa1da2f4","context":["  pi.registerCommand(\"drift-auto-continue\", {","        ctx.ui.notify(errorText(error), \"error\");"]},{"path":"extensions/drift.ts","start":386,"end":393,"sha256":"1145c741da3abdbd38c68b1d93b25723a6d408fa02e01cba6f391b6803b81aba","context":["  pi.on(\"input\", async (event, ctx) => {",""]},{"path":"extensions/drift.ts","start":470,"end":481,"sha256":"95f94b9339f511193deddcd4f93e29c8bfd2de9b2205357dbcec0544f6e12c3a","context":["  async function guardSummary(_event: unknown, ctx: ExtensionContext) {","  pi.on(\"session_before_tree\", guardSummary);"]},{"path":"extensions/drift.ts","start":483,"end":505,"sha256":"f58aa279fadc81b40a4c3231d3863ac129d8d9aaee08d9db31088478108126d5","context":["  pi.on(\"agent_settled\", async (_event, ctx) => {","  pi.on(\"session_shutdown\", async (event, ctx) => checkpoint(`detach:${event.reason}`, ctx));"]},{"path":"extensions/drift.ts","start":539,"end":539,"sha256":"3bea027cd72835a5e9c7e9f883a9ccc1109a840e74a3772a2954295b7ac91b4a","context":["    promptGuidelines: [\"Use drift_publish for Drift research/plan/handoff files instead of writing their frontmatter or INDEX.md yourself. Read the Drift skill and relevant workflow first. New handoffs should supply a portable next_session_profile. By default publication only records the handoff: report the drift-continue command from the tool result and stop; the user decides when and where it continues. Where the repo opted in with /drift-auto-continue on, Pi compacts to the next fresh context window automatically; then do not ask the user to copy/paste a continuation command unless automatic continuation fails. Never delete Drift records or Pi session logs.\"],","    promptGuidelines: [\"Use drift_publish for Drift research/plan/handoff files instead of writing their frontmatter or INDEX.md yourself. Read the Drift skill and relevant workflow first. New handoffs should supply a portable next_session_profile. By default publication only records the handoff: report the drift-continue command from the tool result and stop; the user decides when and where it continues. Where the repo opted in with /drift-auto-continue on, Pi compacts to the next fresh context window automatically; then do not ask the user to copy/paste a continuation command unless automatic continuation fails. Never delete Drift records or Pi session logs.\"],"]},{"path":"extensions/drift.ts","start":586,"end":594,"sha256":"73e7a9aa06f190b1666ac5fe6d257db3d6456d03f1950a74a2422f2da22469b4","context":["        }","          : profiled && !held ? `\\nAutomatic continuation is off (the default; /drift-auto-continue on enables it). Nothing is queued; the user decides when and where to continue with: drift-continue ${receipt.path}` : \"\";"]},{"path":"lib/state.ts","start":180,"end":180,"sha256":"abec49dc88795b14909f84e29af13bb017854899c4cef6872a411a57c7a9b499","context":["  /** Whether publishing a profiled handoff compacts and continues in a fresh context window itself. Off unless the repo opts in. */","  /** Whether publishing a profiled handoff compacts and continues in a fresh context window itself. Off unless the repo opts in. */"]},{"path":"lib/routing.ts","start":71,"end":74,"sha256":"657fe8d2a1465d717ec4d7f3b635ae4298b086fbf7c09f3a2914bf21778b3f7e","context":["export async function loadModelProfiles(repo: string, agentDir: string, projectTrusted: boolean, projectConfigDir = \".pi\"): Promise<Record<string, ModelProfile>> {","  const local = await optionalConfig(repo, join(repo, projectConfigDir, configName));"]},{"path":"lib/pickup.ts","start":75,"end":129,"sha256":"19108b5296424602c9c2e9526c6dd371f105fff1b392722bfb2abf1d958d75ec","context":["export async function pickup(repo: string | undefined, args: string, ledger?: string): Promise<{ text: string; artifact?: string }> {","}"]},{"path":"README.md","start":58,"end":67,"sha256":"321fc1279a99f185e8b1af3586e9fc2b8319574150a8ed5fea0e642444574054","context":["command (or `status`) only reports.","| `/drift-auto-continue on\\|off\\|status` | Whether publishing a profiled handoff automatically compacts and continues in a fresh context window. Off by default: you decide if a handoff goes into a new thread. ([details](docs/continuation.md)) |"]},{"path":"docs/worktrees.md","start":62,"end":62,"sha256":"6caaf40204a707e0b6b453b0e495e5e7f991912f3dc6ab104740c9b812359f75","context":["the artifact to recover with `drift-continue`; reload clears the in-memory queue","the artifact to recover with `drift-continue`; reload clears the in-memory queue"]},{"path":"skills/drift/hosts/pi.md","start":35,"end":45,"sha256":"f9b33dcfa4c4aaea2eda36176b4a3b7fb9a7e3ffd20ee9700add2235b7dc0122","context":["For a handoff, also pass `next_session_profile` (see \"Profile-directed handoffs\" in `SKILL.md`). The profile names the kind of receiving work, not a provider/model. Successful handoff publication completes only this thread's current interval; do not delete its record. A handoff published with `status: \"complete\"` has no open work: even with a profile and `autoContinue` enabled, nothing is queued and no `drift-continue` command is proposed.","## Session records"]},{"path":"tests/pi-runtime.test.ts","start":555,"end":574,"sha256":"46733e8a8ca98220661c42b299953a223c0251bdd1ca888507eec25c44111243","context":["test(\"actual Pi automatically continues a profiled handoff after a fresh context compaction where the repo opts in\", { skip: !piPresent, timeout: 60_000 }, async (t) => {","});"]},{"path":"lib/state.ts","start":248,"end":248,"sha256":"ca0f0932dad8704553c5692bebf493c70886455342e54ceb0ea3345e19909f77","context":["    : \"Drift automatic continuation is off (the default): a profiled handoff is only published; continue it when you choose with drift-continue drift/<feature>/<NNN>-handoff-<description>.md. /drift-auto-continue on enables the automatic chain.\";","    : \"Drift automatic continuation is off (the default): a profiled handoff is only published; continue it when you choose with drift-continue drift/<feature>/<NNN>-handoff-<description>.md. /drift-auto-continue on enables the automatic chain.\";"]},{"path":"lib/state.ts","start":244,"end":256,"sha256":"3b7ddb401b79259340d0adb79605dd9bf15ecbb1b19c307bb9a4cc05d9af63d6","context":["export async function setAutoContinue(repo: string, request: AutoContinueRequest): Promise<string> {",""]}]
---

## Objective

Make Drift continuation work in two simple, clearly stated modes. Manual mode (auto-continue off): `/drift` or `/drift <file/link>` picks up the work on the model you currently have selected. Automatic mode (`/drift-auto-continue on`): after each profiled handoff, a fresh context window starts from the handoff alone, using the model your profile map assigns.

## Source Research

- drift/auto-continue/002-research-handoff-boundary-instead-of-compaction.md

## Starting Point

This plan replaces plan 003 and adds the user's decisions from 2026-10-19:
- the auto-continue on/off switch is the user's choice;
- `/drift` always uses the model the user has selected;
- profile-based model switching applies only to automatic continuation, and the messages and docs must say so plainly.

Start with step 1, the boundary. It is the only change to the automatic chain's behaviour. Steps 2–4 change messages and docs, and step 5 pins everything with tests.

## Key Files

- extensions/drift.ts:41-42, 61-64 — continuation state and reset
- extensions/drift.ts:233 — worktree status recovery text that names `drift-continue`
- extensions/drift.ts:252-284 — `continueHandoff` (profile → `setModel` → continuation prompt); stays as the internal automatic step
- extensions/drift.ts:349-363 — `/drift-auto-continue` command
- extensions/drift.ts:386-393 — bare `drift-continue` input handler (kept: the automatic chain's internal dispatch)
- extensions/drift.ts:470-481 — `guardSummary` (unchanged)
- extensions/drift.ts:483-505 — `agent_settled` → `ctx.compact` → `drift-continue` (replace)
- extensions/drift.ts:539 — promptGuidelines
- extensions/drift.ts:586-594 — publish-time queue decision and result text
- lib/state.ts:180, 244-256 — `autoContinue` doc comment and `setAutoContinue` status/toggle text
- lib/routing.ts:71-74 — `loadModelProfiles` (global `~/.pi/agent/drift-model-profiles.json`, trusted project `.pi/drift-model-profiles.json`)
- lib/pickup.ts:75-129 — `/drift` pickup (unchanged; already newest-or-named, current model)
- README.md:58-67 (commands table), 197-212 (continuation), 242-245 (`/drift` keeps the model)
- docs/continuation.md (whole page), docs/worktrees.md:62
- skills/drift/hosts/pi.md:35-45 (continuation guidance for agents)
- tests/pi-runtime.test.ts:555-574, 576-593, 595-666, 1025-1055, 1173-1199; tests/drift.test.ts (`setAutoContinue` strings)

## Implementation Sequence

1. **Handoff-only boundary for automatic continuation (extensions/drift.ts:483-505).**
   - Register `agent_before_settle`. When a continuation is pending, no boundary has yet been appended for it, there is no record `failure`, and `event.context.pendingMessages` is empty, return `{ entries: [...event.entries, { type: "compaction", summary, firstKeptEntryId: null, details: { drift: "handoff-boundary", artifact } }] }`.
     - `summary` is a fixed short note naming the handoff and saying the previous conversation is intentionally not carried forward.
     - Never set `continue: true`.
     - Track which artifact got the boundary; reset it with the other state at :61-64.
   - In `agent_settled`, keep the checkpoint.
     - If the boundary was appended, mark the continuation queued and send the internal `drift-continue <artifact>`, keeping the identity check and the error handling.
     - If no boundary was appended, do not continue into the old context. Clear the queue and notify: "Automatic continuation did not start. Run `/drift <artifact>` to pick it up on your current model."
   - Remove `ctx.compact`.
   - Verify: `npm run typecheck`.

2. **Manual mode points at `/drift` (extensions/drift.ts:233, 496, 539, 594; lib/state.ts:248, 254).**
   - With auto-continue off, the publish result becomes: "Automatic continuation is off. Nothing is queued. Run `/drift` to pick up the latest work, or `/drift <file>`, on the model you have selected."
   - Recovery texts (worktree status at :233, queue failure at :496) also say `/drift <artifact>`.
   - promptGuidelines (:539): when automatic continuation is off, tell the user to run `/drift`. Never present `drift-continue` as a user command.
   - The bare `drift-continue` handler stays working as internal plumbing, including its refusals of complete and superseded handoffs. Do not advertise it.
   - Verify: `npm run typecheck`.

3. **Automatic mode names its model source (extensions/drift.ts:349-363, 586-594; lib/state.ts:244-256).**
   - `/drift-auto-continue on` and `status` say that, when on, each profiled handoff starts a fresh window from the handoff on the model its `next_session_profile` maps to.
     - Name the profile file actually used: global `~/.pi/agent/drift-model-profiles.json` (Pi's agent dir), or the trusted project `.pi/drift-model-profiles.json`.
     - List the configured profiles as `name → provider/model (thinking)`, resolved with `loadModelProfiles(repo, getAgentDir(), ctx.isProjectTrusted() && repo === records.repo, CONFIG_DIR_NAME)` as in `continueHandoff`.
     - If no profile file or profiles exist, say that automatic continuation will stop visibly until one is configured.
   - When `drift_publish` queues a continuation, the result names the target, e.g. "A fresh context window is queued: profile implementation → github-copilot/claude-opus-5.5 (high), from ~/.pi/agent/drift-model-profiles.json."
     - If the profile is not configured, say so in the result. The automatic step will then fail visibly, as it does today.
   - Keep `setAutoContinue` pure if practical: compose the profile description in the extension, or pass it in.
   - Verify: typecheck, then the unit test in step 5.

4. **Docs state the two modes plainly.**
   - README commands table:
     - remove the `drift-continue` row;
     - `/drift` row: "on the model you have selected";
     - `/drift-auto-continue` row: "starts a fresh context window from each profiled handoff, on the model your profile map assigns".
   - README 197-212 and 242-245: same two-mode statement. Drop "drift-continue is the variant that switches models".
   - docs/continuation.md: rewrite as two short sections, manual (`/drift`, current model) and automatic (handoff-only fresh window, model from the profile map, file locations, example map). Mention `drift-continue` only as the internal step.
   - docs/worktrees.md:62: recovery via `/drift <file>`.
   - skills/drift/hosts/pi.md:35-45: agents report "run `/drift`" when off, and report the queued profile/model when on. Drop the manual `drift-continue` recovery paragraph, or reduce it to "`/drift <file>`".
   - Verify: grep for `drift-continue` in README.md, docs/, skills/. Only internal-mechanism mentions may remain.

5. **Tests (tests/pi-runtime.test.ts, tests/drift.test.ts).**
   - 555-574 (auto on):
     - the compaction entry has `firstKeptEntryId === id`, `fromHook === true`, and a summary naming the artifact;
     - no summarizer request is sent between publication and continuation;
     - the continuation request excludes the pre-boundary prompt `PUBLISH_AUTO_HANDOFF`;
     - the publish result names the profile → model.
   - 576-593 (auto off):
     - the publish result says "Run `/drift`" and not `drift-continue`;
     - `/drift` then picks up the handoff and the request uses the current model, not the profile model.
   - 1173-1199: both compactions are retain-none.
   - 595-666: the internal refusals still hold.
   - 1025-1055: comment wording only.
   - tests/drift.test.ts: the `setAutoContinue` status/on/off texts.
   - Verify: `npm test`, `npm run typecheck`, `npm run lint`.

6. **Live check and completion.**
   - `/reload` a session on an `autoContinue` repo (e.g. Rig). On its next profiled handoff, confirm:
     - the session log shows a retain-none compaction (`firstKeptEntryId` equals its own id, no summarizer usage);
     - the first continuation request carries only the system prompt, the boundary note and the continuation prompt;
     - there is no 35–80 s summarizer gap.
   - Publish the completing handoff with a changelog entry (Changed): "Drift continuation is two clear modes: `/drift` picks up the latest or named work on your selected model; with `/drift-auto-continue on`, each profiled handoff starts a fresh context window from the handoff alone (no summary of the old conversation) on the model your profile map assigns, which the status and publish messages now name."

Steps 2, 3 and 4 touch overlapping lines in extensions/drift.ts and lib/state.ts, so run them in sequence. Step 4's docs-only files (README, docs/, skills/) are disjoint from steps 1–3 and can be delegated in parallel.

## Decisions & Constraints

- **User decisions (2026-10-19):**
  - Auto-continue is a user toggle, already `/drift-auto-continue on|off`, unchanged.
  - `/drift` always uses the currently selected model and never switches profiles.
  - Profile → model selection happens only in automatic continuation, and must be stated clearly with the profile file location.
  - Manual pickup does not clear context; it continues in whichever thread the user runs it (answers research Open Question 1).
- **Boundary design (from research Option 1):**
  - retain-none `CompactionEntryDraft` at `agent_before_settle`, with no LLM call and the same Pi session, record and intercom identity;
  - never continue into the old transcript;
  - `guardSummary` unchanged for user/threshold compaction.
- **`drift-continue` stays** as the internal dispatch the automatic chain sends. This keeps model selection before inference and the complete/superseded refusals. It just isn't advertised.
- **No change to:** `/drift` pickup rules (`lib/pickup.ts`), publish-time queue rules (profiled, not complete, not held), landing order, the adoption hold while queued, or profile file format and trust rules.
- **Pi floor:** `agent_before_settle` and retain-none compaction arrived in Pi 0.87.0; the dev floor `^1.1.0` covers them.
- **Rollout:** running sessions keep old code until `/reload`.
- **Never** delete Drift records or Pi session logs.

## Open Questions

- Should an aborted run (Escape) after a successful handoff still auto-continue? The plan keeps current behaviour (the outcome is ignored) unless the user decides otherwise.
