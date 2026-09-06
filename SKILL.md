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

## Artifact Location

The Drift skill may live globally at `~/.agents/skills/drift`, but generated Drift artifacts must be written inside the current target project, not inside this skill repo.

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

Do not maintain per-feature navigation files such as `drift/<feature>/CURRENT.md`, and do not move feature folders between status directories such as `active/` and `done/`. Within a feature, navigation comes from the numbered artifact filenames. Across features, it comes from `drift/INDEX.md` — see below.

If later work is related to the same feature, create another numbered artifact in that feature folder rather than modifying an older artifact. If the work is a distinct feature, create a new feature folder.

If the target project root is unclear, ask the user before writing any Drift artifact.

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

## Gitignore Drift Artifacts

Drift artifacts are local agent context and should not be committed by default. Before creating the first `drift/` directory or writing any Drift artifact in a target project:

1. Check the repository-root `.gitignore`.
2. If `.gitignore` does not exist, create it.
3. Ensure it contains an entry that ignores the project-local Drift folder, preferably `/drift/`.
4. Preserve existing `.gitignore` contents; append the Drift entry if needed.

Do this as part of the Drift workflow without requiring a separate user request.
