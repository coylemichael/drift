---
date: "2026-10-10T13:52:24+01:00"
branch: "main"
git_commit: "add70ff0d7718bad8b3c2dd8dbf579893d0ea6dc"
feature: "worktree-scope"
sequence: "001"
type: "handoff"
status: "complete"
session_started: "2026-10-10T12:58:54+01:00"
session_id: "01a125ae-2872-71cf-83ca-62eaed6aa4d7"
interval_id: "a7fd61b6-cb94-4895-a24d-3483001b5563"
start_branch: "main"
start_commit: "0d2dc68785f128049ddff0b5c9ded0d45a5eeb70"
related_artifacts: []
next_session_profile: "implementation"
---

## Objective
Support the normal multi-worker workflow in which Pi/ACP threads start in a main checkout and later adopt assigned linked worktrees, without restarting those threads or publishing worker records into the wrong checkout.

## Source Documents
- User discussion in this Pi session: two Perimeter workers reported publication/measurement rooted in main while their tasks ran in linked worktrees. The user clarified that threads are deliberately created first and assigned worktrees later, approved explicit adoption, confirmed feature `worktree-scope`, and authorised committing and pushing this work with its changelog.
- `README.md:255` and `skills/drift/hosts/pi.md:9` document the implemented contract.
- No earlier research, plan or handoff artifact for this feature. Implementation planning and source/API review were performed in this session; publication waited for feature-name confirmation.

## Status
- **Completed:** implementation, documentation and tests, committed as `add70ff` (`feat: explicitly adopt worker worktrees in Drift sessions`). Eight files belong to this implementation commit.
- **Verified:** full suite with the installed ACP adapter enabled: 104 tests, 101 passed, 3 platform-specific skips, zero failures. `git diff --check` passed.
- **In progress:** the user-authorised final landing. This publication supplies the handoff and changelog fragment; those generated changelog outputs still need their commit, fresh-upstream verification and push unless already performed later in this same turn.
- **Not performed:** no live worker was reloaded or re-anchored; no project artifact-tracking policy was changed; no existing record or conversation log was deleted.

## What Changed
- `lib/state.ts:40`, `lib/state.ts:383`, `lib/state.ts:460`, `lib/state.ts:497`, `lib/state.ts:517`, `lib/state.ts:570` — durable explicit worktree scope, canonical same-Git-common-directory validation, Git-directory identity checking, fresh baselines on adoption, preserved flat interval snapshots, scope-aware checkpoints/context and safe recovery. Worktree-aware records use version 2, so older publishers reject rather than misinterpret them; ordinary version-1 records remain readable.
- `lib/artifacts.ts:330` — publication resolves the active worktree under the record lock. Metadata, config, references, remote numbering and changelog fragments use that worktree; the existing artifact-store resolver still distinguishes tracked per-worktree artifacts from private shared artifacts.
- `extensions/drift.ts:50`, `extensions/drift.ts:157`, `extensions/drift.ts:178`, `extensions/drift.ts:421` — `drift_worktree` status/adopt tool and `/drift-worktree` command; consistent active-root routing for pickup, publication, policy commands, changelog, landing and continuation; persisted-root refresh on resume; no implicit shell-cd adoption.
- `extensions/drift.ts:353` — rejects an entire tool-call batch containing adoption plus sibling calls, preventing a sibling publication into the old checkout. Adoption is also held during pending publication or queued continuation.
- `tests/worktrees.test.ts` — eleven core adoption regressions covering fresh measurements/history, independent sessions, retries, scope validation, removed/recycled paths, tracked/private output placement and concurrent publication.
- `tests/pi-runtime.test.ts` — real RPC lifecycle, command/tool, scope, recovery, automatic continuation and worker-landing coverage; installed ACP adoption/publication regression. Windows ACP fixtures explicitly pass the already-resolved Pi script instead of attempting a shell-less spawn of npm's `pi.cmd`.
- `README.md:255`, `skills/drift/SKILL.md`, `skills/drift/hosts/pi.md:9` — worker adoption procedure, unchanged Pi tool defaults/trust, policy scope, reload requirement and the one-time publication-blocker rule.

