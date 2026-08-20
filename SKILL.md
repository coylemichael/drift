---
name: drift
description: Use Drift for multi-session codebase research, implementation planning, handoffs, and context continuity across agent sessions.
---

# Drift

Drift is a context-continuity workflow for multi-session agentic coding. It helps preserve the useful parts of a session — research, implementation plans, and handoffs — so future agent sessions can continue without re-discovering the same context.

## Skill Router

This skill is the single entrypoint for Drift. Do not split Drift into separate global skills for research, planning, and handoffs. Instead, route the user's request to the appropriate prompt file in this skill directory:

- **Research request** — codebase research, architecture questions, data flow, feature discovery, or documenting what exists: read and follow `research.md`.
- **Planning request** — turning completed research into an actionable implementation plan or starting handoff: read and follow `plan.md`.
- **Handoff request** — writing a session snapshot, stopping mid-work, resuming from a previous handoff, continuing from `drift/<feature>/handoffs/...`, or preparing the next session: read and follow `handoff.md`.

If the user invokes Drift but the mode is unclear, ask whether they want research, planning, or handoff/resume.

When routing to a prompt file:

1. Treat that file as the active workflow instructions.
2. Follow its output format, disk-writing rules, and path-verification rules.
3. Do not duplicate the full prompt contents in chat unless the user asks.
4. Keep using this `SKILL.md` for mode selection and global guardrails.

## When to Use Drift

Use Drift when the task involves:

- Codebase research or documenting how existing code works
- Turning research into an implementation plan
- Writing handoffs before stopping work
- Resuming from previous handoffs
- Work that is likely to span multiple agent sessions

## When Not to Use Drift

Skip Drift for:

- Trivial one-file edits
- Throwaway scripts or prototypes
- Tasks likely to complete in a single session

## Workflow

Drift uses three prompt files in this skill repo. Reference and follow the relevant file rather than duplicating its full contents:

- `research.md` — investigate and document what exists in the codebase
- `plan.md` — turn research into an actionable implementation plan
- `handoff.md` — snapshot current state for a future session, or resume from an existing handoff

Use the workflow as needed:

1. Research the target project with `research.md`.
2. Convert completed research into an implementation plan with `plan.md`.
3. Write or resume handoffs with `handoff.md` whenever work crosses session boundaries.

## Artifact Location

The Drift skill may live globally at `~/.agents/skills/drift`, but generated Drift artifacts must be written inside the current target project, not inside this skill repo.

Use this project-local structure:

```text
drift/<feature>/research/
drift/<feature>/handoffs/
```

Before creating the first Drift artifact for a task, ask the user for a feature identifier. A ticket reference such as `PROJ-1234` or a descriptive slug such as `auth-refactor` is fine. Use that identifier consistently for all artifacts under `drift/<feature>/` in the target project.

If the target project root is unclear, ask the user before writing any Drift artifact.

## Gitignore Drift Artifacts

Drift artifacts are local agent context and should not be committed by default. Before creating the first `drift/` directory or writing any Drift artifact in a target project:

1. Check the repository-root `.gitignore`.
2. If `.gitignore` does not exist, create it.
3. Ensure it contains an entry that ignores the project-local Drift folder, preferably `/drift/`.
4. Preserve existing `.gitignore` contents; append the Drift entry if needed.

Do this as part of the Drift workflow without requiring a separate user request.
