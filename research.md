---
name: research
description: Use when researching or documenting how the codebase works - answering questions about architecture, data flow, component interactions, or how specific features are implemented
---

# Research

## Core Constraint

**Document what IS, not what SHOULD BE.** Do not suggest improvements, critique the implementation, or recommend changes unless explicitly asked. Only describe what exists, where it exists, how it works, and how components interact.

## Before Investigating

- Confirm the **feature identifier** with the user before writing anything. A ticket reference (e.g., `PROJ-1234`) or a descriptive slug (e.g., `auth-refactor`) both work — anything that uniquely identifies the work. All artifacts for this feature will live under `drift/<feature>/` at the repository root.
- Read any files the user mentions first
- Check `drift/<feature>/research/` for existing research on the topic

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

- Save to `drift/<feature>/research/YYYY-MM-DD-<topic>.md` at the **repository root**, where `<feature>` is the identifier confirmed above
- Create `drift/<feature>/research/` at the repository root if it doesn't exist
- Use the output format above

### Path verification

Before writing, confirm the resolved path is **inside the repository** and matches `drift/<feature>/research/...`. Do not write to:

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
type: research
---
```