## Codebase Context
- Pi's launch cwd, built-in read/edit/bash defaults and session-file location do not change. Relative adoption paths resolve against that fixed cwd; ordinary file operations must continue to use explicit worker paths.
- The record remains keyed to launch repository and actual Pi session ID. The active worktree and its Git-directory identity are persisted in that record. Reload/resume/compaction retain adoption; a genuinely new/forked/cloned session does not inherit it.
- Only an existing exact worktree root sharing the launch repository's canonical Git common directory can be adopted. Other clones, submodules, nested repositories and subdirectories are rejected. A recycled worktree path needs an explicit fresh adoption.
- Target `.drift.json` is branch-local. Adoption neither rebases the worker nor repairs policy. Tracked artifacts commit with the worker branch; private artifacts keep the shared main-worktree store while metadata and fragments belong to the worker.
- Adoption does not retroactively measure earlier worker activity or mark the exited interval complete. Pending publication must be recovered with identical input before switching.
- Adoption does not grant Pi project trust to another checkout's model-profile file; global profiles apply there. This is not a sandbox: the adopted branch's explicit `land.auto` and `land.check` settings still govern landing and its shell checks, as documented.
- Tests use temporary repositories and loopback synthetic model responses, not paid model inference. The exact successful command used this machine's installed adapter: `PI_TEST_ACP='C:/Users/BLACKHAND-CL1/.local/share/pi-acp-context/dist/index.js' npm test`. The final test log is in the machine temp directory as `drift-worktree-suite-final-01a125ae.log`.
- The measured baseline already contained automatic changelog setup: `.gitattributes`, the generated-region markers in `CHANGELOG.md`, and `changelog.d/README.md`. Include this prerequisite setup with the generated changelog entry, but do not claim it as new worktree implementation.
- `package.json` and `package-lock.json` changed after this thread's implementation. They are not owned by this task and must not be staged, reverted or overwritten. The other live Drift sessions were notified; `drift-keeper` confirmed it does not own them. Preserve them while landing this task.
- Repository artifact policy is still the ignored default (`/drift/` is already ignored; there is no root `.drift.json`). This handoff stays local; its generated changelog fragment and the code are the Git outputs. Do not force-add `drift/` or change tracking policy to land it.

## What Deviated from Plan
- The initial recommendation to start replacement worker sessions was superseded after the user explained that worktree assignment happens after thread creation. Explicit durable Drift scope adoption implements that approved workflow instead.
- Review added worktree-directory identity checking and version-2 scope records to prevent stale/recycled paths or older publishers from silently using incorrect measurements.
- An initial optional ACP test run exposed the pre-existing Windows fixture launcher issue (`pi` could not be spawned directly). The fixture now uses the adapter's verified `PI_ACP_PI_SCRIPT` mechanism; the final RPC and ACP runs pass.
- No managed artifacts were hand-written. No existing publication policy was bypassed.

## Open Questions
- No unresolved feature-design decisions.
- Ownership of the unrelated package-file edits was still being coordinated when this handoff was prepared; leave them intact and outside this task's commits.

## Next Steps
1. Check Git status and recent commits first. If this task's implementation and changelog have already been pushed later in the publishing turn, do not repeat publication or reopen implementation; report the landed commits and stop.
2. Otherwise review the publication result and commit only its changelog fragment, generated `CHANGELOG.md`, `.gitattributes` and `changelog.d/README.md`. `add70ff` already contains the implementation. Leave package files and any other thread's work untouched. The handoff/index stay ignored under current policy.
3. Fetch `origin`, bring the owned commits onto fresh `origin/main` without force-push or resets against a moving ref, and verify the diff against upstream contains only the owned implementation/changelog paths. If already based on the fresh upstream, no history rewrite is needed. If unrelated dirty files obstruct a necessary rebase, coordinate with their owner rather than discard them.
4. Run the full suite with the installed ACP adapter enabled, verify the generated changelog with the shared builder's `--check`, and push `HEAD:main`. If the remote moves, repeat fetch/rebase/checks rather than force-pushing.
5. After verified successful push, change only this handoff's status frontmatter to `complete`, notify the two coordinating Drift peers of the landed commit, and report success to the user. No further feature implementation is queued. Existing worker sessions need an extension reload/reconnect once before the new tool becomes available.
