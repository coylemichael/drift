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

If the user asks to pick up or continue without naming an artifact, use the newest row of `drift/INDEX.md` (bring it up to date first; see "At Session Start"). Route it by kind: an `in-progress` handoff resumes through `handoff.md`, a `pending` or `in-progress` plan runs through `execute.md`, and research goes to `plan.md`. If that newest artifact is a `complete` handoff or plan, or is `superseded`, there is no open work: say so, show the last few index rows and ask what to pick up. Do not reach back for an older open artifact. A named artifact always wins over the default.

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

Do not interrupt the user for routine implementation choices that are already constrained by the plan or established code patterns. Record those in the artifact instead. If a user decision is pending, do not publish a profiled handoff that would automatically start another session; keep the current session waiting for the answer, or write an unprofiled handoff only when the user explicitly asks to stop.

## Host overlays

The core of this skill is the manual baseline: it works in any agent that can read files and run a shell. Some hosts automate parts of it. Pick exactly one overlay by checking what is present, and read it before writing any artifact:

- The `drift_publish` tool is available → read `hosts/pi.md`.
- The Drift plugin is present (agents named `drift:drift-orchestrator`, `drift:drift-research`, `drift:drift-planning`, `drift:drift-implementation` exist) → read `hosts/claude.md`.
- Neither → follow the manual disk-writing, indexing and session-record instructions in this file and the workflow files.

An overlay says only what it replaces. Everything it does not mention still applies.

## Profile-directed handoffs

For a new handoff, choose and record `next_session_profile`: a portable lowercase-hyphenated name for the next work type. Use `research`, `planning`, or `implementation` for the three standard Drift work modes. It is a receiving-session recommendation, never a provider, model ID, credential, or billing instruction. A host overlay may use it to start the next session automatically on a mapped model; without one, the user starts the next session from the handoff and chooses the model.

## Artifact Location

