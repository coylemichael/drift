---
name: drift
description: Use Drift for multi-session codebase research, implementation planning, handoffs, and context continuity across agent sessions.
---

# Drift

Drift is a context-continuity workflow for multi-session agentic coding. It helps preserve the useful parts of a session — research, implementation plans, and handoffs — so future agent sessions can continue without re-discovering the same context.

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
