---
name: drift
description: Use Drift for multi-session codebase research, implementation planning, handoffs, and context continuity across agent sessions.
---

# Drift

Drift is a context-continuity workflow for multi-session agentic coding. It helps preserve the useful parts of a session — research, implementation plans, and handoffs — so future agent sessions can continue without re-discovering the same context.

## Skill Router

This skill is the single entrypoint for Drift. Do not split Drift into separate global skills for research, planning, execution, and handoffs. Instead, route the user's request to the appropriate prompt file in this skill directory:

- **Research request** — codebase research, architecture questions, data flow, feature discovery, or documenting what exists: read and follow `research.md`.
- **Planning request** — turning completed research into an actionable implementation plan or starting handoff: read and follow `plan.md`.
- **Execution request** — picking up a plan or handoff to implement, orchestrating step-by-step (with sub-agents where appropriate) rather than doing all the work in the main session: read and follow `execute.md`.
- **Handoff request** — writing a session snapshot, stopping mid-work, resuming from a previous handoff, continuing from `drift/<feature>/NNN-handoff-...`, or preparing the next session: read and follow `handoff.md`.

If the user invokes Drift but the mode is unclear, ask whether they want research, planning, execution, or handoff/resume.

If the user asks to pick up or continue without naming an artifact, query the raw artifacts through the shared read-only catalog (see "At Session Start") and take the last dated entry. Route it by kind: an `in-progress` handoff resumes through `handoff.md`, a `pending` or `in-progress` plan runs through `execute.md`, and research goes to `plan.md`. If that newest artifact is a `complete` handoff or plan, or is `superseded`, there is no open work: say so, show the recent raw-artifact list and ask what to pick up. Do not reach back for an older open artifact. Complete research is different: it may still be planned. A named artifact always wins over the default, but if it is a `complete` plan or handoff or is `superseded`, say so (`<old> superseded by <new>`, or replacement not recorded) and get explicit confirmation before reopening it or working from its successor; never silently retarget it. If only undated artifacts exist, ask the user to name one; if discovery fails, report the failure rather than claiming there are no artifacts or trusting a stale view.

When routing to a prompt file:

1. Treat that file as the active workflow instructions.
2. Follow its output format, disk-writing rules, and path-verification rules.
3. Do not duplicate the full prompt contents in chat unless the user asks.
4. Keep using this `SKILL.md` for mode selection and global guardrails.

## When to Use Drift

Use Drift when the task involves:

- Codebase research or documenting how existing code works
- Turning research into an implementation plan
- Executing a plan or handoff (orchestrating step-by-step)
- Writing handoffs before stopping work
- Resuming from previous handoffs
- Work that is likely to span multiple agent sessions

## When Not to Use Drift

Skip Drift for:

- Trivial one-file edits
- Throwaway scripts or prototypes
- Tasks likely to complete in a single session

## Workflow

Drift uses four prompt files in this skill repo. Reference and follow the relevant file rather than duplicating its full contents:

- `research.md` — investigate and document what exists in the codebase
- `plan.md` — turn research into an actionable implementation plan
- `execute.md` — orchestrate a plan or handoff, delegating self-contained steps to sub-agents
- `handoff.md` — snapshot current state for a future session, or resume from an existing handoff

Use the workflow as needed:

1. Research the target project with `research.md`.
2. Convert completed research into an implementation plan with `plan.md`.
3. Execute the plan (or a prior handoff) with `execute.md`, delegating self-contained steps to sub-agents.
4. Write or resume handoffs with `handoff.md` whenever work crosses session boundaries.

## User decision checkpoints

Ask the user and wait before proceeding when a discovered fact creates a genuine product, scope, or risk decision: an unexpected requirement ambiguity; a material departure from the approved plan; a change to a public contract, data model, security/permission boundary, destructive operation, external integration, cost, or priority; or a need to reverse an earlier accepted decision. State the decision plainly, give the relevant evidence and bounded options/trade-offs, and ask one specific question.

Do not interrupt the user for routine implementation choices that are already constrained by the plan or established code patterns. Record those in the artifact instead. If a user decision is pending, do not let an open handoff continue automatically. Keep the current session waiting for the answer. If you must hand off, publish the handoff as a breakpoint so it waits for the user; the host overlay says how.

## Host overlays

The core of this skill is the manual baseline: it works in any agent that can read files and run a shell. Some hosts automate parts of it. Check which host you are in, and read its overlay before writing any artifact:

- The `drift_publish` tool is available → read `hosts/pi.md`.
- Otherwise → follow the manual disk-writing and session-record instructions in this file and the workflow files.

An overlay says only what it replaces. Everything it does not mention still applies.

## Profile-directed handoffs