The Drift skill is normally installed outside the target project (in a host's skill directory or a shared checkout), but generated Drift artifacts must be written inside the current target project, never inside the skill checkout.

Use one project-local **feature folder** per feature or work grouping. Keep all Drift artifacts for that feature directly inside the same folder so the file tree shows the whole narrative at a glance.

Use this project-local structure for new artifacts:

```text
drift/
  INDEX.md
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

Do not maintain per-feature navigation files such as `drift/<feature>/CURRENT.md`, and do not move feature folders between status directories such as `active/` and `done/`. Within a feature, navigation comes from the numbered artifact filenames. Across features, it comes from `drift/INDEX.md` — see below. Work state comes from each artifact's `status` frontmatter field — see Artifact Status below — never from filenames or directory moves. Do not encode status words such as `complete` into artifact filename slugs.

If later work is related to the same feature, create another numbered artifact in that feature folder rather than modifying an older artifact. If the work is a distinct feature, create a new feature folder.

If the target project root is unclear, ask the user before writing any Drift artifact.

## Artifact Status

Every Drift artifact carries a `status` field in its frontmatter so in-flight work can be tracked without opening files:

- `pending` — written but not yet started (a plan awaiting execution)
- `in-progress` — actively being worked, or a handoff whose Next Steps have not been picked up yet
- `complete` — the work the artifact describes is finished
- `superseded` — replaced by a newer artifact in the same feature folder

Updating `status` is the **one exception** to artifact immutability: flip the `status` line of an older artifact in place as work progresses, and never edit any other part of it — not its body, not its other frontmatter. Keep the line's existing quoting style (a host publisher writes `status: "pending"`). The transitions are owned by the workflow files:

- `research.md` — writes research as `complete`; flips older research to `superseded` when new research replaces it.
- `plan.md` — writes plans as `pending`; flips any plan it replaces to `superseded`.
- `execute.md` — flips the source plan to `in-progress` when execution starts, and to `complete` once every step is verified.
- `handoff.md` — writes handoffs as `in-progress` (work remains) or `complete` (work finished); flips the resumed handoff to `superseded` when a successor is written.

Status is deliberately **not** an index column. `drift/INDEX.md` is an append-only timeline whose existing rows never change, while status changes over an artifact's life. To see current state, read the frontmatter: `grep -r "^status:" drift/`.

## The Root Index

Feature folders answer "what happened in this feature." They cannot answer "what happened in this repo, in order" — a feature's `NNN` sequence is local to that folder, so work interleaves across features in a way the file tree does not show. `drift/INDEX.md` is the cross-feature timeline that closes that gap.

Maintain exactly one index, at `drift/INDEX.md`. It lists every Drift artifact in the repository in chronological order, oldest first.

### Format

A short header explaining what the index is, then one Markdown table. One row per artifact:

```markdown
| # | Date | Feature | Type | Artifact |
|---|---|---|---|---|
| 001 | 2026-08-28 20:30 +01:00 | auth-refactor | research | [001-research-auth-flow](auth-refactor/001-research-auth-flow.md) |
| 002 | 2026-08-28 20:35 +01:00 | auth-refactor | plan | [002-plan-implementation](auth-refactor/002-plan-implementation.md) |
| 003 | 2026-08-29 09:10 +01:00 | PROJ-1234 | research | [001-research-policy-flow](PROJ-1234/001-research-policy-flow.md) |
```

Column rules:

- `#` — a zero-padded global running number, assigned by position in the index. It is the repo-wide running order and is **independent of** the folder-local `NNN` sequence. Do not expect them to match, and never renumber a feature folder to make them match.
- `Date` — the artifact's frontmatter `date`, shown as local wall-clock time plus offset. Display it as recorded; do not rewrite it into another timezone.
- `Feature` — the feature folder name.
- `Type` — `research`, `plan`, or `handoff`, from frontmatter `type`.
- `Artifact` — a relative link from `drift/` to the artifact, with the filename (minus `.md`) as the link text.

Ordering rules:

- Sort by the **true instant** of `date`, normalizing offsets to UTC before comparing. Artifacts written in different timezones are the common case in a repo with more than one machine, and a plain string sort gets them wrong: `2026-08-31T00:00:00Z` is one hour *after* `2026-08-31T00:00:00+01:00`, not before it. Because the Date column shows local time, a correctly sorted index can legitimately show an earlier wall-clock time in a later row.
- Break ties on equal instants by feature name, then folder sequence, so the order is stable across rebuilds.
- Oldest first, newest last. New rows append to the bottom.

### Updating the Index

Appending to the index is part of writing an artifact, not a separate request. After writing any `NNN-research-`, `NNN-plan-`, or `NNN-handoff-` file:

1. Read `drift/INDEX.md`. Create it if missing, using the format above.
2. Append one row for the artifact you just wrote, using the same `date` you put in its frontmatter.
3. Set `#` to one more than the last row's number.
4. Leave every existing row untouched.

A new artifact is almost always the newest, so a plain append is correct. If you are backfilling an artifact with an older `date`, insert it in the right position instead and renumber the `#` column from that row down.

### At Session Start

Before reading or writing any artifact in a session, make sure the index matches the folders. Another host, another machine or a hand-written artifact may never have appended its row, and resuming, executing and the host's recent-artifact context all navigate by the index.

1. If the target repo has no `drift/` directory, or it holds no artifacts, do nothing. Do not create `drift/` or an empty index.
2. Otherwise, if `drift/INDEX.md` is missing or out of sync, rebuild it (see below). With a shell, `scripts/build-index.py <repo>/drift --check` reports which, without writing.
3. Check the artifact Git policy for `drift/INDEX.md` first (see "Artifact Git Policy"). If the index would land on the wrong side of it, report the conflict and leave both `.gitignore` and the index alone; a rebuild of a derived view never justifies changing ignore rules.

This is a rebuild, not a publication: it writes no artifact, changes no `status` and never stages or commits. A host overlay may do it automatically.

### Derived Files Under Many Agents

The index is derived: when it disagrees with the folders, rebuild it; never edit a row, a number or the footer by hand, and never resolve a merge conflict in it by choosing a side. Two threads that each appended a row have both appended correctly; the right result is the union, reordered by date and renumbered. `scripts/build-index.py --merge <base> <ours> <theirs>` computes exactly that and works as a git merge driver: with `drift/INDEX.md merge=drift-index` in `.gitattributes` (written by Drift when artifacts are tracked) and `merge.drift-index.driver` configured in the clone, a rebase never stops on the index. Without the driver, take either side and rebuild.

**Linked worktrees.** Artifacts that are ignored never travel through git, so in a linked worktree of a repository that keeps artifacts private, Drift uses the **main worktree's** `drift/` for the whole repository: publish there, read the index there, and treat `drift/...` paths as relative to it. The linked worktree holds no `drift/` of its own, and nothing is linked (a junction is deleted through by `git worktree remove`). A host that supplies session context says where the store is. Tracked repositories keep a `drift/` per worktree, because those artifacts commit with the branch.

### Rebuilding the Index

Rebuild from scratch when the index is missing, when it has drifted out of sync with the folders, or when adopting the index in a repo that already has Drift artifacts. Frontmatter is the source of truth — the index is a derived view and can always be regenerated.

To rebuild: scan `drift/**/*.md` excluding `INDEX.md`, read `date`, `feature`, `type`, and `sequence` from each artifact's frontmatter, sort by UTC-normalized instant per the ordering rules, and write the table with `#` renumbered from `001`.

Two cases to handle explicitly rather than silently dropping:

- **No parsable `date`.** Older artifacts may predate the frontmatter convention. Fall back to a date in the body (such as a `**Date:**` line), mark the row as approximate, and place it by that date. If there is no date at all, list the artifact under an `## Undated` heading below the table rather than guessing. Do not backfill frontmatter into an existing artifact to fix this unless the user asks.
- **Legacy subfolder paths.** Artifacts in legacy layouts such as `drift/<feature>/handoffs/...` still belong in the index. Use the path's feature and link the real location.

If a shell is available, `scripts/build-index.py` in this skill repo does the rebuild — run it with the target repo's `drift/` directory as its argument. It is a convenience, not a dependency; the procedure above is the specification.

## Timestamps

Every artifact's frontmatter `date` orders the index, so it has to be a real reading of the clock. **Read it from the system. Never estimate, infer, or extrapolate it.**

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

- **Use the machine's real offset**, as the commands above do. Do not normalize to `Z` by hand. An agent running in a UTC container and one running locally will otherwise write the same moment two different ways, and the index has to reconcile them.
- **If you genuinely cannot read a clock**, record the date at day precision and say so in the artifact rather than fabricating a time. Honest coarseness beats false precision — the index has an `(approx)` display and an `## Undated` section for exactly this.

## Session Records

A host may establish a measured record of the current work interval before work starts and supply its path and baseline in context: when the interval began, the starting branch and commit, and a fingerprint of the working tree. When one is supplied, use it for `session_started` and to separate this interval's changes from inherited ones; a Git diff can include other threads' work. Never delete a host's record or conversation log, never substitute another thread's baseline, and never treat a failed publication as completion.

A skill cannot run at session start by itself. Without a supplied record, omit `session_started` rather than estimating it. The manual artifact workflow works without lifecycle automation. See `handoff.md` for how to distinguish original measurements from a later reconstruction.

## Artifact Git Policy

Drift artifacts are local agent context and are ignored **by default**. A project may explicitly choose to commit them so handoffs travel between machines. The single host-neutral setting lives in the target **repository-root** `.drift.json`:

```json
{ "trackArtifacts": true }
```

Read this before creating `drift/` or writing an artifact. Missing config, `{}` or `{"trackArtifacts": false}` selects the ignored default. The file must be a regular, non-symlink JSON object of at most 64 KiB, with only the optional boolean `trackArtifacts` field. Stop on malformed/unsupported config rather than guessing. Do not infer opt-in from tracked history, ignore exceptions or another repo's settings. Create/change the flag only after the user chooses the policy; commit it when the repo should share that choice. When the user asks to switch to tracked artifacts: write the flag, remove only the root `drift/` ignore rule from `.gitignore`, verify with `git check-ignore --no-index` that `drift/INDEX.md` and an artifact path are no longer ignored (restoring both files and naming the rule if they are), and commit only when the user asks. A host overlay may provide this as a command.

- **Ignored (default):** ensure repository-root `.gitignore` exists and contains `/drift/`, preserving all other contents. Verify artifact and index paths are ignored. If a negation prevents that, report the conflict; do not silently override an accepted project choice.
- **Tracked (`true`):** leave `.gitignore` untouched. Verify artifact and index paths are not ignored, and report conflicting rules for explicit resolution. Do not force-add, stage, commit or push automatically. Review handoff contents before committing; trackable does not mean public or credential-safe.

With a host publisher, it enforces this policy; do not duplicate its writes. Under the manual baseline, perform the checks yourself (`git check-ignore --no-index` returns 0 for ignored, 1 for not ignored; other failures are errors). The setting changes Git visibility only; it never permits secrets in artifacts or deleting records/session logs.
