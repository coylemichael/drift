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
- Choose the portable **next-session profile** best suited to the next incomplete work: use `research`, `planning`, or `implementation` for Drift's three standard work modes. Use a configured local profile name when one is known; never invent a provider/model name in the artifact. If a genuine user decision is pending, do not supply a profile that would automatically continue; ask the user and wait instead.
- **Look for this thread's measured record.** Pi's Drift extension supplies its path and baseline in context. Read it and use it — see "Session Records" below. Outside Pi, use an explicitly supplied baseline if one exists; never invent the session start.
- Run `git diff HEAD --stat` to review uncommitted changes, or `git log --stat -1` if changes are already committed. With a record, review `git diff --stat <startCommit>` and `git log <startCommit>..HEAD`, but also compare its starting fingerprint: the commit diff can include inherited or other threads' changes.

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

**When `drift_publish` is available:** follow `SKILL.md`'s "Publishing with Pi" section. Supply the required Markdown body, feature, `kind: handoff`, slug, references, and a lowercase-hyphenated `next_session_profile`; do not supply frontmatter or write the index yourself. The profile names the kind of receiving work, not a provider/model. Successful publication completes only this thread's current interval. Do not delete its record. The remaining disk/frontmatter instructions are the portable manual route.

Save to: `drift/<feature>/NNN-handoff-<description>.md` at the **repository root**, where `<feature>` is inferred from the source research or prior handoff path and `NNN` is the next artifact number in that feature folder.

Allocate `NNN` by scanning existing markdown files in `drift/<feature>/` whose names start with a three-digit prefix and hyphen. Use the next number after the highest prefix, or `001` if none exist.

Before creating `drift/` or writing the artifact, ensure the repository-root `.gitignore` exists and contains `/drift/`; create `.gitignore` or append the entry if needed.

Create `drift/<feature>/` if it doesn't exist.

After writing the artifact, append a row for it to `drift/INDEX.md` — the repo-wide chronological index. Create the index if it doesn't exist, and rebuild it from frontmatter if it has fallen out of sync with the folders. See the "Root Index" section of `SKILL.md` for the format, ordering, and rebuild rules.

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
session_started: [Session start, from the session record — omit if there is none]
source_research: [Path to the research document, if any]
previous_handoff: [Path to previous handoff, if any]
related_artifacts: [List of related Drift artifact paths, if any]
next_session_profile: [Portable lower-case-hyphenated receiving profile]
type: handoff
---
```

Take `date` from the system clock, never from an estimate or from a previous artifact's value — `date -Iseconds`, or `python3 -c 'import datetime; print(datetime.datetime.now().astimezone().isoformat(timespec="seconds"))'` where portability matters. Both print the required form with the machine's real offset. A guessed timestamp reads as measured and silently corrupts the index ordering; see "Timestamps" in `SKILL.md`.

If a session record exists, add `session_started: [the record's started value]` beneath `date`. `date` is when the handoff was written; `session_started` is when the work began. Copy it from the record rather than working it out.

## Session Records

Pi's extension writes the measured baseline before work and preserves it across turns and resume. Read the exact supplied record: `started`, `startBranch`, `startCommit`, `baseline` and any `checkpoint` contain measurements, not a reconstruction from conversation memory. The publisher uses the original start for `session_started` and a fresh clock read for `date`.

Use the recorded starting fingerprint as well as `git diff --stat <startCommit>` / `git log --oneline <startCommit>..HEAD`. Git deltas observe a worktree shared with other threads; they do not prove exclusive authorship.

**Pi records are extension-owned.** `drift_publish` writes and verifies the artifact/index before recording completion. It retains a receipt so retries cannot silently create a second handoff or reopen the same interval. Do not delete the record or Pi's conversation JSONL. If the tool fails, do not claim completion. Correct argument validation errors before retrying; if a pending publication exists, report the failure and retry the same input.

### Profile-directed Pi continuation

After a successful profiled handoff publication, tell the user that Pi is creating the next fresh session automatically; do not ask for a copy/paste continuation action. The queued session uses `drift-continue` internally to validate the repository-local handoff, resolve its `next_session_profile` using the receiving machine's configured profile map, select the mapped model and thinking level **before** inference, and continue its Next Steps. It fails visibly without inference when the artifact/profile/configuration/model authentication is unavailable, leaving the published handoff intact. For an older unprofiled handoff, a failed automatic continuation, or outside Pi, use the ordinary manual resume procedure below and select a model yourself.

Outside Pi, an explicitly supplied measured record can be used as evidence. Legacy records may use `start_branch`, `start_commit` and `start_fingerprint`. If none exists, omit `session_started`. Do not reconstruct a precise timestamp from memory or a previous artifact.

### Reconstructing earlier work

Only do this when the user confirms the earlier thread is no longer active and wants its work written up. Read its record and Git history, and clearly label the handoff **reconstructed after the fact**. Describe original measurements in the body with their source. In Pi, the publisher's frontmatter still identifies the current writing interval; do not substitute the other thread's ID or mark its record completed.

Leave other threads' and historical records untouched. An explicitly owned legacy manual record may be consumed after its handoff/index are validated under that record's original workflow, but never delete a Pi-owned record or choose a record by recency.

## Guidelines

- File references over prose. `src/db/schema.py:84` beats "the schema file."
- Be honest about state. If something is half-done or broken, say so. The next session needs the truth, not a clean narrative.
- Keep "Codebase Context" factual. "The extraction module uses X pattern, follow it" — good. "The extraction module should be refactored" — out of scope.
- Don't repeat the research doc. Reference it, don't restate it. The next session will read both documents.
- Avoid code snippets. Use file:line references instead. The one exception is if you're debugging something and the next session needs to see the exact error or the exact problematic code.
- If there are 3+ previous handoffs in the chain, summarize completed phases in the Status section rather than requiring the next session to read the full chain.

## Resuming from a Handoff

Automatic continuation is the normal Pi path for new profiled handoffs. To recover an existing profiled handoff manually in a fresh Pi thread, use `drift-continue drift/<feature>/<NNN>-handoff-<description>.md`; it selects the declared local profile before asking any model to continue. Otherwise, if you are pointed at an existing handoff document to **continue** work:

1. Read the handoff document
2. Read the source research document it references, if any
3. If the handoff references a previous handoff, read that too — but focus on the most recent one
4. Infer the feature folder from the handoff path, including legacy paths such as `drift/<feature>/handoffs/...`
5. Skim the tail of `drift/INDEX.md` to see what happened elsewhere in the repo since that handoff was written — other features may have landed changes it does not know about
6. Pick up at the **Next Steps** section of the handoff
7. Do not re-investigate the codebase or re-research. Trust the handoff's description of current state
8. If a file reference in the handoff no longer matches what's on disk, note the discrepancy and adapt — don't halt
9. When you finish or need to stop, write a new handoff using the format above, referencing the one you resumed from as `previous_handoff` and using the next flat numbered artifact file in the same feature folder