For a new handoff, choose and record `next_session_profile`: a portable lowercase-hyphenated name for the next work type. Use `research`, `planning`, or `implementation` for the three standard Drift work modes. It is a receiving-session recommendation, never a provider, model ID, credential, or billing instruction. A host overlay may use it to start the next session automatically on a mapped model; without one, the user starts the next session from the handoff and chooses the model.

## Artifact Location

The Drift skill is normally installed outside the target project (in a host's skill directory or a shared checkout), but generated Drift artifacts must be written inside the current target project, never inside the skill checkout.

Use one project-local **feature folder** per feature or work grouping. Keep all Drift artifacts for that feature directly inside the same folder so the file tree shows the whole narrative at a glance.

Use this project-local structure for new artifacts:

```text
drift/
  <feature>/
    001-research-<topic>.md
    002-plan-<description>.md
    003-handoff-<description>.md
    004-handoff-<description>.md
    005-research-<topic>.md
    006-plan-<description>.md
```

A Drift artifact filename has three parts:

- `001` — a zero-padded, three-digit sequence number for chronological file-tree sorting inside the feature folder
- `research`, `plan`, or `handoff` — the artifact kind
- `<topic>` or `<description>` — a concise filesystem-safe slug

Before creating the first Drift artifact for a task, ask the user for a feature identifier. A ticket reference such as `PROJ-1234` or a descriptive slug such as `auth-refactor` is fine. Use that identifier consistently as the folder name under `drift/<feature>/`.

### Allocating Artifact Numbers

When creating a new artifact file:

1. Check the repository-root `drift/<feature>/` directory, if it exists.
2. Find existing markdown files whose names start with a three-digit prefix and hyphen, such as `001-research-auth-flow.md`.
3. Assign the next number after the highest existing prefix. If none exist, start at `001`.
4. Do not split new artifacts into `research/`, `plans/`, or `handoffs/` subfolders.
5. If the user points to an existing Drift artifact or legacy subfolder path, infer the feature from that path and continue in the same feature folder. Preserve the existing path only when explicitly writing a follow-up for a legacy chain; otherwise write the next flat numbered file in `drift/<feature>/`.

Do not maintain per-feature navigation files such as `drift/<feature>/CURRENT.md`, and do not move feature folders between status directories such as `active/` and `done/`. Within a feature, navigation comes from the numbered artifact filenames. Across features, query the raw catalog — see Cross-Feature Navigation below. Work state comes from each artifact's `status` frontmatter field — see Artifact Status below — never from filenames or directory moves. Do not encode status words such as `complete` into artifact filename slugs.

If later work is related to the same feature, create another numbered artifact in that feature folder rather than modifying an older artifact. If the work is a distinct feature, create a new feature folder.

If the target project root is unclear, ask the user before writing any Drift artifact.

"Repository root" in this skill means the checkout this session's Drift work belongs to (its **Drift root**), not necessarily the directory the agent was launched in. A worker assigned a linked worktree uses that worktree's root. A host overlay may bind it explicitly (on Pi, `drift_worktree`); changing a shell's directory does not. Verify the intended root once before publishing. If it is wrong or its policy check fails, report once that publication is blocked, do not hand-write managed artifacts, policy or host records to bypass the host, continue independent work, and recheck only after a relevant change or when the user asks.

## Artifact Status

Every Drift artifact carries a `status` field in its frontmatter so in-flight work can be tracked without opening files:

- `pending` — written but not yet started (a plan awaiting execution)
- `in-progress` — actively being worked, or a handoff whose Next Steps have not been picked up yet
- `complete` — the work the artifact describes is finished
- `superseded` — replaced by a newer artifact in the same feature folder, named by its `superseded_by` field

A `complete` plan or handoff has no open work. `complete` research is finished as research and may still be planned.

Lifecycle metadata is the **one exception** to artifact immutability: flip the `status` line of an older artifact in place as work progresses and, only when the artifact is actually superseded, also add a `superseded_by` line directly after `status`. Never edit any other part of it — not its body, not its other frontmatter. Keep the status line's existing quoting style (a host publisher writes `status: "pending"`); write the successor as a quoted path, `superseded_by: "drift/<feature>/<successor>.md"`.

Supersession rules, shared by every workflow file:

- Supersede only after the successor's own publication has succeeded — on a host publisher, after any pending retry has succeeded. Then set `status` to `superseded` and `superseded_by` together.
- `superseded_by` is the exact, existing repository- or store-relative `drift/...` path of the successor, in the same feature folder (a legacy subfolder such as `drift/<feature>/handoffs/...` is allowed). Never guess a successor, backfill one into older artifacts, or follow the link automatically to pick up work.
- A legacy `superseded` artifact without `superseded_by` stays valid and readable; report it as superseded, replacement not recorded.
- Report a supersession as `<old> superseded by <new>`.
- Before reopening a named `complete` or `superseded` artifact, or choosing its successor to work from, get explicit confirmation from the user.

The transitions are owned by the workflow files:

- `research.md` — writes research as `complete`; supersedes older research (status plus `superseded_by`) when new research replaces it.
- `plan.md` — writes plans as `pending`; supersedes any plan it replaces (status plus `superseded_by`).
- `execute.md` — flips the source plan to `in-progress` when execution starts, and to `complete` once every step is verified.
- `handoff.md` — writes handoffs as `in-progress` (work remains) or `complete` (work finished); supersedes the resumed handoff (status plus `superseded_by`) once its successor is published.

Status is deliberately **not** a column of the recent rows. The raw catalog reports each artifact's current `status` beside its dated row, and the frontmatter stays the source of truth: `grep -r "^status:" drift/`.

## Cross-Feature Navigation

Feature folders answer "what happened in this feature." Their `NNN` sequences are local, so work interleaves across features in a way the file tree does not show. The shared raw-artifact catalog provides that cross-feature chronology by reading the artifacts' frontmatter directly. Drift keeps no persisted index file.

Ordering rules, shared by the catalog, pickup and the recent rows:

- Sort by the **true instant** of `date`, normalizing offsets to UTC before comparing. Artifacts written in different timezones are the common case in a repo with more than one machine, and a plain string sort gets them wrong: `2026-08-31T00:00:00Z` is one hour *after* `2026-08-31T00:00:00+01:00`, not before it. Rows show local wall-clock time plus offset as recorded, so a correctly sorted listing can legitimately show an earlier wall-clock time in a later row.
- Break ties on equal instants by feature name, then folder sequence, so the order is stable.
- Oldest first, newest last. The `#` in each row is a repo-wide running number assigned by that position; it is **independent of** the folder-local `NNN`, and no feature folder is ever renumbered to match it.
- An artifact with no parsable `date` is listed as undated rather than guessed. Do not backfill frontmatter into an existing artifact to fix this unless the user asks. Artifacts in legacy layouts such as `drift/<feature>/handoffs/...` still belong in the catalog under their path's feature.

### At Session Start

Navigation is a read of the raw artifacts.

1. If the target repo has no `drift/` directory, do nothing. Do not create `drift/`.
2. Otherwise run `python3 -I <drift-checkout>/scripts/build-index.py <repo>/drift --json` (`py -3` on Windows). The script is `../../scripts/build-index.py` relative to this `SKILL.md`; resolve that path from the skill location, not the target project's cwd. It writes nothing and returns `dated` entries oldest first plus `undated` entries ordered by feature/path, with paths relative to `drift/`, kind, status, optional successor metadata (`superseded_by`, null for legacy artifacts), date and display rows (`date` and `row` are null for undated entries). Use the last dated entry for default pickup and a bounded tail (eight entries on Pi) for recent navigation. Without `--json` the same script prints the whole cross-feature timeline as a Markdown table to stdout for a person to read; it writes no file. If a host has only the copied skill and no bundled script, manually enumerate and order the raw artifact frontmatter by the rules above.
3. An empty catalog means no artifacts. An undated-only catalog means chronology is unknown: ask for a named artifact. A read/parser failure is not empty work: report it and do not silently pick an older item.

Managed artifact paths must not traverse symlinks, including links to another path inside the store; discovery reports these rather than following them. Pi queries the raw catalog on each engaged context request as well as pickup, so a working Python installation and fresh filesystem scan are required—there is no fallback or freshness cache.

**Linked worktrees.** Artifacts that are ignored never travel through git, so in a linked worktree of a repository that keeps artifacts private, Drift uses the **main worktree's** `drift/` for the whole repository: publish there, query the raw artifacts there, and treat `drift/...` paths as relative to it. The linked worktree holds no `drift/` of its own, and nothing is linked (a junction is deleted through by `git worktree remove`). A host that supplies session context says where the store is. Tracked repositories keep a `drift/` per worktree, because those artifacts commit with the branch.

## Pushing to a shared branch

When many threads push to one branch, push in this order and no other: commit your work; fetch; rebase onto the fresh upstream (keep both sides of any conflict in a shared file); confirm `git diff origin/<default> --name-only` lists only files your own commits touch; run the project's checks; push; if the push is rejected because the tip moved, start again from the fetch. Never squash with `git reset --soft origin/<default>` or any other moving ref, never force-push, never resolve a conflict by taking one side whole.

## Project history

Drift maintains no changelog or index file. A project's history lives in three places:

- **Commit messages.** Each states what changed and why, and names the Drift artifact path(s) it implements, such as `drift/<feature>/006-plan-<description>.md`.
- **Handoffs.** They record what each interval did, what remains and why.
- **The recent-artifact list.** The catalog's newest rows, supplied by the host or queried as in "At Session Start".

To learn what a project has done, read `git log`, the recent handoffs and the recent-artifact list.

## Timestamps

Every artifact's frontmatter `date` orders the catalog and pickup, so it has to be a real reading of the clock. **Read it from the system. Never estimate, infer, or extrapolate it.**

```sh
date -Iseconds                                                    # GNU/Linux
python3 -c 'import datetime; print(datetime.datetime.now().astimezone().isoformat(timespec="seconds"))'
```

Either prints exactly the required form, offset included: `2026-09-06T14:42:24+01:00`. Prefer the Python one where portability matters — BSD and macOS `date` have no `-I`.

You do not have a clock. Absent a real reading, a plausible-looking timestamp is a guess wearing the costume of a measurement, and it will be wrong in ways that are invisible later:

- **A date-only context value** (a harness line such as "Today's date is 2026-09-06") padded to `T00:00:00` looks precise and is not. Read the clock instead of padding.
- **Extrapolating from the previous artifact** ("that handoff said 20:00, this session felt like an hour, so 21:00") drifts forward, because token volume feels like more wall-clock time than it is, and the error compounds along a chain of artifacts that each anchor on the last.
- **Inventing a round session start** ("10:00") when there is no previous artifact to anchor on is unbounded in either direction.

These are not hypothetical. Audited against git, a real repo's 86 artifacts contained 34 provably impossible dates — several claiming a time *hours after* the commit the same artifact recorded as `HEAD`, which is a hash that could not have existed yet.

Two further rules:

- **Use the machine's real offset**, as the commands above do. Do not normalize to `Z` by hand. An agent running in a UTC container and one running locally will otherwise write the same moment two different ways, and the catalog has to reconcile them.
- **If you genuinely cannot read a clock**, record the date at day precision and say so in the artifact rather than fabricating a time. Honest coarseness beats false precision — the catalog lists an artifact without a parsable date as undated for exactly this.

## Session Records

A host may establish a measured record of the current work interval before work starts and supply its path and baseline in context: when the interval began, the starting branch and commit, and a fingerprint of the working tree. When one is supplied, use it for `session_started` and to separate this interval's changes from inherited ones; a Git diff can include other threads' work. Never delete a host's record or conversation log, never substitute another thread's baseline, and never treat a failed publication as completion.

A skill cannot run at session start by itself. Without a supplied record, omit `session_started` rather than estimating it. The manual artifact workflow works without lifecycle automation. See `handoff.md` for how to distinguish original measurements from a later reconstruction.

## Artifact Git Policy

Drift artifacts are local agent context and are ignored **by default**. A project may explicitly choose to commit them so handoffs travel between machines. The single host-neutral setting lives in the target **repository-root** `.drift.json`:

```json
{ "trackArtifacts": true }
```

Read this before creating `drift/` or writing an artifact. Missing config, `{}` or `{"trackArtifacts": false}` selects the ignored default. The file must be a regular, non-symlink JSON object of at most 64 KiB, whose fields are all optional: boolean `trackArtifacts` and boolean `autoContinue`. `autoContinue` configures host automation; a session without that automation leaves it alone and must not treat it as an error. Stop on malformed config or any other field rather than guessing. Do not infer opt-in from tracked history, ignore exceptions or another repo's settings. Create/change the flag only after the user chooses the policy; commit it when the repo should share that choice. When the user asks to switch to tracked artifacts: write the flag, remove only the root `drift/` ignore rule from `.gitignore`, verify with `git check-ignore --no-index` that an artifact path such as `drift/<feature>/001-research-<topic>.md` is no longer ignored (restoring the file and naming the rule if it is), and commit only when the user asks. A host overlay may provide this as a command.

- **Ignored (default):** ensure repository-root `.gitignore` exists and contains `/drift/`, preserving all other contents. Verify artifact paths are ignored. If a negation prevents that, report the conflict; do not silently override an accepted project choice.
- **Tracked (`true`):** leave `.gitignore` untouched. Verify artifact paths are not ignored, and report conflicting rules for explicit resolution. Do not force-add, stage, commit or push automatically. Review handoff contents before committing; trackable does not mean public or credential-safe.

With a host publisher, it enforces this policy; do not duplicate its writes. In a linked worktree, `.drift.json` is the worktree's own branch-local copy. Under the manual baseline, perform the checks yourself (`git check-ignore --no-index` returns 0 for ignored, 1 for not ignored; other failures are errors). The setting changes Git visibility only; it never permits secrets in artifacts or deleting records/session logs.
