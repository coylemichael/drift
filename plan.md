---
name: plan
description: Use after a research document has been produced to create an actionable handoff that sets up the first implementation session
---

# Plan

You are tasked with turning a research document into an actionable handoff for an implementation session. The research doc describes what needs to happen. Your job is to produce a document that tells the next session where to start and what to do first.

## Core Constraint

**Do not re-investigate the codebase.** Trust the research document. Your job is to restructure it into an actionable starting point, not to verify or expand on it.

## Before Writing

- Identify the **feature** from the source research path (`drift/<feature>/NNN-research-...`). All artifacts for this feature live directly inside that `<feature>` folder.
- If the research path uses an older layout such as `drift/<feature>/research/...`, infer the feature from the path and write the next flat numbered file in `drift/<feature>/` unless the user explicitly asks to preserve the legacy subfolder chain.
- If the research path doesn't follow a Drift convention, ask the user for the feature folder rather than guessing.
- Read the research document provided.
- Read any critical files it references (schemas, existing extraction code, prompts, etc.) to confirm they still match what the research describes. If a referenced file has changed significantly, note the discrepancy in Open Questions — do not re-research, but flag it so the implementation session can assess.
- Check `drift/<feature>/` for any existing plan or handoff files on this feature.
- The current source research document convention is `drift/<feature>/NNN-research-<topic>.md`.

## Output Format

```markdown
## Objective
[One-sentence summary of what this implementation achieves]

## Source Research
- drift/<feature>/NNN-research-topic.md

## Starting Point
[Which phase/step from the research to begin with and why. If the research has a recommended order, follow it. Call out any dependencies that must be done first.]

## Key Files
[Files the next session needs to read before writing any code. These are the files the implementation will touch or depend on. Use file:line references.]
- path/to/file.py — what it does and why it matters
- path/to/other_file.py:45-80 — specific section that's relevant

## Implementation Sequence
[Ordered list of concrete tasks drawn from the research. Each task should be small enough to verify independently. Reference the research doc's phase/step numbers.]

1. **[Phase X.Y — short description]** — what to do, which files to touch
2. **[Phase X.Z — short description]** — what to do, which files to touch
...

## Decisions & Constraints
[Anything from the research that constrains how the work should be done — architectural choices, patterns to follow, things to reuse vs. build new.]

## Open Questions
[Carried forward from the research doc. Anything unresolved that the implementation session may need to answer or work around.]
```

## Writing to Disk

Save to: `drift/<feature>/NNN-plan-<description>.md` at the **repository root**, where `<feature>` is inferred from the source research path and `NNN` is the next artifact number in that feature folder.

Allocate `NNN` by scanning existing markdown files in `drift/<feature>/` whose names start with a three-digit prefix and hyphen. Use the next number after the highest prefix, or `001` if none exist.

Before creating `drift/` or writing the artifact, ensure the repository-root `.gitignore` exists and contains `/drift/`; create `.gitignore` or append the entry if needed.

Create `drift/<feature>/` if it doesn't exist.

### Path verification

Before writing, confirm the resolved path is **inside the repository** and matches `drift/<feature>/NNN-plan-<description>.md`. Do not write new artifacts to `research/`, `plans/`, or `handoffs/` subfolders. Legacy subfolder paths are allowed only when explicitly continuing an existing legacy chain. Do not write to editor memory systems, temp directories, user-profile paths, or any absolute path outside the repository root. If you cannot resolve the repository root, ask the user rather than guess.

Include frontmatter:

```yaml
---
date: [ISO 8601 datetime with timezone]
branch: [Current branch name]
git_commit: [Current commit hash]
feature: [Feature folder name]
sequence: [Three-digit artifact sequence]
source_research: [Path to the research document]
related_artifacts: [List of related Drift artifact paths, if any]
type: plan
---
```

## Guidelines

- Follow the research doc's sequencing. If it says Phase 1 before Phase 2, don't reorder unless there's a clear reason.
- Be specific about files. "Update the database schema" is useless. "Add columns to endorsement_documents table in src/db/schema.py:84" is useful.
- Keep tasks small and verifiable. Each item in the implementation sequence should be something you can confirm works before moving on.
- Carry forward open questions. Don't drop them. The implementation session needs to know what's unresolved.
- Don't add scope. If it's not in the research doc, it's not in the handoff.
