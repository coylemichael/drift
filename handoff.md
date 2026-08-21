---
name: handoff
description: Use when stopping mid-implementation to snapshot current state and set up the next session to continue
---

# Handoff

You are tasked with writing a handoff document that snapshots where you are so the next session can continue your work. Document what you did, what you learned, and what's next — nothing more.

## Core Constraint

**Document what IS, not what SHOULD BE.** Describe the current state of the implementation factually. Don't editorialize, suggest improvements, or revisit decisions unless something from the research plan turned out to be wrong.

## Before Writing

- Identify the **feature** from the source research or prior handoff path (`drift/<feature>/...`). All artifacts for this feature live directly inside that `<feature>` folder. If you can't determine it from context, ask the user.
- If the prior artifact uses an older layout such as `drift/<feature>/handoffs/...`, infer the feature from the path and write the next flat numbered file in `drift/<feature>/` unless the user explicitly asks to preserve the legacy subfolder chain.
- If the user is continuing or adding related work for the same feature, create a new numbered artifact in the same feature folder rather than modifying an older artifact.
- Review the changes you made this session.
- Check the source research doc and/or previous handoff to confirm what was planned vs. what actually happened.
- Run `git diff HEAD --stat` to review uncommitted changes, or `git log --stat -1` if changes are already committed.

## Output Format

```markdown
## Objective
[One-sentence summary of the broader task]

## Source Documents
- drift/<feature>/NNN-research-topic.md
- drift/<feature>/NNN-plan-description.md (if continuing from a plan)
- drift/<feature>/NNN-handoff-description.md (if continuing from one)

## Status
[Which phase/step you're on from the research doc. What's done, what's in progress, what's untouched.]

- **Completed:** Phase 1.1, 1.2, 1.3
- **In progress:** Phase 1.4 — [brief description of where you stopped]
- **Not started:** Phase 1.5, Phase 2+

## What Changed
[Files you created or modified. Use file:line references. Brief description of each change — what it does, not why (the research doc covers why).]

- src/db/schema.py:84-96 — added endorsement metadata columns
- src/extraction/endorsement.py (new) — endorsement metadata extraction
- src/config.py:23 — added ENDORSEMENT_VALIDATION_PHRASES

## Codebase Context
[Things you discovered about the codebase during implementation that aren't in the research doc. How things actually connect. Patterns the next session should follow. Gotchas.]

## What Deviated from Plan
[Anything you did differently from the research doc and why. If nothing deviated, say so.]

## Open Questions
[Unresolved questions — both carried forward from the research and any new ones that came up during implementation.]

## Next Steps
[Ordered list of what the next session should do. Be specific — reference phases from the research doc and files to touch.]
```

## Writing to Disk

Save to: `drift/<feature>/NNN-handoff-<description>.md` at the **repository root**, where `<feature>` is inferred from the source research or prior handoff path and `NNN` is the next artifact number in that feature folder.

Allocate `NNN` by scanning existing markdown files in `drift/<feature>/` whose names start with a three-digit prefix and hyphen. Use the next number after the highest prefix, or `001` if none exist.

Before creating `drift/` or writing the artifact, ensure the repository-root `.gitignore` exists and contains `/drift/`; create `.gitignore` or append the entry if needed.

Create `drift/<feature>/` if it doesn't exist.

### Path verification

Before writing, confirm the resolved path is **inside the repository** and matches `drift/<feature>/NNN-handoff-<description>.md`. Do not write new artifacts to `research/`, `plans/`, or `handoffs/` subfolders. Legacy subfolder paths are allowed only when explicitly continuing an existing legacy chain. Do not write to editor memory systems, temp directories, user-profile paths, or any absolute path outside the repository root. If you cannot resolve the repository root, ask the user rather than guess.

Include frontmatter:

```yaml
---
date: [ISO 8601 datetime with timezone]
branch: [Current branch name]
git_commit: [Current commit hash]
feature: [Feature folder name]
sequence: [Three-digit artifact sequence]
source_research: [Path to the research document, if any]
previous_handoff: [Path to previous handoff, if any]
related_artifacts: [List of related Drift artifact paths, if any]
type: handoff
---
```

## Guidelines

- File references over prose. `src/db/schema.py:84` beats "the schema file."
- Be honest about state. If something is half-done or broken, say so. The next session needs the truth, not a clean narrative.
- Keep "Codebase Context" factual. "The extraction module uses X pattern, follow it" — good. "The extraction module should be refactored" — out of scope.
- Don't repeat the research doc. Reference it, don't restate it. The next session will read both documents.
- Avoid code snippets. Use file:line references instead. The one exception is if you're debugging something and the next session needs to see the exact error or the exact problematic code.
- If there are 3+ previous handoffs in the chain, summarize completed phases in the Status section rather than requiring the next session to read the full chain.

## Resuming from a Handoff

If you are pointed at an existing handoff document to **continue** work (rather than write a new handoff):

1. Read the handoff document
2. Read the source research document it references, if any
3. If the handoff references a previous handoff, read that too — but focus on the most recent one
4. Infer the feature folder from the handoff path, including legacy paths such as `drift/<feature>/handoffs/...`
5. Pick up at the **Next Steps** section of the handoff
6. Do not re-investigate the codebase or re-research. Trust the handoff's description of current state
7. If a file reference in the handoff no longer matches what's on disk, note the discrepancy and adapt — don't halt
8. When you finish or need to stop, write a new handoff using the format above, referencing the one you resumed from as `previous_handoff` and using the next flat numbered artifact file in the same feature folder
