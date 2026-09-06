---
name: research
description: Use when researching or documenting how the codebase works - answering questions about architecture, data flow, component interactions, or how specific features are implemented
---

# Research

## Core Constraint

**Document what IS, not what SHOULD BE.** Do not suggest improvements, critique the implementation, or recommend changes unless explicitly asked. Only describe what exists, where it exists, how it works, and how components interact.

## Before Investigating

- Read any files the user mentions first.
- Determine the Drift feature folder before writing anything:
  - If the user points to an existing Drift artifact or folder, infer the feature from that path (`drift/<feature>/...`) and continue using it.
  - For a new research task, confirm a concise **feature identifier** with the user. A ticket reference (e.g., `PROJ-1234`) or descriptive slug (e.g., `auth-refactor`) both work.
  - All artifacts for the feature live directly under `drift/<feature>/`; do not create `research/`, `plans/`, or `handoffs/` subfolders for new artifacts.
- Treat each artifact file as a new step in the feature narrative. If the user starts related research later, create a new numbered `research` file rather than modifying an older artifact.
- Check `drift/<feature>/` for existing research files on the topic.

## Output Format

When presenting findings, use this structure:

```markdown
## Research Question
[Original query]

## Summary
[High-level answer in 2-3 sentences]

## Detailed Findings

### [Component/Area]
- What exists and where (file:line references)
- How it connects to other components

## Code References
- path/to/file.py:123 - Description

## Open Questions
[Anything that needs further investigation]
```

## Writing to Disk

Save research documents to disk by default. Skip saving only if the user explicitly asks for a quick or informal answer.

- Save to `drift/<feature>/NNN-research-<topic>.md` at the **repository root**, where `<feature>` is the identifier confirmed above and `NNN` is the next artifact number in that feature folder.
- Allocate `NNN` by scanning existing markdown files in `drift/<feature>/` whose names start with a three-digit prefix and hyphen. Use the next number after the highest prefix, or `001` if none exist.
- Before creating `drift/` or writing the artifact, ensure the repository-root `.gitignore` exists and contains `/drift/`; create `.gitignore` or append the entry if needed.
- Create `drift/<feature>/` at the repository root if it doesn't exist.
- Use the output format above.
- After writing the artifact, append a row for it to `drift/INDEX.md` — the repo-wide chronological index. Create the index if it doesn't exist, and rebuild it from frontmatter if it has fallen out of sync with the folders. See the "Root Index" section of `SKILL.md` for the format, ordering, and rebuild rules.

### Path verification

Before writing, confirm the resolved path is **inside the repository** and matches `drift/<feature>/NNN-research-<topic>.md`. Do not write new artifacts to `research/`, `plans/`, or `handoffs/` subfolders. Legacy subfolder paths are allowed only when explicitly continuing an existing legacy chain. Do not write to:

- Editor memory systems (Copilot memory, Cursor rules, Claude memory directories)
- Temp directories (`/tmp`, `$TMPDIR`)
- User-profile paths (`~/`, `$HOME`, VS Code workspace storage)
- Any absolute path outside the repository root

If you cannot resolve the repository root, ask the user rather than guess.

Include frontmatter:

```yaml
---
date: [ISO 8601 datetime with timezone]
branch: [Current branch name]
git_commit: [Current commit hash]
feature: [Feature folder name]
sequence: [Three-digit artifact sequence]
related_artifacts: [List of related Drift artifact paths, if any]
type: research
---
```
