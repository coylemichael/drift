# Drift on Pi

This overlay applies when the `drift_publish` tool is available. It says only what it replaces in the core skill; everything else in `SKILL.md`, `research.md`, `plan.md`, `execute.md` and `handoff.md` still applies.

## Bundled workflow binding

The Pi extension binds Drift's advertised skill and explicit `/skill:drift` requests to the skill shipped alongside that extension. A stale standalone copy may still appear in Pi's discovery inventory, but it does not supply the runtime workflow. Do not delete old skill checkouts or edit user settings to resolve that collision. Other skills and explicitly disabled discovery are preserved.

## Publishing with `drift_publish`

Use `drift_publish` to save research, plan and handoff artifacts. First read the relevant workflow file and write its required Markdown sections. Pass the confirmed feature, artifact kind, a safe lowercase slug, the body **without frontmatter**, and any source/previous/related artifact paths. References are repository-relative `drift/...` paths.

The tool owns the measured frontmatter, sequence allocation, `.gitignore`, artifact/index writes and handoff completion. Do not duplicate those writes or delete session records yourself. It rebuilds the index using the shared renderer, which may normalize index boilerplate without rewriting historical artifacts. Optional source/previous references may be omitted or blank; use `[]` when there are no related artifacts. Correct argument validation errors before retrying. Once a pending publication exists, keep the record and retry the **same input**; report conflicts instead of deleting partial work.

For a handoff, also pass `next_session_profile` (see "Profile-directed handoffs" in `SKILL.md`). The profile names the kind of receiving work, not a provider/model. Successful handoff publication completes only this thread's current interval; do not delete its record.

## Profile-directed continuation

After `drift_publish` successfully creates a profiled handoff, report that Pi queues the next fresh context window automatically; do not ask the user to copy/paste a continuation command. After compaction, Pi uses `drift-continue` internally to validate the repository-local artifact, resolve its `next_session_profile` through the receiving machine's explicitly configured model map, select the mapped model and thinking level **before** inference, then follow the ordinary handoff workflow from the artifact's Next Steps. Missing/invalid profiles, unavailable models or failed authentication fail visibly without inference and leave the handoff available for manual recovery with `drift-continue <published artifact path>`. See the README for the local configuration format.

In `execute.md`'s long-running loop this is the normal path: the next model reads the handoff and its referenced plan/research rather than receiving the old transcript.

To recover an existing profiled handoff manually in a fresh Pi thread, run `drift-continue drift/<feature>/<NNN>-handoff-<description>.md`; it selects the declared local profile before asking any model to continue. For an older unprofiled handoff use the core manual resume procedure and select a model yourself.

## Session records

The Pi extension establishes a durable record before work and supplies its path and measured baseline in model context. It uses Pi's actual session ID, not a model-generated manual ID. Records live under Pi's agent directory, separately from project artifacts and Pi's conversation logs.

- Read **this thread's supplied record** when preparing an artifact. Its `started`, `startBranch`, `startCommit`, `baseline` and any `checkpoint` contain measurements, not a reconstruction from conversation memory. The publisher maps the original start into `session_started` and takes a fresh clock read for `date`.
- Records survive ordinary turns, reload, resume and compaction. Settled turns and teardown checkpoint observed changes; an ACP process detaching does not establish that the conversation is over.
- A successful `drift_publish` handoff completes only the current interval. The extension retains a receipt for retries so a retry cannot silently create a second handoff or reopen the same interval, and establishes a new measured interval on the next working prompt. Research and plan publication leave the current interval active.
- **Never delete Pi's session log or the extension's record.** Do not run retired manual hooks or substitute another thread's baseline. Publication failure must not be treated as completion.
- A Git diff can include inherited or overlapping work. Compare the recorded starting fingerprint and actual task history; do not claim everything in `git diff HEAD` as this session's work. Unreadable files have explicitly marked metadata-only fingerprints.
- A record is evidence about observed work, not proof that another thread is abandoned. Confirm ownership and the user's intent before using another thread's record for a reconstructed handoff. The publisher's frontmatter still identifies the current writing interval; do not substitute the other thread's ID or mark its record completed.
