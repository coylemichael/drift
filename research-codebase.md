---
name: research-codebase
description: Use when researching or documenting how the codebase works - answering questions about architecture, data flow, component interactions, or how specific features are implemented
---

# Research Codebase

## Core Constraint

**Document what IS, not what SHOULD BE.** Do not suggest improvements, critique the implementation, or recommend changes unless explicitly asked. Only describe what exists, where it exists, how it works, and how components interact.

## Before Investigating

- Read any files the user mentions first
- Check `research/` for existing research on the topic

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

- Save to `research/YYYY-MM-DD-<topic>.md` at the **repository root**
- Create the `research/` directory at the repository root if it doesn't exist
- Use the output format above
- Do not write to editor memory systems, temp directories, or user-profile paths — these are project artifacts that live in the repo