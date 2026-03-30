---
name: handoff-from-research
description: Use after a research document has been produced to create an actionable handoff that sets up the first implementation session
---

# Handoff from Research

You are tasked with turning a research document into an actionable handoff for an implementation session. The research doc describes what needs to happen. Your job is to produce a document that tells the next session where to start and what to do first.

## Core Constraint

**Do not re-investigate the codebase.** Trust the research document. Your job is to restructure it into an actionable starting point, not to verify or expand on it.

## Before Writing

- Read the research document provided
- Read any critical files it references (schemas, existing extraction code, prompts, etc.) to confirm they still match what the research describes. If a referenced file has changed significantly, note the discrepancy in Open Questions — do not re-research, but flag it so the implementation session can assess.
- Check `.handoffs/` for any existing handoffs on the same topic
- The source research document follows the `research/YYYY-MM-DD-<topic>.md` convention

## Output Format

```markdown
## Objective
[One-sentence summary of what this implementation achieves]

## Source Research
- path/to/research/YYYY-MM-DD-topic.md

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

Save to: `.handoffs/<TICKET>/YYYY-MM-DD_HH-MM-SS_<TICKET>_from-research.md`

If no ticket identifier is provided, use the research topic as the folder name instead.

Include frontmatter:

```yaml
---
date: [ISO 8601 datetime with timezone]
branch: [Current branch name]
git_commit: [Current commit hash]
source_research: [Path to the research document]
type: from_research
---
```

## Guidelines

- Follow the research doc's sequencing. If it says Phase 1 before Phase 2, don't reorder unless there's a clear reason.
- Be specific about files. "Update the database schema" is useless. "Add columns to endorsement_documents table in src/db/schema.py:84" is useful.
- Keep tasks small and verifiable. Each item in the implementation sequence should be something you can confirm works before moving on.
- Carry forward open questions. Don't drop them. The implementation session needs to know what's unresolved.
- Don't add scope. If it's not in the research doc, it's not in the handoff.